# Fiscalize

Aplicativo mobile para o cidadão **registrar e acompanhar problemas urbanos** (buracos, postes apagados,
vazamentos, sinalização…) e para os **gestores dos órgãos públicos** atenderem essas ocorrências.

O cidadão fotografa o problema, captura a localização pelo GPS e envia a ocorrência. O backend
encaminha a ocorrência ao órgão responsável pela categoria (ex.: *Água e Esgoto → COMPESA*) e o
cidadão acompanha o andamento pelo app até a resolução.

| | |
|---|---|
| **App** | React Native + Expo (SDK 58), somente **Android e iOS** |
| **Backend** | Node.js + Express + TypeScript + Prisma + PostgreSQL |
| **Testes** | Jest + Supertest (unitário e API), Playwright (E2E da API) e Maestro (E2E de telas) |

---

## Funcionalidades

- **Cadastro e login** com sessão persistente (continua logado ao reabrir o app).
- **Registrar ocorrência** com título, categoria, endereço, descrição, **localização por GPS**
  (preenche o endereço automaticamente) e **foto pela câmera**.
- **Listagem** das ocorrências com **pesquisa** por título, descrição, endereço ou protocolo,
  **filtros por status, categoria e região** (estado, cidade e zona), paginação e "puxar para atualizar".
- **Detalhe** da ocorrência com foto, coordenadas e histórico de alterações.
- **Editar e remover** a ocorrência enquanto ela ainda não está em andamento.
- **Assistente de IA** (balão 💬 na tela inicial): responde em linguagem natural sobre o status de
  um ou mais chamados, usando Gemini com function calling. O cidadão consulta só os próprios
  chamados; gestor e admin, todos. Detalhes em [`ai-agent/README.md`](ai-agent/README.md#integração-com-o-app-fiscalize).
- **Perfis:** Cidadão, Gestor e Admin, com permissões hierárquicas. Gestor e Admin veem a fila de todos os chamados
  e dão seguimento às ocorrências; o Admin também gerencia os perfis dos usuários.
- **Painel do gestor** com indicadores operacionais: total de demandas, concluídas, tempo médio de atendimento e
  distribuição por categoria.
- **Notificações** por push (Expo Notifications), e-mail e na tela a cada mudança de status do chamado.
- **Build empacotado** pelo EAS (APK de distribuição interna); passo a passo em [`mobile/README.md`](mobile/README.md#build-empacotado-eas).
  O APK mais recente está nas [Releases do GitHub](https://github.com/ArthurLins00/Projetos-V/releases/latest).

## Backend em produção

A API está no ar, com HTTPS (certificado Let's Encrypt emitido pelo Caddy), em
**<https://fiscalize.topsix.com.br>**. O APK das [Releases](https://github.com/ArthurLins00/Projetos-V/releases/latest)
já aponta para esse endereço (`EXPO_PUBLIC_API_URL` no ambiente `preview` do EAS).

| Endereço | O que mostra |
|---|---|
| <https://fiscalize.topsix.com.br/health> | Situação da API, do banco e do Redis |
| <https://fiscalize.topsix.com.br/docs> | Swagger com todas as rotas |

Como o servidor foi montado (VM com Docker Compose, Caddy e DNS): [`docs/deploy/README.md`](docs/deploy/README.md).

## Vídeo demonstrativo

Screencast do sistema completo integrado (cadastro/login → registro de demanda com foto e GPS →
acompanhamento e filtros → atualização de status pelo gestor → notificação ao cidadão):
**[Assistir ao screencast](https://drive.google.com/file/d/1UxmnVP3dmwVaOpgorn99INTy3fr8cSuq/view?usp=drive_link)**.

## Requisitos do projeto

| Requisito | Onde está |
|---|---|
| React Native com Expo, build só Android e iOS (sem web/PWA) | [`mobile/app.json`](mobile/app.json) (`"platforms": ["android", "ios"]`) |
| Arquitetura MVVM | [`mobile/src`](mobile/src): `models/`, `views/`, `viewmodels/`, `services/` |
| Integração com o backend | [`mobile/src/services`](mobile/src/services) (axios + JWT) → [`backend/`](backend) |
| GPS com Expo Location | [`useDemandFormViewModel.ts`](mobile/src/viewmodels/useDemandFormViewModel.ts) |
| Câmera com Expo Camera | [`CameraCapture.tsx`](mobile/src/components/CameraCapture.tsx) |
| CRUD de ocorrências (criar, pesquisar, atualizar, remover) | [`mobile/src/viewmodels`](mobile/src/viewmodels) + rotas `/demands` |
| Listagem com FlatList | [`DemandListView.tsx`](mobile/src/views/DemandListView.tsx) |
| Navegação com Expo Router | [`mobile/app`](mobile/app) (grupos `(auth)` e `(app)`, rotas protegidas) |
| Persistência de estado com `useState` e `useEffect` | [`AuthContext.tsx`](mobile/src/contexts/AuthContext.tsx) |
| Estado global: sessão com `useContext`, demandas e conexão com **Zustand** | [`AuthContext.tsx`](mobile/src/contexts/AuthContext.tsx), [`demandStore.ts`](mobile/src/stores/demandStore.ts), [`connectivityStore.ts`](mobile/src/stores/connectivityStore.ts) |
| Modo offline básico (cache das demandas consultadas com AsyncStorage) | [`offlineCache.ts`](mobile/src/services/offlineCache.ts), [`OfflineBanner.tsx`](mobile/src/components/OfflineBanner.tsx) |
| Atualizações OTA com `expo-updates` (EAS Update) | [`app.json`](mobile/app.json) (`updates`, `runtimeVersion`), [`eas.json`](mobile/eas.json) (canais), [`mobile-update.yml`](.github/workflows/mobile-update.yml) |
| Issues automáticas para falhas do CI | [`ci-failure-issues.yml`](.github/workflows/ci-failure-issues.yml) |
| Métricas de qualidade e relatórios técnico e de negócio (HTML) | [`Metricas_de_Qualidade.md`](docs/testes-automatizados/Metricas_de_Qualidade.md), [`quality-report.yml`](.github/workflows/quality-report.yml) |
| Rotas privadas e por perfil (Cidadão × Gestor/Admin) | [`app/_layout.tsx`](mobile/app/_layout.tsx), [`app/(app)/_layout.tsx`](mobile/app/(app)/_layout.tsx) |
| Refinamento de UX/UI com **GlueStack UI** e **NativeWind** | [`mobile/src/components/ui`](mobile/src/components/ui), [`tailwind.config.js`](mobile/tailwind.config.js) |
| Fluxo *end-to-end* validado (cadastro/login → demanda com foto e GPS → filtros → status pelo gestor → notificação) | [`e2e/`](e2e) (Playwright): [`cidadao-ocorrencia.spec.ts`](e2e/cidadao-ocorrencia.spec.ts), [`gestor-atendimento.spec.ts`](e2e/gestor-atendimento.spec.ts) |
| Build final empacotado (APK) | [`eas.json`](mobile/eas.json), [Releases do GitHub](https://github.com/ArthurLins00/Projetos-V/releases/latest) |
| Documentação dos endpoints (Swagger/OpenAPI) | [`swagger.ts`](backend/src/config/swagger.ts), <https://fiscalize.topsix.com.br/docs> |
| Vídeo demonstrativo (*screencast*) | [Vídeo demonstrativo](#vídeo-demonstrativo) |

## Arquitetura do app (MVVM)

```
app/ (Expo Router)          rotas: só apontam para a View de cada tela
   └─ View                  src/views       → interface (JSX), sem regra de negócio
        └─ ViewModel        src/viewmodels  → estado da tela e ações (hooks)
             └─ Service     src/services    → chamadas HTTP ao backend
                  └─ Model  src/models      → tipos e regras simples do domínio
```

## Estrutura do repositório

```
├── backend/          API REST (Express + Prisma), seed do banco e testes unitários/API
├── mobile/           App React Native (Expo) e fluxos E2E do Maestro (mobile/e2e)
├── e2e/              Testes E2E com Playwright (jornadas completas contra a API real)
├── ai-agent/         Agente conversacional com Gemini + Function Calling (AV2, Trilha B): dados em JSON, funções de acesso e log de uso — ver ai-agent/README.md
├── docs/             Documentação por disciplina do PI (mobile, segurança, negócios, dados, testes, projeto, IA) — ver docs/README.md
└── package.json      Scripts que rodam toda a suíte de testes
```

---

## Como rodar

> **Caminho mais rápido:** com o Docker instalado, `docker compose up -d --build` na raiz sobe
> PostgreSQL, Redis e o backend (com migrações e seed). Depois é só rodar o app (passo 2).
> Instalação do Docker, variáveis, agente de IA e solução de problemas em
> [`docs/COMO_RODAR_COM_DOCKER.md`](docs/COMO_RODAR_COM_DOCKER.md).

> **Tudo com um comando (sem containers para a API):** na raiz, `npm run dev:local` cria os `.env` que
> faltarem a partir dos modelos, instala as dependências, usa o PostgreSQL da porta 5432 (ou sobe o do
> `compose.yaml` no Docker), aplica migrações e seed e inicia o backend, o agente de IA (só com
> `GEMINI_API_KEY` em `ai-agent/.env`) e o Metro do app. Veja [Modo local](#modo-local).

### Pré-requisitos

- **Node.js 22**
- **PostgreSQL** (local ou via Docker)
- **Android Studio** (emulador Android) ou o app **Expo Go** (SDK 58) no celular

> **Windows:** clone o repositório num caminho **curto e sem acentos** (ex.: `C:\dev\Projetos-V`).
> O build Android falha em caminhos como `Área de Trabalho` ou caminhos muito longos.

### 1. Backend

```bash
cd backend
npm install
```

Crie o arquivo `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/Fiscalize?schema=public"
JWT_SECRET="uma-chave-secreta"
```

Crie o banco, popule com os dados iniciais e suba a API em `http://localhost:3000`:

```bash
npx prisma migrate deploy
npm run seed
npm run dev
```

A documentação interativa da API (Swagger) fica em `http://localhost:3000/docs`.
Mais detalhes em [`backend/COMO_RODAR_O_BACK.md`](backend/COMO_RODAR_O_BACK.md).

### 2. App

```bash
cd mobile
npm install
npx expo start
```

- **Expo Go (iPhone ou Android):** escaneie o QR code com o celular na mesma rede Wi-Fi do computador.
- **Emulador Android:** com o emulador aberto, rode `npx expo run:android`. O passo a passo completo
  no Android Studio está em [`mobile/COMO_RODAR_ANDROID_STUDIO.md`](mobile/COMO_RODAR_ANDROID_STUDIO.md).

O app descobre sozinho o endereço do backend (mesmo IP do computador que roda o Expo, porta 3000).
Para usar outro servidor, defina `EXPO_PUBLIC_API_URL` em `mobile/.env`.

### Modo local

Scripts da raiz para testar backend, agente de IA e app na sua máquina:

| Script | O que faz |
|---|---|
| `npm run dev:local` | Prepara o ambiente e sobe backend (porta 3000), agente de IA (porta 3333) e Metro do app |
| `npm run dev:local:api` | Igual, sem o Metro (só backend + agente) |
| `npm run setup:local` | Só prepara: `.env`, dependências, banco, migrações e seed |
| `npm run dev:backend` | Só o backend (`backend`: `npm run dev`) |
| `npm run dev:ai` | Só o agente de IA, recarregando ao salvar (`ai-agent`: `npm run dev:local`) |
| `npm run dev:mobile` | Só o Metro, com cache limpo (`mobile`: `npm run dev:local`) |

Opções do `dev:local` (depois de `--`, ex.: `npm run dev:local -- --no-ai`): `--no-docker`, `--no-mobile`,
`--no-ai`, `--no-seed`, `--setup-only`.

- O banco é o da `DATABASE_URL` do `backend/.env`. Se nada responder na porta, o script sobe o PostgreSQL
  (e o Redis) do `compose.yaml`; sem Docker, segue sem Redis, que é opcional.
- Se o backend ou o agente já estiverem rodando em outro terminal, o script reaproveita o que está no ar.
- O agente só sobe com `GEMINI_API_KEY` em `ai-agent/.env`; sem ela, o resto funciona e o chat fica indisponível.
- Os arquivos `.env` existentes nunca são sobrescritos.

### Variáveis de ambiente

Cada parte tem um arquivo `.env.example` com os valores padrão; copie para `.env` na mesma pasta
(`npm run dev:local` faz isso sozinho). Nenhum `.env` com valores reais vai para o repositório.

| Arquivo | Variável | Para que serve |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | **Obrigatória.** Conexão com o PostgreSQL (`postgresql://usuario:senha@host:5432/banco?schema=public`) |
| | `JWT_SECRET` | **Obrigatória.** Chave que assina os tokens de login; use um valor longo e aleatório |
| | `PORT`, `NODE_ENV` | Porta da API (padrão 3000) e ambiente (`development` / `production`) |
| | `REDIS_URL` | Opcional. Cache e limites de tentativa; sem ele, a API usa memória |
| | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Opcional. Envio de e-mails; sem `SMTP_HOST`, os códigos de 2FA e de recuperação aparecem no log do backend |
| | `AI_AGENT_URL`, `AI_AGENT_SECRET` | Opcional. Endereço do agente de IA (padrão `http://127.0.0.1:3333`) e segredo compartilhado com ele |
| | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Opcional. Conta de admin criada pelo seed |
| `ai-agent/.env` | `GEMINI_API_KEY` | Chave da API do Gemini (só para o chat; o resto do sistema funciona sem ela) |
| | `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `GEMINI_RPM` | Modelo principal, modelos de reserva (usados se o principal ficar indisponível) e limite de requisições por minuto |
| | `FISCALIZE_API_URL`, `AI_AGENT_PORT`, `AI_AGENT_HOST`, `AI_AGENT_SECRET` | Modo servidor: backend consultado, porta e host do agente, segredo compartilhado |
| `mobile/.env` | `EXPO_PUBLIC_API_URL` | Opcional. Endereço do backend; sem ela, o app usa o IP do computador que roda o Metro |
| `.env` (raiz) | `POSTGRES_*`, `*_PORT`, `JWT_SECRET`, `SEED_*`, `GEMINI_*`… | Usado pelo `docker compose` ([guia](docs/COMO_RODAR_COM_DOCKER.md)) |

A lista completa das variáveis do backend está em [`backend/README.md`](backend/README.md).

### Banco de dados

PostgreSQL com o esquema em [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). `npx prisma migrate deploy`
cria as tabelas pelas migrações de [`backend/prisma/migrations`](backend/prisma/migrations) e `npm run seed`
([`seed.ts`](backend/prisma/seed.ts)) cadastra categorias, órgãos, regras de competência e os usuários de teste abaixo.

### Usuários de teste (criados pelo seed)

| Perfil | E-mail | Senha |
|---|---|---|
| Cidadão | `cidadao@fiscalize.gov.br` | `Cidadao@123456` |
| Gestor | `gestor@fiscalize.gov.br` | `Gestor@123456` |

Em modo de desenvolvimento, a tela de login também tem o botão **"Entrar como Cidadão (Teste)"**.

---

## Testes

Na raiz do repositório:

```bash
npm install
npm test
```

| Comando | O que roda |
|---|---|
| `npm run test:unit` | Testes unitários das regras de negócio (Jest) |
| `npm run test:api` | Testes das rotas HTTP com banco mockado (Jest + Supertest) |
| `npm run test:e2e` | Jornadas completas contra o backend e o banco reais (Playwright) |
| `npm test` | Toda a suíte: unitários → API → E2E |
| `npm run test:e2e:mobile` | Fluxos de tela no emulador (Maestro) |

Os testes E2E precisam do banco criado e populado (`npm run seed`). O Playwright sobe o backend
sozinho se ele não estiver rodando. O que cada nível cobre está em [`docs/testes-automatizados/TESTES.md`](docs/testes-automatizados/TESTES.md), que também
descreve o que o GitHub Actions roda a cada push, antes de cada merge e na regressão diária, e o Quality Gate
que bloqueia o merge quando algum teste falha (seção 2.1). Falhas, testes instáveis, quarentena, revisão
periódica e remoção de testes seguem a política de manutenção em [`docs/testes-automatizados/tas.md`](docs/testes-automatizados/tas.md).

---

## Limitações conhecidas

- **Câmera no emulador Android:** a pré-visualização funciona, mas a foto tirada sai preta. É uma
  limitação da câmera virtual do emulador com a biblioteca usada pelo Expo Camera. Em aparelhos
  reais (Android ou iPhone) a foto funciona normalmente.
- **Fotos** ficam salvas no disco do servidor (`backend/uploads/`), sem armazenamento em nuvem.

## Google Drive do projeto

Os arquivos das disciplinas que ficam fora do repositório estão na pasta compartilhada
[**PROJETO 5 - CESAR SCHOOL**](https://drive.google.com/drive/folders/1ruVWIh-5do4PJhHOyn6VlWD9lQpdOxHB)
no Google Drive, organizada em uma subpasta por disciplina:

| Subpasta no Drive | Documentação correspondente no repositório |
|---|---|
| Artefatos | — (artefatos gerais do projeto) |
| Desenvolvimento mobile | [`docs/desenvolvimento-mobile/`](docs/desenvolvimento-mobile/README.md) |
| IA aplicada | [`docs/ia-aplicada/`](docs/ia-aplicada/README.md) |
| Negócios para a internet | [`docs/negocios-na-internet/`](docs/negocios-na-internet/README.md) |
| Projetos 5 - acompanhamento | [`docs/projeto-5/`](docs/projeto-5/README.md) |
| Segurança da informação | [`docs/seguranca-da-informacao/`](docs/seguranca-da-informacao/README.md) |
| Testes automatizados | [`docs/testes-automatizados/`](docs/testes-automatizados/README.md) |

## Documentação complementar

- [`docs/README.md`](docs/README.md): **índice da documentação por disciplina** (tecnologias, justificativas e alternativas descartadas)
- [`docs/seguranca-da-informacao/README.md`](docs/seguranca-da-informacao/README.md): modelo de autenticação e explicação das cifras utilizadas
- [`backend/README.md`](backend/README.md): perfis, permissões e rotas da API
- [`mobile/README.md`](mobile/README.md): telas, arquitetura MVVM, navegação e testes de tela do app
- [`backend/COMO_RODAR_O_BACK.md`](backend/COMO_RODAR_O_BACK.md): configuração do banco e do backend
- [`mobile/COMO_RODAR_ANDROID_STUDIO.md`](mobile/COMO_RODAR_ANDROID_STUDIO.md): app no Android Studio, passo a passo
- [`docs/testes-automatizados/TESTES.md`](docs/testes-automatizados/TESTES.md): estratégia e cobertura dos testes
- [`docs/testes-automatizados/tas.md`](docs/testes-automatizados/tas.md): política de manutenção da automação de testes
- [`docs/testes-automatizados/Template_Plano_de_Testes_e_Backlog.md`](docs/testes-automatizados/Template_Plano_de_Testes_e_Backlog.md): plano de testes e backlog de automação

## Declaração de uso de I.A.

---

Declaro que utilizei as ferramentas de Inteligência Artificial Claude (Opus 5.5), da Anthropic, e Gemini (3.6 Flash), do Google, como apoio na elaboração desta atividade, para a geração de rascunhos, sugestões de código, revisão de textos e esclarecimento de dúvidas. Realizei análise crítica (curadoria) de todo o conteúdo gerado, verificando sua correção, adequação e aderência aos objetivos da atividade, e fiz os ajustes necessários. Não tratei dados pessoais no uso dessas ferramentas. Reconheço que as respostas geradas por IA podem conter imprecisões e assumo a responsabilidade integral pela versão final apresentada.

---
