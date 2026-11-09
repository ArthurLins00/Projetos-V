# Engenharia e Ciência de Dados e Big Data (eletiva)

| | |
|---|---|
| **Papel no PI** | Projetar o pipeline de dados (ETL) das demandas e a camada de analytics, com estratégias de armazenamento e indicadores |
| **Código** | [`backend/src/etl`](../../backend/src/etl), [`runMetricsEtl.ts`](../../backend/src/scripts/runMetricsEtl.ts), [`metricsConsolidationService.ts`](../../backend/src/services/metricsConsolidationService.ts), [`metricsService.ts`](../../backend/src/services/metricsService.ts), [`cron.ts`](../../backend/src/config/cron.ts), [`redis.ts`](../../backend/src/config/redis.ts), [`cache.ts`](../../backend/src/utils/cache.ts) |
| **Conexões** | consome os dados do backend do [Mobile](../desenvolvimento-mobile/README.md); fornece indicadores para os KPIs de [Negócios](../negocios-na-internet/README.md); respeita a minimização definida por [Segurança](../seguranca-da-informacao/README.md) |

---

## 1. Entregas

| Unidade | Entrega | Situação | Onde está |
|---|---|---|---|
| U1 | Modelo de dados analíticos | ✅ | tabela `metrics_snapshot` em [`schema.prisma`](../../backend/prisma/schema.prisma) |
| U1 | Pipeline ETL inicial das demandas | ✅ | `Extract` → `Transform` → `Load` em [`backend/src/etl`](../../backend/src/etl); `npm run etl` |
| U1 | Primeiras análises (volume por status, categoria, tempo médio) | ✅ | `Transform.processarMetricas`, painel do gestor ([`MetricsPanel.tsx`](../../mobile/src/components/MetricsPanel.tsx)) |
| U2 | Orquestração do pipeline | 🟡 parcial | agendamento horário com `node-cron` e regeneração sob demanda pela API (seção 3.3); sem orquestrador dedicado |
| U2 | Processamento com Spark | ⬜ não versionado neste repositório | ver seção 4 |
| U2 | Produto baseado em dados | ✅ | painel de indicadores do gestor: as rotas `/metrics` leem o *snapshot* mais recente de `metrics_snapshot` gerado pelo pipeline ([`metricsService.ts`](../../backend/src/services/metricsService.ts)), e o app mostra quando ele foi gerado |
| U2 (extra) | Filas e processamento assíncrono | ⬜ não implementado | ver seção 4 |

---

## 2. Arquitetura dos dados

```
        fonte: PostgreSQL operacional (chamado, categoria, timeline_event)
                                   │
   disparo: node-cron (0 * * * *) · npm run etl · API quando o snapshot está desatualizado
                                   │
                                   ▼
   Extract   → status, categoria, datas e eventos de mudança de status (nenhum dado pessoal)
   Transform → total por status, distribuição por categoria, tempo médio de resolução (função pura)
   Load      → metrics_snapshot (PostgreSQL, jsonb; uma linha por execução)
             → Redis metrics:latest (cópia do mais recente, 24 h)
                                   │
                                   ▼
   API /metrics (Gestor e Admin) → lê o snapshot mais recente → painel do gestor no app
                                   ("Indicadores gerados hoje às HH:MM")
```

- **Um único pipeline:** o agendamento, o `npm run etl` e a API usam as mesmas classes
  ([`metricsConsolidationService.ts`](../../backend/src/services/metricsConsolidationService.ts)), então o
  painel mostra exatamente o que o pipeline gravou.
- **Snapshot sempre atual:** a API reaproveita o snapshot mais recente enquanto nenhum chamado foi
  alterado, criado ou apagado depois dele e enquanto ele tem menos de `METRICS_SNAPSHOT_MAX_AGE_MINUTES`
  (padrão 60). Fora disso, roda o pipeline (uma vez só, mesmo com os três indicadores pedidos juntos) e
  devolve o snapshot novo. Se o pipeline falhar, mostra o último snapshot válido.
- **Minimização (LGPD):** a extração lê só status, categoria, datas e os eventos de mudança de status.
  Nenhum nome, e-mail, endereço, foto ou coordenada entra no pipeline.
- **Histórico:** cada execução grava uma linha em `metrics_snapshot` (com `jobstatus` e
  `errormessage`), o que permite ver a evolução dos indicadores e auditar falhas do job.
- **Degradação graciosa:** sem `REDIS_URL` ou com o Redis fora do ar, a cópia no Redis é ignorada; o
  snapshot continua no PostgreSQL, e o `/health` mostra `redis: unavailable` sem derrubar o serviço.

### Indicadores produzidos

| Indicador | Cálculo | Usado em |
|---|---|---|
| Total por status | contagem de chamados por status (aberta, em andamento, resolvida, encerrada) | painel do gestor; KPI "taxa de resolução" |
| Distribuição por categoria | contagem e percentual por categoria, incluindo as categorias sem chamados | painel do gestor; planejamento de manutenção |
| Tempo médio de resolução | média, em horas, entre a abertura e o primeiro evento que levou o chamado a Resolvido ou Fechado; guarda também quantos chamados entraram na média | painel do gestor; KPI "tempo médio de resolução" |

---

## 3. Tecnologias

### 3.1 PostgreSQL como fonte e como armazenamento analítico (`jsonb`)

- **Como:** o *snapshot* guarda os agregados em colunas `Json` (`porstatus`, `porcategoria`) com índice
  por data decrescente para buscar o mais recente.
- **Por quê:** no volume de um piloto municipal, o próprio PostgreSQL atende consultas analíticas; o
  `jsonb` acomoda categorias novas sem migração.
- **Descartados:**
  - **Data warehouse separado (BigQuery, Redshift, Snowflake):** custo e mais um fornecedor recebendo
    dados para um volume que cabe numa tabela.
  - **MongoDB para os agregados:** dividiria o armazenamento em dois bancos sem ganho, já que o
    PostgreSQL tem `jsonb`.

### 3.2 ETL em TypeScript (Extract / Transform / Load)

- **Como:** três classes com responsabilidade única em [`backend/src/etl`](../../backend/src/etl),
  reutilizando o Prisma do backend. O mesmo pipeline roda pelo agendamento, por `npm run etl`
  ([`runMetricsEtl.ts`](../../backend/src/scripts/runMetricsEtl.ts)) e pela API do painel quando o
  snapshot ficou desatualizado.
- **Por quê:** mesma linguagem e mesmo modelo tipado do backend; a transformação é uma função pura,
  sem acesso a banco. Transform, pipeline e a regra de reaproveitar ou regenerar o snapshot são cobertos
  pelos testes unitários (`metricsAndCache.test.ts`), e as rotas pelos testes de API
  (`metricsHealthUsers.test.ts`).
- **Descartados:**
  - **Python + pandas:** padrão em ciência de dados, mas exigiria um segundo ambiente e duplicaria o
    acesso ao esquema do banco.
  - **Ferramenta de ETL visual (Pentaho, Airbyte):** pesada demais para três consultas agregadas.

### 3.3 node-cron (agendamento)

- **Como:** o pipeline roda dentro do processo do backend, por padrão a cada hora
  (`CRON_METRICS_SCHEDULE`, validado na subida). Entre uma execução agendada e outra, a API regenera o
  snapshot quando um chamado muda, para o painel não mostrar dados de até uma hora atrás.
- **Por quê:** zero infraestrutura extra; cada execução é idempotente (gera um novo *snapshot*).
- **Descartados:**
  - **Apache Airflow:** é o orquestrador de referência (DAGs, *retries*, monitoramento), mas exige
    servidor, banco e *scheduler* próprios. É o caminho quando houver várias etapas dependentes.
  - **cron do sistema operacional:** não acompanha o deploy da aplicação nem funciona igual no
    Windows da equipe.
- **Limitação:** com várias instâncias da API, cada uma rodaria o job; em produção ele deve ser
  executado por uma única instância ou migrado para um orquestrador.

### 3.4 Redis (ioredis) como cache

- **Como:** o Load guarda uma cópia do snapshot mais recente em `metrics:latest` (TTL de 24 h), para
  consumidores que leem do Redis; o Redis também guarda os contadores do *rate limiting* e do bloqueio
  de login (Segurança).
- **Por quê:** estruturas com TTL nativo e compartilhadas entre instâncias. O painel não precisa de um
  cache próprio: ele já lê um agregado pronto (o snapshot), em vez de recalcular a cada abertura.
- **Descartados:** **Memcached** (sem persistência e sem os tipos de dado que permitiriam usar o
  mesmo Redis para filas e *rate limiting* no futuro) e **cache em memória do processo** (não é
  compartilhado entre instâncias).

---

## 4. Evolução prevista na U2 e escolhas descartadas

| Tema | Proposta | Por que ainda não está no repositório |
|---|---|---|
| **Processamento com Spark** | Job PySpark lendo os chamados (exportação do PostgreSQL via JDBC), agregando por categoria, região e período e gravando em Parquet | O volume do piloto (milhares de linhas) é processado em milissegundos no PostgreSQL; o Spark só se paga com volume distribuído. Fica como entrega da disciplina fora do backend |
| **Orquestração** | DAG no Airflow: extrair → transformar (Spark) → carregar `metrics_snapshot` → aquecer cache | Mesmo motivo; hoje o `node-cron` cobre um job de etapa única |
| **Filas e processamento assíncrono (extra)** | BullMQ sobre o mesmo Redis para tirar do caminho da requisição o envio de e-mail, o push e o recálculo de métricas | Hoje esses envios já não bloqueiam a resposta (falha só é registrada em log), mas não há nova tentativa |

**Alternativas de fila consideradas:** **RabbitMQ** e **Kafka** foram descartadas para o extra por
exigirem um serviço novo; o **BullMQ** reaproveita o Redis já existente.
