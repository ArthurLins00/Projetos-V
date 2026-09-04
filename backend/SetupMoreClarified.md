# Setup do Banco de Dados — Fiscalize (Backend)

Este documento complementa o README original do projeto, especificamente o **passo 5) Criar o arquivo de variáveis de ambiente**. A ideia aqui não é só listar comandos, mas explicar **por que** cada problema acontece — porque durante o setup real do projeto, vários erros apareceram nessa etapa, e entender a causa evita perder tempo da próxima vez (seja você mesmo reinstalando o projeto em outra máquina, ou um colega de equipe configurando pela primeira vez).

> ⚠️ **Nota de segurança:** os exemplos abaixo usam placeholders como `<usuario>`, `<senha>` e `<nome_do_banco>`. **Nunca** substitua esses placeholders por valores reais diretamente neste documento ou em qualquer arquivo versionado no Git — as credenciais reais devem existir **apenas** no seu arquivo `.env` local (que já está no `.gitignore`). Sempre que este guia mencionar usuário/senha/banco, consulte o que está definido no `.env.example` ou no `.env` do seu ambiente.

Existem duas formas de ter um PostgreSQL rodando localmente: **via Docker** (recomendado, e o caminho que usamos neste projeto) ou **instalado diretamente no sistema operacional**. Vamos cobrir as duas, com instruções para **Linux/macOS** e **Windows**.

---

## Opção A — PostgreSQL via Docker (recomendado)

Essa é a abordagem usada neste projeto. A vantagem é isolar o banco em um container, sem depender de nada instalado na máquina, e sem correr o risco de misturar versões/configurações de outros projetos. **O Docker funciona igual em qualquer sistema operacional** (Linux, macOS ou Windows com Docker Desktop) — os comandos `docker run`, `docker ps`, `docker exec` etc. são idênticos. As diferenças aparecem apenas ao verificar portas e serviços nativos do sistema, que vamos indicar separadamente abaixo.

> **Pré-requisito no Windows:** instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/) e certifique-se de que o WSL2 está habilitado (o próprio instalador guia por esse processo). Todos os comandos `docker` abaixo podem ser rodados no **PowerShell**, **CMD** ou no terminal integrado do VS Code.

### Passo 1 — Verifique se a porta 5432 já está em uso

Antes de subir o container, é importante confirmar que a porta 5432 (porta padrão do Postgres) está livre. Isso é fácil de esquecer, e foi justamente o **primeiro erro** que apareceu no setup deste projeto:

```
docker: Error response from daemon: failed to set up container networking:
failed to bind host port 0.0.0.0:5432/tcp: address already in use
```

**Por que isso acontece:** o Docker mapeia a porta do container para uma porta do seu computador (o "host"). Se já existe _qualquer outro processo_ — outro container Docker, ou até um Postgres instalado nativamente no seu sistema — escutando na 5432, o Docker não consegue reservar essa porta de novo, e o container falha ao subir (mesmo que ele apareça criado com `docker ps -a`, ele nunca chega a rodar de fato).

**Linux/macOS** — para descobrir quem está usando a porta:

```bash
sudo lsof -i :5432
```

**Windows** (PowerShell) — o equivalente é:

```powershell
netstat -ano | findstr :5432
```

Isso retorna uma linha com o PID (último número) do processo usando a porta. Para descobrir qual programa é esse PID:

```powershell
tasklist /FI "PID eq <numero_do_pid>"
```

No caso deste projeto (ambiente Linux), o resultado mostrou um processo `postgres` rodando via `systemd` — ou seja, **um Postgres instalado direto no sistema**, não relacionado ao Docker:

```
COMMAND   PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
postgres 1499 postgres    6u  IPv4   5879      0t0  TCP localhost:postgresql (LISTEN)
```

Se você tiver a mesma situação (Postgres nativo instalado, mas você quer usar o do Docker), pare o serviço nativo:

**Linux:**

```bash
sudo systemctl daemon-reload
sudo systemctl stop postgresql
```

> 💡 O `daemon-reload` só é necessário se o sistema avisar que "o arquivo de unidade mudou no disco" — é um aviso inofensivo do `systemd`, mas vale rodar por precaução.

**macOS** (se instalado via Homebrew):

```bash
brew services stop postgresql
```

**Windows:**
Abra o **Serviços** (pesquise "Services" ou "Serviços" no menu Iniciar), procure por `postgresql-x64-XX` na lista, clique com o botão direito e selecione **Parar**. Ou, via PowerShell como administrador:

```powershell
net stop postgresql-x64-16
```

(o nome exato do serviço pode variar conforme a versão instalada — confira em Serviços caso o comando não encontre o nome).

Se quiser evitar que esse conflito aconteça de novo toda vez que reiniciar o computador (ou seja, impedir que o Postgres nativo suba sozinho no boot):

**Linux:**

```bash
sudo systemctl disable postgresql
```

**Windows:** no mesmo painel de Serviços, clique com o botão direito no serviço → Propriedades → mude "Tipo de inicialização" para **Manual** ou **Desabilitado**.

⚠️ **Atenção:** isso só faz sentido se você não usa esse Postgres nativo para mais nada. Se outro projeto seu depende dele, considere a alternativa de simplesmente subir o container Docker em **outra porta** (ex: `5433` ou `5434`), evitando o conflito sem desligar nada — funciona igual em qualquer sistema:

```bash
docker run --name fiscalize-postgres \
  -e POSTGRES_USER=<usuario> \
  -e POSTGRES_PASSWORD=<senha> \
  -e POSTGRES_DB=<nome_do_banco> \
  -p 5434:5432 \
  -d postgres:16
```

> Use os mesmos valores de `<usuario>`, `<senha>` e `<nome_do_banco>` definidos no seu `.env` (veja o Passo 4).

Nesse caso, lembre-se de ajustar a porta na `DATABASE_URL` do `.env` também.

### Passo 2 — Subir o container

Com a porta livre, suba o container (comando idêntico em Linux, macOS e Windows):

```bash
docker run --name fiscalize-postgres \
  -e POSTGRES_USER=<usuario> \
  -e POSTGRES_PASSWORD=<senha> \
  -e POSTGRES_DB=<nome_do_banco> \
  -p 5432:5432 \
  -d postgres:16
```

> Novamente: substitua `<usuario>`, `<senha>` e `<nome_do_banco>` pelos valores do seu `.env` local — nunca cole a senha real em documentação ou em commits.

Confirme que está rodando:

```bash
docker ps
```

Você deve ver `fiscalize-postgres` com status `Up` e a porta `0.0.0.0:5432->5432/tcp`.

> 💡 **Outro erro comum nessa etapa:** se você tentar rodar o `docker run` de novo (por engano, ou repetindo um comando antigo) com o mesmo `--name`, vai receber:
>
> ```
> Error response from daemon: Conflict. The container name "/fiscalize-postgres" is already in use by container "..."
> ```
>
> Isso significa que o container já existe (rodando ou parado). Se ele já estiver rodando, não precisa rodar `docker run` de novo — o comando **só é necessário uma vez**; nas próximas vezes, você só precisa garantir que o container está ativo com `docker start fiscalize-postgres`. Se quiser recriar do zero, remova o antigo primeiro: `docker rm fiscalize-postgres` (ou `docker rm -f fiscalize-postgres` se ele ainda estiver rodando).

### Passo 3 — Habilitar a extensão `uuid-ossp`

Esse é um erro que só aparece mais à frente, quando você já tentou aplicar o schema do Prisma no banco (`prisma db push`):

```
Error: ERROR: function uuid_generate_v4() does not exist
HINT: No function matches the given name and argument types.
```

**Por que isso acontece:** o schema do Prisma usa a função `uuid_generate_v4()` para gerar IDs únicos automaticamente. Essa função não faz parte do PostgreSQL "puro" — ela vem de uma extensão chamada `uuid-ossp`, que precisa ser habilitada manualmente em cada banco novo. Como o container acabou de ser criado, o banco está "limpo" e essa extensão ainda não foi ativada.

Para resolver, entre no banco (dentro do próprio container) e habilite a extensão — comando idêntico em qualquer sistema operacional, já que roda dentro do container Linux (substitua `<usuario>` e `<nome_do_banco>` pelos valores do seu `.env`):

```bash
docker exec -it fiscalize-postgres psql -U <usuario> -d <nome_do_banco> -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

> No Windows, se estiver usando PowerShell, as aspas simples internas podem dar problema dependendo do terminal. Se o comando acima falhar, entre no `psql` interativo e rode o comando lá dentro:
>
> ```bash
> docker exec -it fiscalize-postgres psql -U <usuario> -d <nome_do_banco>
> ```
>
> ```sql
> CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
> \q
> ```

Isso só precisa ser feito **uma vez por banco** (não por sessão, nem por deploy — fica salvo no próprio banco).

### Passo 4 — Criar o arquivo `.env` ⚠️ (não esqueça este passo!)

Esse foi o ponto que gerou mais confusão no setup: o README menciona **criar** o `.env`, mas o repositório só traz um `.env.example` como modelo. O `dotenv` (biblioteca que lê variáveis de ambiente de arquivo) **só reconhece um arquivo chamado exatamente `.env`** — ele nunca lê o `.env.example` automaticamente, mesmo que o conteúdo seja idêntico.

Então, dentro da pasta `backend/`, o primeiro passo real é copiar o arquivo:

**Linux/macOS:**

```bash
cp .env.example .env
```

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**Windows (CMD):**

```cmd
copy .env.example .env
```

Depois, abra o `.env` recém-criado e confirme (ou ajuste) a linha da `DATABASE_URL`, seguindo o formato:

```
DATABASE_URL="postgresql://<usuario>:<senha>@localhost:<porta>/<nome_do_banco>?schema=public"
```

**Pontos de atenção nessa URL:**

- `<usuario>` e `<senha>` → devem ser os mesmos valores definidos no `docker run` (`POSTGRES_USER` e `POSTGRES_PASSWORD`). **Nunca compartilhe esses valores fora do seu `.env` local.**
- `<porta>` → precisa ser **exatamente a porta que você mapeou no `-p` do `docker run`** (geralmente `5432`, ou outra caso tenha havido conflito, como no Passo 1). É um erro fácil de cometer, pois a "porta interna" do container sempre continua sendo 5432, só a porta exposta no seu computador muda.
- `<nome_do_banco>` → deve bater com `POSTGRES_DB`.

O restante do `.env` (JWT, PORT, FRONTEND_URL etc.) normalmente já vem correto no `.env.example` e não precisa de ajuste para rodar localmente.

### Passo 5 — Aplicar o schema no banco

```bash
npx prisma generate
npx prisma db push
```

(idêntico em qualquer sistema operacional, já que roda via Node.js)

O `prisma generate` cria o client do Prisma (código TypeScript usado pela aplicação para falar com o banco) e **não depende de conexão com o banco** — por isso ele pode funcionar mesmo se a `DATABASE_URL` estiver errada.

Já o `db push` **precisa conectar de fato**, e é aqui que aparece o erro mais confuso do processo:

```
Error: The datasource.url property is required in your Prisma config file when using prisma db push.
```

**Por que isso acontece:** a partir do Prisma 7, a URL de conexão não é mais lida diretamente do `schema.prisma` — ela vem do arquivo `prisma.config.ts`, que por sua vez depende de `process.env.DATABASE_URL` estar definida _no momento em que o comando roda_. Se o `.env` não existir (Passo 4) ou não estiver sendo carregado corretamente, essa variável chega vazia, e o Prisma recusa continuar.

Para isolar se o problema é a variável em si ou o carregamento do `.env`, um bom teste é forçar a variável direto na linha de comando (use o valor exato que está no seu `.env`, e tome cuidado para não deixar esse comando salvo em nenhum histórico compartilhado):

**Linux/macOS:**

```bash
DATABASE_URL="<valor_do_seu_.env>" npx prisma db push
```

**Windows (PowerShell):**

```powershell
$env:DATABASE_URL="<valor_do_seu_.env>"; npx prisma db push
```

Se isso funcionar, o problema era o `.env` (resolvido no Passo 4). Se der o mesmo erro, vale conferir se o pacote `dotenv` está instalado:

```bash
npm ls dotenv
```

Se não aparecer, instale:

```bash
npm install dotenv
```

Ao rodar `db push`, é normal aparecer um aviso como este, especialmente se for a primeira vez aplicando o schema:

```
⚠️ There might be data loss when applying the changes:
  • A unique constraint covering the columns [nome] on the table categoria will be added.
```

Isso significa que o Prisma vai criar uma regra de unicidade em uma coluna, e quer confirmar que não existem valores duplicados que quebrariam essa regra. Em um banco novo/vazio (como é o caso ao configurar o projeto pela primeira vez), é seguro confirmar com `y`.

### Passo 6 — Rodar a aplicação

```bash
npm run dev
```

Se tudo estiver certo, a saída deve ser parecida com:

```
[Server] Running on port 3000
[Server] NODE_ENV=development
[Server] Health check: http://localhost:3000/health
[Server] API docs (Swagger): http://localhost:3000/docs
```

**Erro comum nessa etapa**, mesmo com o `db push` já tendo funcionado antes:

```
Error: Missing required environment variable: DATABASE_URL
    at Object.<anonymous> (src/config/prisma.ts:9:9)
```

**Por que isso acontece:** existe uma pegadinha importante aqui. O arquivo `prisma.config.ts` (que carrega o `.env` via `import "dotenv/config"`) é lido **somente pelo Prisma CLI** — comandos como `prisma db push`, `prisma generate`, `prisma studio`. Ele **não tem nenhuma relação** com a sua aplicação Express rodando via `npm run dev` / `ts-node-dev src/server.ts`. São dois processos completamente separados, cada um precisa carregar o `.env` por conta própria.

Ou seja: mesmo com o `prisma.config.ts` correto, se o `src/server.ts` da sua aplicação não importar o `dotenv` explicitamente, os arquivos que leem `process.env.DATABASE_URL` no topo do código (como `src/config/prisma.ts` ou `src/config/env.ts`) vão executar **antes** de qualquer variável de ambiente existir.

Isso também tem uma pegadinha de ordem: colocar `import 'dotenv/config'` no arquivo, mas **não na primeira linha**, não resolve — porque o JavaScript/TypeScript executa os imports na ordem em que aparecem no arquivo. Se `./config/prisma` for importado antes de `dotenv/config`, o `.env` ainda não foi carregado quando esse módulo tenta ler a variável.

A solução é garantir que `import 'dotenv/config';` seja a **primeira linha do arquivo de entrada** (`src/server.ts`), antes de qualquer outro import:

```typescript
import "dotenv/config";
import express from "express";
// ...demais imports
```

---

## Opção B — PostgreSQL instalado diretamente no sistema (sem Docker)

Se preferir não usar Docker, também é possível instalar o PostgreSQL nativamente. O fluxo é parecido, mas com algumas diferenças por sistema operacional.

### Instalação

**Linux (Ubuntu/Debian):**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

O serviço já sobe automaticamente após a instalação e fica escutando na porta 5432.

**macOS (via Homebrew):**

```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows:**
Baixe o instalador oficial em [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) e execute-o. Durante a instalação:

- Defina a senha do usuário `postgres` (guarde-a apenas no seu `.env` local, nunca em texto compartilhado).
- Mantenha a porta padrão `5432`.
- O instalador (Stack Builder) pode oferecer extensões adicionais — não é necessário marcar nada extra para este projeto.
- Ao final, o PostgreSQL já fica rodando como um serviço do Windows (visível em **Serviços**) e inicia automaticamente com o sistema.

### Criar o usuário e o banco

**Linux/macOS:**

```bash
sudo -u postgres psql
```

**Windows:**
Abra o **SQL Shell (psql)**, instalado junto com o PostgreSQL (procure no menu Iniciar). Ele vai pedir host, porta, usuário e banco — pode aceitar os padrões (Enter) até pedir a senha definida na instalação.

Dentro do prompt do `psql` (igual em qualquer sistema), substitua `<senha>` e `<nome_do_banco>` pelos valores que você vai colocar no seu `.env`:

```sql
ALTER USER postgres WITH PASSWORD '<senha>';
CREATE DATABASE "<nome_do_banco>";
\q
```

### Habilitar a extensão uuid-ossp

**Linux/macOS:**

```bash
sudo -u postgres psql -d <nome_do_banco> -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

**Windows:** abra o SQL Shell (psql), conecte no banco criado e rode:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### `.env`

A `DATABASE_URL` segue o mesmo formato em qualquer sistema, já que a porta padrão (5432) é a mesma:

```
DATABASE_URL="postgresql://<usuario>:<senha>@localhost:5432/<nome_do_banco>?schema=public"
```

**Vantagens dessa abordagem:** não depende de ter o Docker instalado, e o Postgres já fica disponível permanentemente (inicia junto com o sistema).

**Desvantagens:** fica mais difícil isolar versões diferentes de Postgres entre projetos, "suja" o sistema operacional com um serviço rodando em segundo plano, e é mais trabalhoso resetar o banco do zero (com Docker, basta `docker rm` e recriar o container).

> Por essas razões, o time optou pela **Opção A (Docker)** neste projeto — mas ambas funcionam igualmente bem para desenvolvimento local, em qualquer sistema operacional.

---

## Checklist rápido de troubleshooting

| Sintoma                                               | Onde aparece                      | Causa                                                   | Solução                                                |
| ----------------------------------------------------- | --------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `address already in use :5432`                        | `docker run`                      | Porta ocupada por outro Postgres (Docker ou nativo)     | `lsof`/`netstat` → parar o serviço ou usar outra porta |
| `Conflict. The container name ... already in use`     | `docker run`                      | Container já existe                                     | `docker rm fiscalize-postgres` antes de recriar        |
| `uuid_generate_v4() does not exist`                   | `prisma db push`                  | Extensão não habilitada no banco                        | `CREATE EXTENSION "uuid-ossp"`                         |
| `.env` não é reconhecido                              | qualquer comando que lê variáveis | Só existe `.env.example`                                | Copiar para `.env` (`cp`/`Copy-Item`/`copy`)           |
| `datasource.url property is required`                 | `prisma db push`                  | `.env` não carregado pelo Prisma CLI                    | Conferir `prisma.config.ts` e a existência do `.env`   |
| `Missing required environment variable: DATABASE_URL` | `npm run dev`                     | `dotenv/config` ausente ou fora de ordem no `server.ts` | Import no topo do arquivo, antes de tudo               |
