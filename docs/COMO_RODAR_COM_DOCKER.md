# Como rodar o Fiscalize com Docker

Este guia sobe o **backend completo** (PostgreSQL, Redis, API e, opcionalmente, o agente de IA) em
containers com um único comando, e liga o app mobile a ele. Para rodar sem Docker, veja
[`backend/COMO_RODAR_O_BACK.md`](../backend/COMO_RODAR_O_BACK.md).

---

## 1. O que roda em container (e o que não roda)

```
 Seu computador
 ┌──────────────────────────────── docker compose (rede interna "fiscalize") ───────────────────────┐
 │                                                                                                   │
 │  postgres:16 ◀──── backend (Node 22) ────▶ redis:7          ai-agent (perfil "ai")                │
 │  :5432               :3000  │   ▲            :6379            :3333 (sem porta no host)          │
 │  volume pgdata               │   └──── POST /chat ──────────────┘   ──▶ Google Gemini (internet)  │
 │                    volume uploads (fotos)                                                         │
 └────────────────────────────────┬──────────────────────────────────────────────────────────────────┘
                                  │ http://SEU_IP:3000
              App mobile (Expo Go no celular ou emulador), rodando FORA do Docker
```

| Serviço | Imagem | Porta no seu computador | Para quê |
|---|---|---|---|
| `postgres` | `postgres:16` | `5432` | Banco de dados (dados em um volume, sobrevivem a reinícios) |
| `redis` | `redis:7` | `6379` | Cache de métricas |
| `backend` | construída de [`backend/Dockerfile`](../backend/Dockerfile) | `3000` | API REST; na subida aplica as migrações e roda o seed |
| `ai-agent` | construída de [`ai-agent/Dockerfile`](../ai-agent/Dockerfile) | nenhuma (só rede interna) | Assistente de IA; só sobe com `--profile ai` |

**O app mobile não roda em Docker.** O Metro do Expo e o emulador Android precisam de acesso direto à
rede local, ao USB e à aceleração de hardware do computador; dentro de um container isso fica lento e
frágil. O app roda normalmente na sua máquina e conversa com a API do container pela porta 3000.

---

## 2. Instalar e configurar o Docker

### Windows 10/11

1. Habilite o **WSL 2**: abra o PowerShell **como administrador** e rode `wsl --install`. Reinicie.
2. Instale o **Docker Desktop**: <https://www.docker.com/products/docker-desktop/>. No instalador, deixe
   marcado **Use WSL 2 instead of Hyper-V**.
3. Abra o Docker Desktop e espere o indicador ficar verde (*Engine running*).
4. Recomendado: em **Settings → Resources → WSL integration**, ative a integração com a sua distribuição
   Linux, se usar uma; em **Settings → General**, marque *Start Docker Desktop when you sign in*.

> Se o Docker Desktop reclamar de virtualização, ative **Intel VT-x / AMD-V (SVM)** na BIOS.

### macOS

Instale o **Docker Desktop** (escolha o pacote Apple Silicon ou Intel) e abra o aplicativo.
Alternativa: `brew install --cask docker`.

### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://get.docker.com | sh
```

```bash
sudo usermod -aG docker $USER
```

Saia da sessão e entre de novo para o grupo `docker` valer (assim não é preciso `sudo` em cada comando).
O script já instala o plugin `docker compose`.

### Conferir a instalação

```bash
docker --version
```

```bash
docker compose version
```

```bash
docker run --rm hello-world
```

O último comando deve imprimir *Hello from Docker!*. O projeto usa o **Compose v2** (`docker compose`,
com espaço); o antigo `docker-compose` não é necessário.

---

## 3. Subir o projeto

Na **raiz** do repositório:

### 3.1 Criar o `.env` da raiz (opcional, mas recomendado)

```bash
cp .env.example .env
```

No Windows (PowerShell): `Copy-Item .env.example .env`.

Sem esse arquivo tudo funciona com os valores padrão; com ele você troca senhas, portas e liga o
agente de IA. Troque ao menos o `JWT_SECRET`.

### 3.2 Subir

```bash
docker compose up -d --build
```

Na primeira vez o Docker baixa as imagens e instala as dependências (alguns minutos). Depois:

1. o `postgres` e o `redis` sobem e passam no *healthcheck*;
2. o `backend` aplica as migrações (`prisma migrate deploy`), roda o seed (categorias, órgãos, regras e
   usuários de teste; pode rodar de novo sem duplicar) e inicia a API.

Acompanhe até aparecer `[Server] Running on port 3000`:

```bash
docker compose logs -f backend
```

### 3.3 Conferir

```bash
docker compose ps
```

Todos devem estar `running` e o backend `healthy`. Abra no navegador:

- <http://localhost:3000/health>: deve responder `"status":"ok"`, `"database":"connected"` e `"redis":"connected"`;
- <http://localhost:3000/docs>: Swagger da API.

Usuários do seed: `cidadao@fiscalize.gov.br` / `Cidadao@123456`, `gestor@fiscalize.gov.br` /
`Gestor@123456` e `admin@fiscalize.gov.br` / o valor de `SEED_ADMIN_PASSWORD` (padrão `Admin@123456`).

### 3.4 Com o assistente de IA

1. Crie uma chave em <https://aistudio.google.com/apikey> e coloque em `GEMINI_API_KEY` no `.env` da raiz.
2. Defina também um `AI_AGENT_SECRET` (qualquer texto longo): o backend passa a enviá-lo e o agente
   recusa chamadas sem ele.
3. Suba com o perfil `ai`:

```bash
docker compose --profile ai up -d --build
```

Sem a chave, o container do agente encerra com a mensagem `GEMINI_API_KEY não configurada`; o resto
do sistema continua funcionando e só o chat do app responde que o assistente está indisponível.

---

## 4. Variáveis de ambiente

O `compose.yaml` lê o `.env` **da raiz** (modelo em [`.env.example`](../.env.example)). Os containers não
usam o `backend/.env` nem o `ai-agent/.env`: esses servem só para rodar sem Docker.

| Variável | Padrão | Para quê |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `fiscalize` | Credenciais do banco (definidas na **primeira** criação do volume) |
| `POSTGRES_PORT` / `REDIS_PORT` / `BACKEND_PORT` | `5432` / `6379` / `3000` | Portas publicadas no seu computador |
| `JWT_SECRET` | valor fixo de desenvolvimento | Chave dos tokens; troque sempre |
| `NODE_ENV` | `development` | Com `production`, `ALLOWED_ORIGINS` passa a ser obrigatória |
| `DEMO_MODE` | `false` | Devolve o código do 2FA na resposta do login (útil em apresentações) |
| `SEED_ON_START` | `true` | Roda o seed a cada subida do backend |
| `SEED_ADMIN_PASSWORD` | `Admin@123456` | Senha do admin criado pelo seed |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | vazio | E-mails reais; sem SMTP, os códigos aparecem em `docker compose logs backend` |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_RPM` | vazio, `gemini-3.1-flash-lite`, `15` | Agente de IA |
| `AI_AGENT_SECRET` | vazio | Segredo compartilhado entre backend e agente |

Depois de mudar o `.env`, recrie os containers: `docker compose up -d`.

> Trocar `POSTGRES_PASSWORD` depois que o volume já existe **não** muda a senha do banco: o PostgreSQL
> só lê essas variáveis na criação. Para recomeçar do zero, veja a seção 6.

---

## 5. Ligar o app mobile ao backend do Docker

1. Instale e rode o app como de costume (em outro terminal):

   ```bash
   cd mobile
   npm install
   npx expo start
   ```

2. O app descobre sozinho o IP do computador que roda o Expo e usa a porta 3000, que o Docker publica.
   No emulador Android ele usa `10.0.2.2:3000`. Nada mais a configurar.
3. Se mudou `BACKEND_PORT` ou o celular não alcança a API, defina a URL em `mobile/.env`:

   ```env
   EXPO_PUBLIC_API_URL=http://SEU_IP:3000
   ```

   Descubra o IP com `ipconfig` (Windows) ou `ip addr` / `ifconfig` (Linux/macOS).

> **Windows:** na primeira vez, o Firewall pode perguntar se o Docker Desktop pode receber conexões da
> rede. Permita em **redes privadas**, senão o celular não alcança a porta 3000.

---

## 6. Comandos do dia a dia

| Tarefa | Comando |
|---|---|
| Subir (reconstruindo se o código mudou) | `docker compose up -d --build` |
| Ver o estado | `docker compose ps` |
| Ver logs | `docker compose logs -f backend` |
| Parar sem apagar nada | `docker compose stop` |
| Parar e remover os containers (dados ficam nos volumes) | `docker compose down` |
| **Apagar tudo, inclusive banco e fotos** | `docker compose down -v` |
| Rodar o seed manualmente | `docker compose exec backend npm run seed` |
| Rodar o ETL de métricas uma vez | `docker compose exec backend npm run etl` |
| Abrir o `psql` | `docker compose exec postgres psql -U fiscalize -d fiscalize` |
| Abrir o Redis | `docker compose exec redis redis-cli` |
| Shell dentro do backend | `docker compose exec backend sh` |
| Subir só banco e Redis (backend rodando com `npm run dev`) | `docker compose up -d postgres redis` |

**Modo híbrido (recomendado para quem está programando o backend):** suba só `postgres` e `redis` no
Docker e rode a API na máquina com `npm run dev`, que recarrega a cada alteração. No `backend/.env`:

```env
DATABASE_URL="postgresql://fiscalize:fiscalize@localhost:5432/fiscalize?schema=public"
REDIS_URL="redis://localhost:6379"
```

Ferramentas como **Prisma Studio** (`npx prisma studio`, em `backend/`), DBeaver ou pgAdmin conectam
em `localhost:5432` com as mesmas credenciais.

---

## 7. Rodar os testes contra o Docker

Os testes unitários e de API não precisam de banco. Os **E2E do Playwright** rodam contra a API do
container (ela já está com migrações e seed). Na raiz:

```bash
npm install
npm run test:e2e
```

O Playwright usa `http://localhost:3000` e reaproveita o backend que já está no ar. Se mudou a porta:
`E2E_API_URL=http://localhost:3001 npm run test:e2e`.

---

## 8. Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `failed to bind host port 0.0.0.0:5432: address already in use` | Um PostgreSQL instalado na máquina (ou outro container) usa a porta | Pare o outro serviço ou mude `POSTGRES_PORT=5433` no `.env` da raiz. O mesmo vale para `6379` e `3000` |
| `Cannot connect to the Docker daemon` / `error during connect` | Docker Desktop fechado ou ainda iniciando | Abra o Docker Desktop e espere *Engine running* |
| `WSL 2 installation is incomplete` | WSL desatualizado | `wsl --update` no PowerShell como administrador e reinicie o Docker Desktop |
| Backend reinicia em loop com `P1000: Authentication failed` | O volume `pgdata` foi criado com outra senha | `docker compose down -v` e suba de novo (apaga os dados) ou volte a senha antiga no `.env` |
| `/health` responde `"redis":"unavailable"` | Redis ainda subindo ou parado | `docker compose up -d redis`; a API funciona sem ele, só sem cache |
| Mudei o código e nada mudou | A imagem é construída uma vez | `docker compose up -d --build` |
| O app no celular não conecta | Firewall, rede Wi-Fi diferente ou URL errada | Seção 5 |
| `ai-agent` sai com `GEMINI_API_KEY não configurada` | Chave ausente no `.env` da raiz | Seção 3.4 |
| Chat responde "assistente indisponível" com o agente no ar | `AI_AGENT_SECRET` diferente entre os serviços ou agente reiniciando | Confira `docker compose logs ai-agent`; os dois leem o mesmo `.env`, então basta recriar: `docker compose --profile ai up -d` |
| Build lento ou sem espaço em disco | Imagens e camadas antigas acumuladas | `docker system prune` (remove o que não está em uso) |

---

## 9. Por que Docker Compose (e não outra coisa)

- **Por que usar:** um comando sobe o mesmo ambiente em Windows, macOS e Linux, com as mesmas versões
  do CI (PostgreSQL 16, Redis 7, Node 22). Acabam os erros de "funciona na minha máquina", de porta
  ocupada por instalações antigas e de extensão do PostgreSQL faltando; e resetar o banco é apagar um volume.
- **Descartados:**
  - **Instalar PostgreSQL e Redis na máquina:** cada integrante com uma versão e configuração; o Redis
    nem tem versão oficial para Windows. Continua possível ([guia sem Docker](../backend/COMO_RODAR_O_BACK.md)).
  - **Kubernetes (minikube, kind):** pensado para orquestrar muitos serviços em vários servidores; para
    quatro containers numa máquina de desenvolvimento, é complexidade sem ganho.
  - **Podman:** compatível, mas a equipe já usa Docker Desktop e o `podman compose` tem diferenças
    pequenas de comportamento que gerariam suporte extra.

### Diferenças para um ambiente de produção

Este compose é para **desenvolvimento e demonstração**. Em produção (ver
[Segurança › Atividade 4](seguranca-da-informacao/04_Disponibilidade_e_Protecao_contra_Ataques.md)):
`NODE_ENV=production` com `ALLOWED_ORIGINS`, `JWT_SECRET` e senhas fortes vindas de um cofre de segredos,
banco gerenciado com backup e réplica em vez do container `postgres`, HTTPS na frente da API, fotos em
armazenamento de objetos, `SEED_ON_START=false` e sem publicar as portas do banco e do Redis.
