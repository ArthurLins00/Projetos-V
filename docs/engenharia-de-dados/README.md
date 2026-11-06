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
| U2 | Orquestração do pipeline | 🟡 parcial | agendamento horário com `node-cron` (seção 3.3); sem orquestrador dedicado |
| U2 | Processamento com Spark | ⬜ não versionado neste repositório | ver seção 4 |
| U2 | Produto baseado em dados | ✅ | painel de indicadores do gestor, alimentado pelos *snapshots* em cache |
| U2 (extra) | Filas e processamento assíncrono | ⬜ não implementado | ver seção 4 |

---

## 2. Arquitetura dos dados

```
             ┌──────────── fonte: PostgreSQL operacional (chamado, categoria, orgao) ────────────┐
             │                                                                                    │
  (A) ETL sob demanda: npm run etl                     (B) Consolidação agendada: node-cron (0 * * * *)
  Extract  → só id, status, datas, categoria             computeSnapshot por escopo:
  Transform→ contagem por status e categoria,              • plataforma inteira
             tempo médio de resolução (h)                  • cada órgão (orgaoid)
  Load     → metrics_snapshot (PostgreSQL, jsonb)        → metrics_snapshot (plataforma)
           → Redis  metrics:latest (24 h)                → Redis metrics:snapshot:<data>:<escopo> (24 h)
             │                                            │
             └──────────────┬─────────────────────────────┘
                            ▼
  API /metrics (Gestor) → cache-aside no Redis (5 min) → painel do gestor no app
```

- **Minimização (LGPD):** a extração lê só `id`, `status`, `criadoem`, `atualizadoem` e o nome da
  categoria. Nenhum nome, e-mail, endereço, foto ou coordenada entra no pipeline.
- **Histórico:** cada execução grava uma linha em `metrics_snapshot` (com `jobstatus` e
  `errormessage`), o que permite ver a evolução dos indicadores e auditar falhas do job.
- **Degradação graciosa:** sem `REDIS_URL` ou com o Redis fora do ar, o cache é ignorado e a API
  calcula direto no banco; o `/health` mostra `redis: unavailable` sem derrubar o serviço.

### Indicadores produzidos

| Indicador | Cálculo | Usado em |
|---|---|---|
| Total por status | contagem de chamados por status (aberta, em andamento, resolvida, encerrada) | painel do gestor; KPI "taxa de resolução" |
| Distribuição por categoria | contagem e percentual por categoria | painel do gestor; planejamento de manutenção |
| Tempo médio de resolução | média de `atualizadoem − criadoem` (horas) dos chamados resolvidos/fechados | painel do gestor; KPI "tempo médio de resolução" |

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

- **Como:** três classes com responsabilidade única, reutilizando o Prisma do backend; executado por
  `npm run etl` ([`runMetricsEtl.ts`](../../backend/src/scripts/runMetricsEtl.ts)).
- **Por quê:** mesma linguagem e mesmo modelo tipado do backend; a transformação é uma função pura,
  sem acesso a banco. O cálculo das métricas da API e o cache são cobertos pelos testes unitários
  (`metricsAndCache.test.ts`).
- **Descartados:**
  - **Python + pandas:** padrão em ciência de dados, mas exigiria um segundo ambiente e duplicaria o
    acesso ao esquema do banco.
  - **Ferramenta de ETL visual (Pentaho, Airbyte):** pesada demais para três consultas agregadas.

### 3.3 node-cron (agendamento)

- **Como:** a consolidação roda dentro do processo do backend, por padrão a cada hora
  (`CRON_METRICS_SCHEDULE`, validado na subida), para a plataforma e para cada órgão.
- **Por quê:** zero infraestrutura extra; cada execução é idempotente (gera um novo *snapshot*).
- **Descartados:**
  - **Apache Airflow:** é o orquestrador de referência (DAGs, *retries*, monitoramento), mas exige
    servidor, banco e *scheduler* próprios. É o caminho quando houver várias etapas dependentes.
  - **cron do sistema operacional:** não acompanha o deploy da aplicação nem funciona igual no
    Windows da equipe.
- **Limitação:** com várias instâncias da API, cada uma rodaria o job; em produção ele deve ser
  executado por uma única instância ou migrado para um orquestrador.

### 3.4 Redis (ioredis) como cache

- **Como:** padrão *cache-aside* nas rotas `/metrics` (TTL de 5 minutos, chave por escopo do gestor),
  *snapshots* diários por escopo (TTL de 24 h) e invalidação das chaves quando um chamado muda.
- **Por quê:** o painel é aberto várias vezes por dia por gestor; servir do cache evita recalcular
  agregações a cada abertura. Estruturas com TTL nativo.
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
