# Segurança da Informação

| | |
|---|---|
| **Papel no PI** | Definir e implementar os requisitos e controles de segurança e a conformidade com a LGPD, já que o app trata dados de cidadãos |
| **Código relacionado** | [`authService.ts`](../../backend/src/services/authService.ts), [`authMiddleware.ts`](../../backend/src/middlewares/authMiddleware.ts), [`requireRole.ts`](../../backend/src/middlewares/requireRole.ts), [`env.ts`](../../backend/src/config/env.ts), [`cors.ts`](../../backend/src/config/cors.ts), [`image.ts`](../../backend/src/utils/image.ts), [`AuthContext.tsx`](../../mobile/src/contexts/AuthContext.tsx), [`ai-agent/src/server.ts`](../../ai-agent/src/server.ts) |
| **Conexões** | define os controles que o [Mobile](../desenvolvimento-mobile/README.md) implementa; orienta [Dados](../engenharia-de-dados/README.md) sobre proteção e anonimização; alinha com [Negócios](../negocios-na-internet/README.md) os aspectos legais (LGPD); é verificada pelos testes de segurança de [Testes](../testes-automatizados/README.md) |

---

## 1. Entregas (documentos desta pasta)

| Unidade | Atividade | Documento |
|---|---|---|
| U1 | 1 · Autenticação de usuários e gestão de senhas | [`01_Autenticacao_e_Gestao_de_Senhas.md`](01_Autenticacao_e_Gestao_de_Senhas.md) |
| U1 | 2 · Dados em repouso e anonimização | [`02_Dados_em_Repouso_e_Anonimizacao.md`](02_Dados_em_Repouso_e_Anonimizacao.md) |
| U1 | 3 · Requisitos da LGPD por fluxo | [`03_Conformidade_LGPD.md`](03_Conformidade_LGPD.md) |
| U2 | 4 · Disponibilidade e proteção contra ataques digitais (30/10) | [`04_Disponibilidade_e_Protecao_contra_Ataques.md`](04_Disponibilidade_e_Protecao_contra_Ataques.md) |
| U2 | 5 · Backup e continuidade de operação (20/11) | [`05_Backup_e_Continuidade_de_Operacao.md`](05_Backup_e_Continuidade_de_Operacao.md) |
| U2 | 6 · Gestão de fornecedores (11/12) | [`06_Gestao_de_Fornecedores.md`](06_Gestao_de_Fornecedores.md) |

Os documentos descrevem a **política** (o que o produto deve garantir, inclusive em produção). A
seção 4 deste README separa o que já está **implementado no código** do que está **especificado
para produção**, para que nenhum controle "só no papel" seja confundido com um controle ativo.

---

## 2. Modelo de autenticação e autorização

```
 App ──POST /auth/login (e-mail, senha)──▶ Backend
                                           │ bcrypt.compare(senha, hash)
                                           ├─ sem 2FA ─▶ access token (JWT HS256, 15 min) + refresh token (opaco, 30 dias)
                                           └─ com 2FA ─▶ desafioId; código de 6 dígitos por e-mail
 App ──POST /auth/2fa/verify (desafioId, código)──▶ tokens
 App ──Authorization: Bearer <JWT>──▶ authenticate → requireRole(perfil) → rota
 App ──POST /auth/refresh (refresh token)──▶ novo par de tokens (rotação; o antigo é revogado)
```

- **Autenticação:** e-mail e senha, com **verificação em duas etapas** opcional (código por e-mail).
- **Sessão:** access token curto (JWT, 15 min) + refresh token longo, opaco e rotativo.
- **Autorização:** `authenticate` valida o JWT e **relê o perfil e o status no banco** a cada
  requisição (mudança feita pelo admin vale na hora; usuário inativado perde o acesso); `requireRole`
  aplica a hierarquia Cidadão < Gestor < Admin. O cidadão só enxerga os próprios chamados.
- **Logout:** revoga o refresh token daquele aparelho e coloca o access token numa *blocklist* até expirar.
- **Troca ou recuperação de senha:** revoga **todos** os refresh tokens do usuário.

---

## 3. Criptografia e cifras utilizadas

Visão geral de **onde cada primitiva criptográfica entra** e por quê. "Hash" é uma função de mão
única (não se desfaz); "cifra" é reversível com a chave; "MAC" prova integridade e autoria com uma
chave secreta.

| Dado | Primitiva | Tipo | Onde |
|---|---|---|---|
| Senha do usuário | **bcrypt** (custo 10) | hash lento com sal | `authService.ts`, `adminService.ts`, `seed.ts` |
| Access token | **JWT HS256** (HMAC-SHA-256) | assinatura (MAC) | `signAccessToken`, `authMiddleware.ts` |
| Refresh token | 384 bits aleatórios + **SHA-256** no banco | CSPRNG + hash rápido | `issueRefreshToken`, tabela `refresh_token.tokenhash` |
| Código de 2FA e de recuperação | 6 dígitos (`randomInt`) + **SHA-256** + `timingSafeEqual` | CSPRNG + hash + comparação em tempo constante | `generateCode`, `hashCode` |
| Segredo backend ↔ agente de IA | `x-agent-secret` + `timingSafeEqual` | comparação em tempo constante | `ai-agent/src/server.ts` |
| Identificadores (JWT `jti`, desafio de 2FA, IDs) | **UUID v4** (`randomUUID`) | CSPRNG | `authService.ts`, `aiService.ts` |
| Dados em trânsito | **TLS 1.2/1.3** (ECDHE + AES-GCM ou ChaCha20-Poly1305) | cifra autenticada | HTTPS da API, SMTP (STARTTLS/465), Gemini, Expo Push |
| Tokens no celular | **AES-256-GCM** com chave no Android Keystore / iOS Keychain | cifra autenticada | `expo-secure-store` |
| Banco e backups em produção | **AES-256** (disco/volume e cópias) | cifra simétrica | especificado nas Atividades 2 e 5 |

### 3.1 bcrypt: armazenamento de senhas

**O que é.** bcrypt é uma função de *hash de senha* baseada na cifra **Blowfish**. Ela usa uma
variação chamada **EksBlowfish** (*expensive key schedule*): a montagem das tabelas internas do
Blowfish é repetida **2^custo** vezes, misturando senha e sal a cada rodada. Com custo **10**, são
2^10 = 1.024 repetições, o que leva dezenas de milissegundos por tentativa.

**Formato gravado no banco** (60 caracteres, na coluna `usuario.senha`):

```
$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
 │   │  └──────── sal (22 chars, 128 bits) ┘└──────── hash (31 chars, 184 bits) ┘
 │   └─ custo: 2^10 rodadas
 └─ versão do algoritmo
```

**Como é usado.** `bcrypt.hash(senha, 10)` no cadastro, na troca e na recuperação de senha;
`bcrypt.compare(senha, hash)` no login, que extrai sal e custo do próprio hash. O código usa duas
bibliotecas que geram o **mesmo formato** (`$2b$`): `bcryptjs` (JavaScript puro, sem compilação
nativa) em `authService` e no seed, e `bcrypt` (nativa) em `adminService`. Um hash criado por uma é
validado pela outra.

**Por que bcrypt.**
- **Sal aleatório por senha:** duas pessoas com a mesma senha têm hashes diferentes, o que inutiliza
  *rainbow tables* e impede ver quem repete senha olhando o banco.
- **Lento de propósito e ajustável:** se o banco vazar, cada palpite custa caro para o atacante;
  o custo pode subir com o tempo sem mudar o formato.
- Maduro, com bibliotecas mantidas para Node e sem dependência de configuração extra.

**Alternativas descartadas.**
- **SHA-256/MD5 simples:** rápidos demais. Uma GPU testa bilhões de SHA-256 por segundo; senhas
  humanas cairiam em minutos. Hash rápido serve para dados de alta entropia (seção 3.3), não para senhas.
- **Argon2id:** é o vencedor da *Password Hashing Competition* e a recomendação atual da OWASP, por
  ser também *memory-hard* (resiste melhor a GPU/ASIC). Foi considerado na Atividade 1, mas a
  biblioteca para Node exige compilação nativa, o que complicava o CI e as máquinas Windows da
  equipe. bcrypt com custo ≥ 10 continua aceito pela OWASP. **Migração futura:** rehash para
  Argon2id no próximo login bem-sucedido de cada usuário.
- **scrypt / PBKDF2:** o PBKDF2 não é *memory-hard* e precisa de centenas de milhares de iterações
  para equivaler; o scrypt é bom, mas sem vantagem prática sobre bcrypt aqui.

**Limitação conhecida.** bcrypt considera só os **primeiros 72 bytes** da senha; acima disso o
resto é ignorado. Para senhas humanas isso não é problema prático.

### 3.2 JWT HS256 (HMAC-SHA-256): access token

**O que é.** Um JWT tem três partes em Base64URL: `cabeçalho.carga.assinatura`. A carga do
Fiscalize contém `id`, `email`, `perfil`, `jti` (UUID único), `iat` e `exp` (15 minutos).
A assinatura é:

```
assinatura = HMAC-SHA-256( JWT_SECRET, base64url(cabeçalho) + "." + base64url(carga) )
```

**HMAC** (*Hash-based Message Authentication Code*) combina a chave secreta com o SHA-256 em duas
passadas (`H((K ⊕ opad) ‖ H((K ⊕ ipad) ‖ m))`), o que impede forjar ou alterar o token sem a chave e
evita o ataque de extensão de comprimento que um `SHA-256(chave ‖ mensagem)` ingênuo sofreria.

**Importante: JWT assinado não é cifrado.** Qualquer um que tenha o token consegue ler a carga
(é só Base64). Por isso ela **não leva dados sensíveis** além do e-mail e do perfil, e o token só
trafega por HTTPS e fica no SecureStore do aparelho.

**Como é usado.** `jwt.sign` com `JWT_SECRET` (variável obrigatória: o servidor não sobe sem ela)
e `jwt.verify` no middleware; com segredo do tipo texto, a biblioteca só aceita algoritmos HS*,
o que bloqueia o ataque clássico de trocar o cabeçalho para `alg: none`.

**Por que HS256.** Só o próprio backend emite e valida tokens; uma única chave simétrica é
suficiente, mais simples de gerir e mais rápida.

**Alternativas descartadas.**
- **RS256 / ES256 (assinatura assimétrica):** fazem sentido quando *outros* serviços precisam
  validar o token sem poder emiti-lo (chave pública distribuída). Aqui o agente de IA não valida
  o JWT: ele o repassa ao backend, que valida. Fica como evolução se surgir outro consumidor.
- **Sessão opaca guardada no servidor para todas as requisições:** exigiria consulta ao
  armazenamento de sessão em cada chamada. O JWT curto resolve o caminho comum; a revogação imediata
  fica com o refresh token opaco (seção 3.3), que é a parte longa da sessão.
- **JWE (JWT cifrado):** desnecessário, pois a carga não tem segredo e o canal já é TLS.

### 3.3 Refresh token: 384 bits aleatórios + SHA-256

**Como é usado.** `randomBytes(48)` gera 48 bytes (384 bits) de um gerador criptograficamente
seguro (CSPRNG do sistema operacional), enviados ao app em Base64URL. O banco guarda **apenas o
SHA-256 em hexadecimal** (coluna `tokenhash`, `CHAR(64)`, única). Na renovação:

1. calcula o SHA-256 do token recebido e busca o registro;
2. se o token **já tinha sido trocado**, considera que houve cópia e **revoga todas as sessões** do
   usuário (detecção de reuso);
3. revoga o antigo e emite o novo numa transação com condição em `revogadoem`, para que duas
   renovações simultâneas não aproveitem o mesmo token.

**SHA-256** é a função de hash da família SHA-2 (NIST FIPS 180-4): processa a mensagem em blocos
de 512 bits por 64 rodadas de compressão e produz 256 bits. É resistente a pré-imagem (dado o hash,
não se acha a entrada) e a colisões.

**Por que um hash rápido aqui (e não bcrypt).** O refresh token tem 384 bits de entropia: não há
dicionário nem força bruta possível, então a lentidão do bcrypt não acrescenta proteção. O SHA-256
basta para que **um vazamento da tabela não abra sessões**, e permite busca direta por índice único
(com bcrypt, cada token teria sal próprio e seria impossível buscar).

**Descartados:** guardar o token em texto puro (vazamento da tabela = sessões sequestradas) e usar
um JWT longo como refresh (não daria para revogar um aparelho específico sem uma lista de bloqueio).

### 3.4 Códigos de 6 dígitos (2FA e recuperação de senha)

**Como é usado.** `randomInt(0, 1_000_000)` (CSPRNG, distribuição uniforme, sem o viés de
`Math.random() * n`) gera o código, enviado por e-mail. O servidor guarda só o **SHA-256** do código,
em memória, com:

| | 2FA no login | Recuperação de senha |
|---|---|---|
| Validade | 10 minutos | 15 minutos |
| Tentativas | 5 (depois o desafio é descartado) | 5 |
| Reenvio | após 60 s | após 60 s |
| Comparação | `timingSafeEqual` | `timingSafeEqual` |

**Por que `timingSafeEqual`.** Uma comparação comum (`===`) para no primeiro byte diferente; medindo
o tempo de resposta, um atacante poderia descobrir o valor byte a byte (*timing attack*). A
comparação em tempo constante percorre sempre todos os bytes.

**O que o hash protege e o que não protege.** Com só 10^6 combinações, o SHA-256 de um código pode
ser invertido por força bruta *offline*; ele existe para que o código não fique legível num dump de
memória ou log. A proteção real é o **limite de 5 tentativas** com **validade curta**: a chance de
acertar às cegas é 5 em 1.000.000.

**Por que código por e-mail e não TOTP.** A Atividade 1 especificou **TOTP** (RFC 6238, Google
Authenticator), que é mais forte: o segredo nunca trafega e não depende da caixa de e-mail. A
implementação ficou com código por e-mail porque não exige instalar outro app (público amplo e
heterogêneo) e reaproveita o SMTP já usado na recuperação de senha. **TOTP para Gestor e Admin
continua sendo o alvo** (seção 4). **SMS** foi descartado por custo e pela vulnerabilidade a
*SIM swap*.

### 3.5 TLS: dados em trânsito

**O que é.** O TLS 1.2/1.3 combina três coisas:

1. **Troca de chaves ECDHE** (Diffie-Hellman efêmero em curvas elípticas, X25519 ou P-256): cliente
   e servidor derivam uma chave de sessão sem nunca transmiti-la; por ser efêmera, garante
   ***forward secrecy*** (roubar a chave do servidor depois não decifra conversas antigas).
2. **Autenticação do servidor** por certificado X.509 (assinatura RSA ou ECDSA), que impede o
   *man-in-the-middle*.
3. **Cifra autenticada (AEAD)** dos dados: **AES-128/256-GCM** ou **ChaCha20-Poly1305**.
   - **AES-GCM:** o AES (cifra de bloco de 128 bits, chave de 128 ou 256 bits, 10 ou 14 rodadas de
     substituição, permutação e mistura) opera em modo contador (CTR) para cifrar, e o **GHASH**
     calcula uma etiqueta de autenticação: qualquer alteração no tráfego é detectada.
   - **ChaCha20-Poly1305:** cifra de fluxo + MAC, preferida por celulares sem aceleração de AES em
     hardware.

**Onde.** API em produção (HTTPS obrigatório, TLS 1.2+), SMTP (TLS implícito na porta 465 ou
STARTTLS na 587, configurado em [`mailService.ts`](../../backend/src/services/mailService.ts)),
chamadas ao Gemini, Expo Push, Nominatim e IBGE (todas HTTPS) e conexão da aplicação com o
PostgreSQL gerenciado.

**Ressalva do ambiente acadêmico.** No desenvolvimento a API roda em `http://IP:3000`, e o APK de
teste habilita `usesCleartextTraffic` só para falar com esse backend local. Em produção a URL é
HTTPS e essa opção deve ser removida ([`mobile/README.md`](../../mobile/README.md#build-empacotado-eas)).

**Descartados:** TLS 1.0/1.1 e suítes com CBC, RC4 ou 3DES (obsoletos, com ataques conhecidos
como BEAST, POODLE e Sweet32).

### 3.6 Armazenamento no aparelho: Android Keystore e iOS Keychain

**Como é usado.** O app guarda access token, refresh token e dados do usuário com `expo-secure-store`.

- **Android:** a biblioteca cria uma chave **AES-256** dentro do **Android Keystore** (em hardware
  seguro/TEE quando o aparelho tem) e cifra cada valor com **AES-GCM** antes de gravá-lo; a chave
  nunca sai do Keystore.
- **iOS:** os valores vão para o **Keychain**, cifrados pelo sistema com chaves protegidas pelo
  *Secure Enclave* e atreladas ao aparelho.

**Descartado: AsyncStorage**, que grava em texto puro; em aparelho com *root* ou num backup, os
tokens seriam lidos diretamente.

### 3.7 Dados em repouso no servidor (produção)

Especificado nas [Atividades 2](02_Dados_em_Repouso_e_Anonimizacao.md) e [5](05_Backup_e_Continuidade_de_Operacao.md):
volumes do PostgreSQL e backups (`pg_dump`) cifrados com **AES-256**, com chaves gerenciadas pelo
provedor de nuvem (KMS), e cópias trafegando por TLS.

**Por que no disco e não por coluna.** A cifra de volume protege contra roubo de disco, *snapshot* e
backup vazado sem mudar o código nem impedir consultas e filtros (por categoria, cidade, status).
**Descartado:** cifrar colunas na aplicação (por exemplo, AES-GCM no endereço), que impediria buscas
e ordenação no banco e exigiria gestão de chaves na própria aplicação; reavaliar se surgirem dados
mais sensíveis, como CPF.

### 3.8 Outros controles com base criptográfica ou de integridade

- **Comparação do segredo backend ↔ agente** (`x-agent-secret`) com `timingSafeEqual`; o agente só
  escuta em `127.0.0.1` por padrão.
- **UUID v4** (122 bits aleatórios) para `jti` dos tokens, desafios de 2FA e correlação de requisições,
  impossíveis de adivinhar ou enumerar.
- **Validação de upload por *magic numbers*** ([`image.ts`](../../backend/src/utils/image.ts)): só
  aceita arquivos cujos primeiros bytes são de JPEG (`FF D8 FF`) ou PNG (`89 50 4E 47 0D 0A 1A 0A`),
  independentemente da extensão.
- **Geohash** (Atividade 2) para anonimizar localização em relatórios: não é criptografia, é
  *generalização* (a coordenada exata vira uma célula de 150 m a 1,2 km).

### 3.9 helmet e rate limiting: proteção da API contra abuso

**Como.** Três camadas, todas em [`backend/src`](../../backend/src) e cobertas pelo TC-77
([`protecaoAtaques.test.ts`](../../backend/src/tests/api/protecaoAtaques.test.ts)):

- **Cabeçalhos de segurança** com `helmet` ([`security.ts`](../../backend/src/config/security.ts)):
  HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy` e uma CSP restritiva;
  só o Swagger (`/docs`) tem CSP própria, que libera o unpkg de onde ele carrega a interface. O
  `X-Powered-By` do Express é removido.
- **Limite por IP** ([`rateLimit.ts`](../../backend/src/middlewares/rateLimit.ts)): 300 requisições por
  minuto em toda a API e 100 tentativas em 15 minutos nas rotas de autenticação sem sessão (cadastro,
  login, 2FA e recuperação de senha). Acima disso a resposta é 429 com `Retry-After`. Os valores mudam
  por `RATE_LIMIT_GLOBAL_MAX` e `RATE_LIMIT_AUTH_MAX`; atrás de proxy, `TRUST_PROXY` faz o limite usar o
  IP real do cliente.
- **Bloqueio da conta** ([`authService.ts`](../../backend/src/services/authService.ts)): 5 senhas erradas
  seguidas em 15 minutos bloqueiam o login daquele e-mail por 15 minutos, mesmo com a senha certa
  (429). O contador vale também para e-mails inexistentes, para o bloqueio não revelar quais contas
  existem; login certo zera a contagem e a recuperação de senha desfaz o bloqueio.

Os contadores ficam no **Redis** ([`attemptStore.ts`](../../backend/src/utils/attemptStore.ts)), valendo
para todas as instâncias da API; sem Redis, ou se ele cair, ficam na memória do processo, e a API
continua respondendo (o limite falha aberto para não derrubar o serviço).

**Por quê.** O limite por IP corta varreduras e robôs que testam muitas contas; o bloqueio por conta
corta a força bruta distribuída contra uma conta só, que o limite por IP não pega. Os dois juntos
cumprem a Atividade 4 sem depender de WAF.

**Descartados:** `express-rate-limit` com `rate-limit-redis` (duas dependências para um contador de
janela fixa que cabe em poucas linhas e reaproveita o cliente Redis que o projeto já tem); CAPTCHA no
login (atrito para o cidadão e serviço externo no app mobile); bloqueio permanente até ação do admin
(viraria um jeito fácil de negar acesso a qualquer conta conhecida).

---

## 4. Implementado × especificado para produção

| Controle | Situação | Onde |
|---|---|---|
| Hash de senha com bcrypt | ✅ Implementado | `authService.ts` |
| JWT curto + refresh rotativo com detecção de reuso | ✅ Implementado | `authService.ts` |
| Logout por aparelho e revogação geral na troca de senha | ✅ Implementado | `authService.ts` |
| 2FA por código de e-mail (opcional para todos os perfis) | ✅ Implementado | `authService.ts`, `TwoFactorView.tsx` |
| Recuperação de senha com código de validade curta | ✅ Implementado | `authService.ts` |
| Perfil e status relidos do banco a cada requisição; `requireRole` | ✅ Implementado | `authMiddleware.ts`, `requireRole.ts` |
| CORS por lista de origens, obrigatória em produção | ✅ Implementado | `cors.ts`, `env.ts` |
| `JWT_SECRET` obrigatório; `DEMO_MODE` bloqueado em produção | ✅ Implementado | `env.ts` |
| Limite de corpo (100 KB; 15 MB nas fotos) e validação de imagem | ✅ Implementado | `app.ts`, `image.ts` |
| Tokens no SecureStore | ✅ Implementado | `AuthContext.tsx` |
| Aceite versionado dos termos de uso (LGPD) | ✅ Implementado | `acceptTerms`, `TermsGate.tsx` |
| Auditoria de ações administrativas | ✅ Implementado | `auditLogService.ts`, tabelas `audit_logs` e `usuario_audit` |
| Health check e degradação graciosa (Redis, SMTP, push, agente) | ✅ Implementado | `health.ts` |
| Dependências travadas, SBOM (CycloneDX) e `npm audit` no CI | ✅ Implementado | `dependencias.yml` |
| Atualização diária de dependências (Dependabot) | ✅ Implementado | `.github/dependabot.yml` |
| Varredura diária com issue de pendências | ✅ Implementado | `seguranca-diaria.yml` |
| *Rate limiting* por IP: 300 req/min na API e 100 tentativas em 15 min nas rotas de autenticação (Redis, com memória como reserva) | ✅ Implementado | `rateLimit.ts`, `attemptStore.ts` |
| Bloqueio da conta por 15 min após 5 senhas erradas seguidas (também para e-mail inexistente) | ✅ Implementado | `authService.ts` (`login`) |
| Cabeçalhos de segurança com `helmet` (HSTS, `nosniff`, `X-Frame-Options`, CSP) | ✅ Implementado | `security.ts`, `app.ts` |
| HTTPS/TLS 1.2+ na frente da API | ✅ Implementado no deploy | Caddy com Let's Encrypt em [`docs/deploy/`](../deploy/README.md) |
| Backup cifrado (AES-256) do banco e das fotos, com SHA-256 e rotação; restauração testada a cada execução do workflow Docker | ✅ Implementado | [`scripts/backup.sh`](../../scripts/backup.sh), [`scripts/restore.sh`](../../scripts/restore.sh), [`docker.yml`](../../.github/workflows/docker.yml) |
| TOTP obrigatório para Gestor e Admin | 🟡 Especificado | Atividade 1 (hoje: e-mail, opcional) |
| Senha com 8+ caracteres e 4 classes | 🟡 Especificado | Atividade 1 (o backend exige hoje 6+ caracteres) |
| Troca periódica de senha (Gestor 90 dias, Admin 60) | 🟡 Especificado | Atividade 1 |
| Exclusão da conta com anonimização | 🟡 Especificado | Atividade 3, fluxo 5 |
| AES-256 em disco e nos backups; WAF/CDN; réplica do banco | 🟡 Especificado (infraestrutura) | Atividades 2, 4 e 5 |

Os itens 🟡 dependem de infraestrutura de produção ou ficaram como evolução após a entrega final do PI.

---

## 5. Tecnologias de segurança: por que estas e não outras

| Tecnologia | Uso | Por que | Alternativa descartada e motivo |
|---|---|---|---|
| **bcryptjs / bcrypt** | hash de senha | sal + custo ajustável, sem configuração | Argon2 (compilação nativa no CI/Windows), SHA-256 (rápido demais) |
| **jsonwebtoken** | JWT HS256 | padrão de mercado, valida expiração e algoritmo | Passport.js (camada extra sem ganho para uma única estratégia), sessões em cookie com estado no servidor |
| **node:crypto** | CSPRNG, SHA-256, `timingSafeEqual`, UUID | nativo do Node, sem dependências | `Math.random` (não é criptograficamente seguro: a sequência pode ser prevista) |
| **expo-secure-store** | tokens no aparelho | Keystore/Keychain | AsyncStorage (texto puro) |
| **cors** | origens permitidas | configuração declarativa por ambiente | liberar `*` (permite chamadas de qualquer site com credenciais) |
| **Prisma** | acesso ao banco | consultas parametrizadas por padrão | SQL montado à mão (risco de injeção) |
| **GitHub Actions + npm audit** | cadeia de suprimentos | roda em todo PR | auditoria manual esporádica |

---

## 6. Testes que verificam estes controles

A suíte de [Testes Automatizados](../testes-automatizados/README.md) cobre a segurança em três níveis:
testes de API (`auth`, `authMiddleware`, `refreshToken`, `twoFactor`, `passwordReset`, `logout`,
`terms`, `profilePhoto`) e a jornada E2E [`e2e/seguranca.spec.ts`](../../e2e/seguranca.spec.ts)
(acesso sem token, mensagem genérica no login, isolamento entre cidadãos/IDOR, tentativa de se cadastrar como Admin, logout por sessão e upload que não é imagem). O catálogo completo
está em [`TESTES.md`](../testes-automatizados/TESTES.md).

## 7. Verificação contínua (workflow Segurança)

O workflow [`seguranca.yml`](../../.github/workflows/seguranca.yml) roda em todo PR e push em `main`/`dev` e,
pelo [`seguranca-diaria.yml`](../../.github/workflows/seguranca-diaria.yml), todo dia às 07h (vulnerabilidades novas
aparecem sem mudança no código). Ele fica fora do Quality Gate e publica o artefato `relatorio-seguranca`:

| Verificação | Ferramenta | O que procura |
|---|---|---|
| Bibliotecas | `npm audit` | Dependências de backend, app, agente e testes com vulnerabilidade conhecida |
| Segredos | gitleaks | Senhas, chaves e tokens no código atual e em todo o histórico do Git; o valor encontrado nunca é publicado (`--redact`) |
| Código | Semgrep (regras OWASP para JavaScript, TypeScript, React e JWT) | Injeção, criptografia fraca, configuração insegura |
| Controles do projeto | [`controls.mjs`](../../.github/scripts/security/controls.mjs) | Cada controle da seção 4 conferido no código (SEC-01 a SEC-17), com a evidência (arquivo e linha) |

Saídas: `relatorio-seguranca.html`, em linguagem simples e com o que fazer em cada item; `seguranca.xml`,
com todos os achados estruturados; e `seguranca-junit.xml`, em que cada achado grave é um teste que falha.
Detalhes e tratamento de falsos positivos em [`TESTES.md`, seção 2.2](../testes-automatizados/TESTES.md#22-registro-de-falhas-artefatos-e-relatórios-de-qualidade).

**Issue diária de pendências.** Na execução diária, o resultado vira uma única issue (label `segurança`, milestone
de Segurança, atribuída a `victorsimasdev`) com um checklist: o que está errado, o que fazer e onde, para cada
biblioteca vulnerável, segredo, padrão inseguro e controle ausente. O corpo é atualizado todo dia; um comentário
avisa só quando algum item aparece ou é resolvido; a issue fecha sozinha quando não sobra nada. Quando o
`npm audit` sugere uma "correção" que volta um pacote para uma major antiga (ex.: Jest 30 → 25, Expo 58 → 53), a
issue avisa para **não** aplicar e recomenda `overrides` no `package.json` com a versão corrigida da dependência
vulnerável. Script: [`sync-issue.mjs`](../../.github/scripts/security/sync-issue.mjs).

**Por que essas ferramentas:** gitleaks e Semgrep são gratuitos, rodam sem conta nem token e geram JSON que o
relatório consolida. **Descartados:** SonarQube (servidor ou conta externa, regras genéricas de qualidade
misturadas às de segurança), Snyk (conta e token, limite no plano gratuito) e TruffleHog (equivalente ao
gitleaks, com configuração mais pesada para o mesmo resultado).
