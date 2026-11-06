# Testes Automatizados (eletiva)

| | |
|---|---|
| **Papel no PI** | Definir e implementar a estratégia de testes automatizados do app e do backend: fundação da automação na U1 e *Continuous Testing* na U2, com apoio crítico de IA generativa |
| **Catálogo e execução** | [`TESTES.md`](TESTES.md) (estratégia, comandos, pipeline, catálogo completo) |
| **Código** | [`backend/src/tests`](../../backend/src/tests), [`e2e/`](../../e2e), [`mobile/e2e`](../../mobile/e2e), [`ai-agent/tests`](../../ai-agent/tests), [`.github/workflows`](../../.github/workflows), [`.github/scripts`](../../.github/scripts) |
| **Conexões** | testa o app e o backend do [Mobile](../desenvolvimento-mobile/README.md) e o [agente de IA](../ia-aplicada/README.md); verifica os controles de [Segurança](../seguranca-da-informacao/README.md); valida os fluxos de valor de [Negócios](../negocios-na-internet/README.md); reporta a qualidade ao [Projeto 5](../projeto-5/README.md) |

---

## 1. Documentos desta pasta

| Documento | Conteúdo |
|---|---|
| [`TESTES.md`](TESTES.md) | Estratégia (pirâmide), como executar cada nível, pipeline no GitHub Actions, artefatos e catálogo completo dos testes (verificado pelo `check-tas.mjs`) |
| [`Template_Plano_de_Testes_e_Backlog.md`](Template_Plano_de_Testes_e_Backlog.md) | Plano de testes (escopo, níveis, riscos), casos modelados a partir dos critérios de aceite (TC-xx), matrizes de alocação e rastreabilidade, seleção e backlog de automação |
| [`ia/saida-rodada-1.md`](ia/saida-rodada-1.md), [`ia/saida-rodada-2.md`](ia/saida-rodada-2.md) | Prompts enviados à IA e saídas recebidas, base da revisão crítica registrada no plano (seções 4.1 e 4.2) |
| [`Metricas_de_Qualidade.md`](Metricas_de_Qualidade.md) | Métricas MQ-01 a MQ-08, metas, KPIs do relatório de negócio e métricas descartadas com justificativa |
| [`tas.md`](tas.md) | Política de manutenção da solução de automação (TAS): papéis, prazos, triagem, testes instáveis e quarentena, revisão periódica, remoção de testes |
| [`catalogo-testes.json`](catalogo-testes.json) | Catálogo gerado dos títulos dos testes (suíte, arquivo, TCs e HUs); regenerado por `node .github/scripts/tas/test-catalog.mjs --write` e verificado no CI |

## 2. Entregas

| Unidade | Entrega | Onde está |
|---|---|---|
| U1 | Plano de Testes, casos modelados, backlog priorizado e registro dos prompts com revisão crítica | [`Template_Plano_de_Testes_e_Backlog.md`](Template_Plano_de_Testes_e_Backlog.md), [`ia/`](ia) |
| U1 | Testes de unidade e de API executando localmente de forma reprodutível | [`backend/src/tests`](../../backend/src/tests), `npm run test:unit`, `npm run test:api` |
| U2 | Pipeline de testes por commit/PR (*Continuous Testing*) com Quality Gate | [`ci.yml`](../../.github/workflows/ci.yml), [`push.yml`](../../.github/workflows/push.yml), [`regressao.yml`](../../.github/workflows/regressao.yml), [TESTES.md › 2.1](TESTES.md#21-pipeline-no-github-actions) |
| U2 | Suíte E2E dos fluxos principais sobre o app integrado ao backend real | [`e2e/`](../../e2e) (Playwright), [`mobile/e2e`](../../mobile/e2e) (Maestro) |
| U2 | Relatório de métricas com interpretação | [`Metricas_de_Qualidade.md`](Metricas_de_Qualidade.md), [`quality-report.yml`](../../.github/workflows/quality-report.yml) |
| U2 | Evidência de manutenção da suíte | [`tas.md`](tas.md), [`tas-manutencao.yml`](../../.github/workflows/tas-manutencao.yml), issues automáticas de falha |

## 3. Estratégia em uma figura

```
                ┌──────────────────────────┐
                │ E2E de telas (Maestro)   │  app real no emulador Android (regressão diária)
              ┌─┴──────────────────────────┴─┐
              │ E2E da API (Playwright)      │  backend + PostgreSQL reais (smoke no PR, completo após o merge)
            ┌─┴──────────────────────────────┴─┐
            │ API (Jest + Supertest)           │  rotas HTTP completas, Prisma mockado (todo push)
          ┌─┴──────────────────────────────────┴─┐
          │ Unitários (Jest)                     │  regras de negócio isoladas (todo push)
          └──────────────────────────────────────┘
  + agente de IA: node:test com Gemini roteirizado (todo push) e ao vivo (regressão diária)
```

Os números atualizados de cada nível e a cobertura ficam no topo do [`TESTES.md`](TESTES.md).

---

## 4. Tecnologias

### 4.1 Jest + ts-jest (unitários e API)

- **Como:** `backend/src/tests/unit` e `backend/src/tests/api`, com cobertura somada das duas suítes.
- **Por quê:** padrão de fato no ecossistema Node/TypeScript, com *mocks*, cobertura e relatórios
  JUnit/JSON integrados, que alimentam as métricas.
- **Descartados:** **Vitest** (mais rápido, mas o backend não usa Vite e a equipe já conhecia o Jest)
  e **Mocha + Chai + Sinon** (três bibliotecas para o que o Jest entrega sozinho).

### 4.2 jest-mock-extended (banco mockado)

- **Como:** um `PrismaClient` mockado em [`config/__mocks__/prisma.ts`](../../backend/src/config/__mocks__/prisma.ts),
  tipado a partir do esquema.
- **Por quê:** testes de unidade e de API rodam em segundos, sem banco, em qualquer máquina e no CI.
- **Descartado:** **banco real de teste em todos os níveis** (Testcontainers): lento e frágil para a
  base da pirâmide; o banco real fica com o E2E.

### 4.3 Supertest (API)

- **Como:** dispara requisições HTTP contra o `app` do Express em memória, passando por middlewares,
  controllers e services.
- **Por quê:** testa a rota completa (status, corpo, autenticação) sem abrir porta de rede.
- **Descartado:** **Postman/Newman**: coleções fora do código, sem tipagem e difíceis de revisar em PR.

### 4.4 Playwright (E2E da API)

- **Como:** jornadas completas (`e2e/*.spec.ts`) contra o backend e o PostgreSQL reais; cada teste cria
  os próprios usuários; o Playwright sobe o backend se ele não estiver no ar; `retries: 0`.
- **Por quê:** o app é nativo (sem build web), então o E2E de navegador não se aplica às telas; o
  Playwright tem um cliente HTTP de primeira classe (`request`), paralelismo, *tags* (`@smoke`), *traces* e
  relatório HTML.
- **Descartados:** **Cypress** (focado em navegador, sem valor para uma API) e **Jest + axios para E2E**
  (sem relatório HTML, *trace* e seleção por tag).

### 4.5 Maestro (E2E de telas)

- **Como:** fluxos YAML em [`mobile/e2e`](../../mobile/e2e) usando os `testID` dos componentes; roda no
  emulador Android do CI na regressão diária.
- **Por quê:** feito para apps mobile, não exige alterar o código nativo e é tolerante a esperas e
  animações.
- **Descartados:** **Detox** (exige configurar o build nativo e é mais acoplado ao React Native) e
  **Appium** (infraestrutura WebDriver pesada e testes mais lentos e instáveis).

### 4.6 node:test + cliente roteirizado (agente de IA)

- **Como:** o agente depende da interface `ModelClient`; nos testes entra um `ScriptedModelClient` que
  reproduz as decisões do modelo, enquanto o loop e as ferramentas reais executam.
- **Por quê:** testes determinísticos, sem chave nem internet; a variação do LLM fica isolada nos testes
  ao vivo, que rodam só na regressão.
- **Descartado:** testar sempre contra o Gemini real (cota, custo e respostas não determinísticas
  gerariam falsos negativos).

### 4.7 GitHub Actions (Continuous Testing)

- **Como:** workflows reutilizáveis por projeto (`backend.yml`, `ai-agent.yml`, `mobile.yml`,
  `mobile-e2e.yml`) chamados com níveis diferentes por evento; check **CI concluído** obrigatório no
  ruleset de `main` e `dev`; issues automáticas por falha; relatórios de qualidade e catálogo de testes
  como artefatos.
- **Por quê:** integrado ao repositório, com cota gratuita de minutos, com emulador Android e
  PostgreSQL disponíveis nos *runners*.
- **Descartados:** **Jenkins** (servidor próprio para manter), **GitLab CI** e **CircleCI** (o código já
  está no GitHub; mudar exigiria espelhamento).

### 4.8 Scripts Node para métricas e manutenção da TAS

- **Como:** `.github/scripts/quality/*` calcula MQ-01 a MQ-08 a partir dos artefatos e da API do GitHub e
  gera relatórios técnico e de negócio em HTML; `.github/scripts/tas/*` verifica a política da TAS
  (`.only`, testes desligados, catálogo, TCs) e cobra prazos e revisões.
- **Por quê:** sem serviço externo, sem token adicional e versionado junto com os testes.
- **Descartados:** **SonarQube/Codecov** (serviço externo e token; métricas genéricas que não
  traduzem os KPIs de negócio escolhidos) e **Allure** (mais um formato e servidor de relatório).

### 4.9 IA generativa no processo de teste

- **Como:** usada no refinamento de requisitos, na modelagem dos casos e na manutenção, sempre com
  revisão crítica registrada (o plano mostra o que foi aceito, corrigido e descartado de cada rodada).
- **Por quê:** acelera a derivação de casos a partir dos critérios de aceite; o julgamento técnico
  continua com a equipe.

---

## 5. Comandos principais

```bash
npm run test:unit
npm run test:api
npm run test:e2e
npm test
npm run test:e2e:mobile
```

Pré-requisitos, variáveis e detalhes de cada nível em [`TESTES.md`](TESTES.md#2-como-executar).
