# Backend — Fiscalize

API REST do Fiscalize, consumida pelo app mobile. Cuida de autenticação, do registro e acompanhamento
das ocorrências (chamados), do encaminhamento ao órgão responsável e do painel dos gestores.

**Stack:** Node.js 22 · Express 5 · TypeScript · Prisma 7 · PostgreSQL · JWT · Jest + Supertest

- Documentação interativa (Swagger): `http://localhost:3000/docs`
- Health check: `http://localhost:3000/health`

---

## Como rodar

### Pré-requisitos

- Node.js 22
- PostgreSQL 14+ (local ou Docker)
- Redis é **opcional**: sem ele, o cache de métricas fica desligado e o resto funciona normalmente

Para subir o PostgreSQL com Docker:

```bash
docker run --name fiscalize-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=Fiscalize -p 5432:5432 -d postgres:16
```

### Passo a passo

```bash
npm install
```

Crie o arquivo `backend/.env` (as variáveis estão descritas [mais abaixo](#variáveis-de-ambiente)):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/Fiscalize?schema=public"
JWT_SECRET="troque-por-uma-chave-secreta"
```

Aplique as migrações, popule o banco e suba o servidor:

```bash
npx prisma migrate deploy   # cria as tabelas
npm run seed                # categorias, órgãos, regras de encaminhamento e usuários de teste
npm run dev                 # http://localhost:3000, com recarga automática
```

Passo a passo mais detalhado, com solução de problemas: [`COMO_RODAR_O_BACK.md`](COMO_RODAR_O_BACK.md).

### Usuários criados pelo seed

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | `admin@fiscalize.gov.br` | `Admin@123456` (configurável via `SEED_ADMIN_*`) |
| Cidadão | `cidadao@fiscalize.gov.br` | `Cidadao@123456` |
| Gestor | `gestor.compesa@fiscalize.gov.br` (e um por órgão) | `Gestor@123456` |

O seed também cria as 6 categorias (Infraestrutura, Água e Esgoto, Iluminação Pública, Saneamento
Básico, Sinalização e Outros Problemas), os órgãos de Recife/PE (EMLURB, COMPESA, CELPE, CTTU, SINFRA
e SEMC) e as regras que ligam cada categoria ao órgão responsável.

---

## Perfis e permissões

As permissões são **hierárquicas**: um perfil herda o acesso dos perfis abaixo dele.

```
Admin   → rotas de Admin + Gestor + Cidadão
Gestor  → rotas de Gestor + Cidadão
Cidadão → rotas de Cidadão
```

- O **cadastro público** (`/auth/register`) sempre cria um **Cidadão**. Qualquer campo `perfil` enviado
  é ignorado; apenas o Admin pode mudar o perfil de um usuário.
- O **cidadão** só vê, edita e remove as **próprias** ocorrências.
- O **gestor** só atende ocorrências do **seu órgão**.
- Usuários **inativos** são bloqueados em todas as rotas autenticadas.

### Autenticação

O login retorna um **JWT** no corpo da resposta e também em um cookie `httpOnly`. O app mobile envia o token
no header:

```
Authorization: Bearer <token>
```

O logout revoga aquele token específico; outras sessões do mesmo usuário continuam válidas.

---

## Rotas

Todas as rotas, exceto cadastro, login e health check, exigem autenticação. Os corpos e as respostas
completos estão no Swagger (`/docs`).

### Autenticação — `/auth`

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/register` | Cadastra um cidadão (`nome`, `email`, `senha`) |
| `POST` | `/auth/login` | Login (`email`, `senha`); retorna `{ id, nome, email, perfil, token }` |
| `POST` | `/auth/logout` | Revoga o token atual |
| `GET` | `/auth/me` | Dados do usuário logado |

### Ocorrências — `/demands`

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| `GET` | `/demands` | todos | Lista paginada. Filtros: `busca`, `status`, `categoria`, `regiao`, `page`, `limit` |
| `POST` | `/demands` | Cidadão | Registra uma ocorrência |
| `GET` | `/demands/:id` | todos | Detalhe com histórico (`logs`) |
| `PUT` | `/demands/:id` | Cidadão (dono) | Edita título, descrição, categoria, endereço e coordenadas |
| `PUT` | `/demands/:id/photo` | Cidadão (dono) | Envia a foto (`{ "photo": "<base64>" }`, JPEG ou PNG, até ~15 MB) |
| `DELETE` | `/demands/:id` | Cidadão (dono) ou Gestor | Remove (soft delete: o status vira `Fechado`) |
| `PATCH` | `/demands/:id/status` | Gestor | Altera o status (`status_id` com o valor do enum) |

Exemplo de criação:

```json
POST /demands
{
  "title": "Poste apagado",
  "description": "Rua escura há uma semana",
  "category_id": 3,
  "location": "Rua das Flores, 123",
  "latitude": -8.0476,
  "longitude": -34.877
}
```

**Regras de negócio**

- **Protocolo:** cada ocorrência recebe um protocolo no formato `DEM-AAAAMMDD-XXXX`.
- **Encaminhamento:** a ocorrência é enviada ao órgão definido pelas regras de competência da categoria.
  Se não houver regra, vai para o órgão vinculado à categoria.
- **Pesquisa:** `busca` procura no título, na descrição, no endereço e no protocolo, sem diferenciar
  maiúsculas de minúsculas.
- **Lista do cidadão:** mostra apenas as ocorrências dele. As removidas (`Fechado`) ficam ocultas, a menos
  que se filtre `status=Fechado`.
- **Bloqueio:** a ocorrência não pode mais ser editada, receber foto nem ser removida pelo cidadão quando
  está `Em Andamento`, `Resolvido` ou `Fechado`.
- **Histórico:** cada criação, edição, mudança de status e remoção fica registrada em `timeline_event`.
- **Foto:** o formato é validado pelo conteúdo do arquivo, não pela extensão. O arquivo fica em `uploads/`,
  é servido em `/uploads/<arquivo>`, e a foto anterior é apagada quando substituída.

**Status de uma ocorrência**

| Exibição (API/app) | Valor no banco (enum) |
|---|---|
| Aberto | `Aberto` |
| Em Análise | `Em_An_lise` |
| Aguardando | `Aguardando` |
| Em Andamento | `Em_Andamento` |
| Resolvido | `Resolvido` |
| Fechado | `Fechado` |

As respostas usam o texto de exibição. O filtro `status` de `GET /demands` usa o valor do enum.

### Categorias — `/categories`

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/categories` | Categorias ativas |
| `GET` | `/categories/:id` | Detalhe de uma categoria |

### Gestor — `/gestor` (perfil Gestor)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/gestor/dashboard` | Totais de chamados do órgão (abertos, em andamento, encerrados) |
| `GET` | `/gestor/equipe` | Gestores do mesmo órgão |
| `GET` | `/gestor/chamados` | Fila do órgão. Filtros: `status`, `limit` (padrão 100), `offset` |
| `GET` | `/gestor/chamados/:id` | Detalhe de um chamado do órgão |
| `PUT` | `/gestor/chamados/:id/aceitar` | Assume o chamado (ou atribui a outro gestor do órgão) |
| `PUT` | `/gestor/chamados/:id/transferir` | Transfere o chamado para outro órgão (`orgaoId` e `justificativa` obrigatórios) |
| `PUT` | `/gestor/chamados/:id/status` | Atualiza o status (`status` no texto de exibição, ex.: `"Em Andamento"`; `justificativa` e `resolutionNote` são opcionais) |

### Métricas — `/metrics` (perfil Gestor)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/metrics/total-demands` | Total de chamados |
| `GET` | `/metrics/demands-by-category` | Chamados por categoria |
| `GET` | `/metrics/average-response-time` | Tempo médio de resposta |

As métricas são consolidadas periodicamente em `metrics_snapshot` por um job agendado (padrão: a cada hora,
configurável em `CRON_METRICS_SCHEDULE`). Para rodar manualmente: `npm run etl`.

### Usuários — `/users` (perfil Gestor)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/users` | Lista usuários |
| `GET` | `/users/:id` | Detalhe de um usuário |

### Administração — `/admin` (perfil Admin)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/admin/organs` | Lista órgãos (também liberado para Gestor) |
| `POST` | `/admin/organs` | Cria órgão |
| `PUT` | `/admin/organs/:id` | Edita órgão |
| `PUT` | `/admin/organs/:id/:status` | Ativa ou inativa órgão |
| `GET` | `/admin/organs/:id/categories` | Categorias atendidas pelo órgão |
| `GET` | `/admin/users` | Lista usuários |
| `POST` | `/admin/users` | Cria usuário Cidadão ou Gestor (`name`, `email`, `password`, `role`) |
| `PATCH` | `/admin/users/:id/activate` | Ativa usuário |
| `PATCH` | `/admin/users/:id/deactivate` | Desativa usuário |
| `PATCH` | `/admin/users/:id/role` | Altera o perfil |
| `GET` | `/admin/routing-rules` | Lista regras de encaminhamento |
| `POST` | `/admin/routing-rules` | Cria regra |
| `PATCH` | `/admin/routing-rules/:id` | Edita regra |
| `DELETE` | `/admin/routing-rules/:id` | Remove regra |
| `GET` | `/admin/audit-logs` | Log de auditoria das ações administrativas |

---

## Erros

Todos os erros seguem o mesmo formato:

```json
{
  "error": "Você não tem permissão para editar esta demanda.",
  "statusCode": 403,
  "timestamp": "2026-09-29T01:38:32.682Z"
}
```

| Status | Quando |
|---|---|
| `400` | Dados inválidos ou campos obrigatórios faltando |
| `401` | Sem token, token inválido, expirado ou revogado, ou credenciais inválidas |
| `403` | Sem permissão (perfil, dono ou órgão diferente, status bloqueado) ou usuário inativo |
| `404` | Recurso não encontrado |
| `409` | Conflito (ex.: e-mail já cadastrado) |
| `500` | Erro interno |

---

## Banco de dados

O esquema completo está em [`prisma/schema.prisma`](prisma/schema.prisma) e as migrações em
[`prisma/migrations`](prisma/migrations). Principais tabelas:

| Tabela | Conteúdo |
|---|---|
| `usuario` | Dados de login, perfil (`Cidadao`, `Gestor`, `Admin`) e status (`Ativo`, `Inativo`) |
| `cidadao`, `gestor`, `admin` | Dados específicos de cada perfil (o gestor pertence a um órgão) |
| `chamado` | A ocorrência: protocolo, descrição, categoria, endereço, coordenadas, status, prioridade, SLA e foto |
| `timeline_event` | Histórico de cada chamado (criação, edição, status, remoção) |
| `categoria` | Categorias de problema |
| `orgao`, `orgao_categoria` | Órgãos públicos e as categorias que cada um atende |
| `regra_competencia`, `routing_rules` | Regras de encaminhamento por categoria e subcategoria |
| `notificacao`, `notification_preference` | Notificações ao cidadão |
| `audit_logs`, `usuario_audit` | Auditoria das ações administrativas |
| `metrics_snapshot` | Métricas consolidadas pelo job agendado |

Para inspecionar o banco num navegador: `npx prisma studio`.

---

## Testes

```bash
npm test            # todos (unitários + API)
npm run test:unit   # regras de negócio isoladas (src/tests/unit)
npm run test:api    # rotas HTTP com Supertest (src/tests/api)
```

Os testes unitários e de API usam um **mock do Prisma** e não precisam de banco. Os testes E2E, que rodam
contra o backend e o banco reais, ficam na raiz do repositório (`npm run test:e2e`). Veja
[`../TESTES.md`](../TESTES.md) para o que cada nível cobre.

---

## Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor em desenvolvimento, com recarga automática |
| `npm run build` | Gera o Prisma Client e compila o TypeScript para `dist/` |
| `npm start` | Executa a versão compilada |
| `npm test` | Todos os testes (unitários + API) |
| `npm run test:unit` / `npm run test:api` | Cada nível separadamente |
| `npm run test:watch` | Testes em modo observação |
| `npm run migrate:deploy` | Aplica as migrações pendentes |
| `npm run prisma:migrate` | Cria uma nova migração a partir do schema (desenvolvimento) |
| `npm run prisma:generate` | Gera o Prisma Client |
| `npm run seed` | Popula o banco com os dados iniciais |
| `npm run etl` | Consolida as métricas manualmente |

---

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | sim | — | Conexão com o PostgreSQL |
| `JWT_SECRET` | sim | — | Chave de assinatura dos tokens |
| `JWT_EXPIRATION` | não | `24h` | Validade do token |
| `PORT` | não | `3000` | Porta do servidor |
| `NODE_ENV` | não | `development` | Ambiente (`development` ou `production`) |
| `ALLOWED_ORIGINS` | em produção | — | Origens liberadas no CORS, separadas por vírgula |
| `FRONTEND_URL` | não | — | Origem extra liberada no CORS em desenvolvimento |
| `REDIS_URL` | não | — | Redis para cache de métricas (sem ele, o cache fica desligado) |
| `CRON_METRICS_SCHEDULE` | não | `0 * * * *` | Agenda (cron) da consolidação de métricas |
| `SEED_ADMIN_EMAIL` | não | `admin@fiscalize.gov.br` | E-mail do admin criado pelo seed |
| `SEED_ADMIN_PASSWORD` | não | `Admin@123456` | Senha do admin criado pelo seed |
| `SEED_ADMIN_NAME` | não | `Administrador` | Nome do admin criado pelo seed |

> O app mobile não envia o header `Origin`, então o CORS não o afeta. Ele só é relevante para clientes web.

---

## Estrutura

```
backend/
├── prisma/
│   ├── schema.prisma        modelo do banco
│   ├── migrations/          migrações SQL
│   └── seed.ts              dados iniciais
├── src/
│   ├── server.ts            inicialização (porta, cron)
│   ├── app.ts               Express: middlewares e rotas
│   ├── config/              env, Prisma, CORS, Redis, cron, Swagger, uploads
│   ├── middlewares/         autenticação (JWT), perfis (requireRole) e erros
│   ├── routes/              definição das rotas por recurso
│   ├── controllers/         leitura da requisição e montagem da resposta
│   ├── services/            regras de negócio
│   ├── repositories/        consultas específicas (métricas, órgãos, regras)
│   ├── etl/                 extração, transformação e carga das métricas
│   ├── utils/               cache
│   └── tests/
│       ├── unit/            testes unitários
│       └── api/             testes de rotas (Supertest)
└── uploads/                 fotos das ocorrências (criada automaticamente, fora do git)
```

## Documentação complementar

- [`COMO_RODAR_O_BACK.md`](COMO_RODAR_O_BACK.md): configuração passo a passo
- [`SETUP.md`](SETUP.md): script de setup automático
- [`../TESTES.md`](../TESTES.md): estratégia e cobertura dos testes
- [`../README.md`](../README.md): visão geral do projeto (backend + app)
