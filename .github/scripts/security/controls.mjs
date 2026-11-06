// Verificação automática dos controles de segurança descritos em docs/seguranca-da-informacao/README.md
// (seções 3 e 4). Cada controle procura no código a evidência de que está implementado e explica o resultado
// em linguagem simples para o relatório. Não substitui revisão: confirma que o que a documentação promete
// continua no código e aponta o que ainda está só especificado.
//
//   ok     o controle está no código
//   aviso  ausente, mas especificado para produção ou de risco baixo (não é uma falha hoje)
//   falha  um controle documentado como implementado sumiu ou foi enfraquecido
//
// Uso: import { checkControls } from './controls.mjs'  ou  node controls.mjs (imprime em JSON)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.expo', 'tests', '__mocks__', 'android', 'ios']);
const SOURCE = /\.(ts|tsx|js|mjs)$/;

function walk(dir) {
  const full = path.join(ROOT, dir);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [dir];
  return readdirSync(full).flatMap((name) => (IGNORED_DIRS.has(name) ? [] : walk(path.posix.join(dir, name))));
}

const read = (file) => (existsSync(path.join(ROOT, file)) ? readFileSync(path.join(ROOT, file), 'utf8') : '');

// Todas as ocorrências de um padrão nos fontes de uma ou mais pastas: [{ file, line, text }]
function grep(dirs, pattern) {
  const hits = [];
  // Arquivo citado diretamente entra sempre; dentro de pastas, só código-fonte
  const files = [dirs].flat().flatMap((d) => {
    const full = path.join(ROOT, d);
    if (existsSync(full) && statSync(full).isFile()) return [d];
    return walk(d).filter((f) => SOURCE.test(f));
  });
  for (const file of files) {
    read(file)
      .split(/\r?\n/)
      .forEach((text, i) => {
        if (pattern.test(text)) hits.push({ file, line: i + 1, text: text.trim().slice(0, 160) });
      });
  }
  return hits;
}

const ev = (hits, max = 3) => hits.slice(0, max).map(({ file, line }) => ({ file, line }));

function trackedEnvFiles() {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .split('\n')
      .filter((f) => /(^|\/)\.env(\.[^/]+)?$/.test(f) && !f.endsWith('.env.example'));
  } catch {
    return [];
  }
}

const BACKEND = 'backend/src';
const AUTH = ['backend/src/services/authService.ts', 'backend/src/services/adminService.ts'];
const DOC = 'docs/seguranca-da-informacao/README.md';

export function checkControls() {
  const controls = [];
  const add = (c) => controls.push({ referencia: DOC, ...c });

  // ---------- Autenticação e sessão ----------
  const bcryptHash = grep(BACKEND, /bcrypt\.hash\(/);
  const weakHash = grep(AUTH, /createHash\(['"](md5|sha1)['"]\)/);
  add({
    id: 'SEC-01', area: 'Autenticação', titulo: 'Senhas guardadas com bcrypt', asvs: 'ASVS V2.4',
    status: bcryptHash.length && !weakHash.length ? 'ok' : 'falha',
    evidencias: ev(bcryptHash.length ? bcryptHash : weakHash),
    explicacao: bcryptHash.length && !weakHash.length
      ? 'As senhas passam pelo bcrypt (hash lento e com sal) antes de irem para o banco; um vazamento da tabela não revela as senhas.'
      : 'Não foi encontrado o bcrypt no cadastro de senhas, ou há MD5/SHA-1 no serviço de autenticação. Senhas precisam de hash lento com sal.',
  });

  const env = read('backend/src/config/env.ts');
  const requiresSecret = /requireEnv\(['"]JWT_SECRET['"]\)/.test(env);
  add({
    id: 'SEC-02', area: 'Autenticação', titulo: 'Chave dos tokens obrigatória', asvs: 'ASVS V6.4',
    status: requiresSecret ? 'ok' : 'falha',
    evidencias: ev(grep('backend/src/config/env.ts', /JWT_SECRET/)),
    explicacao: requiresSecret
      ? 'O servidor não sobe sem JWT_SECRET, então nunca roda com uma chave padrão conhecida.'
      : 'JWT_SECRET deixou de ser obrigatória: o servidor poderia assinar tokens com uma chave previsível.',
  });

  const expiration = env.match(/JWT_EXPIRATION\s*=\s*process\.env\.JWT_EXPIRATION\s*\|\|\s*['"](\d+)([smhd])['"]/);
  const minutes = expiration ? Number(expiration[1]) * { s: 1 / 60, m: 1, h: 60, d: 1440 }[expiration[2]] : null;
  add({
    id: 'SEC-03', area: 'Autenticação', titulo: 'Access token de vida curta', asvs: 'ASVS V3.3',
    status: minutes !== null && minutes <= 60 ? 'ok' : 'falha',
    evidencias: ev(grep('backend/src/config/env.ts', /JWT_EXPIRATION/)),
    explicacao: minutes !== null && minutes <= 60
      ? `O token de acesso expira em ${expiration[1]}${expiration[2]} por padrão; um token roubado deixa de valer rápido.`
      : 'A validade padrão do token de acesso não foi encontrada ou passa de 1 hora.',
  });

  const tokenHash = grep('backend/prisma/schema.prisma', /tokenhash/).length && /hashRefreshToken/.test(read(AUTH[0]));
  add({
    id: 'SEC-04', area: 'Autenticação', titulo: 'Refresh token guardado só como hash', asvs: 'ASVS V3.5',
    status: tokenHash ? 'ok' : 'falha',
    evidencias: ev(grep([AUTH[0]], /hashRefreshToken/)),
    explicacao: tokenHash
      ? 'O banco guarda apenas o SHA-256 do refresh token; quem copiar a tabela não consegue abrir sessões.'
      : 'Não foi encontrada a gravação do refresh token como hash.',
  });

  const constantTime = grep([AUTH[0], 'ai-agent/src/server.ts'], /timingSafeEqual\(/);
  add({
    id: 'SEC-05', area: 'Autenticação', titulo: 'Comparação de códigos e segredos em tempo constante', asvs: 'ASVS V2.7',
    status: constantTime.length >= 2 ? 'ok' : 'falha',
    evidencias: ev(constantTime),
    explicacao: constantTime.length >= 2
      ? 'Códigos de 2FA, de recuperação e o segredo backend↔agente são comparados com timingSafeEqual, o que impede descobrir o valor medindo o tempo de resposta.'
      : 'A comparação em tempo constante não foi encontrada no serviço de autenticação ou no agente.',
  });

  const insecureRandomAuth = grep([...AUTH, 'ai-agent/src/server.ts'], /Math\.random\(/);
  const insecureRandomOther = grep([BACKEND, 'ai-agent/src'], /Math\.random\(/).filter((h) => !AUTH.includes(h.file));
  add({
    id: 'SEC-06', area: 'Autenticação', titulo: 'Números aleatórios seguros na autenticação', asvs: 'ASVS V6.3',
    status: insecureRandomAuth.length ? 'falha' : insecureRandomOther.length ? 'aviso' : 'ok',
    evidencias: ev(insecureRandomAuth.length ? insecureRandomAuth : insecureRandomOther),
    explicacao: insecureRandomAuth.length
      ? 'Math.random aparece no código de autenticação; ele é previsível e não serve para códigos, tokens ou segredos.'
      : insecureRandomOther.length
        ? 'A autenticação usa só o gerador seguro do node:crypto. Math.random aparece em outros pontos do backend (nomes de arquivo, sufixo de protocolo); não protege segredo, mas trocar por randomInt deixaria os protocolos menos previsíveis.'
        : 'Todo valor aleatório do backend e do agente vem do gerador seguro do node:crypto.',
  });

  // ---------- Aplicativo ----------
  const secureStore = grep('mobile/src', /SecureStore\.setItemAsync\(/);
  const asyncStorage = grep(['mobile/src', 'mobile/app'], /AsyncStorage/);
  add({
    id: 'SEC-07', area: 'Aplicativo', titulo: 'Tokens no armazenamento seguro do aparelho', asvs: 'MASVS STORAGE-1',
    status: secureStore.length && !asyncStorage.length ? 'ok' : asyncStorage.length ? 'falha' : 'aviso',
    evidencias: ev(asyncStorage.length ? asyncStorage : secureStore),
    explicacao: secureStore.length && !asyncStorage.length
      ? 'O app guarda os tokens no SecureStore (Android Keystore / iOS Keychain), cifrados pelo sistema operacional.'
      : 'O app usa AsyncStorage, que grava em texto puro. Tokens e dados de sessão devem ir para o SecureStore.',
  });

  const cleartext = grep('mobile/app.json', /"usesCleartextTraffic"\s*:\s*true/);
  add({
    id: 'SEC-08', area: 'Aplicativo', titulo: 'App aceita só conexões HTTPS', asvs: 'MASVS NETWORK-1',
    status: cleartext.length ? 'aviso' : 'ok',
    evidencias: ev(cleartext),
    explicacao: cleartext.length
      ? 'O APK aceita HTTP sem TLS (usesCleartextTraffic) para falar com o backend local nas demonstrações. Antes de publicar, use uma URL HTTPS e remova essa opção.'
      : 'O app só aceita conexões HTTPS.',
  });

  // ---------- API ----------
  const cors = read('backend/src/config/cors.ts');
  const wildcard = /origin\s*:\s*(['"]\*['"]|true)/.test(cors);
  add({
    id: 'SEC-09', area: 'API', titulo: 'CORS por lista de origens', asvs: 'ASVS V14.5',
    status: !wildcard && /getAllowedOrigins/.test(cors) ? 'ok' : 'falha',
    evidencias: ev(grep('backend/src/config/cors.ts', /origin/)),
    explicacao: !wildcard
      ? 'Só origens da lista ALLOWED_ORIGINS (obrigatória em produção) podem chamar a API pelo navegador.'
      : 'O CORS aceita qualquer origem: um site qualquer poderia chamar a API com as credenciais do usuário.',
  });

  const demoBlocked = /DEMO_MODE\s*&&\s*isProduction/.test(env);
  add({
    id: 'SEC-10', area: 'API', titulo: 'Modo de demonstração proibido em produção', asvs: 'ASVS V14.1',
    status: demoBlocked ? 'ok' : 'falha',
    evidencias: ev(grep('backend/src/config/env.ts', /DEMO_MODE/)),
    explicacao: demoBlocked
      ? 'O servidor se recusa a subir com DEMO_MODE em produção; o modo que devolve o código do 2FA nunca chega ao usuário real.'
      : 'Não foi encontrado o bloqueio do DEMO_MODE em produção.',
  });

  const magic = grep(BACKEND, /detectImageExtension\(/).filter((h) => !h.file.endsWith('image.ts'));
  const bodyLimit = grep('backend/src/app.ts', /express\.json\(/);
  add({
    id: 'SEC-11', area: 'API', titulo: 'Uploads validados e corpo das requisições limitado', asvs: 'ASVS V12.1',
    status: magic.length && bodyLimit.length ? 'ok' : 'falha',
    evidencias: ev([...magic, ...bodyLimit]),
    explicacao: magic.length && bodyLimit.length
      ? 'As fotos só são aceitas se os primeiros bytes forem de JPEG ou PNG reais, e o tamanho do corpo é limitado (15 MB nas rotas de foto, 100 KB nas demais).'
      : 'A validação de imagem por assinatura de bytes ou o limite de corpo não foram encontrados.',
  });

  const rawUnsafe = grep(BACKEND, /\$(queryRawUnsafe|executeRawUnsafe)\(/);
  add({
    id: 'SEC-12', area: 'API', titulo: 'Sem SQL montado por texto', asvs: 'ASVS V5.3',
    status: rawUnsafe.length ? 'falha' : 'ok',
    evidencias: ev(rawUnsafe),
    explicacao: rawUnsafe.length
      ? 'Há consultas com $queryRawUnsafe/$executeRawUnsafe, que aceitam SQL concatenado e abrem espaço para injeção.'
      : 'Todo acesso ao banco passa pelo Prisma com consultas parametrizadas; não há SQL montado por concatenação.',
  });

  const minPassword = [...read('backend/src/controllers/authController.ts').matchAll(/(?:senha|novaSenha)\.length\s*<\s*(\d+)/g)].map((m) => Number(m[1]));
  const weakest = minPassword.length ? Math.min(...minPassword) : null;
  add({
    id: 'SEC-13', area: 'API', titulo: 'Senha com no mínimo 8 caracteres', asvs: 'ASVS V2.1',
    status: weakest !== null && weakest >= 8 ? 'ok' : 'aviso',
    evidencias: ev(grep('backend/src/controllers/authController.ts', /(?:senha|novaSenha)\.length\s*</)),
    explicacao: weakest !== null && weakest >= 8
      ? `O backend exige senhas com pelo menos ${weakest} caracteres.`
      : `A Atividade 1 especifica 8+ caracteres com 4 classes; o backend aceita hoje a partir de ${weakest ?? '?'} caracteres.`,
  });

  const helmet = grep(BACKEND, /from ['"]helmet['"]|require\(['"]helmet['"]\)/);
  add({
    id: 'SEC-14', area: 'API', titulo: 'Cabeçalhos de segurança HTTP (helmet)', asvs: 'ASVS V14.4',
    status: helmet.length ? 'ok' : 'aviso',
    evidencias: ev(helmet),
    explicacao: helmet.length
      ? 'A API envia cabeçalhos de segurança (HSTS, X-Content-Type-Options, X-Frame-Options) pelo helmet.'
      : 'Especificado na Atividade 4 e ainda não implementado. O impacto é baixo para o app nativo, mas a API deveria enviar os cabeçalhos antes de ir a produção.',
  });

  const rateLimit = grep(BACKEND, /rate-?limit|rateLimit/i);
  add({
    id: 'SEC-15', area: 'API', titulo: 'Limite de requisições (rate limiting)', asvs: 'ASVS V11.1',
    status: rateLimit.length ? 'ok' : 'aviso',
    evidencias: ev(rateLimit),
    explicacao: rateLimit.length
      ? 'As rotas têm limite de requisições por cliente.'
      : 'Especificado nas Atividades 3 e 4 e ainda não implementado. O 2FA e a recuperação de senha já limitam tentativas, mas o login e as demais rotas não têm limite por IP.',
  });

  // ---------- Segredos e configuração ----------
  const envFiles = trackedEnvFiles();
  add({
    id: 'SEC-16', area: 'Configuração', titulo: 'Nenhum arquivo .env versionado', asvs: 'ASVS V14.3',
    status: envFiles.length ? 'falha' : 'ok',
    evidencias: envFiles.map((file) => ({ file, line: 1 })),
    explicacao: envFiles.length
      ? 'Há arquivos .env no repositório. Eles costumam ter senhas e chaves; remova-os do Git e troque os segredos expostos.'
      : 'Só os modelos .env.example estão no repositório; os segredos reais ficam fora do Git.',
  });

  const agentHost = /AI_AGENT_HOST\s*=\s*process\.env\.AI_AGENT_HOST\?\.trim\(\)\s*\|\|\s*['"]127\.0\.0\.1['"]/.test(read('ai-agent/src/config.ts'));
  add({
    id: 'SEC-17', area: 'Configuração', titulo: 'Agente de IA fechado para a rede por padrão', asvs: 'ASVS V14.2',
    status: agentHost ? 'ok' : 'aviso',
    evidencias: ev(grep('ai-agent/src/config.ts', /AI_AGENT_HOST/)),
    explicacao: agentHost
      ? 'Fora do Docker o agente só escuta em 127.0.0.1; no compose ele fica na rede interna, sem porta publicada.'
      : 'O agente escuta em todas as interfaces por padrão; qualquer máquina da rede poderia chamar o /chat.',
  });

  return controls;
}

if (process.argv[1]?.endsWith('controls.mjs')) {
  process.stdout.write(JSON.stringify(checkControls(), null, 2) + '\n');
}
