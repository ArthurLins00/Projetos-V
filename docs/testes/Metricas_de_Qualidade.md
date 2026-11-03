# Métricas de qualidade — Fiscalize

Este documento define as métricas que a pipeline acompanha, por que cada uma foi escolhida e quais foram
descartadas. Os valores são calculados automaticamente pelo workflow **Relatório de qualidade**
(`.github/workflows/quality-report.yml`) a cada push em `main` e a cada regressão diária, sem intervenção manual,
e aparecem nos dois relatórios HTML gerados por ele: o **técnico** e o **de negócio**.

As metas ficam em um único lugar, [`.github/scripts/quality/targets.mjs`](../../.github/scripts/quality/targets.mjs),
lido tanto pelo cálculo quanto pelos relatórios.

## 1. Contexto que guiou a escolha

- **O que o produto faz:** cidadãos registram ocorrências urbanas e gestores públicos as atendem. As regras que
  importam (roteamento para o órgão certo, permissões por perfil, prazo de atendimento, isolamento entre
  cidadãos) ficam no **backend**, que é onde a cobertura de código faz sentido.
- **Dados pessoais:** o app guarda nome, e-mail, fotos e localização, então está sujeito à LGPD
  (`docs/seguranca/03_Conformidade_LGPD.md`). Vulnerabilidade em dependência é risco jurídico, não só técnico.
- **Histórico real de instabilidade:** fluxos do Maestro foram movidos para `mobile/e2e/pending/` por falharem
  no emulador do CI, e tanto o Playwright quanto o Maestro repetem testes que falham. Um teste instável que
  "passa na segunda" esconde problemas e faz a equipe parar de confiar no CI.
- **Feedback rápido:** o Maestro saiu dos PRs porque deixava o merge lento. O tempo da pipeline precisa
  continuar sob controle.
- **Automação que já existia:** a abertura e o fechamento automáticos de issues `ci-failure`, com labels de área
  e prioridade, já registram quando cada falha começou e terminou. Isso permite medir o tempo de recuperação
  sem nenhuma anotação manual.

## 2. Métricas selecionadas

| ID | Métrica | Como é calculada | Fonte | Meta | Relatório |
|---|---|---|---|---|---|
| MQ-01 | **Taxa de aprovação dos testes** | aprovados ÷ executados (pulados não contam), no total e por suíte | JUnit XML / JSON do Jest de cada suíte | 100% | técnico e negócio |
| MQ-02 | **Cobertura do backend** | linhas e branches cobertos, somando as suítes unitária e de API (`coverage-final.json`) | Jest | linhas ≥ 70%, branches ≥ 60% | técnico e negócio |
| MQ-03 | **Testes instáveis (*flaky*)** | testes que falharam e passaram na nova tentativa da mesma execução | `e2e-results.json` (Playwright) e `maestro-report-1.xml` (Maestro) | 0 | técnico |
| MQ-04 | **Tempo da pipeline** | duração da execução analisada, mediana das execuções de sucesso nos últimos 30 dias e os testes mais lentos | API de execuções do GitHub e JUnit | CI/CD ≤ 10 min, regressão ≤ 60 min | técnico |
| MQ-05 | **Taxa de sucesso da pipeline** | execuções com sucesso ÷ execuções concluídas do CI/CD e da regressão em `main`, últimos 30 dias | API de execuções do GitHub | ≥ 95% | técnico e negócio |
| MQ-06 | **MTTR do CI** (tempo médio de recuperação) | média de (fechamento − abertura) das issues `ci-failure` fechadas nos últimos 30 dias | API de issues | ≤ 2 h | técnico e negócio |
| MQ-07 | **Falhas abertas** | issues `ci-failure` abertas, por label `area:*` e `prioridade: alta` | API de issues | 0 com prioridade alta | técnico e negócio |
| MQ-08 | **Vulnerabilidades em dependências** | quantidade por severidade em cada projeto | `npm audit` do workflow Dependências | 0 críticas e 0 altas | técnico e negócio |

### Por que cada uma entrou

- **MQ-01 — Taxa de aprovação:** é o indicador mais direto de que a versão funciona. Separar por suíte
  (unitário, API, E2E da API, telas, agente de IA) mostra em que camada está o problema.
- **MQ-02 — Cobertura do backend:** mostra quanto das regras de negócio os testes realmente exercitam. A soma das
  suítes unitária e de API é o número honesto: cada uma, sozinha, fica abaixo de 60%, mas elas cobrem partes
  diferentes do código. A meta de 70% é alcançável sem incentivar teste inútil; 80% ou mais custaria testes de
  código trivial (configuração, tipos).
- **MQ-03 — Testes instáveis:** o projeto já perdeu fluxos de tela por instabilidade. Sem a métrica, um teste que
  só passa na segunda tentativa aparece verde e o problema some de vista até virar falha de verdade.
- **MQ-04 — Tempo da pipeline:** um CI lento atrasa o merge e incentiva pular etapas. A mediana de 30 dias evita
  que uma execução fora da curva distorça o número.
- **MQ-05 — Taxa de sucesso da pipeline:** já era um KPI do negócio
  (`docs/negocio/Sustentabilidade_KPIs_e_Aspectos_Legais.md`, seção 2.4, meta ≥ 95%). Reaproveitá-lo mantém um
  único número para a equipe e para os stakeholders. Só conta `main`, porque falhas em PRs e branches de trabalho
  fazem parte do desenvolvimento.
- **MQ-06 — MTTR:** também já era um KPI do negócio (meta ≤ 2 h). Mede quanto tempo a `main` fica quebrada, o que
  importa mais do que quantas vezes ela quebra.
- **MQ-07 — Falhas abertas:** as labels `area:*` traduzem a falha em uma parte do produto (app, backend,
  assistente), o que o relatório de negócio usa para dizer onde está o risco.
- **MQ-08 — Vulnerabilidades:** por causa da LGPD e de o backend estar exposto na internet. Críticas e altas
  entram na meta; moderadas e baixas aparecem no relatório técnico, mas não reprovam o indicador.

## 3. KPIs do relatório de negócio

O relatório de negócio usa as mesmas métricas, agregadas em linguagem não técnica:

| KPI | Composição | Como ler |
|---|---|---|
| **Saúde da versão** | 🔴 se algum teste falhou, há vulnerabilidade crítica ou falha de prioridade alta aberta; 🟡 se alguma outra meta não foi atingida; 🟢 se todas foram | Dá para publicar esta versão? |
| **Funcionalidades verificadas** | para cada área do produto (conta e acesso, ocorrências, gestão pública, assistente de IA, telas do app, segurança), se todos os testes que a cobrem passaram | O que está garantido e o que não está |
| **Confiabilidade da entrega** | MQ-05 e a tendência em relação às execuções anteriores | A equipe entrega com estabilidade? |
| **Tempo de recuperação** | MQ-06 comparado à meta | Quando algo quebra, quanto demora para voltar? |
| **Riscos abertos** | MQ-07 e MQ-08 descritos pelo impacto, com recomendação | O que precisa de decisão ou prioridade |

As áreas do produto são atribuídas pelo arquivo de cada teste (por exemplo, `demands.test.ts` e
`cidadao-ocorrencia.spec.ts` cobrem "Ocorrências"), seguindo a rastreabilidade da seção 4 do `TESTES.md`.

## 4. Métricas descartadas

| Métrica | Por que foi descartada |
|---|---|
| **Quantidade total de testes** | Mais testes não significa mais qualidade e uma meta de quantidade incentiva testes rasos. Aparece no relatório técnico só como contexto, sem meta. |
| **Cobertura de código do app mobile** | O app é coberto por E2E no Maestro, que não mede linhas executadas. O número ficaria perto de 0% e passaria a impressão errada de que as telas não são testadas. |
| **Densidade de defeitos (defeitos por mil linhas)** | O projeto não tem um registro organizado de defeitos de produção, e o volume de código é pequeno: o número oscilaria muito com poucos defeitos e não ajudaria a decidir nada. |
| **Mutation score (testes de mutação)** | Exigiria uma ferramenta nova (Stryker) e multiplicaria o tempo da pipeline, o oposto do esforço de manter o CI rápido (MQ-04). |
| **Testes ao vivo do agente contra o Gemini como meta** | Dependem de API externa, cota e da variação nas respostas do modelo, e falham por motivos que não são do código. Entram na MQ-01 da regressão diária, mas uma falha deles aparece como aviso, não reprova a saúde da versão. |
| **Métricas DORA (lead time e frequência de deploy)** | O projeto não tem deploy automatizado em produção; não há evento confiável para medir. |
| **Dívida técnica por análise estática (SonarQube etc.)** | Exigiria um serviço externo e um token; o typecheck do TypeScript em todos os projetos já cobre a parte que mais gera defeito. |

## 5. Quando os indicadores são atualizados

| Evento | O que acontece |
|---|---|
| Push em `main` (merge de PR) | O CI/CD termina e dispara o Relatório de qualidade, que lê os artefatos daquela execução |
| Regressão diária (03h de Brasília) | Idem, com a suíte completa (todos os E2E, Maestro e agente ao vivo) |
| Manual (aba Actions) | *Relatório de qualidade* → *Run workflow*, informando o ID de uma execução do CI/CD ou da regressão |

Cada relatório guarda o resumo das métricas em `quality-history`, que o relatório seguinte baixa para mostrar a
tendência (as últimas 60 execuções). Os PRs não entram no histórico, para que ele reflita só o que está em `main`.

## 6. Onde ver

- **Artefato `relatorios-qualidade`** da execução do workflow *Relatório de qualidade*: `relatorio-tecnico.html`,
  `relatorio-negocio.html` e `metrics.json` (os dados brutos).
- **Sumário da execução:** um resumo com a saúde da versão e as metas atingidas ou não.
- **GitHub Pages (opcional):** com a variável do repositório `QUALITY_PAGES=true` e o Pages configurado com a
  fonte *GitHub Actions*, os dois relatórios são publicados em um endereço fixo para os stakeholders.
