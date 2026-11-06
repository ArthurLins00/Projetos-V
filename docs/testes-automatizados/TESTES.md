# Documentação de testes — Fiscalize

Este documento descreve a estratégia, o ambiente, os comandos e o catálogo completo dos testes
automatizados do projeto (backend, app mobile e agente de IA).

**Situação em 05/11/2026:** 420 testes automatizados: 128 unitários e
233 de API (executados nesta data, todos passando, com cobertura do backend de 93% das linhas e 83% dos
branches), além de 36 E2E (Playwright) e 23 do agente de IA (cliente roteirizado) e 3 fluxos de tela (Maestro)
no emulador do CI, conforme a última execução da pipeline. Outros 2 fluxos Maestro estão em `mobile/e2e/pending/` (veja a seção 2) e 10 testes do agente
rodam ao vivo contra o Gemini só na regressão diária.

---

## 1. Estratégia

A suíte segue a **pirâmide de testes**: muitos testes rápidos e isolados na base e poucos testes lentos
e completos no topo.

```
                ┌──────────────────────────┐
                │ E2E de telas (Maestro) 3 │  app real no emulador
              ┌─┴──────────────────────────┴─┐
              │ E2E da API (Playwright) 36   │  backend + banco reais
            ┌─┴──────────────────────────────┴─┐
            │ API (Jest + Supertest) 233       │  rotas HTTP, banco mockado
          ┌─┴──────────────────────────────────┴─┐
          │ Unitários (Jest) 128                 │  regras de negócio isoladas
          └──────────────────────────────────────┘
```

O agente de IA (`ai-agent/`) tem a própria suíte: 23 testes com o Gemini substituído por um cliente roteirizado
e 10 testes ao vivo contra o Gemini (seção 3.5).

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
npm install
npm install --prefix backend
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
  existentes e podem rodar em paralelo. Os únicos dados do seed usados são as categorias e o gestor (`gestor@fiscalize.gov.br`).
- O relatório HTML fica em `e2e-report/` e os artefatos em `test-results/` (ambos fora do git).

### Detalhes do E2E de telas (Maestro)

Deixe no ar o emulador com o app de debug instalado (`npx expo run:android` em `mobile/`), o Metro
(`npx expo start`) e o backend com seed. Depois use uma das opções:

- **CLI:** instale o Maestro (https://maestro.mobile.dev) e rode `npm run test:e2e:mobile`;
- **Maestro Studio:** abra a pasta `mobile/e2e` e execute cada fluxo.

No GitHub Actions, o workflow **E2E Mobile (Maestro)** (`.github/workflows/mobile-e2e.yml`) roda todos os fluxos
na regressão diária (veja a seção 2.1) e também pode ser disparado pela aba Actions. Ele
compila o app de debug, sobe o backend com seed, o Metro e um emulador Android, e publica o relatório JUnit e as
capturas como artefato `maestro-report`. Não roda no push nem nos PRs, porque leva dezenas de minutos.
Antes dos fluxos, o script `.github/scripts/run-maestro.sh` faz um aquecimento e reinicia o emulador se o Maestro
não enxergar o app. Os fluxos rodam uma vez só, sem nova tentativa automática (como o Playwright, `retries: 0`):
a primeira falha reprova o job e abre a issue ([política da TAS, seção 5.4](tas.md)).

Os fluxos de `mobile/e2e/subflows/` (login) são chamados pelos outros e não rodam sozinhos
(configurado em `mobile/e2e/config.yaml`).

Os fluxos em `mobile/e2e/pending/` (`register.yaml` e `demand_crud.yaml`) estão falhando no emulador do CI e
ficam fora do CI e da regressão até serem corrigidos. Para rodar um deles: `maestro test mobile/e2e/pending/<fluxo>.yaml`.

### 2.1 Pipeline no GitHub Actions

Cada etapa do desenvolvimento roda um conjunto diferente de testes:

| Evento | Workflow | O que roda |
|---|---|---|
| Push em branch de trabalho | `push.yml` | Unitários e de API do backend; testes do agente de IA com cliente roteirizado (e typecheck do mobile, pelo `mobile.yml`, quando `mobile/` muda) |
| Pull request para `main` ou `dev` (antes do merge) | `ci.yml` | Unitários e de API; **testes smoke E2E do Playwright**; build do backend; typecheck do mobile; testes do agente de IA com cliente roteirizado; **Política da TAS** (`.only`, testes desligados sem quarentena e rastreabilidade do catálogo); **Contrato da API** (`contrato-api.yml`: toda rota do Express documentada no Swagger e vice-versa, e rota protegida documentada com `security`); **Links da documentação** (links internos e âncoras de todos os `.md`) |
| Push em `main` ou `dev` (depois do merge) | `ci.yml` | O mesmo do PR, mas com **todos** os E2E do Playwright |
| Todo dia às 03h (Brasília) ou manual | `regressao.yml` | **Suíte completa**: unitários, de API, todos os E2E do Playwright, build, typecheck do mobile, agente de IA (inclusive ao vivo contra o Gemini) e todos os fluxos Maestro de `mobile/e2e/` no emulador |
| Fim do CI/CD e da regressão | `quality-report.yml` | Métricas de qualidade e relatórios técnico e de negócio em HTML (seção 2.2) |
| Todo dia às 07h (Brasília), ou manual | `seguranca-diaria.yml` | Roda o `seguranca.yml` e mantém **uma** issue com as pendências de segurança e o que fazer em cada uma, com a label `segurança`, a milestone de Segurança e atribuída a `victorsimasdev`: cria quando surge o primeiro item, atualiza o corpo todo dia, comenta só quando um item aparece ou é resolvido e fecha quando não sobra nada |
| PR e push em `main`/`dev`, ou manual | `seguranca.yml` | Varredura de segurança fora do Quality Gate: `npm audit`, segredos no código e no histórico (gitleaks), análise estática (Semgrep, regras OWASP) e os controles de [Segurança](../seguranca-da-informacao/README.md) conferidos no código; relatório em HTML e XML (seção 2.2) |
| PR e push em `main`/`dev`, ou manual | `relatorio-tecnico.yml` | Relatório técnico do projeto fora do Quality Gate: tecnologias com versão, onde são usadas e as justificativas dos READMEs de `docs/`, rotas da API, modelo de dados, telas, testes e workflows, em HTML e XML (seção 2.2) |
| PR e push em `main`/`dev` que mudam `compose.yaml`, `backend/`, `ai-agent/` ou `e2e/`; regressão diária; manual | `docker.yml` | Ambiente do Docker ([guia](../COMO_RODAR_COM_DOCKER.md)): constrói as imagens, sobe PostgreSQL, Redis e backend com `docker compose up --wait`, confere `/health` e os logins do seed, sobe o agente de IA na rede interna e roda os E2E do Playwright contra os containers |
| Release publicada no GitHub, ou manual | `mobile-release.yml` | Build do app Android no EAS: APK (perfil `preview`) ou AAB (`production`, só no manual); publica no artefato e, numa release, anexa o arquivo à própria release. Precisa do secret `EXPO_TOKEN` |
| Todo dia às 07h (Recife) | Dependabot (`.github/dependabot.yml`) | PR quando há versão mais nova, atribuído a `victorsimasdev`: por pasta, um PR com as atualizações minor e patch e outro com as major (backend, agente, E2E, app e actions). No app, Expo, React e React Native só recebem patch, para continuar alinhados ao SDK; `@types/node` fica na linha do Node 22. As branches `dependabot/**` não rodam o `push.yml` (o PR já roda o CI/CD) e falha nelas não abre issue de CI: o PR vermelho já diz "não aceite" |
| Dias úteis às 09h e dias 1 e 15 às 10h (Brasília), ou manual | `tas-manutencao.yml` | Política de manutenção da TAS ([`docs/testes-automatizados/tas.md`](tas.md)): prazos vencidos, quarentenas sem decisão e a issue da revisão periódica |

Como a equipe trabalha com forks, o `push.yml` roda no fork de quem fez o push; para isso, o GitHub Actions precisa
estar habilitado no fork (aba Actions → *I understand my workflows, go ahead and enable them*). Os eventos de PR,
de push em `main`/`dev` e o agendamento rodam no repositório principal.

Os workflows `backend.yml`, `ai-agent.yml`, `mobile.yml` e `mobile-e2e.yml` são reutilizáveis: quem chama
decide o nível. O backend recebe `e2e: none | smoke | full`, o agente recebe `live: true | false` e o Maestro
recebe `flows` (a pasta inteira ou uma lista de fluxos).

**Testes smoke E2E (antes do merge):** só os testes `@smoke` do Playwright, escolhidos por exercitarem o caminho
principal. O restante dos E2E do Playwright roda no push em `main`/`dev`, e os fluxos Maestro só na regressão diária.

| Teste | Onde | Por que é smoke |
|---|---|---|
| Isolamento entre cidadãos (E-24) | `e2e/seguranca.spec.ts`, tag `@smoke` | Em um único teste independente cobre cadastro, login, criação de ocorrência e as regras de acesso entre cidadãos, contra o banco real |
| Login com senha errada (M-01) | `mobile/e2e/login_invalid_password.yaml` | Confirma que o app abre, fala com o backend e trata o erro de login |
| Sessão mantida ao reabrir o app (M-03) | `mobile/e2e/session_persistence.yaml` | Sem a sessão salva o cidadão precisaria entrar a cada abertura |

Para rodar só o smoke do Playwright localmente: `npm run test:e2e -- --grep @smoke`. O `register.yaml` (M-02) e o
`demand_crud.yaml` (M-05) estão em `mobile/e2e/pending/`, fora do CI até serem corrigidos.

**Agendamento:** o cron do GitHub é em UTC (`0 6 * * *` = 03h em Brasília) e é *best-effort*: em horários de alta
demanda pode atrasar ou não rodar. Por isso a regressão também pode ser disparada pela aba Actions → *Regressão
completa (diária)* → *Run workflow*.

**Quality Gate:** o job **CI concluído** do `ci.yml` falha se qualquer job do PR falhar ou for cancelado, inclusive os
jobs **Política da TAS**, **Contrato da API** e **Links da documentação** (os relatórios de qualidade, de segurança e
técnico ficam de fora: informam, não bloqueiam). O `docker.yml` é um workflow à parte, que só roda quando os arquivos
das imagens mudam; ele não é exigido pelo ruleset, mas a falha abre issue como as demais. O **CI concluído** é o
único check obrigatório no ruleset `main` do repositório `ArthurLins00/Projetos-V`, que vale para as branches
`main` e `dev` (Settings → Rules → Rulesets):

- *Enforcement status*: **Active**;
- *Restrict deletions* e *Block force pushes*;
- *Require a pull request before merging*, com 1 aprovação;
- *Require status checks to pass*, com o check **CI concluído** (fonte GitHub Actions) e *Require branches to be up
  to date before merging*.

O nome do check é o `name` do job (**CI concluído**), não o nome do arquivo `ci.yml`: um check com o nome do arquivo
nunca é reportado e travaria todos os merges. Com a regra ativa, o botão de merge fica bloqueado até o check passar.

### 2.2 Registro de falhas, artefatos e relatórios de qualidade

**Issues automáticas:** o workflow `ci-failure-issues.yml` abre uma issue com a label `ci-failure` para cada execução
que falhar (CI/CD, push, regressão, Maestro etc.), com os jobs e passos que falharam e o trecho do log. Ela recebe
`area: backend | mobile | mobile-e2e | ai-agent` pelo job que falhou, `classificação: pendente` e `prioridade: alta`
quando a falha é em `main`, `dev` ou na regressão diária (`prioridade: média` nos demais casos), com o prazo e os
passos de encaminhamento da política da TAS ([`docs/testes-automatizados/tas.md`](tas.md), seções 3 e 4). Quando o mesmo workflow
volta a passar na mesma branch com um commit novo, as issues abertas dele são fechadas com um comentário; se passar
no **mesmo commit** que falhou, a issue continua aberta com a label `teste instável` (seção 5 da política). Essas
datas de abertura e fechamento são a base do MTTR (MQ-06).

**Artefatos de cada execução** (aba *Actions* → execução → *Artifacts*):

| Artefato | Conteúdo | Para que serve | Retenção |
|---|---|---|---|
| `backend-test-reports` | resultado dos testes unitários e de API em JSON do Jest e JUnit XML; cobertura em HTML, Cobertura XML, `coverage-summary.json` e `coverage-final.json` | investigar falhas, navegar pela cobertura linha a linha e calcular a cobertura combinada (MQ-02) | 7 dias |
| `e2e-report` | relatório HTML do Playwright, `e2e-junit.xml`, `trace.zip` de cada teste que falhou e o `backend.log` | reproduzir uma falha do E2E passo a passo | 7 dias |
| `maestro-report` | `maestro-report.xml`, capturas de tela e árvore de elementos, `logcat.txt`, `backend.log`, `metro.log` | ver em que tela o fluxo parou e o que o app e o backend registraram | 7 dias |
| `app-debug-x86_64` | o APK testado pelo Maestro | instalar no emulador e reproduzir à mão | 3 dias |
| `ai-agent-test-reports` | JUnit dos testes do agente (sem rede e, na regressão, ao vivo contra o Gemini) | ver qual caso do agente falhou | 7 dias |
| `dependencias` | SBOM CycloneDX e `npm audit` em JSON de cada projeto | inventário de dependências e vulnerabilidades (MQ-08) | 30 dias |
| `relatorios-qualidade` | `relatorio-tecnico.html`, `relatorio-negocio.html`, `index.html` e `metrics.json` | os relatórios de qualidade desta execução | 30 dias |
| `catalogo-testes` | `relatorio-tecnico.html`, `relatorio-negocio.html`, `index.html` e `catalogo-testes.json` | rastreabilidade: quanto do plano está automatizado por HU e a lista de testes com o caso de cada um | 30 dias |
| `quality-history` | `history.json` com o resumo das últimas 60 execuções em `main` | tendência dos relatórios seguintes | 90 dias |
| `relatorio-seguranca` | `relatorio-seguranca.html` (em linguagem simples, com o que fazer), `seguranca.xml` (todos os achados estruturados), `seguranca-junit.xml` (cada achado grave como teste que falha) e os JSON brutos do `npm audit`, gitleaks e Semgrep | situação de segurança: bibliotecas vulneráveis, segredos (valores nunca publicados), padrões inseguros no código e controles do projeto | 30 dias |
| `relatorio-tecnico-projeto` | `relatorio-tecnico-projeto.html` e `tecnologias.xml` | visão técnica do projeto: cada tecnologia com versão, onde é usada, por que foi escolhida e o que foi descartado, além de rotas, modelo de dados, telas, testes e workflows | 30 dias |
| `contrato-api` | `contrato-api.json`, `contrato-api-junit.xml` (uma rota por caso) e o `openapi.json` exportado | rotas sem documentação, documentadas e inexistentes, ou protegidas sem `security` no Swagger | 30 dias |
| `docker-e2e` | `docker-compose.log` (todos os containers), `health.json`, relatório HTML e JUnit do Playwright | investigar uma falha do ambiente do Docker | 7 dias |
| `app-android` | `fiscalize-<versão>-<perfil>.apk` (ou `.aab`) gerado pelo EAS | instalar o app sem compilar; numa release, o mesmo arquivo fica anexado a ela | 30 dias |

O relatório de segurança e o relatório técnico são **informativos**: ficam fora do check **CI concluído** e nunca
reprovam a execução. Os controles de segurança verificados estão em `.github/scripts/security/controls.mjs` e o
mapa entre tecnologias, seções dos READMEs e pacotes em `.github/scripts/tech-report/tecnologias.mjs`; ao
documentar uma tecnologia nova num README de `docs/`, acrescente-a nesse mapa (dependências fora dele aparecem
no relatório como "sem seção na documentação"). Falsos positivos do gitleaks vão para o `.gitleaks.toml` (ou um
comentário `gitleaks:allow` na linha) e os do Semgrep, para um comentário `nosemgrep` com o motivo.

**Métricas e relatórios:** o último job do CI/CD e da regressão diária (**Relatório de qualidade**,
`.github/workflows/quality-report.yml`) lê os artefatos acima e a API do GitHub e calcula as métricas MQ-01 a MQ-08.
As métricas escolhidas, as descartadas e as justificativas estão em
[`docs/testes-automatizados/Metricas_de_Qualidade.md`](Metricas_de_Qualidade.md). O job gera:

- **Relatório técnico** (`relatorio-tecnico.html`): métricas contra as metas, resultado por suíte, falhas com a
  mensagem, testes instáveis, cobertura e arquivos menos cobertos, jobs e estatísticas da pipeline em 30 dias,
  issues abertas, pacotes vulneráveis e testes mais lentos;
- **Relatório de negócio** (`relatorio-negocio.html`): saúde da versão (verde, amarelo ou vermelho), funcionalidades
  verificadas por área do produto, riscos em linguagem simples com recomendação e a evolução ao longo do tempo;
- um resumo com as métricas no sumário da execução.

O job fica fora do Quality Gate e nunca falha a execução: o relatório informa, quem decide o merge são os testes.
Para gerar os relatórios localmente a partir dos artefatos de uma execução:

```bash
gh run download <id-da-execucao> -D artifacts
node .github/scripts/quality/collect-metrics.mjs --artifacts artifacts --out quality-report
node .github/scripts/quality/render-reports.mjs --in quality-report
```

Com `GITHUB_REPOSITORY`, `GITHUB_TOKEN` e `SOURCE_RUN_ID` definidos, também entram as métricas que dependem da API
(MQ-04 a MQ-07).

---

## 3. Catálogo de testes

### 3.1 Unitários — `backend/src/tests/unit` (128)

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
| U-31 | Upload de JPEG válido | Arquivo salvo e foto registrada em `chamado_foto` |
| U-32 | Upload com prefixo `data:image/jpeg;base64,` | Aceito |
| U-33 | Upload de conteúdo que não é imagem | 422 (valida a assinatura do arquivo, não a extensão) |
| U-34 | Remoção de foto | Registro e arquivo apagados |
| U-35 | Upload em ocorrência de outra pessoa | 403 |
| U-36 | Upload além do limite de 5 fotos | 400 |

**`authService.test.ts`: refresh token (HU-01 / HU-02)**

| ID | Caso | Esperado |
|---|---|---|
| U-37 | Login grava o refresh token | Só o hash SHA-256 vai para o banco, nunca o token |
| U-38 | Duas renovações simultâneas com o mesmo token | A segunda falha com 401 e não emite novo token |
| U-39 | Reuso de refresh já trocado por rotação | 401 e todas as sessões ativas do usuário são revogadas |
| U-40 | Uso de refresh revogado por logout | 401 sem derrubar as outras sessões |
| U-41 | Logout revoga refresh token | Só se o token for do próprio usuário |
| U-42 | Recuperação de senha | Revoga todos os refresh tokens do usuário |

**`demandService.test.ts`: região e fotos (complemento)**

| ID | Caso | Esperado |
|---|---|---|
| U-43 | Criação com região | Estado, cidade e zona gravados e devolvidos no formato da API |
| U-44 | Alterar fotos de ocorrência em andamento | 403 |
| U-45 | Remoção de foto inexistente | 404 |

**`notificationService.test.ts`: notificações (HU-05)**

| ID | Caso | Esperado |
|---|---|---|
| U-46 | Mudança de status sem aparelho registrado | Notificação registrada, e-mail enviado ao cidadão e push não chamado |
| U-47 | Push para os aparelhos do cidadão (duplo do Expo Push) | Push enviado; tokens que não existem mais são removidos |
| U-48 | E-mail ou push falhando (provedor fora do ar) | Só gera log; o fluxo não é interrompido |
| U-49 | Chamado inexistente | Nada é registrado nem enviado |
| U-50 | Registro do token de push | Token Expo válido gravado; formato inválido recusado |

**`authController.test.ts`: validação de entrada do controller de autenticação, com o `authService` substituído por duplo (TC-73)**

| ID | Caso | Esperado |
|---|---|---|
| U-51 | 22 entradas inválidas (cadastro, login, 2FA, refresh, recuperação de senha, perfil, foto, push, termos) | 400 com a mensagem do campo |
| U-52 | 8 rotas da conta chamadas sem usuário autenticado | 401 |
| U-53 | Cadastro válido | 201 sem a senha |
| U-54 | Login com 2FA ativo | Devolve o desafio (e o código em demonstração), sem cookie |
| U-55 | Login sem 2FA | Sessão aberta com cookie `httpOnly`/`strict` que expira junto com o token |
| U-56 | Código 2FA com espaços | Aceito depois do `trim` |
| U-57 | Reenvio do código 2FA | Código só aparece quando o serviço devolve (modo demonstração) |
| U-58 | Refresh | Cookie renovado e novo par de tokens |
| U-59 | Recuperação e redefinição de senha | E-mail e código normalizados antes do serviço |
| U-60 | Logout com header e refresh token | Cookie limpo, token na blocklist e refresh revogado |
| U-61 | Logout sem token | Só limpa o cookie |
| U-62 | `GET /auth/me` | Perfil sem a senha |
| U-63 | 2FA, foto, termos, push e perfil | Repassados ao serviço com os dados normalizados (push responde 204) |
| U-64 | Erro do serviço | Repassado ao middleware de erro |

**`metricsAndCache.test.ts`: indicadores operacionais e cache Redis (TC-67)**

| ID | Caso | Esperado |
|---|---|---|
| U-65 | Tempo médio de atendimento | Só chamados com evento Resolvido/Fechado; média arredondada para 1 casa |
| U-66 | Nenhum chamado concluído | `media_horas` nulo; escopo do órgão respeitado |
| U-67 | Distribuição por categoria | Inclui categorias sem chamados; percentual com 1 casa |
| U-68 | Nenhum chamado | 0%, sem divisão por zero |
| U-69 | Total de demandas | Contagem por status |
| U-70 | Valor em cache | Devolvido sem consultar o banco |
| U-71 | Cache vazio | Calcula e grava com TTL de 5 minutos |
| U-72 | Sem Redis configurado | Leitura, gravação e remoção viram no-op |
| U-73 | Redis falhando | Nunca derruba a requisição |
| U-74 | Valor ausente ou JSON inválido | `null` |
| U-75 | Invalidação | Apaga as chaves da plataforma e, com gestor, também as dele |
| U-76 | Chaves de escopo e de snapshot | Formato esperado |

**`redis.test.ts`: cliente Redis opcional (TC-67)**

| ID | Caso | Esperado |
|---|---|---|
| U-77 | Sem `REDIS_URL` | Cliente nulo e Redis indisponível |
| U-78 | Com `REDIS_URL` | Um único cliente, sem fila offline, com poucas tentativas |
| U-79 | Falha na conexão inicial | Só aviso no log |
| U-80 | `PING` | `PONG` = disponível; erro = indisponível |

**`errorMiddleware.test.ts`: tradução de erros em respostas HTTP (TC-70)**

| ID | Caso | Esperado |
|---|---|---|
| U-81 | `AppError` | Status do erro; `details` só quando existe |
| U-82 | 8 erros conhecidos do Prisma | 409, 404, 400 ou 503 com o código |
| U-83 | Erro desconhecido do Prisma | 500 genérico |
| U-84 | Token expirado, JWT inválido, validação, e-mail duplicado, corpo grande | 401, 401, 400, 409, 413 |
| U-85 | `asyncHandler` | Rejeição encaminhada ao `next` |

**`mailFrom.test.ts`: remetente dos e-mails (`resolveMailFrom`)**

| ID | Caso | Esperado |
|---|---|---|
| U-86 | `MAIL_FROM` com endereço | Mantido |
| U-87 | `MAIL_FROM` só com o nome | Usa a conta do SMTP |
| U-88 | `MAIL_FROM` vazio | Nome padrão com a conta do SMTP |
| U-89 | Sem conta do SMTP | Endereço no-reply |

### 3.2 API — `backend/src/tests/api` (233)

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
| A-08 | Token expirado | 401 "Token expirado" com `code: "token_expired"` |
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
| A-25 | Foto que não é imagem | 422 |
| A-26 | Foto maior que 100 KB | Aceita pela rota (limite ampliado para fotos) e chega à validação (422) |
| A-27 | Listar categorias | 200 com as categorias ativas |

**`gestorChamados.test.ts`: `PUT /gestor/chamados/:id/status`**

| ID | Caso | Esperado |
|---|---|---|
| A-28 | Status válido | 200 |
| A-29 | Status inexistente ("Finalizado") | 400 |
| A-30 | "Em Análise" | Gravado no banco como `Em_An_lise` |
| A-31 | "Em Andamento" | Gravado no banco como `Em_Andamento` |
| A-32 | Chamado inexistente | 404 |
| A-33 | Chamado de qualquer órgão | 200 (gestor não é vinculado a órgão) |

**`refreshToken.test.ts`: sessão com access e refresh token (HU-01 / HU-02)**

A tabela `refresh_token` é simulada em memória para que a rotação seja verificada entre as chamadas.

| ID | Caso | Esperado |
|---|---|---|
| A-34 | Login (TC-01) | Access token de 15 min e refresh token de 30 dias, guardado só como hash |
| A-35 | Refresh válido (TC-03) | 200 com novo par; o refresh usado é revogado e o novo access token é aceito em `/auth/me` |
| A-36 | Refresh expirado (TC-04) | 1 s antes do vencimento é aceito; 1 s depois retorna 401 |
| A-37 | Refresh reutilizado após logout (TC-05) | 401 |
| A-38 | Duas sessões do mesmo usuário | O logout de uma (e o reuso do refresh dela) não revoga o refresh da outra |
| A-39 | Reuso de refresh já trocado | 401 e todas as sessões do usuário deixam de renovar |
| A-40 | Usuário inativado | 403 ao renovar |
| A-41 | Sem o campo `refreshToken` / token desconhecido | 400 / 401 |

**`logout.test.ts`: logout sem token válido (TC-09)**

| ID | Caso | Esperado |
|---|---|---|
| A-42 | Logout sem token, com token expirado ou malformado | 401 (expirado com `code: "token_expired"`), nunca 500 |
| A-43 | Logout repetido com token já revogado | 401 |

**`demands.test.ts`: limites da foto, roteamento e payload**

| ID | Caso | Esperado |
|---|---|---|
| A-44 | Corpo exatamente no limite de 15 MB (TC-12) | Passa pelo parser e chega à validação da imagem (422) |
| A-45 | Corpo 1 byte acima do limite (TC-12) | 413 e nada é gravado |
| A-46 | Foto em demanda inexistente (TC-13) | 404 e nada é gravado |
| A-47 | Chamado sem coordenadas (TC-17) | 201, roteado pela categoria |
| A-48 | Regra e vínculo apontando para órgão inativo (TC-44) | O chamado nunca é encaminhado ao órgão inativo |
| A-49 | Payload da listagem (TC-28) | Sem relacionamentos completos do Prisma; `creator` e `category` só com os campos da API; só a capa em `photoUrl` |

**`cors.test.ts`: CORS do app nativo e whitelist do painel (HU-09)**

| ID | Caso | Esperado |
|---|---|---|
| A-50 | Sem header `Origin` (app nativo) (TC-36) | Processada normalmente |
| A-51 | `Origin` da whitelist (TC-37) | `Access-Control-Allow-Origin` com a origem e `Allow-Credentials` |
| A-52 | Preflight da `Origin` da whitelist (TC-37) | 204 liberando `POST` e o header `Authorization` |
| A-53 | `Origin` fora da whitelist (TC-38) | Sem `Access-Control-Allow-Origin`, na requisição simples e no preflight |

**`errorHandling.test.ts`: erro inesperado (TC-27)**

| ID | Caso | Esperado |
|---|---|---|
| A-54 | Erro 500 com `NODE_ENV` `production` ou `test` | Mensagem padrão, sem `stack` e sem a mensagem interna do erro |
| A-55 | Erro 500 em `development` | Inclui o `stack` para depuração local |

**`authRegister.test.ts`: validação do cadastro (TC-41)**

| ID | Caso | Esperado |
|---|---|---|
| A-56 | Campo ausente, e-mail sem `@` ou sem domínio, senha com 5 caracteres | 400 e nada é gravado |
| A-57 | Senha com 6 e 7 caracteres | 201 |

**`demands.test.ts`: região e remoção de foto (complemento)**

| ID | Caso | Esperado |
|---|---|---|
| A-58 | Região inválida: UF inexistente, cidade só com espaços, zona fora de Urbana/Rural (TC-59) | 400 |
| A-59 | `DELETE /demands/:id/photos/:photoId` | 204 |

**`gestorChamados.test.ts`: gestão de chamados (complemento, TC-62)**

| ID | Caso | Esperado |
|---|---|---|
| A-60 | Admin altera o status | 200 |
| A-61 | Cidadão altera o status | 403 |
| A-62 | `GET /gestor/chamados` | Chamados de todos os órgãos; filtro "meus" aplicado |
| A-63 | Aceitar com responsável que não é gestor | 400 |
| A-64 | Aceitar o chamado | Atribuído a quem aceitou |
| A-65 | Comentário sem mensagem | 400 |
| A-66 | Comentário válido | Mensagem registrada no histórico |

**`adminUsers.test.ts`: gestão de usuários pelo admin (TC-54)**

| ID | Caso | Esperado |
|---|---|---|
| A-67 | `GET /admin/users` com busca | Lista filtrada por nome ou e-mail |
| A-68 | `GET /admin/users` como gestor | 403 |
| A-69 | Promover cidadão a gestor | Perfil alterado e registro de gestor criado |
| A-70 | Rebaixar gestor a cidadão | Perfil alterado e registro de cidadão garantido |
| A-71 | Alterar o perfil de outro admin | 403 |
| A-72 | Promover a Admin | 400 |
| A-73 | Mudança de perfil sem novo login | O token antigo já passa a acessar `/gestor` |

**`aiChat.test.ts`: assistente `/ai/chat` (TC-55)**

| ID | Caso | Esperado |
|---|---|---|
| A-74 | Sem token | 401 |
| A-75 | Mensagem ausente, com mais de 1000 caracteres ou `sessionId` inválido | 400 |
| A-76 | Chamada válida | Repassa o token do usuário e prende a sessão ao id dele |
| A-77 | Serviço do agente fora do ar | 503 |
| A-78 | Agente falha ao consultar o modelo | 502 |

**`notifications.test.ts`: tela de notificações (TC-53)**

| ID | Caso | Esperado |
|---|---|---|
| A-79 | Listagem | Da mais recente para a mais antiga, com o total de não lidas |
| A-80 | `?unread=true` | Só as não lidas |
| A-81 | Marcar como lida | Só se a notificação for do próprio usuário |
| A-82 | Notificação de outra pessoa ou id inválido | 404 |
| A-83 | Marcar todas como lidas | Todas marcadas |
| A-84 | Sem token | 401 |

**`passwordReset.test.ts`: recuperação de senha (TC-49)**

| ID | Caso | Esperado |
|---|---|---|
| A-85 | Código correto | Código enviado por e-mail e senha redefinida |
| A-86 | E-mail inexistente | 200, sem enviar e-mail (não revela contas) |
| A-87 | Código incorreto e reuso do código | 400 nos dois casos |
| A-88 | Limite de tentativas excedido | Código invalidado (400) |
| A-89 | Nova senha curta | 400 |

**`profile.test.ts`: `PUT /auth/me` (TC-50)**

| ID | Caso | Esperado |
|---|---|---|
| A-90 | Alterar o nome | Atualizado sem exigir a senha atual |
| A-91 | Alterar o e-mail com a senha atual correta | Atualizado |
| A-92 | Trocar a senha | Novo hash gravado |
| A-93 | Alterar o e-mail sem a senha atual | 400 |
| A-94 | Senha atual incorreta | 401 |
| A-95 | E-mail já usado por outra conta | 409 |
| A-96 | Corpo vazio, nome só com espaços, e-mail inválido ou senha curta | 400 |
| A-97 | Sem token | 401 |

**`profilePhoto.test.ts`: foto de perfil `/auth/me/photo` (TC-51)**

| ID | Caso | Esperado |
|---|---|---|
| A-98 | Enviar foto | Grava a nova, retorna `fotourl` e apaga a anterior |
| A-99 | Arquivo que não é imagem | 422 |
| A-100 | Sem o campo `photo` | 400 |
| A-101 | Corpo maior que 100 KB | Aceito |
| A-102 | Sem token | 401 |
| A-103 | `DELETE` | Foto e arquivo removidos |
| A-104 | `GET /auth/me` | Inclui `fotourl` |

**`terms.test.ts`: termos de uso `/auth/me/terms` (TC-52)**

| ID | Caso | Esperado |
|---|---|---|
| A-105 | Login de quem nunca aceitou | `termosversao` nula |
| A-106 | Aceite | Versão e data gravadas |
| A-107 | Aceite de versão já aceita ou menor | Não regride nem regrava |
| A-108 | Versão ausente, zero, decimal ou texto | 400 |
| A-109 | Sem token | 401 |
| A-110 | `GET /auth/me` | Inclui `termosversao` |

**`demands.test.ts` e `gestorChamados.test.ts`: filtros por categoria e região (TC-74)**

| ID | Caso | Esperado |
|---|---|---|
| A-111 | `GET /demands` com status, pesquisa, categoria, UF, cidade e zona | Todos combinados (`AND`), UF em maiúsculas, cidade sem diferenciar maiúsculas |
| A-112 | Categoria, UF ou zona inválidas | 400 |
| A-113 | `GET /gestor/chamados` com pesquisa, categoria, UF e zona | Filtros combinados com a pesquisa |
| A-114 | UF inválida na fila do gestor | 400 e nada consultado |

**`adminOrgans.test.ts`: órgãos `/admin/organs` (TC-64)**

| ID | Caso | Esperado |
|---|---|---|
| A-115 | Listagem por gestor | SLA padrão e nomes das categorias |
| A-116 | Filtro `status=inativo` | Consulta só inativos |
| A-117 | Filtro de status desconhecido | 400 |
| A-118 | Cidadão | 403 |
| A-119 | Cadastro | 201, tipo Municipal por padrão, categorias vinculadas e auditoria `organ_created` |
| A-120 | Cadastro sem campos obrigatórios | 400 e nada gravado (defeito corrigido, seção 5) |
| A-121 | Sigla já cadastrada | 409 |
| A-122 | Nome já cadastrado | 409 |
| A-123 | Cadastro por gestor | 403 |
| A-124 | Edição | Dados e categorias substituídos; auditoria `organ_edited` |
| A-125 | Edição removendo todas as categorias | Nenhum vínculo novo |
| A-126 | Edição de órgão inexistente | 404 |
| A-127 | Nome em uso por outro órgão | 409 e nada alterado |
| A-128 | Inativação | Novo status devolvido |
| A-129 | Status desconhecido | 400 |
| A-130 | Status de órgão inexistente | 404 |
| A-131 | Categorias do órgão | Lista id e nome |
| A-132 | Categorias de órgão inexistente | 404 |
| A-133 | Erro inesperado do banco | 500 sem a mensagem interna |

**`adminRoutingRules.test.ts`: regras de competência (TC-65) e ciclo de vida dos usuários (TC-66)**

| ID | Caso | Esperado |
|---|---|---|
| A-134 | Criar regra sem SLA | Herda o SLA do órgão (201) |
| A-135 | Criar com SLA e órgão secundário | Valores informados gravados |
| A-136 | Sem categoria; prioridade inválida | 400 e nada gravado |
| A-137 | Categoria inexistente | 404 |
| A-138 | Órgão principal inexistente; inativo | 404; 400 |
| A-139 | Órgão secundário inexistente | 404 |
| A-140 | Categoria não vinculada ao órgão | 400 |
| A-141 | Regra duplicada | 409 |
| A-142 | Listagem por órgão e categoria | Órgão principal ou secundário; paginação |
| A-143 | Edição parcial | Só os campos enviados |
| A-144 | Troca de categoria, subcategoria e órgão | Duplicata verificada excluindo a própria regra |
| A-145 | Edição de regra inexistente | 404 |
| A-146 | Edição com categoria/órgão inválidos ou duplicata | 404, 400 ou 409 e nada alterado |
| A-147 | Edição com secundário inexistente | 404 |
| A-148 | Remoção | Regra apagada |
| A-149 | Remoção de regra inexistente | 404 |
| A-150 | Desativar usuário | Status anterior registrado na auditoria |
| A-151 | Reativar usuário | Auditoria `user_activated` |
| A-152 | Ativar já ativo, desativar já inativo, ativar ou desativar admin | 409 ou 403 e nada alterado |
| A-153 | Usuário inexistente | 404 |
| A-154 | Admin se desativando | 403 "não pode se desativar" |
| A-155 | Criar gestor | Ativo, senha criptografada e registro de gestor |
| A-156 | Criar com campos faltando ou perfil Admin | 400 |
| A-157 | E-mail já cadastrado | 409 |
| A-158 | Mudar perfil: inválido, igual, o próprio, inexistente | 400, 409, 403, 404 |
| A-159 | `GET /admin/audit-logs` | Filtro por ação e admin, com paginação |

**`metricsHealthUsers.test.ts`: métricas (TC-67), health check (TC-68), usuários e categorias (TC-69)**

| ID | Caso | Esperado |
|---|---|---|
| A-160 | `GET /metrics/total-demands` | Totais por status, escopo plataforma |
| A-161 | `GET /metrics/demands-by-category` | Distribuição com percentual |
| A-162 | `GET /metrics/average-response-time` | Média em horas (nula sem concluídos) |
| A-163 | Cidadão nas métricas | 403 |
| A-164 | Banco falhando nas 3 rotas | 500 |
| A-165 | `/health` com banco no ar | 200 `ok`; Redis `unavailable` quando não responde |
| A-166 | `/health` com banco fora | 503 `degraded` |
| A-167 | `GET /users` | Paginação e campos da API |
| A-168 | `GET /users/:id` | Usuário encontrado |
| A-169 | ID fora do formato UUID; inexistente | 400; 404 |
| A-170 | `GET /users` com banco falhando | 500 |
| A-171 | `GET /categories/:id` | Categoria ativa |
| A-172 | ID não numérico; inexistente ou inativa | 400; 404 |
| A-173 | `GET /categories` com banco falhando | 500 |

**`gestorFluxos.test.ts`: painel e fila (TC-71) e atendimento (TC-72) do gestor**

| ID | Caso | Esperado |
|---|---|---|
| A-174 | `GET /gestor/dashboard` | Contagens por status, atrasados e "meus" |
| A-175 | Usuário removido entre a sessão e a consulta | 404 |
| A-176 | Filtros "Atrasados" e "sem responsável" | Prazo vencido e não encerrado; `gestorid` nulo; paginação |
| A-177 | Filtro "Todos"; status desconhecido | Sem filtro de status; 400 |
| A-178 | Detalhe | Status de exibição e campos vazios tratados |
| A-179 | `GET /gestor/equipe` | Gestores e admins ativos |
| A-180 | Detalhe inexistente | 404 |
| A-181 | Concluir com nota de resolução | Nota gravada, evento `conclusao` e cidadão notificado |
| A-182 | Mudar status sem justificativa | Transição descrita no histórico |
| A-183 | Status ausente | 400 |
| A-184 | Aceitar designando outro gestor | Responsável designado e notificação `equipe_designada` |
| A-185 | Aceitar chamado já em andamento | Status mantido e sem nova notificação |
| A-186 | Aceitar chamado inexistente | 404 |
| A-187 | Comentário acima de 1000 caracteres; chamado inexistente | 400; 404 |
| A-188 | Transferir | Órgão trocado e motivo no histórico |
| A-189 | Transferir sem dados, chamado ou órgão inexistente, mesmo órgão | 400 ou 404 e nada alterado |

**`twoFactor.test.ts`: verificação em duas etapas por e-mail**

| ID | Caso | Esperado |
|---|---|---|
| A-190 | Login com 2FA ativo | Sem tokens; código enviado por e-mail |
| A-191 | Código correto | Autentica; o mesmo código não pode ser reutilizado |
| A-192 | Código incorreto | Recusado; o desafio é invalidado após 5 tentativas |
| A-193 | Desafio desconhecido | Recusado |
| A-194 | Reenvio do código | No máximo um por minuto |
| A-195 | Usuário sem 2FA | Login direto |
| A-196 | `PUT /auth/me/two-factor` com a senha atual | Ativa a verificação |
| A-197 | Senha incorreta | Recusada |
| A-198 | Campo `ativo` ausente ou não booleano | 400 |

**`twoFactorDemo.test.ts`: 2FA com `DEMO_MODE`**

| ID | Caso | Esperado |
|---|---|---|
| A-199 | Login com 2FA em modo demonstração | Código devolvido na resposta e aceito na verificação |

**`registerDemo.test.ts`: cadastro com `DEMO_MODE` e senha repetida**

| ID | Caso | Esperado |
|---|---|---|
| A-200 | Senha já usada por outra conta | Avisa qual conta usa a senha e não cria o usuário |
| A-201 | Pessoa decide prosseguir | Usuário criado |
| A-202 | Senha que não se repete | Usuário criado direto |

### 3.3 E2E da API — `e2e/` (Playwright, 36)

Rodam contra o backend e o banco reais, na ordem em que o usuário usaria o app. Os testes de cada
jornada são sequenciais e compartilham o estado (o mesmo usuário e a mesma ocorrência).

**`cidadao-ocorrencia.spec.ts`: ciclo de vida de uma ocorrência (cidadão)**

| ID | Passo | Verifica |
|---|---|---|
| E-01 | Cadastro e login | Perfil `Cidadao`; `/auth/me` retorna o usuário |
| E-02 | Lista inicial | Vazia para um cidadão novo |
| E-03 | Registrar ocorrência (categoria, endereço, região, GPS) | Protocolo `DEM-AAAAMMDD-XXXX`, status Aberto; estado (UF em maiúsculas), cidade e zona gravados |
| E-04 | Listagem | Ocorrência com categoria e coordenadas corretas |
| E-05 | Pesquisa por título, endereço, protocolo e categoria | Encontra a ocorrência; termo inexistente não retorna nada |
| E-06 | Filtro por status | Aparece em Aberto e não em Resolvido |
| E-07 | Detalhe | Dados, região, prazo (`slaHours`, `slaDeadline` depois da criação) e histórico |
| E-08 | Edição (título, descrição, categoria) | Alterações salvas e registradas no histórico |
| E-09 | Anexar duas fotos e remover uma | `photos` na ordem de envio, `photoUrl` = primeira foto, imagem servida como `image/jpeg`; após remover, a capa passa a ser a foto restante |
| E-10 | Remover | Some da lista padrão e aparece em "Removidas" |
| E-11 | Editar ocorrência removida | 403 |
| E-12 | Logout | Token deixa de funcionar (401) |

**`gestor-atendimento.spec.ts`: atendimento entre cidadão e gestor**

| ID | Passo | Verifica |
|---|---|---|
| E-13 | Cidadão registra vazamento (Água e Esgoto) | Ocorrência criada |
| E-14 | Fila de gestão de chamados | A ocorrência aparece para o gestor |
| E-15 | Cidadão acessa rotas do gestor | 403 |
| E-16 | Gestor muda para "Em Andamento" | 200 |
| E-17 | Cidadão consulta a ocorrência | Novo status e registro no histórico |
| E-17b | Notificação da mudança | Aparece em `/notifications` (não lida, com protocolo); marcar como lida zera o contador; outro usuário recebe 404 |
| E-18 | Cidadão tenta editar e remover | 403 nos dois casos |
| E-19 | Gestor conclui ("Resolvido") | Aparece em Resolvido para o cidadão e gera a notificação "Chamado resolvido" |

**`seguranca.spec.ts`: autenticação, isolamento e validação**

| ID | Caso | Verifica |
|---|---|---|
| E-20 | Rotas protegidas sem login | 401 em `/demands`, `/categories` e `/auth/me` |
| E-21 | Senha errada | 401 com mensagem genérica |
| E-22 | E-mail duplicado | 409 |
| E-23 | Cadastro como Admin | Perfil resultante `Cidadao` |
| E-24 | Isolamento entre cidadãos (`@smoke`) | O intruso não vê, não edita, não anexa foto e não remove; a ocorrência do dono fica intacta |
| E-25 | Duas sessões do mesmo usuário | O logout de uma não derruba a outra |
| E-26 | Ocorrência inválida | 400 sem campos obrigatórios e com categoria inexistente |
| E-27 | Foto que não é imagem | 422 |

**`conta.spec.ts`: termos, foto de perfil, notificações e recuperação de senha**

| ID | Caso | Verifica |
|---|---|---|
| E-28 | Conta nova | `termosversao` nula em `/auth/me` |
| E-29 | Aceite dos termos | Versão gravada; enviar uma versão menor não regride |
| E-30 | Foto de perfil | Upload grava `fotourl` e a imagem é servida; remover zera `fotourl` e apaga o arquivo (404) |
| E-31 | Token de push | Registrar (inclusive repetido) e remover retornam 204; token em formato inválido retorna 400 |
| E-32 | Recuperação de senha | Mesma resposta para e-mail existente e inexistente; código errado retorna 400 e a senha antiga continua valendo |

**`sessao.spec.ts`: sessão com refresh token**

| ID | Caso | Verifica |
|---|---|---|
| E-33 | Renovação da sessão | Novo par de tokens; o novo access token funciona; reutilizar o refresh antigo derruba a sessão inteira |
| E-34 | Logout com duas sessões | O refresh da sessão encerrada é recusado e o da outra sessão continua renovando |
| E-35 | Refresh inválido | 400 sem o campo e 401 com token desconhecido |

### 3.4 E2E de telas — `mobile/e2e` (Maestro, 3 fluxos no CI + 2 pendentes)

| ID | Fluxo | Passos | Onde roda |
|---|---|---|---|
| M-01 | `login_invalid_password.yaml` | Senha errada → alerta "Falha no Login" / "Credenciais inválidas." → continua na tela de login | PR (smoke) e regressão |
| M-02 | `pending/register.yaml` | Cadastro pela tela → alerta de sucesso → login com a conta nova → lista vazia com a saudação | Pendente: roteiro assistido |
| M-03 | `session_persistence.yaml` | Login → fechar e reabrir o app → continua logado | PR (smoke) e regressão |
| M-04 | `logout.yaml` | Login → Perfil → "Sair da conta" → confirmar → tela de login → reabrir o app → continua deslogado | Regressão |
| M-05 | `pending/demand_crud.yaml` | Nova demanda (categoria, estado/cidade/zona, GPS simulado, foto pela câmera) → salvar → pesquisar na lista → detalhe → editar título → excluir com confirmação → some da lista | Pendente: roteiro assistido |

Todos os fluxos que fazem login passam por `subflows/login.yaml`, que aceita os termos de uso quando a tela aparece.

### 3.5 Agente de IA — `ai-agent/tests` (23 + 10 ao vivo)

Rodam com `node --test` (`npm test` em `ai-agent/`). O Gemini é substituído por um cliente roteirizado
(`tests/scriptedClient.ts`), então o loop do agente e as ferramentas reais rodam sem rede e sem cota (TC-56).

| Arquivo | Testes | O que cobre |
|---|---|---|
| `agente.test.ts` | 3 | Os 3 casos de triagem (CT-01 a CT-03): categoria, órgão, prioridade e chamados similares |
| `ferramentas.test.ts` | 7 | Regras das ferramentas `classificar_e_rotear_ocorrencia`, `buscar_chamados_similares` e `executarFerramenta` |
| `acompanhamento.test.ts` | 13 | Perfil de acompanhamento: regra de acesso por perfil, prazos, consulta ao backend com o JWT do usuário e o servidor `POST /chat` |
| `live/gemini.test.ts` | 10 | Os mesmos cenários contra o Gemini real (`npm run test:live`); só na regressão diária, porque dependem de rede e da cota da API |

---

## 4. Rastreabilidade: requisitos × testes

Cada teste automatizado leva no próprio título o caso do plano de testes que ele verifica, entre colchetes no
início: `it('[TC-01] login gera um JWT ...')`, ou `[TC-42, TC-43]` quando cobre mais de um caso. Nos fluxos
Maestro, o caso vai no `name:` do cabeçalho do fluxo. O vínculo TC → HU vem da tabela de casos do
[plano de testes](Template_Plano_de_Testes_e_Backlog.md) (seção 4.6).

A partir dos títulos, `node .github/scripts/tas/test-catalog.mjs --write` gera o catálogo em formato de dados,
[`docs/testes-automatizados/catalogo-testes.json`](catalogo-testes.json): cada teste com suíte, arquivo, grupo,
título, casos (TC) e HUs, e cada caso do plano com a quantidade de testes e as suítes que o verificam. O job
**Política da TAS** reprova o PR quando um teste não tem o caso no título, cita um TC que não existe no plano ou o
JSON não foi regenerado. Em toda execução do CI/CD, o mesmo job publica o artefato `catalogo-testes`
(`.github/scripts/tas/render-catalog.mjs`), com o JSON e dois relatórios em HTML: o **de negócio** mostra, por HU,
quantos casos do plano estão automatizados, quantos ficam manuais por decisão do plano e quantos saíram do escopo;
o **técnico** lista os casos, as suítes, os arquivos e cada teste com o seu TC. Como o identificador está no título, renomear, mover ou dividir um teste não desfaz o
vínculo; as tabelas abaixo, com os IDs U-xx, A-xx, E-xx e M-xx, continuam como visão por funcionalidade.

| Requisito / funcionalidade | Unitário | API | E2E (API) | E2E (telas) |
|---|---|---|---|---|
| Cadastro | — | A-10 a A-12, A-56, A-57 | E-01, E-22, E-23 | M-02 (pendente) |
| Login e proteção de rotas | U-11, U-13 | A-01 a A-09 | E-20, E-21 | M-01 |
| Logout e sessões | U-12, U-14, U-15 | A-13, A-14, A-42, A-43 | E-12, E-25 | M-04 |
| Refresh token (HU-01, HU-02) | U-37 a U-42 | A-08, A-34 a A-41 | E-33 a E-35 | — |
| Persistência de estado (useState/useEffect) | — | — | — | M-03 |
| Perfis e permissões | U-01 a U-10 | A-33, A-60, A-61, A-67 a A-73 | E-15 | — |
| Criar ocorrência | — | A-20, A-21, A-47, A-48 | E-03, E-26 | M-05 (pendente) |
| Listagem (FlatList) e pesquisa | U-16 a U-20 | A-15 a A-17 | E-02, E-04 a E-06 | M-05 (pendente) |
| Detalhe | — | A-18, A-19 | E-07 | M-05 (pendente) |
| Atualizar ocorrência | U-28 a U-30 | — | E-08, E-11, E-18 | M-05 (pendente) |
| Remover ocorrência | U-21 a U-27 | A-22, A-23 | E-10, E-18 | M-05 (pendente) |
| Câmera / fotos (até 5) | U-31 a U-36, U-44, U-45 | A-24 a A-26, A-44 a A-46, A-59 | E-09, E-27 | M-05 (pendente) |
| GPS (coordenadas) | — | — | E-03, E-04 | M-05 (pendente) |
| Região (estado, cidade, zona) | U-43 | A-58 | E-03, E-07 | M-05 (pendente) |
| Prazo (SLA) | — | — | E-07 | — |
| Payload da listagem | U-20 | A-49 | — | — |
| CORS (HU-09) | — | A-50 a A-53 | — | — |
| Tratamento de erros | — | A-54, A-55 | — | — |
| Isolamento entre cidadãos | U-22, U-28, U-35 | A-19, A-23 | E-24 | — |
| Atendimento pelo gestor | — | A-28 a A-33, A-62 a A-66 | E-13 a E-19 | — |
| Recuperação de senha | U-42 | A-85 a A-89 | E-32 | — |
| Edição do perfil | — | A-90 a A-97 | — | — |
| Termos de uso | — | A-105 a A-110 | E-28, E-29 | M-03, M-04 (aceite no login) |
| Foto de perfil | — | A-98 a A-104 | E-30 | — |
| Notificações (e-mail, push e tela) | U-46 a U-50 | A-79 a A-84 | E-17b, E-19, E-31 | — |
| Assistente de IA | — | A-74 a A-78 | — | — |
| Agente de IA (triagem e acompanhamento) | `ai-agent/tests` (seção 3.5) | — | — | — |
| Filtros por categoria e região | — | A-111 a A-114 | — | — |
| Órgãos | — | A-115 a A-133 | — | — |
| Regras de competência | — | A-134 a A-149 | — | — |
| Ciclo de vida dos usuários e auditoria | — | A-150 a A-159 | — | — |
| Métricas do painel do gestor e cache | U-65 a U-80 | A-160 a A-164 | — | — |
| Health check | — | A-165, A-166 | — | — |
| Consulta de usuários e categorias | — | A-167 a A-173 | — | — |
| Painel, fila e atendimento do gestor | — | A-174 a A-189 | — | — |
| Validação de entrada da autenticação | U-51 a U-64 | — | — | — |
| Verificação em duas etapas | — | A-190 a A-199 | — | — |
| Cadastro em modo demonstração | — | A-200 a A-202 | — | — |
| Remetente dos e-mails | U-86 a U-89 | — | — | — |
| Tradução de erros HTTP | U-81 a U-85 | A-54, A-55 | — | — |

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
| Reutilizar o refresh token de uma sessão encerrada por logout derrubava as outras sessões do usuário | `authService` | A-38, E-34 |
| Corpo acima do limite de 15 MB retornava 500 em vez de 413 | `errorMiddleware` | A-45 |
| Regra de competência e vínculo com a categoria podiam encaminhar o chamado a um órgão inativo | `demandService` | A-48 |
| Cadastro de órgão sem campos obrigatórios passava da validação (chamada `async` sem `await`) e terminava em 500 | `organService` | A-120 |

---

## 6. Escrevendo novos testes

**Onde colocar**

| Tipo | Pasta | Nome |
|---|---|---|
| Regra de negócio isolada | `backend/src/tests/unit/` | `<service>.test.ts` |
| Rota HTTP | `backend/src/tests/api/` | `<recurso>.test.ts` |
| Jornada ponta a ponta | `e2e/` | `<jornada>.spec.ts` |
| Fluxo de tela | `mobile/e2e/` | `<fluxo>.yaml` |

**Título do teste**

- Comece o título com o caso do plano: `it('[TC-50] atualiza o nome sem exigir a senha atual', ...)`. Nos fluxos
  Maestro, use `name: "[TC-63] M-01 ..."` no cabeçalho. Funcionalidade nova sem caso no plano ganha um TC na
  seção 4.6 do plano antes do teste.
- Depois de criar, renomear ou remover testes, rode `node .github/scripts/tas/test-catalog.mjs --write` e faça
  commit do `docs/testes-automatizados/catalogo-testes.json`.

**Backend (Jest)**

- Mocke o Prisma com `jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'))` e
  controle as respostas por `prisma.<tabela>.<método>.mockResolvedValue(...)`. O mock é resetado antes de cada teste.
- Para transações, faça `prisma.$transaction.mockImplementation(async (cb) => cb(prisma))`, que executa o código
  real da transação e permite verificar o que foi gravado.
- Mocke `../../utils/cache` para não tentar conectar ao Redis.
- Mocke `../../services/notificationService` (ou o `mailService`) quando o código notifica alguém; senão, com
  SMTP no `.env` local, o teste tenta enviar e-mail de verdade e estoura o tempo.

**E2E da API (Playwright)**

- Use os helpers de [`e2e/helpers.ts`](../../e2e/helpers.ts): `registerAndLogin` (cria um cidadão novo),
  `login`, `createDemand`, `categoryIdByName`.
- O login roda num contexto isolado e cada sessão usa só o header `Authorization`. O backend dá prioridade
  ao cookie sobre o header, então compartilhar cookies misturaria usuários em testes com mais de uma pessoa.
- Use `test.describe.serial` quando os passos dependem uns dos outros.

**Telas (Maestro)**

- Selecione por `testID` (`id:`). A lista de IDs está no [`mobile/README.md`](../../mobile/README.md).
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
  por isso eles ficam fora do `npm test`. No CI, 2 fluxos rodam como smoke em todo PR e todos os fluxos de
  `mobile/e2e/` rodam na regressão diária (`regressao.yml`). O emulador do CI às vezes falha sem relação com o
  app (houve falhas em 15/10 e 16/10); por isso o script faz um aquecimento e reinicia o emulador antes dos
  fluxos. Os fluxos não têm nova tentativa automática (`docs/testes-automatizados/tas.md`, seção 5.4).
