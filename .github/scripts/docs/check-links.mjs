// Verifica os links internos de todos os .md versionados: arquivo ou pasta de destino existe e, quando o link
// aponta para uma seção (#ancora), o título existe no documento de destino, com a mesma regra de âncoras do GitHub.
// Links externos (http, mailto) não são acessados: dependem de rede e quebrariam o CI por motivos alheios ao projeto.
// Sai com código 1 se houver link quebrado. Uso: node .github/scripts/docs/check-links.mjs

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const files = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !f.includes('node_modules/'));

// Âncora do GitHub: minúsculas, sem pontuação (letras, números, espaço, _ e - ficam), espaço vira hífen
export function slug(heading) {
  return heading
    .replace(/<[^>]+>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

// Linhas fora de blocos de código, com os trechos `inline` apagados (links ali dentro são exemplos)
function prose(text) {
  let fenced = false;
  return text.split(/\r?\n/).map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return '';
    }
    return fenced ? '' : line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length));
  });
}

const anchorCache = new Map();
function anchors(file) {
  if (!anchorCache.has(file)) {
    const set = new Set();
    const seen = new Map();
    for (const line of prose(readFileSync(file, 'utf8'))) {
      const heading = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
      if (heading) {
        const base = slug(heading[1]);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        set.add(n ? `${base}-${n}` : base);
      }
      for (const id of line.matchAll(/\b(?:id|name)="([^"]+)"/g)) set.add(id[1]);
    }
    anchorCache.set(file, set);
  }
  return anchorCache.get(file);
}

// Destino de cada link inline [texto](destino), respeitando parênteses dentro do caminho
function links(line) {
  const found = [];
  for (let i = line.indexOf(']('); i >= 0; i = line.indexOf('](', i + 2)) {
    let depth = 1;
    let j = i + 2;
    while (j < line.length && depth > 0) {
      if (line[j] === '(') depth++;
      else if (line[j] === ')') depth--;
      j++;
    }
    if (depth === 0) found.push(line.slice(i + 2, j - 1).trim().replace(/^<|>$/g, '').split(/\s+"/)[0]);
  }
  return found;
}

const broken = [];
let checked = 0;
for (const file of files) {
  prose(readFileSync(file, 'utf8')).forEach((line, index) => {
    for (const target of links(line)) {
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, https:, mailto:...
      checked++;
      const [rawPath, anchor] = target.split('#');
      let dest = file;
      if (rawPath) {
        let decoded = rawPath;
        try {
          decoded = decodeURI(rawPath);
        } catch {}
        dest = path.posix.normalize(path.posix.join(path.posix.dirname(file), decoded));
        if (!existsSync(dest)) {
          broken.push({ file, line: index + 1, target, motivo: 'arquivo ou pasta não existe' });
          continue;
        }
      }
      if (anchor && dest.endsWith('.md') && statSync(dest).isFile()) {
        let decoded = anchor;
        try {
          decoded = decodeURIComponent(anchor);
        } catch {}
        if (!anchors(dest).has(decoded.toLowerCase()) && !anchors(dest).has(decoded)) {
          broken.push({ file, line: index + 1, target, motivo: `seção #${decoded} não existe em ${dest}` });
        }
      }
    }
  });
}

const summary = [
  `## ${broken.length ? '❌' : '✅'} Links da documentação`,
  '',
  `${checked} links internos verificados em ${files.length} arquivos .md; ${broken.length} quebrados.`,
  '',
  ...(broken.length ? ['| Arquivo | Link | Problema |', '|---|---|---|', ...broken.map((b) => `| \`${b.file}:${b.line}\` | \`${b.target}\` | ${b.motivo} |`), ''] : []),
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
process.stdout.write(summary);
for (const b of broken) console.log(`::error file=${b.file},line=${b.line}::Link quebrado: ${b.target} (${b.motivo})`);
process.exit(broken.length ? 1 : 0);
