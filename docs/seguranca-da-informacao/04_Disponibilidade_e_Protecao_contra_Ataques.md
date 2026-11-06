# Atividade 4 — Disponibilidade e proteção contra ataques digitais

| | |
|---|---|
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Disciplina** | Segurança de Dados — Unidade 2 |
| **Entrega** | 30/10 |

**Integrantes do grupo:** Felipe Cisneiros Agostinho, Ramom de Oliveira Aguiar, Arthur Borba Lins,
Victor Simas Azevedo de Almeida, Paulo Henrique Alves de Barros Pereira, Michelangelo Morais do Rego,
Bruno Dornelas Costa Ciro da Penha, João Guilherme Aires Chagas de Oliveira, Thyalles Araujo Campos,
Bruno Felipe de Castilho Gomes Rego

---

O Fiscalize é um canal entre o cidadão e o poder público: se ele cai, o cidadão perde o meio de
registrar um vazamento ou um poste apagado, e o gestor perde a fila de atendimento. Por isso, a
**disponibilidade** é tratada como requisito de segurança, no mesmo nível da confidencialidade e da
integridade. Este documento descreve como a plataforma se mantém no ar e como se defende dos ataques
digitais mais prováveis.

## 1. Arquitetura e pontos de falha

| Componente | Papel | Se ficar indisponível… |
|---|---|---|
| **App mobile** (React Native/Expo) | Interface do cidadão, gestor e admin | Apenas o aparelho afetado |
| **API REST** (Node.js + Express) | Regras de negócio, autenticação, roteamento | Todo o sistema para — **componente crítico** |
| **PostgreSQL** | Persistência de usuários, chamados e auditoria | API responde `503` — **componente crítico** |
| **Redis** | Cache de consultas (categorias, métricas) | Sistema continua; apenas fica mais lento |
| **Agente de IA** (Gemini) | Assistente de consulta de status | Só o assistente é desativado; o restante segue |
| **Serviços externos** (SMTP, Expo Push) | E-mails de recuperação/2FA e notificações | Notificações atrasam; o chamado é registrado |

O princípio adotado é a **degradação graciosa**: a falha de um componente acessório nunca deve
derrubar o fluxo principal (registrar e acompanhar demandas).

## 2. Mecanismos de disponibilidade

### 2.1 Monitoramento de saúde (*health check*)

A API expõe a rota `GET /health`, que testa a conexão com o PostgreSQL (`SELECT 1`) e com o Redis e
responde:

- `200 { status: "ok" }` quando o banco está conectado;
- `503 { status: "degraded" }` quando o banco está fora.

Essa rota é consumida pelo orquestrador/balanceador de carga para retirar instâncias doentes de
circulação e por uma ferramenta de monitoramento externo (*uptime check* a cada 1 minuto), que
alerta a equipe por e-mail/chat ao detectar duas falhas seguidas.

### 2.2 Degradação graciosa dos componentes acessórios

- **Cache Redis opcional:** se `REDIS_URL` não estiver configurado ou o Redis cair, o cache é
  desativado e as consultas vão direto ao banco. O cliente usa no máximo 3 tentativas de reconexão
  com *backoff* e não enfileira comandos offline, evitando que a API trave esperando o Redis.
- **Assistente de IA isolado:** o agente roda como serviço separado. A chamada tem *timeout* de 60 s;
  se ele não responder, a API devolve `503` com mensagem amigável só para o assistente, sem afetar
  as demais rotas.
- **Limite de cota no Gemini:** o agente aplica um limitador de requisições por minuto
  (`GEMINI_RPM`) antes de chamar a API do Google, evitando estourar a cota e ficar bloqueado.
- **Envio de e-mail e push fora do caminho crítico:** a falha do SMTP ou do serviço Expo Push é
  registrada em log, mas não impede a criação ou atualização do chamado.

### 2.3 Escalabilidade e redundância (ambiente de produção)

- **API sem estado (*stateless*):** a sessão vive no JWT e no Refresh Token salvo no banco, então
  qualquer instância atende qualquer requisição. Em produção rodam **no mínimo 2 instâncias** atrás
  de um balanceador de carga, com escalonamento automático por uso de CPU.
- **Banco gerenciado com réplica:** PostgreSQL em serviço gerenciado com *failover* automático para
  uma réplica em outra zona de disponibilidade.
- **Paginação obrigatória:** listagens de chamados são sempre paginadas (`page`/`limit`), e só a
  primeira foto de cada chamado é carregada na lista, limitando o custo de cada requisição.

### 2.4 Metas de disponibilidade

| Indicador | Meta |
|---|---|
| Disponibilidade mensal da API | **99,5 %** (≈ 3h40 de indisponibilidade/mês) |
| Tempo de resposta (p95) das rotas de chamados | **< 800 ms** |
| Tempo para detectar uma queda | **< 2 minutos** |

## 3. Proteção contra ataques digitais

### 3.1 Ataques de negação de serviço (DoS/DDoS)

- **Camada de borda (CDN/WAF):** o domínio da API fica atrás de um serviço de CDN com proteção
  anti-DDoS e *Web Application Firewall*, que absorve picos volumétricos e bloqueia padrões
  conhecidos (inundação SYN/HTTP, bots) antes de chegarem ao servidor.
- **Limite de requisições por IP e por usuário:** *rate limiting* com contadores no Redis — por
  exemplo, 100 requisições/minuto por IP nas rotas gerais e limites mais baixos nas rotas sensíveis
  (login, recuperação de senha, 2FA, assistente de IA).
- **Limite de tamanho do corpo:** o JSON padrão aceita no máximo **100 KB**; apenas as rotas de foto
  (`/demands/:id/photos` e `/auth/me/photo`) aceitam até **15 MB**, impedindo que um atacante
  esgote memória enviando corpos gigantes em qualquer rota.
- ***Timeouts*:** chamadas a serviços externos têm tempo máximo definido, evitando que conexões
  presas consumam os recursos do servidor.

### 3.2 Força bruta e abuso de credenciais

- **Bloqueio temporário após 5 tentativas** de login erradas seguidas (15 minutos), conforme a
  Atividade 3.
- **Código de 2FA** expira em **10 minutos** e aceita até **5 tentativas**; o reenvio só é permitido
  após **60 segundos**. O mesmo intervalo de 60 s vale para o reenvio do código de recuperação de
  senha.
- **Mensagens genéricas:** o login não revela se o erro foi de e-mail ou de senha, dificultando a
  enumeração de contas.

### 3.3 Roubo e reutilização de sessão

- **Access Token de 15 minutos** e **Refresh Token rotativo**: a cada renovação o token antigo é
  marcado como substituído e revogado, de forma atômica, para que duas renovações simultâneas não
  usem o mesmo token. Os Refresh Tokens são guardados no banco apenas como **hash**.
- **Logout por dispositivo:** sair de um aparelho revoga só aquele token; a exclusão de conta ou
  troca de senha revoga todos.

### 3.4 Ataques à aplicação (OWASP Top 10)

| Ataque | Defesa no Fiscalize |
|---|---|
| **Injeção de SQL** | Acesso ao banco pelo Prisma ORM, com consultas parametrizadas; nenhuma SQL é montada por concatenação de texto |
| **Quebra de controle de acesso / IDOR** | Middleware de autenticação extrai o usuário do token; `requireRole` aplica a matriz de permissões (Cidadão, Gestor, Admin); o cadastro ignora tentativas de se registrar como Admin |
| **Upload malicioso** | O backend lê os primeiros bytes do arquivo (*magic numbers*) e só aceita JPEG ou PNG reais, independentemente da extensão informada |
| **CORS / requisições de outras origens** | Lista de origens permitidas (`ALLOWED_ORIGINS`) obrigatória em produção; métodos e cabeçalhos restritos |
| **Configuração insegura** | Variáveis obrigatórias (`JWT_SECRET`, `ALLOWED_ORIGINS`) impedem o servidor de subir sem elas; o modo de demonstração (`DEMO_MODE`) é bloqueado em produção |
| **Cabeçalhos HTTP** | Uso de cabeçalhos de segurança (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, CSP) via middleware *helmet* e **HTTPS obrigatório** com TLS 1.2+ |
| **Comunicação entre serviços** | A API e o agente de IA trocam um segredo compartilhado (`x-agent-secret`) comparado em tempo constante |

### 3.5 Componentes vulneráveis e cadeia de suprimentos de software

- Dependências travadas por `package-lock.json` e instaladas com `npm ci` no CI.
- `npm audit` e alertas automáticos de dependências (Dependabot) no repositório, com correção
  prioritária de vulnerabilidades **críticas e altas**.
- Segredos (chaves de API, senhas SMTP, `JWT_SECRET`) ficam fora do código, em variáveis de ambiente
  e nos *secrets* do GitHub Actions; o arquivo `.env` está no `.gitignore`.

## 4. Verificação contínua

A pipeline do GitHub Actions executa a cada *push* e *pull request* testes unitários, de API e E2E
(Playwright e Maestro). A suíte `e2e/seguranca.spec.ts` verifica, contra a API real, que:

- rotas protegidas exigem login (`401` sem token);
- senha errada é recusada com mensagem genérica;
- um cidadão não vê, não edita, não anexa foto e não remove a ocorrência de outro;
- o logout de uma sessão não derruba outra sessão do mesmo usuário;
- arquivos que não são imagem são recusados como foto.

Assim, uma regressão que abra uma brecha de segurança é barrada antes de chegar à produção.

## 5. Resposta a incidentes

1. **Detecção:** alerta do monitoramento, do WAF ou relato de usuário.
2. **Contenção:** bloquear IPs/regiões no WAF, reduzir limites de requisição, desativar
   temporariamente funções acessórias (assistente de IA) e, se houver suspeita de credenciais
   vazadas, revogar todos os Refresh Tokens e girar o `JWT_SECRET`.
3. **Erradicação e recuperação:** corrigir a falha, publicar nova versão pela pipeline e, se
   necessário, restaurar dados conforme o plano de backup (Atividade 5).
4. **Comunicação:** se houver dados pessoais envolvidos, comunicar a ANPD e os titulares afetados em
   prazo razoável, conforme o Art. 48 da LGPD.
5. **Lições aprendidas:** registrar o incidente, a causa raiz e as ações preventivas.
