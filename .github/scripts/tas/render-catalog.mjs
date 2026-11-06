// Publica o catálogo de testes (docs/tas.md, seção 8.5) como relatórios, no mesmo formato do relatório de qualidade:
//   catalogo-testes.json    o catálogo em dados, idêntico ao versionado em docs/testes/
//   relatorio-tecnico.html  casos, suítes, arquivos e a lista de testes com o TC de cada um, para a equipe
//   relatorio-negocio.html  quanto do plano de testes está automatizado, por história de usuário, para stakeholders
//   index.html              os dois relatórios a um clique
// e um resumo em Markdown no sumário do job (GITHUB_STEP_SUMMARY), ou na saída padrão sem ele.
//
// Uso: node .github/scripts/tas/render-catalog.mjs [--out <pasta>]   (padrão: tas-report)
// Sem dependências: roda no job "Política da TAS" antes de qualquer npm install.

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSS, dateTime, esc, table } from '../lib/report-html.mjs';
import { CATALOG_JSON, buildCatalog, serialize } from './test-catalog.mjs';

const PLAN = 'docs/testes/Template_Plano_de_Testes_e_Backlog.md';

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'tas-report';

const num = (value) => String(value).replace('.', ',');
const pct = (part, total) => (total ? `${num(Math.round((part / total) * 1000) / 10)}%` : '—');
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

// Nome de cada suíte para quem não é da equipe técnica
const SUITE_PLAIN = {
  unit: 'Regras isoladas do servidor',
  api: 'API do servidor',
  'e2e-api': 'Jornadas completas pela API',
  'e2e-telas': 'Telas do aplicativo',
  'agente-ia': 'Agente de IA',
};

// Situação de cada caso do plano
const SITUATION = {
  auto: { cls: 'ok', short: 'Automatizado', text: 'tem teste automatizado rodando na pipeline' },
  manual: { cls: 'na', short: 'Manual', text: 'o plano decidiu manter a verificação manual (seção 5)' },
  out: { cls: 'na', short: 'Fora do escopo', text: 'depende de funcionalidade removida do escopo (seção 6.1)' },
  pending: { cls: 'warn', short: 'Sem teste', text: 'o plano prevê automação, mas nenhum teste cita o caso' },
};
const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;

// ---------- Plano de testes: nome das HUs, decisão de automação e casos fora do escopo ----------

function readPlan() {
  const lines = readFileSync(PLAN, 'utf8').split(/\r?\n/);
  const cells = (line) => line.split('|').map((c) => c.trim().replace(/^`|`$/g, ''));
  const hus = new Map();
  const automation = new Map();
  const removed = new Set();
  let section = '';
  for (const line of lines) {
    if (line.startsWith('### ')) section = line.slice(4);
    if (!line.startsWith('|')) continue;
    const cols = cells(line);
    // Seção 2: "| `Sessão com access token e refresh token (HU-01)` | `Sim` | ... |"
    const hu = cols[1]?.match(/^(.+?)\s*\((HU-\d+)\)$/);
    if (hu && !hus.has(hu[2])) hus.set(hu[2], hu[1]);
    // Seção 5: "| `TC-01` | `Integração` | ... | `Sim` |"
    if (/^TC-\d+$/.test(cols[1]) && cols.length >= 10 && /^(Sim|Não)/.test(cols[8]) && !/^HU-/.test(cols[2])) {
      automation.set(cols[1], { nivel: cols[2], automatizar: cols[8] });
    }
    if (section.startsWith('6.1') && /^TC-\d+$/.test(cols[1])) removed.add(cols[1]);
  }
  return { hus, automation, removed };
}

function situationOf(id, caso, plan) {
  if (caso.testes) return 'auto';
  if (plan.removed.has(id)) return 'out';
  if (plan.automation.get(id)?.automatizar.startsWith('Não')) return 'manual';
  return 'pending';
}

// ---------- Dados ----------

function analyze() {
  const catalog = buildCatalog();
  const plan = readPlan();
  const cases = Object.entries(catalog.casos).map(([id, c]) => ({ id, ...c, situacao: situationOf(id, c, plan), nivel: plan.automation.get(id)?.nivel ?? null }));
  const count = (list, key) => list.filter((c) => c.situacao === key).length;

  // Casos sem HU (cadastro, perfil, órgãos, agente de IA...) entram numa linha própria, depois das HUs
  const huIds = [...new Set(cases.map((c) => c.hu).filter(Boolean))].sort();
  if (cases.some((c) => !c.hu)) huIds.push(null);
  const hus = huIds.map((hu) => {
    const list = cases.filter((c) => c.hu === hu);
    const ids = new Set(list.map((c) => c.id));
    const auto = count(list, 'auto');
    const pending = count(list, 'pending');
    const tests = catalog.testes.filter((t) => t.casos.some((id) => ids.has(id)));
    return {
      id: hu ?? 'Sem HU',
      nome: hu ? (plan.hus.get(hu) ?? '') : 'Requisitos do produto fora das HUs do backlog',
      casos: list.length,
      auto,
      manual: count(list, 'manual'),
      out: count(list, 'out'),
      pending,
      testes: tests.length,
      suites: [...new Set(tests.map((t) => t.suite))],
      // na: nada a automatizar na HU (casos manuais ou fora do escopo), não é lacuna nem cobertura
      status: pending ? (auto ? 'warn' : 'fail') : auto ? 'ok' : 'na',
    };
  });

  const files = new Map();
  for (const t of catalog.testes) {
    const f = files.get(t.arquivo) ?? { arquivo: t.arquivo, suite: t.suite, testes: 0, casos: new Set() };
    f.testes++;
    t.casos.forEach((id) => f.casos.add(id));
    files.set(t.arquivo, f);
  }

  const server = process.env.GITHUB_SERVER_URL;
  const run = process.env.GITHUB_RUN_ID
    ? {
        id: process.env.GITHUB_RUN_ID,
        workflow: process.env.GITHUB_WORKFLOW,
        branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
        sha: process.env.GITHUB_SHA,
        url: `${server}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      }
    : null;

  return {
    catalog,
    cases,
    hus,
    files: [...files.values()],
    generatedAt: new Date().toISOString(),
    run,
    totals: {
      testes: catalog.total,
      casos: cases.length,
      auto: count(cases, 'auto'),
      manual: count(cases, 'manual'),
      out: count(cases, 'out'),
      pending: count(cases, 'pending'),
      desligados: catalog.testes.filter((t) => t.desligado).length,
    },
  };
}

// ---------- Layout ----------

function page(title, subtitle, body, d) {
  const meta = d.run
    ? `${esc(d.run.workflow)} · ${esc(d.run.branch)} · <code>${esc(d.run.sha?.slice(0, 7))}</code> · <a href="${esc(d.run.url)}">execução #${esc(d.run.id)}</a>`
    : 'execução local';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${CSS}</style></head>
<body><main>
<header class="top"><div><h1>${esc(title)}</h1><div class="muted">${esc(subtitle)}</div></div>
<div class="muted small">Gerado em ${dateTime(d.generatedAt)}<br>${meta}</div></header>
${body}
<footer>Fiscalize · relatório gerado automaticamente pelo job <b>Política da TAS</b> a partir dos títulos dos testes.
Rastreabilidade: <code>docs/tas.md</code>, seção 8.5 · plano de testes: <code>${PLAN}</code>.</footer>
</main></body></html>`;
}

const kpi = (label, value, foot = '') => `<div class="card kpi"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="foot">${foot}</div></div>`;

function banner(d) {
  const t = d.totals;
  const ok = !t.pending;
  return `<div class="banner ${ok ? 'ok' : 'warn'}"><span class="dot"></span><div>
    <h2>${ok ? 'Todo caso do plano tem verificação definida' : `${plural(t.pending, 'caso do plano está', 'casos do plano estão')} sem teste automatizado`}</h2>
    <p>${t.auto} de ${t.casos} casos têm teste automatizado (${pct(t.auto, t.casos)}); ${t.manual} ficam manuais por decisão do plano e
    ${t.out} saíram do escopo.</p></div></div>`;
}

// ---------- Relatório de negócio ----------

function business(d) {
  const t = d.totals;
  const stories = d.hus.filter((h) => h.id.startsWith('HU-'));
  const covered = stories.filter((h) => h.status === 'ok' || h.status === 'na').length;
  const sections = [banner(d)];

  sections.push('<h2>Visão geral</h2>');
  sections.push(`<div class="grid">
    ${kpi('Casos do plano com teste automatizado', pct(t.auto, t.casos - t.out), `${t.auto} de ${t.casos - t.out} casos dentro do escopo`)}
    ${kpi('Histórias de usuário cobertas', `${covered}/${stories.length}`, 'todas as regras previstas para automação têm teste')}
    ${kpi('Verificações automáticas', String(t.testes), 'rodam a cada mudança aprovada e todo dia')}
    ${kpi('Casos sem teste', String(t.pending), t.pending ? 'previstos no plano, ainda sem automação' : 'nenhuma lacuna aberta')}
  </div>`);

  const label = { ok: 'Coberta', warn: 'Parcial', fail: 'Sem teste', na: 'Sem automação prevista' };
  sections.push('<h2>Cobertura por história de usuário</h2>');
  sections.push(
    table(
      ['História', 'Situação', { label: 'Casos', cls: 'n' }, { label: 'Automatizados', cls: 'n' }, { label: 'Manuais', cls: 'n' }, { label: 'Fora do escopo', cls: 'n' }, { label: 'Verificações', cls: 'n' }, 'Onde é verificada'],
      d.hus.map(
        (h) => `<tr><td><b>${esc(h.id)}</b><div class="muted small">${esc(h.nome)}</div></td><td>${pill(h.status, label[h.status])}</td>
          <td class="n">${h.casos}</td><td class="n">${h.auto}</td><td class="n">${h.manual}</td><td class="n">${h.out}</td><td class="n">${h.testes}</td>
          <td class="small">${esc(h.suites.map((s) => SUITE_PLAIN[s]).join(', ') || '—')}</td></tr>`
      )
    )
  );

  const pending = d.cases.filter((c) => c.situacao === 'pending');
  sections.push('<h2>Lacunas</h2>');
  sections.push(
    pending.length
      ? `<ul class="risks">${pending
          .map((c) => `<li class="card"><div class="risk-title">${pill('warn', c.id)} ${esc(c.hu ?? '')} · ${esc(c.titulo)}</div><div class="muted small">${esc(SITUATION.pending.text)}.</div></li>`)
          .join('')}</ul>`
      : '<p class="muted">Nenhum caso previsto para automação está sem teste.</p>'
  );

  sections.push('<h2>Como ler este relatório</h2>');
  sections.push(`<div class="card small"><p><b>Caso do plano:</b> uma situação que o produto precisa tratar, descrita no plano de testes e
    ligada a uma história de usuário (HU). Cada teste automatizado diz no próprio nome qual caso verifica, então esta contagem sai direto do
    código e não de uma planilha mantida à mão.</p>
    <p><b>Manual:</b> o plano avaliou custo e frequência e decidiu verificar à mão. <b>Fora do escopo:</b> o caso depende de uma
    funcionalidade que o projeto decidiu não entregar.</p>
    <p class="muted">A lista de cada teste, por caso e por arquivo, está no relatório técnico, gerado junto com este.</p></div>`);

  return page('Rastreabilidade dos testes', 'Quanto do plano de testes está automatizado, para gestão e stakeholders', sections.join('\n'), d);
}

// ---------- Relatório técnico ----------

function technical(d) {
  const t = d.totals;
  const c = d.catalog;
  const sections = [banner(d)];

  sections.push('<h2>Suítes</h2>');
  sections.push(
    `<div class="grid">${Object.entries(c.suites)
      .map(([id, s]) => kpi(s.nome, String(s.testes), `<code>${esc(s.pasta)}</code> · ${plural(new Set(c.testes.filter((x) => x.suite === id).flatMap((x) => x.casos)).size, 'caso', 'casos')}`))
      .join('')}</div>`
  );
  if (t.desligados) sections.push(`<div class="warnbox small">${plural(t.desligados, 'teste está desligado', 'testes estão desligados')} (quarentena); continuam no catálogo e contam para o caso.</div>`);

  sections.push('<h2>Casos do plano</h2>');
  sections.push(
    table(
      ['Caso', 'HU', 'Título no plano', 'Nível', 'Situação', { label: 'Testes', cls: 'n' }, 'Suítes'],
      d.cases.map((x) => {
        const s = SITUATION[x.situacao];
        return `<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.hu ?? '—')}</td><td class="small">${esc(x.titulo)}</td><td class="small">${esc(x.nivel ?? '—')}</td>
          <td><span title="${esc(s.text)}">${pill(s.cls, s.short)}</span></td><td class="n">${x.testes}</td><td class="small">${esc(x.suites.join(', ') || '—')}</td></tr>`;
      })
    )
  );

  sections.push('<h2>Arquivos de teste</h2>');
  sections.push(
    table(
      ['Arquivo', 'Suíte', { label: 'Testes', cls: 'n' }, 'Casos'],
      d.files.map((f) => `<tr><td><code>${esc(f.arquivo)}</code></td><td class="small">${esc(f.suite)}</td><td class="n">${f.testes}</td><td class="small">${esc([...f.casos].sort().join(', '))}</td></tr>`)
    )
  );

  sections.push('<h2>Testes</h2>');
  sections.push(
    Object.entries(c.suites)
      .map(([id, s]) => {
        const list = c.testes.filter((x) => x.suite === id);
        return `<details><summary>${esc(s.nome)} · ${list.length}</summary>${table(
          ['Casos', 'Arquivo', 'Grupo', 'Título'],
          list.map(
            (x) => `<tr><td class="small">${esc(x.casos.join(', '))}</td><td class="small"><code>${esc(x.arquivo.slice(s.pasta.length + 1))}</code></td>
              <td class="small muted">${esc(x.grupo ?? '')}</td><td class="small">${esc(x.titulo)}${x.parametrizado ? ' <span class="muted">(parametrizado)</span>' : ''}${x.desligado ? ` ${pill('warn', 'desligado')}` : ''}</td></tr>`
          )
        )}</details>`;
      })
      .join('')
  );

  sections.push(`<p class="muted small">Os mesmos dados estão em <code>catalogo-testes.json</code>, neste artefato e versionado em <code>${CATALOG_JSON}</code>.</p>`);

  return page('Catálogo de testes', 'Casos, suítes, arquivos e testes, para a equipe', sections.join('\n'), d);
}

// ---------- Sumário do job ----------

function summary(d) {
  const t = d.totals;
  const icon = { ok: '🟢', warn: '🟡', fail: '🔴', na: '⚪' };
  const pending = d.cases.filter((c) => c.situacao === 'pending');
  return [
    `## ${t.pending ? '🟡' : '🟢'} Catálogo de testes: ${t.auto} de ${t.casos} casos do plano automatizados`,
    '',
    `${t.testes} testes, todos com o caso do plano no título · ${t.manual} casos manuais por decisão · ${t.out} fora do escopo · ${t.pending} sem teste`,
    '',
    '| | HU | Casos | Automatizados | Manuais | Fora do escopo | Testes |',
    '|---|---|---|---|---|---|---|',
    ...d.hus.map((h) => `| ${icon[h.status]} | ${h.id} ${h.nome} | ${h.casos} | ${h.auto} | ${h.manual} | ${h.out} | ${h.testes} |`),
    '',
    ...(pending.length ? [`Sem teste: ${pending.map((c) => c.id).join(', ')}`, ''] : []),
    'Os relatórios **técnico** e **de negócio** (HTML) e o `catalogo-testes.json` estão no artefato `catalogo-testes` desta execução.',
    '',
  ].join('\n');
}

const data = analyze();
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'catalogo-testes.json'), serialize(data.catalog));
writeFileSync(join(OUT, 'relatorio-tecnico.html'), technical(data));
writeFileSync(join(OUT, 'relatorio-negocio.html'), business(data));
writeFileSync(
  join(OUT, 'index.html'),
  page(
    'Catálogo de testes',
    'Fiscalize',
    `${banner(data)}
     <div class="grid" style="margin-top:16px"><a class="card" href="relatorio-negocio.html"><b>Relatório de negócio</b><div class="muted small">Quanto do plano de testes está automatizado, por história de usuário</div></a>
     <a class="card" href="relatorio-tecnico.html"><b>Relatório técnico</b><div class="muted small">Casos, suítes, arquivos e a lista de testes</div></a>
     <a class="card" href="catalogo-testes.json"><b>catalogo-testes.json</b><div class="muted small">O catálogo em formato de dados</div></a></div>`,
    data
  )
);

const markdown = summary(data);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else process.stdout.write(markdown);
