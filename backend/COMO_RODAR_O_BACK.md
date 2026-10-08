# COMO RODAR O BACKEND

## 1) Requisitos minimo
- Node.js 18 ou superior (ja inclui npm).
- PostgreSQL instalado localmente ou Docker disponivel.
- Terminal ou prompt de comando.

## 2) Abrir o backend no terminal
No terminal, a partir da raiz do repositorio, acesse a pasta do backend:
```bash
cd backend
```

## 3) Instalar as dependencias
```bash
npm install
```

## 4) Configurar o banco de dados PostgreSQL
O backend usa Prisma e o arquivo backend/prisma.config.ts aponta para a URL padrao:
```text
postgresql://postgres:BacoExu@localhost:5432/Fiscalize?schema=public
```

### Opcao A: PostgreSQL local
1. Crie um banco de dados chamado Fiscalize.
2. Garanta que usuario e senha sejam:
   - Usuario: postgres
   - Senha: BacoExu
3. Garanta que o PostgreSQL aceite conexoes em localhost:5432.

### Opcao B: Usar Docker
Se voce tiver Docker, execute:
```bash
docker run --name fiscalize-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=BacoExu -e POSTGRES_DB=Fiscalize -p 5432:5432 -d postgres:16
```

## 5) Criar o arquivo de variaveis de ambiente
Na pasta backend/, crie um arquivo .env com:
```env
DATABASE_URL="postgresql://postgres:BacoExu@localhost:5432/Fiscalize?schema=public"
JWT_SECRET="troque-por-uma-chave-secreta"
```

> O JWT_SECRET e obrigatorio: sem ele o servidor nao inicia.

> Ajuste a URL se usar outro usuario, senha, host, porta ou nome de banco.

Opcional, para o chat do assistente de IA (rota `POST /ai/chat`, servico em `ai-agent/`):
```env
AI_AGENT_URL="http://127.0.0.1:3333"   # padrao; endereco do `npm run serve` do ai-agent
AI_AGENT_SECRET=""                      # se definido, use o mesmo valor no ai-agent/.env
```

> Sem o servico do agente rodando, o restante da API funciona normalmente; so `/ai/chat` responde 503.

## 6) Gerar o cliente Prisma e aplicar o esquema
No diretorio backend/, execute:
```bash
npx prisma generate
```

Em seguida, aplique as migrations:
```bash
npx prisma migrate dev
```

Isso criara as tabelas no banco de dados com base em prisma/migrations.

Opcionalmente, popule o banco com dados de exemplo:
```bash
npm run seed
```

## 7) Rodar o backend
Ainda em backend/:
```bash
npm run dev
```

O servidor deve iniciar em http://localhost:3000.

## 8) Rotas de autenticacao
As rotas disponiveis sao:
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- GET /auth/me

## 9) Testar a API com Postman
### 9.1) Registrar usuario
- Metodo: POST
- URL: http://localhost:3000/auth/register
- Body (JSON):
```json
{
  "nome": "Teste",
  "email": "teste@teste.com",
  "senha": "123456"
}
```

### 9.2) Fazer login
- Metodo: POST
- URL: http://localhost:3000/auth/login
- Body (JSON):
```json
{
  "email": "teste@teste.com",
  "senha": "123456"
}
```

O login retorna um cookie token HTTP-only. No Postman, habilite o envio de cookies automaticamente.

### 9.3) Verificar usuario logado
- Metodo: GET
- URL: http://localhost:3000/auth/me
- Esta rota exige autenticacao via cookie token.

### 9.4) Logout
- Metodo: POST
- URL: http://localhost:3000/auth/logout
- Esta rota tambem exige autenticacao via cookie token.

## 10) Testar a API com curl
Registrar:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste","email":"teste@teste.com","senha":"123456"}'
```

Login:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@teste.com","senha":"123456"}'
```

> Observacao: como o backend usa cookie HTTP-only, curl nao eh ideal para testar rotas protegidas.

## 11) Rodar os testes automatizados
Os testes do backend usam Jest e nao precisam de banco de dados (o Prisma e mockado). Em backend/:
```bash
npm test
```

Tambem e possivel rodar cada grupo separadamente:
```bash
npm run test:unit
```
```bash
npm run test:api
```

Os testes E2E (Playwright e Maestro) ficam na raiz do repositorio; veja o TESTES.md.

## 12) Observacoes finais
- Para rodar em outra maquina, instale Node.js e PostgreSQL (ou Docker), clone o repositorio e siga estes passos.
- Sempre confirme que o banco esteja online antes de rodar npm run dev.
