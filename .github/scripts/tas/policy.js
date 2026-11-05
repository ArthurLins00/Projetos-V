// Automação da política de manutenção da TAS (docs/tas.md). Chamado pelo .github/workflows/tas-manutencao.yml
// via actions/github-script; cada exportação é um job:
//   labels     cria ou atualiza as labels de classificação, prioridade e situação
//   prazos     marca com "prazo vencido" as issues que passaram do prazo de triagem ou de correção
//   quarentena abre ou atualiza a issue de acompanhamento dos testes em quarentena (vencidos ou sem issue)
//   revisao    abre a issue da revisão periódica com os números da TAS e o checklist da seção 6

// ---- Labels (seção 8.2) ----------------------------------------------------------------------------
const LABELS = {
  'classificação: pendente': ['fbca04', 'Falha ainda não investigada (triagem pendente)'],
  'classificação: sut': ['d73a4a', 'Defeito no sistema sob teste (backend, app ou agente)'],
  'classificação: tas': ['5319e7', 'Defeito na automação: teste, dado, seletor, mock ou script'],
  'classificação: ambiente': ['0e8a16', 'Infraestrutura do CI, emulador, rede, serviço externo'],
  'classificação: variação esperada': ['c5def5', 'Mudança intencional do comportamento; o teste precisa acompanhar'],
  'prioridade: alta': ['b60205', 'Falha em main, dev ou na regressão diária; segurança ou smoke'],
  'prioridade: média': ['d93f0b', 'Falha em PR ou branch de trabalho; teste instável'],
  'prioridade: baixa': ['fef2c0', 'Melhoria, dívida técnica ou achado da revisão periódica'],
  'teste instável': ['f9d0c4', 'Passa e falha sem mudança de código'],
  quarentena: ['bfd4f2', 'Teste desligado com registro em .github/tas/quarentena.json'],
  'remoção de teste': ['e4e669', 'Proposta de descontinuar um teste (seção 7)'],
  'revisão da TAS': ['1d76db', 'Revisão periódica da automação (seção 6)'],
  'prazo vencido': ['000000', 'Passou do prazo da política (seção 4)'],
  'manutenção da TAS': ['006b75', 'Demanda de manutenção da automação de testes'],
};

// ---- Prazos (seção 4), em horas úteis corridas de seg a sex --------------------------------------------
const PRAZOS = {
  'prioridade: alta': { triagem: 2, correcao: 8 }, // 2 h para classificar; 1 dia útil para corrigir, reverter ou quarentenar
  'prioridade: média': { triagem: 8, correcao: 24 }, // 1 dia útil; 3 dias úteis
  'prioridade: baixa': { triagem: 24, correcao: 80 }, // 3 dias úteis; 10 dias úteis (até a próxima revisão)
};
const HORAS_UTEIS_POR_DIA = 8;
const POLICY_LABELS = ['classificação: pendente', 'manutenção da TAS', 'teste instável', 'quarentena', 'ci-failure'];
const OVERDUE_MARKER = '<!-- tas-prazo-vencido -->';

// Horas úteis entre duas datas, contando só seg a sex e 8 h por dia
function businessHoursBetween(start, end) {
  let hours = 0;
  const day = new Date(start);
  while (day < end) {
    const weekday = day.getUTCDay();
    const next = new Date(Math.min(day.getTime() + 3_600_000, end.getTime()));
    if (weekday !== 0 && weekday !== 6) hours += (next - day) / 3_600_000;
    day.setTime(next.getTime());
  }
  return (hours * HORAS_UTEIS_POR_DIA) / 24;
}

function deadlineFor(issue, now = new Date()) {
  const names = issue.labels.map((l) => (typeof l === 'string' ? l : l.name));
  const priority = Object.keys(PRAZOS).find((p) => names.includes(p)) || 'prioridade: média';
  const pending = names.includes('classificação: pendente');
  const limit = PRAZOS[priority][pending ? 'triagem' : 'correcao'];
  const elapsed = businessHoursBetween(new Date(issue.created_at), now);
  return { priority, stage: pending ? 'triagem' : 'correção', limit, elapsed, overdue: elapsed > limit };
}

async function syncLabels({ github, context, core }) {
  const { owner, repo } = context.repo;
  for (const [name, [color, description]] of Object.entries(LABELS)) {
    try {
      await github.rest.issues.createLabel({ owner, repo, name, color, description });
      core.info(`Label criada: ${name}`);
    } catch (error) {
      if (error.status !== 422) throw error;
      await github.rest.issues.updateLabel({ owner, repo, name, color, description });
    }
  }
}

async function openPolicyIssues(github, owner, repo) {
  const seen = new Map();
  for (const label of POLICY_LABELS) {
    const issues = await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'open', labels: label, per_page: 100 });
    for (const issue of issues) if (!issue.pull_request) seen.set(issue.number, issue);
  }
  return [...seen.values()];
}

async function prazos({ github, context, core }) {
  const { owner, repo } = context.repo;
  const rows = [];
  for (const issue of await openPolicyIssues(github, owner, repo)) {
    const d = deadlineFor(issue);
    rows.push(`| #${issue.number} | ${d.priority} | ${d.stage} | ${d.elapsed.toFixed(1)} h de ${d.limit} h | ${d.overdue ? '⏰ vencido' : 'no prazo'} |`);
    const hasLabel = issue.labels.some((l) => l.name === 'prazo vencido');
    if (!d.overdue || hasLabel) continue;

    await github.rest.issues.addLabels({ owner, repo, issue_number: issue.number, labels: ['prazo vencido'] });
    const assignees = issue.assignees.map((a) => `@${a.login}`).join(' ') || 'Guardião da TAS';
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body:
        `${OVERDUE_MARKER}\n⏰ **Prazo de ${d.stage} vencido** (${d.priority}: ${d.limit} h úteis; passaram ${d.elapsed.toFixed(1)} h).\n\n` +
        `${assignees}: pela política (docs/tas.md, seção 4), registre aqui a classificação e o encaminhamento ou, se ` +
        'não for possível corrigir agora, reverta a mudança ou coloque o teste em quarentena com issue e data de expiração.',
    });
  }
  await core.summary
    .addRaw(['## Prazos da TAS', '', '| Issue | Prioridade | Etapa | Tempo | Situação |', '|---|---|---|---|---|', ...rows, ''].join('\n'))
    .write();
}

function readCheck(path) {
  return JSON.parse(require('fs').readFileSync(path, 'utf8'));
}

async function upsertIssue(github, owner, repo, marker, { title, body, labels }) {
  const existing = (
    await github.paginate(github.rest.issues.listForRepo, { owner, repo, state: 'open', labels: labels[0], per_page: 100 })
  ).find((issue) => issue.body?.includes(marker));
  if (existing) {
    await github.rest.issues.update({ owner, repo, issue_number: existing.number, body: `${body}\n\n${marker}` });
    return existing;
  }
  const { data } = await github.rest.issues.create({ owner, repo, title, labels, body: `${body}\n\n${marker}` });
  return data;
}

async function quarentena({ github, context, core, checkFile }) {
  const { owner, repo } = context.repo;
  const result = readCheck(checkFile);
  const pending = result.quarantine.filter((q) => q.status.length);
  if (!pending.length) {
    core.info('Nenhuma quarentena vencida ou sem issue.');
    return;
  }
  const rows = pending.map(
    (q) => `| \`${q.arquivo}\` | ${q.teste} | ${q.classificacao} | ${q.expira} | ${q.issue ? `#${q.issue}` : '—'} | ${q.status.join(', ')} |`
  );
  const issue = await upsertIssue(github, owner, repo, '<!-- tas-quarentena -->', {
    title: 'TAS: testes em quarentena precisam de decisão',
    labels: ['quarentena', 'manutenção da TAS', 'prioridade: média', 'classificação: tas'],
    body: [
      'Testes desligados cujo registro em `.github/tas/quarentena.json` venceu, não tem issue própria ou já voltou a rodar.',
      'Pela política (docs/tas.md, seção 5), cada um precisa de uma destas decisões, registrada aqui:',
      '',
      '- **corrigir** e religar (remover do registro e da pasta `pending/` ou tirar o `.skip`);',
      '- **prorrogar** a quarentena com justificativa no campo `prorrogacao` (no máximo uma vez);',
      '- **propor a remoção** com o formulário *Remoção de teste* (seção 7).',
      '',
      '| Arquivo | Teste | Classificação | Expira | Issue | Situação |',
      '|---|---|---|---|---|---|',
      ...rows,
    ].join('\n'),
  });
  core.notice(`Quarentena: issue #${issue.number}`);
}

async function revisao({ github, context, core, checkFile, duplicationFile }) {
  const { owner, repo } = context.repo;
  const result = readCheck(checkFile);
  let duplication = '_relatório de duplicação indisponível_';
  try {
    const report = readCheck(duplicationFile);
    const total = report.statistics?.total || {};
    duplication = `${total.percentage ?? 0}% de linhas duplicadas nos testes (${total.clones ?? 0} trechos repetidos)`;
  } catch {
    // jscpd não gerou o relatório; a revisão segue com os outros números
  }

  const openIssues = await openPolicyIssues(github, owner, repo);
  const overdue = openIssues.filter((i) => deadlineFor(i).overdue);
  const today = new Date().toISOString().slice(0, 10);
  const runUrl = `${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`;

  const body = [
    `Revisão periódica da automação de testes de **${today}** (docs/tas.md, seção 6). Dados coletados nesta [execução](${runUrl}).`,
    '',
    '| Critério | Situação atual | Limite da política |',
    '|---|---|---|',
    `| Instabilidade (MQ-03) | ver o relatório técnico da última regressão; issues \`teste instável\` abertas: ${openIssues.filter((i) => i.labels.some((l) => l.name === 'teste instável')).length} | 0 instáveis sem issue |`,
    `| Quarentena | ${result.quarantine.length} testes; ${result.quarantine.filter((q) => q.status.includes('vencida')).length} vencidos | nenhum vencido |`,
    '| Tempo de execução (MQ-04) | ver o relatório técnico (mediana de 30 dias e testes mais lentos) | CI/CD ≤ 10 min, regressão ≤ 60 min, nenhum teste de API > 2 s |',
    `| Duplicação de código | ${duplication} | ≤ 5% |`,
    `| Rastreabilidade | ${result.files} arquivos de teste; ${result.errors.filter((e) => e.includes('catálogo')).length} fora do catálogo | todos no TESTES.md e com TC no plano |`,
    `| Prazos | ${openIssues.length} issues de manutenção abertas; ${overdue.length} com prazo vencido | nenhuma vencida |`,
    '',
    '### Checklist',
    '',
    '- [ ] Cada teste instável tem issue, classificação e responsável; nenhum está escondido por nova tentativa',
    '- [ ] Quarentenas vencidas decididas (corrigir, prorrogar uma vez ou remover)',
    '- [ ] Testes mais lentos avaliados (mover de nível, dividir ou otimizar dados)',
    '- [ ] Trechos duplicados acima do limite viraram helper ou fixture',
    '- [ ] Novos casos do período estão no plano de testes (TC) e no catálogo (U/A/E/M)',
    '- [ ] Propostas de remoção do período decididas e registradas no histórico da seção 9',
    '- [ ] Metas das métricas (docs/testes/Metricas_de_Qualidade.md) ainda fazem sentido',
    '',
    'Registre as decisões em comentários e feche a issue ao concluir a revisão.',
  ].join('\n');

  const { data } = await github.rest.issues.create({
    owner,
    repo,
    title: `Revisão periódica da TAS — ${today}`,
    labels: ['revisão da TAS', 'manutenção da TAS', 'prioridade: baixa', 'classificação: tas'],
    body,
  });
  core.notice(`Revisão periódica: issue #${data.number}`);
}

module.exports = { LABELS, PRAZOS, businessHoursBetween, deadlineFor, syncLabels, prazos, quarentena, revisao };
