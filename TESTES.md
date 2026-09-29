# Documentação de testes — Fiscalize

Este documento descreve a estratégia, o ambiente, os comandos e o catálogo completo dos testes
automatizados do projeto (backend e app mobile).

**Situação na última execução (29/09/2026):** 95 testes automatizados passando: 35 unitários,
33 de API e 27 E2E (Playwright). Os 5 fluxos de tela (Maestro) foram validados passo a passo no emulador.

---

## 1. Estratégia

A suíte segue a **pirâmide de testes**: muitos testes rápidos e isolados na base e poucos testes lentos
e completos no topo.

```
                ┌──────────────────────────┐
                │ E2E de telas (Maestro) 5 │  app real no emulador
              ┌─┴──────────────────────────┴─┐
              │ E2E da API (Playwright) 27   │  backend + banco reais
            ┌─┴──────────────────────────────┴─┐
            │ API (Jest + Supertest) 33        │  rotas HTTP, banco mockado
          ┌─┴──────────────────────────────────┴─┐
          │ Unitários (Jest) 35                  │  regras de negócio isoladas
          └──────────────────────────────────────┘
```

| Nível | Ferramenta | O que isola | Banco | Duração |
|---|---|---|---|---|
| Unitário | Jest | Funções dos services e middlewares, chamadas diretamente | Mock (jest-mock-extended) | ~2 s |
| API | Jest + Supertest | Rotas HTTP completas (middlewares, controllers, services) | Mock | ~3 s |
| E2E (API) | Playwright | Jornadas do usuário ponta a ponta, via HTTP | PostgreSQL real | ~7 s |
| E2E (telas) | Maestro | Fluxos na interface do app | PostgreSQL real | minutos |

### Por que o E2E usa Playwright na API e Maestro nas telas

O app é **React Native nativo, só Android e iOS**, porque o projeto exige que não haja build web.
Playwright e Cypress automatizam navegadores, então aqui o **Playwright** executa as jornadas completas do
usuário contra a **API real que o app consome**. A interação com as **telas** fica com o **Maestro**,
ferramenta de E2E para apps mobile, usando os `testID` dos componentes como seletores.

---

## 2. Como executar

### Preparação (uma vez)

```bash
npm install                    # na raiz: instala o Playwright
npm install --prefix backend   # dependências do backend (Jest, Supertest)
```

Para os E2E, o banco precisa estar criado e populado:

```bash
cd backend
npx prisma migrate deploy
npm run seed
```

### Comandos (na raiz do repositório)

| Comando | O que roda | Pré-requisitos |
|---|---|---|
| `npm run test:unit` | Testes unitários | nenhum |
| `npm run test:api` | Testes de API | nenhum |
| `npm run test:e2e` | E2E da API (Playwright) | PostgreSQL com seed |
| `npm test` ou `npm run test:all` | Unitários → API → E2E, em sequência (para no primeiro nível que falhar) | PostgreSQL com seed |
| `npm run test:e2e:report` | Abre o relatório HTML da última execução do Playwright | ter rodado `test:e2e` |
| `npm run test:e2e:mobile` | Fluxos de tela (Maestro CLI) | emulador, app, Metro e backend no ar |

Os testes do backend também podem ser rodados de dentro de `backend/` com `npm test`, `npm run test:unit`
e `npm run test:api`.

### Detalhes do E2E da API

- O Playwright **sobe o backend sozinho** (`npm run dev`) se nada estiver respondendo em
  `http://localhost:3000/health`. Se o backend já estiver rodando, ele é reaproveitado.
- Para testar outro servidor: `E2E_API_URL=http://host:3000 npm run test:e2e`.
- Cada teste cria **cidadãos novos** (e-mails `*@teste.fiscalize`), então os testes não dependem de dados
  existentes e podem rodar em paralelo. Os únicos dados do seed usados são as categorias e o gestor da COMPESA.
- O relatório HTML fica em `e2e-report/` e os artefatos em `test-results/` (ambos fora do git).

### Detalhes do E2E de telas (Maestro)

Deixe no ar o emulador com o app de debug instalado (`npx expo run:android` em `mobile/`), o Metro
(`npx expo start`) e o backend com seed. Depois use uma das opções:

- **CLI:** instale o Maestro (https://maestro.mobile.dev) e rode `npm run test:e2e:mobile`;
- **Maestro Studio:** abra a pasta `mobile/e2e` e execute cada fluxo.

Os fluxos de `mobile/e2e/subflows/` (login) são chamados pelos outros e não rodam sozinhos
(configurado em `mobile/e2e/config.yaml`).

---

## 3. Catálogo de testes

### 3.1 Unitários — `backend/src/tests/unit` (35)

Chamam as funções diretamente, com o Prisma mockado. As fotos são gravadas numa pasta temporária.

**`authorizationMatrix.test.ts`: matriz de autorização por perfil (`requireRole`)**

| ID | Caso | Esperado |
|---|---|---|
| U-01 | Admin acessa rota de Admin | 200 |
| U-02 | Admin acessa rota de Gestor (herança) | 200 |
| U-03 | Admin acessa rota de Cidadão (herança) | 200 |
| U-04 | Gestor acessa rota de Admin | 403 |
| U-05 | Gestor acessa rota de Gestor | 200 |
| U-06 | Gestor acessa rota de Cidadão (herança) | 200 |
| U-07 | Cidadão acessa rota de Admin | 403 |
| U-08 | Cidadão acessa rota de Gestor | 403 |
| U-09 | Cidadão acessa rota de Cidadão | 200 |
| U-10 | Requisição sem usuário autenticado | 401 |

**`authService.test.ts`: login, token e logout**

| ID | Caso | Esperado |
|---|---|---|
| U-11 | Login gera JWT | Token com `id`, `email`, `perfil` e expiração |
| U-12 | Dois logins seguidos | Tokens diferentes (sessões independentes) |
| U-13 | Senha errada ou e-mail inexistente | 401 com a mesma mensagem nos dois casos |
| U-14 | Logout de uma sessão | Só aquele token é revogado |
| U-15 | Logout com token inválido | Nada é adicionado à blocklist |

**`demandService.test.ts`: regras das ocorrências**

| ID | Caso | Esperado |
|---|---|---|
| U-16 | Listagem do cidadão | Só as próprias ocorrências; as removidas (`Fechado`) ficam ocultas |
| U-17 | Filtro de status explícito | Substitui a regra padrão (permite ver as removidas) |
| U-18 | Listagem do gestor | Sem restrição de dono nem de status |
| U-19 | Pesquisa textual | Busca em título, descrição, endereço e protocolo, sem diferenciar maiúsculas |
| U-20 | Paginação e formato | `skip`/`take` corretos; registro convertido para o formato da API |
| U-21 | Cidadão remove a própria ocorrência aberta | Status vira `Fechado` e o histórico é registrado |
| U-22 | Cidadão remove ocorrência de outra pessoa | 403 |
| U-23 a U-25 | Cidadão remove ocorrência `Em Andamento`, `Resolvido` ou `Fechado` | 403 |
| U-26 | Gestor remove ocorrência de qualquer cidadão | Permitido |
| U-27 | Remoção de ocorrência inexistente | 404 |
| U-28 | Cidadão edita ocorrência de outra pessoa | 403 |
| U-29 | Edição de ocorrência em andamento | 403 |
| U-30 | Edição válida | Campos atualizados; histórico com dados antigos e novos |
| U-31 | Upload de JPEG válido | Arquivo salvo e caminho gravado em `fotourl` |
| U-32 | Upload com prefixo `data:image/jpeg;base64,` | Aceito |
| U-33 | Upload de conteúdo que não é imagem | 400 (valida a assinatura do arquivo, não a extensão) |
| U-34 | Substituição de foto | Arquivo anterior apagado |
| U-35 | Upload em ocorrência de outra pessoa | 403 |

### 3.2 API — `backend/src/tests/api` (33)

Fazem requisições HTTP reais ao app Express (Supertest), passando por todos os middlewares, com o Prisma mockado.

**`auth.test.ts`: `POST /auth/login`**

| ID | Caso | Esperado |
|---|---|---|
| A-01 | Credenciais válidas | 200, token no corpo e cookie `token` |
| A-02 | Senha incorreta | 401 "Credenciais inválidas" |
| A-03 | E-mail inexistente | 401 com a mesma mensagem (não revela contas) |
| A-04 | Usuário inativo | 403 |

**`loginValido.test.ts`: AUT-01, login válido**

| ID | Caso | Esperado |
|---|---|---|
| A-05 | Login com credenciais válidas | Dados do usuário, cookie, e JWT verificável com os dados corretos |

**`authMiddleware.test.ts`: proteção de rotas**

| ID | Caso | Esperado |
|---|---|---|
| A-06 | Sem token | 401 "Token não fornecido" |
| A-07 | Token malformado | 401 "Token inválido" |
| A-08 | Token expirado | 401 "Token expirado" |
| A-09 | Token válido e usuário ativo | 200 |

**`authRegister.test.ts`: `POST /auth/register`**

| ID | Caso | Esperado |
|---|---|---|
| A-10 | Cadastro válido | 201, perfil `Cidadao` |
| A-11 | Tentativa de se cadastrar como Admin (`perfil`, `role`, `isAdmin`) | Ignorada: perfil `Cidadao` |
| A-12 | E-mail já cadastrado | 409 e nada é gravado |

**`logout.test.ts`: AUT-10, logout**

| ID | Caso | Esperado |
|---|---|---|
| A-13 | Logout | 200 e cookie limpo |
| A-14 | Uso do token depois do logout | Funciona antes (200) e é recusado depois (401 "revogado") |

**`demands.test.ts`: `/demands` e `/categories`**

| ID | Caso | Esperado |
|---|---|---|
| A-15 | Listar sem token | 401 |
| A-16 | Listagem com pesquisa e paginação | 200; pesquisa repassada ao banco; formato da resposta |
| A-17 | Pesquisa só com espaços | Ignorada |
| A-18 | Detalhe | 200 com histórico |
| A-19 | Detalhe de ocorrência de outro cidadão | 403 |
| A-20 | Criação sem campos obrigatórios | 400 e nada é gravado |
| A-21 | Criação com categoria inexistente | 400 |
| A-22 | Cidadão remove a própria ocorrência | 204; status `Fechado` |
| A-23 | Cidadão remove ocorrência de outra pessoa | 403 |
| A-24 | Foto sem o campo `photo` | 400 |
| A-25 | Foto que não é imagem | 400 |
| A-26 | Foto maior que 100 KB | Aceita pela rota (limite ampliado para fotos) |
| A-27 | Listar categorias | 200 com as categorias ativas |

**`gestorChamados.test.ts`: `PUT /gestor/chamados/:id/status`**

| ID | Caso | Esperado |
|---|---|---|
| A-28 | Status válido | 200 |
| A-29 | Status inexistente ("Finalizado") | 400 |
| A-30 | "Em Análise" | Gravado no banco como `Em_An_lise` |
| A-31 | "Em Andamento" | Gravado no banco como `Em_Andamento` |
| A-32 | Chamado inexistente | 404 |
| A-33 | Chamado de outro órgão | 403 |

### 3.3 E2E da API — `e2e/` (Playwright, 27)

Rodam contra o backend e o banco reais, na ordem em que o usuário usaria o app. Os testes de cada
jornada são sequenciais e compartilham o estado (o mesmo usuário e a mesma ocorrência).

**`cidadao-ocorrencia.spec.ts`: ciclo de vida de uma ocorrência (cidadão)**

| ID | Passo | Verifica |
|---|---|---|
| E-01 | Cadastro e login | Perfil `Cidadao`; `/auth/me` retorna o usuário |
| E-02 | Lista inicial | Vazia para um cidadão novo |
| E-03 | Registrar ocorrência (categoria, endereço, GPS) | Protocolo `DEM-AAAAMMDD-XXXX`, status Aberto |
| E-04 | Listagem | Ocorrência com categoria e coordenadas corretas |
| E-05 | Pesquisa por título, endereço e protocolo | Encontra a ocorrência; termo inexistente não retorna nada |
| E-06 | Filtro por status | Aparece em Aberto e não em Resolvido |
| E-07 | Detalhe | Dados e histórico |
| E-08 | Edição (título, descrição, categoria) | Alterações salvas e registradas no histórico |
| E-09 | Anexar foto | URL gravada, imagem servida como `image/jpeg` |
| E-10 | Remover | Some da lista padrão e aparece em "Removidas" |
| E-11 | Editar ocorrência removida | 403 |
| E-12 | Logout | Token deixa de funcionar (401) |

**`gestor-atendimento.spec.ts`: atendimento entre cidadão e gestor**

| ID | Passo | Verifica |
|---|---|---|
| E-13 | Cidadão registra vazamento (Água e Esgoto) | Ocorrência criada |
| E-14 | Fila do gestor da COMPESA | A ocorrência foi encaminhada ao órgão certo |
| E-15 | Cidadão acessa rotas do gestor | 403 |
| E-16 | Gestor muda para "Em Andamento" | 200 |
| E-17 | Cidadão consulta a ocorrência | Novo status e registro no histórico |
| E-18 | Cidadão tenta editar e remover | 403 nos dois casos |
| E-19 | Gestor conclui ("Resolvido") | Aparece em Resolvido para o cidadão |

**`seguranca.spec.ts`: autenticação, isolamento e validação**

| ID | Caso | Verifica |
|---|---|---|
| E-20 | Rotas protegidas sem login | 401 em `/demands`, `/categories` e `/auth/me` |
| E-21 | Senha errada | 401 com mensagem genérica |
| E-22 | E-mail duplicado | 409 |
| E-23 | Cadastro como Admin | Perfil resultante `Cidadao` |
| E-24 | Isolamento entre cidadãos | O intruso não vê, não edita, não anexa foto e não remove; a ocorrência do dono fica intacta |
| E-25 | Duas sessões do mesmo usuário | O logout de uma não derruba a outra |
| E-26 | Ocorrência inválida | 400 sem campos obrigatórios e com categoria inexistente |
| E-27 | Foto que não é imagem | 400 |

### 3.4 E2E de telas — `mobile/e2e` (Maestro, 5 fluxos)

| ID | Fluxo | Passos |
|---|---|---|
| M-01 | `login_invalid_password.yaml` | Senha errada → alerta "Falha no Login" / "Credenciais inválidas." → continua na tela de login |
| M-02 | `register.yaml` | Cadastro pela tela → alerta de sucesso → login com a conta nova → lista vazia com a saudação |
| M-03 | `session_persistence.yaml` | Login → fechar e reabrir o app → continua logado |
| M-04 | `logout.yaml` | Login → Sair → tela de login → reabrir o app → continua deslogado |
| M-05 | `demand_crud.yaml` | Nova demanda (categoria, GPS simulado, foto pela câmera) → salvar → pesquisar na lista → detalhe → editar título → excluir com confirmação → some da lista |

---

## 4. Rastreabilidade: requisitos × testes

| Requisito / funcionalidade | Unitário | API | E2E (API) | E2E (telas) |
|---|---|---|---|---|
| Cadastro | — | A-10 a A-12 | E-01, E-22, E-23 | M-02 |
| Login e proteção de rotas | U-11, U-13 | A-01 a A-09 | E-20, E-21 | M-01 |
| Logout e sessões | U-12, U-14, U-15 | A-13, A-14 | E-12, E-25 | M-04 |
| Persistência de estado (useState/useEffect) | — | — | — | M-03 |
| Perfis e permissões | U-01 a U-10 | A-33 | E-15 | — |
| Criar ocorrência | — | A-20, A-21 | E-03, E-26 | M-05 |
| Listagem (FlatList) e pesquisa | U-16 a U-20 | A-15 a A-17 | E-02, E-04 a E-06 | M-05 |
| Detalhe | — | A-18, A-19 | E-07 | M-05 |
| Atualizar ocorrência | U-28 a U-30 | — | E-08, E-11, E-18 | M-05 |
| Remover ocorrência | U-21 a U-27 | A-22, A-23 | E-10, E-18 | M-05 |
| Câmera / foto | U-31 a U-35 | A-24 a A-26 | E-09, E-27 | M-05 |
| GPS (coordenadas) | — | — | E-03, E-04 | M-05 |
| Isolamento entre cidadãos | U-22, U-28, U-35 | A-19, A-23 | E-24 | — |
| Atendimento pelo gestor | — | A-28 a A-33 | E-13 a E-19 | — |

---

## 5. Problemas encontrados pelos testes

Os testes revelaram defeitos que foram corrigidos no código:

| Defeito | Onde | Teste que detectou |
|---|---|---|
| Dois logins no mesmo segundo geravam o mesmo JWT, então o logout de uma sessão derrubava a outra | `authService` | A-14, U-12, E-25 |
| Cada logout criava um timer de 24h que mantinha o processo vivo (Jest não encerrava) | `authService` | A-13/A-14 rodando isolados |
| Gestor não conseguia definir "Em Análise" nem "Em Andamento" (erro 500 no enum do Prisma) | `gestorController` | A-30, A-31, E-16 |
| Teste de logout lia um campo inexistente (`accessToken`) e passava por acaso | `logout.test.ts` | revisão da suíte |
| Fluxo Maestro esperava "E-mail ou senha incorretos.", mas o app exibe "Credenciais inválidas." | `login_invalid_password.yaml` | M-01 |
| Sem login, a lista chegava a abrir e chamava a API sem token (aviso vermelho cobria o botão "+") | `app/_layout.tsx` | M-05 |
| Após pesquisar, o primeiro toque num card só fechava o teclado | `DemandListView` | M-05 |

---

## 6. Escrevendo novos testes

**Onde colocar**

| Tipo | Pasta | Nome |
|---|---|---|
| Regra de negócio isolada | `backend/src/tests/unit/` | `<service>.test.ts` |
| Rota HTTP | `backend/src/tests/api/` | `<recurso>.test.ts` |
| Jornada ponta a ponta | `e2e/` | `<jornada>.spec.ts` |
| Fluxo de tela | `mobile/e2e/` | `<fluxo>.yaml` |

**Backend (Jest)**

- Mocke o Prisma com `jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'))` e
  controle as respostas por `prisma.<tabela>.<método>.mockResolvedValue(...)`. O mock é resetado antes de cada teste.
- Para transações, faça `prisma.$transaction.mockImplementation(async (cb) => cb(prisma))`, que executa o código
  real da transação e permite verificar o que foi gravado.
- Mocke `../../utils/cache` para não tentar conectar ao Redis.

**E2E da API (Playwright)**

- Use os helpers de [`e2e/helpers.ts`](e2e/helpers.ts): `registerAndLogin` (cria um cidadão novo),
  `login`, `createDemand`, `categoryIdByName`.
- O login roda num contexto isolado e cada sessão usa só o header `Authorization`. O backend dá prioridade
  ao cookie sobre o header, então compartilhar cookies misturaria usuários em testes com mais de uma pessoa.
- Use `test.describe.serial` quando os passos dependem uns dos outros.

**Telas (Maestro)**

- Selecione por `testID` (`id:`). A lista de IDs está no [`mobile/README.md`](mobile/README.md).
- Antes de interagir com uma tela nova, espere por um elemento dela (ex.: `id: "form-title"`), porque ela
  pode estar carregando.
- O texto digitado num campo também conta como "texto visível". Para achar um card pelo título, use
  `id: "demand-card"` com `containsChild`.
- No Android, os botões de alerta aparecem em maiúsculas: use `"(?i)remover"`.
- Evite acentos no `inputText`, porque o Maestro não os digita de forma confiável no Android.
- Reaproveite o login com `runFlow: subflows/login.yaml` (aceita `EMAIL` e `PASSWORD` por `env`).

---

## 7. Limitações

- **Câmera no emulador:** a foto capturada sai preta (limitação da câmera virtual com o CameraX). O fluxo
  M-05 ainda valida que a câmera abre, captura e a prévia aparece; o conteúdo da imagem só pode ser
  conferido em aparelho real.
- **Dados de teste:** os E2E deixam cidadãos `*@teste.fiscalize` e suas ocorrências no banco. Para limpar,
  recrie o banco (`npx prisma migrate reset`, que apaga tudo) e rode o seed de novo.
- **Maestro:** os fluxos precisam do app de debug instalado e de um emulador ou aparelho conectado;
  por isso eles ficam fora do `npm test`.
