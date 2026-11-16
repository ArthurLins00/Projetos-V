#!/usr/bin/env node
// Sobe o ambiente de desenvolvimento local com um comando (npm run dev:local na raiz):
//
//   1. cria backend/.env e ai-agent/.env a partir dos modelos, se ainda não existirem (nunca sobrescreve);
//   2. instala as dependências de cada pacote que ainda não tiver node_modules;
//   3. sobe PostgreSQL e Redis do compose.yaml (Docker), só os que ainda não respondem na porta;
//   4. aplica as migrações e o seed do backend;
//   5. roda o backend (porta 3000), o agente de IA (porta 3333, só com GEMINI_API_KEY) e o Metro do app.
//
// Opções:
//   --setup-only   faz os passos 1 a 4 e sai
//   --no-docker    não mexe no Docker (use com um PostgreSQL já rodando)
//   --no-mobile    não inicia o Metro (só backend + agente)
//   --no-ai        não inicia o agente de IA
//   --no-seed      pula o seed
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';
const npx = isWindows ? 'npx.cmd' : 'npx';

const color = { backend: '\x1b[36m', ai: '\x1b[35m', mobile: '\x1b[32m', setup: '\x1b[33m', reset: '\x1b[0m' };
const log = (tag, msg) => console.log(`${color[tag] ?? ''}[${tag}]${color.reset} ${msg}`);

function run(tag, cmd, cmdArgs, cwd) {
  log(tag, `${cmd} ${cmdArgs.join(' ')}`);
  const result = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) {
    log(tag, `falhou (código ${result.status}). Corrija o erro acima e rode de novo.`);
    process.exit(result.status ?? 1);
  }
}

// Lê as variáveis não comentadas de um .env (sem depender do dotenv na raiz).
function readEnv(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// 1. Arquivos .env
for (const pkg of ['backend', 'ai-agent']) {
  const target = join(root, pkg, '.env');
  if (!existsSync(target)) {
    copyFileSync(join(root, pkg, '.env.example'), target);
    log('setup', `${pkg}/.env criado a partir do ${pkg}/.env.example (revise os valores).`);
  }
}

// 2. Dependências
for (const pkg of ['backend', 'ai-agent', 'mobile']) {
  if (!existsSync(join(root, pkg, 'node_modules'))) run('setup', npm, ['install'], join(root, pkg));
}

// 3. PostgreSQL + Redis: só sobe no Docker o que ainda não estiver respondendo na porta (ex.: PostgreSQL instalado
// no Windows). Sem Docker, segue sem Redis, que é opcional (as métricas só ficam sem cache).
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

const backendDir = join(root, 'backend');
const backendEnv = readEnv(join(backendDir, '.env'));
const dbPort = Number((backendEnv.DATABASE_URL ?? '').match(/@[^:/]+:(\d+)\//)?.[1] ?? 5432);
let redisUrl = backendEnv.REDIS_URL;

if (!args.has('--no-docker')) {
  const services = [];
  if (await isPortOpen(dbPort)) log('setup', `PostgreSQL já responde na porta ${dbPort}; usando esse banco.`);
  else services.push('postgres');
  if (await isPortOpen(6379)) log('setup', 'Redis já responde na porta 6379.');
  else services.push('redis');

  const dockerOk = services.length === 0 || spawnSync('docker', ['info'], { stdio: 'ignore', shell: isWindows }).status === 0;
  if (services.length && dockerOk) {
    run('setup', 'docker', ['compose', 'up', '-d', '--wait', ...services], root);
  } else if (services.includes('postgres')) {
    log('setup', `Nenhum PostgreSQL na porta ${dbPort} e o Docker não está rodando. Abra o Docker Desktop ou inicie o PostgreSQL.`);
    process.exit(1);
  } else if (services.length) {
    log('setup', 'Docker não está rodando: seguindo sem Redis (opcional).');
  }
  if (!redisUrl && (await isPortOpen(6379))) redisUrl = 'redis://localhost:6379';
}

// 4. Banco do backend
run('setup', npx, ['prisma', 'generate'], backendDir);
run('setup', npx, ['prisma', 'migrate', 'deploy'], backendDir);
if (!args.has('--no-seed')) run('setup', npm, ['run', 'seed'], backendDir);

if (args.has('--setup-only')) {
  log('setup', 'Ambiente pronto. Rode "npm run dev:local" para subir os serviços.');
  process.exit(0);
}

// 5. Serviços
const children = [];

function start(tag, cwd, scriptArgs, { env = {}, interactive = false } = {}) {
  const child = spawn(npm, scriptArgs, {
    cwd,
    env: { ...process.env, ...env },
    shell: isWindows,
    stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (!interactive) {
    const prefix = (stream, out) => {
      let buffer = '';
      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop();
        for (const line of lines) out.write(`${color[tag]}[${tag}]${color.reset} ${line}\n`);
      });
    };
    prefix(child.stdout, process.stdout);
    prefix(child.stderr, process.stderr);
  }
  child.on('exit', (code) => log(tag, `encerrado (código ${code}).`));
  children.push(child);
  return child;
}

// Um backend ou agente que já esteja rodando (outro terminal) ocupa a porta; nesse caso reaproveita o que está no ar.
const backendPort = Number(process.env.PORT || backendEnv.PORT || 3000);
if (await isPortOpen(backendPort)) {
  log('backend', `a porta ${backendPort} já está em uso: usando o backend que já está rodando (feche-o para iniciar este).`);
} else {
  // Com um Redis no ar, o backend usa o cache de métricas mesmo que o REDIS_URL esteja comentado no .env.
  start('backend', backendDir, ['run', 'dev'], { env: redisUrl ? { REDIS_URL: redisUrl } : {} });
}

const aiEnv = readEnv(join(root, 'ai-agent', '.env'));
const aiKey = aiEnv.GEMINI_API_KEY ?? '';
const aiPort = Number(process.env.AI_AGENT_PORT || aiEnv.AI_AGENT_PORT || 3333);
if (args.has('--no-ai')) {
  log('ai', 'pulado (--no-ai).');
} else if (await isPortOpen(aiPort)) {
  log('ai', `a porta ${aiPort} já está em uso: usando o agente que já está rodando.`);
} else if (!aiKey || aiKey === 'coloque_sua_chave_aqui') {
  log('ai', 'pulado: defina GEMINI_API_KEY em ai-agent/.env para usar o assistente no app.');
} else {
  start('ai', join(root, 'ai-agent'), ['run', 'dev:local']);
}

if (args.has('--no-mobile')) {
  log('mobile', 'pulado (--no-mobile).');
} else {
  // O Metro fica com o terminal (QR code e atalhos: a = Android, r = recarregar).
  start('mobile', join(root, 'mobile'), ['run', 'dev:local'], { interactive: true });
}

log('setup', `API em http://localhost:${backendPort} (Swagger em /docs). Ctrl+C encerra tudo.`);

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (isWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGINT');
  }
  process.exit(0);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
