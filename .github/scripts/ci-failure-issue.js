// Abre uma issue para cada execução de workflow que falhar, com os jobs, passos e trechos do log,
// e fecha as issues abertas quando o mesmo workflow volta a passar na mesma branch.
// Chamado pelo .github/workflows/ci-failure-issues.yml via actions/github-script.
//
// Variáveis do repositório (Settings > Secrets and variables > Actions > Variables), opcionais:
//   CI_FAILURE_ASSIGNEES  logins separados por vírgula, atribuídos em toda issue além do autor
//   CI_FAILURE_LABELS     labels extras separadas por vírgula

const LABEL = 'ci-failure';
const FAILED = ['failure', 'timed_out'];
const MAX_ERROR_LINES = 20;
const MAX_TAIL_LINES = 60;
const MAX_BODY = 60000;
const MAX_ASSIGNEES = 10; // limite do GitHub por issue

const PRIORITY_LABEL = 'prioridade: alta';
const PROTECTED_BRANCHES = ['main', 'dev'];

// Área pelo nome do job ("Backend / Testes unitários e de API") ou do workflow; a ordem importa
const AREAS = [
  [/E2E Mobile|Maestro|Fluxos de tela/i, 'area: mobile-e2e'],
  [/^Mobile/i, 'area: mobile'],
  [/^Agente de IA/i, 'area: ai-agent'],
  [/^Backend|Testes unitários|Testes End-to-End|^Build/i, 'area: backend'],
];

const LABEL_STYLES = {
  [LABEL]: ['d73a4a', 'Falha registrada automaticamente pelo CI'],
  [PRIORITY_LABEL]: ['b60205', 'Falha em main, dev ou na regressão diária'],
  'area: backend': ['1d76db', 'Backend'],
  'area: mobile': ['5319e7', 'App mobile'],
  'area: mobile-e2e': ['8a63d2', 'Fluxos E2E do app (Maestro)'],
  'area: ai-agent': ['0e8a16', 'Agente de IA'],
};

const listFromEnv = (name) =>
  (process.env[name] || '')
    .split(',')
    .map((item) => item.trim().replace(/^@/, ''))
    .filter(Boolean);

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

function labelsFor(run, failedJobs) {
  const labels = new Set([LABEL]);
  const names = failedJobs.length ? failedJobs.map((job) => job.name) : [run.name];
  for (const name of names) {
    const area = AREAS.find(([pattern]) => pattern.test(name));
    if (area) labels.add(area[1]);
  }
  if (PROTECTED_BRANCHES.includes(run.head_branch) || run.event === 'schedule') labels.add(PRIORITY_LABEL);
  for (const extra of listFromEnv('CI_FAILURE_LABELS')) labels.add(extra);
  return [...labels];
}

async function ensureLabels(github, owner, repo, labels) {
  for (const name of labels) {
    const [color, description] = LABEL_STYLES[name] || ['ededed', ''];
    try {
      await github.rest.issues.createLabel({ owner, repo, name, color, description });
    } catch (error) {
      if (error.status !== 422) throw error; // 422: a label já existe
    }
  }
}

// Quem subiu o código (e quem disparou a nova tentativa), o autor do PR e as pessoas fixas da
// variável CI_FAILURE_ASSIGNEES; fica de fora quem é bot ou não pode receber issues no repositório
async function resolveAssignees(github, owner, repo, run, core) {
  const candidates = [run.actor, run.triggering_actor]
    .filter((user) => user && user.type !== 'Bot')
    .map((user) => user.login);

  for (const pr of run.pull_requests || []) {
    try {
      const { data } = await github.rest.pulls.get({ owner, repo, pull_number: pr.number });
      if (data.user?.type !== 'Bot') candidates.push(data.user.login);
    } catch (error) {
      core.warning(`Não foi possível ler o PR #${pr.number}: ${error.message}`);
    }
  }
  candidates.push(...listFromEnv('CI_FAILURE_ASSIGNEES'));

  const assignees = [];
  for (const login of new Set(candidates.filter((login) => login && !login.endsWith('[bot]')))) {
    try {
      await github.rest.issues.checkUserCanBeAssigned({ owner, repo, assignee: login });
      assignees.push(login);
    } catch {
      core.warning(`${login} não pode receber issues neste repositório; ignorado`);
    }
  }
  return assignees.slice(0, MAX_ASSIGNEES);
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

  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
    owner,
    repo,
    run_id: run.id,
    filter: 'latest',
    per_page: 100,
  });
  const failedJobs = jobs.filter((job) => FAILED.includes(job.conclusion));

  const labels = labelsFor(run, failedJobs);
  await ensureLabels(github, owner, repo, labels);
  const assignees = await resolveAssignees(github, owner, repo, run, core);

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
    await github.rest.issues.addLabels({ owner, repo, issue_number: sameRun.number, labels });
    if (assignees.length) {
      await github.rest.issues.addAssignees({ owner, repo, issue_number: sameRun.number, assignees });
    }
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
    labels,
    assignees,
    body: `${recurring}${details}\n\n${keyMarker}\n${runMarker}`,
  });
  core.info(`Issue #${issue.number} criada: ${issue.html_url}`);
};
