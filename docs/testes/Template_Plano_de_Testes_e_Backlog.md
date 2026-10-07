# Plano de Testes e Backlog de Automação

*Do escopo ao backlog priorizado, em seis decisões encadeadas.*

| Campo | Conteúdo |
| :---- | :---- |
| Equipe / Squad | `Equipe 6` |
| Produto / SUT | `Fiscalize` |
| Integrantes | `Arthur Borba Lins, Bruno Dornelas, Bruno Felipe Castilho, Felipe Cisneiros, Michelangelo Morais do Rego, Paulo Henrique Alves Pereira, Ramom de Oliveira Aguiar, Thyalles Araujo Campos, Victor Simas Azevedo de Almeida` |
| Data | `23/09/2026` |

---

## 1\. Escopo

*O que a atividade de teste se compromete a verificar, e o que ela declaradamente não verifica.*

Entra no escopo: os fluxos principais do produto ponta a ponta, as regras que protegem esses fluxos e o contrato que os sustenta, incluindo o comportamento do produto na fronteira quando uma dependência externa falha.

Fica fora do escopo: o comportamento de sistemas externos fora do controle da squad, os recursos físicos do dispositivo e o que custa mais do que devolve no prazo do projeto.

| Item | Dentro do escopo? | Motivo |
| :---- | :---- | :---- |
| `Registrar demandas` | `Sim` | `Fluxo principal` |
| `Login e cadastro de usuários.` | `Sim` | `Assegura o acesso e a participação do usuário no sistema.` |
| `Login por conta GOV.` | `Não` | `Por causa do CAPTCHA (Não sou um robô).` |
| `Login e cadastro de usuários inválidos.` | `Sim` | `Verificar de forma correta do “porque” está invalidando.` |
| `Todas as combinações de validação de campos.` | `Não` | `Essas regras podem ser verificadas separadamente por testes unitários.` |
| `Desempenho do hardware.` | `Não` | `Não desenvolve valor proporcional no escopo do projeto.` |
| `Testes de uso do GPS.` | `Sim` | `Será feito testes manuais, pela possível complexidade do teste.` |
| `Consulta às categorias e órgãos ativos.` | `Sim` | `Assegura que o módulo nunca recomende o encaminhamento para órgãos inativos.` |
| `Formato e tratamentos de erros da API` | `Sim` | `Contrato que sustenta a API e garante integração com o sistema principal.` |
| `Sessão com access token e refresh token (HU-01)` | `Sim` | `Regra que protege todos os fluxos autenticados; sem ela o app desloga o cidadão a todo momento.` |
| `Logout com revogação do token (HU-02)` | `Sim` | `Protege a sessão do cidadão em caso de aparelho perdido ou roubado.` |
| `Anexo de fotos ao chamado: tipo, tamanho e chamado inexistente (HU-03)` | `Sim` | `Evidência visual do problema; a validação do arquivo protege o servidor.` |
| `Disponibilidade e desempenho do bucket de armazenamento` | `Não` | `Serviço de terceiro fora do controle da squad; verificamos só a reação do backend quando o upload falha.` |
| `Roteamento do chamado pela localização e sinalização “fora de área” (HU-04)` | `Sim` | `Regra de negócio que decide qual órgão recebe o chamado.` |
| `Geocodificação reversa do Expo Location (endereço preenchido pelo GPS)` | `Não` | `Serviço de terceiro, não determinístico e fora do controle da squad.` |
| `Disparo de push na mudança de status e tolerância à falha do provedor (HU-05)` | `Sim` | `Contrato na fronteira: a mudança de status não pode falhar por causa do push.` |
| `Entrega efetiva da notificação pelo FCM no aparelho` | `Não` | `Comportamento do provedor e do sistema operacional, fora do controle da squad.` |
| `Listagem paginada, cursor e payload enxuto (HU-06)` | `Sim` | `Fluxo principal de acompanhamento; payload grande trava o app em rede móvel.` |
| `Criação idempotente com client_uuid e sincronização (HU-07)` | `Sim` | `Evita chamados duplicados em áreas com sinal instável.` |
| `Rotas versionadas /api/v1 (HU-08)` | `Sim` | `Contrato que mantém funcionando as versões antigas do app já publicadas.` |
| `CORS para app nativo e whitelist do painel (HU-09)` | `Sim` | `Se o CORS bloquear o app nativo, nenhum fluxo funciona.` |
| `Perfis, permissões e isolamento entre cidadãos` | `Sim` | `Regra que protege os fluxos: um cidadão não pode ver nem alterar o chamado de outro.` |
| `Atendimento pelo gestor (fila do órgão e mudança de status)` | `Sim` | `Fluxo principal do lado do órgão público; fecha o ciclo de vida do chamado.` |
| `Qualidade da foto da câmera no emulador Android` | `Não` | `Limitação conhecida da câmera virtual do emulador (foto sai preta), fora do controle da squad.` |
| `ETL de métricas e painel administrativo` | `Não` | `Não faz parte dos fluxos principais do cidadão; custa mais do que devolve no prazo do projeto.` |

Verificação

- [x] Todo fluxo principal do produto aparece como `Sim`.
- [x] Toda linha `Não` tem motivo.

---

## 2\. Níveis de teste

*Em que altura do sistema cada condição é verificada, e quanto essa escolha custa.*

> Atividade: declarar no plano os níveis em que ele atua, com uma frase de justificativa por nível incluído e por nível excluído.

| Nível | O que responde | Dentro do plano? | Justificativa |
| :---- | :---- | :---- | :---- |
| Componente | A unidade isolada faz o que promete? | `Sim` | `As regras de negócio (autorização por perfil, edição/remoção por status, validação de foto e de cadastro) ficam em services e middlewares e rodam em ~2 s com Jest e o Prisma mockado.` |
| Integração de componentes | As partes conversam entre si corretamente? | `Sim` | `Jest + Supertest percorrem rota, middlewares, controller e service, verificando códigos HTTP e formato de erro sem depender de banco real.` |
| Sistema | O sistema inteiro entrega o comportamento esperado? | `Sim` | `As jornadas do cidadão e do gestor rodam contra backend e PostgreSQL reais (Playwright) e as telas no emulador (Maestro), cobrindo o que só aparece com tudo integrado.` |
| Integração de sistemas | O produto conversa bem com sistemas de terceiros? | `Não` | `Login GOV, FCM, bucket e geocodificação estão fora do escopo; o provedor é substituído por duplo e só verificamos a reação do produto quando ele falha.` |
| Aceite | O usuário real aceita o que foi entregue? | `Não` | `A squad não tem acesso a cidadãos e gestores reais de órgãos públicos no prazo do projeto.` |

---

## 3\. Riscos da atividade de teste

*O que pode dar errado na própria verificação, e enganar quem lê o resultado.*

> Atividade: montar a matriz de risco da atividade de teste.

*Na verificação manual: roteiro que deixa de ser executado quando o prazo aperta, execução inconsistente entre pessoas sem passo a passo definido, resultado registrado sem evidência que permita reconferir, caso aprovado por quem escreveu o código que ele verifica, repetição sem atenção.*

*Na verificação automatizada: teste instável, oráculo copiado do próprio SUT, duplo de teste que não representa o produto implantado, massa compartilhada entre casos, conjunto de casos verde que nunca soube ficar vermelho.*

*Uma forma mitiga o risco da outra. A exceção é quando o risco é interno a uma das formas: aí a mitigação vem de dentro dela.*

| Risco | Impacto | Prob. | Mitigação |
| :---- | :---- | :---- | :---- |
| `Execução manual sem evidência reconferível (GPS, câmera e push no device físico)` | `Médio` | `Alta` | `Passo a passo e resultado esperado no caso; print ou gravação de tela anexada à execução.` |
| `Teste automatizado instável (E2E Playwright e Maestro)` | `Alto` | `Média` | `Espera por condição (/health respondendo, extendedWaitUntil), nunca por tempo fixo; massa isolada por execução.` |
| `Massa de dados compartilhada gerando acoplamento entre testes` | `Alto` | `Média` | `Isolamento de dados por caso de teste e uso de transações limpas a cada execução automatizada (cada E2E cria cidadãos novos *@teste.fiscalize).` |
| `Roteiro manual ignorado` | `Alto` | `Alta` | `Automação regressiva para libertar tempo da equipe.` |
| `Conjunto de testes “verde” que nunca soube ficar vermelho` | `Alto` | `Média` | `Garantir a falha inicial antes da correção (TDD) ou aplicar testes de mutação para validar se a automação detecta alterações introduzidas no código.` |
| `Falta de cobertura dos cenários de exceção e limites (HTTP 400/401/413/422/503)` | `Alto` | `Baixa` | `Mapeamento direto de cada Critério de Aceite (CA) das HUs na matriz de rastreabilidade.` |
| `Duplo de teste que não representa o produto implantado` | `Alto` | `Média` | `Realização de testes de integração contra serviços/bancos reais e testes de contrato para validar interfaces (Prisma mockado nos níveis baixos, compensado pelo E2E com PostgreSQL real; FCM e bucket mockados com o formato real de erro do provedor).` |
| `Oráculo copiado do próprio SUT (resultado esperado tirado da resposta atual da API)` | `Alto` | `Média` | `Resultado esperado escrito a partir do CA da HU antes da execução; revisão cruzada do caso por outro integrante.` |
| `Caso aprovado por quem escreveu o código que ele verifica` | `Médio` | `Alta` | `Pull request com revisão obrigatória de outro integrante; quem implementa a funcionalidade não é o responsável pelo caso no backlog.` |
| `Repetição sem atenção nos roteiros manuais` | `Médio` | `Média` | `Rodízio de executores entre ciclos e checklist com resultado esperado a cada passo.` |
| `Teste escrito para funcionalidade que ainda não existe ficar “pulado” e esquecido` | `Médio` | `Média` | `Status “Bloqueado” no backlog com a dependência explícita; o caso volta para “A fazer” no mesmo PR que entrega a funcionalidade.` |

Verificação

- [x] Cada risco tem mitigação concreta.

---

## 4\. Casos de teste

*Derivados dos requisitos.*

### 4.1 Primeira rodada com IA

> Atividade: gerar casos de teste com IA, usando o prompt que a squad usaria hoje. Não corrigir a saída. Guardar o prompt e o resultado.

Prompt usado

```
Atue como QA. Escreva casos de teste para o sistema Fiscalize (registro de demandas de cidadãos usando GPS e consulta a API de órgãos). Faça os cenários de login, cadastro e registro de denúncia.
```

Saída recebida

Grave a saída íntegra, sem correção, em um arquivo próprio versionado no repositório e referencie aqui.

Arquivo: [`docs/testes/ia/saida-rodada-1.md`](ia/saida-rodada-1.md)

Três perguntas sobre a saída

| Pergunta | Resposta | O que se observou na saída |
| :---- | :---- | :---- |
| A LLM identificou lacunas? | `Sim` | `Apontou que os requisitos não definiam o tamanho máximo para anexos nas demandas nem o que aconteceria caso o GPS estivesse desligado no dispositivo.` |
| Distribuiu os casos entre níveis? | `Não` | `Gerou a grande maioria como testes de sistema (E2E), ignorando testes de integração de API e de componentes do frontend.` |
| Indicou as técnicas de modelagem? | `Não` | `Apenas listou os caminhos felizes e tristes sem justificar se utilizou partição de equivalência ou análise do valor limite.` |

### 4.2 Segunda rodada

> Atividade: refazer o prompt com os quatro insumos e os três pedidos, comparar as duas saídas e registrar o que mudou.

Insumos fornecidos no prompt

- [x] Requisitos: as histórias de usuário e os critérios de aceite, na íntegra
- [x] Formato esperado: os campos exatos dos casos de testes: id, HU, CA, título, pré-condições, passos, resultados esperados, pós-condições
- [x] Escopo: o que está dentro e o que está fora
- [x] Níveis de teste: quais níveis o plano cobre

Prompt revisado

```
Atue como especialista em QA. Com base nos Requisitos Funcionais (RF-01 a RF-18), Regras de Negócio (RN-01 a RN-10) e Critérios de Aceite (1 a 12) do módulo Fiscalize fornecidos abaixo:

1. Gere primeiro a Matriz de Alocação de Níveis.
2. Gere a Tabela Intermediária de Derivação usando Técnicas de Modelagem (Partição de Equivalência, Valor Limite, Tabela de Decisão).
3. Gere a Matriz de Rastreabilidade com citação literal dos requisitos e sinalização de suposições.
4. Forneça os Casos de Teste cobrindo os níveis Componente, Integração e Sistema no formato: ID, HU/RF, CA, Título, Pré-condições, Passos, Resultado Esperado e Pós-condições. Escopo: Módulo de Triagem backend. Fora do escopo: Login, telas e serviços de terceiros.
```

O que mudou entre as duas saídas

`A segunda rodada distribuiu adequadamente os testes entre Componente, Integração e Sistema, reduzindo o custo de execução. Além disso, evitou alucinações marcando suposições explicitamente e garantiu cobertura total das regras de negócio (como gatilhos de prioridade crítica e erros HTTP).`

### 4.3 Matriz de alocação

*Pedida antes da geração dos casos.*

| Condição de teste | Nível responsável | Justificativa |
| :---- | :---- | :---- |
| `Validação de formato de e-mail, limites de caracteres e regras de senha no cadastro` | `Componente` | `Regras de validação estáticas e isoladas que possuem execução rápida, sem a necessidade de instanciar banco de dados ou rede.` |
| `Tratamento das respostas de erro e exceções da API (HTTP 400, 401, 429, 503)` | `Integração` | `Valida a resiliência do contrato entre as partes do sistema, garantindo que o backend lide bem com falhas antes de acionar a interface.` |
| `Filtragem e exclusão de órgãos inativos durante a consulta` | `Integração` | `Verifica se o módulo de triagem está interpretando corretamente os dados do banco/serviço e se a comunicação entre eles está funcional.` |
| `Fluxo completo de registro de demanda com anexo (respeitando o limite de tamanho) e GPS` | `Sistema` | `Valida o fluxo principal de ponta a ponta que entrega valor ao cidadão, integrando interface gráfica (frontend), backend e persistência.` |
| `Comportamento do aplicativo quando o GPS está desligado ou sem permissão concedida` | `Sistema` | `Depende da interação real com as permissões e o hardware do dispositivo móvel na fronteira do sistema.` |
| `Impedimento de login com credenciais inválidas ou não cadastradas` | `Integração` | `Requer a validação dos dados de entrada em conjunto com a verificação de registros no banco de dados para garantir o bloqueio.` |
| `Emissão, renovação, expiração e revogação de access/refresh token (HU-01, HU-02)` | `Integração` | `O ciclo do token atravessa rota, middleware de autenticação e armazenamento da sessão; isolado não prova a revogação.` |
| `Validação do arquivo de foto pela assinatura dos bytes, não pela extensão (HU-03)` | `Componente` | `Lógica pura sobre os primeiros bytes do arquivo; roda em milissegundos sem rede.` |
| `Limite de tamanho do upload (413) e chamado inexistente (404) (HU-03)` | `Integração` | `O limite é aplicado pelo parser do Express antes do controller; só aparece passando pela rota.` |
| `Decisão de roteamento por coordenada e “fora de área” (HU-04)` | `Componente` | `Regra de decisão do routingRuleService sobre ponto e área; a tabela de decisão inteira roda sem banco.` |
| `Push na mudança de status, usuário sem device token e FCM fora do ar (HU-05)` | `Integração` | `Verifica que a rota do gestor conclui mesmo com o duplo do FCM falhando; o provedor real fica fora do plano.` |
| `Paginação por cursor, cursor inválido e erro sem stack trace (HU-06)` | `Integração` | `Depende da consulta ao banco e do errorMiddleware formatando a resposta.` |
| `Reenvio com o mesmo client_uuid não duplica o chamado (HU-07)` | `Integração` | `A idempotência depende da restrição de unicidade no banco junto com o controller.` |
| `Rotas sob /api/v1 e tratamento de rota legada (HU-08)` | `Integração` | `É o roteamento do Express que responde; não há regra isolada para testar.` |
| `CORS: sem Origin, Origin na whitelist e Origin não autorizada (HU-09)` | `Integração` | `O middleware de CORS só é exercitado por requisição HTTP com os headers reais.` |
| `Autorização hierárquica por perfil com requireRole (HU-09)` | `Componente` | `Função pura sobre o perfil do token; a matriz completa roda em milissegundos.` |
| `Edição e remoção só pelo dono e só com status Aberto` | `Componente` | `Regra concentrada no demandService; a tabela de decisão perfil × dono × status roda sem HTTP.` |
| `Isolamento entre dois cidadãos (ver, editar, anexar foto, remover)` | `Sistema` | `Só com dois usuários reais e banco real se garante que o chamado do dono fica intacto.` |
| `Múltiplos dispositivos recebendo a push de fato` | `Sistema` | `Depende de dois aparelhos físicos e do FCM real; verificação manual antes do release.` |

### 4.4 Tabela intermediária de derivação

*Uma linha por regra do requisito.*

| Regra | Técnica aplicável | Condições derivadas | Casos resultantes |
| :---- | :---- | :---- | :---- |
| `HU-01 CA-1: login válido devolve access token curto e refresh token longo` | `Tabela de decisão` | `e-mail existe × senha correta × usuário ativo → 200 com os dois tokens; senha errada → 401; e-mail inexistente → 401 com a mesma mensagem` | `TC-01, TC-02` |
| `HU-01 CA-2: refresh válido emite novo access token` | `Transição de estados` | `refresh emitido → usado dentro da validade → novo access token aceito na rota protegida` | `TC-03` |
| `HU-01 CA-3: refresh revogado ou expirado retorna 401` | `Partição de equivalência + Valor limite` | `refresh válido; expirado (validade − 1 s aceito, validade + 1 s recusado); revogado por logout` | `TC-04, TC-05` |
| `CT-06: access expirado retorna 401 com código token_expired` | `Partição de equivalência` | `sem token; malformado; expirado; revogado; válido` | `TC-06` |
| `HU-02 CA-1: logout marca o token como revogado` | `Transição de estados` | `sessão ativa → logout → token revogado; outra sessão do mesmo usuário continua ativa` | `TC-07, TC-08` |
| `HU-02 CA-2 / CT-09: token revogado ou ausente no logout retorna 401, nunca 500` | `Partição de equivalência` | `sem token; token expirado; token já revogado` | `TC-05, TC-09` |
| `HU-03 CA-1: imagem jpg/png válida é armazenada e associada ao chamado` | `Partição de equivalência` | `JPEG; PNG; base64 com prefixo data:image; várias imagens em sequência` | `TC-10, TC-14` |
| `HU-03 CA-2: tipo não suportado retorna 422` | `Partição de equivalência` | `.exe renomeado para .jpg; texto em base64; campo photo ausente` | `TC-11` |
| `HU-03 CA-3: arquivo acima do limite retorna 413` | `Análise do valor limite` | `limite − 1 byte (aceita); exatamente no limite (aceita); limite + 1 byte (413, nada gravado)` | `TC-12` |
| `CT-13 / CT-15: chamado inexistente e URL assinada expirada` | `Partição de equivalência` | `chamado existente; inexistente; URL dentro da validade; URL após a expiração` | `TC-13, TC-15` |
| `HU-04 CA-1: a localização é considerada no roteamento` | `Tabela de decisão` | `coordenada presente dentro da área × categoria com órgão ativo; coordenada ausente (fallback por categoria)` | `TC-16, TC-17` |
| `HU-04 CA-2: coordenada fora da área é sinalizada “fora de área”` | `Análise do valor limite` | `ponto dentro da área; ponto na borda; ponto a 1 m fora; outra cidade; outro país` | `TC-18` |
| `CT-19: busca por proximidade respeita o raio` | `Análise do valor limite` | `chamado a raio − 1 m (retorna); exatamente no raio; raio + 1 m (não retorna)` | `TC-19` |
| `HU-05 CA-1: push enviada ao mudar o status` | `Tabela de decisão` | `device token registrado (0, 1 ou 2 aparelhos) × provedor disponível ou fora do ar` | `TC-20, TC-21, TC-23, TC-24` |
| `HU-05 CA-2: usuário sem device token não faz a API falhar` | `Partição de equivalência` | `com token; sem token registrado` | `TC-22` |
| `HU-06 CA-1: primeira página devolve só o tamanho da página e um cursor` | `Análise do valor limite` | `total < limit; total = limit; total = limit + 1; última página` | `TC-25, TC-26` |
| `HU-06 CA-2: cursor inválido gera erro tratado, não 500` | `Partição de equivalência` | `cursor válido; corrompido; editado à mão; expirado` | `TC-27` |
| `CT-28 / CT-29: payload enxuto e cache condicional` | `Partição de equivalência` | `resposta com e sem relacionamentos; If-None-Match igual (304) e diferente (200)` | `TC-28, TC-29` |
| `HU-07 CA-1 e CA-2: mesmo client_uuid não duplica; client_uuid novo cria outro registro` | `Tabela de decisão` | `client_uuid novo; client_uuid repetido com mesmo payload; sem client_uuid` | `TC-30, TC-31, TC-32` |
| `HU-08 CA-1 e CA-2: /api/v1 funciona e rota legada tem tratamento claro` | `Partição de equivalência` | `/api/v1/demands; /demands sem prefixo; versão do app abaixo da mínima` | `TC-33, TC-34, TC-35` |
| `HU-09 CA-1 e CA-2: app nativo aceito e domínio não autorizado bloqueado` | `Partição de equivalência` | `sem Origin; Origin na whitelist; Origin fora da whitelist` | `TC-36, TC-37, TC-38` |
| `CT-39: perfil errado recebe 403 pelo requireRole` | `Tabela de decisão` | `perfil (Admin, Gestor, Cidadão, anônimo) × rota (Admin, Gestor, Cidadão)` | `TC-39` |
| `Cadastro: campos obrigatórios, e-mail válido e único, senha ≥ 6, perfil sempre Cidadão` | `Partição de equivalência + Valor limite` | `senha com 5, 6 e 7 caracteres; e-mail sem @; e-mail duplicado; perfil/role/isAdmin = Admin` | `TC-40, TC-41` |
| `Editar e remover só enquanto o chamado não está em andamento` | `Tabela de decisão` | `perfil (Cidadão/Gestor) × dono (sim/não) × status (Aberto, Em Andamento, Resolvido, Fechado)` | `TC-42, TC-43` |
| `Encaminhamento só para categoria e órgão ativos` | `Partição de equivalência` | `categoria ativa; inativa; inexistente; órgão ativo; órgão inativo` | `TC-44` |
| `Captura de localização pelo GPS no aparelho` | `Partição de equivalência` | `permissão concedida; negada; GPS desligado; sem sinal` | `TC-45, TC-46` |
| `Gestor altera o status só de chamados do seu órgão` | `Partição de equivalência` | `status válido; inexistente (“Finalizado”); chamado inexistente; chamado de outro órgão` | `TC-47` |
| `Banco indisponível retorna 503` | `Partição de equivalência` | `banco no ar; banco fora do ar` | `TC-48` |

### 4.5 Matriz de rastreabilidade de evidências

*Onde não houver trecho do requisito, a linha é marcada como suposição em vez de virar regra.*

| Caso | HU | CA | Trecho citado | Suposição? (S/N) |
| :---- | :---- | :---- | :---- | :---- |
| `TC-01` | `HU-01` | `CA-1` | `"recebo um access token de curta duração e um refresh token de longa duração"` | `N` |
| `TC-02` | `HU-01` | `CT-02` | `"Status 401; nenhuma sessão criada"` | `N` |
| `TC-03` | `HU-01` | `CA-2` | `"quando envio o refresh token para /auth/refresh, então recebo um novo access token válido"` | `N` |
| `TC-04` | `HU-01` | `CA-3` | `"Dado que meu refresh token foi revogado ou expirou, quando tento renovar, então recebo erro 401"` | `N` |
| `TC-05` | `HU-02` | `CA-2` | `"Dado um refresh token já revogado, quando é usado novamente, então a API retorna 401"` | `N` |
| `TC-06` | `HU-01` | `CT-06` | `"Status 401 com código específico (token_expired)"` | `N` |
| `TC-07` | `HU-02` | `CA-1` | `"meu refresh token é marcado como revogado no banco"` | `N` |
| `TC-08` | `HU-02` | `CT-08` | `"Rejeitado assim que o access token expirar / refresh bloqueado"` | `N` |
| `TC-09` | `HU-02` | `CT-09` | `"Status 401, sem erro 500"` | `N` |
| `TC-10` | `HU-03` | `CA-1` | `"a imagem é armazenada no bucket e associada ao chamado"` | `N` |
| `TC-11` | `HU-03` | `CA-2` | `"Dado um arquivo de tipo não suportado (ex: .exe), quando tento enviar, então recebo erro 422"` | `N` |
| `TC-12` | `HU-03` | `CA-3` | `"Dado um arquivo acima do limite de tamanho, quando tento enviar, então recebo erro 413" (o valor do limite não é definido; usamos os 15 MB configurados no código)` | `S` |
| `TC-13` | `HU-03` | `CT-13` | `"Enviar foto para demand_id inválido → Status 404"` | `N` |
| `TC-14` | `HU-03` | `CT-14` | `"Todas associadas corretamente, sem sobrescrever"` | `N` |
| `TC-15` | `HU-03` | `CT-15` | `"Acesso negado (403/expirado)" (o tempo de expiração da URL não é definido)` | `S` |
| `TC-16` | `HU-04` | `CA-1` | `"o routingRuleService considera a localização para decidir o órgão responsável"` | `N` |
| `TC-17` | `HU-04` | `CT-17` | `"marca como 'localização pendente' ou usa fallback por categoria" (a HU não decide entre as duas opções)` | `S` |
| `TC-18` | `HU-04` | `CA-2` | `"o sistema sinaliza 'fora de área' em vez de rotear erroneamente" (os limites da área de cobertura não são definidos)` | `S` |
| `TC-19` | `HU-04` | `CT-19` | `"Retorna apenas chamados dentro do raio informado"` | `N` |
| `TC-20` | `HU-05` | `CT-20` | `"Token salvo vinculado ao usuário"` | `N` |
| `TC-21` | `HU-05` | `CA-1` | `"quando um gestor altera o status do meu chamado, então recebo uma push notification com o novo status"` | `N` |
| `TC-22` | `HU-05` | `CA-2` | `"o sistema não falha, apenas não envia push"` | `N` |
| `TC-23` | `HU-05` | `CT-23` | `"Requisição principal (mudança de status) não falha; falha de push é apenas logada/enfileirada para retry"` | `N` |
| `TC-24` | `HU-05` | `CT-24` | `"Ambos recebem a notificação"` | `N` |
| `TC-25` | `HU-06` | `CA-1` | `"recebo apenas a primeira página e um cursor/token para a próxima"` | `N` |
| `TC-26` | `HU-06` | `CT-26` | `"Retorna os próximos itens sem duplicar/pular registros"` | `N` |
| `TC-27` | `HU-06` | `CA-2` | `"recebo erro tratado (não 500)"` | `N` |
| `TC-28` | `HU-06` | `CT-28` | `"Resposta mobile não inclui campos desnecessários" (a lista de campos necessários não é definida)` | `S` |
| `TC-29` | `HU-06` | `CT-29` | `"Retorna 304 quando não houve mudança"` | `N` |
| `TC-30` | `HU-07` | `CA-2` | `"Dado um client_uuid novo, quando crio outro chamado, então é tratado como registro independente"` | `N` |
| `TC-31` | `HU-07` | `CA-1` | `"apenas um chamado é criado"` | `N` |
| `TC-32` | `HU-07` | `CT-32` | `"Retorna apenas registros alterados após o timestamp informado"` | `N` |
| `TC-33` | `HU-08` | `CA-1` | `"Dado um cliente chamando /api/v1/demands, quando a rota existe, então responde normalmente"` | `N` |
| `TC-34` | `HU-08` | `CT-34` | `"Redireciona para v1 ou retorna erro claro de rota descontinuada, conforme decisão do time" (decisão ainda não tomada)` | `S` |
| `TC-35` | `HU-08` | `CT-35` | `"retorna sinalização de 'atualização obrigatória' quando aplicável" (a versão mínima não é definida)` | `S` |
| `TC-36` | `HU-09` | `CA-1` | `"Dado uma chamada vinda do app mobile (sem header Origin de navegador), quando processada, então não é bloqueada"` | `N` |
| `TC-37` | `HU-09` | `CT-37` | `"Requisição com Origin da whitelist → Processada normalmente"` | `N` |
| `TC-38` | `HU-09` | `CA-2` | `"Dado uma chamada vinda de um domínio web não autorizado, quando processada, então é bloqueada"` | `N` |
| `TC-39` | `HU-09` | `CT-39` | `"Bloqueado por requireRole, retorna 403"` | `N` |
| `TC-40` | `—` | `—` | `— (cadastro vem do README e do código; não há HU de cadastro)` | `S` |
| `TC-41` | `—` | `—` | `— (senha ≥ 6 e formato de e-mail vêm do código, não de requisito)` | `S` |
| `TC-42` | `—` | `—` | `— (regra de edição/remoção por status vem do README, não das HUs)` | `S` |
| `TC-43` | `—` | `—` | `— (isolamento entre cidadãos não está escrito nas HUs)` | `S` |
| `TC-44` | `HU-04` | `—` | `— (a HU não trata de categoria ou órgão inativo)` | `S` |
| `TC-45` | `HU-04` | `—` | `— (a HU não diz o que acontece com GPS desligado ou sem permissão)` | `S` |
| `TC-46` | `HU-04` | `—` | `"que meu chamado registre automaticamente minha localização" (fluxo completo nas telas)` | `N` |
| `TC-47` | `HU-05` | `—` | `"quando um gestor altera o status do meu chamado" (as regras de status válido e órgão alheio vêm do código)` | `S` |
| `TC-48` | `—` | `—` | `— (resposta 503 com banco fora do ar vem do código)` | `S` |

### 4.6 Casos de teste

Grave a saída íntegra em um arquivo próprio versionado no repositório e referencie aqui.

Arquivo: [`docs/testes/ia/saida-rodada-2.md`](ia/saida-rodada-2.md)

Casos consolidados pela squad a partir da segunda rodada, das HUs e dos testes já presentes no repositório (IDs U-xx, A-xx, E-xx e M-xx do `TESTES.md`). O número do TC é o mesmo do CT da HU; TC-40 a TC-48 vêm do projeto e não têm HU.

| ID | HU | CA | Título | Pré-condições | Passos | Resultado esperado | Pós-condições |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| TC-01 | HU-01 | CA-1 | Login válido | Usuário ativo cadastrado | `POST /auth/login` com e-mail e senha corretos | 200; access token curto + refresh token longo | Sessão criada |
| TC-02 | HU-01 | CT-02 | Login inválido | Usuário cadastrado | Login com senha errada; login com e-mail inexistente | 401 com a mesma mensagem nos dois; nenhuma sessão | — |
| TC-03 | HU-01 | CA-2 | Refresh válido | Sessão com refresh válido | `POST /auth/refresh` com o refresh token | 200; novo access token aceito em rota protegida | — |
| TC-04 | HU-01 | CA-3 | Refresh expirado | Refresh token expirado | `POST /auth/refresh` | 401 pedindo novo login | — |
| TC-05 | HU-02 | CA-2 | Refresh reutilizado após logout | Sessão ativa | Logout; usar o refresh token antigo | 401 (token revogado) | — |
| TC-06 | HU-01 | CT-06 | Access token expirado | Access token expirado | Chamar rota protegida | 401 com `code: "token_expired"` | — |
| TC-07 | HU-02 | CA-1 | Logout bem-sucedido | Usuário autenticado | `POST /auth/logout` | 200; token revogado; cookie limpo | Sessão encerrada |
| TC-08 | HU-02 | CT-08 | Uso pós-logout | Duas sessões do mesmo usuário | Logout da sessão 1; chamar `/auth/me` com as duas | Sessão 1 → 401; sessão 2 → 200 | — |
| TC-09 | HU-02 | CT-09 | Logout sem token válido | — | `POST /auth/logout` sem token e com token expirado | 401, nunca 500 | — |
| TC-10 | HU-03 | CA-1 | Upload de imagem válida | Chamado aberto do cidadão | Enviar JPEG de 2 MB | Sucesso; URL retornada e persistida | Foto associada |
| TC-11 | HU-03 | CA-2 | Upload de tipo inválido | Chamado aberto | Enviar `.exe` renomeado como `.jpg` | 422; nada gravado | — |
| TC-12 | HU-03 | CA-3 | Upload acima do limite | Chamado aberto | Enviar arquivo no limite, 1 byte acima e 50 MB | No limite aceita; acima → 413; nada gravado | — |
| TC-13 | HU-03 | CT-13 | Upload em chamado inexistente | Cidadão logado | Enviar foto para id inexistente | 404 | — |
| TC-14 | HU-03 | CT-14 | Upload múltiplo | Chamado aberto | Enviar 3 imagens em sequência | As 3 associadas, sem sobrescrever | 3 fotos no chamado |
| TC-15 | HU-03 | CT-15 | URL assinada expira | Foto armazenada | Gerar URL; acessar após a expiração | 403/expirado | — |
| TC-16 | HU-04 | CA-1 | Coordenadas válidas | Seed com ponto dentro da área | Criar chamado com lat/lng da região | Roteado ao órgão da região | Chamado na fila do órgão |
| TC-17 | HU-04 | CT-17 | Chamado sem coordenadas | Cidadão logado | Criar chamado sem lat/lng | Aceito; fallback por categoria ou “localização pendente” | — |
| TC-18 | HU-04 | CA-2 | Coordenadas fora da área | Seed com ponto fora da área | Criar chamado com lat/lng de outra cidade | Aviso “fora de área”, sem roteamento | — |
| TC-19 | HU-04 | CT-19 | Busca por proximidade | Chamados a distâncias conhecidas | `GET /demands/nearby?lat=&lng=&radius=1000` | Só chamados dentro do raio | — |
| TC-20 | HU-05 | CT-20 | Registro de device token | Usuário logado | Enviar token FCM | Token salvo e vinculado ao usuário | — |
| TC-21 | HU-05 | CA-1 | Notificação disparada | Cidadão com device token; FCM mockado | Gestor muda status para “Em Andamento” | Push enviado aos tokens do dono | — |
| TC-22 | HU-05 | CA-2 | Usuário sem token | Cidadão sem device token | Gestor muda status | 200; log indica push pulado | — |
| TC-23 | HU-05 | CT-23 | FCM fora do ar | Duplo do FCM lançando erro | Gestor muda status | 200; falha logada/enfileirada | Status gravado |
| TC-24 | HU-05 | CT-24 | Múltiplos dispositivos (manual) | Usuário em 2 aparelhos físicos | Gestor muda status | Os dois aparelhos recebem a push | — |
| TC-25 | HU-06 | CA-1 | Primeira página | Mais de 20 chamados | `GET /demands?limit=20` | 20 itens + cursor | — |
| TC-26 | HU-06 | CT-26 | Página seguinte | Cursor da TC-25 | `GET /demands?cursor=<token>` | Próximos itens sem duplicar/pular | — |
| TC-27 | HU-06 | CA-2 | Cursor inválido | — | Enviar cursor corrompido | 400 tratado, sem stack trace | — |
| TC-28 | HU-06 | CT-28 | Payload enxuto | Chamado com relacionamentos | Comparar resposta mobile e admin | Mobile sem relacionamentos completos do Prisma | — |
| TC-29 | HU-06 | CT-29 | Cache condicional | ETag de `/categories` obtido | Repetir com `If-None-Match` | 304 sem mudança | — |
| TC-30 | HU-07 | CA-2 | Criação única | Cidadão logado; categoria ativa | Criar chamado com client_uuid X | 201; protocolo `DEM-AAAAMMDD-XXXX`; status Aberto | Chamado criado |
| TC-31 | HU-07 | CA-1 | Reenvio idempotente | TC-30 executado | Reenviar o mesmo payload com X | Retorna o chamado existente; nenhum duplicado | 1 registro |
| TC-32 | HU-07 | CT-32 | Sincronização incremental | Chamados alterados antes e depois de T | `GET /demands/changes?since=T` | Só os alterados após T | — |
| TC-33 | HU-08 | CA-1 | Acesso à v1 | Cidadão logado | `GET /api/v1/demands` | 200 com o contrato atual | — |
| TC-34 | HU-08 | CT-34 | Rota legada | — | `GET /demands` sem prefixo | Redireciona para v1 ou erro claro | — |
| TC-35 | HU-08 | CT-35 | Versão mínima do app (manual) | App em versão antiga | Chamar endpoint de verificação | Sinaliza “atualização obrigatória” | — |
| TC-36 | HU-09 | CA-1 | Chamada do app mobile | Backend no ar | Requisição sem header Origin | Processada normalmente | — |
| TC-37 | HU-09 | CT-37 | Domínio autorizado | `ALLOWED_ORIGINS` configurado | Requisição com Origin da whitelist | Processada; header `Access-Control-Allow-Origin` presente | — |
| TC-38 | HU-09 | CA-2 | Domínio não autorizado | `ALLOWED_ORIGINS` configurado | Requisição com Origin fora da whitelist | Bloqueada pelo CORS | — |
| TC-39 | HU-09 | CT-39 | Perfil errado | Tokens de Admin, Gestor e Cidadão | Acessar rotas de cada perfil com cada token | Herança Admin ⊃ Gestor ⊃ Cidadão; 403 fora do perfil | — |
| TC-40 | — | — | Cadastro | E-mail não cadastrado | Cadastrar válido; repetir e-mail; cadastrar com perfil Admin | 201 Cidadão; 409; perfil forçado para Cidadão | Usuário gravado |
| TC-41 | — | — | Validação de campos do cadastro | — | Campo ausente; e-mail sem @; senha com 5, 6 e 7 caracteres | 400 nos inválidos; 6 e 7 aceitos | Nada gravado nos inválidos |
| TC-42 | — | — | Editar/remover por dono e status | Chamados em cada status | Aplicar a tabela de decisão da 4.4 | Só o dono com status Aberto; gestor remove qualquer; demais 403 | Histórico registrado |
| TC-43 | — | — | Isolamento entre cidadãos | Dois cidadãos; chamado do primeiro | O segundo tenta ver, editar, anexar foto e remover | 403 em todas; chamado do dono intacto | — |
| TC-44 | HU-04 | — | Categoria e órgão ativos | Seed com itens ativos e inativos | Listar categorias; criar chamado em categoria inativa ou com órgão inativo | Só ativas listadas; 400 na inativa; nunca roteia a órgão inativo | — |
| TC-45 | HU-04 | — | GPS desligado ou sem permissão (manual) | Aparelho físico | Negar permissão; desligar GPS; capturar localização | App avisa e permite digitar o endereço | Permissões restauradas |
| TC-46 | HU-04 | — | Fluxo completo nas telas | Emulador, Metro e backend com seed | Nova demanda (GPS, foto) → salvar → pesquisar → editar → excluir | Cada etapa refletida na tela | — |
| TC-47 | HU-05 | — | Gestor muda status | Gestor da COMPESA logado | Status válido; “Finalizado”; id inexistente; chamado de outro órgão | 200; 400; 404; 403 | Status no histórico |
| TC-48 | — | — | Banco indisponível | Backend no ar | Derrubar o PostgreSQL; chamar `/health` e uma rota | 503 com mensagem padrão | Banco restaurado |

---

## 5\. Seleção para automação

*Cinco medidas por caso, e só então a escolha entre execução manual e automatizada.*

```
execuções até o retorno  =  Ti ÷ (Tm − Ta − Mn/F)
```

- Tm é o tempo de uma execução manual honesta, cronometrada uma vez, não estimada de cabeça.
- Ti é o investimento único; Mn é o que a automação consome por mês só para continuar funcionando.
- F é a frequência realista no horizonte do projeto, não a frequência ideal.
- "Não automatizar" nunca significa "não verificar": o caso continua no plano, com execução manual e responsável.

| ID | Nível | Tm manual/exec | Ti implementar | Ta auto/exec | Mn manut./mês | F exec./mês | Automatizar? |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| `TC-01` | `Integração` | `3 min` | `30 min` | `1 s` | `5 min` | `30` | `Sim` |
| `TC-02` | `Integração` | `4 min` | `30 min` | `1 s` | `5 min` | `30` | `Sim` |
| `TC-03` | `Integração` | `5 min` | `45 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-04` | `Integração` | `10 min` | `45 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-05` | `Integração` | `5 min` | `40 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-06` | `Integração` | `10 min` | `30 min` | `1 s` | `5 min` | `30` | `Sim` |
| `TC-07` | `Integração` | `3 min` | `30 min` | `1 s` | `5 min` | `30` | `Sim` |
| `TC-08` | `Integração` | `6 min` | `40 min` | `2 s` | `5 min` | `30` | `Sim` |
| `TC-09` | `Integração` | `3 min` | `20 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-10` | `Integração` | `6 min` | `60 min` | `2 s` | `10 min` | `20` | `Sim` |
| `TC-11` | `Componente` | `5 min` | `30 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-12` | `Integração` | `10 min` | `45 min` | `3 s` | `5 min` | `20` | `Sim` |
| `TC-13` | `Integração` | `3 min` | `20 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-14` | `Integração` | `8 min` | `60 min` | `3 s` | `10 min` | `10` | `Sim` |
| `TC-15` | `Integração` | `15 min` | `90 min` | `3 s` | `15 min` | `5` | `Sim` |
| `TC-16` | `Componente` | `10 min` | `60 min` | `1 s` | `10 min` | `15` | `Sim` |
| `TC-17` | `Integração` | `4 min` | `30 min` | `1 s` | `5 min` | `15` | `Sim` |
| `TC-18` | `Componente` | `10 min` | `60 min` | `1 s` | `10 min` | `15` | `Sim` |
| `TC-19` | `Integração` | `15 min` | `90 min` | `2 s` | `15 min` | `5` | `Sim` |
| `TC-20` | `Integração` | `5 min` | `40 min` | `1 s` | `5 min` | `15` | `Sim` |
| `TC-21` | `Integração` | `10 min` | `90 min` | `2 s` | `15 min` | `15` | `Sim` |
| `TC-22` | `Integração` | `8 min` | `45 min` | `1 s` | `5 min` | `15` | `Sim` |
| `TC-23` | `Integração` | `20 min` | `60 min` | `2 s` | `10 min` | `15` | `Sim` |
| `TC-24` | `Sistema` | `15 min` | `240 min` | `60 s` | `40 min` | `2` | `Não, permanece manual` |
| `TC-25` | `Integração` | `5 min` | `45 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-26` | `Integração` | `10 min` | `60 min` | `2 s` | `10 min` | `15` | `Sim` |
| `TC-27` | `Integração` | `5 min` | `30 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-28` | `Integração` | `10 min` | `45 min` | `1 s` | `10 min` | `10` | `Sim` |
| `TC-29` | `Integração` | `5 min` | `45 min` | `1 s` | `5 min` | `5` | `Sim` |
| `TC-30` | `Sistema` | `8 min` | `120 min` | `7 s` | `20 min` | `20` | `Sim` |
| `TC-31` | `Integração` | `8 min` | `60 min` | `2 s` | `10 min` | `15` | `Sim` |
| `TC-32` | `Integração` | `12 min` | `60 min` | `2 s` | `10 min` | `5` | `Sim` |
| `TC-33` | `Integração` | `3 min` | `30 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-34` | `Integração` | `3 min` | `20 min` | `1 s` | `5 min` | `5` | `Sim` |
| `TC-35` | `Sistema` | `5 min` | `120 min` | `2 s` | `15 min` | `2` | `Não, permanece manual` |
| `TC-36` | `Integração` | `3 min` | `20 min` | `1 s` | `5 min` | `30` | `Sim` |
| `TC-37` | `Integração` | `3 min` | `20 min` | `1 s` | `5 min` | `30` | `Sim` |
| `TC-38` | `Integração` | `3 min` | `20 min` | `1 s` | `5 min` | `30` | `Sim` |
| `TC-39` | `Componente` | `20 min` | `40 min` | `1 s` | `5 min` | `30` | `Sim` |
| `TC-40` | `Integração` | `6 min` | `40 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-41` | `Componente` | `10 min` | `45 min` | `1 s` | `5 min` | `20` | `Sim` |
| `TC-42` | `Componente` | `25 min` | `90 min` | `2 s` | `10 min` | `20` | `Sim` |
| `TC-43` | `Sistema` | `15 min` | `90 min` | `5 s` | `15 min` | `10` | `Sim` |
| `TC-44` | `Integração` | `10 min` | `60 min` | `2 s` | `10 min` | `10` | `Sim` |
| `TC-45` | `Sistema` | `10 min` | `300 min` | `60 s` | `60 min` | `2` | `Não, permanece manual` |
| `TC-46` | `Sistema` | `12 min` | `240 min` | `180 s` | `45 min` | `4` | `Não, permanece manual` |
| `TC-47` | `Integração` | `8 min` | `60 min` | `2 s` | `10 min` | `10` | `Sim` |
| `TC-48` | `Integração` | `20 min` | `180 min` | `5 s` | `30 min` | `4` | `Não, permanece manual` |

Por que os cinco `Não`: TC-24, TC-35, TC-45 e TC-46 têm denominador negativo (Mn/F supera o ganho por execução), então nunca se pagam; TC-48 só se paga após ~15 execuções (180 ÷ (20 − 0,08 − 7,5)), acima das ~12 do horizonte do projeto. Todos continuam no plano com execução manual antes de cada release: TC-24 e TC-45 em aparelho físico com gravação de tela, TC-35 e TC-48 com roteiro e print, e TC-46 usando o fluxo Maestro `demand_crud.yaml` como roteiro assistido.

---

## 6\. Backlog de automação

*Entre os casos selecionados para automação, qual vem primeiro.*

> Atividade: ordenar o backlog de automação.

Três fatores a considerar

- Risco: o que acontece se este comportamento quebrar em produção e ninguém perceber?
- Custo: quanto custa implementar e manter este caso automatizado?
- Frequência: quantas vezes este caso será executado no horizonte do projeto?

```
prioridade  =  (Risco × Frequência) ÷ Custo
```

*Escalas de 1 a 3. Heurística de ordenação.*

*Uma linha por caso selecionado para automação.*

Status: `Automatizado` (teste já no repositório) · `Parcial` (existe teste, mas a regra atual difere da HU) · `A fazer` (dá para escrever sobre o código atual) · `Bloqueado` (depende de funcionalidade ainda não implementada). Em empate de prioridade, vem primeiro o maior risco e depois o menor custo.

| Ordem | ID do caso | HU | Nível | Risco | Custo | Frequência | Prioridade | Responsável | Status |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | `TC-02` | `HU-01` | `Integração` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Arthur Borba Lins` | `Automatizado (A-02, A-03, U-13, E-21)` |
| 2 | `TC-01` | `HU-01` | `Integração` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Bruno Dornelas` | `Parcial (A-01, A-05, U-11; falta o refresh token)` |
| 3 | `TC-06` | `HU-01` | `Integração` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Bruno Felipe Castilho` | `Parcial (A-08 retorna 401 sem o código token_expired)` |
| 4 | `TC-07` | `HU-02` | `Integração` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Felipe Cisneiros` | `Automatizado (A-13, U-14, E-12)` |
| 5 | `TC-08` | `HU-02` | `Integração` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Michelangelo Morais do Rego` | `Automatizado (A-14, E-25)` |
| 6 | `TC-11` | `HU-03` | `Componente` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Paulo Henrique Alves Pereira` | `Parcial (U-33, A-25, E-27 retornam 400, HU pede 422)` |
| 7 | `TC-36` | `HU-09` | `Integração` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Ramom de Oliveira Aguiar` | `A fazer` |
| 8 | `TC-38` | `HU-09` | `Integração` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Thyalles Araujo Campos` | `A fazer` |
| 9 | `TC-39` | `HU-09` | `Componente` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Victor Simas Azevedo de Almeida` | `Automatizado (U-01 a U-10, E-15)` |
| 10 | `TC-40` | `—` | `Integração` | `3` | `1` | `3` | `(3×3)÷1 = 9,0` | `Arthur Borba Lins` | `Automatizado (A-10 a A-12, E-22, E-23)` |
| 11 | `TC-12` | `HU-03` | `Integração` | `3` | `1` | `2` | `(3×2)÷1 = 6,0` | `Bruno Dornelas` | `A fazer` |
| 12 | `TC-09` | `HU-02` | `Integração` | `2` | `1` | `3` | `(2×3)÷1 = 6,0` | `Bruno Felipe Castilho` | `A fazer` |
| 13 | `TC-13` | `HU-03` | `Integração` | `2` | `1` | `3` | `(2×3)÷1 = 6,0` | `Felipe Cisneiros` | `A fazer` |
| 14 | `TC-37` | `HU-09` | `Integração` | `2` | `1` | `3` | `(2×3)÷1 = 6,0` | `Michelangelo Morais do Rego` | `A fazer` |
| 15 | `TC-41` | `—` | `Componente` | `2` | `1` | `3` | `(2×3)÷1 = 6,0` | `Paulo Henrique Alves Pereira` | `A fazer` |
| 16 | `TC-10` | `HU-03` | `Integração` | `3` | `2` | `3` | `(3×3)÷2 = 4,5` | `Ramom de Oliveira Aguiar` | `Parcial (U-31, U-32, E-09; disco local em vez de bucket)` |
| 17 | `TC-27` | `HU-06` | `Integração` | `3` | `2` | `3` | `(3×3)÷2 = 4,5` | `Thyalles Araujo Campos` | `A fazer (erro sem stack trace); cursor Bloqueado` |
| 18 | `TC-30` | `HU-07` | `Sistema` | `3` | `2` | `3` | `(3×3)÷2 = 4,5` | `Victor Simas Azevedo de Almeida` | `Parcial (E-03 sem client_uuid)` |
| 19 | `TC-42` | `—` | `Componente` | `3` | `2` | `3` | `(3×3)÷2 = 4,5` | `Arthur Borba Lins` | `Automatizado (U-21 a U-30, A-22, A-23, E-08, E-11, E-18)` |
| 20 | `TC-43` | `—` | `Sistema` | `3` | `2` | `3` | `(3×3)÷2 = 4,5` | `Bruno Dornelas` | `Automatizado (A-19, E-24)` |
| 21 | `TC-17` | `HU-04` | `Integração` | `2` | `1` | `2` | `(2×2)÷1 = 4,0` | `Bruno Felipe Castilho` | `A fazer` |
| 22 | `TC-28` | `HU-06` | `Integração` | `2` | `1` | `2` | `(2×2)÷1 = 4,0` | `Felipe Cisneiros` | `Parcial (U-20 converte o registro para o formato da API)` |
| 23 | `TC-33` | `HU-08` | `Integração` | `2` | `1` | `2` | `(2×2)÷1 = 4,0` | `Michelangelo Morais do Rego` | `Bloqueado (rotas sem /api/v1)` |
| 24 | `TC-47` | `HU-05` | `Integração` | `2` | `1` | `2` | `(2×2)÷1 = 4,0` | `Paulo Henrique Alves Pereira` | `Automatizado (A-28 a A-33, E-16, E-17, E-19)` |
| 25 | `TC-03` | `HU-01` | `Integração` | `3` | `2` | `2` | `(3×2)÷2 = 3,0` | `Ramom de Oliveira Aguiar` | `Bloqueado (sem /auth/refresh)` |
| 26 | `TC-04` | `HU-01` | `Integração` | `3` | `2` | `2` | `(3×2)÷2 = 3,0` | `Thyalles Araujo Campos` | `Bloqueado (sem /auth/refresh)` |
| 27 | `TC-05` | `HU-02` | `Integração` | `3` | `2` | `2` | `(3×2)÷2 = 3,0` | `Victor Simas Azevedo de Almeida` | `Bloqueado (sem /auth/refresh)` |
| 28 | `TC-16` | `HU-04` | `Componente` | `3` | `2` | `2` | `(3×2)÷2 = 3,0` | `Arthur Borba Lins` | `Parcial (E-13, E-14 roteiam só por categoria)` |
| 29 | `TC-22` | `HU-05` | `Integração` | `3` | `2` | `2` | `(3×2)÷2 = 3,0` | `Bruno Dornelas` | `Bloqueado (sem push)` |
| 30 | `TC-23` | `HU-05` | `Integração` | `3` | `2` | `2` | `(3×2)÷2 = 3,0` | `Bruno Felipe Castilho` | `Bloqueado (sem push)` |
| 31 | `TC-31` | `HU-07` | `Integração` | `3` | `2` | `2` | `(3×2)÷2 = 3,0` | `Felipe Cisneiros` | `Bloqueado (sem client_uuid)` |
| 32 | `TC-44` | `HU-04` | `Integração` | `3` | `2` | `2` | `(3×2)÷2 = 3,0` | `Michelangelo Morais do Rego` | `Parcial (A-21, A-27; falta órgão inativo)` |
| 33 | `TC-25` | `HU-06` | `Integração` | `2` | `2` | `3` | `(2×3)÷2 = 3,0` | `Paulo Henrique Alves Pereira` | `Parcial (U-20, A-16 paginam por offset)` |
| 34 | `TC-18` | `HU-04` | `Componente` | `2` | `2` | `2` | `(2×2)÷2 = 2,0` | `Ramom de Oliveira Aguiar` | `Bloqueado (sem área de cobertura)` |
| 35 | `TC-20` | `HU-05` | `Integração` | `2` | `2` | `2` | `(2×2)÷2 = 2,0` | `Thyalles Araujo Campos` | `Bloqueado (sem registro de device token)` |
| 36 | `TC-21` | `HU-05` | `Integração` | `2` | `2` | `2` | `(2×2)÷2 = 2,0` | `Victor Simas Azevedo de Almeida` | `Bloqueado (sem push)` |
| 37 | `TC-26` | `HU-06` | `Integração` | `2` | `2` | `2` | `(2×2)÷2 = 2,0` | `Arthur Borba Lins` | `Bloqueado (sem cursor)` |
| 38 | `TC-14` | `HU-03` | `Integração` | `2` | `2` | `1` | `(2×1)÷2 = 1,0` | `Bruno Dornelas` | `Bloqueado (1 foto por chamado; U-34 substitui)` |
| 39 | `TC-32` | `HU-07` | `Integração` | `2` | `2` | `1` | `(2×1)÷2 = 1,0` | `Bruno Felipe Castilho` | `Bloqueado (sem /demands/changes)` |
| 40 | `TC-34` | `HU-08` | `Integração` | `1` | `1` | `1` | `(1×1)÷1 = 1,0` | `Felipe Cisneiros` | `Bloqueado (decisão do time pendente)` |
| 41 | `TC-15` | `HU-03` | `Integração` | `2` | `3` | `1` | `(2×1)÷3 = 0,7` | `Michelangelo Morais do Rego` | `Bloqueado (sem bucket)` |
| 42 | `TC-19` | `HU-04` | `Integração` | `1` | `2` | `1` | `(1×1)÷2 = 0,5` | `Paulo Henrique Alves Pereira` | `Bloqueado (sem /demands/nearby)` |
| 43 | `TC-29` | `HU-06` | `Integração` | `1` | `2` | `1` | `(1×1)÷2 = 0,5` | `Ramom de Oliveira Aguiar` | `Bloqueado (sem ETag)` |

Verificação

- [x] O primeiro item é de risco alto, custo baixo e frequência alta (TC-02: risco 3, custo 1, frequência 3).
