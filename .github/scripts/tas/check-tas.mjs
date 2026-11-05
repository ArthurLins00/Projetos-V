// Verificações automáticas da política de manutenção da TAS (docs/tas.md, seção 7).
//
//   node .github/scripts/tas/check-tas.mjs              verificação do PR e do push (falha só nos erros)
//   node .github/scripts/tas/check-tas.mjs --json out   também grava o resultado em JSON (revisão e quarentena)
//
// Erros (reprovam o job "Política da TAS" e, com ele, o Quality Gate):
//   - teste com .only (esconderia o resto da suíte);
//   - teste desligado (.skip, .fixme, xit, xdescribe ou fluxo em mobile/e2e/pending) sem registro em
//     .github/tas/quarentena.json;
//   - arquivo de teste que não aparece no catálogo do TESTES.md (rastreabilidade);
//   - teste sem o caso do plano no título ([TC-xx]), caso inexistente no plano ou
//     docs/testes/catalogo-testes.json desatualizado (test-catalog.mjs);
//   - registro de quarentena malformado ou apontando para arquivo que não existe.
// Avisos (aparecem no sumário, não reprovam): quarentena vencida, sem issue ou apontando para teste que
// voltou a rodar (registro esquecido).
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { checkCatalog } from './test-catalog.mjs';

const ROOT = process.cwd();
const REGISTRY = '.github/tas/quarentena.json';
const CATALOG = 'TESTES.md';
const MAX_QUARANTINE_DAYS = 14;

// Onde ficam os testes de cada suíte da TAS
const SUITES = [
  { dir: 'backend/src/tests', match: /\.test\.ts$/ },
  { dir: 'e2e', match: /\.spec\.ts$/ },
  { dir: 'ai-agent/tests', match: /\.test\.ts$/ },
  { dir: 'mobile/e2e', match: /\.yaml$/, ignore: /(^|\/)(subflows\/|config\.yaml$)/ },
];

const DISABLED = /\b(?:it|test|describe)\.(skip|fixme)\b|\bx(?:it|describe|test)\s*\(/;
const FOCUSED = /\b(?:it|test|describe)\.only\b/;

const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function testFiles() {
  return SUITES.flatMap(({ dir, match, ignore }) =>
    walk(path.join(ROOT, dir))
      .map(rel)
      .filter((file) => match.test(file) && !(ignore && ignore.test(file.slice(dir.length + 1))))
  );
}

function daysBetween(from, to) {
  return Math.floor((to - from) / 86_400_000);
}

export function check({ today = new Date() } = {}) {
  const errors = [];
  const warnings = [];
  const files = testFiles();
  const catalog = readFileSync(path.join(ROOT, CATALOG), 'utf8');

  let registry = [];
  try {
    registry = JSON.parse(readFileSync(path.join(ROOT, REGISTRY), 'utf8'));
    if (!Array.isArray(registry)) throw new Error('o arquivo deve conter uma lista');
  } catch (error) {
    errors.push(`${REGISTRY}: ${error.message}`);
    registry = [];
  }

  // 1. Testes focados e desligados
  const disabled = [];
  for (const file of files) {
    if (file.startsWith('mobile/e2e/pending/')) {
      disabled.push({ file, line: 1, kind: 'pending' });
      continue;
    }
    readFileSync(path.join(ROOT, file), 'utf8')
      .split(/\r?\n/)
      .forEach((text, i) => {
        if (FOCUSED.test(text)) errors.push(`${file}:${i + 1}: teste com .only esconde o restante da suíte`);
        const match = text.match(DISABLED);
        if (match) disabled.push({ file, line: i + 1, kind: match[1] || 'x' });
      });
  }

  for (const item of disabled) {
    const entry = registry.find((r) => r.arquivo === item.file);
    if (!entry) {
      errors.push(`${item.file}:${item.line}: teste desligado sem registro em ${REGISTRY} (política, seção 5)`);
    }
  }

  // 2. Registros de quarentena
  const quarantine = registry.map((entry, i) => {
    const where = `${REGISTRY}[${i}]`;
    for (const field of ['arquivo', 'teste', 'motivo', 'classificacao', 'desde', 'expira']) {
      if (!entry[field]) errors.push(`${where}: campo obrigatório "${field}" ausente`);
    }
    if (entry.arquivo && !existsSync(path.join(ROOT, entry.arquivo))) {
      errors.push(`${where}: arquivo ${entry.arquivo} não existe (remova o registro ou corrija o caminho)`);
    }
    const desde = new Date(entry.desde);
    const expira = new Date(entry.expira);
    const status = [];
    if (Number.isNaN(desde.getTime()) || Number.isNaN(expira.getTime())) {
      errors.push(`${where}: "desde" e "expira" devem ser datas AAAA-MM-DD`);
    } else {
      if (daysBetween(desde, expira) > MAX_QUARANTINE_DAYS && !entry.prorrogacao) {
        warnings.push(`${where} (${entry.arquivo}): quarentena maior que ${MAX_QUARANTINE_DAYS} dias sem "prorrogacao" justificada`);
      }
      if (expira < today) {
        status.push('vencida');
        warnings.push(`${where} (${entry.arquivo}): quarentena vencida em ${entry.expira}; corrigir, prorrogar com justificativa ou propor a remoção`);
      }
    }
    if (!entry.issue) {
      status.push('sem issue');
      warnings.push(`${where} (${entry.arquivo}): quarentena sem issue de acompanhamento`);
    }
    if (entry.arquivo && !disabled.some((d) => d.file === entry.arquivo)) {
      status.push('teste voltou a rodar');
      warnings.push(`${where} (${entry.arquivo}): o teste não está mais desligado; feche a issue e remova o registro`);
    }
    return { ...entry, status };
  });

  // 3. Rastreabilidade: todo arquivo de teste aparece no catálogo
  for (const file of files) {
    if (!catalog.includes(path.posix.basename(file))) {
      errors.push(`${file}: não aparece no catálogo do ${CATALOG} (seção 3); registre os casos com ID`);
    }
  }

  // 4. Rastreabilidade por teste: [TC-xx] no título e catálogo em JSON em dia
  const traceability = checkCatalog();
  errors.push(...traceability.errors);

  return { files: files.length, tests: traceability.tests, tagged: traceability.tagged, disabled, quarantine, errors, warnings };
}

function summary(result) {
  const lines = [
    '## Política da TAS',
    '',
    `| Verificação | Resultado |`,
    `|---|---|`,
    `| Arquivos de teste no catálogo | ${result.files - result.errors.filter((e) => e.includes('catálogo')).length}/${result.files} |`,
    `| Testes com o caso do plano no título | ${result.tagged}/${result.tests} |`,
    `| Testes desligados | ${result.disabled.length} (${result.quarantine.length} em quarentena registrada) |`,
    `| Erros | ${result.errors.length} |`,
    `| Avisos | ${result.warnings.length} |`,
    '',
  ];
  if (result.errors.length) lines.push('### ❌ Erros', '', ...result.errors.map((e) => `- ${e}`), '');
  if (result.warnings.length) lines.push('### ⚠️ Avisos', '', ...result.warnings.map((w) => `- ${w}`), '');
  return lines.join('\n');
}

if (process.argv[1]?.endsWith('check-tas.mjs')) {
  const result = check();
  const jsonAt = process.argv.indexOf('--json');
  if (jsonAt > -1) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(result, null, 2));

  const text = summary(result);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  for (const error of result.errors) console.log(`::error::${error}`);
  for (const warning of result.warnings) console.log(`::warning::${warning}`);
  process.exitCode = result.errors.length ? 1 : 0;
}
