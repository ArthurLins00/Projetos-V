# Como rodar o projeto

Este guia usa Docker para o PostgreSQL, Prisma para criar as tabelas, o backend Express na porta 3000 e o mobile Expo.

## 1. Requisitos

Instale:

- Node.js 22.14.0 (recomendado pelo backend)
- Docker Desktop
- Android Studio, caso use o emulador Android
- Expo Go, caso use um celular fisico

Verifique as instalacoes:

```powershell
node --version
npm.cmd --version
docker --version
```

No PowerShell, use `npm.cmd` e `npx.cmd` caso a politica de execucao bloqueie `npm.ps1`.

## 2. Iniciar o PostgreSQL pelo Docker

Abra o Docker Desktop e aguarde ele ficar pronto. Depois execute:

```powershell
docker start fiscalize-postgres
```

Se o container ainda nao existir, crie-o:

```powershell
docker run --name fiscalize-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=BacoExu `
  -e POSTGRES_DB=Fiscalize `
  -p 5432:5432 `
  -d postgres:16
```

Esse comando baixa automaticamente a imagem `postgres:16` na primeira execucao e cria o container `fiscalize-postgres`. Imagem e container sao recursos diferentes: a imagem e o modelo do PostgreSQL; o container e a instancia que fica em execucao.

Para verificar as imagens instaladas:

```powershell
docker images
```

Nao e necessario criar um Dockerfile para usar a imagem oficial do PostgreSQL.

Confirme que ele esta em execucao:

```powershell
docker ps
```

Deve aparecer `fiscalize-postgres` com a porta `5432` publicada.

Se `docker ps` nao mostrar nenhum container, verifique tambem os containers parados:

```powershell
docker ps -a
```

Se `fiscalize-postgres` aparecer com status `Exited`, inicie-o:

```powershell
docker start fiscalize-postgres
```

Se ele nao aparecer nem em `docker ps -a`, crie o container usando o comando `docker run` acima.

## 3. Configurar o backend

Entre na pasta do backend:

```powershell
cd "C:\Users\<seu-usuario>\OneDrive\Documentos\PRO\Projetos-V\backend"
```

Instale as dependencias:

```powershell
npm.cmd install
```

Crie o arquivo `backend/.env` com:

```env
DATABASE_URL="postgresql://postgres:BacoExu@127.0.0.1:5432/Fiscalize?schema=public"
JWT_SECRET="fiscalize-chave-secreta-local"
JWT_EXPIRATION="24h"
PORT=3000
NODE_ENV="development"
ALLOWED_ORIGINS="http://localhost:8081,http://localhost:19006"
```

## 4. Preparar o banco

Ainda na pasta `backend`, execute um comando por vez:

```powershell
npx.cmd prisma generate
```

```powershell
npx.cmd prisma migrate deploy
```

Carregue os dados iniciais e as contas de teste:

```powershell
npm.cmd run seed
```

Nao use `prisma db push` neste fluxo. O projeto possui migracoes versionadas em `backend/prisma/migrations`.

## 5. Iniciar o backend

```powershell
npm.cmd run dev
```

Deixe esse terminal aberto. O servidor ficara disponivel em:

- API: http://localhost:3000
- Health check: http://localhost:3000/health
- Swagger: http://localhost:3000/docs

Em outro terminal, teste:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

O resultado esperado deve informar `status: ok` e `database: connected`.

O Redis e opcional. Se `REDIS_URL` nao estiver configurada, o backend exibira `Redis: unavailable`, mas continuara funcionando.

## 6. Credenciais criadas pelo seed

```text
Admin   - admin@fiscalize.gov.br / Admin@123456
Gestor  - gestor@fiscalize.gov.br / Gestor@123456
Cidadao - cidadao@fiscalize.gov.br / Cidadao@123456
```

## 7. Iniciar o mobile com Android Studio

Abra o Android Studio, inicie um dispositivo em **Device Manager** e aguarde o Android carregar.

Em outro terminal:

```powershell
cd "C:\Users\<seu-usuario>\OneDrive\Documentos\PRO\Projetos-V\mobile"
npm.cmd install
npm.cmd start
```

Com o emulador aberto, pressione `a` no terminal do Expo. Alternativamente:

```powershell
npm.cmd run android
```

Para o emulador Android, a API deve ser acessada por `10.0.2.2`, que aponta para o computador:

```text
http://10.0.2.2:3000
```

Atualmente, a URL de desenvolvimento esta definida diretamente em `mobile/src/services/api.ts` na constante `HOMOLOG_URL`. Para o emulador, altere-a para:

```ts
const HOMOLOG_URL = 'http://10.0.2.2:3000';
```

Para celular fisico, use o IPv4 do computador na mesma rede Wi-Fi, por exemplo:

```ts
const HOMOLOG_URL = 'http://192.168.0.5:3000';
```

## 8. Ordem resumida para executar novamente

Terminal 1:

```powershell
docker start fiscalize-postgres
```

Terminal 2:

```powershell
cd "C:\Users\<seu-usuario>\OneDrive\Documentos\PRO\Projetos-V\backend"
npm.cmd run dev
```

Terminal 3:

```powershell
cd "C:\Users\<seu-usuario>\OneDrive\Documentos\PRO\Projetos-V\mobile"
npm.cmd start
```

Com o emulador aberto, pressione `a` no terminal do Expo.

## 9. Parar os servicos

Para parar o backend ou o Expo, pressione `Ctrl+C` no terminal correspondente.

Para parar o PostgreSQL:

```powershell
docker stop fiscalize-postgres
```
