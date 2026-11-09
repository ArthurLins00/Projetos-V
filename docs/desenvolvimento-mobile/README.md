# Desenvolvimento Mobile

| | |
|---|---|
| **Papel no PI** | Construir o aplicativo mobile do cidadão e o backend/API que o sustenta |
| **Código** | [`mobile/`](../../mobile) (app) e [`backend/`](../../backend) (API REST) |
| **Documentação técnica** | [`mobile/README.md`](../../mobile/README.md), [`backend/README.md`](../../backend/README.md), [`backend/COMO_RODAR_O_BACK.md`](../../backend/COMO_RODAR_O_BACK.md), [`mobile/COMO_RODAR_ANDROID_STUDIO.md`](../../mobile/COMO_RODAR_ANDROID_STUDIO.md) |
| **Conexões** | aplica os controles de [Segurança](../seguranca-da-informacao/README.md), expõe os dados usados por [Dados](../engenharia-de-dados/README.md), implementa a jornada de [Negócios](../negocios-na-internet/README.md), é verificado por [Testes](../testes-automatizados/README.md) e integra o [agente de IA](../ia-aplicada/README.md) |

O app é o núcleo do produto: é nele que todas as outras disciplinas se materializam. O cidadão
fotografa um problema urbano, captura a localização pelo GPS e registra a ocorrência; o backend
encaminha a ocorrência ao órgão responsável e o cidadão acompanha o andamento até a resolução.
Gestores e administradores usam o mesmo app para atender a fila de chamados.

---

## 1. Entregas

| Unidade | Entrega | Onde está |
|---|---|---|
| U1 | App inicial: navegação, login, registro de demanda com foto e GPS, listagem e acompanhamento, consumindo um backend inicial; build em dispositivo/emulador | [`mobile/app`](../../mobile/app), [`mobile/src`](../../mobile/src), [`backend/src`](../../backend/src) |
| U2 | Signup, login e logout com o backend e `sessionToken` (access + refresh token) | [`AuthContext.tsx`](../../mobile/src/contexts/AuthContext.tsx), [`api.ts`](../../mobile/src/services/api.ts), [`authService.ts`](../../backend/src/services/authService.ts) |
| U2 | Estado com hooks (`useState`, `useEffect`, `useContext`) | [`AuthContext.tsx`](../../mobile/src/contexts/AuthContext.tsx), [`DemandContext.tsx`](../../mobile/src/contexts/DemandContext.tsx), [`src/viewmodels`](../../mobile/src/viewmodels) |
| U2 | Notificações (push, e-mail e na tela) | [`usePushNotifications.ts`](../../mobile/src/hooks/usePushNotifications.ts), [`notificationService.ts`](../../backend/src/services/notificationService.ts) |
| U2 | Build empacotado (APK/IPA via EAS) e atualizações OTA | [`eas.json`](../../mobile/eas.json), [`mobile-release.yml`](../../.github/workflows/mobile-release.yml), [`mobile-update.yml`](../../.github/workflows/mobile-update.yml), [`mobile/README.md` › Build empacotado](../../mobile/README.md#build-empacotado-eas) |

### Funcionalidades entregues

- Cadastro, login com **verificação em duas etapas** opcional, recuperação de senha, perfil com foto e
  aceite dos termos de uso.
- Registro de ocorrência com título, categoria, endereço, descrição, **GPS** (com endereço sugerido
  por geocodificação reversa), **até 5 fotos** (câmera ou galeria) e mapa da localização.
- Lista com pesquisa, filtros (status, categoria, estado, cidade, zona), paginação e "puxar para atualizar".
- Detalhe com fotos, coordenadas e linha do tempo; edição e exclusão enquanto o órgão ainda não atua.
- Perfis **Cidadão, Gestor e Admin** com rotas protegidas por perfil; painel do gestor com indicadores;
  gestão de usuários, órgãos e regras de roteamento pelo admin.
- Central de notificações, FAQ/ajuda e o **Assistente Fiscalize** (chat com IA).

---

## 2. Arquitetura

```
┌──────────────────────── App (React Native + Expo) ────────────────────────┐
│ app/ (Expo Router)  →  View  →  ViewModel (hooks)  →  Service (axios)     │
│                                     ↑ Context (sessão, demandas)          │
│ SecureStore: access token, refresh token, dados do usuário                │
└──────────────────────────────────────┬────────────────────────────────────┘
                                       │ HTTPS · Authorization: Bearer <JWT>
┌──────────────────────────────────────▼────────────────────────────────────┐
│ Backend (Express 5 + TypeScript)                                          │
│ routes → middlewares (auth, requireRole) → controllers → services         │
│        → Prisma ORM → PostgreSQL          Redis (cache de métricas)       │
│ SMTP (nodemailer) · Expo Push API · ai-agent (POST /chat)                 │
└───────────────────────────────────────────────────────────────────────────┘
```

- **App em MVVM:** a rota só aponta para a View; a View não tem regra de negócio; o ViewModel
  (hook) guarda o estado da tela e as ações; o Service isola o HTTP; o Model guarda tipos e regras
  simples. Detalhes em [`mobile/README.md` › Arquitetura](../../mobile/README.md#arquitetura-mvvm).
- **Backend em camadas:** rotas → controllers (HTTP) → services (regra de negócio) → Prisma
  (dados). Rotas e permissões em [`backend/README.md`](../../backend/README.md#rotas).

---

## 3. Tecnologias

Resumo; a justificativa de cada uma vem logo abaixo.

| Camada | Tecnologia | Para quê |
|---|---|---|
| App | React Native 0.88 + **Expo SDK 58** | Base do app Android e iOS |
| App | **TypeScript** | Tipagem do app, backend e agente |
| App | **Expo Router** | Navegação por arquivos, rotas protegidas |
| App | **Context API + hooks** | Estado global de sessão e demandas |
| App | **expo-secure-store** | Guardar tokens no Keystore/Keychain |
| App | **axios** | Cliente HTTP com interceptors (token e refresh) |
| App | **expo-location** / **expo-camera** / **expo-image-picker** | GPS, câmera e galeria |
| App | **expo-notifications** | Push |
| App | **react-native-webview** + Leaflet + OpenStreetMap | Mapa da ocorrência |
| App | Nominatim (OSM) e API do IBGE | Endereço a partir do GPS; lista de municípios |
| App | **EAS Build** + **EAS Update** (`expo-updates`) | APK/AAB/IPA e atualizações OTA |
| Backend | **Node.js 22 + Express 5** | API REST |
| Backend | **Prisma 7** + **PostgreSQL** | ORM, migrações e banco relacional |
| Backend | **jsonwebtoken**, **bcryptjs**, `node:crypto` | Sessão e criptografia (ver [Segurança › Criptografia](../seguranca-da-informacao/README.md#3-criptografia-e-cifras-utilizadas)) |
| Backend | **ioredis** + **node-cron** | Cache e consolidação periódica de métricas (ver [Dados](../engenharia-de-dados/README.md)) |
| Backend | **nodemailer** | E-mails (2FA, recuperação de senha, status) |
| Backend | **Swagger UI** (OpenAPI) | Documentação interativa em `/docs` |

### 3.1 React Native + Expo

- **Como foi usado:** projeto Expo "managed" com *prebuild* só quando necessário; plataformas
  limitadas a `["android", "ios"]` no [`app.json`](../../mobile/app.json), sem build web.
- **Por quê:** é o conteúdo da disciplina e reaproveita o React que a equipe já conhecia. O Expo
  entrega câmera, GPS, notificações e armazenamento seguro como módulos prontos e mantidos em
  conjunto, sem escrever código nativo, e o Expo Go permite testar no celular sem compilar.
- **Descartados:**
  - **Flutter:** exigiria aprender Dart e não compartilharia linguagem com o backend em TypeScript.
  - **Nativo (Kotlin + Swift):** duas bases de código para uma equipe de tempo parcial.
  - **React Native "puro" (CLI, sem Expo):** cada recurso do dispositivo precisaria de configuração
    nativa manual, e o build na nuvem (EAS) já resolve a geração do APK/IPA.
  - **PWA / Ionic:** o requisito do projeto é app nativo, sem build web.

### 3.2 TypeScript

- **Como:** em todo o código (app, backend, agente e testes), com `tsc --noEmit` no CI.
- **Por quê:** o mesmo modelo de dados (demanda, status, perfil) circula entre app, API e agente;
  tipos pegam incompatibilidades antes de rodar. **Descartado:** JavaScript puro, pelo mesmo motivo.

### 3.3 Expo Router

- **Como:** rotas por arquivos em [`mobile/app`](../../mobile/app), com grupos `(auth)` e `(app)`,
  `Stack.Protected` para esconder telas sem sessão e verificação de perfil no layout do grupo `(app)`.
- **Por quê:** rotas protegidas são declarativas: ao logar ou sair, o roteador troca de grupo
  sozinho. Também dá *deep links* sem configuração extra.
- **Descartado:** **React Navigation** configurado à mão. O Expo Router é construído sobre ele, mas
  elimina a árvore de navegadores manual e a lógica de redirecionamento espalhada pelas telas.

### 3.4 Context API + hooks (estado global)

- **Como:** `AuthContext` (sessão, login, logout, refresh) e `DemandContext` (lista e CRUD de
  demandas), com `useState`/`useEffect`; cada tela tem um ViewModel em forma de hook.
- **Por quê:** o estado global do app é pequeno (sessão e uma lista), e a disciplina pede
  explicitamente `useState`, `useEffect` e `useContext`. Sem dependência extra.
- **Descartados:** **Redux Toolkit** (muito código de cerimônia para dois estados globais) e
  **Zustand** (citado no plano da disciplina; seria a escolha se o estado global crescesse, mas hoje
  não acrescenta nada ao Context).

### 3.5 expo-secure-store

- **Como:** guarda o access token, o refresh token e os dados do usuário; o app restaura a sessão ao abrir.
- **Por quê:** grava no **Android Keystore** e no **iOS Keychain**, cifrados pelo sistema operacional
  (ver [Segurança › Criptografia](../seguranca-da-informacao/README.md#36-armazenamento-no-aparelho-android-keystore-e-ios-keychain)).
- **Descartado:** **AsyncStorage**, que grava em texto puro no armazenamento do app; aceitável para
  cache, nunca para tokens.

### 3.6 axios

- **Como:** instância única em [`api.ts`](../../mobile/src/services/api.ts) que descobre a URL do
  backend, injeta o `Authorization: Bearer` e, ao receber `token_expired`, renova a sessão com o
  refresh token e repete a requisição uma única vez.
- **Por quê:** interceptors de requisição e resposta resolvem a renovação de token num só lugar.
- **Descartado:** **fetch** nativo, que não tem interceptors (cada service teria que repetir a lógica).
  O `fetch` só é usado em chamadas públicas simples (IBGE, Nominatim).

### 3.7 Recursos do dispositivo: expo-location, expo-camera, expo-image-picker

- **Como:** GPS com permissão "enquanto em uso" e geocodificação reversa; câmera em tela cheia com
  troca frontal/traseira; galeria para anexar fotos existentes. Permissões pedidas só no uso.
- **Por quê:** são os módulos oficiais do SDK, versionados junto com o Expo.
- **Descartados:** `react-native-vision-camera` (mais poderosa, mas exige *dev build* e configuração
  nativa, desnecessário para uma foto por vez) e `react-native-geolocation-service` (fora do ecossistema Expo).

### 3.8 Mapa: react-native-webview + Leaflet + OpenStreetMap

- **Como:** o modal de localização renderiza um HTML com Leaflet numa WebView, com tiles do OSM.
- **Por quê:** funciona igual em Android e iOS, sem chave de API e sem custo.
- **Descartado:** `react-native-maps` com **Google Maps**, que exige chave de API com faturamento
  ativo e configuração nativa por plataforma.

### 3.9 Notificações: expo-notifications + Expo Push API

- **Como:** o app registra o *push token* no backend; a cada mudança de status o backend envia o push
  pela Expo Push API, grava a notificação in-app e manda e-mail, conforme as preferências do usuário.
- **Por quê:** a Expo Push API abstrai FCM (Android) e APNs (iOS) com uma única chamada HTTP.
- **Descartados:** **Firebase Cloud Messaging direto** (exigiria integração separada com APNs no iOS)
  e **OneSignal** (fornecedor extra recebendo dados de usuários, ver [Gestão de fornecedores](../seguranca-da-informacao/06_Gestao_de_Fornecedores.md)).

### 3.10 EAS Build e EAS Update (OTA)

- **Como:** perfis `preview` (APK para instalar direto) e `production` (AAB/IPA) em [`eas.json`](../../mobile/eas.json),
  gerados pela máquina (`npm run build:apk`) ou pelo workflow [`mobile-release.yml`](../../.github/workflows/mobile-release.yml).
  Cada perfil está ligado a um **canal** de atualização de mesmo nome. Com `expo-updates`, o app instalado
  consulta o canal ao abrir (`checkAutomatically: ON_LOAD`) e baixa a versão nova do JavaScript e dos
  assets, que passa a valer na próxima abertura. A publicação é feita com `npm run update:preview` ou pelo
  workflow [`mobile-update.yml`](../../.github/workflows/mobile-update.yml). O `runtimeVersion` segue a
  versão do app (`policy: appVersion`): mudança em código nativo (biblioteca nova, permissão, plugin)
  exige subir a `version` do `app.json` e gerar um APK novo, e o OTA só chega a quem tem o mesmo runtime.
- **Por quê:** o EAS Build compila na nuvem, inclusive iOS sem Mac, e assina os binários. O EAS Update
  leva correções de tela e de regra para quem já instalou o APK em minutos, sem pedir que os testadores
  baixem e reinstalem o arquivo.
- **Descartados:** build local com Android Studio/Xcode para distribuição (continua possível para
  desenvolvimento, mas o iOS exigiria um Mac); **CodePush** (App Center, descontinuado pela Microsoft) e
  servidor de atualização próprio com o protocolo do `expo-updates` (mais infraestrutura para manter, sem
  ganho para o tamanho do projeto).

### 3.11 Backend: Node.js + Express 5

- **Como:** API REST em camadas, com `express.json` limitado (100 KB; 15 MB só nas rotas de foto),
  CORS por lista de origens, `cookie-parser` e tratamento de erros centralizado (`AppError`).
- **Por quê:** mesma linguagem do app; Express é o framework mais conhecido pela equipe e o
  Express 5 trata erros de funções `async` sem *wrappers*.
- **Descartados:** **NestJS** (estrutura mais rígida e curva de aprendizado alta para o prazo),
  **Fastify** (mais rápido, mas a equipe não o conhecia e o ganho de desempenho não é gargalo aqui)
  e **Firebase/Supabase como backend** (regra de negócio, roteamento por órgão e auditoria ficariam
  presos a um fornecedor).

### 3.12 Prisma ORM + PostgreSQL

- **Como:** esquema em [`schema.prisma`](../../backend/prisma/schema.prisma), migrações versionadas,
  seed com usuários, categorias, órgãos e regras de competência; adaptador `@prisma/adapter-pg`.
- **Por quê:** os dados são fortemente relacionais (usuário → chamado → órgão → categoria → regra
  de competência → linha do tempo), com transações (cadastro de usuário + perfil). Prisma gera tipos
  a partir do esquema e usa consultas parametrizadas, o que elimina SQL injection por concatenação.
- **Descartados:** **MongoDB** (perderia integridade referencial e transações simples entre
  entidades), **MySQL** (sem vantagem; o PostgreSQL tem `jsonb`, usado nos *snapshots* de métricas) e
  **TypeORM/Sequelize** (tipagem mais fraca e migrações menos previsíveis).

### 3.13 nodemailer (SMTP)

- **Como:** envia código de 2FA, código de recuperação de senha e avisos de status; TLS implícito na
  porta 465 ou STARTTLS na 587; falha de envio não derruba a requisição.
- **Por quê:** funciona com qualquer SMTP (Gmail no desenvolvimento) sem SDK de fornecedor.
- **Descartados:** **SendGrid/Amazon SES** via SDK (mais um fornecedor e conta paga para um projeto
  acadêmico); trocar de SMTP continua sendo só configuração.

### 3.14 Swagger UI (OpenAPI)

- **Como:** especificação em [`swagger.ts`](../../backend/src/config/swagger.ts), servida em `/docs` e `/docs.json`.
- **Por quê:** o time do app e o de testes consultam o contrato da API sem ler o código.
- **Descartado:** coleção do **Postman** compartilhada, que fica desatualizada fora do repositório.

---

## 4. Itens do plano da disciplina não adotados

| Item | Situação | Motivo |
|---|---|---|
| **GlueStack UI / NativeWind** | Não adotado | O app tem um design system próprio pequeno ([`src/components/ui`](../../mobile/src/components/ui) e [`src/theme`](../../mobile/src/theme), com tema claro/escuro). Migrar todas as telas no fim do semestre trazia risco de regressão nos `testID` usados pelo Maestro sem ganho funcional. |
| **Modo offline (AsyncStorage)** | Não adotado (diferencial opcional) | O fluxo depende de dados do servidor (status e roteamento); o cache local ficou fora do escopo. |
| **Zustand** | Não adotado | Ver 3.4. |

## 5. Como rodar

Passo a passo no [README principal](../../README.md#como-rodar), em [`backend/COMO_RODAR_O_BACK.md`](../../backend/COMO_RODAR_O_BACK.md)
e em [`mobile/COMO_RODAR_ANDROID_STUDIO.md`](../../mobile/COMO_RODAR_ANDROID_STUDIO.md). Para subir o backend inteiro
em containers, veja [`COMO_RODAR_COM_DOCKER.md`](../COMO_RODAR_COM_DOCKER.md).

### Docker e Docker Compose

- **Como:** [`compose.yaml`](../../compose.yaml) na raiz sobe PostgreSQL 16, Redis 7, o backend
  ([`backend/Dockerfile`](../../backend/Dockerfile), que aplica as migrações e o seed na subida) e, com
  `--profile ai`, o agente de IA. O app continua rodando fora do Docker.
- **Por quê:** mesmo ambiente e mesmas versões do CI em qualquer sistema operacional, sem instalar
  PostgreSQL e Redis na máquina.
- **Descartados:** instalação nativa (versões diferentes por integrante; Redis sem versão oficial para
  Windows) e Kubernetes (complexo demais para quatro containers locais).
