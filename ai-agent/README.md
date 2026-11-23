# Fiscalize — Agente Conversacional com Ferramentas (AV2 · Trilha B)

| | |
|---|---|
| **Grupo** | Grupo 8 |
| **Membros** | 
ARTHUR BORBA LINS
ARTHUR RODRIGUES DE ANDRADE LIMA
BRUNO DORNELAS COSTA CIRO DA PENHA
BRUNO FELIPE DE CASTILHO GOMES REGO
FELIPE CISNEIROS AGOSTINHO
MICHELANGELO MORAIS DO REGO
PAULO HENRIQUE ALVES DE BARROS PEREIRA
RAMOM DE OLIVEIRA AGUIAR
THYALLES ARAUJO CAMPOS
VICTOR SIMAS AZEVEDO DE ALMEIDA |
| **Turma** | 5º Período de ADS Regular |
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Trilha** | B — Chatbot / agente com ferramentas (Google Gemini API · Function Calling) |
| **Stack** | Node.js 20+ · TypeScript · `@google/genai` · modelo `gemini-3.1-flash-lite` · dados em JSON (`dados/`) |

O **Assistente Fiscalize** recebe, em linguagem natural, o relato de um problema urbano com a
localização e, sozinho, decide chamar duas ferramentas:

1. **`classificar_e_rotear_ocorrencia`**: identifica a categoria ativa, o órgão competente
   (CELPE, COMPESA, EMLURB, CTTU, SEMC), a prioridade e o SLA. Gatilhos de emergência
   (ex.: *fiação exposta*, *esgoto em via*) resultam em prioridade **Crítica**.
2. **`buscar_chamados_similares`**: lista chamados **não finalizados** da mesma categoria em até
   **200 m**, devolvendo **apenas protocolo, distância aproximada e status** (sem dados pessoais).

Os dados do domínio (categorias, órgãos, regras de roteamento e chamados) ficam em **arquivos JSON
versionados** em [`dados/`](dados). As ferramentas só chegam a eles pelas **funções de acesso** de
[`src/data/acesso.ts`](src/data/acesso.ts), e cada chamada a uma dessas funções acrescenta uma linha
ao log [`logs/uso-dados.jsonl`](#4-como-gerar-o-log-três-chamadas-reproduzíveis). Não é preciso banco de dados.

**Roteiro deste README:** [1. Instalar e rodar](#1-como-instalar-e-rodar) ·
[2. Dicionário de dados](#2-dicionário-de-dados) · [3. Funções de acesso](#3-funções-de-acesso) ·
[4. Gerar o log](#4-como-gerar-o-log-três-chamadas-reproduzíveis) · [5. Ver o resumo](#5-como-ver-o-resumo) ·
[6. Respostas (a), (b) e (c)](#6-respostas-a-b-e-c) · [7. Uso de IA generativa](#7-declaração-de-uso-de-ia-generativa) ·
[Anexos](#anexos) (arquitetura, integração com o app, rastreabilidade e casos de teste)

---

## 1. Como instalar e rodar

### Pré-requisitos
- **Node.js 20 ou superior** (`node -v`)
- Para os passos 4 e 5 deste README (log e resumo) **não é preciso chave**.
- Só para conversar com o Gemini de verdade (`npm start`, `npm run demo`): uma chave da **Gemini API**,
  gratuita, criada em <https://aistudio.google.com/apikey>

### Passo a passo

```bash
git clone https://github.com/ArthurLins00/Projetos-V
```

```bash
cd Projetos-V/ai-agent
```

```bash
npm install
```

Pronto para os passos 4 e 5. Para usar o Gemini real, crie o `.env` a partir do modelo e cole sua
chave em `GEMINI_API_KEY`:

```bash
cp .env.example .env
```

> No Windows (PowerShell): `Copy-Item .env.example .env`

```dotenv
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_RPM=15
```

> **Cota do plano gratuito:** o agente limita sozinho as requisições por minuto (`GEMINI_RPM`) e,
> se a API ainda responder `429`, espera o tempo que ela indicar e tenta de novo. Cada pergunta usa
> de 2 a 3 requisições. Existe também uma **cota diária por modelo**; se ela acabar, o agente avisa
> na hora: troque `GEMINI_MODEL` ou use outra chave.

### Comandos

| Comando | O que faz | Precisa de chave? |
|---|---|---|
| `npm run chamadas` | Roda as **3 chamadas reproduzíveis** do agente (seção 4) e grava o log de uso dos dados | **Não** |
| `npm run resumo` | Mostra o **resumo do log** (seção 5) | **Não** |
| `npm test` | Suíte **offline e determinística**: 3 casos de teste, regras das ferramentas e funções de acesso | **Não** |
| `npm start` | Abre o **chat interativo** no terminal (também grava o log, com canal `cli`) | Sim |
| `npm run demo` | Roda os 3 casos de teste contra o Gemini real (canal `npm run demo` no log) | Sim |
| `npm run test:live` | Os mesmos casos contra o **Gemini real**, validando quais ferramentas o modelo chamou | Sim |
| `npm start -- --acompanhamento` | Chat de **consulta de status** como cidadão (dados mockados) | Sim |
| `npm start -- --acompanhamento --admin` | O mesmo, como **admin** (vê os chamados de todos) | Sim |
| `npm run serve` | Sobe o agente como serviço HTTP para o **app** (canal `POST /chat` no log; ver [Integração](#integração-com-o-app-fiscalize)) | Sim |
| `npm run dev:local` | Igual ao `serve`, recarregando a cada alteração (`tsx watch`) | Sim |
| `npm run typecheck` | Checagem de tipos do TypeScript | Não |

Dentro do chat (`npm start`): `/casos` mostra os prompts de teste, `/ferramentas` lista as
function declarations, `/limpar` reinicia a conversa e `/sair` encerra.

---

## 2. Dicionário de dados

Todos os dados são **fictícios** (nenhum dado pessoal real). Quem abriu um chamado aparece só como um
identificador pseudônimo (`solicitanteId`), que o agente nunca devolve ao modelo.

### [`dados/chamados.json`](dados/chamados.json): 12 chamados já registrados (conjunto principal)

| Campo | Significado no negócio |
|---|---|
| `protocolo` | Identificador público do chamado, que o cidadão usa para acompanhar (ex.: `DEM-20260921-A7K2`). É o que o agente mostra ao apontar um chamado semelhante. |
| `categoriaId` | Tipo de problema (ver `categorias.json`). Só chamados da **mesma categoria** contam como semelhantes. |
| `status` | Andamento do atendimento: `Aberto`, `Em Análise`, `Em Andamento`, `Resolvido` ou `Fechado`. Os dois últimos são finalizados e **não** entram na busca de semelhantes. |
| `latitude`, `longitude` | Onde o problema está. Servem para calcular a distância até o relato novo (raio de 200 m). |
| `bairro` | Bairro do Recife onde fica a ocorrência. Ajuda o gestor a ler a base; o agente não usa. |
| `descricao` | Resumo curto do problema, para quem lê a base. O agente não devolve este campo. |
| `solicitanteId` | Código pseudônimo de quem abriu o chamado. Nunca sai das funções de acesso para o modelo (LGPD). |
| `abertoEm` | Data de abertura do chamado. |

### [`dados/categorias.json`](dados/categorias.json): 7 categorias

| Campo | Significado no negócio |
|---|---|
| `id` | Código da categoria, usado pelas regras e pelos chamados. |
| `nome` | Nome mostrado ao cidadão (ex.: *Iluminação Pública*). |
| `ativa` | Se a prefeitura ainda aceita chamados nessa categoria. Categoria inativa (a 7, *Poda de Árvores*) não pode receber triagem nem busca de semelhantes (RN-01). |

### [`dados/regras.json`](dados/regras.json): 16 regras de roteamento

| Campo | Significado no negócio |
|---|---|
| `id` | Código da regra (`R01`…`R15`; `R00` é a regra padrão). Aparece no log para saber qual regra classificou o relato. |
| `categoriaId`, `subcategoria` | Para qual tipo de problema o relato é classificado. |
| `orgao` | Sigla do órgão que deve atender (ver `orgaos.json`). |
| `prioridade`, `slaHoras` | Urgência (`Baixa` a `Crítica`) e prazo de atendimento em horas. |
| `palavrasChave` | Termos (sem acento, minúsculos) que, se aparecerem no relato, escolhem esta regra. A primeira regra que casar vence, por isso as emergências vêm primeiro. |
| `emergencia` | Marca as situações de risco (fiação exposta, esgoto em via, cratera, árvore caída, semáforo apagado), que viram prioridade **Crítica** (RN-03). |
| `padrao` | Regra usada quando nenhuma palavra é reconhecida: vai para *Outros Problemas* / SEMC, para triagem manual. |

### [`dados/orgaos.json`](dados/orgaos.json): 5 órgãos

| Campo | Significado no negócio |
|---|---|
| `sigla`, `nome` | Órgão público responsável pelo atendimento (CELPE, COMPESA, EMLURB, CTTU, SEMC). |
| `slaHoras` | Prazo padrão do órgão. As regras podem definir um prazo menor (ex.: emergências). |

### Casos difíceis incluídos de propósito

| Caso | Onde | O que acontece |
|---|---|---|
| **Item sem semelhantes** | Buraco na Madalena (CT-03): não há chamado aberto de Infraestrutura em 200 m | A busca devolve lista vazia e o agente diz que a ocorrência pode ser registrada |
| **Identificador inexistente ou inativo** | Categoria `7` (inativa) e qualquer categoria fora da lista (ex.: `99`) | A função de acesso recusa com erro claro (`Categoria inativa: 7 …` / `Categoria inexistente: 99.`), registrado no log |
| **Relato sem regra** | Pedido de poda de árvore: nenhuma palavra-chave casa | Cai na regra padrão `R00` (Outros Problemas / SEMC) |
| **Chamados que nunca voltam** | `DEM-20260815-B1TT` e `DEM-20260710-F0CH` (finalizados), `DEM-20261010-P0DA` (categoria inativa), `DEM-20261002-ZZ90` (a 600 m) | Ficam fora da resposta, por regra de negócio |

---

## 3. Funções de acesso

As ferramentas do agente **não abrem os arquivos**: chamam só as funções abaixo, em
[`src/data/acesso.ts`](src/data/acesso.ts). A leitura crua dos JSON fica em
[`src/data/repositorio.ts`](src/data/repositorio.ts), que nenhuma ferramenta importa. Os arquivos são
relidos a cada chamada, então uma alteração vale na hora, sem reiniciar.

| Função | Lê | Chamada por (ferramenta) | Quando não encontra |
|---|---|---|---|
| `encontrarRegraPorTexto(texto, origem)` | `regras.json`, `categorias.json` | `classificar_e_rotear_ocorrencia` | Devolve a regra padrão `R00` (triagem manual) |
| `buscarCategoriaAtiva(categoriaId, origem)` | `categorias.json` | as duas ferramentas de triagem | Erro claro: `Categoria inexistente: 99.` ou `Categoria inativa: 7 (…)` |
| `buscarOrgao(sigla, origem)` | `orgaos.json` | `classificar_e_rotear_ocorrencia` | Erro claro: `Órgão inexistente: XYZ.` |
| `listarChamadosAbertosPorCategoria(categoriaId, origem)` | `chamados.json` | `buscar_chamados_similares` | Lista vazia `[]` |
| `listarChamadosDoUsuario(fonte, filtro, origem)` | backend (`GET /demands` com o JWT do usuário) ou mock da CLI | `consultar_status_chamados` (chat do app) | Lista vazia `[]`; sessão inválida vira erro claro |

Quando uma função lança erro, a ferramenta o devolve ao modelo como `{ "error": "…" }` e o agente
explica o problema ao cidadão, em vez de travar.

### Experiência: altero um dado e a resposta muda

1. Rode `npm run chamadas -- ct01`. O agente lista **2** chamados semelhantes:
   `DEM-20260921-A7K2 — ~80 m — Em Andamento` e `DEM-20260930-Q3MZ — ~150 m — Aberto`.
2. Em [`dados/chamados.json`](dados/chamados.json), troque o `status` do `DEM-20260930-Q3MZ` de
   `"Aberto"` para `"Resolvido"` e salve.
3. Rode `npm run chamadas -- ct01` de novo. Agora só aparece **1** chamado (`DEM-20260921-A7K2`),
   porque chamado resolvido não conta como semelhante.
4. Volte o `status` para `"Aberto"` (os testes automatizados dependem do valor original).

Outra variação: mude o `slaHoras` da regra `R01` de `4` para `2`, e o CT-01 passa a responder
`SLA: 2 h`.

---

## 4. Como gerar o log (três chamadas reproduzíveis)

As três chamadas rodam o **agente de verdade** (loop de function calling, ferramentas e funções de
acesso lendo os JSON) sem precisar de chave: só a decisão do modelo é roteirizada, como no `npm test`.
Rode, dentro de `ai-agent/`:

```bash
npm run chamadas -- ct01
```

```bash
npm run chamadas -- ct03
```

```bash
npm run chamadas -- erro
```

| Chamada | Relato | O que mostra no log |
|---|---|---|
| `ct01` | Fiação exposta na Av. Boa Viagem (CT-01) | Regra `R01`, categoria `3`, órgão `CELPE` e 3 chamados abertos de Iluminação lidos (2 ficam no raio de 200 m) |
| `ct03` | Buraco na Madalena (CT-03), **sem semelhantes** | Regra `R13`, categoria `1`, órgão `EMLURB`; 2 chamados de Infraestrutura lidos, nenhum perto |
| `erro` | Pedido de poda de árvore; o roteiro simula o modelo pedindo (como uma alucinação) a busca na categoria `7`, descontinuada | Regra padrão `R00` e uma linha com `"sucesso": false` e `"erro": "Categoria inativa: 7 …"` |

`npm run chamadas` (sem argumento) roda as três em sequência. Cada execução **acrescenta** linhas ao
arquivo **`ai-agent/logs/uso-dados.jsonl`**, sem apagar as anteriores. O arquivo não é versionado
(está no `.gitignore`); ele é criado na primeira chamada. O chat (`npm start`), a demo com o Gemini
(`npm run demo`) e o serviço do app (`npm run serve`) gravam no mesmo arquivo, cada um com seu `canal`.
Para gravar em outro arquivo, defina a variável de ambiente `FISCALIZE_LOG_USO_DADOS` com o caminho
(os testes automatizados fazem isso e usam um arquivo temporário).

### Formato de cada linha

Uma linha JSON por chamada de função de acesso. Exemplo real (gerado por `npm run chamadas -- ct01`):

```json
{"data_hora":"2026-11-23T19:35:31.652Z","funcao":"listarChamadosAbertosPorCategoria","chamador":"buscar_chamados_similares","canal":"npm run chamadas -- ct01","colecao":"chamados","parametros":{"categoria_id":3},"registros_retornados":3,"ids_retornados":["DEM-20260921-A7K2","DEM-20260930-Q3MZ","DEM-20261002-ZZ90"],"sucesso":true,"erro":null}
```

| Campo | Conteúdo |
|---|---|
| `data_hora` | Data e hora da chamada (ISO 8601, UTC) |
| `funcao` | Nome da função de acesso |
| `chamador` | Quem chamou: a ferramenta do agente |
| `canal` | Por onde a mensagem chegou: `npm run chamadas -- …`, `cli`, `npm run demo` ou a rota `POST /chat` |
| `colecao` | Conjunto de dados lido (`regras`, `categorias`, `orgaos`, `chamados`, `chamados_do_usuario`) |
| `parametros` | Parâmetros em resumo, **só identificadores** (categoria, sigla, protocolo, status). O relato do cidadão nunca entra (só o tamanho do texto), nem as coordenadas |
| `registros_retornados` | Quantos registros voltaram |
| `ids_retornados` | Quais registros voltaram (base do resumo de "mais e nunca consultados") |
| `sucesso`, `erro` | Se deu certo e, se não, a mensagem de erro |

**Três linhas que mostram o módulo usando os dados**, depois das três chamadas: a de
`listarChamadosAbertosPorCategoria` do `ct01` (acima: 3 chamados lidos de `chamados.json`), a de
`encontrarRegraPorTexto` do `ct03` (`"ids_retornados":["R13"]`, a regra de buraco escolhida em
`regras.json`) e a de `buscarCategoriaAtiva` do `erro` (`"sucesso":false`, categoria 7 inativa em
`categorias.json`).

---

## 5. Como ver o resumo

```bash
npm run resumo
```

O script [`scripts/resumo.ts`](scripts/resumo.ts) lê o log e mostra quantas vezes cada função foi
chamada, quantos erros houve, quais registros de cada conjunto foram mais consultados e quais nunca
foram. Ele lê os JSON direto para listar todos os registros, sem passar pelas funções de acesso, para
não acrescentar linhas ao próprio log. Para resumir outro arquivo: `npm run resumo -- caminho/do/log.jsonl`.

Saída depois das três chamadas da seção 4 (log novo):

```
14 chamadas

Chamadas por função
  funcao                              chamadas  erros  registros_retornados  chamada_por
  buscarCategoriaAtiva                6         1      5                     classificar_e_rotear_ocorrencia, buscar_chamados_similares
  encontrarRegraPorTexto              3         0      3                     classificar_e_rotear_ocorrencia
  buscarOrgao                         3         0      3                     classificar_e_rotear_ocorrencia
  listarChamadosAbertosPorCategoria   2         0      5                     buscar_chamados_similares

Conjunto "categorias"
  Mais consultados: 3 (2x), 1 (2x), 6 (1x)
  Nunca consultados (4 de 7): 2, 4, 5, 7

Conjunto "orgaos"
  Mais consultados: CELPE (1x), EMLURB (1x), SEMC (1x)
  Nunca consultados (2 de 5): COMPESA, CTTU

Conjunto "regras"
  Mais consultados: R01 (1x), R13 (1x), R00 (1x)
  Nunca consultados (13 de 16): R02, R03, R04, R05, R06, R07, R08, R09, R10, R11, R12, R14, R15

Conjunto "chamados"
  Mais consultados: DEM-20260921-A7K2 (1x), DEM-20260930-Q3MZ (1x), DEM-20261002-ZZ90 (1x), DEM-20261001-C4RR (1x), DEM-20261015-H2OB (1x)
  Nunca consultados (7 de 12): DEM-20260815-B1TT, DEM-20261003-E8SG, DEM-20260710-F0CH, DEM-20261005-L1X0, DEM-20261008-S5NL, DEM-20261010-P0DA, DEM-20261012-V4ZA

Erros (1)
  1x buscarCategoriaAtiva ← buscar_chamados_similares: Categoria inativa: 7 (Poda de Árvores (descontinuada)).
```

---

## 6. Respostas (a), (b) e (c)

Com base no resumo acima (as três chamadas da seção 4):

**(a) Qual dado o módulo mais usa?** A **categoria**: `buscarCategoriaAtiva` foi a função mais chamada
(6 de 14 chamadas), porque as duas ferramentas validam a categoria antes de seguir. É ela que decide o
órgão, a prioridade e quais chamados contam como semelhantes. Entre os chamados, os 5 lidos empatam em
1 vez cada, porque o log conta a leitura da categoria inteira, antes do filtro de 200 m. Desses, só
`DEM-20260921-A7K2` e `DEM-20260930-Q3MZ` ficaram dentro do raio e viraram resposta ao cidadão.

**(b) Algum dado nunca foi usado? O que isso sugere?** Sim: 13 das 16 regras, 2 dos 5 órgãos (COMPESA e
CTTU) e 7 dos 12 chamados. Parte disso é esperada: chamados finalizados (`DEM-20260815-B1TT`,
`DEM-20260710-F0CH`) e de categoria inativa (`DEM-20261010-P0DA`) nunca voltam, por regra, e poderiam ir
para um arquivo morto. O resto mostra que três chamadas cobrem só três tipos de problema: faltam
cenários de água, esgoto e sinalização. Rodar também `npm run chamadas -- ct02` (esgoto na Rua da Aurora) passa a usar
a regra `R02`, a COMPESA e o chamado `DEM-20261003-E8SG`.

**(c) Houve erro? Por quê?** Houve 1, de propósito: na chamada `erro`, o roteiro simula o modelo
pedindo chamados semelhantes na categoria 7 (*Poda de Árvores*), como uma alucinação, para exercitar o
tratamento de erro. Essa categoria está **inativa**. A função `buscarCategoriaAtiva`
recusou com erro claro (RN-01), a ferramenta devolveu `{ "error": … }` e o agente explicou ao cidadão
que a ocorrência seguiu para triagem manual. O erro também revela uma lacuna nos dados: nenhuma regra
ativa cobre "poda", então esses relatos caem na regra padrão `R00`. Vale criar uma regra de poda em
Infraestrutura (EMLURB).

---

## 7. Declaração de uso de IA generativa

Declaro que utilizei as ferramentas de Inteligência Artificial Claude (Opus 5.5), da Anthropic, e Gemini (3.6 Flash), do Google, como apoio na elaboração desta atividade, para a geração de rascunhos, sugestões de código, revisão de textos e esclarecimento de dúvidas. Realizei análise crítica (curadoria) de todo o conteúdo gerado, verificando sua correção, adequação e aderência aos objetivos da atividade, e fiz os ajustes necessários. Não tratei dados pessoais no uso dessas ferramentas. Reconheço que as respostas geradas por IA podem conter imprecisões e assumo a responsabilidade integral pela versão final apresentada.

---

# Anexos

Material de apoio: arquitetura do agente, integração com o app, rastreabilidade dos requisitos e os
casos de teste da entrega anterior.

## Arquitetura

```
ai-agent/
├── dados/                           Dados versionados (JSON): categorias, órgãos, regras e chamados
├── logs/uso-dados.jsonl             Log de uso dos dados (gerado; fora do git)
├── src/
│   ├── index.ts                     CLI interativa (readline)
│   ├── serve.ts / server.ts         Serviço HTTP do agente para o app (POST /chat)
│   ├── agent.ts                     Loop de function calling (modelo ↔ ferramentas) + histórico
│   ├── config.ts                    Leitura do .env (chave, modelo, RPM, modo servidor)
│   ├── casos.ts                     Os 3 prompts de teste (compartilhados por CLI, demo e testes)
│   ├── llm/geminiClient.ts          Adaptador do SDK @google/genai (temperature 0, tools, limite RPM, retry)
│   ├── llm/scriptedClient.ts        Dublê do Gemini (testes offline e npm run chamadas)
│   ├── perfis/
│   │   ├── triagem.ts               System instruction + FunctionDeclarations da entrega AV2
│   │   └── acompanhamento.ts        System instruction + FunctionDeclaration do chat do app
│   ├── conhecimento/guiaApp.ts      Guia de uso do app incluído no prompt do chat
│   ├── tools/
│   │   ├── index.ts                 Dispatcher executarFerramenta (erros viram { error })
│   │   ├── classificarERotearOcorrencia.ts
│   │   ├── buscarChamadosSimilares.ts
│   │   ├── consultarStatusChamados.ts
│   │   └── utils.ts                 normalização de texto, validação de coordenadas, Haversine
│   └── data/
│       ├── acesso.ts                Funções de acesso: único caminho das ferramentas até os dados
│       ├── logUso.ts                Grava uma linha JSON por chamada de função de acesso
│       ├── repositorio.ts           Leitura crua dos JSON de dados/ (uso interno)
│       ├── mockData.ts              Tipos do domínio e pontos dos casos de teste
│       └── chamadosSource.ts        Chamados do usuário: mock (CLI/testes) ou API real (GET /demands)
├── scripts/
│   ├── demo.ts                      Executa os 3 casos contra o Gemini
│   ├── chamadas.ts                  3 chamadas reproduzíveis sem chave (gera o log)
│   └── resumo.ts                    Resumo do log de uso dos dados
└── tests/
    ├── agente.test.ts               3 casos de teste (offline, LLM roteirizado)
    ├── ferramentas.test.ts          Regras das ferramentas e funções de acesso + log
    ├── acompanhamento.test.ts       Regra de acesso, repasse do JWT e servidor HTTP
    ├── setup.ts                     Manda o log dos testes para um arquivo temporário
    └── live/gemini.test.ts          Casos de teste contra o Gemini real
```

**Fluxo de uma mensagem**

```
Cidadão ──texto──▶ FiscalizeAgent ──histórico + tools──▶ Gemini
                        ▲                                  │ functionCall(classificar_e_rotear_ocorrencia)
                        │◀─────────────────────────────────┘
                        │ executa a ferramenta (TS local) ──functionResponse──▶ Gemini
                        │                                  │ functionCall(buscar_chamados_similares)
                        │◀─────────────────────────────────┘
                        │ executa a ferramenta ──functionResponse──▶ Gemini ──texto final──▶ Cidadão
```

O agente depende só da interface `ModelClient`. Em produção ela é o `GeminiClient`; no `npm test`
entra um `ScriptedModelClient`, que reproduz as decisões do modelo de forma fixa, enquanto o
loop do agente e as **ferramentas reais** rodam de verdade. É isso que deixa os testes
previsíveis e executáveis sem chave nem internet.

---

## Integração com o app Fiscalize

Além da entrega isolada, o agente também está ligado ao projeto completo. Na tela inicial do app
(**Minhas Demandas**), o botão de estrelinhas no topo abre o **Assistente Fiscalize**, que:

- informa o **status e o prazo estimado** dos chamados e avisa quando o prazo já passou;
- explica **como usar o app** (registrar chamado, anexar fotos, editar, notificações, perfil, senha),
  com base no guia em [`src/conhecimento/guiaApp.ts`](src/conhecimento/guiaApp.ts), e indica a tela
  de **Ajuda** quando a dúvida não está no guia;
- tira **dúvidas gerais** sobre o atendimento (significado dos status, como funcionam os prazos);
- em relatos de **emergência**, orienta primeiro a ligar para 190, 192 ou 193;
- recusa com educação assuntos sem relação com o Fiscalize.

O guia do app é texto fixo dentro do prompt. Ao mudar uma tela do app, atualize também
`guiaApp.ts` e a FAQ do app (`mobile/src/models/Faq.ts`).

```
App (balão 💬) ──POST /ai/chat + JWT──▶ Backend (Express) ──POST /chat + JWT──▶ ai-agent (npm run serve)
                                              ▲                                     │ Gemini decide chamar
                                              └──── GET /demands (com o MESMO JWT) ◀┘ consultar_status_chamados
```

O agente usa o perfil **acompanhamento** e uma única ferramenta:

| Ferramenta | Parâmetros | O que retorna |
|---|---|---|
| `consultar_status_chamados` | `protocolos?: string[]` (até 10), `status?` | protocolo, título, categoria, status, endereço, datas e prazo de cada chamado (`prazo_limite`, `situacao_prazo`: `no_prazo`, `vencido`, `encerrado` ou `sem_prazo`, e `horas_para_o_prazo`); `nao_encontrados` |

**Quem vê o quê.** O agente nunca acessa o banco diretamente: ele consulta `GET /demands`
com o **JWT do próprio usuário**, então quem aplica a regra é o backend.

| Perfil | Acesso pelo assistente |
|---|---|
| Cidadão | Somente os **próprios** chamados. Um protocolo de outra pessoa aparece como "não encontrado", sem confirmar se ele existe |
| Gestor / Admin | **Todos** os chamados |

Nenhum dado pessoal de quem abriu o chamado (nome, e-mail) é repassado ao modelo, nem para o
admin. A sessão de conversa é vinculada ao ID do usuário no backend, então ninguém continua a
conversa de outra pessoa.

### Como rodar integrado

> **Atalho:** na raiz do repositório, `npm run dev:local` sobe backend, agente (quando há `GEMINI_API_KEY`
> no `ai-agent/.env`) e app de uma vez; `npm run dev:ai` sobe só o agente. Detalhes em
> [README › Modo local](../README.md#modo-local). O passo a passo manual continua abaixo.

1. **Backend** (`backend/`): suba normalmente (`npm run dev`, porta 3000). Por padrão ele procura
   o agente em `http://127.0.0.1:3333`; para mudar, defina `AI_AGENT_URL` no `backend/.env`.
2. **Agente** (`ai-agent/`), em outro terminal:
   ```bash
   npm run serve
   ```
   Lê `GEMINI_API_KEY` do `ai-agent/.env` e consulta o backend em `FISCALIZE_API_URL`
   (padrão `http://localhost:3000`).
3. **App** (`mobile/`): `npm start`, faça login e toque no balão 💬 da tela inicial.

Opcional: defina o mesmo `AI_AGENT_SECRET` no `backend/.env` e no `ai-agent/.env` para que o
serviço do agente só aceite chamadas do backend. Por padrão o agente escuta apenas em `127.0.0.1`.

Sem o `npm run serve` rodando, o restante do app funciona normalmente. Só o chat mostra
"O assistente está indisponível no momento".

---

## Tabela de rastreabilidade (AV1 → Agente)

| Requisito AV1 | Descrição resumida | Onde é atendido no agente |
|---|---|---|
| **RF-01** | Registro de ocorrência a partir do relato do cidadão | Prompt em linguagem natural → parâmetro `descricao` de `classificar_e_rotear_ocorrencia` |
| **RF-02** | Localização geográfica da ocorrência | Parâmetros `latitude`/`longitude` (validados); o prompt manda **pedir as coordenadas** se faltarem |
| **RF-03** | Categorização da ocorrência | `classificar_e_rotear_ocorrencia` → `categoria_id`, `categoria`, `subcategoria` |
| **RF-04** | Encaminhamento ao órgão competente (regra de roteamento) | `classificar_e_rotear_ocorrencia` → `orgao_sigla`, `orgao_nome`, `sla_horas` (tabela `REGRAS`) |
| **RF-07** | Definição de prioridade | `classificar_e_rotear_ocorrencia` → `prioridade` (Baixa / Média / Alta / Crítica) |
| **RN-01** | Só categorias **ativas** podem ser usadas | Regras de categorias inativas são ignoradas; `buscar_chamados_similares` rejeita categoria inativa |
| **RN-03** | Emergência urbana ⇒ prioridade **Crítica** | Regras `emergencia: true` (fiação exposta, esgoto em via, cratera, árvore caída, semáforo apagado) |
| **RF-05** | Detecção de ocorrências duplicadas/semelhantes | `buscar_chamados_similares` (mesma categoria, raio de 200 m, Haversine) |
| **RF-18** | Consulta de chamados próximos e seu andamento | `buscar_chamados_similares` → `protocolo`, `status`, ignora `Resolvido`/`Fechado` |
| **RN-04** | Privacidade: não expor dados pessoais de terceiros | Projeção explícita só com `protocolo`, `distancia_aproximada_metros` e `status`; regra de LGPD no system prompt; testado em CT-01 |

---

## Casos de teste para o docente

Rode `npm start` e cole **exatamente** um dos prompts abaixo (ou rode todos de uma vez com
`npm run demo`). Também dá para usar `/limpar` entre um caso e outro.

### CT-01: Emergência elétrica com chamados similares

**Prompt:**
```text
Tem um poste com fiação exposta soltando faísca na Av. Boa Viagem, bem em frente ao meu prédio. Minha localização é latitude -8.1197 e longitude -34.8986.
```

**Ferramentas disparadas:**
1. `classificar_e_rotear_ocorrencia({ descricao, latitude: -8.1197, longitude: -34.8986 })`
2. `buscar_chamados_similares({ categoria_id: 3, latitude: -8.1197, longitude: -34.8986 })`

**Resposta esperada (conteúdo):**
- Categoria **Iluminação Pública** (Fiação exposta com risco elétrico)
- Órgão **CELPE**, prioridade **Crítica**, SLA **4 h**, com um alerta de segurança
- 2 chamados semelhantes:
  `DEM-20260921-A7K2 — ~80 m — Em Andamento` e `DEM-20260930-Q3MZ — ~150 m — Aberto`
- Sugestão de acompanhar o chamado existente. **Não** aparecem o chamado `Resolvido` a 40 m,
  o chamado a 600 m nem nenhum nome/CPF/telefone.

### CT-02: Esgoto em via pública

**Prompt:**
```text
Há esgoto em via pública correndo pela Rua da Aurora há dois dias. Coordenadas: -8.0597, -34.8811.
```

**Ferramentas disparadas:**
1. `classificar_e_rotear_ocorrencia({ descricao, latitude: -8.0597, longitude: -34.8811 })`
2. `buscar_chamados_similares({ categoria_id: 2, latitude: -8.0597, longitude: -34.8811 })`

**Resposta esperada (conteúdo):**
- Categoria **Água e Esgoto** (Esgoto a céu aberto)
- Órgão **COMPESA**, prioridade **Crítica**, SLA **12 h**
- 1 chamado semelhante: `DEM-20261003-E8SG — ~120 m — Em Análise`
  (o chamado `Fechado` a 40 m é ignorado)

### CT-03: Buraco comum, sem duplicados

**Prompt:**
```text
Apareceu um buraco grande no asfalto da rua aqui na Madalena. Estou em -8.0545, -34.9105.
```

**Ferramentas disparadas:**
1. `classificar_e_rotear_ocorrencia({ descricao, latitude: -8.0545, longitude: -34.9105 })`
2. `buscar_chamados_similares({ categoria_id: 1, latitude: -8.0545, longitude: -34.9105 })`

**Resposta esperada (conteúdo):**
- Categoria **Infraestrutura** (Buraco na pista)
- Órgão **EMLURB**, prioridade **Alta**, SLA **48 h**
- Nenhum chamado aberto em até 200 m; a ocorrência pode ser registrada

### Extra: localização ausente

**Prompt:** `Tem um poste apagado na minha rua.`
**Esperado:** **nenhuma** ferramenta é chamada; o agente pede a latitude e a longitude.
Depois, responda por exemplo `-8.1197, -34.8986` e o fluxo continua (Iluminação Pública /
CELPE / Média, com os mesmos 2 chamados próximos do CT-01).

> O texto exato da resposta varia a cada execução porque é gerado pelo LLM (mesmo com
> `temperature: 0`). Os **dados** (categoria, órgão, prioridade, SLA, protocolos, distâncias)
> vêm das ferramentas e são sempre os mesmos. É isso que `npm run test:live` verifica.

### Validação automatizada

```bash
npm test
```

Saída esperada: `tests 26 · pass 26 · fail 0`. Valida os 3 casos acima (sequência de
ferramentas, encadeamento do `categoria_id` da 1ª para a 2ª ferramenta, prioridade, órgão,
protocolos, distâncias e ausência de dados pessoais), além das regras das ferramentas e do
perfil de acompanhamento: cidadão × admin, repasse do JWT ao backend e o servidor HTTP.

```bash
npm run test:live
```

Com `GEMINI_API_KEY` configurada, envia os prompts ao Gemini real e verifica se o **modelo**
escolheu as ferramentas certas e citou os protocolos esperados. Sem chave, os testes são
ignorados (*skipped*).
