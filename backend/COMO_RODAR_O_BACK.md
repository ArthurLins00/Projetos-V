# Como rodar o backend

Guia único de configuração do backend sem Docker para a API. Para subir **tudo em containers**
(PostgreSQL, Redis, backend e agente de IA) com um comando, use o
[guia do Docker](../docs/COMO_RODAR_COM_DOCKER.md).

## 1. Requisitos

- **Node.js 22** (mesma versão do CI) com npm.
- **PostgreSQL 16**: via Docker (recomendado) ou instalado no sistema.
- Opcional: **Redis 7**, para o cache de métricas. Sem ele a API funciona e só calcula as métricas sem cache.

> **Windows:** clone o repositório num caminho curto e sem acentos (ex.: `C:\dev\Projetos-V`).

## 2. Instalar as dependências

```bash
cd backend
npm install
```

## 3. Subir o PostgreSQL

### Opção A: Docker (recomendado)

Na **raiz** do repositório, suba só o banco e o Redis do `compose.yaml`:

```bash
docker compose up -d postgres redis
```

Usuário, senha e banco padrão: `fiscalize` / `fiscalize` / `fiscalize`, na porta `5432`. Para trocar,
veja o [guia do Docker](../docs/COMO_RODAR_COM_DOCKER.md#4-variáveis-de-ambiente).

### Opção B: PostgreSQL instalado no sistema

- **Linux (Ubuntu/Debian):** `sudo apt install postgresql postgresql-contrib`
- **macOS:** `brew install postgresql@16 && brew services start postgresql@16`
- **Windows:** instalador oficial em <https://www.postgresql.org/download/windows/> (porta 5432).

Crie o usuário e o banco no `psql` (Linux/macOS: `sudo -u postgres psql`; Windows: *SQL Shell (psql)*):

```sql
CREATE USER fiscalize WITH PASSWORD 'fiscalize';
CREATE DATABASE fiscalize OWNER fiscalize;
\q
```

A extensão `uuid-ossp` é criada pela primeira migração, não é preciso habilitá-la à mão.

## 4. Criar o `.env`

O `dotenv` só lê um arquivo chamado exatamente `.env`. Copie o modelo:

```bash
cp .env.example .env
```

No Windows (PowerShell): `Copy-Item .env.example .env`.

Confira a `DATABASE_URL` (usuário, senha, **porta** e banco iguais aos do passo 3) e defina um
`JWT_SECRET`; sem ele o servidor não sobe. Com o Redis do Docker, descomente `REDIS_URL`. Todas as
variáveis estão em [`README.md` › Variáveis de ambiente](README.md#variáveis-de-ambiente).

> Nunca versione o `.env`: ele já está no `.gitignore`.

## 5. Criar as tabelas e popular o banco

```bash
npx prisma generate
npx prisma migrate deploy
npm run seed
```

- `prisma generate` gera o cliente tipado do Prisma (não precisa de banco).
- `prisma migrate deploy` aplica as migrações de `prisma/migrations`.
- `npm run seed` cria categorias, órgãos, regras de competência e os usuários de teste. Pode ser
  rodado de novo sem duplicar dados.

Para **criar uma migração nova** depois de alterar o `schema.prisma`: `npx prisma migrate dev --name descricao`.

## 6. Rodar

```bash
npm run dev
```

A API sobe em `http://localhost:3000`, com health check em `/health` e Swagger em `/docs`.
Usuários do seed: `cidadao@fiscalize.gov.br` / `Cidadao@123456`, `gestor@fiscalize.gov.br` /
`Gestor@123456` e `admin@fiscalize.gov.br` / `Admin@123456`.

Para testar as rotas, use o Swagger (`/docs`): faça login em `POST /auth/login`, copie o `token` da
resposta e clique em **Authorize** (`Bearer <token>`).

Comandos úteis:

| Comando | O que faz |
|---|---|
| `npm run dev:demo` | Sobe em modo de demonstração (código do 2FA na resposta do login) |
| `npm run etl` | Roda o pipeline ETL de métricas uma vez |
| `npx prisma studio` | Abre uma interface web para ver e editar os dados |
| `npm run build && npm start` | Compila para `dist/` e roda a versão compilada |

## 7. Testes

Os testes do backend não precisam de banco (o Prisma é mockado):

```bash
npm test
```

```bash
npm run test:unit
```

```bash
npm run test:api
```

Os E2E (Playwright e Maestro) ficam na raiz do repositório; veja
[`docs/testes-automatizados/TESTES.md`](../docs/testes-automatizados/TESTES.md).

## 8. Problemas comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `address already in use :5432` ao subir o container | Outro PostgreSQL (nativo ou outro container) já usa a porta | Pare o outro serviço (Windows: `netstat -ano \| findstr :5432`; Linux/macOS: `sudo lsof -i :5432`) ou use outra porta (`POSTGRES_PORT=5433` no `.env` da raiz) e ajuste a `DATABASE_URL` |
| `Missing required environment variable: DATABASE_URL` ou `JWT_SECRET` | Não existe `backend/.env`, ou a variável está vazia | Passo 4 |
| `datasource.url property is required` no Prisma | O Prisma CLI lê a URL pelo `prisma.config.ts`, que depende do `.env` | Rode os comandos dentro de `backend/` com o `.env` criado |
| `function uuid_generate_v4() does not exist` | Banco criado com `prisma db push` em vez das migrações | Use `npx prisma migrate deploy` (a primeira migração cria a extensão) |
| `P1000: Authentication failed` | Usuário ou senha da `DATABASE_URL` diferentes dos do banco | Ajuste o `.env` |
| `ERRO: a porta 3000 já está em uso` | Outro `npm run dev` (ou o backend do Docker) já está rodando | Encerre o outro processo ou pare o container: `docker compose stop backend` |
| O celular não alcança a API | Firewall do Windows bloqueando a porta 3000 ou rede diferente | Libere a porta 3000 no firewall e use a mesma rede Wi-Fi |
