# Projeto 5 (disciplina de Projeto)

| | |
|---|---|
| **Papel no PI** | Acompanhar processo, organização, planejamento, evolução e integração entre as disciplinas. Não avalia o mérito técnico de cada área |
| **Projeto** | Fiscalize: app mobile de gestão de demandas urbanas (case "Cidade Conectada", Smart City) |
| **Turma** | 5º período de ADS, semestre 2026.2 |
| **Apresentação final integrada** | 30/11 (última aula de Projeto 5) |

Esta pasta é o ponto de entrada para quem quer entender **como o projeto foi organizado**. Cada
disciplina tem a própria pasta em [`docs/`](../README.md).

---

## 1. Equipe

Felipe Cisneiros Agostinho, Ramom de Oliveira Aguiar, Arthur Borba Lins, Arthur Rodrigues de Andrade
Lima, Victor Simas Azevedo de Almeida, Paulo Henrique Alves de Barros Pereira, Michelangelo Morais do
Rego, Bruno Dornelas Costa Ciro da Penha, João Guilherme Aires Chagas de Oliveira, Thyalles Araujo
Campos e Bruno Felipe de Castilho Gomes Rego.

Equipe com dedicação parcial, que se encontra presencialmente uma vez por semana. Isso orientou as
escolhas de processo abaixo: prazos em horas úteis, revisão quinzenal e o máximo possível de
verificação automática no lugar de combinados verbais (ver a [política da TAS](../testes-automatizados/tas.md#1-contexto-e-escopo)).

---

## 2. Integração entre as disciplinas

```
                         ┌────────────────────────┐
                         │  Negócios na Internet  │ proposta de valor, jornada, KPIs, LGPD (negócio)
                         └───────────┬────────────┘
                                     │ funcionalidades de maior valor
┌──────────────────┐    controles    ▼    dados de demandas   ┌───────────────────────┐
│ Segurança da     │──────────▶ DESENVOLVIMENTO ─────────────▶│ Engenharia de Dados   │
│ Informação       │           MOBILE (app + API)             │ ETL, cache, painel    │
└──────────────────┘                 ▲  │                      └──────────┬────────────┘
                                     │  │ chat                            │ indicadores → KPIs
                          verifica   │  ▼                                 ▼
                     ┌───────────────┴──────┐   ┌──────────────┐   Negócios na Internet
                     │ Testes Automatizados │   │ IA Aplicada  │
                     └──────────────────────┘   └──────────────┘
                                     │
                                     ▼  qualidade, riscos, status
                                Projeto 5
```

| Disciplina | Pasta | Depende de | Fornece para |
|---|---|---|---|
| Desenvolvimento Mobile | [`desenvolvimento-mobile`](../desenvolvimento-mobile/README.md) | requisitos de SEG, contrato de dados, jornada de NEG | o produto onde tudo se integra |
| Segurança da Informação | [`seguranca-da-informacao`](../seguranca-da-informacao/README.md) | arquitetura do app e do backend | controles para MOB e proteção para DADOS |
| Negócios na Internet | [`negocios-na-internet`](../negocios-na-internet/README.md) | visão do produto, indicadores de DADOS | jornada e KPIs |
| Engenharia de Dados | [`engenharia-de-dados`](../engenharia-de-dados/README.md) | dados do backend, regras de SEG | indicadores para NEG e para o painel |
| Testes Automatizados | [`testes-automatizados`](../testes-automatizados/README.md) | critérios de aceite, endpoints, telas | qualidade e riscos para o Projeto |
| IA Aplicada | [`ia-aplicada`](../ia-aplicada/README.md) | API e regras de acesso do backend | assistente no app |

---

## 3. Calendário de entregas (U2)

Fonte: quadro de acompanhamento compartilhado do PI.

| Data | Disciplina | Entrega |
|---|---|---|
| 14/10 | Testes | Pipeline de testes |
| 20/10 a 8/11 | Mobile | Integração das camadas: signup (20/10), login e logout (27/10), sessionToken (3/11) |
| 28/10 | Testes | Desafio: evolução da pipeline de testes |
| 30/10 | Segurança | Entrega 4: disponibilidade e proteção contra ataques digitais |
| 3/11 | Negócios | Entrega 3: Business Model Canvas definitivo |
| 26/10, 9/11, 16/11, 23/11 | Projeto 5 | Checkpoints semanais do squad |
| 26/10 a 18/11 | Testes | Métricas e manutenção da suíte |
| 13/11 · 27/11 | Mobile | Build preliminar · versão final (EAS) |
| 17/11 | Negócios | Entrega 4: plano de sustentabilidade com KPIs e aspectos legais |
| 18/11 | Testes | Continuous Testing, suíte E2E e relatório de qualidade |
| 20/11 | Segurança | Entrega 5: backup e continuidade de operação |
| 30/11 | Dados | Orquestração, Spark e produtos baseados em dados |
| **30/11** | **Todas** | **Entrega final integrada e apresentação do PI** |
| 11/12 | Segurança | Entrega 6: gestão de fornecedores |

---

## 4. Processo e ferramentas

### 4.1 Git e GitHub com forks e pull requests

- **Como:** repositório principal `ArthurLins00/Projetos-V`; cada integrante trabalha no próprio
  *fork*, em branches curtas nomeadas por tipo (`feat/`, `fix/`, `docs/`, `ci/`, `chore/`, `test/`), e
  abre PR para `dev` ou `main`. Mensagens de commit no padrão *Conventional Commits*
  (`feat(mobile): ...`, `docs(security): ...`).
- **Por quê:** o PR é o ponto de revisão e de execução dos testes; o *fork* permite que todos
  contribuam sem permissão de escrita no repositório principal.
- **Descartados:** **commits direto na `main`** (sem revisão nem Quality Gate) e **Git Flow completo**
  (branches de *release* e *hotfix* são cerimônia demais para um projeto sem deploy em produção).

### 4.2 Regras de proteção (rulesets)

- `main` e `dev` protegidas: PR obrigatório com 1 aprovação, check **CI concluído** obrigatório,
  branch atualizada antes do merge, sem *force push* nem exclusão. Detalhes em
  [`TESTES.md` › Quality Gate](../../TESTES.md#21-pipeline-no-github-actions).

### 4.3 Templates de PR e de issue

- [`pull_request_template.md`](../../.github/pull_request_template.md): checklist de testes e de manutenção da TAS.
- [`ISSUE_TEMPLATE`](../../.github/ISSUE_TEMPLATE): falha de teste, teste instável e remoção de teste.
- **Por quê:** a revisão confere sempre os mesmos pontos, independentemente de quem revisa.

### 4.4 Issues automáticas e labels

- Falhas do CI viram issues com área, prioridade e prazo ([`ci-failure-issues.yml`](../../.github/workflows/ci-failure-issues.yml));
  a revisão periódica da suíte abre uma issue quinzenal ([`tas-manutencao.yml`](../../.github/workflows/tas-manutencao.yml)).
- **Por quê:** numa equipe que se encontra uma vez por semana, o que não vira issue com dono e prazo
  tende a ser esquecido.

### 4.5 Checkpoints semanais

- Reunião do squad nas aulas de Projeto 5, com o quadro de acompanhamento atualizado antes de cada
  checkpoint: status por disciplina, dependências, riscos e integrações pendentes.

### 4.6 Uso de IA no processo

Ferramentas de IA generativa foram usadas como apoio em rascunhos, código, revisão de textos e
modelagem de testes, com curadoria da equipe. A declaração formal está no [README principal](../../README.md#declaração-de-uso-de-ia).

---

## 5. Riscos de integração acompanhados

| Risco (da matriz do PI) | Como foi tratado |
|---|---|
| App sem backend real | Backend com PostgreSQL desde a U1; E2E rodam contra o banco real |
| Recursos do dispositivo não utilizados | Câmera, galeria, GPS, notificações e SecureStore em uso |
| Segurança só no papel | README de Segurança separa o implementado do especificado ([seção 4](../seguranca-da-informacao/README.md#4-implementado--especificado-para-produção)) |
| Pipeline deixada para a última semana | Pipeline entregue em 14/10, evoluída até a entrega final |
| Casos gerados por IA aceitos sem revisão | Rodadas de IA registradas e revisadas no plano de testes |
| Analytics descolado do app | Métricas calculadas do banco operacional e exibidas no painel do gestor |
