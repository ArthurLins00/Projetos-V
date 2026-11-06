// Mantém UMA issue aberta com as pendências de segurança, a partir do issue.md / issue.json gerados por
// render-security.mjs (workflow seguranca-diaria.yml):
//   - há itens e não existe issue aberta   → cria, com a label "segurança", a milestone de Segurança e o responsável;
//   - há itens e a issue já existe          → atualiza título e corpo; comenta só se algum item apareceu ou sumiu;
//   - não há itens                          → comenta que está tudo resolvido e fecha a issue.
// Assim a equipe recebe um aviso quando algo muda, e não uma issue nova por dia com o mesmo conteúdo.
// A issue é reconhecida pelo marcador <!-- seguranca-diaria ... --> no corpo.
//
// Uso: node .github/scripts/security/sync-issue.mjs [--report security-report] [--repo dono/repo]
//        [--assignee victorsimasdev] [--dry-run]
// Precisa do gh autenticado (GH_TOKEN) com permissão issues: write. --dry-run só lê e mostra o que faria.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const REPORT = opt('--report', 'security-report');
const REPO = opt('--repo', process.env.GITHUB_REPOSITORY);
const ASSIGNEE = opt('--assignee', 'victorsimasdev');
const DRY = args.includes('--dry-run');
const LABEL = 'segurança';
const MILESTONE = 'SEG · Segurança da Informação';
const MARKER = '<!-- seguranca-diaria';

if (!REPO) {
  console.error('Informe o repositório com --repo dono/repo (ou GITHUB_REPOSITORY).');
  process.exit(2);
}

const report = JSON.parse(readFileSync(join(REPORT, 'issue.json'), 'utf8'));
const markdown = readFileSync(join(REPORT, 'issue.md'), 'utf8');

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const tmp = mkdtempSync(join(tmpdir(), 'seguranca-'));
const bodyFile = (text, name) => {
  const file = join(tmp, name);
  writeFileSync(file, text);
  return file;
};
function act(description, ...a) {
  console.log(`${DRY ? '[dry-run] ' : ''}${description}`);
  if (!DRY) return gh(...a);
  return '';
}

// "vuln:backend:glob:moderate" → texto legível para os comentários
const SEV = { critical: 'crítica', high: 'alta', moderate: 'moderada', low: 'baixa' };
function describe(key) {
  const [kind, ...rest] = key.split(':');
  switch (kind) {
    case 'vuln': return `biblioteca \`${rest[1]}\` (${rest[0]}, ${SEV[rest[2]] ?? rest[2]})`;
    case 'segredo': return `possível segredo em \`${rest[1]}:${rest[2]}\` (${rest[0]})`;
    case 'historico': return `possível segredo no histórico: \`${rest[1]}\`, commit \`${rest[3]}\``;
    case 'sast': return `padrão inseguro em \`${rest[1]}:${rest[2]}\``;
    case 'controle': return `controle ${rest[0]} (${rest[1]})`;
    case 'nao-executado': return `verificação não executada: ${rest.join(':')}`;
    default: return key;
  }
}

const title = report.total
  ? `[SEG] Segurança diária: ${report.total} ${report.total === 1 ? 'item' : 'itens'} a tratar`
  : '[SEG] Segurança diária: nada pendente';
const body = `${markdown}${MARKER} itens:${JSON.stringify(report.itens)} -->\n`;
const runLink = report.execucao ? `[execução](${report.execucao})` : 'execução local';

const open = JSON.parse(gh('issue', 'list', '--repo', REPO, '--state', 'open', '--label', LABEL, '--limit', '50', '--json', 'number,body,title,assignees'))
  .filter((i) => i.body?.includes(MARKER));
const existing = open[0];

if (!report.total) {
  if (!existing) {
    console.log('Nada pendente e nenhuma issue aberta: nada a fazer.');
  } else {
    act(`Comenta e fecha a issue #${existing.number}`, 'issue', 'comment', String(existing.number), '--repo', REPO, '--body-file',
      bodyFile(`✅ Nenhum item de segurança pendente na ${runLink}. Fechando a issue; se algo voltar a aparecer, uma nova será aberta.`, 'close.md'));
    act(`Fecha a issue #${existing.number}`, 'issue', 'close', String(existing.number), '--repo', REPO, '--reason', 'completed');
  }
  process.exit(0);
}

if (!existing) {
  act(`Garante a label "${LABEL}"`, 'label', 'create', LABEL, '--repo', REPO, '--color', 'B60205', '--description', 'Pendências apontadas pelo workflow Segurança diária', '--force');
  const base = ['issue', 'create', '--repo', REPO, '--title', title, '--body-file', bodyFile(body, 'body.md'), '--label', LABEL, '--assignee', ASSIGNEE];
  try {
    const url = act(`Cria a issue "${title}" para ${ASSIGNEE} na milestone ${MILESTONE}`, ...base, '--milestone', MILESTONE);
    if (url) console.log(url.trim());
  } catch {
    // Milestone renomeada ou inexistente: cria sem ela, em vez de perder o aviso
    const url = act(`Cria a issue "${title}" sem milestone`, ...base);
    if (url) console.log(url.trim());
  }
  process.exit(0);
}

const previous = (() => {
  try {
    return JSON.parse(existing.body.match(/<!-- seguranca-diaria itens:(\[.*?\]) -->/)?.[1] ?? '[]');
  } catch {
    return [];
  }
})();
const added = report.itens.filter((k) => !previous.includes(k));
const removed = previous.filter((k) => !report.itens.includes(k));

act(`Atualiza título e corpo da issue #${existing.number}`, 'issue', 'edit', String(existing.number), '--repo', REPO, '--title', title, '--body-file', bodyFile(body, 'body.md'));
if (!existing.assignees?.some((a) => a.login === ASSIGNEE)) {
  act(`Atribui a issue #${existing.number} a ${ASSIGNEE}`, 'issue', 'edit', String(existing.number), '--repo', REPO, '--add-assignee', ASSIGNEE);
}
if (added.length || removed.length) {
  const lines = [`🔄 Mudanças na ${runLink} (${report.total} ${report.total === 1 ? 'item pendente' : 'itens pendentes'}):`, ''];
  if (added.length) lines.push(`**Novos (${added.length}):**`, ...added.map((k) => `- ${describe(k)}`), '');
  if (removed.length) lines.push(`**Resolvidos (${removed.length}):**`, ...removed.map((k) => `- ${describe(k)}`), '');
  lines.push(`@${ASSIGNEE}, o corpo da issue tem o que fazer em cada item.`);
  act(`Comenta na issue #${existing.number}: ${added.length} novos, ${removed.length} resolvidos`, 'issue', 'comment', String(existing.number), '--repo', REPO, '--body-file', bodyFile(lines.join('\n'), 'comment.md'));
} else {
  console.log(`Issue #${existing.number}: mesmos itens da execução anterior; corpo atualizado, sem comentário.`);
}
