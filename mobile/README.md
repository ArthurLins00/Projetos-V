# App mobile — Fiscalize

Aplicativo do Fiscalize para o cidadão registrar problemas urbanos com **foto e localização**,
acompanhar o andamento e gerenciar as próprias ocorrências.

**Stack:** React Native 0.86 · Expo SDK 57 · Expo Router · TypeScript · axios

**Plataformas:** somente **Android e iOS**. O build web está desabilitado de propósito
(`"platforms": ["android", "ios"]` no [`app.json`](app.json)).

---

## Telas

| Tela | Rota | O que faz |
|---|---|---|
| Login | `/(auth)/login` | Entrar com e-mail e senha. Em modo dev há o botão "Entrar como Cidadão (Teste)" |
| Cadastro | `/(auth)/register` | Criar conta de cidadão |
| Minhas Demandas | `/(app)` | Lista (FlatList) com pesquisa, filtros por status, paginação e "puxar para atualizar" |
| Nova Demanda | `/(app)/create-demand` | Formulário com categoria, GPS e câmera |
| Detalhes da Demanda | `/(app)/demand/[id]` | Foto, dados, coordenadas, histórico e botões de editar e excluir |
| Editar Demanda | `/(app)/demand/[id]/edit` | Mesmo formulário da criação, já preenchido |

### Recursos do dispositivo

- **GPS (Expo Location):** o botão "📍 Pegar GPS" pede permissão, captura as coordenadas e sugere o
  endereço automaticamente (geocodificação reversa) se o campo estiver vazio.
- **Câmera (Expo Camera):** o botão "📷 Foto" abre a câmera em tela cheia (com troca frontal/traseira).
  A foto aparece como prévia no formulário e é enviada ao backend depois que a demanda é salva.

Edição e exclusão só aparecem enquanto a demanda está *Aberto*, *Em Análise* ou *Aguardando*. Depois
disso, o órgão já está atuando e o backend bloqueia alterações.

---

## Arquitetura (MVVM)

Cada tela é dividida em **View** (interface) e **ViewModel** (estado e ações), e a comunicação com o
backend fica isolada nos **Services**.

```
app/                 Expo Router: cada arquivo é uma rota e só aponta para a View
  └─ src/views       View: JSX e estilos, sem regra de negócio
       └─ src/viewmodels   ViewModel: hooks com estado da tela, validação e ações
            └─ src/services     Service: chamadas HTTP ao backend (axios)
                 └─ src/models       Model: tipos e regras simples do domínio
```

Exemplo, o formulário de demanda:

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Rota | [`app/(app)/create-demand.tsx`](app/(app)/create-demand.tsx) | Renderiza a View |
| View | [`DemandFormView.tsx`](src/views/DemandFormView.tsx) | Campos, botões, prévia da foto |
| ViewModel | [`useDemandFormViewModel.ts`](src/viewmodels/useDemandFormViewModel.ts) | Carrega categorias, GPS, câmera, validação e envio |
| Service | [`demandService.ts`](src/services/demandService.ts) | `create`, `update`, `uploadPhoto` |
| Model | [`Demand.ts`](src/models/Demand.ts) | Tipos `Demand` e `DemandPayload`, regra `isDemandEditable` |

O mesmo ViewModel atende a criação e a edição: sem `demandId`, cria; com `demandId`, carrega os dados e atualiza.

## Navegação e sessão

- **Expo Router** com dois grupos: `(auth)` (login e cadastro) e `(app)` (telas logadas, em pilha).
- **Rotas protegidas** com `Stack.Protected` em [`app/_layout.tsx`](app/_layout.tsx): sem usuário, as
  telas do app nem são montadas; ao fazer login ou logout, o roteador troca de grupo sozinho.
- **Persistência da sessão:** [`AuthContext.tsx`](src/contexts/AuthContext.tsx) guarda o token e o
  usuário no **SecureStore** e os restaura ao abrir o app com `useState` e `useEffect`. Fechar e reabrir
  o app mantém o login.
- Todas as requisições levam o token no header `Authorization: Bearer <token>`
  ([`api.ts`](src/services/api.ts)).

## Integração com o backend

O app consome a API do [`backend`](../backend) na porta **3000**. A URL é descoberta automaticamente
([`api.ts`](src/services/api.ts)):

1. `EXPO_PUBLIC_API_URL` em `mobile/.env`, se definida;
2. senão, o **mesmo IP do computador que roda o Expo**, o que funciona no Expo Go do celular e no emulador;
3. no emulador Android conectado via `localhost`, usa `10.0.2.2` (o "localhost" do PC visto pelo emulador).

Em modo dev, a URL escolhida aparece no log do Metro: `[api] Backend: http://...`.
Se o app não alcançar o servidor, a mensagem de erro mostra a URL tentada.

| Recurso | Rotas usadas |
|---|---|
| Autenticação | `POST /auth/login`, `POST /auth/register`, `POST /auth/logout` |
| Demandas | `GET/POST /demands`, `GET/PUT/DELETE /demands/:id`, `PUT /demands/:id/photo` |
| Categorias | `GET /categories` |
| Fotos | `GET /uploads/<arquivo>` (exibidas com `<Image>`) |

---

## Como rodar

### Pré-requisitos

- Node.js 22
- Backend rodando e com o seed aplicado (veja [`../backend/README.md`](../backend/README.md))
- **Expo Go** (SDK 57) no celular **ou** Android Studio com um emulador

### Instalar e iniciar

```bash
npm install
npx expo start
```

**No celular (Expo Go):** escaneie o QR code. O celular precisa estar na mesma rede Wi-Fi do computador,
e o firewall do Windows precisa liberar o Node.js nas portas 8081 (Metro) e 3000 (backend).

**No emulador Android:** com o emulador aberto, rode:

```bash
npx expo run:android
```

Esse comando gera o projeto nativo, compila, instala e abre o app. O passo a passo completo pelo
Android Studio, com solução de problemas, está em [`COMO_RODAR_ANDROID_STUDIO.md`](COMO_RODAR_ANDROID_STUDIO.md).

> **Windows:** mantenha o projeto num caminho **curto e sem acentos** (ex.: `C:\dev\Projetos-V`).
> O build nativo falha em pastas como `Área de Trabalho` ou em caminhos muito longos.

### Usuário de teste

`cidadao@fiscalize.gov.br` / `Cidadao@123456`, criado pelo seed do backend.

### Scripts

| Script | Descrição |
|---|---|
| `npm start` | Inicia o Metro (Expo) |
| `npm run android` | Build de desenvolvimento e execução no Android (`expo run:android`) |
| `npm run ios` | Build de desenvolvimento e execução no iOS (requer macOS) |
| `npm run prebuild` | Gera a pasta nativa `android/` (necessário após mudar o `app.json` ou instalar lib nativa) |
| `npm run typecheck` | Checagem de tipos do TypeScript |

### Permissões

Declaradas em [`app.json`](app.json) pelos plugins do Expo e pedidas só quando o recurso é usado:

| Permissão | Quando é pedida |
|---|---|
| Câmera | Ao tocar em "📷 Foto" |
| Localização (enquanto o app está em uso) | Ao tocar em "📍 Pegar GPS" |

---

## Testes de tela (E2E com Maestro)

Os fluxos ficam em [`e2e/`](e2e) e rodam no emulador com o app instalado, o Metro e o backend no ar:

| Fluxo | O que verifica |
|---|---|
| `login_invalid_password` | Erro de login e usuário continua deslogado |
| `register` | Cadastro pela tela e primeiro login com a conta nova |
| `session_persistence` | Fechar e reabrir o app mantém a sessão |
| `logout` | Sair e continuar deslogado ao reabrir |
| `demand_crud` | Criar com GPS e câmera → pesquisar → detalhar → editar → excluir |

Para rodar pela CLI do Maestro, execute `npm run test:e2e:mobile` na raiz do repositório. No Maestro
Studio, abra a pasta `e2e/`. Os fluxos de `e2e/subflows/` são reaproveitados pelos outros e não rodam sozinhos.

Os componentes têm `testID` (seletores estáveis) e `accessibilityRole`:

| Tela | testIDs |
|---|---|
| Login | `login-email`, `login-password`, `login-submit`, `login-go-register`, `login-dev` |
| Cadastro | `register-name`, `register-email`, `register-password`, `register-submit`, `register-go-login` |
| Lista | `demand-search`, `status-filter-<status>`, `demand-list`, `demand-card`, `new-demand-button`, `logout-button` |
| Formulário | `form-title`, `form-category-<id>`, `form-address`, `form-description`, `form-photo`, `form-gps`, `form-submit` |
| Câmera | `camera-shutter` |
| Detalhe | `detail-title`, `detail-edit`, `detail-delete` |

Dicas para escrever fluxos novos estão em [`../TESTES.md`](../TESTES.md).

---

## Estrutura

```
mobile/
├── app/                        rotas (Expo Router)
│   ├── _layout.tsx             AuthProvider + rotas protegidas
│   ├── (auth)/                 login, register
│   └── (app)/                  lista, nova demanda, detalhe e edição (demand/[id])
├── src/
│   ├── views/                  telas (View)
│   ├── viewmodels/             hooks de cada tela (ViewModel)
│   ├── services/               api (axios + token + URL do backend), auth, demandas, categorias
│   ├── models/                 tipos e regras (Demand, Category, User)
│   ├── components/             CameraCapture, DemandCard
│   └── contexts/               AuthContext (sessão persistente)
├── e2e/                        fluxos Maestro
├── assets/                     ícones e splash
└── app.json                    configuração do Expo (plataformas, permissões, identificadores)
```

## Limitações conhecidas

- **Câmera no emulador Android:** a pré-visualização funciona, mas a foto capturada sai preta. É uma
  limitação da câmera virtual do emulador com a biblioteca usada pelo Expo Camera (CameraX). Em
  aparelhos reais (Android e iPhone) funciona normalmente.
- **Modo dev:** os erros de console aparecem como avisos no rodapé da tela e podem cobrir botões
  durante testes automatizados.
