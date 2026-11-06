// Calcula as métricas de qualidade (docs/testes-automatizados/Metricas_de_Qualidade.md) a partir dos artefatos de uma
// execução do CI/CD ou da regressão diária e da API do GitHub (execuções e issues ci-failure).
//
// Uso: node collect-metrics.mjs --artifacts <pasta> --out <pasta> [--history history.json]
//   --artifacts  saída do `gh run download`: uma subpasta por artefato (backend-test-reports, e2e-report...)
//   --history    history.json do relatório anterior; o novo, com esta execução, é gravado em --out
// Variáveis: GITHUB_REPOSITORY, GITHUB_TOKEN (actions: read, issues: read) e SOURCE_RUN_ID (execução analisada).
// Sem token, as métricas que dependem da API ficam como "não disponível" e o resto é calculado normalmente.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from '../lib/test-results.mjs';
import { HISTORY_LIMIT, TARGETS, TRACKED_WORKFLOWS, WINDOW_DAYS } from './targets.mjs';

const DAY = 24 * 60 * 60 * 1000;
const SLOWEST = 10;
const LEAST_COVERED = 10;
const MAX_MESSAGE = 1500;

// Ordem de preferência: o JSON do Jest tem o nome completo do teste; o JUnit é a alternativa
const SUITES = [
  { id: 'unit', name: 'Backend · Unitários', files: ['backend-test-reports/unit.json', 'backend-test-reports/unit-junit.xml'] },
  { id: 'api', name: 'Backend · API', files: ['backend-test-reports/api.json', 'backend-test-reports/api-junit.xml'] },
  { id: 'e2e', name: 'E2E da API (Playwright)', files: ['e2e-report/e2e-junit.xml'] },
  { id: 'maestro', name: 'E2E de telas (Maestro)', files: ['maestro-report/maestro-report.xml'] },
  { id: 'ai', name: 'Agente de IA', files: ['ai-agent-test-reports/junit.xml'] },
  // Depende do Gemini (cota, rede, variação do modelo): falha vira aviso, não reprova a versão
  { id: 'ai-live', name: 'Agente de IA · ao vivo (Gemini)', files: ['ai-agent-test-reports/junit-live.xml'], informative: true },
];

// Área do produto de cada teste, pelo arquivo ou pelo nome; a ordem importa (segurança antes de conta)
const AREAS = [
  ['Segurança', /cors|errorHandling|seguranca|authMiddleware|authorizationMatrix/i],
  ['Assistente de IA', /aiChat|aiService/i],
  ['Gestão pública', /gestor|admin|routingRule/i],
  ['Ocorrências', /demand|ocorrencia|notification|mail/i],
  ['Conta e acesso', /auth|login|logout|register|refresh|twoFactor|password|profile|terms|sessao|session|conta/i],
];
const SUITE_AREAS = { maestro: 'Telas do app', ai: 'Assistente de IA', 'ai-live': 'Assistente de IA' };

function parseArgs(argv) {
  const args = { artifacts: 'artifacts', out: 'quality-report', history: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--artifacts') args.artifacts = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--history') args.history = argv[++i];
  }
  return args;
}

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : null);
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
// Número para exibir em português (vírgula decimal); os valores numéricos do JSON continuam com ponto
const br = (value) => String(value).replace('.', ',');
const round = (value, digits = 1) => (value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits);
const ANSI = /\x1b\[[0-9;]*m/g;
// Caminhos relativos ao repositório e sem as linhas internas do node_modules, como no sumário do job
const workspace = `${(process.env.GITHUB_WORKSPACE || process.cwd()).replace(/\\/g, '/')}/`;
const shortMessage = (message) =>
  message
    .replace(ANSI, '')
    .replace(/\[cause\]:[\s\S]*$/, '') // o Jest repete o mesmo erro como causa
    .replace(/\\/g, '/')
    .split(workspace)
    .join('')
    .split(/\r?\n/)
    .filter((line) => !/node_modules\//.test(line))
    .join('\n')
    .trim()
    .slice(0, MAX_MESSAGE);

// ---------- Testes (MQ-01, MQ-04 testes lentos) ----------

// O arquivo decide primeiro: "gestor pode remover demanda" em demandService.test.ts é de Ocorrências
function areaOf(suiteId, test) {
  if (SUITE_AREAS[suiteId]) return SUITE_AREAS[suiteId];
  const match = (text) => AREAS.find(([, pattern]) => pattern.test(text))?.[0];
  return match(test.suite) || match(test.name) || 'Outros';
}

function collectSuites(dir) {
  return SUITES.map((suite) => {
    const file = suite.files.map((f) => join(dir, f)).find(existsSync);
    if (!file) return { ...suite, ran: false, tests: [] };
    const tests = load(file).map((t) => ({ ...t, area: areaOf(suite.id, t), message: shortMessage(t.message) }));
    const count = (status) => tests.filter((t) => t.status === status).length;
    const passed = count('passed');
    const failed = count('failed');
    return {
      id: suite.id,
      name: suite.name,
      informative: !!suite.informative,
      ran: true,
      total: tests.length,
      passed,
      failed,
      skipped: count('skipped'),
      passRate: pct(passed, passed + failed),
      seconds: round(tests.reduce((sum, t) => sum + t.time, 0)),
      tests,
    };
  });
}

// ---------- Testes instáveis (MQ-03) ----------

// Sem nova tentativa automática (docs/testes-automatizados/tas.md, seção 5.4), a instabilidade aparece como issue `teste instável`:
// o script de issues de falha aplica a label quando o workflow passa no mesmo commit que falhou, e o
// formulário "Teste instável" registra as que não se reproduzem. Conta as que seguem abertas, sem decisão.
const FLAKY_LABEL = 'teste instável';

async function collectFlaky(repo, since) {
  const issues = (await paginate(`/repos/${repo}/issues?labels=${encodeURIComponent(FLAKY_LABEL)}&state=all&since=${since}`)).filter(
    (issue) => !issue.pull_request
  );
  const tests = issues
    .filter((issue) => issue.state === 'open')
    .map((issue) => ({ number: issue.number, name: issue.title, url: issue.html_url, createdAt: issue.created_at }));
  return {
    measured: true,
    count: tests.length,
    detectedInWindow: issues.filter((issue) => issue.created_at >= since).length,
    tests,
  };
}

// ---------- Cobertura do backend (MQ-02) ----------

// Soma os coverage-final.json (formato do Istanbul) das suítes unitária e de API, arquivo a arquivo:
// as duas instrumentam o mesmo código, então os ids de statements e branches coincidem
function mergeCoverage(files) {
  const merged = {};
  for (const data of files) {
    for (const [path, file] of Object.entries(data)) {
      const target = merged[path];
      if (!target) {
        merged[path] = structuredClone(file);
        continue;
      }
      for (const [id, hits] of Object.entries(file.s)) target.s[id] = (target.s[id] || 0) + hits;
      for (const [id, hits] of Object.entries(file.f)) target.f[id] = (target.f[id] || 0) + hits;
      for (const [id, hits] of Object.entries(file.b)) {
        target.b[id] = (target.b[id] || hits.map(() => 0)).map((value, i) => value + (hits[i] || 0));
      }
    }
  }
  return merged;
}

function fileCoverage(file) {
  // Como o Istanbul: a linha conta como coberta se algum statement que começa nela executou
  const lines = new Map();
  for (const [id, location] of Object.entries(file.statementMap)) {
    const line = location.start.line;
    lines.set(line, (lines.get(line) || 0) + (file.s[id] || 0));
  }
  const branches = Object.values(file.b).flat();
  return {
    lines: { total: lines.size, covered: [...lines.values()].filter((hits) => hits > 0).length },
    branches: { total: branches.length, covered: branches.filter((hits) => hits > 0).length },
  };
}

function collectCoverage(dir) {
  const finals = ['unit', 'api'].map((suite) => readJson(join(dir, `backend-test-reports/coverage-${suite}/coverage-final.json`)));
  const summaries = Object.fromEntries(
    ['unit', 'api'].map((suite) => {
      const summary = readJson(join(dir, `backend-test-reports/coverage-${suite}/coverage-summary.json`));
      return [suite, summary ? { lines: summary.total.lines.pct, branches: summary.total.branches.pct } : null];
    })
  );

  const available = finals.filter(Boolean);
  if (!available.length) {
    // Execuções anteriores ao coverage-final.json: só dá para mostrar cada suíte separada
    return { combined: null, bySuite: summaries, leastCovered: [] };
  }

  const merged = mergeCoverage(available);
  const totals = { lines: { total: 0, covered: 0 }, branches: { total: 0, covered: 0 } };
  const perFile = [];
  for (const [path, file] of Object.entries(merged)) {
    const cov = fileCoverage(file);
    for (const key of ['lines', 'branches']) {
      totals[key].total += cov[key].total;
      totals[key].covered += cov[key].covered;
    }
    const relative = path.replace(/\\/g, '/').replace(/^.*?\/(src\/)/, '$1');
    perFile.push({ file: relative, lines: pct(cov.lines.covered, cov.lines.total), uncoveredLines: cov.lines.total - cov.lines.covered });
  }

  return {
    combined: {
      lines: pct(totals.lines.covered, totals.lines.total),
      branches: pct(totals.branches.covered, totals.branches.total),
      counts: totals,
      partial: available.length < finals.length,
    },
    bySuite: summaries,
    // Os que mais deixam linhas sem teste, que é onde um teste novo rende mais
    leastCovered: perFile.sort((a, b) => b.uncoveredLines - a.uncoveredLines).slice(0, LEAST_COVERED),
  };
}

// ---------- Dependências (MQ-08) ----------

const PROJECTS = ['backend', 'mobile', 'ai-agent', 'e2e'];
const SEVERITIES = ['critical', 'high', 'moderate', 'low'];

function collectVulnerabilities(dir) {
  const byProject = {};
  const serious = [];
  for (const project of PROJECTS) {
    const audit = readJson(join(dir, `dependencias/audit-${project}.json`));
    if (!audit?.metadata?.vulnerabilities) continue;
    byProject[project] = Object.fromEntries(SEVERITIES.map((s) => [s, audit.metadata.vulnerabilities[s] || 0]));
    for (const [name, vuln] of Object.entries(audit.vulnerabilities || {})) {
      if (!['critical', 'high'].includes(vuln.severity)) continue;
      const advisory = (vuln.via || []).find((via) => typeof via === 'object');
      serious.push({
        project,
        name,
        severity: vuln.severity,
        direct: !!vuln.isDirect,
        title: advisory?.title || `Vulnerabilidade herdada de ${(vuln.via || []).filter((v) => typeof v === 'string').join(', ')}`,
        url: advisory?.url || null,
        fix: vuln.fixAvailable === true ? 'npm audit fix' : vuln.fixAvailable ? `atualizar ${vuln.fixAvailable.name} para ${vuln.fixAvailable.version}${vuln.fixAvailable.isSemVerMajor ? ' (versão major)' : ''}` : 'sem correção publicada',
      });
    }
  }
  const measured = Object.keys(byProject).length > 0;
  const totals = Object.fromEntries(SEVERITIES.map((s) => [s, Object.values(byProject).reduce((sum, p) => sum + p[s], 0)]));
  serious.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || Number(b.direct) - Number(a.direct));
  return { measured, totals: measured ? totals : null, byProject, serious };
}

// ---------- API do GitHub (execução, MQ-04 a MQ-07) ----------

async function github(path) {
  const base = process.env.GITHUB_API_URL || 'https://api.github.com';
  const response = await fetch(`${base}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GET ${path}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function paginate(path, key) {
  const items = [];
  for (let page = 1; page <= 10; page++) {
    const data = await github(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const batch = key ? data[key] : data;
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

const minutesBetween = (start, end) => (new Date(end) - new Date(start)) / 60000;

async function collectSourceRun(repo, runId) {
  const run = await github(`/repos/${repo}/actions/runs/${runId}`);
  const jobs = await paginate(`/repos/${repo}/actions/runs/${runId}/jobs`, 'jobs');
  return {
    id: run.id,
    workflow: run.name,
    title: run.display_title,
    event: run.event,
    branch: run.head_branch,
    sha: run.head_sha,
    conclusion: run.conclusion,
    url: run.html_url,
    startedAt: run.run_started_at,
    // Chamado de dentro da própria execução (último job), que ainda não terminou: mede até agora
    minutes: round(minutesBetween(run.run_started_at, run.status === 'completed' ? run.updated_at : new Date().toISOString())),
    jobs: jobs.filter((job) => job.status === 'completed').map((job) => ({
      name: job.name,
      conclusion: job.conclusion,
      minutes: job.started_at && job.completed_at ? round(minutesBetween(job.started_at, job.completed_at)) : null,
      url: job.html_url,
    })),
  };
}

async function collectPipeline(repo, since) {
  const workflows = [];
  for (const { file, name } of TRACKED_WORKFLOWS) {
    const runs = (
      await paginate(`/repos/${repo}/actions/workflows/${file}/runs?branch=main&status=completed&created=>=${since.slice(0, 10)}`, 'workflow_runs')
    ).filter((run) => run.event !== 'pull_request');
    // Cancelada pela concorrência (um push novo substituiu a execução) não é falha nem sucesso
    const decided = runs.filter((run) => ['success', 'failure', 'timed_out'].includes(run.conclusion));
    const succeeded = decided.filter((run) => run.conclusion === 'success');
    workflows.push({
      name,
      runs: decided.length,
      succeeded: succeeded.length,
      successRate: pct(succeeded.length, decided.length),
      medianMinutes: round(median(succeeded.map((run) => minutesBetween(run.run_started_at, run.updated_at)))),
      targetMinutes: TARGETS.durationMinutes[name] ?? null,
    });
  }
  const runs = workflows.reduce((sum, w) => sum + w.runs, 0);
  const succeeded = workflows.reduce((sum, w) => sum + w.succeeded, 0);
  return { successRate: pct(succeeded, runs), runs, succeeded, workflows };
}

async function collectIssues(repo, since) {
  const issues = (await paginate(`/repos/${repo}/issues?labels=ci-failure&state=all&since=${since}`)).filter((issue) => !issue.pull_request);
  const labels = (issue) => issue.labels.map((label) => (typeof label === 'string' ? label : label.name));
  const isHigh = (issue) => labels(issue).includes('prioridade: alta');

  const closed = issues.filter((issue) => issue.closed_at && issue.closed_at >= since);
  const hours = (list) => list.map((issue) => (new Date(issue.closed_at) - new Date(issue.created_at)) / 3600000);
  const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

  // Só as falhas em main, dev ou na regressão (prioridade alta) contam para o MTTR: em branch de trabalho
  // a issue pode ficar aberta até a branch ser abandonada, sem que nada esteja "fora do ar"
  const closedHigh = closed.filter(isHigh);
  const open = issues
    .filter((issue) => issue.state === 'open')
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      createdAt: issue.created_at,
      high: isHigh(issue),
      areas: labels(issue)
        .filter((label) => label.startsWith('area: '))
        .map((label) => label.slice(6)),
    }));

  return {
    failures: issues.filter((issue) => issue.created_at >= since).length,
    mttrHours: round(mean(hours(closedHigh))),
    mttrSample: closedHigh.length,
    mttrAllHours: round(mean(hours(closed))),
    open,
    openHigh: open.filter((issue) => issue.high).length,
  };
}

// ---------- Avaliação ----------

const status = (ok, failLevel = 'warn') => (ok == null ? 'na' : ok ? 'ok' : failLevel);

function evaluate({ suites, flaky, coverage, vulnerabilities, pipeline, issues, run }) {
  const counted = suites.filter((s) => s.ran && !s.informative);
  const passed = counted.reduce((sum, s) => sum + s.passed, 0);
  const failed = counted.reduce((sum, s) => sum + s.failed, 0);
  const passRate = pct(passed, passed + failed);
  const informativeFailed = suites.filter((s) => s.ran && s.informative && s.failed > 0);

  const runTarget = run ? TARGETS.durationMinutes[run.workflow] : null;
  const durations = pipeline?.workflows.filter((w) => w.medianMinutes != null && w.targetMinutes != null) ?? [];

  const metrics = [
    {
      id: 'MQ-01',
      name: 'Taxa de aprovação dos testes',
      value: passRate,
      display: passRate == null ? '—' : `${br(passRate)}%`,
      detail: `${passed} de ${passed + failed} testes passaram` + (informativeFailed.length ? `; ${informativeFailed.map((s) => s.name).join(', ')} com falha (informativo)` : ''),
      target: `${TARGETS.passRate}%`,
      status: passRate == null ? 'na' : passRate >= TARGETS.passRate ? (informativeFailed.length ? 'warn' : 'ok') : 'fail',
    },
    {
      id: 'MQ-02',
      name: 'Cobertura do backend',
      value: coverage.combined?.lines ?? null,
      display: coverage.combined ? `${br(coverage.combined.lines)}% linhas · ${br(coverage.combined.branches)}% branches` : '—',
      detail: coverage.combined
        ? `suítes unitária e de API somadas${coverage.combined.partial ? ' (só uma suíte disponível)' : ''}`
        : 'cobertura combinada indisponível nesta execução',
      target: `≥ ${TARGETS.coverage.lines}% linhas · ≥ ${TARGETS.coverage.branches}% branches`,
      status: coverage.combined ? status(coverage.combined.lines >= TARGETS.coverage.lines && coverage.combined.branches >= TARGETS.coverage.branches) : 'na',
    },
    {
      id: 'MQ-03',
      name: 'Testes instáveis (flaky)',
      value: flaky?.count ?? null,
      display: flaky?.count == null ? '—' : String(flaky.count),
      detail: flaky
        ? `issues \`teste instável\` abertas · ${flaky.detectedInWindow} detectadas nos últimos ${WINDOW_DAYS} dias`
        : 'API do GitHub indisponível',
      target: String(TARGETS.flaky),
      status: flaky?.count == null ? 'na' : status(flaky.count <= TARGETS.flaky),
    },
    {
      id: 'MQ-04',
      name: 'Tempo da pipeline',
      value: run?.minutes ?? null,
      display: run ? `${br(run.minutes)} min` : '—',
      detail: [
        run ? `esta execução (${run.workflow})` : null,
        ...durations.map((w) => `mediana ${w.name}: ${br(w.medianMinutes)} min`),
      ]
        .filter(Boolean)
        .join(' · '),
      target: Object.entries(TARGETS.durationMinutes).map(([name, minutes]) => `${name} ≤ ${minutes} min`).join(' · '),
      status: durations.length ? status(durations.every((w) => w.medianMinutes <= w.targetMinutes)) : run && runTarget ? status(run.minutes <= runTarget) : 'na',
    },
    {
      id: 'MQ-05',
      name: 'Taxa de sucesso da pipeline',
      value: pipeline?.successRate ?? null,
      display: pipeline?.successRate == null ? '—' : `${br(pipeline.successRate)}%`,
      detail: pipeline ? `${pipeline.succeeded} de ${pipeline.runs} execuções em main nos últimos ${WINDOW_DAYS} dias` : 'API do GitHub indisponível',
      target: `≥ ${TARGETS.pipelineSuccessRate}%`,
      status: pipeline?.successRate == null ? 'na' : status(pipeline.successRate >= TARGETS.pipelineSuccessRate),
    },
    {
      id: 'MQ-06',
      name: 'MTTR do CI',
      value: issues?.mttrHours ?? null,
      display: issues?.mttrHours == null ? '—' : `${br(issues.mttrHours)} h`,
      detail: issues
        ? issues.mttrSample
          ? `média de ${issues.mttrSample} falhas de prioridade alta resolvidas nos últimos ${WINDOW_DAYS} dias`
          : `nenhuma falha de prioridade alta resolvida nos últimos ${WINDOW_DAYS} dias`
        : 'API do GitHub indisponível',
      target: `≤ ${TARGETS.mttrHours} h`,
      status: issues?.mttrHours == null ? 'na' : status(issues.mttrHours <= TARGETS.mttrHours),
    },
    {
      id: 'MQ-07',
      name: 'Falhas abertas',
      value: issues?.openHigh ?? null,
      display: issues ? `${issues.openHigh} de prioridade alta · ${issues.open.length} no total` : '—',
      detail: issues ? 'issues ci-failure abertas' : 'API do GitHub indisponível',
      target: `${TARGETS.openHighPriority} de prioridade alta`,
      status: issues ? status(issues.openHigh <= TARGETS.openHighPriority, 'fail') : 'na',
    },
    {
      id: 'MQ-08',
      name: 'Vulnerabilidades em dependências',
      value: vulnerabilities.totals ? vulnerabilities.totals.critical + vulnerabilities.totals.high : null,
      display: vulnerabilities.totals ? `${vulnerabilities.totals.critical} críticas · ${vulnerabilities.totals.high} altas` : '—',
      detail: vulnerabilities.totals ? `${vulnerabilities.totals.moderate} moderadas e ${vulnerabilities.totals.low} baixas (fora da meta)` : 'auditoria não rodou nesta execução',
      target: `${TARGETS.vulnerabilities.critical} críticas · ${TARGETS.vulnerabilities.high} altas`,
      status: !vulnerabilities.totals
        ? 'na'
        : vulnerabilities.totals.critical > TARGETS.vulnerabilities.critical
          ? 'fail'
          : status(vulnerabilities.totals.high <= TARGETS.vulnerabilities.high),
    },
  ];

  const statuses = metrics.map((m) => m.status);
  const health = statuses.includes('fail') ? 'red' : statuses.includes('warn') ? 'yellow' : 'green';
  return { metrics, health, passRate, passed, failed };
}

function productAreas(suites) {
  const areas = new Map();
  for (const suite of suites.filter((s) => s.ran)) {
    for (const test of suite.tests) {
      if (test.status === 'skipped') continue;
      const entry = areas.get(test.area) || { area: test.area, total: 0, failed: 0, informativeFailed: 0, suites: new Set() };
      entry.total++;
      if (test.status === 'failed') suite.informative ? entry.informativeFailed++ : entry.failed++;
      entry.suites.add(suite.name);
      areas.set(test.area, entry);
    }
  }
  const order = ['Conta e acesso', 'Ocorrências', 'Gestão pública', 'Assistente de IA', 'Telas do app', 'Segurança', 'Outros'];
  return [...areas.values()]
    .map((entry) => ({ ...entry, suites: [...entry.suites], ok: entry.failed === 0 }))
    .sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));
}

// ---------- Execução ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.SOURCE_RUN_ID;
  const canUseApi = !!(repo && process.env.GITHUB_TOKEN);
  const since = new Date(Date.now() - WINDOW_DAYS * DAY).toISOString();
  const warnings = [];

  const suites = collectSuites(args.artifacts);
  const coverage = collectCoverage(args.artifacts);
  const vulnerabilities = collectVulnerabilities(args.artifacts);

  const attempt = async (label, fn) => {
    if (!canUseApi) return null;
    try {
      return await fn();
    } catch (error) {
      warnings.push(`${label}: ${error.message}`);
      return null;
    }
  };
  if (!canUseApi) warnings.push('GITHUB_REPOSITORY ou GITHUB_TOKEN ausente: métricas da API do GitHub não calculadas');
  const run = runId ? await attempt('execução analisada', () => collectSourceRun(repo, runId)) : null;
  const pipeline = await attempt('execuções da pipeline', () => collectPipeline(repo, since));
  const issues = await attempt('issues ci-failure', () => collectIssues(repo, since));
  const flaky = await attempt('issues teste instável', () => collectFlaky(repo, since));

  const evaluation = evaluate({ suites, flaky, coverage, vulnerabilities, pipeline, issues, run });
  const allTests = suites.flatMap((s) => s.tests.map((t) => ({ ...t, suiteName: s.name, informative: s.informative })));

  const metrics = {
    generatedAt: new Date().toISOString(),
    repository: repo || null,
    run,
    windowDays: WINDOW_DAYS,
    targets: TARGETS,
    health: evaluation.health,
    metrics: evaluation.metrics,
    tests: {
      total: allTests.length,
      passed: evaluation.passed,
      failed: evaluation.failed,
      passRate: evaluation.passRate,
      suites: suites.map(({ tests, ...suite }) => suite),
      failures: allTests.filter((t) => t.status === 'failed').map(({ status: _, ...t }) => t),
      slowest: [...allTests].sort((a, b) => b.time - a.time).slice(0, SLOWEST).map(({ name, suiteName, time }) => ({ name, suite: suiteName, seconds: round(time, 2) })),
    },
    areas: productAreas(suites),
    flaky,
    coverage,
    vulnerabilities,
    pipeline,
    issues,
    warnings,
  };

  const previous = (args.history && readJson(args.history)) || [];
  const entry = {
    date: run?.startedAt ?? metrics.generatedAt,
    runId: run?.id ?? runId ?? null,
    workflow: run?.workflow ?? null,
    sha: run?.sha?.slice(0, 7) ?? null,
    url: run?.url ?? null,
    health: metrics.health,
    passRate: evaluation.passRate,
    tests: evaluation.passed + evaluation.failed,
    failed: evaluation.failed,
    flaky: flaky?.count ?? null,
    coverageLines: coverage.combined?.lines ?? null,
    coverageBranches: coverage.combined?.branches ?? null,
    pipelineSuccessRate: pipeline?.successRate ?? null,
    mttrHours: issues?.mttrHours ?? null,
    openHigh: issues?.openHigh ?? null,
    vulnCritical: vulnerabilities.totals?.critical ?? null,
    vulnHigh: vulnerabilities.totals?.high ?? null,
    minutes: run?.minutes ?? null,
  };
  // Reexecutar o relatório da mesma execução substitui a entrada em vez de duplicar
  const history = [...previous.filter((item) => !entry.runId || String(item.runId) !== String(entry.runId)), entry].slice(-HISTORY_LIMIT);

  mkdirSync(args.out, { recursive: true });
  writeFileSync(join(args.out, 'metrics.json'), JSON.stringify(metrics, null, 2));
  writeFileSync(join(args.out, 'history.json'), JSON.stringify(history, null, 2));

  for (const warning of warnings) console.log(`::warning::${warning}`);
  console.log(`Saúde da versão: ${metrics.health} · ${evaluation.metrics.map((m) => `${m.id}=${m.status}`).join(' ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
