// Escreve no sumário do job (GITHUB_STEP_SUMMARY) o resultado do npm audit de cada projeto:
// vulnerabilidades por gravidade e, para as críticas e altas, o pacote, o aviso e se há correção.
//
// Uso: node deps-summary.mjs <pasta-dos-relatorios> projeto...
// Lê <pasta>/audit-<projeto>.json (npm audit --json) e <pasta>/sbom-<projeto>.cdx.json (npm sbom).
// Só informa: não falha o job, mas anota um aviso quando há vulnerabilidade crítica.

import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SEVERITIES = [
  ['critical', '🔴 Críticas'],
  ['high', '🟠 Altas'],
  ['moderate', '🟡 Moderadas'],
  ['low', '⚪ Baixas'],
];
const MAX_LISTED = 15;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null; // arquivo ausente, vazio ou cortado: o projeto aparece como indisponível
  }
}
const escapeCell = (text) => String(text).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function describeFix(fix) {
  if (!fix) return '—';
  if (fix === true) return '`npm audit fix`';
  return `${fix.name}@${fix.version}${fix.isSemVerMajor ? ' ⚠️ major' : ''}`;
}

// "via" mistura avisos (objetos com título e link) e nomes de pacotes que puxam a vulnerabilidade
function describeAdvisory(vulnerability) {
  const advisory = vulnerability.via.find((via) => typeof via === 'object');
  if (advisory) return `[${escapeCell(advisory.title)}](${advisory.url})`;
  return `via ${vulnerability.via.map((via) => `\`${via}\``).join(', ')}`;
}

const [dir, ...projects] = process.argv.slice(2);
const rows = [];
const details = [];
let critical = 0;

for (const project of projects) {
  const audit = readJson(join(dir, `audit-${project}.json`));
  const sbom = readJson(join(dir, `sbom-${project}.cdx.json`));
  const total = sbom?.components?.length ?? audit?.metadata?.dependencies?.total ?? '—';

  if (!audit?.metadata) {
    rows.push(`| ❔ | ${project} | ${total} | ${SEVERITIES.map(() => '—').join(' | ')} |`);
    details.push(`> ⚠️ ${project}: auditoria indisponível${audit?.error ? ` (${escapeCell(audit.error.summary)})` : ''}.`, '');
    continue;
  }

  const counts = audit.metadata.vulnerabilities;
  critical += counts.critical;
  const icon = counts.critical || counts.high ? '❌' : counts.moderate ? '⚠️' : '✅';
  rows.push(`| ${icon} | ${project} | ${total} | ${SEVERITIES.map(([key]) => counts[key] || 0).join(' | ')} |`);

  const serious = Object.values(audit.vulnerabilities || {})
    .filter((v) => v.severity === 'critical' || v.severity === 'high')
    .sort((a, b) => (a.severity === b.severity ? Number(b.isDirect) - Number(a.isDirect) : a.severity === 'critical' ? -1 : 1));
  if (!serious.length) continue;

  details.push(
    `<details><summary>${project}: ${serious.length} pacotes com vulnerabilidade crítica ou alta</summary>`,
    '',
    '| Pacote | Gravidade | Direta | Aviso | Correção |',
    '|---|---|---|---|---|',
    ...serious
      .slice(0, MAX_LISTED)
      .map(
        (v) =>
          `| \`${v.name}\` ${escapeCell(v.range)} | ${v.severity === 'critical' ? '🔴' : '🟠'} ${v.severity} | ` +
          `${v.isDirect ? 'sim' : 'não'} | ${describeAdvisory(v)} | ${describeFix(v.fixAvailable)} |`
      ),
    ...(serious.length > MAX_LISTED ? [`| _…e mais ${serious.length - MAX_LISTED}_ | | | | |`] : []),
    '',
    '</details>',
    ''
  );
}

const markdown = [
  '### 🛡️ Dependências (npm audit)',
  '',
  `| | Projeto | Dependências | ${SEVERITIES.map(([, label]) => label).join(' | ')} |`,
  `|---|---|---:|${SEVERITIES.map(() => '---:').join('|')}|`,
  ...rows,
  '',
  ...details,
  '<sub>A lista completa de dependências (SBOM CycloneDX) e o JSON de cada auditoria estão no artefato <code>dependencias</code>.</sub>',
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else process.stdout.write(markdown);

if (critical) console.log(`::warning::${critical} vulnerabilidade(s) crítica(s) nas dependências; veja o sumário da execução`);
