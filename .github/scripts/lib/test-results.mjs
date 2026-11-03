// Leitura dos resultados de teste da pipeline em um formato único: { suite, name, status, time, message }.
// Aceita o JSON do Jest (--json --outputFile) e JUnit XML (Node test runner, Playwright, Maestro).
// Usado pelo sumário de cada job (test-summary.mjs) e pelo relatório de qualidade (quality/).

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

export const decode = (text) =>
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

export function relativePath(file) {
  const normalized = file.replace(/\\/g, '/');
  const index = normalized.search(/\/(src|tests|e2e)\//);
  return index >= 0 ? normalized.slice(index + 1) : basename(normalized);
}

export function fromJest(report) {
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

export function fromJUnit(xml) {
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

export function load(file) {
  const content = readFileSync(file, 'utf8');
  return content.trimStart().startsWith('{') ? fromJest(JSON.parse(content)) : fromJUnit(content);
}
