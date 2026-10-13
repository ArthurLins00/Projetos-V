# 🚀 Guia de Setup - Backend

Instruções completas para configurar o ambiente de desenvolvimento do backend em uma nova máquina.

## 📋 Pré-requisitos

### Obrigatórios
- **Node.js 18+** - [Baixar aqui](https://nodejs.org/)
- **npm 8+** - Vem com Node.js
- **Git** - [Baixar aqui](https://git-scm.com/)
- **PostgreSQL 12+** - [Baixar aqui](https://www.postgresql.org/download/)

### Opcionais (recomendados)
- **Visual Studio Code** - [Baixar aqui](https://code.visualstudio.com/)
- **DBeaver ou pgAdmin** - Ferramentas para gerenciar banco PostgreSQL
- **Postman ou Insomnia** - Para testar APIs

## ✅ Verificar instalações

Abra um terminal e execute:

```bash
node --version

npm --version

git --version
```

## 🔧 Setup Automático (Recomendado)

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/projeto-web.git
cd projeto-web/backend
```

### 2. Execute o script de setup

#### **Linux/macOS**
```bash
chmod +x setup.sh
./setup.sh
```

#### **Windows (PowerShell)**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup.sh
```

#### **Windows (Git Bash)**
```bash
bash setup.sh
```

#### **Windows (CMD)**
```cmd
npm install
npx prisma generate
npx prisma migrate dev
```

### 3. Configure o arquivo `.env`

O script cria um arquivo `.env` automaticamente. Edite-o com suas configurações:

```bash
code .env
```

Exemplo de configuração:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/fiscalize?schema=public"

JWT_SECRET="sua_chave_secreta_super_segura_aqui_123"
JWT_EXPIRATION="24h"

PORT=3000

FRONTEND_URL="http://localhost:3001"

NODE_ENV="development"
```

### 4. Inicie o servidor

```bash
npm run dev
```

Você deve ver:
```
[INFO] 08:52:53 ts-node-dev ver. 2.0.0
Servidor rodando na porta 3000
```

---

## 🛠️ Setup Manual (Passo a Passo)

Se preferir fazer passo a passo ou o script falhar:

### 1. Instalar dependências

```bash
npm install
```

### 2. Gerar Prisma Client

```bash
npx prisma generate
```

### 3. Criar/Sincronizar banco de dados

```bash
npx prisma migrate dev

npx prisma db push
```

### 4. Visualizar banco de dados (opcional)

```bash
npx prisma studio
```

Abre interface gráfica do banco em `http://localhost:5555`

### 5. Executar seed (opcional)

Se houver arquivo `prisma/seed.ts`:

```bash
npx prisma db seed
```

### 6. Iniciar servidor

```bash
npm run dev

npm run build
npm start
```

---

## 📁 Estrutura do Projeto

```
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   └── server.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── tests/
├── .env.example
├── package.json
├── tsconfig.json
├── setup.sh
└── SETUP.md
```

---

## 🔗 Configurando o Banco de Dados

### Pré-requisito: PostgreSQL instalado

#### **1. Criar banco de dados**

**Windows (usando pgAdmin):**
1. Abra pgAdmin
2. Clique em "Create" > "Database"
3. Nome: `fiscalize`
4. Clique em "Save"

**Linux/macOS (terminal):**
```bash
psql -U postgres -c "CREATE DATABASE fiscalize;"
```

#### **2. Atualizar DATABASE_URL no .env**

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/fiscalize?schema=public"
```

Substitua:
- `usuario` - seu usuário PostgreSQL (padrão: `postgres`)
- `senha` - sua senha PostgreSQL
- `localhost` - seu host (padrão: `localhost`)
- `5432` - porta PostgreSQL (padrão: `5432`)
- `fiscalize` - nome do banco

#### **3. Sincronizar schema**

```bash
npx prisma migrate dev --name init
```

---

## 🧪 Testando a API

### Usando cURL

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "email": "joao@example.com",
    "senha": "senha123"
  }'

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@example.com",
    "senha": "senha123"
  }' \
  -c cookies.txt

curl -X GET http://localhost:3000/auth/me \
  -H "Content-Type: application/json" \
  -b cookies.txt

curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -b cookies.txt
```

### Usando Postman/Insomnia

1. Importe a coleção: [collection.json](./postman-collection.json) (criar se necessário)
2. Configure variável `base_url` = `http://localhost:3000`
3. Execute as requisições

---

## 📦 Scripts disponíveis

```bash
npm run dev

npm run build
npm start

npm test
npm run test:watch

npx prisma generate
npx prisma migrate dev
npx prisma db push
npx prisma studio
npx prisma db seed
```

---

## 🐛 Troubleshooting

### Erro: "Cannot find module '@prisma/client'"

```bash
npx prisma generate
npm install
```

### Erro: "ECONNREFUSED - Connection refused at 127.0.0.1:5432"

**Problema:** PostgreSQL não está rodando

**Solução:**

**Windows:**
```powershell
Get-Service postgresql-x64-*

Start-Service -Name postgresql-x64-15
```

**Linux/macOS:**
```bash
sudo systemctl status postgresql

sudo systemctl start postgresql
```

### Erro: "role "postgres" does not exist"

**Problema:** Usuário PostgreSQL não encontrado

**Solução:**
```bash
sudo -u postgres createuser seu_usuario
```

### Erro: "database "fiscalize" does not exist"

**Problema:** Banco não criado

**Solução:**
```bash
psql -U postgres -c "CREATE DATABASE fiscalize;"
```

### Erro: "permission denied: ./setup.sh" (Linux/macOS)

**Solução:**
```bash
chmod +x setup.sh
./setup.sh
```

### Porta 3000 já em uso

**Solução 1:** Usar porta diferente
```bash
PORT=3001 npm run dev
```

**Solução 2:** Liberar porta
```bash
lsof -i :3000

kill -9 <PID>

netstat -ano | findstr :3000

taskkill /PID <PID> /F
```

---

## 🔐 Variáveis de Ambiente

### Obrigatórias
| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | Chave para assinar tokens JWT | `sua_chave_secreta_aqui` |

### Opcionais
| Variável | Descrição | Default |
|----------|-----------|---------|
| `PORT` | Porta do servidor | `3000` |
| `JWT_EXPIRATION` | Expiração do token | `24h` |
| `FRONTEND_URL` | URL do frontend (CORS) | `http://localhost:3001` |
| `NODE_ENV` | Ambiente | `development` |

---

## 📚 Documentação adicional

- [Express.js](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Prisma](https://www.prisma.io/docs/)
- [JWT](https://jwt.io/)
- [PostgreSQL](https://www.postgresql.org/docs/)

---

## 💬 Dúvidas ou Problemas?

1. Verifique este arquivo SETUP.md
2. Consulte a [seção de Troubleshooting](#-troubleshooting)
3. Abra uma issue no repositório
4. Verifique os logs do servidor para mais detalhes

---

**Última atualização:** 3 de junho de 2026

**Versões testadas:**
- Node.js 18.x - 20.x
- npm 8.x - 10.x
- PostgreSQL 12 - 15
- TypeScript 6.x
