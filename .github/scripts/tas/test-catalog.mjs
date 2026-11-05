// Catálogo de testes em formato de dados (docs/tas.md, seção 8.5).
//
//   node .github/scripts/tas/test-catalog.mjs           confere: todo teste com TC no título e o JSON em dia
//   node .github/scripts/tas/test-catalog.mjs --write   regenera docs/testes/catalogo-testes.json
//
// Cada teste leva no próprio título o identificador do caso do plano de testes, entre colchetes no início:
// `it('[TC-01] login gera um JWT ...')`, ou `[TC-03, TC-05]` quando cobre mais de um caso. Nos fluxos Maestro o
// identificador vai no `name:` do cabeçalho. O vínculo com a HU vem da tabela de casos do plano
// (docs/testes/Template_Plano_de_Testes_e_Backlog.md, seção 4.6), então renomear ou mover um teste não desfaz
// a rastreabilidade: o catálogo é gerado de novo a partir dos títulos.
//
// Sem dependências: roda no job "Política da TAS" antes de qualquer npm install.
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
export const CATALOG_JSON = 'docs/testes/catalogo-testes.json';
const PLAN = 'docs/testes/Template_Plano_de_Testes_e_Backlog.md';

export const SUITES = [
  { id: 'unit', name: 'Unitários (Jest)', dir: 'backend/src/tests/unit', match: /\.test\.ts$/ },
  { id: 'api', name: 'API (Jest + Supertest)', dir: 'backend/src/tests/api', match: /\.test\.ts$/ },
  { id: 'e2e-api', name: 'E2E da API (Playwright)', dir: 'e2e', match: /\.spec\.ts$/ },
  { id: 'e2e-telas', name: 'E2E de telas (Maestro)', dir: 'mobile/e2e', match: /\.yaml$/, ignore: /(^|\/)(subflows\/|config\.yaml$)/ },
  { id: 'agente-ia', name: 'Agente de IA (node --test)', dir: 'ai-agent/tests', match: /\.test\.ts$/ },
];

const TC = /\bTC-\d{2,}\b/g;
const TAG = /^\[(TC-\d{2,}(?:,\s*TC-\d{2,})*)\]\s/;

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// ---------- Leitura dos títulos ----------

// Pula um literal de string ou template a partir de `i` (aspas de abertura) e devolve o índice após o fechamento
function skipString(src, i) {
  const quote = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') j++;
    else if (quote === '`' && src[j] === '$' && src[j + 1] === '{') j = matchClose(src, j + 1);
    else if (src[j] === quote) return j + 1;
  }
  return src.length;
}

// Índice do fechamento que casa com o `(`, `[` ou `{` em `i`, ignorando strings e comentários
function matchClose(src, i) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [pairs[src[i]]];
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "'" || c === '"' || c === '`') j = skipString(src, j) - 1;
    else if (c === '/' && src[j + 1] === '/') j = src.indexOf('\n', j) === -1 ? src.length : src.indexOf('\n', j);
    else if (c === '/' && src[j + 1] === '*') j = src.indexOf('*/', j + 2) + 1;
    else if (pairs[c]) stack.push(pairs[c]);
    else if (c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return j;
    }
  }
  return src.length;
}

// Lê o literal em `i` e devolve o texto (templates mantêm o `${...}` como está)
function readLiteral(src, i) {
  const end = skipString(src, i);
  return src.slice(i + 1, end - 1).replace(/\\(['"`\\])/g, '$1');
}

const CALL = /\b(describe|it|test)((?:\.(?:skip|only|fixme|serial|todo|describe))*)(\.each)?\s*\(/g;

export function parseSource(src) {
  const calls = [];
  for (const m of src.matchAll(CALL)) {
    const before = src.slice(Math.max(0, m.index - 1), m.index);
    if (/[\w.$]/.test(before)) continue; // obj.it(...), xit(...)
    let open = m.index + m[0].length - 1;
    if (m[3]) {
      // it.each([...])('título', ...)
      const close = matchClose(src, open);
      const next = src.slice(close + 1).match(/^\s*\(/);
      if (!next) continue;
      open = close + 1 + next[0].length - 1;
    }
    let k = open + 1;
    while (/\s/.test(src[k])) k++;
    if (!["'", '"', '`'].includes(src[k])) continue;
    const kind = m[1] === 'describe' || m[2].includes('.describe') ? 'describe' : 'test';
    calls.push({
      kind,
      title: readLiteral(src, k),
      each: !!m[3],
      start: m.index,
      at: k,
      end: matchClose(src, open),
      line: src.slice(0, m.index).split('\n').length,
      modifiers: m[2],
    });
  }
  return calls
    .filter((call) => call.kind === 'test')
    .map((call) => ({
      title: call.title,
      describe: calls
        .filter((d) => d.kind === 'describe' && d.start < call.start && d.end > call.start)
        .map((d) => d.title),
      line: call.line,
      offset: call.at,
      each: call.each,
      disabled: /\.(skip|fixme|todo)/.test(call.modifiers),
    }));
}

function parseMaestro(src, file) {
  const header = src.split(/^---\s*$/m)[0];
  const name = header.match(/^name:\s*["']?(.*?)["']?\s*$/m)?.[1];
  return [{ title: name ?? path.posix.basename(file, '.yaml'), describe: [], line: 1, each: false, disabled: file.includes('/pending/') }];
}

export function collectTests() {
  return SUITES.flatMap((suite) =>
    walk(path.join(ROOT, suite.dir))
      .map(rel)
      .filter((file) => suite.match.test(file) && !(suite.ignore && suite.ignore.test(file.slice(suite.dir.length + 1))))
      .sort()
      .flatMap((file) => {
        const src = readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
        const tests = suite.id === 'e2e-telas' ? parseMaestro(src, file) : parseSource(src);
        return tests.map((t) => ({ suite: suite.id, file, ...t, casos: [...new Set(t.title.match(TC) ?? [])] }));
      })
  );
}

// ---------- Plano de testes ----------

export function loadPlan() {
  const plan = readFileSync(path.join(ROOT, PLAN), 'utf8');
  const cases = new Map();
  for (const line of plan.split(/\r?\n/)) {
    const cols = line.split('|').map((c) => c.trim().replace(/^`|`$/g, ''));
    // Tabela da seção 4.6: | ID | HU | CA | Título | Pré-condições | Passos | Resultado esperado | Pós-condições |
    if (cols.length >= 9 && /^TC-\d+$/.test(cols[1]) && cols[4] && !cases.has(cols[1]) && !/^[`\d]/.test(cols[4])) {
      cases.set(cols[1], { hu: /^HU-\d+$/.test(cols[2]) ? cols[2] : null, titulo: cols[4] });
    }
  }
  return cases;
}

// ---------- Catálogo ----------

export function buildCatalog(tests = collectTests(), plan = loadPlan()) {
  const casos = {};
  for (const [id, info] of plan) casos[id] = { hu: info.hu, titulo: info.titulo, testes: 0, suites: [] };
  for (const t of tests) {
    for (const id of t.casos) {
      if (!casos[id]) continue;
      casos[id].testes++;
      if (!casos[id].suites.includes(t.suite)) casos[id].suites.push(t.suite);
    }
  }
  return {
    descricao:
      'Catálogo de testes automatizados do Fiscalize, gerado a partir dos títulos dos testes por .github/scripts/tas/test-catalog.mjs. Não edite à mão.',
    plano: PLAN,
    suites: Object.fromEntries(SUITES.map((s) => [s.id, { nome: s.name, pasta: s.dir, testes: tests.filter((t) => t.suite === s.id).length }])),
    total: tests.length,
    testes: tests.map((t) => ({
      suite: t.suite,
      arquivo: t.file,
      grupo: t.describe.join(' › ') || null,
      titulo: t.title.replace(TAG, ''),
      casos: t.casos,
      hus: [...new Set(t.casos.map((id) => plan.get(id)?.hu).filter(Boolean))],
      ...(t.each ? { parametrizado: true } : {}),
      ...(t.disabled ? { desligado: true } : {}),
    })),
    casos,
  };
}

export const serialize = (catalog) => `${JSON.stringify(catalog, null, 2)}\n`;

export function checkCatalog() {
  const errors = [];
  const tests = collectTests();
  const plan = loadPlan();
  for (const t of tests) {
    const where = `${t.file}:${t.line}`;
    if (!TAG.test(t.title)) errors.push(`${where}: título sem o caso do plano no início, ex.: "[TC-01] ${t.title.slice(0, 40)}" (rastreabilidade)`);
    for (const id of t.casos) if (!plan.has(id)) errors.push(`${where}: ${id} não existe na tabela de casos do plano (${PLAN}, seção 4.6)`);
  }
  const expected = serialize(buildCatalog(tests, plan));
  const current = existsSync(path.join(ROOT, CATALOG_JSON)) ? readFileSync(path.join(ROOT, CATALOG_JSON), 'utf8').replace(/\r\n/g, '\n') : null;
  if (current !== expected) {
    errors.push(`${CATALOG_JSON}: desatualizado; rode \`node .github/scripts/tas/test-catalog.mjs --write\` e faça commit`);
  }
  return { tests: tests.length, tagged: tests.filter((t) => TAG.test(t.title)).length, errors };
}

if (process.argv[1]?.endsWith('test-catalog.mjs')) {
  if (process.argv.includes('--write')) {
    const catalog = buildCatalog();
    writeFileSync(path.join(ROOT, CATALOG_JSON), serialize(catalog));
    console.log(`${CATALOG_JSON}: ${catalog.total} testes`);
  } else if (process.argv.includes('--list')) {
    for (const t of collectTests()) console.log(`${t.file}:${t.line}\t${t.title}`);
  } else {
    const result = checkCatalog();
    console.log(`Testes com o caso no título: ${result.tagged}/${result.tests}`);
    for (const error of result.errors) console.log(`::error::${error}`);
    process.exitCode = result.errors.length ? 1 : 0;
  }
}
