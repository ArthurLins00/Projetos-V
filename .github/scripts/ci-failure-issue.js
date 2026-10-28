// Abre uma issue para cada execução de workflow que falhar, com os jobs, passos e trechos do log,
// e fecha as issues abertas quando o mesmo workflow volta a passar na mesma branch.
// Chamado pelo .github/workflows/ci-failure-issues.yml via actions/github-script.

const LABEL = 'ci-failure';
const FAILED = ['failure', 'timed_out'];
const MAX_ERROR_LINES = 20;
const MAX_TAIL_LINES = 60;
const MAX_BODY = 60000;

const ANSI = /\x1b\[[0-9;]*m/g;
const TIMESTAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;

// Evita que um ``` do log feche o bloco de código da issue
const fence = (text) => text.replace(/```/g, '``​`');

function cleanLog(raw) {
  return String(raw)
    .split(/\r?\n/)
    .map((line) => line.replace(ANSI, '').replace(TIMESTAMP, ''))
    .filter((line) => line.trim() !== '');
}

function formatDuration(start, end) {
  const seconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}min ${seconds % 60}s` : `${seconds}s`;
}

async function describeJob(github, owner, repo, job) {
  const failedSteps = (job.steps || []).filter((step) => FAILED.includes(step.conclusion));
  const parts = [`### ❌ [${job.name}](${job.html_url})`, ''];

  if (failedSteps.length) {
    parts.push('**Passos com falha:**');
    for (const step of failedSteps) parts.push(`- ${step.name} (\`${step.conclusion}\`)`);
  } else {
    parts.push(`Nenhum passo marcado com falha; o job terminou como \`${job.conclusion}\`.`);
  }
  parts.push('');

  try {
    const { data } = await github.rest.actions.downloadJobLogsForWorkflowRun({ owner, repo, job_id: job.id });
    const lines = cleanLog(data);
    const errors = lines.filter((line) => line.includes('##[error]')).slice(-MAX_ERROR_LINES);
    const tail = lines.slice(-MAX_TAIL_LINES);

    if (errors.length) {
      parts.push('**Erros reportados:**', '```', fence(errors.map((l) => l.replace('##[error]', '')).join('\n')), '```', '');
    }
    parts.push(
      '<details>',
      `<summary>Últimas ${tail.length} linhas do log</summary>`,
      '',
      '```',
      fence(tail.join('\n')),
      '```',
      '</details>',
      ''
    );
  } catch (error) {
    parts.push(`_Não foi possível baixar o log do job: ${error.message}_`, '');
  }

  return parts.join('\n');
}

module.exports = async ({ github, context, core }) => {
  const run = context.payload.workflow_run;
  const { owner, repo } = context.repo;
  const keyMarker = `<!-- ci-failure-key:${run.name}|${run.head_branch} -->`;
  const runMarker = `<!-- ci-failure-run:${run.id} -->`;

  const openIssues = (
    await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'open', labels: LABEL, per_page: 100 })
  ).filter((issue) => !issue.pull_request && issue.body?.includes(keyMarker));

  if (run.conclusion === 'success') {
    for (const issue of openIssues) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body: `✅ [${run.name} #${run.run_number}](${run.html_url}) passou em \`${run.head_branch}\` (commit ${run.head_sha.slice(0, 7)}). Fechando.`,
      });
      await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: 'closed', state_reason: 'completed' });
      core.info(`Issue #${issue.number} fechada`);
    }
    return;
  }

  if (!FAILED.includes(run.conclusion)) {
    core.info(`Execução terminou como ${run.conclusion}; nada a registrar`);
    return;
  }

  try {
    await github.rest.issues.createLabel({
      owner,
      repo,
      name: LABEL,
      color: 'd73a4a',
      description: 'Falha registrada automaticamente pelo CI',
    });
  } catch (error) {
    if (error.status !== 422) throw error; // 422: a label já existe
  }

  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
    owner,
    repo,
    run_id: run.id,
    filter: 'latest',
    per_page: 100,
  });
  const failedJobs = jobs.filter((job) => FAILED.includes(job.conclusion));

  const commitUrl = `${run.repository.html_url}/commit/${run.head_sha}`;
  const commitTitle = (run.head_commit?.message || '').split('\n')[0];
  const prs = (run.pull_requests || []).map((pr) => `#${pr.number}`).join(', ') || '—';

  const summary = [
    '| | |',
    '|---|---|',
    `| **Workflow** | [${run.name} #${run.run_number}](${run.html_url}) (tentativa ${run.run_attempt}) |`,
    `| **Resultado** | \`${run.conclusion}\` |`,
    `| **Evento** | \`${run.event}\` |`,
    `| **Branch** | \`${run.head_branch}\` |`,
    `| **Commit** | [\`${run.head_sha.slice(0, 7)}\`](${commitUrl}) ${commitTitle.replace(/\|/g, '\\|')} |`,
    `| **Autor** | ${run.head_commit?.author?.name || '—'} (disparado por \`${run.triggering_actor?.login || run.actor?.login}\`) |`,
    `| **PR** | ${prs} |`,
    `| **Início** | ${run.run_started_at} |`,
    `| **Duração** | ${formatDuration(run.run_started_at, run.updated_at)} |`,
  ].join('\n');

  const jobSections = [];
  for (const job of failedJobs) jobSections.push(await describeJob(github, owner, repo, job));

  const jobsText = jobSections.length
    ? `## Jobs com falha (${failedJobs.length})\n\n${jobSections.join('\n')}`
    : '## Jobs com falha\n\nNenhum job individual falhou; veja a execução para detalhes.';

  let details = `${summary}\n\n${jobsText}`;
  if (details.length > MAX_BODY) {
    details = `${details.slice(0, MAX_BODY)}\n\n_…conteúdo truncado; veja o log completo na execução._`;
  }

  // Nova tentativa da mesma execução: comenta na issue que já existe em vez de abrir outra
  const sameRun = openIssues.find((issue) => issue.body.includes(runMarker));
  if (sameRun) {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: sameRun.number,
      body: `## Tentativa ${run.run_attempt} também falhou\n\n${details}`,
    });
    core.info(`Comentário adicionado na issue #${sameRun.number}`);
    return;
  }

  const previous = openIssues.map((issue) => `#${issue.number}`);
  const recurring = previous.length
    ? `> ⚠️ Falha recorrente: este workflow já está quebrado nesta branch (${previous.join(', ')}).\n\n`
    : '';

  const { data: issue } = await github.rest.issues.create({
    owner,
    repo,
    title: `CI falhou: ${run.name} em ${run.head_branch} (${run.head_sha.slice(0, 7)})`,
    labels: [LABEL],
    body: `${recurring}${details}\n\n${keyMarker}\n${runMarker}`,
  });
  core.info(`Issue #${issue.number} criada: ${issue.html_url}`);
};
