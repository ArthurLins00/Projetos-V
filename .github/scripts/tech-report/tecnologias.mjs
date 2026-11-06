// Mapa das tecnologias do Fiscalize para o relatório técnico (render-tech-report.mjs).
// O texto (como foi usada, por quê, alternativas descartadas) NÃO fica aqui: vem das seções dos READMEs de
// docs/<disciplina>/, que continuam sendo a fonte única. Este arquivo só liga cada tecnologia a:
//   fontes    seções dos READMEs onde ela é explicada ({ d: disciplina, secao: '3.1' ou título exato })
//   pacotes   pacotes npm por projeto; versão vem do package-lock e "onde é usado" dos imports
//   apoio     pacotes auxiliares contados como documentados, mas sem seção própria
//   builtin   módulos nativos do Node procurados nos imports (ex.: 'crypto')
//   caminhos  arquivos ou pastas que mostram o uso quando não há import (configuração, YAML, Docker)
// Ao documentar uma tecnologia nova num README, acrescente-a aqui; dependências fora deste mapa aparecem
// no relatório como "sem seção na documentação".

export const DISCIPLINAS = {
  mob: { pasta: 'desenvolvimento-mobile', nome: 'Desenvolvimento Mobile' },
  seg: { pasta: 'seguranca-da-informacao', nome: 'Segurança da Informação' },
  neg: { pasta: 'negocios-na-internet', nome: 'Negócios na Internet' },
  dados: { pasta: 'engenharia-de-dados', nome: 'Engenharia e Ciência de Dados e Big Data' },
  test: { pasta: 'testes-automatizados', nome: 'Testes Automatizados' },
  proj: { pasta: 'projeto-5', nome: 'Projeto 5' },
  ia: { pasta: 'ia-aplicada', nome: 'IA Aplicada' },
};

// Pastas de código de cada projeto (onde os imports são procurados) e onde ficam package.json e lock
export const PROJETOS = {
  backend: { dir: 'backend', fontes: ['backend/src', 'backend/prisma'] },
  mobile: { dir: 'mobile', fontes: ['mobile/src', 'mobile/app'] },
  'ai-agent': { dir: 'ai-agent', fontes: ['ai-agent/src', 'ai-agent/tests', 'ai-agent/scripts'] },
  raiz: { dir: '.', fontes: ['e2e', 'playwright.config.ts'] },
};

export const CATEGORIAS = ['Aplicativo mobile', 'Backend e API', 'Dados', 'Segurança', 'Inteligência artificial', 'Testes e qualidade', 'Infraestrutura e processo'];

export const TECNOLOGIAS = [
  // ---------- Aplicativo mobile ----------
  {
    id: 'react-native-expo', nome: 'React Native + Expo', categoria: 'Aplicativo mobile',
    fontes: [{ d: 'mob', secao: '3.1' }, { d: 'neg', secao: '3.2' }],
    pacotes: { mobile: ['expo', 'react-native', 'react'] },
    apoio: { mobile: ['react-dom', 'expo-constants', 'expo-device', 'expo-font', 'expo-linking', 'expo-status-bar', 'expo-system-ui', 'expo-build-properties', 'react-native-safe-area-context', 'react-native-screens', '@expo/vector-icons'] },
  },
  {
    id: 'typescript', nome: 'TypeScript', categoria: 'Aplicativo mobile',
    fontes: [{ d: 'mob', secao: '3.2' }],
    pacotes: { backend: ['typescript'], mobile: ['typescript'], 'ai-agent': ['typescript'] },
    apoio: { backend: ['ts-node-dev'] },
    caminhos: ['backend/tsconfig.json', 'mobile/tsconfig.json', 'ai-agent/tsconfig.json'],
  },
  { id: 'expo-router', nome: 'Expo Router', categoria: 'Aplicativo mobile', fontes: [{ d: 'mob', secao: '3.3' }], pacotes: { mobile: ['expo-router'] } },
  { id: 'context-api', nome: 'Context API + hooks', categoria: 'Aplicativo mobile', fontes: [{ d: 'mob', secao: '3.4' }], caminhos: ['mobile/src/contexts', 'mobile/src/viewmodels'] },
  { id: 'expo-secure-store', nome: 'expo-secure-store', categoria: 'Aplicativo mobile', fontes: [{ d: 'mob', secao: '3.5' }, { d: 'seg', secao: '3.6' }], pacotes: { mobile: ['expo-secure-store'] } },
  { id: 'axios', nome: 'axios', categoria: 'Aplicativo mobile', fontes: [{ d: 'mob', secao: '3.6' }], pacotes: { mobile: ['axios'], backend: ['axios'] } },
  {
    id: 'recursos-dispositivo', nome: 'expo-location, expo-camera e expo-image-picker', categoria: 'Aplicativo mobile',
    fontes: [{ d: 'mob', secao: '3.7' }], pacotes: { mobile: ['expo-location', 'expo-camera', 'expo-image-picker'] },
  },
  { id: 'mapa', nome: 'react-native-webview + Leaflet + OpenStreetMap', categoria: 'Aplicativo mobile', fontes: [{ d: 'mob', secao: '3.8' }], pacotes: { mobile: ['react-native-webview'] } },
  {
    id: 'notificacoes', nome: 'expo-notifications + Expo Push API', categoria: 'Aplicativo mobile',
    fontes: [{ d: 'mob', secao: '3.9' }], pacotes: { mobile: ['expo-notifications'] }, caminhos: ['backend/src/services/notificationService.ts'],
  },
  { id: 'eas', nome: 'EAS Build', categoria: 'Aplicativo mobile', fontes: [{ d: 'mob', secao: '3.10' }], caminhos: ['mobile/eas.json'] },

  // ---------- Backend e API ----------
  {
    id: 'express', nome: 'Node.js + Express 5', categoria: 'Backend e API',
    fontes: [{ d: 'mob', secao: '3.11' }, { d: 'neg', secao: '3.3' }],
    pacotes: { backend: ['express', 'cors', 'cookie-parser'] },
    apoio: { backend: ['dotenv', 'cross-env', 'uuid'], 'ai-agent': ['dotenv'] },
  },
  {
    id: 'prisma', nome: 'Prisma ORM', categoria: 'Backend e API',
    fontes: [{ d: 'mob', secao: '3.12' }], pacotes: { backend: ['@prisma/client', '@prisma/adapter-pg', 'prisma'] }, caminhos: ['backend/prisma/schema.prisma'],
  },
  { id: 'nodemailer', nome: 'nodemailer (SMTP)', categoria: 'Backend e API', fontes: [{ d: 'mob', secao: '3.13' }], pacotes: { backend: ['nodemailer'] } },
  { id: 'swagger', nome: 'Swagger UI (OpenAPI)', categoria: 'Backend e API', fontes: [{ d: 'mob', secao: '3.14' }], caminhos: ['backend/src/config/swagger.ts'] },

  // ---------- Dados ----------
  {
    id: 'postgresql', nome: 'PostgreSQL', categoria: 'Dados',
    fontes: [{ d: 'dados', secao: '3.1' }, { d: 'neg', secao: '3.3' }], pacotes: { backend: ['pg'] }, caminhos: ['backend/prisma/migrations', 'compose.yaml'],
  },
  { id: 'etl', nome: 'Pipeline ETL em TypeScript', categoria: 'Dados', fontes: [{ d: 'dados', secao: '3.2' }], caminhos: ['backend/src/etl', 'backend/src/scripts/runMetricsEtl.ts'] },
  { id: 'node-cron', nome: 'node-cron', categoria: 'Dados', fontes: [{ d: 'dados', secao: '3.3' }], pacotes: { backend: ['node-cron'] } },
  { id: 'redis', nome: 'Redis (ioredis)', categoria: 'Dados', fontes: [{ d: 'dados', secao: '3.4' }], pacotes: { backend: ['ioredis'] } },

  // ---------- Segurança ----------
  { id: 'bcrypt', nome: 'bcrypt (bcryptjs e bcrypt)', categoria: 'Segurança', fontes: [{ d: 'seg', secao: '3.1' }], pacotes: { backend: ['bcryptjs', 'bcrypt'] } },
  { id: 'jwt', nome: 'JWT HS256 (jsonwebtoken)', categoria: 'Segurança', fontes: [{ d: 'seg', secao: '3.2' }], pacotes: { backend: ['jsonwebtoken'] } },
  {
    id: 'node-crypto', nome: 'node:crypto (CSPRNG, SHA-256, comparação em tempo constante)', categoria: 'Segurança',
    fontes: [{ d: 'seg', secao: '3.3' }, { d: 'seg', secao: '3.4' }], builtin: { backend: ['crypto'], 'ai-agent': ['crypto'] },
  },

  // ---------- Inteligência artificial ----------
  {
    id: 'gemini', nome: 'Google Gemini (@google/genai)', categoria: 'Inteligência artificial',
    fontes: [{ d: 'ia', secao: '3.1' }, { d: 'neg', secao: '3.5' }], pacotes: { 'ai-agent': ['@google/genai'] },
  },
  { id: 'function-calling', nome: 'Function calling com ferramentas em TypeScript', categoria: 'Inteligência artificial', fontes: [{ d: 'ia', secao: '3.2' }], caminhos: ['ai-agent/src/tools'] },
  { id: 'model-client', nome: 'Interface ModelClient', categoria: 'Inteligência artificial', fontes: [{ d: 'ia', secao: '3.3' }], caminhos: ['ai-agent/src/agent.ts', 'ai-agent/src/llm'] },
  { id: 'cota-gemini', nome: 'Controle de cota e nova tentativa', categoria: 'Inteligência artificial', fontes: [{ d: 'ia', secao: '3.4' }], caminhos: ['ai-agent/src/llm/geminiClient.ts'] },
  { id: 'node-http', nome: 'Servidor HTTP com node:http', categoria: 'Inteligência artificial', fontes: [{ d: 'ia', secao: '3.5' }], builtin: { 'ai-agent': ['http'] } },
  { id: 'tsx', nome: 'tsx', categoria: 'Inteligência artificial', fontes: [{ d: 'ia', secao: '3.6' }], pacotes: { 'ai-agent': ['tsx'] } },

  // ---------- Testes e qualidade ----------
  { id: 'jest', nome: 'Jest + ts-jest', categoria: 'Testes e qualidade', fontes: [{ d: 'test', secao: '4.1' }], pacotes: { backend: ['jest', 'ts-jest'] }, caminhos: ['backend/jest.config.ts', 'backend/src/tests'] },
  { id: 'jest-mock-extended', nome: 'jest-mock-extended', categoria: 'Testes e qualidade', fontes: [{ d: 'test', secao: '4.2' }], pacotes: { backend: ['jest-mock-extended'] } },
  { id: 'supertest', nome: 'Supertest', categoria: 'Testes e qualidade', fontes: [{ d: 'test', secao: '4.3' }], pacotes: { backend: ['supertest'] } },
  { id: 'playwright', nome: 'Playwright', categoria: 'Testes e qualidade', fontes: [{ d: 'test', secao: '4.4' }], pacotes: { raiz: ['@playwright/test'] } },
  { id: 'maestro', nome: 'Maestro', categoria: 'Testes e qualidade', fontes: [{ d: 'test', secao: '4.5' }], caminhos: ['mobile/e2e'] },
  { id: 'node-test', nome: 'node:test + cliente roteirizado', categoria: 'Testes e qualidade', fontes: [{ d: 'test', secao: '4.6' }], builtin: { 'ai-agent': ['test'] } },
  { id: 'scripts-pipeline', nome: 'Scripts Node de métricas e manutenção da TAS', categoria: 'Testes e qualidade', fontes: [{ d: 'test', secao: '4.8' }], caminhos: ['.github/scripts'] },

  // ---------- Infraestrutura e processo ----------
  { id: 'github-actions', nome: 'GitHub Actions', categoria: 'Infraestrutura e processo', fontes: [{ d: 'test', secao: '4.7' }], caminhos: ['.github/workflows'] },
  { id: 'docker', nome: 'Docker e Docker Compose', categoria: 'Infraestrutura e processo', fontes: [{ d: 'mob', secao: 'Docker e Docker Compose' }], caminhos: ['compose.yaml', 'backend/Dockerfile', 'ai-agent/Dockerfile'] },
  {
    id: 'git-github', nome: 'Git e GitHub (forks, pull requests e templates)', categoria: 'Infraestrutura e processo',
    fontes: [{ d: 'proj', secao: '4.1' }, { d: 'proj', secao: '4.3' }], caminhos: ['.github/pull_request_template.md', '.github/ISSUE_TEMPLATE'],
  },
];
