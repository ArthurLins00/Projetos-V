// Gera os relatórios de qualidade em HTML a partir do metrics.json e do history.json do collect-metrics.mjs:
//   relatorio-tecnico.html  resultados, falhas, cobertura, pipeline e dependências, para a equipe
//   relatorio-negocio.html  saúde da versão, áreas do produto, riscos e tendência, para stakeholders
// e um resumo em Markdown no sumário do job (GITHUB_STEP_SUMMARY), ou na saída padrão sem ele.
//
// Uso: node render-reports.mjs --in <pasta com metrics.json e history.json> [--out <pasta>]
// Os arquivos são autocontidos (CSS e gráficos embutidos): abrem direto do artefato, sem internet.

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TREND_POINTS = 30;

function parseArgs(argv) {
  const args = { in: 'quality-report', out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') args.in = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  args.out ??= args.in;
  return args;
}

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—';
const shortDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
const num = (value, suffix = '') => (value == null ? '—' : `${String(value).replace('.', ',')}${suffix}`);
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const seconds = (value) => (value >= 60 ? `${Math.floor(value / 60)}min ${Math.round(value % 60)}s` : `${num(Math.round(value * 10) / 10)}s`);

const STATUS = {
  ok: { label: 'Meta atingida', short: 'OK', cls: 'ok' },
  warn: { label: 'Atenção', short: 'Atenção', cls: 'warn' },
  fail: { label: 'Crítico', short: 'Crítico', cls: 'fail' },
  na: { label: 'Sem dados', short: 'Sem dados', cls: 'na' },
};
const HEALTH = {
  green: { cls: 'ok', title: 'Versão saudável', text: 'A versão atende a todas as metas de qualidade acompanhadas.' },
  yellow: { cls: 'warn', title: 'Versão com pontos de atenção', text: 'O produto funciona, mas algumas metas de qualidade não foram atingidas.' },
  red: { cls: 'fail', title: 'Versão com riscos', text: 'Há riscos que precisam de decisão ou prioridade antes de liberar esta versão.' },
};

const pill = (status) => `<span class="pill ${STATUS[status].cls}">${STATUS[status].short}</span>`;

// ---------- Gráficos (SVG embutido) ----------

function sparkline(values, { min = null, max = null, target = null, invert = false } = {}) {
  const points = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (points.length < 2) return '<span class="muted small">histórico insuficiente</span>';
  const width = 220;
  const height = 48;
  const pad = 4;
  const ys = points.map(([, v]) => v).concat(target != null ? [target] : []);
  const lo = min ?? Math.min(...ys);
  const hi = max ?? Math.max(...ys);
  const span = hi - lo || 1;
  const x = (i) => pad + (i / Math.max(values.length - 1, 1)) * (width - pad * 2);
  const y = (v) => height - pad - ((v - lo) / span) * (height - pad * 2);
  const path = points.map(([i, v], n) => `${n ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const [lastI, lastV] = points[points.length - 1];
  const good = target == null ? true : invert ? lastV <= target : lastV >= target;
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="tendência">
    ${target != null ? `<line x1="${pad}" x2="${width - pad}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}" class="spark-target"/>` : ''}
    <path d="${path}" class="spark-line"/>
    <circle cx="${x(lastI).toFixed(1)}" cy="${y(lastV).toFixed(1)}" r="3.5" class="spark-dot ${good ? 'ok' : 'warn'}"/>
  </svg>`;
}

function healthStrip(history) {
  const recent = history.slice(-TREND_POINTS);
  if (!recent.length) return '';
  const cls = { green: 'ok', yellow: 'warn', red: 'fail' };
  return `<div class="strip">${recent
    .map((h) => `<span class="cell ${cls[h.health] || 'na'}" title="${esc(`${dateTime(h.date)} · ${HEALTH[h.health]?.title || ''}`)}"></span>`)
    .join('')}</div>
    <div class="strip-legend muted small"><span>${shortDate(recent[0].date)}</span><span>${shortDate(recent[recent.length - 1].date)}</span></div>`;
}

// Variação em relação ao relatório anterior
function trend(history, key, { invert = false, suffix = '' } = {}) {
  const values = history.map((h) => h[key]).filter((v) => v != null);
  if (values.length < 2) return '';
  const delta = Math.round((values[values.length - 1] - values[values.length - 2]) * 10) / 10;
  if (!delta) return '<span class="trend flat">= estável</span>';
  const better = invert ? delta < 0 : delta > 0;
  return `<span class="trend ${better ? 'up' : 'down'}">${delta > 0 ? '▲' : '▼'} ${num(Math.abs(delta), suffix)}</span>`;
}

// ---------- Layout ----------

const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--text:#1b1f24;--muted:#5b6470;--line:#e3e6ea;--accent:#2f5bea;
--ok:#1a7f4b;--ok-bg:#e3f4ea;--warn:#9a6200;--warn-bg:#fdf1d8;--fail:#b42318;--fail-bg:#fde4e1;--na:#5b6470;--na-bg:#eceef1;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#101318;--card:#181c22;--text:#e7eaee;--muted:#9aa3ad;--line:#2a3039;--accent:#7c9cff;
--ok:#5fd394;--ok-bg:#15301f;--warn:#f2c35b;--warn-bg:#33280f;--fail:#ff8a80;--fail-bg:#3a1714;--na:#9aa3ad;--na-bg:#232830;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 48px}
header.top{display:flex;flex-wrap:wrap;gap:8px 24px;align-items:flex-end;justify-content:space-between;margin-bottom:20px}
h1{font-size:24px;margin:0}h2{font-size:18px;margin:32px 0 12px}h3{font-size:15px;margin:20px 0 8px}
.muted{color:var(--muted)}.small{font-size:13px}a{color:var(--accent)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.kpi .label{font-size:13px;color:var(--muted)}.kpi .value{font-size:28px;font-weight:700;margin:4px 0}
.kpi .foot{font-size:13px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.banner{border-radius:12px;padding:20px;border:1px solid var(--line);display:flex;gap:16px;align-items:center}
.banner .dot{width:44px;height:44px;border-radius:50%;flex:none}
.banner.ok{background:var(--ok-bg)}.banner.ok .dot{background:var(--ok)}
.banner.warn{background:var(--warn-bg)}.banner.warn .dot{background:var(--warn)}
.banner.fail{background:var(--fail-bg)}.banner.fail .dot{background:var(--fail)}
.banner h2{margin:0 0 4px;font-size:20px}.banner p{margin:0}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.pill.ok{background:var(--ok-bg);color:var(--ok)}.pill.warn{background:var(--warn-bg);color:var(--warn)}
.pill.fail{background:var(--fail-bg);color:var(--fail)}.pill.na{background:var(--na-bg);color:var(--na)}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);background:var(--card)}
tr:last-child td{border-bottom:0}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
details{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:8px 0;padding:8px 12px}
summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap;word-break:break-word;font-size:12px;background:var(--bg);padding:12px;border-radius:8px;overflow:auto;max-height:320px}
code{font-size:12px}.spark-line{fill:none;stroke:var(--accent);stroke-width:2}.spark-target{stroke:var(--muted);stroke-dasharray:3 3;stroke-width:1}
.spark-dot.ok{fill:var(--ok)}.spark-dot.warn{fill:var(--warn)}
.strip{display:flex;gap:3px;flex-wrap:wrap}.strip .cell{width:14px;height:22px;border-radius:3px}
.cell.ok{background:var(--ok)}.cell.warn{background:var(--warn)}.cell.fail{background:var(--fail)}.cell.na{background:var(--na-bg)}
.strip-legend{display:flex;justify-content:space-between;max-width:${TREND_POINTS * 17}px}
.trend{font-size:12px;font-weight:600}.trend.up{color:var(--ok)}.trend.down{color:var(--fail)}.trend.flat{color:var(--muted)}
ul.risks{list-style:none;padding:0;margin:0;display:grid;gap:10px}ul.risks li{border-left:4px solid var(--warn)}ul.risks li.fail{border-left-color:var(--fail)}
.risk-title{font-weight:600;margin-bottom:4px}.warnbox{border-left:4px solid var(--warn);padding:8px 12px;background:var(--warn-bg);border-radius:6px;margin:8px 0}
footer{margin-top:40px;font-size:13px;color:var(--muted)}
`;

function page(title, subtitle, body, metrics) {
  const run = metrics.run;
  const meta = run
    ? `${esc(run.workflow)} · ${esc(run.branch)} · <code>${esc(run.sha?.slice(0, 7))}</code> · <a href="${esc(run.url)}">execução #${esc(run.id)}</a>`
    : 'execução local';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><main>
<header class="top"><div><h1>${esc(title)}</h1><div class="muted">${esc(subtitle)}</div></div>
<div class="muted small">Gerado em ${dateTime(metrics.generatedAt)}<br>${meta}</div></header>
${body}
<footer>Fiscalize · relatório gerado automaticamente pelo workflow <b>Relatório de qualidade</b>.
Definição das métricas e metas: <code>docs/testes/Metricas_de_Qualidade.md</code>.</footer>
</main></body></html>`;
}

const table = (headers, rows) =>
  `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => (typeof h === 'string' ? `<th>${h}</th>` : `<th class="${h.cls}">${h.label}</th>`))
    .join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

// ---------- Relatório técnico ----------

function technical(m, history) {
  const sections = [];
  const metric = (id) => m.metrics.find((x) => x.id === id);

  sections.push(`<div class="banner ${HEALTH[m.health].cls}"><span class="dot"></span><div><h2>${HEALTH[m.health].title}</h2>
    <p>${m.tests.failed ? `${plural(m.tests.failed, 'teste falhou', 'testes falharam')}. ` : 'Todos os testes que contam para a meta passaram. '}
    ${m.metrics.filter((x) => x.status === 'ok').length} de ${m.metrics.length} métricas dentro da meta.</p></div></div>`);

  if (m.warnings.length) sections.push(m.warnings.map((w) => `<div class="warnbox small">${esc(w)}</div>`).join(''));

  sections.push('<h2>Métricas</h2>');
  sections.push(
    table(
      ['ID', 'Métrica', 'Situação', 'Valor', 'Meta', 'Detalhe'],
      m.metrics.map(
        (x) => `<tr><td><code>${x.id}</code></td><td>${esc(x.name)}</td><td>${pill(x.status)}</td><td><b>${esc(x.display)}</b></td><td>${esc(x.target)}</td><td class="muted small">${esc(x.detail)}</td></tr>`
      )
    )
  );

  sections.push('<h2>Tendência</h2><div class="grid">');
  const sparkCard = (label, key, opts, current) =>
    `<div class="card kpi"><div class="label">${label}</div><div class="value">${current}</div>${sparkline(history.slice(-TREND_POINTS).map((h) => h[key]), opts)}</div>`;
  const last = history[history.length - 1] || {};
  sections.push(
    sparkCard('Aprovação dos testes (MQ-01)', 'passRate', { min: Math.min(90, ...history.map((h) => h.passRate ?? 100)), max: 100, target: m.targets.passRate }, num(last.passRate, '%')),
    sparkCard('Cobertura de linhas (MQ-02)', 'coverageLines', { target: m.targets.coverage.lines }, num(last.coverageLines, '%')),
    sparkCard('Duração da execução (MQ-04)', 'minutes', { min: 0, invert: true }, num(last.minutes, ' min')),
    sparkCard('Sucesso da pipeline, 30 dias (MQ-05)', 'pipelineSuccessRate', { target: m.targets.pipelineSuccessRate }, num(last.pipelineSuccessRate, '%'))
  );
  sections.push('</div>');

  sections.push('<h2>Suítes de teste (MQ-01)</h2>');
  sections.push(
    table(
      ['Suíte', { label: 'Executados', cls: 'n' }, { label: 'Passaram', cls: 'n' }, { label: 'Falharam', cls: 'n' }, { label: 'Pulados', cls: 'n' }, { label: 'Aprovação', cls: 'n' }, { label: 'Tempo', cls: 'n' }],
      m.tests.suites.map((s) =>
        s.ran
          ? `<tr><td>${esc(s.name)}${s.informative ? ' <span class="muted small">(informativo)</span>' : ''}</td><td class="n">${s.total}</td><td class="n">${s.passed}</td><td class="n">${s.failed ? `<b>${s.failed}</b>` : 0}</td><td class="n">${s.skipped}</td><td class="n">${num(s.passRate, '%')}</td><td class="n">${seconds(s.seconds)}</td></tr>`
          : `<tr><td>${esc(s.name)}</td><td colspan="6" class="muted small">não rodou nesta execução</td></tr>`
      )
    )
  );

  sections.push(`<h2>Falhas (${m.tests.failures.length})</h2>`);
  sections.push(
    m.tests.failures.length
      ? m.tests.failures
          .map(
            (f) => `<details><summary>${esc(f.name)} <span class="muted small">· ${esc(f.suiteName)} · ${esc(f.suite)}${f.informative ? ' · informativo' : ''}</span></summary><pre>${esc(f.message || '(sem mensagem)')}</pre></details>`
          )
          .join('')
      : '<p class="muted">Nenhuma falha nesta execução.</p>'
  );

  sections.push(`<h2>Testes instáveis (MQ-03)</h2>`);
  sections.push(
    !m.flaky
      ? '<p class="muted">API do GitHub indisponível: issues <code>teste instável</code> não consultadas.</p>'
      : m.flaky.tests.length
        ? table(['Issue', 'Título', 'Aberta em'], m.flaky.tests.map((t) => `<tr><td><a href="${esc(t.url)}">#${t.number}</a></td><td>${esc(t.name)}</td><td>${dateTime(t.createdAt)}</td></tr>`))
        : '<p class="muted">Nenhuma issue <code>teste instável</code> aberta. Os testes rodam sem nova tentativa automática, então uma instabilidade aparece como falha e vira issue.</p>'
  );

  const cov = m.coverage;
  sections.push('<h2>Cobertura do backend (MQ-02)</h2><div class="grid">');
  sections.push(
    `<div class="card kpi"><div class="label">Combinada (unitário + API)</div><div class="value">${cov.combined ? `${num(cov.combined.lines, '%')}` : '—'}</div>
     <div class="foot">${cov.combined ? `linhas · ${num(cov.combined.branches, '%')} branches ${trend(history, 'coverageLines', { suffix: ' p.p.' })}` : 'sem coverage-final.json nesta execução'}</div></div>`,
    ...['unit', 'api'].map(
      (k) =>
        `<div class="card kpi"><div class="label">Só ${k === 'unit' ? 'unitários' : 'API'}</div><div class="value">${num(cov.bySuite[k]?.lines, '%')}</div><div class="foot">linhas · ${num(cov.bySuite[k]?.branches, '%')} branches</div></div>`
    )
  );
  sections.push('</div>');
  if (cov.leastCovered.length) {
    sections.push('<h3>Arquivos com mais linhas sem teste</h3>');
    sections.push(
      table(
        ['Arquivo', { label: 'Linhas cobertas', cls: 'n' }, { label: 'Linhas sem teste', cls: 'n' }],
        cov.leastCovered.map((f) => `<tr><td><code>${esc(f.file)}</code></td><td class="n">${num(f.lines, '%')}</td><td class="n">${f.uncoveredLines}</td></tr>`)
      )
    );
  }

  sections.push('<h2>Pipeline (MQ-04 e MQ-05)</h2>');
  if (m.run) {
    sections.push(`<h3>Jobs desta execução · ${num(m.run.minutes, ' min')}</h3>`);
    const jobStatus = { success: 'ok', failure: 'fail', timed_out: 'fail', cancelled: 'warn', skipped: 'na' };
    sections.push(
      table(
        ['Job', 'Resultado', { label: 'Duração', cls: 'n' }],
        m.run.jobs.map(
          (j) => `<tr><td><a href="${esc(j.url)}">${esc(j.name)}</a></td><td><span class="pill ${STATUS[jobStatus[j.conclusion] || 'na'].cls}">${esc(j.conclusion || '—')}</span></td><td class="n">${num(j.minutes, ' min')}</td></tr>`
        )
      )
    );
  }
  if (m.pipeline) {
    sections.push(`<h3>Execuções em main nos últimos ${m.windowDays} dias</h3>`);
    sections.push(
      table(
        ['Workflow', { label: 'Execuções', cls: 'n' }, { label: 'Sucesso', cls: 'n' }, { label: 'Mediana', cls: 'n' }, { label: 'Meta de duração', cls: 'n' }],
        m.pipeline.workflows.map(
          (w) => `<tr><td>${esc(w.name)}</td><td class="n">${w.runs}</td><td class="n">${num(w.successRate, '%')}</td><td class="n">${num(w.medianMinutes, ' min')}</td><td class="n">${w.targetMinutes != null ? `≤ ${w.targetMinutes} min` : '—'}</td></tr>`
        )
      )
    );
  }

  sections.push('<h2>Falhas registradas em issues (MQ-06 e MQ-07)</h2>');
  if (m.issues) {
    sections.push(
      `<p>${plural(m.issues.failures, 'falha registrada', 'falhas registradas')} nos últimos ${m.windowDays} dias. MTTR (prioridade alta): <b>${num(metric('MQ-06').value, ' h')}</b>` +
        `${m.issues.mttrAllHours != null ? ` · considerando todas as branches: ${num(m.issues.mttrAllHours, ' h')}` : ''}.</p>`
    );
    sections.push(
      m.issues.open.length
        ? table(
            ['Issue', 'Área', 'Prioridade', 'Aberta em'],
            m.issues.open.map(
              (i) => `<tr><td><a href="${esc(i.url)}">#${i.number}</a> ${esc(i.title)}</td><td>${esc(i.areas.join(', ') || '—')}</td><td>${i.high ? pill('fail').replace('Crítico', 'Alta') : '—'}</td><td>${dateTime(i.createdAt)}</td></tr>`
            )
          )
        : '<p class="muted">Nenhuma issue <code>ci-failure</code> aberta.</p>'
    );
  } else sections.push('<p class="muted">API do GitHub indisponível nesta execução.</p>');

  const vuln = m.vulnerabilities;
  sections.push('<h2>Dependências (MQ-08)</h2>');
  if (vuln.measured) {
    sections.push(
      table(
        ['Projeto', { label: 'Críticas', cls: 'n' }, { label: 'Altas', cls: 'n' }, { label: 'Moderadas', cls: 'n' }, { label: 'Baixas', cls: 'n' }],
        Object.entries(vuln.byProject).map(
          ([project, v]) => `<tr><td>${esc(project)}</td><td class="n">${v.critical ? `<b>${v.critical}</b>` : 0}</td><td class="n">${v.high ? `<b>${v.high}</b>` : 0}</td><td class="n">${v.moderate}</td><td class="n">${v.low}</td></tr>`
        )
      )
    );
    if (vuln.serious.length) {
      sections.push('<h3>Críticas e altas</h3>');
      sections.push(
        table(
          ['Pacote', 'Projeto', 'Severidade', 'Problema', 'Correção'],
          vuln.serious.map(
            (v) => `<tr><td><code>${esc(v.name)}</code>${v.direct ? '' : ' <span class="muted small">(indireta)</span>'}</td><td>${esc(v.project)}</td><td>${v.severity === 'critical' ? pill('fail') : pill('warn').replace('Atenção', 'Alta')}</td><td>${v.url ? `<a href="${esc(v.url)}">${esc(v.title)}</a>` : esc(v.title)}</td><td class="small">${esc(v.fix)}</td></tr>`
          )
        )
      );
    }
  } else sections.push('<p class="muted">A auditoria de dependências não rodou nesta execução.</p>');

  sections.push('<h2>Testes mais lentos</h2>');
  sections.push(table(['Teste', 'Suíte', { label: 'Tempo', cls: 'n' }], m.tests.slowest.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(t.suite)}</td><td class="n">${seconds(t.seconds)}</td></tr>`)));

  if (history.length > 1) {
    sections.push('<h2>Histórico recente</h2>');
    sections.push(
      table(
        ['Data', 'Execução', 'Saúde', { label: 'Aprovação', cls: 'n' }, { label: 'Falhas', cls: 'n' }, { label: 'Instáveis', cls: 'n' }, { label: 'Cobertura', cls: 'n' }, { label: 'Duração', cls: 'n' }],
        history
          .slice(-10)
          .reverse()
          .map(
            (h) => `<tr><td>${dateTime(h.date)}</td><td>${h.url ? `<a href="${esc(h.url)}">${esc(h.workflow)}</a>` : esc(h.workflow || '—')} <code>${esc(h.sha || '')}</code></td><td>${pill({ green: 'ok', yellow: 'warn', red: 'fail' }[h.health] || 'na')}</td><td class="n">${num(h.passRate, '%')}</td><td class="n">${h.failed ?? '—'}</td><td class="n">${h.flaky ?? '—'}</td><td class="n">${num(h.coverageLines, '%')}</td><td class="n">${num(h.minutes, ' min')}</td></tr>`
          )
      )
    );
  }

  return page('Relatório técnico de qualidade', 'Resultados dos testes, falhas, métricas e pipeline · para a equipe de desenvolvimento', sections.join('\n'), m);
}

// ---------- Relatório de negócio ----------

const AREA_DESCRIPTIONS = {
  'Conta e acesso': 'Cadastro, login, logout, recuperação de senha, verificação em duas etapas e perfil do usuário',
  Ocorrências: 'Registro, consulta, edição e remoção de ocorrências pelo cidadão, com fotos, localização e notificações',
  'Gestão pública': 'Painel do gestor: fila de chamados, atendimento, transferência entre órgãos e gestão de usuários',
  'Assistente de IA': 'Triagem automática das ocorrências e respostas do assistente sobre o andamento dos chamados',
  'Telas do app': 'Fluxos reais no aplicativo Android: login, sessão mantida ao reabrir e saída da conta',
  Segurança: 'Bloqueio de acessos indevidos, permissões por perfil e tratamento de erros',
  Outros: 'Demais verificações',
};

// Como cada métrica fora da meta aparece para quem não é técnico
function risks(m) {
  const metric = Object.fromEntries(m.metrics.map((x) => [x.id, x]));
  const list = [];
  const add = (id, title, impact, action) => {
    if (['warn', 'fail'].includes(metric[id].status)) list.push({ level: metric[id].status, title, impact, action });
  };
  const failingAreas = m.areas.filter((a) => !a.ok).map((a) => a.area);
  add(
    'MQ-01',
    failingAreas.length ? `Falha em: ${failingAreas.join(', ')}` : 'Verificação complementar com falha',
    failingAreas.length
      ? 'Parte do produto não se comportou como esperado nos testes. Usuários podem encontrar o mesmo problema.'
      : 'Os testes do assistente contra o serviço de IA real falharam; pode ser instabilidade do fornecedor.',
    failingAreas.length ? 'Corrigir antes de liberar a versão.' : 'Acompanhar na próxima execução diária.'
  );
  const vuln = m.vulnerabilities.totals;
  const fixable = m.vulnerabilities.serious.filter((v) => v.fix !== 'sem correção publicada').length;
  add(
    'MQ-08',
    vuln ? `${plural(vuln.critical, 'vulnerabilidade crítica', 'vulnerabilidades críticas')} e ${plural(vuln.high, 'alta', 'altas')} em bibliotecas usadas pelo sistema` : 'Vulnerabilidades em bibliotecas',
    'Bibliotecas de terceiros têm falhas de segurança conhecidas. Como o sistema guarda dados pessoais, isso é risco de vazamento e de descumprimento da LGPD.',
    fixable
      ? `Priorizar a atualização das bibliotecas: ${fixable} de ${m.vulnerabilities.serious.length} já têm correção publicada.`
      : 'Acompanhar a publicação de correções e avaliar alternativas às bibliotecas afetadas.'
  );
  add(
    'MQ-07',
    `${plural(m.issues?.openHigh ?? 0, 'falha importante em aberto', 'falhas importantes em aberto')}`,
    'A versão principal do sistema está com testes quebrando, o que bloqueia novas entregas.',
    'Resolver antes de qualquer nova funcionalidade.'
  );
  add(
    'MQ-05',
    `Entregas instáveis: ${num(metric['MQ-05'].value, '%')} das execuções da pipeline terminaram com sucesso`,
    `A meta é ${metric['MQ-05'].target}. Quando a verificação automática falha com frequência, as entregas atrasam e a equipe passa a confiar menos nela.`,
    'Investigar as causas mais frequentes de falha nas últimas semanas.'
  );
  add(
    'MQ-06',
    `Recuperação lenta: em média ${num(metric['MQ-06'].value, ' h')} para corrigir uma falha`,
    `A meta é ${metric['MQ-06'].target}. Enquanto a falha não é corrigida, nenhuma melhoria chega aos usuários com segurança.`,
    'Definir quem responde às falhas automáticas e em quanto tempo.'
  );
  add(
    'MQ-02',
    `Parte do sistema sem testes: ${num(m.coverage.combined?.lines, '%')} do código do servidor é verificado`,
    `A meta é ${metric['MQ-02'].target.split(' · ')[0]}. Mudanças nas partes sem teste podem quebrar o sistema sem que ninguém perceba.`,
    'Reservar parte de cada ciclo para testes das áreas menos cobertas.'
  );
  add(
    'MQ-03',
    `${plural(m.flaky?.count ?? 0, 'verificação instável', 'verificações instáveis')}`,
    'Alguns testes passaram e falharam no mesmo código. Podem esconder um defeito real que aparece só às vezes.',
    'Investigar e estabilizar esses testes.'
  );
  add(
    'MQ-04',
    'Verificação automática mais lenta que o previsto',
    'Cada mudança demora mais para ser verificada e liberada.',
    'Revisar as etapas mais demoradas da pipeline.'
  );
  return list.sort((a, b) => (a.level === b.level ? 0 : a.level === 'fail' ? -1 : 1));
}

function business(m, history) {
  const sections = [];
  const metric = Object.fromEntries(m.metrics.map((x) => [x.id, x]));
  const health = HEALTH[m.health];

  sections.push(`<div class="banner ${health.cls}"><span class="dot"></span><div><h2>${health.title}</h2><p>${health.text}</p></div></div>`);

  const areasOk = m.areas.filter((a) => a.ok).length;
  const vuln = m.vulnerabilities.totals;
  const card = (label, value, foot, status) =>
    `<div class="card kpi"><div class="label">${label}</div><div class="value">${value}</div><div class="foot">${pill(status)} ${foot}</div></div>`;
  sections.push('<h2>Indicadores principais</h2><div class="grid">');
  sections.push(
    card('Funcionalidades verificadas', `${areasOk} de ${m.areas.length}`, 'áreas do produto com todos os testes passando', m.areas.length ? (areasOk === m.areas.length ? 'ok' : 'fail') : 'na'),
    card('Confiabilidade da entrega', num(metric['MQ-05'].value, '%'), `das verificações dos últimos ${m.windowDays} dias deram certo (meta ${metric['MQ-05'].target}) ${trend(history, 'pipelineSuccessRate', { suffix: ' p.p.' })}`, metric['MQ-05'].status),
    card('Tempo de recuperação', num(metric['MQ-06'].value, ' h'), `em média para corrigir uma falha (meta ${metric['MQ-06'].target})`, metric['MQ-06'].status),
    card('Segurança das bibliotecas', vuln ? String(vuln.critical + vuln.high) : '—', 'vulnerabilidades críticas ou altas (meta 0)', metric['MQ-08'].status)
  );
  sections.push('</div>');

  sections.push('<h2>O que está garantido</h2>');
  sections.push(
    table(
      ['Área do produto', 'Situação', 'O que cobre'],
      m.areas.map(
        (a) =>
          `<tr><td><b>${esc(a.area)}</b></td><td>${
            a.ok
              ? `${pill('ok').replace('OK', 'Funcionando')} <span class="muted small">${plural(a.total, 'verificação', 'verificações')}${a.informativeFailed ? ` · ${a.informativeFailed} complementar com falha` : ''}</span>`
              : `${pill('fail').replace('Crítico', 'Com falha')} <span class="muted small">${a.failed} de ${a.total} falharam</span>`
          }</td><td class="muted small">${esc(AREA_DESCRIPTIONS[a.area] || '')}</td></tr>`
      )
    )
  );
  const notRun = m.tests.suites.filter((s) => !s.ran).map((s) => s.name);
  if (notRun.length) {
    sections.push(`<p class="muted small">Não verificado nesta execução: ${esc(notRun.join(', '))}. A verificação completa roda todos os dias na regressão diária.</p>`);
  }

  const riskList = risks(m);
  sections.push('<h2>Riscos e recomendações</h2>');
  sections.push(
    riskList.length
      ? `<ul class="risks">${riskList
          .map(
            (r) => `<li class="card ${r.level}"><div class="risk-title">${pill(r.level)} ${esc(r.title)}</div><div>${esc(r.impact)}</div><div class="muted small"><b>Recomendação:</b> ${esc(r.action)}</div></li>`
          )
          .join('')}</ul>`
      : '<p class="muted">Nenhum risco identificado nesta execução.</p>'
  );

  sections.push('<h2>Evolução</h2>');
  sections.push(
    `<div class="card"><div class="label muted small">Saúde da versão nos últimos ${Math.min(history.length, TREND_POINTS)} relatórios (verde: saudável · amarelo: atenção · vermelho: risco)</div>${healthStrip(history)}</div>`
  );

  sections.push('<h2>Como ler este relatório</h2>');
  sections.push(`<div class="card small"><p><b>Verificação automática (pipeline):</b> a cada mudança aprovada e todo dia de madrugada, o sistema é testado
    automaticamente por centenas de verificações, do servidor às telas do aplicativo.</p>
    <p><b>Saúde da versão:</b> vermelho quando algo do produto falhou, há falha de segurança crítica ou uma falha importante está em aberto;
    amarelo quando o produto funciona, mas alguma meta de qualidade não foi atingida; verde quando todas foram.</p>
    <p class="muted">O detalhe técnico de cada indicador está no relatório técnico, gerado junto com este.</p></div>`);

  return page('Relatório de qualidade do produto', 'Visão consolidada para gestão e stakeholders', sections.join('\n'), m);
}

// ---------- Sumário do job ----------

function summary(m) {
  const icon = { ok: '🟢', warn: '🟡', fail: '🔴', na: '⚪' };
  const healthIcon = { green: '🟢', yellow: '🟡', red: '🔴' }[m.health];
  return [
    `## ${healthIcon} Relatório de qualidade: ${HEALTH[m.health].title.toLowerCase()}`,
    '',
    HEALTH[m.health].text,
    '',
    '| | Métrica | Valor | Meta |',
    '|---|---|---|---|',
    ...m.metrics.map((x) => `| ${icon[x.status]} | ${x.id} · ${x.name} | ${x.display} | ${x.target} |`),
    '',
    'Os relatórios **técnico** e **de negócio** (HTML) e o `metrics.json` estão no artefato `relatorios-qualidade` desta execução.',
    '',
  ].join('\n');
}

const args = parseArgs(process.argv.slice(2));
const metrics = JSON.parse(readFileSync(join(args.in, 'metrics.json'), 'utf8'));
const history = JSON.parse(readFileSync(join(args.in, 'history.json'), 'utf8'));

writeFileSync(join(args.out, 'relatorio-tecnico.html'), technical(metrics, history));
writeFileSync(join(args.out, 'relatorio-negocio.html'), business(metrics, history));
// Página inicial do Pages: os dois relatórios a um clique
writeFileSync(
  join(args.out, 'index.html'),
  page(
    'Relatórios de qualidade',
    'Fiscalize',
    `<div class="banner ${HEALTH[metrics.health].cls}"><span class="dot"></span><div><h2>${HEALTH[metrics.health].title}</h2><p>${HEALTH[metrics.health].text}</p></div></div>
     <div class="grid" style="margin-top:16px"><a class="card" href="relatorio-negocio.html"><b>Relatório de negócio</b><div class="muted small">Visão consolidada para gestão e stakeholders</div></a>
     <a class="card" href="relatorio-tecnico.html"><b>Relatório técnico</b><div class="muted small">Testes, falhas, métricas e pipeline para a equipe</div></a></div>`,
    metrics
  )
);

const markdown = summary(metrics);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else process.stdout.write(markdown);
