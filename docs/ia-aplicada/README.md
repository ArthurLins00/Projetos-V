# IA Aplicada

| | |
|---|---|
| **Papel no PI** | Agente conversacional com ferramentas (AV2, Trilha B): triagem de ocorrências e assistente de acompanhamento dentro do app |
| **Código** | [`ai-agent/`](../../ai-agent) (agente e serviço HTTP), [`aiService.ts`](../../backend/src/services/aiService.ts) e [`aiRoutes.ts`](../../backend/src/routes/aiRoutes.ts) (ponte no backend), [`AssistantView.tsx`](../../mobile/src/views/AssistantView.tsx) e [`useAssistantViewModel.ts`](../../mobile/src/viewmodels/useAssistantViewModel.ts) (chat no app) |
| **Documentação técnica** | [`ai-agent/README.md`](../../ai-agent/README.md): instalação, comandos, arquitetura, rastreabilidade AV1 → agente e casos de teste para o docente |
| **Stack** | Node.js 20+ · TypeScript · `@google/genai` · modelo `gemini-3.1-flash-lite` (configurável em `GEMINI_MODEL`) |
| **Conexões** | integrado ao app do [Mobile](../desenvolvimento-mobile/README.md); respeita a autorização e a minimização de [Segurança](../seguranca-da-informacao/README.md); diferencial de acessibilidade em [Negócios](../negocios-na-internet/README.md); testado em [Testes](../testes-automatizados/README.md) |

---

## 1. O que o agente faz

O agente tem **dois perfis**, cada um com *system instruction* e ferramentas próprias
([`src/perfis`](../../ai-agent/src/perfis)):

| Perfil | Onde roda | Ferramentas | Resultado |
|---|---|---|---|
| **Triagem** (entrega AV2) | CLI (`npm start`) e demo (`npm run demo`) | `classificar_e_rotear_ocorrencia`, `buscar_chamados_similares` | Categoria, órgão competente (CELPE, COMPESA, EMLURB, CTTU, SEMC), prioridade, SLA e chamados semelhantes em até 200 m |
| **Acompanhamento** (integração com o app) | Serviço HTTP (`npm run serve`), chamado pelo backend | `consultar_status_chamados` | Status e prazo dos chamados do usuário, ajuda de uso do app, dúvidas gerais; orienta 190/192/193 em emergências |

### Ferramentas (*function calling*)

| Ferramenta | Entrada | Regra de negócio | Saída |
|---|---|---|---|
| `classificar_e_rotear_ocorrencia` | descrição, latitude, longitude | só categorias ativas; gatilhos de emergência (fiação exposta, esgoto em via, cratera, árvore caída, semáforo apagado) ⇒ prioridade **Crítica** | categoria, subcategoria, órgão, prioridade, SLA |
| `buscar_chamados_similares` | categoria, latitude, longitude | mesma categoria, não finalizados, distância por **Haversine** ≤ 200 m | **só** protocolo, distância aproximada e status |
| `consultar_status_chamados` | até 10 protocolos e/ou status | consulta `GET /demands` com o JWT do próprio usuário | protocolo, título, categoria, status, endereço, datas, prazo e situação do prazo |

---

## 2. Arquitetura

### 2.1 Loop do agente

```
mensagem ─▶ FiscalizeAgent.send ─▶ ModelClient.generate(histórico, perfil)
                 ▲                         │
                 │                         ├─ sem functionCall ─▶ resposta final
                 │                         └─ functionCall(s)
                 │                               │ executarFerramenta (TypeScript local, erros viram { error })
                 └──── functionResponse ◀────────┘
              (no máximo 6 passos por mensagem; acima disso, erro explícito)
```

O agente depende só da interface **`ModelClient`**. Em produção ela é o `GeminiClient`; nos testes, o
`ScriptedModelClient` reproduz as decisões do modelo de forma fixa, enquanto o loop e as
**ferramentas reais** executam de verdade.

### 2.2 Integração com o app

```
App (balão 💬) ──POST /ai/chat + JWT──▶ Backend ──POST /chat + JWT + x-agent-secret──▶ ai-agent (127.0.0.1:3333)
                                           ▲                                               │ Gemini decide chamar
                                           └────── GET /demands (com o MESMO JWT) ◀────────┘ consultar_status_chamados
```

- **Quem aplica a autorização é o backend:** o agente nunca acessa o banco; consulta a API com o JWT do
  usuário. O cidadão vê só os próprios chamados (um protocolo de outra pessoa aparece como "não
  encontrado", sem confirmar que existe); gestor e admin veem todos.
- **Sessões de conversa** vinculadas ao ID do usuário, com expiração por inatividade (30 min) e limite
  de sessões em memória.
- **Proteções do serviço:** escuta só em `127.0.0.1` por padrão; segredo compartilhado `x-agent-secret`
  comparado em tempo constante; corpo limitado a 16 KB e mensagem a 1.000 caracteres.
- **Indisponibilidade não derruba o app:** sem o agente, só o chat mostra "O assistente está indisponível".

---

## 3. Tecnologias

### 3.1 Google Gemini (`gemini-3.1-flash-lite`) via `@google/genai`

- **Como:** `generateContent` com `systemInstruction` do perfil, `tools` com as *FunctionDeclarations* e
  `functionCallingConfig` em modo `AUTO` (o modelo decide se e qual ferramenta chamar); **temperatura 0**
  para respostas estáveis.
- **Por quê:**
  - é a stack definida para a Trilha B da disciplina;
  - *function calling* nativo com esquema tipado e suporte a várias chamadas no mesmo turno;
  - camada gratuita suficiente para desenvolvimento, testes ao vivo e o piloto;
  - o modelo *flash-lite* tem latência baixa, adequada a um chat no celular, e a tarefa (classificar e
    consultar) não exige o modelo maior.
- **Descartados:**
  - **OpenAI GPT e Anthropic Claude via API:** sem camada gratuita equivalente para o volume de testes da
    equipe e fora da trilha proposta.
  - **Modelo local (Llama/Mistral via Ollama):** exigiria GPU ou um servidor dedicado para latência
    aceitável e um *function calling* menos confiável nos modelos pequenos.
  - **Chatbot por regras/árvore de decisão (Dialogflow, Rasa):** não entende relatos livres ("tem um fio
    soltando faísca na esquina") sem cadastrar cada variação de frase.

### 3.2 Function calling com ferramentas em TypeScript (em vez de deixar o modelo decidir tudo)

- **Como:** o LLM só **interpreta** o relato e **escolhe** a ferramenta; categoria, órgão, prioridade,
  SLA, raio de 200 m e filtro de dados pessoais são **código determinístico** testado.
- **Por quê:** regras de negócio (RN-01, RN-03, RN-04) não podem depender de o modelo "lembrar" do
  prompt; o código garante a regra e o LLM fornece a linguagem natural.
- **Descartados:**
  - **Só prompt, sem ferramentas:** o modelo poderia inventar órgãos, SLAs e protocolos (alucinação).
  - **RAG com banco vetorial:** a base de conhecimento é pequena e estável (guia do app em
    [`guiaApp.ts`](../../ai-agent/src/conhecimento/guiaApp.ts)); cabe no prompt sem a infraestrutura de
    *embeddings* e busca vetorial.
  - **Frameworks de agente (LangChain, LlamaIndex):** o loop tem poucas dezenas de linhas; um framework adicionaria
    abstrações e dependências que dificultam depurar e testar sem ganho para duas ou três ferramentas.

### 3.3 Interface `ModelClient` (inversão de dependência)

- **Por quê:** permite testes offline determinísticos e reduz a dependência de um único provedor
  (risco apontado no plano de sustentabilidade de [Negócios](../negocios-na-internet/README.md)):
  trocar de LLM é escrever outro adaptador.

### 3.4 Controle de cota e nova tentativa

- **Como:** limitador de requisições por minuto (`GEMINI_RPM`, padrão 15, janela deslizante de 60 s);
  até 5 tentativas em `429` e `5xx`, respeitando o tempo sugerido pela API; mensagem clara quando a
  cota **diária** acaba.
- **Por quê:** a camada gratuita tem limite por minuto e por dia; sem isso, rajadas de testes ou de
  usuários derrubariam o chat.

### 3.5 Servidor HTTP com `node:http`

- **Como:** [`server.ts`](../../ai-agent/src/server.ts) com uma rota `POST /chat`.
- **Por quê:** um único endpoint interno não justifica um framework; menos dependências, menos
  superfície de ataque.
- **Descartado:** **Express** no agente (já é usado no backend, mas aqui não acrescentaria nada).

### 3.6 tsx + node:test

- **Como:** `tsx` executa TypeScript direto (sem etapa de build) e o *test runner* nativo do Node roda as suítes
  com relatório JUnit para o CI.
- **Descartado:** **Jest** no agente: o projeto é ESM puro, e o `node:test` dispensa configuração de
  transformação.

---

## 4. Privacidade e uso responsável

- Nenhum dado pessoal de quem abriu o chamado (nome, e-mail) é enviado ao modelo, nem para o admin.
- `buscar_chamados_similares` faz projeção explícita (protocolo, distância, status) e a regra de LGPD
  também está no *system prompt* (defesa em camadas); validado no caso de teste CT-01.
- Assuntos fora do Fiscalize são recusados com educação; emergências são direcionadas a 190/192/193
  antes de qualquer triagem.
- O Google aparece como fornecedor na [Gestão de fornecedores](../seguranca-da-informacao/06_Gestao_de_Fornecedores.md).

## 5. Testes

| Suíte | Quando roda | O que garante |
|---|---|---|
| `tests/agente.test.ts`, `ferramentas.test.ts`, `acompanhamento.test.ts` (cliente roteirizado) | todo push e PR | loop do agente, regras das ferramentas, repasse do JWT, regra de acesso e servidor HTTP |
| `tests/live/*.test.ts` (Gemini real) | regressão diária | o modelo real continua escolhendo as ferramentas certas nos casos do docente |

Casos CT-01 a CT-03 e o caso extra de localização ausente estão em
[`ai-agent/README.md` › Casos de teste](../../ai-agent/README.md#casos-de-teste-para-o-docente).
