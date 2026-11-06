// Relatório técnico geral do Fiscalize (workflow relatorio-tecnico.yml). Junta, a partir do próprio repositório:
//   - cada tecnologia de tecnologias.mjs com o texto das seções dos READMEs de docs/<disciplina>/
//     (como foi usada, por que foi escolhida, alternativas descartadas), a versão instalada (package-lock)
//     e os arquivos que a usam (imports, ou os caminhos de configuração);
//   - visão do sistema: rotas da API e perfis exigidos, modelo de dados (Prisma), telas do app, workflows e testes;
//   - dependências dos package.json sem seção na documentação.
// Gera:
//   relatorio-tecnico-projeto.html   o relatório para leitura
//   tecnologias.xml                  os mesmos dados em XML estruturado
// e um resumo no sumário do job. Sem dependências: roda só com o Node, sem npm install.
//
// Uso: node .github/scripts/tech-report/render-tech-report.mjs [--out tech-report]

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CSS, dateTime, esc, table } from '../lib/report-html.mjs';
import { el, xmlDocument } from '../lib/xml.mjs';
import { CATEGORIAS, DISCIPLINAS, PROJETOS, TECNOLOGIAS } from './tecnologias.mjs';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'tech-report';
const MAX_FILES = 8;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.expo', 'android', 'ios', '.git']);
const SOURCE = /\.(ts|tsx|js|mjs|cjs)$/;

const rel = (p) => p.split(path.sep).join('/');
const exists = (p) => existsSync(path.join(ROOT, p));
const read = (p) => (exists(p) ? readFileSync(path.join(ROOT, p), 'utf8') : '');
const readJson = (p) => {
  try {
    return JSON.parse(read(p));
  } catch {
    return null;
  }
};

function walk(p) {
  const full = path.join(ROOT, p);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [rel(p)];
  return readdirSync(full).flatMap((name) => (SKIP_DIRS.has(name) ? [] : walk(path.join(p, name))));
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Texto dos READMEs ----------

const inlinePlain = (md) =>
  md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

const inlineHtml = (md) =>
  esc(md)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

function classify(label) {
  const l = label.toLowerCase().replace(/[:.]+$/, '').trim();
  if (l.startsWith('como')) return 'como';
  if (l.startsWith('por qu')) return 'porque';
  if (l.startsWith('descartad') || l.startsWith('alternativas descartadas')) return 'descartados';
  if (l.startsWith('o que é')) return 'oque';
  if (l.startsWith('limitaç')) return 'limitacao';
  return 'outro';
}

// Seção "### 3.1 Título" (ou título exato) de um README, dividida nos blocos rotulados em negrito
const readmeCache = new Map();
function section(d, key) {
  const file = `docs/${DISCIPLINAS[d].pasta}/README.md`;
  if (!readmeCache.has(file)) readmeCache.set(file, read(file).split(/\r?\n/));
  const lines = readmeCache.get(file);
  const start = lines.findIndex((l) => l === `### ${key}` || l.startsWith(`### ${key} `));
  if (start < 0) return { file, secao: key, disciplina: DISCIPLINAS[d].nome, encontrada: false, titulo: key, blocos: {} };
  const titulo = inlinePlain(lines[start].replace(/^###\s+/, ''));
  const blocos = {};
  let current = null;
  let fenced = false;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,3}\s/.test(line)) break;
    if (line.trim().startsWith('```')) {
      fenced = !fenced;
      continue;
    }
    if (fenced || /^---\s*$/.test(line)) continue;
    const label = line.match(/^(?:- )?\*\*([^*]+?)\*\*\s*(.*)$/);
    if (label) {
      current = classify(label[1]);
      if (current === 'outro') continue;
      blocos[current] ??= { texto: [], itens: [] };
      if (label[2].trim()) blocos[current].texto.push(label[2].trim());
      continue;
    }
    if (!current || current === 'outro' || !blocos[current]) continue;
    const item = line.match(/^\s+- (.*)$/);
    if (item) blocos[current].itens.push(item[1].trim());
    else if (/^\s+\S/.test(line) && blocos[current].itens.length) blocos[current].itens[blocos[current].itens.length - 1] += ` ${line.trim()}`;
    else if (line.trim() && !line.startsWith('|') && !line.startsWith('>')) blocos[current].texto.push(line.trim());
  }
  for (const b of Object.values(blocos)) b.texto = b.texto.join(' ').trim();
  // "... **Descartado:** X" no meio de outro bloco vira o bloco de descartados
  for (const [k, b] of Object.entries(blocos)) {
    const cut = k === 'descartados' ? null : b.texto.match(/\s\*\*Descartad[oa]s?:\*\*\s*(.*)$/);
    if (!cut) continue;
    b.texto = b.texto.slice(0, cut.index).trim();
    blocos.descartados ??= { texto: '', itens: [] };
    blocos.descartados.texto = [blocos.descartados.texto, cut[1]].filter(Boolean).join(' ');
  }
  return { file, secao: key, disciplina: DISCIPLINAS[d].nome, encontrada: true, titulo, blocos };
}

// ---------- Pacotes, versões e uso ----------

const manifests = Object.fromEntries(
  Object.entries(PROJETOS).map(([id, p]) => [id, { pkg: readJson(path.posix.join(p.dir, 'package.json')) || {}, lock: readJson(path.posix.join(p.dir, 'package-lock.json')) || {} }])
);

function packageInfo(projeto, nome) {
  const { pkg, lock } = manifests[projeto];
  const declarada = pkg.dependencies?.[nome] ?? pkg.devDependencies?.[nome] ?? null;
  return {
    projeto,
    nome,
    declarada,
    instalada: lock.packages?.[`node_modules/${nome}`]?.version ?? null,
    tipo: pkg.dependencies?.[nome] ? 'producao' : pkg.devDependencies?.[nome] ? 'desenvolvimento' : 'ausente',
  };
}

const sourceFiles = Object.fromEntries(Object.entries(PROJETOS).map(([id, p]) => [id, p.fontes.flatMap(walk).filter((f) => SOURCE.test(f))]));
const contents = new Map();
const content = (f) => {
  if (!contents.has(f)) contents.set(f, read(f));
  return contents.get(f);
};
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function importers(projeto, specifiers) {
  const re = new RegExp(`(?:from\\s+|import\\s+|require\\(\\s*|import\\(\\s*)['"](?:${specifiers.map(escapeRe).join('|')})(?:/[^'"]*)?['"]`);
  return sourceFiles[projeto].filter((f) => re.test(content(f)));
}

function usage(t) {
  const arquivos = new Set();
  for (const [projeto, nomes] of Object.entries(t.pacotes || {})) importers(projeto, nomes).forEach((f) => arquivos.add(f));
  for (const [projeto, nomes] of Object.entries(t.builtin || {})) importers(projeto, nomes.flatMap((n) => [`node:${n}`, n])).forEach((f) => arquivos.add(f));
  const caminhos = (t.caminhos || []).map((c) => ({ caminho: c, existe: exists(c), arquivos: exists(c) ? walk(c).length : 0 }));
  return { arquivos: [...arquivos].sort(), caminhos };
}

// ---------- Visão do sistema ----------

function apiRoutes() {
  const app = read('backend/src/app.ts');
  const imports = Object.fromEntries([...app.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/(\w+)'/g)].map((m) => [m[1], `backend/src/routes/${m[2]}.ts`]));
  const routes = [];
  for (const [, prefix, name] of app.matchAll(/app\.use\('([^']+)',\s*(\w+Routes)\)/g)) {
    const file = imports[name];
    const src = read(file);
    const fileAuth = /router\.use\(\s*authenticate/.test(src);
    const fileRoles = src.match(/router\.use\(\s*requireRole\(\[([^\]]*)\]/)?.[1];
    for (const [, method, sub, rest] of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'([\s\S]*?)\);/g)) {
      const roles = rest.match(/requireRole\(\[([^\]]*)\]/)?.[1] ?? fileRoles;
      const auth = fileAuth || /authenticate/.test(rest);
      routes.push({
        metodo: method.toUpperCase(),
        caminho: `${prefix}${sub === '/' ? '' : sub}` || '/',
        acesso: roles ? roles.replace(/['"\s]/g, '').split(',').join(', ') : auth ? 'autenticado' : 'público',
        arquivo: file,
      });
    }
  }
  routes.push({ metodo: 'GET', caminho: '/health', acesso: 'público', arquivo: 'backend/src/app.ts' });
  return routes;
}

function dataModel() {
  const schema = read('backend/prisma/schema.prisma');
  const modelos = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => ({
    nome: m[1],
    campos: m[2].split('\n').filter((l) => /^\s+\w+\s+\w/.test(l) && !/^\s+@@/.test(l)).length,
  }));
  const enums = [...schema.matchAll(/^enum\s+(\w+)/gm)].map((m) => m[1]);
  const migrations = exists('backend/prisma/migrations') ? readdirSync(path.join(ROOT, 'backend/prisma/migrations')).filter((n) => /^\d/.test(n)) : [];
  return { modelos, enums, migrations };
}

function appScreens() {
  return walk('mobile/app')
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('_layout.tsx'))
    .map((f) => {
      const route = f.replace(/^mobile\/app/, '').replace(/\.tsx$/, '').replace(/\/index$/, '') || '/';
      return { rota: route.replace(/\/\([^)]+\)/g, '') || '/', grupo: f.match(/\((\w+)\)/)?.[1] ?? '', arquivo: f };
    });
}

function workflows() {
  return walk('.github/workflows')
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => {
      const src = read(f);
      const gatilhos = ['push', 'pull_request', 'schedule', 'workflow_dispatch', 'workflow_call', 'workflow_run'].filter((g) => new RegExp(`^\\s{2}${g}:`, 'm').test(src));
      return { arquivo: f, nome: src.match(/^name:\s*(.+)$/m)?.[1].trim() ?? path.basename(f), gatilhos };
    });
}

function tests() {
  const catalog = readJson('docs/testes-automatizados/catalogo-testes.json');
  if (!catalog) return null;
  const porSuite = {};
  for (const t of catalog.testes || []) porSuite[t.suite] = (porSuite[t.suite] || 0) + 1;
  return { total: (catalog.testes || []).length, casos: Object.keys(catalog.casos || {}).length, porSuite };
}

// ---------- Montagem ----------

function analyze() {
  const tecnologias = TECNOLOGIAS.map((t) => {
    const fontes = t.fontes.map((f) => section(f.d, f.secao));
    const pacotes = Object.entries(t.pacotes || {}).flatMap(([projeto, nomes]) => nomes.map((n) => packageInfo(projeto, n)));
    const principal = fontes.find((f) => f.encontrada) || fontes[0];
    const merge = (key) => fontes.filter((f) => f.blocos?.[key]).map((f) => ({ fonte: f, ...f.blocos[key] }));
    return {
      ...t,
      disciplinas: [...new Set(t.fontes.map((f) => f.d))],
      fontes,
      pacotes,
      uso: usage(t),
      como: merge('como'),
      porque: merge('porque'),
      descartados: merge('descartados'),
      oque: merge('oque'),
      limitacao: merge('limitacao'),
      tituloDoc: principal.titulo,
    };
  });

  const documented = new Set();
  for (const t of TECNOLOGIAS) for (const group of [t.pacotes, t.apoio]) for (const [projeto, nomes] of Object.entries(group || {})) nomes.forEach((n) => documented.add(`${projeto}:${n}`));
  const semDocumentacao = Object.entries(manifests).flatMap(([projeto, { pkg }]) =>
    [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]
      .filter((n) => !n.startsWith('@types/') && !documented.has(`${projeto}:${n}`))
      .map((n) => packageInfo(projeto, n))
  );
  const ausentes = tecnologias.flatMap((t) => t.pacotes.filter((p) => p.tipo === 'ausente').map((p) => ({ ...p, tecnologia: t.nome })));
  const secoesFaltando = tecnologias.flatMap((t) => t.fontes.filter((f) => !f.encontrada).map((f) => ({ tecnologia: t.nome, arquivo: f.file, secao: f.secao })));

  return {
    generatedAt: new Date().toISOString(),
    run: process.env.GITHUB_RUN_ID
      ? {
          id: process.env.GITHUB_RUN_ID,
          workflow: process.env.GITHUB_WORKFLOW,
          branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
          sha: process.env.GITHUB_SHA,
          url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
        }
      : null,
    tecnologias,
    semDocumentacao,
    ausentes,
    secoesFaltando,
    api: apiRoutes(),
    dados: dataModel(),
    telas: appScreens(),
    workflows: workflows(),
    testes: tests(),
    projetos: Object.entries(manifests).map(([id, { pkg }]) => ({
      id,
      dir: PROJETOS[id].dir,
      dependencias: Object.keys(pkg.dependencies || {}).length,
      desenvolvimento: Object.keys(pkg.devDependencies || {}).length,
    })),
  };
}

// ---------- HTML ----------

const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;
const kpi = (label, value, foot = '') => `<div class="card kpi"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="foot">${esc(foot)}</div></div>`;
const discPill = (d) => pill('na', DISCIPLINAS[d].nome);
const versionOf = (p) => `${p.instalada ?? p.declarada ?? '—'}`;

function block(title, entries) {
  if (!entries.length) return '';
  return `<h3>${esc(title)}</h3>${entries
    .map((b) => `${entries.length > 1 ? `<div class="muted small">${esc(b.fonte.disciplina)}</div>` : ''}${b.texto ? `<p>${inlineHtml(b.texto)}</p>` : ''}${b.itens.length ? `<ul>${b.itens.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</ul>` : ''}`)
    .join('')}`;
}

function techCard(t) {
  const versions = t.pacotes.length
    ? `<div class="small">${t.pacotes.map((p) => `<code>${esc(p.nome)}@${esc(versionOf(p))}</code> <span class="muted">(${esc(p.projeto)})</span>`).join(' · ')}</div>`
    : '';
  const files = t.uso.arquivos;
  const paths = t.uso.caminhos.filter((c) => c.existe);
  const where = [
    ...paths.map((c) => `<code>${esc(c.caminho)}</code>${c.arquivos > 1 ? ` <span class="muted">(${c.arquivos} arquivos)</span>` : ''}`),
    ...files.slice(0, MAX_FILES).map((f) => `<code>${esc(f)}</code>`),
  ];
  const more = files.length > MAX_FILES ? ` <span class="muted">e mais ${files.length - MAX_FILES}</span>` : '';
  const sources = t.fontes.map((f) => `<code>${esc(f.file)}</code> › ${esc(f.encontrada ? f.titulo : `seção ${f.secao} não encontrada`)}`).join('<br>');
  return `<details class="tech" id="${esc(t.id)}"><summary>${esc(t.nome)} ${t.disciplinas.map(discPill).join(' ')}</summary>
${versions}
<h3>Onde é usado</h3>${where.length ? `<p class="small">${where.join(' · ')}${more}</p>` : '<p class="muted small">Nenhum uso encontrado no código.</p>'}
${block('O que é', t.oque)}${block('Como foi usado', t.como)}${block('Por que foi escolhido', t.porque)}${block('Alternativas descartadas', t.descartados)}${block('Limitações', t.limitacao)}
<p class="muted small">Fonte: ${sources}</p></details>`;
}

function html(d) {
  const runMeta = d.run
    ? `${esc(d.run.workflow)} · ${esc(d.run.branch)} · <code>${esc(d.run.sha?.slice(0, 7))}</code> · <a href="${esc(d.run.url)}">execução #${esc(d.run.id)}</a>`
    : 'execução local';
  const byDisc = Object.entries(DISCIPLINAS).map(([k, v]) => {
    const list = d.tecnologias.filter((t) => t.disciplinas.includes(k));
    return `<tr><td><b>${esc(v.nome)}</b><div class="muted small"><code>docs/${esc(v.pasta)}</code></div></td><td>${list.map((t) => `<a href="#${esc(t.id)}">${esc(t.nome)}</a>`).join(' · ') || '<span class="muted">sem tecnologia própria (decisões de produto e processo)</span>'}</td></tr>`;
  });
  const categories = CATEGORIAS.map((c) => {
    const list = d.tecnologias.filter((t) => t.categoria === c);
    return list.length ? `<h2>${esc(c)}</h2>${list.map(techCard).join('')}` : '';
  }).join('');
  const apiRows = d.api.map((r) => `<tr><td><code>${esc(r.metodo)}</code></td><td><code>${esc(r.caminho)}</code></td><td>${esc(r.acesso)}</td><td class="muted small">${esc(r.arquivo)}</td></tr>`);
  const suiteRows = d.testes ? Object.entries(d.testes.porSuite).map(([s, n]) => `<tr><td>${esc(s)}</td><td class="n">${n}</td></tr>`) : [];
  const wfRows = d.workflows.map((w) => `<tr><td><b>${esc(w.nome)}</b></td><td><code>${esc(w.arquivo)}</code></td><td>${esc(w.gatilhos.join(', '))}</td></tr>`);
  const undocRows = d.semDocumentacao.map((p) => `<tr><td>${esc(p.projeto)}</td><td><code>${esc(p.nome)}</code></td><td>${esc(versionOf(p))}</td><td>${p.tipo === 'producao' ? 'produção' : 'desenvolvimento'}</td></tr>`);
  const consistency = [
    ...d.secoesFaltando.map((s) => `<li>${esc(s.tecnologia)}: seção <code>${esc(s.secao)}</code> não encontrada em <code>${esc(s.arquivo)}</code></li>`),
    ...d.ausentes.map((p) => `<li>${esc(p.tecnologia)}: pacote <code>${esc(p.nome)}</code> não está mais no <code>${esc(p.projeto)}/package.json</code></li>`),
  ];

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório técnico do projeto</title><style>${CSS}
details.tech h3{font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);margin:14px 0 4px}
details.tech p,details.tech ul{margin:4px 0}details.tech summary .pill{margin-left:4px;font-weight:500}</style></head>
<body><main>
<header class="top"><div><h1>Relatório técnico do projeto</h1><div class="muted">Fiscalize · tecnologias, onde são usadas, por que foram escolhidas e o que foi descartado</div></div>
<div class="muted small">Gerado em ${dateTime(d.generatedAt)}<br>${runMeta}</div></header>

<div class="grid">
${kpi('Tecnologias documentadas', d.tecnologias.length, `${Object.keys(DISCIPLINAS).length} disciplinas`)}
${kpi('Rotas da API', d.api.length, `${new Set(d.api.map((r) => r.arquivo)).size} arquivos de rotas`)}
${kpi('Modelo de dados', d.dados.modelos.length, `tabelas · ${d.dados.migrations.length} migrações`)}
${kpi('Telas do app', d.telas.length, 'rotas do Expo Router')}
${kpi('Testes automatizados', d.testes?.total ?? '—', d.testes ? `${d.testes.casos} casos do plano` : 'catálogo indisponível')}
${kpi('Workflows', d.workflows.length, 'GitHub Actions')}
</div>

<h2>Arquitetura</h2>
<div class="card"><pre>App (React Native + Expo, MVVM) ──HTTPS + JWT──▶ API (Express 5 + Prisma) ──▶ PostgreSQL
        │                                         │ ├─▶ Redis (cache de métricas, node-cron)
        │ SecureStore (tokens)                    │ ├─▶ SMTP (nodemailer) · Expo Push API
        └─ GPS, câmera, push, mapa (OSM)          │ └─▶ ai-agent (Gemini + function calling)
                                                  └── GitHub Actions: testes, qualidade, segurança, relatórios</pre>
<p class="small muted">Projetos: ${d.projetos.map((p) => `<code>${esc(p.dir)}</code> (${p.dependencias} dependências, ${p.desenvolvimento} de desenvolvimento)`).join(' · ')}</p></div>

<h2>Tecnologias por disciplina</h2>
${table(['Disciplina', 'Tecnologias'], byDisc)}
${categories}

<h2>Rotas da API</h2>
<details><summary>${plural(d.api.length, 'rota', 'rotas')} e o perfil exigido em cada uma</summary>${table(['Método', 'Caminho', 'Acesso', 'Arquivo'], apiRows)}</details>

<h2>Modelo de dados</h2>
<div class="card small">${d.dados.modelos.map((m) => `<code>${esc(m.nome)}</code> <span class="muted">(${m.campos})</span>`).join(' · ')}
${d.dados.enums.length ? `<p class="muted">Enums: ${d.dados.enums.map((e) => `<code>${esc(e)}</code>`).join(' · ')}</p>` : ''}
<p class="muted">${plural(d.dados.migrations.length, 'migração', 'migrações')} em <code>backend/prisma/migrations</code>; a primeira de ${esc(d.dados.migrations[0]?.slice(0, 8) ?? '—')}, a última de ${esc(d.dados.migrations.at(-1)?.slice(0, 8) ?? '—')}.</p></div>

<h2>Telas do aplicativo</h2>
<div class="card small">${d.telas.map((s) => `<code>${esc(s.rota)}</code>${s.grupo ? ` <span class="muted">(${esc(s.grupo)})</span>` : ''}`).join(' · ')}</div>

<h2>Testes</h2>
${d.testes ? table(['Suíte', { label: 'Testes', cls: 'n' }], suiteRows) : '<p class="warnbox">Catálogo de testes indisponível.</p>'}

<h2>Workflows (CI/CD)</h2>
${table(['Workflow', 'Arquivo', 'Gatilhos'], wfRows)}

<h2>Consistência da documentação</h2>
${consistency.length ? `<div class="warnbox"><ul>${consistency.join('')}</ul></div>` : '<p class="card">Toda tecnologia do mapa tem seção nos READMEs e todos os pacotes citados existem.</p>'}
${undocRows.length ? `<details><summary>${plural(undocRows.length, 'dependência', 'dependências')} sem seção na documentação</summary><p class="muted small">Pacotes dos package.json que não pertencem a nenhuma tecnologia documentada. Se forem relevantes, documente no README da disciplina e acrescente em <code>.github/scripts/tech-report/tecnologias.mjs</code>.</p>${table(['Projeto', 'Pacote', 'Versão', 'Tipo'], undocRows)}</details>` : ''}

<footer>Fiscalize · relatório gerado automaticamente pelo workflow <b>Relatório técnico</b> a partir dos READMEs de <code>docs/</code>, dos
<code>package.json</code>/<code>package-lock.json</code> e do código. Dados completos em <code>tecnologias.xml</code>.</footer>
</main></body></html>`;
}

// ---------- XML ----------

function xmlBlocks(name, entries) {
  return entries.map((b) =>
    el(name, { fonte: `${b.fonte.file}#${b.fonte.secao}` }, [b.texto ? el('texto', {}, inlinePlain(b.texto)) : null, ...b.itens.map((i) => el('item', {}, inlinePlain(i)))])
  );
}

function xml(d) {
  const root = el(
    'relatorioTecnico',
    { projeto: 'Fiscalize', geradoEm: d.generatedAt, commit: d.run?.sha, branch: d.run?.branch, execucao: d.run?.url },
    [
      el('resumo', {
        tecnologias: d.tecnologias.length,
        rotasApi: d.api.length,
        modelos: d.dados.modelos.length,
        migracoes: d.dados.migrations.length,
        telas: d.telas.length,
        testes: d.testes?.total,
        workflows: d.workflows.length,
        dependenciasSemDocumentacao: d.semDocumentacao.length,
      }),
      el('projetos', {}, d.projetos.map((p) => el('projeto', { id: p.id, pasta: p.dir, dependencias: p.dependencias, desenvolvimento: p.desenvolvimento }))),
      el('disciplinas', {}, Object.entries(DISCIPLINAS).map(([k, v]) => el('disciplina', { id: k, nome: v.nome, documentacao: `docs/${v.pasta}/README.md` }))),
      el('tecnologias', {}, d.tecnologias.map((t) =>
        el('tecnologia', { id: t.id, nome: t.nome, categoria: t.categoria }, [
          el('disciplinas', {}, t.disciplinas.map((k) => el('disciplina', { ref: k }))),
          el('pacotes', {}, t.pacotes.map((p) => el('pacote', { projeto: p.projeto, nome: p.nome, versaoDeclarada: p.declarada, versaoInstalada: p.instalada, tipo: p.tipo }))),
          el('usos', {}, [
            ...t.uso.caminhos.map((c) => el('caminho', { valor: c.caminho, existe: c.existe, arquivos: c.arquivos })),
            ...t.uso.arquivos.map((f) => el('arquivo', { caminho: f })),
          ]),
          el('documentacao', {}, t.fontes.map((f) => el('fonte', { arquivo: f.file, secao: f.secao, titulo: f.titulo, encontrada: f.encontrada }))),
          ...xmlBlocks('oQueE', t.oque),
          ...xmlBlocks('como', t.como),
          ...xmlBlocks('porque', t.porque),
          ...xmlBlocks('descartados', t.descartados),
          ...xmlBlocks('limitacoes', t.limitacao),
        ])
      )),
      el('api', {}, d.api.map((r) => el('rota', { metodo: r.metodo, caminho: r.caminho, acesso: r.acesso, arquivo: r.arquivo }))),
      el('modeloDeDados', { migracoes: d.dados.migrations.length }, [
        ...d.dados.modelos.map((m) => el('modelo', { nome: m.nome, campos: m.campos })),
        ...d.dados.enums.map((e) => el('enum', { nome: e })),
      ]),
      el('telas', {}, d.telas.map((s) => el('tela', { rota: s.rota, grupo: s.grupo, arquivo: s.arquivo }))),
      el('testes', { total: d.testes?.total, casosDoPlano: d.testes?.casos }, Object.entries(d.testes?.porSuite || {}).map(([s, n]) => el('suite', { nome: s, testes: n }))),
      el('workflows', {}, d.workflows.map((w) => el('workflow', { nome: w.nome, arquivo: w.arquivo, gatilhos: w.gatilhos.join(' ') }))),
      el('dependenciasSemDocumentacao', {}, d.semDocumentacao.map((p) => el('pacote', { projeto: p.projeto, nome: p.nome, versaoInstalada: p.instalada, tipo: p.tipo }))),
      el('inconsistencias', {}, [
        ...d.secoesFaltando.map((s) => el('secaoNaoEncontrada', { tecnologia: s.tecnologia, arquivo: s.arquivo, secao: s.secao })),
        ...d.ausentes.map((p) => el('pacoteAusente', { tecnologia: p.tecnologia, projeto: p.projeto, nome: p.nome })),
      ]),
    ]
  );
  return xmlDocument(root, 'Relatório técnico do Fiscalize: workflow Relatório técnico (.github/workflows/relatorio-tecnico.yml)');
}

// ---------- Sumário do job ----------

function summary(d) {
  const issues = d.secoesFaltando.length + d.ausentes.length;
  return [
    `## ${issues ? '🟡' : '🟢'} Relatório técnico do projeto`,
    '',
    `${d.tecnologias.length} tecnologias documentadas · ${d.api.length} rotas da API · ${d.dados.modelos.length} tabelas · ${d.telas.length} telas · ${d.testes?.total ?? '—'} testes · ${d.workflows.length} workflows`,
    '',
    '| Disciplina | Tecnologias |',
    '|---|---|',
    ...Object.entries(DISCIPLINAS).map(([k, v]) => `| ${v.nome} | ${d.tecnologias.filter((t) => t.disciplinas.includes(k)).length} |`),
    '',
    issues ? `⚠️ ${plural(issues, 'inconsistência', 'inconsistências')} entre o mapa de tecnologias e a documentação; veja o relatório.` : 'Mapa de tecnologias e documentação consistentes.',
    d.semDocumentacao.length ? `${plural(d.semDocumentacao.length, 'dependência', 'dependências')} sem seção na documentação (lista no relatório).` : '',
    '',
    'O relatório (`relatorio-tecnico-projeto.html`) e os dados (`tecnologias.xml`) estão no artefato `relatorio-tecnico-projeto` desta execução.',
    '',
  ].join('\n');
}

const data = analyze();
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'relatorio-tecnico-projeto.html'), html(data));
writeFileSync(path.join(OUT, 'tecnologias.xml'), xml(data));
const markdown = summary(data);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else process.stdout.write(markdown);
for (const s of data.secoesFaltando) console.log(`::warning::${s.tecnologia}: seção ${s.secao} não encontrada em ${s.arquivo}`);
for (const p of data.ausentes) console.log(`::warning::${p.tecnologia}: pacote ${p.nome} não está no ${p.projeto}/package.json`);
