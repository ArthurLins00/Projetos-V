// Escreve no sumário do job (GITHUB_STEP_SUMMARY) o resultado de uma suíte de testes: totais,
// falhas com a mensagem, cobertura, arquivos e testes mais lentos.
//
// Uso: node test-summary.mjs --title "Backend · Testes unitários" [--coverage coverage-summary.json]
//        [--junit saida.xml] relatorio...
// Aceita o JSON do Jest (--json --outputFile) e JUnit XML (Node test runner, Playwright, Maestro).
// --junit grava os resultados também em JUnit XML (o Jest não tem esse formato sem dependência extra).
// Sem GITHUB_STEP_SUMMARY, imprime na saída padrão. Nunca falha o job: o resultado dos testes já faz isso.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

const MAX_FAILURES = 15;
const MAX_MESSAGE_LINES = 30;
const SLOWEST = 5;

const ANSI = /\x1b\[[0-9;]*m/g;

function parseArgs(argv) {
  const args = { title: 'Testes', coverage: null, junit: null, files: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--title') args.title = argv[++i];
    else if (argv[i] === '--coverage') args.coverage = argv[++i];
    else if (argv[i] === '--junit') args.junit = argv[++i];
    else args.files.push(argv[i]);
  }
  return args;
}

const decode = (text) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

const attr = (attrs, name) => {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decode(match[1]) : '';
};

function relativePath(file) {
  const normalized = file.replace(/\\/g, '/');
  const index = normalized.search(/\/(src|tests|e2e)\//);
  return index >= 0 ? normalized.slice(index + 1) : basename(normalized);
}

function fromJest(report) {
  const tests = [];
  for (const file of report.testResults || []) {
    const suite = relativePath(file.name);
    for (const t of file.assertionResults || []) {
      tests.push({
        suite,
        name: t.fullName || [...(t.ancestorTitles || []), t.title].join(' › '),
        status: t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped',
        time: (t.duration || 0) / 1000,
        message: (t.failureMessages || []).join('\n'),
      });
    }
    // Arquivo que nem chegou a rodar (erro de compilação, import quebrado)
    if (file.status === 'failed' && !(file.assertionResults || []).length) {
      tests.push({ suite, name: 'Falha ao carregar o arquivo de teste', status: 'failed', time: 0, message: file.message || '' });
    }
  }
  return tests;
}

function fromJUnit(xml) {
  const tests = [];
  const suites = [];
  const tokens = /<testsuite\b([^>]*?)(\/?)>|<\/testsuite>|<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const match of xml.matchAll(tokens)) {
    const [token, suiteAttrs, selfClosing, caseAttrs, body = ''] = match;
    if (token.startsWith('</testsuite')) suites.pop();
    else if (token.startsWith('<testsuite')) {
      if (!selfClosing) suites.push(attr(suiteAttrs, 'name'));
    } else {
      const failure = body.match(/<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/);
      const skipped = /<skipped\b/.test(body);
      const classname = attr(caseAttrs, 'classname');
      tests.push({
        suite: suites.filter(Boolean).join(' › ') || (classname !== 'test' ? classname : '') || '—',
        name: attr(caseAttrs, 'name'),
        status: failure ? 'failed' : skipped ? 'skipped' : 'passed',
        time: Number(attr(caseAttrs, 'time')) || 0,
        message: failure ? [attr(failure[2], 'message'), decode(failure[3] || '')].filter(Boolean).join('\n') : '',
      });
    }
  }
  return tests;
}

function load(file) {
  const content = readFileSync(file, 'utf8');
  return content.trimStart().startsWith('{') ? fromJest(JSON.parse(content)) : fromJUnit(content);
}

const seconds = (value) =>
  value >= 60
    ? `${Math.floor(value / 60)}min ${Math.round(value % 60)}s`
    : value >= 1
      ? `${value.toFixed(1)}s`
      : `${Math.round(value * 1000)}ms`;
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const escapeCell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const fence = (text) => text.replace(/```/g, '``​`');

function trimMessage(message) {
  const workspace = (process.env.GITHUB_WORKSPACE || process.cwd()).replace(/\\/g, '/');
  const lines = message
    .replace(ANSI, '')
    .replace(/\[cause\]:[\s\S]*$/, '') // o Jest repete o mesmo erro como causa
    .replace(/\\/g, '/')
    .split(workspace + '/')
    .join('')
    .split(/\r?\n/);
  // A pilha do Jest repete caminhos internos do node_modules; o começo da mensagem é o que importa
  const useful = lines.filter((line) => !/node_modules\//.test(line));
  const kept = useful.slice(0, MAX_MESSAGE_LINES);
  if (useful.length > kept.length) kept.push(`… (${useful.length - kept.length} linhas omitidas)`);
  return kept.join('\n').trim();
}

function coverageSection(file) {
  if (!file || !existsSync(file)) return '';
  const { total } = JSON.parse(readFileSync(file, 'utf8'));
  const icon = (pct) => (pct >= 80 ? '🟢' : pct >= 60 ? '🟡' : '🔴');
  const cell = ({ pct, covered, total: all }) => `${icon(pct)} **${pct.toFixed(1)}%** <sub>${covered}/${all}</sub>`;
  return [
    '#### Cobertura',
    '',
    '| Linhas | Funções | Branches | Statements |',
    '|---|---|---|---|',
    `| ${cell(total.lines)} | ${cell(total.functions)} | ${cell(total.branches)} | ${cell(total.statements)} |`,
    '',
  ].join('\n');
}

function render(title, tests, coverageFile, missing) {
  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed');
  const skipped = tests.filter((t) => t.status === 'skipped').length;
  const duration = tests.reduce((sum, t) => sum + t.time, 0);
  const ok = !failed.length && tests.length > 0 && !missing.length;

  const out = [`### ${ok ? '✅' : '❌'} ${title}`, ''];

  if (missing.length) {
    out.push(`> ⚠️ Relatório não gerado: ${missing.map((f) => `\`${f}\``).join(', ')}. O passo pode ter falhado antes dos testes rodarem.`, '');
  }
  if (!tests.length) return out.join('\n');

  out.push(
    `**${plural(tests.length, 'teste', 'testes')}** · ✅ ${plural(passed, 'passou', 'passaram')} · ` +
      `❌ ${plural(failed.length, 'falhou', 'falharam')} · ⏭️ ${plural(skipped, 'pulado', 'pulados')} · ⏱️ ${seconds(duration)}`,
    ''
  );

  if (failed.length) {
    out.push('#### Falhas', '');
    for (const t of failed.slice(0, MAX_FAILURES)) {
      out.push(
        `<details><summary>❌ <b>${escapeCell(t.name)}</b> <code>${escapeCell(t.suite)}</code></summary>`,
        '',
        '```',
        fence(trimMessage(t.message) || '(sem mensagem)'),
        '```',
        '</details>',
        ''
      );
    }
    if (failed.length > MAX_FAILURES) out.push(`_…e mais ${failed.length - MAX_FAILURES} falhas; veja o log do passo._`, '');
  }

  out.push(coverageSection(coverageFile));

  const bySuite = new Map();
  for (const t of tests) {
    const entry = bySuite.get(t.suite) || { total: 0, failed: 0, time: 0 };
    entry.total++;
    entry.failed += t.status === 'failed' ? 1 : 0;
    entry.time += t.time;
    bySuite.set(t.suite, entry);
  }
  out.push(
    `<details><summary>📁 Suítes (${bySuite.size})</summary>`,
    '',
    '| | Suíte | Testes | Falhas | Tempo |',
    '|---|---|---:|---:|---:|',
    ...[...bySuite]
      .sort(([, a], [, b]) => b.failed - a.failed || b.time - a.time)
      .map(([suite, s]) => `| ${s.failed ? '❌' : '✅'} | ${escapeCell(suite)} | ${s.total} | ${s.failed} | ${seconds(s.time)} |`),
    '',
    '</details>',
    ''
  );

  const slowest = [...tests].sort((a, b) => b.time - a.time).slice(0, SLOWEST);
  out.push(
    `<details><summary>🐢 ${slowest.length} testes mais lentos</summary>`,
    '',
    '| Teste | Suíte | Tempo |',
    '|---|---|---:|',
    ...slowest.map((t) => `| ${escapeCell(t.name)} | ${escapeCell(t.suite)} | ${seconds(t.time)} |`),
    '',
    '</details>',
    ''
  );

  return out.join('\n');
}

const xmlEscape = (text) =>
  String(text)
    // Caracteres de controle (fora tab e quebras de linha) são inválidos em XML 1.0
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function toJUnit(title, tests) {
  const bySuite = new Map();
  for (const t of tests) bySuite.set(t.suite, [...(bySuite.get(t.suite) || []), t]);

  const count = (list, status) => list.filter((t) => t.status === status).length;
  const time = (list) => list.reduce((sum, t) => sum + t.time, 0).toFixed(3);

  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="${xmlEscape(title)}" tests="${tests.length}" failures="${count(tests, 'failed')}" ` +
      `skipped="${count(tests, 'skipped')}" time="${time(tests)}">`,
  ];
  for (const [suite, list] of bySuite) {
    out.push(
      `  <testsuite name="${xmlEscape(suite)}" tests="${list.length}" failures="${count(list, 'failed')}" ` +
        `skipped="${count(list, 'skipped')}" errors="0" time="${time(list)}">`
    );
    for (const t of list) {
      const open = `    <testcase name="${xmlEscape(t.name)}" classname="${xmlEscape(suite)}" time="${t.time.toFixed(3)}"`;
      if (t.status === 'passed') out.push(`${open}/>`);
      else if (t.status === 'skipped') out.push(`${open}>`, '      <skipped/>', '    </testcase>');
      else {
        const message = t.message.replace(ANSI, '');
        out.push(
          `${open}>`,
          `      <failure message="${xmlEscape(message.split('\n')[0])}">${xmlEscape(message)}</failure>`,
          '    </testcase>'
        );
      }
    }
    out.push('  </testsuite>');
  }
  out.push('</testsuites>', '');
  return out.join('\n');
}

try {
  const { title, coverage, junit, files } = parseArgs(process.argv.slice(2));
  const missing = files.filter((file) => !existsSync(file));
  const tests = files.filter((file) => existsSync(file)).flatMap(load);

  if (junit && tests.length) {
    mkdirSync(dirname(junit), { recursive: true });
    writeFileSync(junit, toJUnit(title, tests));
  }

  const markdown = `${render(title, tests, coverage, missing)}\n`;

  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  else process.stdout.write(markdown);
} catch (error) {
  console.log(`::warning::Não foi possível montar o sumário dos testes: ${error.message}`);
}
