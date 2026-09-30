# Saída da IA: rodada 2

> Registro da segunda rodada de geração de casos de teste com IA. A saída abaixo está íntegra, sem correção.
>
> - **Modelo:** Claude Opus 5.5
> - **Data da geração:** 28/09/2026
> - **Insumos anexados:** histórias de usuário HU-01 a HU-09 na íntegra (critérios de aceite e tabelas CT-01 a CT-39), formato esperado, escopo e níveis de teste do plano.

## Prompt enviado

```
Atue como especialista em QA. Com base nos Requisitos Funcionais (RF-01 a RF-18), Regras de Negócio (RN-01 a RN-10) e Critérios de Aceite (1 a 12) do módulo Fiscalize fornecidos abaixo:

1. Gere primeiro a Matriz de Alocação de Níveis.
2. Gere a Tabela Intermediária de Derivação usando Técnicas de Modelagem (Partição de Equivalência, Valor Limite, Tabela de Decisão).
3. Gere a Matriz de Rastreabilidade com citação literal dos requisitos e sinalização de suposições.
4. Forneça os Casos de Teste cobrindo os níveis Componente, Integração e Sistema no formato: ID, HU/RF, CA, Título, Pré-condições, Passos, Resultado Esperado e Pós-condições. Escopo: Módulo de Triagem backend. Fora do escopo: Login, telas e serviços de terceiros.

REQUISITOS
[HU-01 a HU-09, com critérios de aceite e tabelas CT-01 a CT-39, coladas na íntegra]

ESCOPO DO PLANO
Dentro: registrar demandas; login e cadastro (válidos e inválidos); GPS (manual); consulta a categorias e órgãos ativos; formato e tratamento de erros da API; itens das HU-01 a HU-09.
Fora: login por conta GOV; todas as combinações de validação de campos; desempenho do hardware; entrega efetiva da push pelo FCM; bucket; geocodificação do Expo; câmera do emulador; ETL de métricas.

NÍVEIS DE TESTE
Dentro: Componente, Integração de componentes, Sistema.
Fora: Integração de sistemas, Aceite.
```

## Saída recebida

---

### Observações iniciais

Antes de gerar os artefatos, registro inconsistências e lacunas nos insumos:

1. **Identificação dos requisitos:** o prompt cita RF-01 a RF-18, RN-01 a RN-10 e CA 1 a 12, mas o material anexado está organizado como HU-01 a HU-09, com critérios de aceite (CA) por história e casos CT-01 a CT-39. Usei as HUs como fonte e numerei os critérios de aceite como CA-1, CA-2, CA-3 na ordem em que aparecem em cada história.
2. **Escopo conflitante:** o prompt diz "Fora do escopo: Login", mas o escopo do plano coloca login e cadastro dentro, e a HU-01 trata de login com refresh token. Assumi que "Login" fora do escopo refere-se ao **login por conta GOV**, que é o único item de login excluído no plano.
3. **"Módulo de Triagem backend":** nenhuma HU usa esse nome. Considerei como triagem o roteamento do chamado ao órgão (HU-04) e mantive as demais HUs, já que foram anexadas e estão no escopo do plano.
4. **Valores não definidos nos requisitos**, tratados como suposição e sinalizados na matriz de rastreabilidade:
   - HU-03: o "limite de tamanho definido" para fotos não tem valor.
   - HU-03 / CT-15: o tempo de expiração da URL assinada não é informado.
   - HU-04: a área de cobertura do município não tem limites definidos.
   - HU-04 / CT-17: a HU oferece duas alternativas ("localização pendente" ou fallback por categoria) sem escolher uma.
   - HU-06 / CT-28: não há lista de quais campos são "desnecessários" na resposta mobile.
   - HU-08 / CT-34 e CT-35: dependem de "decisão do time" e de uma versão mínima não definida.
5. **Itens do escopo sem HU:** cadastro, GPS desligado, órgãos inativos e tratamento de erros da API aparecem no escopo, mas não têm história. Gerei casos para eles e marquei como suposição.

---

### 1. Matriz de Alocação de Níveis

| Condição de teste | Nível responsável | Justificativa |
|---|---|---|
| Emissão de access token e refresh token no login | Integração | Envolve rota, service de autenticação e armazenamento da sessão. |
| Renovação, expiração e revogação do refresh token | Integração | O ciclo de vida do token só pode ser provado passando pela rota e pelo armazenamento. |
| Resposta 401 com código `token_expired` | Integração | É o middleware de autenticação que monta a resposta. |
| Logout com revogação no banco | Integração | Depende da persistência da revogação. |
| Validação do tipo de arquivo pela assinatura dos bytes | Componente | Lógica isolada, sem rede nem banco. |
| Limite de tamanho do upload (413) | Integração | Aplicado pelo parser HTTP antes do controller. |
| Upload em chamado inexistente e upload múltiplo | Integração | Depende do banco para localizar e associar o chamado. |
| Decisão de roteamento pela coordenada e "fora de área" | Componente | Regra de decisão pura sobre ponto e área. |
| Busca por proximidade | Integração | Depende da consulta geográfica no banco. |
| Push na mudança de status e tolerância a falha do provedor | Integração | Verifica que a rota do gestor conclui com o provedor substituído por duplo. |
| Paginação por cursor e cursor inválido | Integração | Depende da consulta ao banco e do middleware de erro. |
| Cache condicional (304) | Integração | Depende dos headers HTTP. |
| Idempotência por `client_uuid` | Integração | Depende da restrição de unicidade no banco. |
| Rotas versionadas | Integração | É o roteamento HTTP que responde. |
| CORS por Origin | Integração | Só é exercitado por requisição HTTP com headers reais. |
| Autorização por perfil (`requireRole`) | Componente | Função pura sobre o perfil do token. |
| Cadastro e validação de campos | Componente | Regras estáticas de formato e tamanho. |
| Categorias e órgãos ativos no encaminhamento | Integração | Depende dos dados persistidos. |
| Criação de chamado de ponta a ponta | Sistema | Fluxo principal que integra app, API e banco. |
| GPS desligado ou sem permissão | Sistema | Depende do hardware e das permissões reais do aparelho. |
| Push chegando em dois aparelhos | Sistema | Depende de aparelhos físicos; execução manual. |

---

### 2. Tabela Intermediária de Derivação

| Regra | Técnica | Condições derivadas | Casos |
|---|---|---|---|
| HU-01 CA-1: login válido devolve access token curto e refresh token longo | Tabela de decisão | e-mail existe × senha correta → 200 com tokens; senha errada → 401; e-mail inexistente → 401 | TC-01, TC-02 |
| HU-01 CA-2: refresh válido emite novo access token | Transição de estados | emitido → usado na validade → novo access token aceito | TC-03 |
| HU-01 CA-3: refresh revogado ou expirado → 401 | Partição de equivalência + Valor limite | válido; validade − 1 s; validade + 1 s; revogado | TC-04, TC-05 |
| CT-06: access expirado → 401 `token_expired` | Partição de equivalência | sem token; malformado; expirado; válido | TC-06 |
| HU-02 CA-1: logout revoga o token | Transição de estados | ativo → logout → revogado | TC-07, TC-08 |
| HU-02 CA-2 / CT-09: token revogado ou ausente → 401, sem 500 | Partição de equivalência | sem token; expirado; já revogado | TC-05, TC-09 |
| HU-03 CA-1: jpg/png válido armazenado e associado | Partição de equivalência | JPEG; PNG; várias imagens | TC-10, TC-14 |
| HU-03 CA-2: tipo não suportado → 422 | Partição de equivalência | .exe renomeado; texto; campo ausente | TC-11 |
| HU-03 CA-3: acima do limite → 413 | Valor limite | limite − 1 byte; limite; limite + 1 byte | TC-12 |
| CT-13 / CT-15: chamado inexistente; URL expirada | Partição de equivalência | chamado existe/não existe; URL válida/expirada | TC-13, TC-15 |
| HU-04 CA-1: localização considerada no roteamento | Tabela de decisão | coordenada presente/ausente × órgão da região | TC-16, TC-17 |
| HU-04 CA-2: fora da área → "fora de área" | Valor limite | dentro; na borda; 1 m fora; outra cidade; outro país | TC-18 |
| CT-19: proximidade respeita o raio | Valor limite | raio − 1 m; raio; raio + 1 m | TC-19 |
| HU-05 CA-1: push ao mudar o status | Tabela de decisão | 0, 1 ou 2 devices × provedor disponível/fora | TC-20, TC-21, TC-23, TC-24 |
| HU-05 CA-2: sem device token não falha | Partição de equivalência | com token; sem token | TC-22 |
| HU-06 CA-1: página + cursor | Valor limite | total < limit; = limit; limit + 1; última página | TC-25, TC-26 |
| HU-06 CA-2: cursor inválido → erro tratado | Partição de equivalência | válido; corrompido; editado; expirado | TC-27 |
| CT-28 / CT-29: payload enxuto e 304 | Partição de equivalência | com/sem relacionamentos; If-None-Match igual/diferente | TC-28, TC-29 |
| HU-07 CA-1 e CA-2: idempotência por client_uuid | Tabela de decisão | uuid novo; repetido; ausente | TC-30, TC-31, TC-32 |
| HU-08 CA-1 e CA-2: /api/v1 e rota legada | Partição de equivalência | com prefixo; sem prefixo; versão do app abaixo da mínima | TC-33, TC-34, TC-35 |
| HU-09 CA-1 e CA-2: CORS | Partição de equivalência | sem Origin; na whitelist; fora da whitelist | TC-36, TC-37, TC-38 |
| CT-39: requireRole → 403 | Tabela de decisão | perfil × rota | TC-39 |
| Escopo: cadastro válido e inválido *(sem HU)* | Partição de equivalência + Valor limite | campos ausentes; e-mail inválido; e-mail duplicado; senha abaixo/no/acima do mínimo | TC-40, TC-41 |
| Escopo: órgãos ativos *(sem HU)* | Partição de equivalência | categoria ativa/inativa; órgão ativo/inativo | TC-44 |
| Escopo: GPS *(sem HU)* | Partição de equivalência | permissão concedida; negada; GPS desligado | TC-45 |
| Escopo: erros da API *(sem HU)* | Partição de equivalência | banco no ar; banco fora do ar | TC-48 |

---

### 3. Matriz de Rastreabilidade

| Caso | HU | CA | Trecho citado | Suposição? |
|---|---|---|---|---|
| TC-01 | HU-01 | CA-1 | "recebo um access token de curta duração e um refresh token de longa duração" | N |
| TC-02 | HU-01 | CT-02 | "Status 401; nenhuma sessão criada" | N |
| TC-03 | HU-01 | CA-2 | "quando envio o refresh token para /auth/refresh, então recebo um novo access token válido" | N |
| TC-04 | HU-01 | CA-3 | "Dado que meu refresh token foi revogado ou expirou, quando tento renovar, então recebo erro 401" | N |
| TC-05 | HU-02 | CA-2 | "Dado um refresh token já revogado, quando é usado novamente, então a API retorna 401" | N |
| TC-06 | HU-01 | CT-06 | "Status 401 com código específico (token_expired)" | N |
| TC-07 | HU-02 | CA-1 | "meu refresh token é marcado como revogado no banco" | N |
| TC-08 | HU-02 | CT-08 | "Rejeitado assim que o access token expirar / refresh bloqueado" | N |
| TC-09 | HU-02 | CT-09 | "Status 401, sem erro 500" | N |
| TC-10 | HU-03 | CA-1 | "a imagem é armazenada no bucket e associada ao chamado" | N |
| TC-11 | HU-03 | CA-2 | "Dado um arquivo de tipo não suportado (ex: .exe), quando tento enviar, então recebo erro 422" | N |
| TC-12 | HU-03 | CA-3 | "Dado um arquivo acima do limite de tamanho, quando tento enviar, então recebo erro 413" — valor do limite não definido | S |
| TC-13 | HU-03 | CT-13 | "Enviar foto para demand_id inválido → Status 404" | N |
| TC-14 | HU-03 | CT-14 | "Todas associadas corretamente, sem sobrescrever" | N |
| TC-15 | HU-03 | CT-15 | "Acesso negado (403/expirado)" — tempo de expiração não definido | S |
| TC-16 | HU-04 | CA-1 | "o routingRuleService considera a localização para decidir o órgão responsável" | N |
| TC-17 | HU-04 | CT-17 | "marca como 'localização pendente' ou usa fallback por categoria" — alternativa não decidida | S |
| TC-18 | HU-04 | CA-2 | "o sistema sinaliza 'fora de área' em vez de rotear erroneamente" — área não definida | S |
| TC-19 | HU-04 | CT-19 | "Retorna apenas chamados dentro do raio informado" | N |
| TC-20 | HU-05 | CT-20 | "Token salvo vinculado ao usuário" | N |
| TC-21 | HU-05 | CA-1 | "quando um gestor altera o status do meu chamado, então recebo uma push notification com o novo status" | N |
| TC-22 | HU-05 | CA-2 | "o sistema não falha, apenas não envia push" | N |
| TC-23 | HU-05 | CT-23 | "Requisição principal (mudança de status) não falha; falha de push é apenas logada/enfileirada para retry" | N |
| TC-24 | HU-05 | CT-24 | "Ambos recebem a notificação" | N |
| TC-25 | HU-06 | CA-1 | "recebo apenas a primeira página e um cursor/token para a próxima" | N |
| TC-26 | HU-06 | CT-26 | "Retorna os próximos itens sem duplicar/pular registros" | N |
| TC-27 | HU-06 | CA-2 | "recebo erro tratado (não 500)" | N |
| TC-28 | HU-06 | CT-28 | "Resposta mobile não inclui campos desnecessários" — campos não listados | S |
| TC-29 | HU-06 | CT-29 | "Retorna 304 quando não houve mudança" | N |
| TC-30 | HU-07 | CA-2 | "Dado um client_uuid novo, quando crio outro chamado, então é tratado como registro independente" | N |
| TC-31 | HU-07 | CA-1 | "apenas um chamado é criado" | N |
| TC-32 | HU-07 | CT-32 | "Retorna apenas registros alterados após o timestamp informado" | N |
| TC-33 | HU-08 | CA-1 | "Dado um cliente chamando /api/v1/demands, quando a rota existe, então responde normalmente" | N |
| TC-34 | HU-08 | CT-34 | "conforme decisão do time" — decisão não informada | S |
| TC-35 | HU-08 | CT-35 | "quando aplicável" — versão mínima não definida | S |
| TC-36 | HU-09 | CA-1 | "Dado uma chamada vinda do app mobile (sem header Origin de navegador), quando processada, então não é bloqueada" | N |
| TC-37 | HU-09 | CT-37 | "Requisição com Origin da whitelist → Processada normalmente" | N |
| TC-38 | HU-09 | CA-2 | "Dado uma chamada vinda de um domínio web não autorizado, quando processada, então é bloqueada" | N |
| TC-39 | HU-09 | CT-39 | "Bloqueado por requireRole, retorna 403" | N |
| TC-40 | — | — | Sem trecho: cadastro está no escopo, mas não tem HU | S |
| TC-41 | — | — | Sem trecho: regras de formato e tamanho mínimo não definidas | S |
| TC-44 | — | — | Sem trecho: órgãos inativos aparecem só no escopo | S |
| TC-45 | — | — | Sem trecho: comportamento com GPS desligado não definido | S |
| TC-48 | — | — | Sem trecho: resposta com banco indisponível não definida | S |

---

### 4. Casos de Teste

| ID | HU/RF | CA | Título | Pré-condições | Passos | Resultado esperado | Pós-condições |
|---|---|---|---|---|---|---|---|
| TC-01 | HU-01 | CA-1 | Login válido | Usuário ativo cadastrado | 1. `POST /auth/login` com e-mail e senha corretos | 200; access token de curta duração e refresh token de longa duração no corpo | Sessão criada |
| TC-02 | HU-01 | CT-02 | Login inválido | Usuário cadastrado | 1. Login com senha errada 2. Login com e-mail inexistente | 401 nos dois casos, mesma mensagem; nenhuma sessão criada | — |
| TC-03 | HU-01 | CA-2 | Refresh válido | Sessão com refresh válido; access expirado | 1. `POST /auth/refresh` 2. Chamar rota protegida com o novo access | 200 no refresh; rota protegida responde 200 | — |
| TC-04 | HU-01 | CA-3 | Refresh expirado | Refresh token expirado | 1. `POST /auth/refresh` | 401 com mensagem de novo login | — |
| TC-05 | HU-02 | CA-2 | Refresh após logout | Sessão ativa | 1. Logout 2. `POST /auth/refresh` com o refresh antigo | 401 (revogado) | — |
| TC-06 | HU-01 | CT-06 | Access expirado | Access token expirado | 1. Chamar rota protegida | 401 com `code: "token_expired"` | — |
| TC-07 | HU-02 | CA-1 | Logout | Usuário autenticado | 1. `POST /auth/logout` 2. Consultar a tabela de sessões | 200; token marcado como revogado | Sessão encerrada |
| TC-08 | HU-02 | CT-08 | Uso pós-logout | Sessão ativa | 1. Logout 2. Chamar rota protegida com o access antigo | Rejeitado; refresh bloqueado | — |
| TC-09 | HU-02 | CT-09 | Logout sem token válido | — | 1. `POST /auth/logout` sem token 2. Com token expirado | 401, sem 500 | — |
| TC-10 | HU-03 | CA-1 | Upload válido | Chamado existente do cidadão | 1. Enviar JPEG de 2 MB | 201; URL retornada e persistida | Foto associada |
| TC-11 | HU-03 | CA-2 | Tipo inválido | Chamado existente | 1. Enviar `.exe` renomeado como `.jpg` | 422 com mensagem clara | Nada gravado |
| TC-12 | HU-03 | CA-3 | Acima do limite | Chamado existente | 1. Enviar arquivo no limite 2. Enviar limite + 1 byte 3. Enviar 50 MB | 1 aceito; 2 e 3 → 413 | Nada gravado no bucket para 2 e 3 |
| TC-13 | HU-03 | CT-13 | Chamado inexistente | Cidadão logado | 1. Enviar foto para id inexistente | 404 | — |
| TC-14 | HU-03 | CT-14 | Upload múltiplo | Chamado existente | 1. Enviar 3 imagens em sequência | 3 imagens associadas, sem sobrescrever | 3 fotos no chamado |
| TC-15 | HU-03 | CT-15 | URL assinada expira | Foto armazenada | 1. Gerar URL 2. Aguardar a expiração 3. Acessar | 403/expirado | — |
| TC-16 | HU-04 | CA-1 | Coordenadas válidas | Seed com área e órgão da região | 1. Criar chamado com lat/lng dentro da área | Roteado ao órgão da região | Chamado na fila do órgão |
| TC-17 | HU-04 | CT-17 | Sem coordenadas | Cidadão logado | 1. Criar chamado sem lat/lng | Aceito; "localização pendente" ou fallback por categoria | — |
| TC-18 | HU-04 | CA-2 | Fora da área | Seed com ponto fora da área | 1. Criar chamado com lat/lng de outra cidade | Aviso "fora de área"; sem roteamento | — |
| TC-19 | HU-04 | CT-19 | Proximidade | Chamados a distâncias conhecidas | 1. `GET /demands/nearby?lat=&lng=&radius=1000` | Só chamados dentro do raio | — |
| TC-20 | HU-05 | CT-20 | Registro de device token | Usuário logado | 1. Enviar token FCM | Token salvo vinculado ao usuário | — |
| TC-21 | HU-05 | CA-1 | Push disparada | Device token registrado; provedor mockado | 1. Gestor muda status para "em andamento" | Push enviada ao dono com o novo status | — |
| TC-22 | HU-05 | CA-2 | Sem device token | Cidadão sem token | 1. Gestor muda status | 200; log indica push pulada | — |
| TC-23 | HU-05 | CT-23 | Provedor fora do ar | Provedor mockado com erro | 1. Gestor muda status | 200; falha logada/enfileirada | Status gravado |
| TC-24 | HU-05 | CT-24 | Múltiplos dispositivos | Usuário em 2 aparelhos | 1. Gestor muda status | Os dois recebem | — |
| TC-25 | HU-06 | CA-1 | Primeira página | Mais de 20 chamados | 1. `GET /demands?limit=20` | 20 itens + cursor | — |
| TC-26 | HU-06 | CT-26 | Página seguinte | Cursor da TC-25 | 1. `GET /demands?cursor=<token>` | Próximos itens, sem duplicar/pular | — |
| TC-27 | HU-06 | CA-2 | Cursor inválido | — | 1. Enviar cursor corrompido | 400 sem stack trace | — |
| TC-28 | HU-06 | CT-28 | Payload enxuto | Chamado com relacionamentos | 1. Comparar resposta mobile e admin | Mobile sem relacionamentos completos | — |
| TC-29 | HU-06 | CT-29 | Cache condicional | ETag obtido | 1. `GET /categories` com `If-None-Match` | 304 | — |
| TC-30 | HU-07 | CA-2 | Criação única | Cidadão logado | 1. Criar chamado com client_uuid X | Chamado criado | 1 registro |
| TC-31 | HU-07 | CA-1 | Reenvio idempotente | TC-30 executado | 1. Reenviar o payload com X | Retorna o existente; sem duplicata | 1 registro |
| TC-32 | HU-07 | CT-32 | Sincronização incremental | Alterações antes e depois de T | 1. `GET /demands/changes?since=T` | Só os alterados após T | — |
| TC-33 | HU-08 | CA-1 | Acesso à v1 | — | 1. `GET /api/v1/demands` | 200 com o contrato atual | — |
| TC-34 | HU-08 | CT-34 | Rota legada | — | 1. `GET /demands` | Redireciona ou erro claro | — |
| TC-35 | HU-08 | CT-35 | Versão mínima | App desatualizado | 1. Chamar endpoint de verificação | "Atualização obrigatória" | — |
| TC-36 | HU-09 | CA-1 | Sem Origin | — | 1. Requisição sem header Origin | Processada | — |
| TC-37 | HU-09 | CT-37 | Origin autorizado | Whitelist configurada | 1. Requisição com Origin da whitelist | Processada | — |
| TC-38 | HU-09 | CA-2 | Origin não autorizado | Whitelist configurada | 1. Requisição com Origin fora da whitelist | Bloqueada pelo CORS | — |
| TC-39 | HU-09 | CT-39 | Perfil errado | Token de gestor | 1. Chamar rota exclusiva do cidadão | 403 | — |
| TC-40 | — | — | Cadastro válido e duplicado | — | 1. Cadastrar 2. Repetir o e-mail | 201; depois 409 | Usuário gravado |
| TC-41 | — | — | Validação do cadastro | — | 1. Campo ausente 2. E-mail inválido 3. Senha abaixo, no e acima do mínimo | 400 nos inválidos | Nada gravado |
| TC-44 | — | — | Órgãos inativos | Seed com órgão inativo | 1. Criar chamado em categoria do órgão inativo | Nunca encaminha para órgão inativo | — |
| TC-45 | — | — | GPS desligado | Aparelho com GPS desligado | 1. Abrir nova demanda 2. Capturar localização | App avisa e oferece alternativa | — |
| TC-48 | — | — | Banco indisponível | Banco fora do ar | 1. Chamar uma rota | 503 com mensagem padrão | Banco restaurado |

**Total:** 44 casos (39 derivados das HUs e 5 do escopo sem HU, marcados como suposição).
