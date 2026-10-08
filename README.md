# Fiscalize

Aplicativo mobile para o cidadão **registrar e acompanhar problemas urbanos** (buracos, postes apagados,
vazamentos, sinalização…) e para os **gestores dos órgãos públicos** atenderem essas ocorrências.

O cidadão fotografa o problema, captura a localização pelo GPS e envia a ocorrência. O backend
encaminha a ocorrência ao órgão responsável pela categoria (ex.: *Água e Esgoto → COMPESA*) e o
cidadão acompanha o andamento pelo app até a resolução.

| | |
|---|---|
| **App** | React Native + Expo (SDK 57), somente **Android e iOS** |
| **Backend** | Node.js + Express + TypeScript + Prisma + PostgreSQL |
| **Testes** | Jest + Supertest (unitário e API), Playwright (E2E da API) e Maestro (E2E de telas) |

---

## Funcionalidades

- **Cadastro e login** com sessão persistente (continua logado ao reabrir o app).
- **Registrar ocorrência** com título, categoria, endereço, descrição, **localização por GPS**
  (preenche o endereço automaticamente) e **foto pela câmera**.
- **Listagem** das ocorrências com **pesquisa** por título, descrição, endereço ou protocolo,
  **filtro por status**, paginação e "puxar para atualizar".
- **Detalhe** da ocorrência com foto, coordenadas e histórico de alterações.
- **Editar e remover** a ocorrência enquanto ela ainda não está em andamento.
- **Assistente de IA** (balão 💬 na tela inicial): responde em linguagem natural sobre o status de
  um ou mais chamados, usando Gemini com function calling. O cidadão consulta só os próprios
  chamados; gestor e admin, todos. Detalhes em [`ai-agent/README.md`](ai-agent/README.md#integração-com-o-app-fiscalize).
- **Perfis:** Cidadão, Gestor e Admin, com permissões hierárquicas. O gestor vê a fila do seu órgão
  e atualiza o status das ocorrências.

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
├── ai-agent/         Agente conversacional com Gemini + Function Calling (AV2, Trilha B) — ver ai-agent/README.md
├── TESTES.md         O que cada nível de teste cobre e como rodar
└── package.json      Scripts que rodam toda a suíte de testes
```

---

## Como rodar

### Pré-requisitos

- **Node.js 22**
- **PostgreSQL** (local ou via Docker)
- **Android Studio** (emulador Android) ou o app **Expo Go** (SDK 57) no celular

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

### Usuários de teste (criados pelo seed)

| Perfil | E-mail | Senha |
|---|---|---|
| Cidadão | `cidadao@fiscalize.gov.br` | `Cidadao@123456` |
| Gestor (COMPESA) | `gestor.compesa@fiscalize.gov.br` | `Gestor@123456` |

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
sozinho se ele não estiver rodando. O que cada nível cobre está em [`TESTES.md`](TESTES.md).

---

## Limitações conhecidas

- **Câmera no emulador Android:** a pré-visualização funciona, mas a foto tirada sai preta. É uma
  limitação da câmera virtual do emulador com a biblioteca usada pelo Expo Camera. Em aparelhos
  reais (Android ou iPhone) a foto funciona normalmente.
- **Fotos** ficam salvas no disco do servidor (`backend/uploads/`), sem armazenamento em nuvem.

## Documentação complementar

- [`backend/README.md`](backend/README.md): perfis, permissões e rotas da API
- [`mobile/README.md`](mobile/README.md): telas, arquitetura MVVM, navegação e testes de tela do app
- [`backend/COMO_RODAR_O_BACK.md`](backend/COMO_RODAR_O_BACK.md): configuração do banco e do backend
- [`mobile/COMO_RODAR_ANDROID_STUDIO.md`](mobile/COMO_RODAR_ANDROID_STUDIO.md): app no Android Studio, passo a passo
- [`TESTES.md`](TESTES.md): estratégia e cobertura dos testes

## Declaração de uso de I.A.

---

Declaro que utilizei as ferramentas de Inteligência Artificial Claude (Opus 5.5), da Anthropic, e Gemini (3.6 Flash), do Google, como apoio na elaboração desta atividade, para a geração de rascunhos, sugestões de código, revisão de textos e esclarecimento de dúvidas. Realizei análise crítica (curadoria) de todo o conteúdo gerado, verificando sua correção, adequação e aderência aos objetivos da atividade, e fiz os ajustes necessários. Não tratei dados pessoais no uso dessas ferramentas. Reconheço que as respostas geradas por IA podem conter imprecisões e assumo a responsabilidade integral pela versão final apresentada.

---
