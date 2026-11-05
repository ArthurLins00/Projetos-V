# Política de manutenção da TAS — Fiscalize

Esta política define como a equipe mantém a **solução de automação de testes (TAS)** do Fiscalize confiável,
manutenível e em evolução: o que fazer quando um teste falha, em quanto tempo, como tratar testes instáveis,
quando revisar a suíte e quando um teste pode ser removido. Ela segue as orientações do Capítulo 13 do material
de estudo (manutenção da TAS) e está ligada aos mecanismos do repositório descritos na seção 8: as regras que
dependem só de disciplina viraram verificação automática ou issue com prazo sempre que foi possível.

| | |
|---|---|
| **Vigência** | a partir de 05/11/2026 |
| **Revisão desta política** | a cada revisão periódica (seção 6), quando algum critério deixar de fazer sentido |
| **Documentos relacionados** | [`TESTES.md`](../TESTES.md) (catálogo e execução), [plano de testes](testes/Template_Plano_de_Testes_e_Backlog.md), [métricas de qualidade](testes/Metricas_de_Qualidade.md) |

---

## 1. Contexto e escopo

A TAS é tudo o que executa ou sustenta os testes automatizados:

| Componente | Onde | Executado em |
|---|---|---|
| Unitários e de API (Jest + Supertest, Prisma mockado) | `backend/src/tests` | todo push e PR |
| E2E da API (Playwright, banco real) | `e2e/` | smoke no PR, completo em `main`/`dev` e na regressão |
| E2E de telas (Maestro, emulador Android) | `mobile/e2e/` | regressão diária |
| Agente de IA (cliente roteirizado e ao vivo) | `ai-agent/tests` | todo push e PR; ao vivo na regressão |
| Pipelines, scripts e relatórios | `.github/workflows`, `.github/scripts` | CI/CD, regressão, relatório de qualidade |
| Dados e duplos de teste | seed do Prisma, `__mocks__`, helpers do `e2e/` | todas as suítes |

O que pesou nas decisões desta política:

- **Equipe de 9 pessoas, com tempo parcial**, que se encontra em aula uma vez por semana. Prazos em horas
  corridas não funcionam; os prazos são em **horas úteis** e a revisão é **quinzenal**.
- **`main` e `dev` são protegidas** pelo check **CI concluído** (Quality Gate). Uma falha nelas trava os merges de
  todos, por isso tem a prioridade mais alta.
- O projeto **já perdeu confiança em testes de tela** por instabilidade do emulador (dois fluxos Maestro estão em
  `pending/` desde 15/10/2026). A gestão de instáveis (seção 5) existe para não repetir isso em silêncio.
- As metas de **MTTR ≤ 2 h** (MQ-06) e **0 testes instáveis** (MQ-03) já eram KPIs do projeto; os prazos e limites
  desta política foram escolhidos para serem coerentes com elas.

Os tipos de manutenção cobertos são os clássicos: **corretiva** (teste quebrado), **adaptativa** (o sistema mudou
e o teste precisa acompanhar), **perfectiva** (velocidade, duplicação, legibilidade) e **preventiva** (revisão
periódica, quarentena com prazo).

---

## 2. Papéis e responsabilidades

| Papel | Quem | Responsabilidades |
|---|---|---|
| **Autor da mudança** | quem abriu o PR ou fez o push que falhou | primeira investigação e classificação; corrigir quando a causa está na própria mudança |
| **Responsável da área** | integrante de referência do backend, do app, dos fluxos de tela ou do agente (labels `area:*`) | ajudar na investigação, decidir a correção quando a causa é antiga, revisar PRs de teste da área |
| **Guardião da TAS** | um integrante, em **rodízio quinzenal** junto com a revisão periódica | acompanhar as issues de manutenção e os prazos, conduzir a revisão periódica, aprovar quarentenas e remoções |
| **Revisor do PR** | quem aprova o PR (1 aprovação obrigatória no ruleset) | conferir o checklist de testes e de manutenção do template de PR |

Quem recebe cada issue automaticamente: o autor do commit, quem disparou a execução, o autor do PR e os logins da
variável `CI_FAILURE_ASSIGNEES` (seção 8). O Guardião da quinzena deve estar nessa variável.

**Por quê:** a falha é investigada primeiro por quem tem o contexto (o autor), mas alguém precisa olhar o conjunto;
sem o Guardião, issues sem dono ficariam esquecidas. O rodízio divide o esforço e espalha o conhecimento da TAS.

---

## 3. Tratamento de falhas

Toda falha de teste segue o mesmo caminho, do registro ao encaminhamento:

```
 falha ──► registro ──► investigação ──► classificação ──► encaminhamento ──► fechamento
 (CI ou      (issue        (reproduzir,     (SUT, TAS,        (correção, issue    (com a causa
  local)      automática    ler artefatos)   ambiente ou       de defeito,         registrada)
              ou formulário)                 variação)         quarentena)
```

### 3.1 Registro

- **No CI:** o workflow *Issues de falha do CI* abre a issue sozinho, com jobs, passos e log, as labels
  `ci-failure`, `area:*`, a prioridade e `classificação: pendente`, e o prazo da seção 4 no corpo.
- **Fora do CI** (execução local, manual ou achado de revisão): formulário **Falha de teste** em *Issues → New issue*.

### 3.2 Investigação

1. Ler a mensagem de erro e os artefatos da execução (`TESTES.md`, seção 2.2: relatório do Playwright com `trace.zip`,
   capturas do Maestro, `backend.log`, JUnit).
2. Reproduzir: localmente com o mesmo comando do CI ou com *Re-run failed jobs*. Se passar sem mudança de código, é
   **suspeita de instabilidade** (seção 5), não falha resolvida.
3. Verificar o que mudou: commit da execução, dependências (`npm audit`/SBOM do workflow Dependências) e o ambiente
   (versão do runner, emulador, serviços externos).

### 3.3 Classificação

| Classificação | Label | Sinais típicos | Encaminhamento |
|---|---|---|---|
| **SUT** — defeito no sistema sob teste | `classificação: sut` | o comportamento observado contraria o requisito; reproduz à mão no app ou na API | corrigir o código **com** o teste que pegou o defeito; registrar na seção 5 do `TESTES.md` |
| **TAS** — defeito na automação | `classificação: tas` | seletor ou `testID` desatualizado, dado de teste compartilhado, mock incompleto, espera mal feita, script de CI | corrigir o teste ou o script; se não der no prazo, quarentena (seção 5) |
| **Ambiente** | `classificação: ambiente` | emulador sem resposta, timeout de rede, serviço externo (Gemini, Expo Push, IBGE) fora, runner sem recurso | nova tentativa permitida **uma vez**; se repetir, issue de ambiente e ajuste do workflow (espera, serviço, retry no nível certo) |
| **Variação esperada** | `classificação: variação esperada` | mudança intencional (texto de tela, regra de negócio, contrato da API) que o teste ainda não acompanha | atualizar o teste e o caso no plano/catálogo no **mesmo PR** da mudança; citar a decisão ou a HU |

Regras de classificação:

- Na dúvida entre **SUT e TAS**, trate como SUT até provar o contrário: é o erro mais caro de ignorar.
- **Variação esperada exige referência** (HU, issue ou PR que decidiu a mudança). Sem isso, é SUT.
- Uma issue só é fechada com a classificação trocada e um comentário com a **causa** e o **encaminhamento**.

**Por quê:** separar as quatro causas evita os dois erros mais comuns em automação: "consertar" o teste quando o
sistema é que está errado e desconfiar do sistema quando o teste é que envelheceu.

---

## 4. Critérios e prazos de correção

| Prioridade | Quando | Triagem (classificar) | Correção (corrigir, reverter ou quarentenar) |
|---|---|---|---|
| `prioridade: alta` | falha em `main`, `dev` ou na regressão diária; teste de **segurança** (isolamento, autenticação, autorização) ou **smoke** em qualquer branch | **2 h úteis** | **1 dia útil** |
| `prioridade: média` | falha em PR ou branch de trabalho; teste instável | 1 dia útil | 3 dias úteis |
| `prioridade: baixa` | melhoria, dívida técnica, achado da revisão periódica | 3 dias úteis | 10 dias úteis (até a revisão seguinte) |

- **Hora útil** = de segunda a sexta, 8 h por dia; é o que o workflow *Manutenção da TAS* usa para calcular.
- A prioridade é atribuída pelo CI (alta em `main`/`dev`/regressão, média no resto) e pode ser **elevada** por
  qualquer integrante com um comentário justificando (ex.: falha em PR que toca segurança). **Rebaixar** exige o
  Guardião.
- **Correção** pode ser: o PR com a correção, a reversão do commit que quebrou ou a quarentena registrada. Em
  `main`/`dev` a reversão é preferida quando a correção não sai no prazo, para destravar o Quality Gate.
- **Prazo vencido:** o workflow marca a issue com `prazo vencido` e comenta mencionando os responsáveis. Uma issue
  ainda vencida na revisão periódica entra na pauta e recebe um novo responsável.

**Por quê:** 2 h para classificar a falha alta é o mesmo número do MTTR do projeto: a meta só é alcançável se
alguém olhar a falha logo. 1 dia útil para restabelecer `main` cabe na rotina de quem trabalha meio período, e a
reversão garante que ninguém fique bloqueado esperando. Os prazos de média e baixa acompanham o ritmo de uma
sprint de duas semanas.

---

## 5. Gestão de testes instáveis

Um teste é **instável** quando passa e falha **sem mudança de código** (mesmo commit, mesmo ambiente).

### 5.1 Identificação

| Sinal | Mecanismo |
|---|---|
| Passou na nova tentativa da mesma execução | Playwright (`retries: 1` no CI) e Maestro (`run-maestro.sh`) marcam como *flaky*; o relatório de qualidade conta (MQ-03) |
| O workflow voltou a passar **no mesmo commit** que falhou | o script de issues de falha **não fecha** a issue: adiciona `teste instável` e comenta pedindo a triagem |
| Falha que não se reproduz localmente | formulário **Teste instável**, com as execuções que falharam e as que passaram |
| Suspeita durante o desenvolvimento | rodar a suíte repetidas vezes (ex.: `for i in 1 2 3 4 5; do npx jest --silent; done`) e registrar a taxa |

### 5.2 Tratamento

1. **Registrar** a issue `teste instável` com as ocorrências e a taxa (falhas ÷ execuções).
2. **Monitorar** enquanto houver **uma** ocorrência em 14 dias: o teste continua rodando e bloqueando normalmente.
3. **Corrigir ou quarentenar** a partir de **duas** ocorrências em 14 dias, ou já na primeira se travar `main`/`dev`.
4. **Quarentena** = desligar o teste (`it.skip`/`test.fixme` com o número da issue no comentário, ou mover o fluxo
   Maestro para `mobile/e2e/pending/`) **e** registrar em [`.github/tas/quarentena.json`](../.github/tas/quarentena.json)
   com motivo, classificação, issue, responsável, data de início e de expiração.
5. A quarentena dura **no máximo 14 dias** e pode ser **prorrogada uma vez**, com justificativa no campo
   `prorrogacao`. Vencida, a issue de acompanhamento cobra uma decisão: corrigir, prorrogar ou propor a remoção.

### 5.3 Salvaguardas para não mascarar defeitos

- **Nova tentativa automática só nos E2E** (Playwright e Maestro), no máximo **uma**. Unitários e de API rodam com
  banco mockado e não têm motivo legítimo para variar: instabilidade neles é defeito da TAS e se corrige.
- **Teste de segurança ou smoke não entra em quarentena.** Se ficar instável, corrige-se no prazo da prioridade
  alta ou reverte-se a mudança; o formulário pede essa confirmação.
- Antes da quarentena, alguém **reproduz o comportamento do sistema à mão** e confirma que está correto. Sem isso,
  a falha é tratada como SUT.
- O Quality Gate **reprova** qualquer teste desligado sem registro e qualquer `.only` (seção 8.3), então nenhum
  teste some da suíte sem deixar rastro.
- Enquanto um teste está em quarentena, o caso correspondente do plano é verificado pelo **roteiro manual** antes
  de cada release (como já acontece com o M-02 e o M-05).

**Por quê:** a nova tentativa e a quarentena são úteis para não travar a equipe por causa do emulador, mas, sem
limite, viram o lugar onde os defeitos reais se escondem. Os limites (uma nova tentativa, duas ocorrências, 14
dias, uma prorrogação) mantêm o custo de conviver com o teste instável sempre visível.

---

## 6. Revisão periódica

**Frequência:** quinzenal, nos dias 1 e 15 de cada mês, quando o workflow *Manutenção da TAS* abre a issue
**Revisão periódica da TAS — AAAA-MM-DD** com os números atuais. Há também uma **revisão extraordinária** depois de
cada release ou mudança grande de arquitetura. O Guardião da quinzena conduz a revisão e fecha a issue com as decisões.

| Critério | Como medir | Limite | Ação quando passa do limite |
|---|---|---|---|
| **Instabilidade** | MQ-03 no relatório técnico; issues `teste instável` abertas | 0 instáveis sem issue; nenhum há mais de 14 dias sem decisão | aplicar a seção 5.2 |
| **Quarentena** | `.github/tas/quarentena.json` (verificado pelo `check-tas.mjs`) | nenhuma vencida | corrigir, prorrogar uma vez ou propor a remoção |
| **Tempo de execução** | MQ-04 (mediana de 30 dias) e testes mais lentos do relatório técnico | CI/CD ≤ 10 min; regressão ≤ 60 min; teste de API ≤ 2 s; E2E da API ≤ 30 s | mover o caso para um nível mais barato, dividir, reduzir dados ou paralelizar |
| **Duplicação de código** | `jscpd` sobre `backend/src/tests`, `e2e` e `ai-agent/tests`, blocos de 8+ linhas (na própria issue) | ≤ 5% das linhas | extrair helper, fixture ou `it.each` |
| **Rastreabilidade** | `check-tas.mjs`: todo arquivo de teste no catálogo do `TESTES.md`; todo caso com TC no plano | 100% | catalogar ou ligar ao TC no mesmo ciclo |
| **Cobertura** | MQ-02 | linhas ≥ 85%, branches ≥ 80% | priorizar testes para os arquivos menos cobertos do relatório |
| **Prazos** | issues com `prazo vencido` | nenhuma | reatribuir e registrar o motivo |

**Por quê quinzenal:** coincide com a sprint e com a duração máxima da quarentena, então nenhuma quarentena vence
sem passar por uma revisão. Mensal deixaria um teste desligado por até 30 dias; semanal pesaria demais para uma
equipe que se encontra uma vez por semana.

---

## 7. Remoção de testes

Um teste automatizado pode ser descontinuado quando atende a **pelo menos um** critério:

| Critério | Exemplo |
|---|---|
| A funcionalidade foi removida ou saiu do escopo | casos TC-15, TC-19, TC-26 e outros da seção 6.1 do plano de testes |
| Está duplicado por outro teste do mesmo nível ou de um nível mais barato, com a mesma verificação | um E2E que repete exatamente um teste de API |
| Continua instável depois da quarentena e da prorrogação, sem correção viável | fluxo de tela que depende de hardware do emulador |
| O custo de manutenção supera o retorno pelo cálculo da seção 5 do plano | `Ti ÷ (Tm − Ta − Mn/F)` acima do horizonte do projeto |

**Não são motivo sozinhos:** falhar com frequência (pode ser defeito real), ser lento (mover de nível primeiro) ou
"atrapalhar o merge".

**Quem decide:** a proposta é feita com o formulário **Remoção de teste** e precisa de **duas aprovações** na issue,
sendo uma do **Guardião da TAS**. Para teste de segurança, uma das aprovações deve ser do responsável da área do
backend.

**Riscos assumidos:** a issue registra o que deixa de ser verificado automaticamente e como passa a ser coberto
(outro teste, roteiro manual antes do release ou nada, se a funcionalidade saiu). Removido o teste, o caso é marcado
no plano, o catálogo e a rastreabilidade do `TESTES.md` são atualizados e a decisão entra no histórico (seção 9).

**Por quê:** remover teste reduz custo, mas também reduz proteção. Exigir critério, duas pessoas e o risco por
escrito impede que a remoção vire o atalho para uma falha que ninguém quis investigar.

---

## 8. Mecanismos no repositório

### 8.1 Visão geral

| Política | Mecanismo | Arquivo |
|---|---|---|
| Registro automático das falhas do CI com classificação pendente, prioridade e prazo | workflow *Issues de falha do CI* | `.github/workflows/ci-failure-issues.yml`, `.github/scripts/ci-failure-issue.js` |
| Falha que volta a passar no mesmo commit vira `teste instável` em vez de fechar | mesmo script | `.github/scripts/ci-failure-issue.js` |
| Registro manual de falha, teste instável e remoção | formulários de issue | `.github/ISSUE_TEMPLATE/*.yml` |
| Checklist de testes e manutenção em todo PR | template de PR | `.github/pull_request_template.md` |
| Bloqueio de `.only`, teste desligado sem registro e teste fora do catálogo | job **Política da TAS** no Quality Gate | `.github/workflows/ci.yml`, `.github/scripts/tas/check-tas.mjs` |
| Registro das quarentenas | arquivo versionado | `.github/tas/quarentena.json` |
| Prazos vencidos, quarentenas sem decisão, revisão quinzenal e labels | workflow *Manutenção da TAS* | `.github/workflows/tas-manutencao.yml`, `.github/scripts/tas/policy.js` |
| Métricas de instabilidade, tempo, cobertura e MTTR | relatório de qualidade | `.github/workflows/quality-report.yml` |

### 8.2 Labels

| Grupo | Labels |
|---|---|
| Classificação | `classificação: pendente`, `classificação: sut`, `classificação: tas`, `classificação: ambiente`, `classificação: variação esperada` |
| Prioridade | `prioridade: alta`, `prioridade: média`, `prioridade: baixa` |
| Situação | `teste instável`, `quarentena`, `remoção de teste`, `revisão da TAS`, `prazo vencido`, `manutenção da TAS` |
| Área (já existiam) | `ci-failure`, `area: backend`, `area: mobile`, `area: mobile-e2e`, `area: ai-agent` |

As labels são criadas pelo próprio workflow. Para criá-las de uma vez: *Actions → Manutenção da TAS → Run workflow →
labels*.

### 8.3 Verificação no Quality Gate

O job **Política da TAS** do `ci.yml` roda `node .github/scripts/tas/check-tas.mjs` e entra no **CI concluído**:

| Reprova o PR | Só avisa (sumário da execução) |
|---|---|
| teste com `.only` | quarentena vencida |
| teste desligado (`.skip`, `.fixme`, `xit`, `pending/`) sem registro na quarentena | quarentena sem issue |
| arquivo de teste fora do catálogo do `TESTES.md` | registro de um teste que voltou a rodar |
| registro de quarentena malformado ou de arquivo inexistente | quarentena maior que 14 dias sem `prorrogacao` |

Para rodar localmente: `node .github/scripts/tas/check-tas.mjs`.

### 8.4 Configuração única

1. Rodar *Manutenção da TAS → labels* uma vez (ou fazer merge em `main`, que sincroniza sozinho).
2. Definir a variável `CI_FAILURE_ASSIGNEES` (*Settings → Secrets and variables → Actions → Variables*) com o login do
   Guardião da quinzena e atualizá-la no rodízio.

---

## 9. Histórico de decisões e remoções

| Data | Decisão | Testes | Critério / motivo | Aprovação |
|---|---|---|---|---|
| 2026-10 | Removidos do backlog por estar fora do escopo | TC-15, TC-18, TC-19, TC-26, TC-29, TC-31, TC-32, TC-33, TC-34 | funcionalidade não implementada (plano de testes, seção 6.1) | equipe, antes desta política |
| 2026-10-15 | Fluxos Maestro movidos para `pending/` | M-02 (`register.yaml`), M-05 (`demand_crud.yaml`) | instáveis no emulador do CI; mantidos como roteiro assistido | equipe, antes desta política |
| 2026-11-05 | Quarentena dos dois fluxos registrada com prorrogação até 15/11/2026 | M-02, M-05 | regularização pela seção 5; decidir na revisão de 15/11 | registro em `.github/tas/quarentena.json` e issue #63 |

---

## 10. Aplicação da política

Três situações reais desta semana, do registro ao encaminhamento.

### Caso 1 — Falha intermitente em `demandService.test.ts` (instabilidade suspeita)

| Etapa | O que aconteceu |
|---|---|
| **Identificação** | Em 05/11/2026, uma execução completa da suíte do backend terminou com 1 falha em 198 testes (197 passaram), apontando o bloco `describe` de `backend/src/tests/unit/demandService.test.ts:42`. A mudança em andamento (filtros por categoria e região) não tocava esse arquivo. |
| **Investigação** | O arquivo rodado sozinho passou (24/24) e a suíte completa, rodada logo em seguida sem mudança de código, também (198/198). Em todas as execuções completas posteriores ele passou, inclusive em 6 repetições seguidas no mesmo commit (361/361 em cada). |
| **Classificação** | Instabilidade suspeita (seção 5), `prioridade: média`. A hipótese é carga na primeira execução (compilação do ts-jest em paralelo) somada às operações em disco do teste de fotos, o que aponta para `classificação: tas` ou `ambiente`; fica `classificação: pendente` até haver uma segunda ocorrência com o log completo. |
| **Encaminhamento** | Uma ocorrência em 14 dias fica abaixo do limite de quarentena: o teste **continua rodando e bloqueando**. Registrado na [issue #62](https://github.com/ArthurLins00/Projetos-V/issues/62) no formato do formulário **Teste instável** (labels `teste instável`, `classificação: pendente`, `prioridade: média`, `area: backend`), decisão *Monitorar*, taxa "1 falha em 10 execuções completas". Prazo de triagem: 1 dia útil. Se voltar a falhar até 19/11/2026, aplicar o passo 3 da seção 5.2 (corrigir ou quarentenar) com o log anexado. |

### Caso 2 — Defeito no cadastro de órgãos revelado por um teste novo (SUT)

| Etapa | O que aconteceu |
|---|---|
| **Identificação** | O caso A-120 (TC-64), escrito para elevar a cobertura, enviou um cadastro de órgão sem os campos obrigatórios e esperava 400. |
| **Investigação** | `organService.validarCamposObrigatorios` era `async` e era chamada sem `await`: a validação nunca bloqueava, o cadastro seguia e quebrava mais adiante com 500. Reproduzido também pela leitura do código. |
| **Classificação** | `classificação: sut`, `area: backend`, `prioridade: média` (o defeito estava em `main`, mas não travava o CI nem havia dado corrompido). |
| **Encaminhamento** | Corrigido no commit `6791104` (*fix(backend): enforce required fields when creating an organ*) junto com o teste, registrado na seção 5 do `TESTES.md` e no backlog (linha 58). |

### Caso 3 — Lacunas de rastreabilidade e quarentena sem registro (TAS)

| Etapa | O que aconteceu |
|---|---|
| **Identificação** | A primeira execução do `check-tas.mjs` reprovou com 6 erros: 4 arquivos de teste fora do catálogo do `TESTES.md` (`twoFactor`, `twoFactorDemo`, `registerDemo`, `mailFrom`) e 2 fluxos Maestro desligados em `pending/` sem registro. |
| **Investigação** | Os 4 arquivos existiam e passavam, mas nunca tinham sido catalogados; os fluxos estavam em `pending/` desde 15/10/2026 sem data para voltar. |
| **Classificação** | `classificação: tas`, `prioridade: baixa` (não afetava o produto, mas tirava a rastreabilidade e escondia testes desligados). |
| **Encaminhamento** | Catálogo completado (A-190 a A-202, U-86 a U-89) no commit `7c9429a`; quarentena dos fluxos registrada com prorrogação justificada até a revisão de 15/11/2026 (seção 9) e acompanhada na [issue #63](https://github.com/ArthurLins00/Projetos-V/issues/63) (labels `quarentena`, `classificação: tas`, `classificação: ambiente`, `prioridade: média`, `area: mobile-e2e`), ligada aos dois registros pelo campo `issue`. O `check-tas.mjs` passa sem erros nem avisos; se a decisão não sair até 15/11, o workflow marca a quarentena como vencida e cobra na issue **TAS: testes em quarentena precisam de decisão**. |
