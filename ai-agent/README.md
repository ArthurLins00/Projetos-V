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
| **Stack** | Node.js 20+ · TypeScript · `@google/genai` · modelo `gemini-3.1-flash-lite` |

O **Assistente Fiscalize** recebe, em linguagem natural, o relato de um problema urbano com a
localização e, sozinho, decide chamar duas ferramentas:

1. **`classificar_e_rotear_ocorrencia`**: identifica a categoria ativa, o órgão competente
   (CELPE, COMPESA, EMLURB, CTTU, SEMC), a prioridade e o SLA. Gatilhos de emergência
   (ex.: *fiação exposta*, *esgoto em via*) resultam em prioridade **Crítica**.
2. **`buscar_chamados_similares`**: lista chamados **não finalizados** da mesma categoria em até
   **200 m**, devolvendo **apenas protocolo, distância aproximada e status** (sem dados pessoais).

Depois o agente responde com uma triagem estruturada. Os dados (categorias, órgãos, regras de
competência e chamados) são **mockados em memória** e espelham o seed do backend
([`backend/prisma/seed.ts`](../backend/prisma/seed.ts)). Não é preciso banco de dados.

---

## Como instalar e executar

### Pré-requisitos
- **Node.js 20 ou superior** (`node -v`)
- Uma chave da **Gemini API**, gratuita, criada em <https://aistudio.google.com/apikey>

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

Crie o `.env` a partir do modelo e cole sua chave em `GEMINI_API_KEY`:

```bash
cp .env.example .env
```

> No Windows (PowerShell): `Copy-Item .env.example .env`

```dotenv
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.1-flash-lite   # opcional
GEMINI_RPM=15                   # opcional: requisições/minuto da sua cota
```

> **Cota do plano gratuito:** o agente limita sozinho as requisições por minuto (`GEMINI_RPM`) e,
> se a API ainda responder `429`, espera o tempo que ela indicar e tenta de novo. Cada pergunta
> usa de 2 a 3 requisições (uma por passo modelo ↔ ferramenta). Por isso `npm run demo` e
> `npm run test:live` podem pausar alguns segundos entre os casos. Algumas versões de modelo têm
> cota menor que 15/min; nesse caso, ajuste `GEMINI_RPM`.
>
> Existe também uma **cota diária por modelo**. Nos testes, o `gemini-3.1-flash-lite` aguentou
> rodar tudo várias vezes, mas modelos maiores (ex.: `gemini-3.8-flash`) liberam só 20
> requisições por dia no plano gratuito. Se a cota diária acabar, o agente avisa na hora; troque
> `GEMINI_MODEL` ou use outra chave.

### Comandos

| Comando | O que faz | Precisa de chave? |
|---|---|---|
| `npm start` | Abre o **chat interativo** no terminal | Sim |
| `npm run demo` | Roda os 3 casos de teste em sequência contra o Gemini e mostra as respostas | Sim |
| `npm test` | Suíte **offline e determinística**: 3 casos de teste + regras das ferramentas | **Não** |
| `npm run test:live` | Os mesmos 3 casos (e mais um) contra o **Gemini real**, validando quais ferramentas o modelo chamou | Sim |
| `npm start -- --acompanhamento` | Chat de **consulta de status** como cidadão (dados mockados) | Sim |
| `npm start -- --acompanhamento --admin` | O mesmo, como **admin** (vê os chamados de todos) | Sim |
| `npm run serve` | Sobe o agente como serviço HTTP para o **app** (ver [Integração](#integração-com-o-app-fiscalize)) | Sim |
| `npm run typecheck` | Checagem de tipos do TypeScript | Não |

Dentro do chat (`npm start`): `/casos` mostra os prompts de teste, `/ferramentas` lista as
function declarations, `/limpar` reinicia a conversa e `/sair` encerra.
Toda chamada de ferramenta aparece no terminal com os argumentos e o resultado:

```
Você › Tem um poste com fiação exposta ... latitude -8.1197 e longitude -34.8986.
  🔧 classificar_e_rotear_ocorrencia({"descricao":"Tem um poste com fiação exposta ...","latitude":-8.1197,"longitude":-34.8986})
     ↳ {"categoria_id":3,"categoria":"Iluminação Pública","orgao_sigla":"CELPE","prioridade":"Crítica",...}
  🔧 buscar_chamados_similares({"categoria_id":3,"latitude":-8.1197,"longitude":-34.8986})
     ↳ {"total_encontrado":2,"chamados":[{"protocolo":"DEM-20260921-A7K2","distancia_aproximada_metros":80,...}]}

Fiscalize › **Triagem da ocorrência** ...
```

---

## Arquitetura

```
ai-agent/
├── src/
│   ├── index.ts                     CLI interativa (readline)
│   ├── serve.ts / server.ts         Serviço HTTP do agente para o app (POST /chat)
│   ├── agent.ts                     Loop de function calling (modelo ↔ ferramentas) + histórico
│   ├── config.ts                    Leitura do .env (chave, modelo, RPM, modo servidor)
│   ├── casos.ts                     Os 3 prompts de teste (compartilhados por CLI, demo e testes)
│   ├── llm/geminiClient.ts          Adaptador do SDK @google/genai (temperature 0, tools, limite RPM, retry)
│   ├── perfis/
│   │   ├── triagem.ts               System instruction + FunctionDeclarations da entrega AV2
│   │   └── acompanhamento.ts        System instruction + FunctionDeclaration do chat do app
│   ├── tools/
│   │   ├── index.ts                 Dispatcher executarFerramenta (erros viram { error })
│   │   ├── classificarERotearOcorrencia.ts
│   │   ├── buscarChamadosSimilares.ts
│   │   ├── consultarStatusChamados.ts
│   │   └── utils.ts                 normalização de texto, validação de coordenadas, Haversine
│   └── data/
│       ├── mockData.ts              Categorias, órgãos, regras de competência e chamados (em memória)
│       └── chamadosSource.ts        Chamados do usuário: mock (CLI/testes) ou API real (GET /demands)
├── scripts/demo.ts                  Executa os 3 casos contra o Gemini
└── tests/
    ├── agente.test.ts               3 casos de teste (offline, LLM roteirizado)
    ├── ferramentas.test.ts          Regras de negócio das ferramentas
    ├── acompanhamento.test.ts       Regra de acesso, repasse do JWT e servidor HTTP
    ├── scriptedClient.ts            Dublê do Gemini para os testes offline
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
(**Minhas Demandas**), o balão 💬 no canto inferior esquerdo abre o **Assistente Fiscalize**, que
responde perguntas sobre o **status de um ou mais chamados**.

```
App (balão 💬) ──POST /ai/chat + JWT──▶ Backend (Express) ──POST /chat + JWT──▶ ai-agent (npm run serve)
                                              ▲                                     │ Gemini decide chamar
                                              └──── GET /demands (com o MESMO JWT) ◀┘ consultar_status_chamados
```

O agente usa o perfil **acompanhamento** e uma única ferramenta:

| Ferramenta | Parâmetros | O que retorna |
|---|---|---|
| `consultar_status_chamados` | `protocolos?: string[]` (até 10), `status?` | protocolo, título, categoria, status, endereço e datas de cada chamado; `nao_encontrados` |

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

Saída esperada: `tests 20 · pass 20 · fail 0`. Valida os 3 casos acima (sequência de
ferramentas, encadeamento do `categoria_id` da 1ª para a 2ª ferramenta, prioridade, órgão,
protocolos, distâncias e ausência de dados pessoais), além das regras das ferramentas e do
perfil de acompanhamento: cidadão × admin, repasse do JWT ao backend e o servidor HTTP.

```bash
npm run test:live
```

Com `GEMINI_API_KEY` configurada, envia os prompts ao Gemini real e verifica se o **modelo**
escolheu as ferramentas certas e citou os protocolos esperados. Sem chave, os testes são
ignorados (*skipped*).
