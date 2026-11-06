# Documentação do Fiscalize

A documentação está organizada pelas **sete disciplinas** do Projeto Integrador do 5º período de ADS
(2026.2). Cada pasta tem um `README.md` com o papel da disciplina no projeto, as entregas e onde estão,
as tecnologias usadas e, para cada uma, **como foi usada, por que foi escolhida e por que as
alternativas foram descartadas**.

| # | Disciplina | Pasta | Destaques |
|---|---|---|---|
| 1 | Desenvolvimento Mobile | [`desenvolvimento-mobile/`](desenvolvimento-mobile/README.md) | React Native + Expo, MVVM, Expo Router, câmera e GPS, push, EAS; backend Express + Prisma + PostgreSQL |
| 2 | Segurança da Informação | [`seguranca-da-informacao/`](seguranca-da-informacao/README.md) | Atividades 1 a 6, modelo de autenticação, **explicação das cifras** (bcrypt, HMAC-SHA-256, SHA-256, TLS/AES-GCM, Keystore/Keychain), implementado × especificado |
| 3 | Negócios na Internet | [`negocios-na-internet/`](negocios-na-internet/README.md) | Modelo SaaS B2G, canvas, plano de sustentabilidade, KPIs e aspectos legais |
| 4 | Engenharia e Ciência de Dados e Big Data | [`engenharia-de-dados/`](engenharia-de-dados/README.md) | ETL das demandas, consolidação agendada, cache Redis, painel de indicadores |
| 5 | Testes Automatizados | [`testes-automatizados/`](testes-automatizados/README.md) | Plano de testes, pirâmide (Jest, Supertest, Playwright, Maestro), CI/CD, métricas, política da TAS |
| 6 | Projeto 5 | [`projeto-5/`](projeto-5/README.md) | Equipe, integração entre disciplinas, calendário, processo com forks, PRs e Quality Gate |
| 7 | IA Aplicada | [`ia-aplicada/`](ia-aplicada/README.md) | Agente com Gemini e *function calling* (`ai-agent/`), integração com o app, privacidade |

## Outros documentos

| Documento | Conteúdo |
|---|---|
| [`../README.md`](../README.md) | Visão geral do produto e como rodar tudo |
| [`COMO_RODAR_COM_DOCKER.md`](COMO_RODAR_COM_DOCKER.md) | Instalar o Docker e subir PostgreSQL, Redis, backend e agente de IA em containers |
| [`../backend/COMO_RODAR_O_BACK.md`](../backend/COMO_RODAR_O_BACK.md) | Configurar e rodar o backend sem Docker |
| [`testes-automatizados/TESTES.md`](testes-automatizados/TESTES.md) | Estratégia, execução e catálogo completo dos testes |
| [`../backend/README.md`](../backend/README.md) | Perfis, permissões, rotas e variáveis de ambiente da API |
| [`../mobile/README.md`](../mobile/README.md) | Telas, arquitetura MVVM, navegação, build e testes de tela do app |
| [`../ai-agent/README.md`](../ai-agent/README.md) | Instalação, arquitetura e casos de teste do agente de IA |

## Relatórios gerados pela pipeline

Toda execução do CI/CD publica, como artefatos (aba *Actions* → execução → *Artifacts*), relatórios montados a
partir do repositório. Os dois abaixo usam esta documentação como fonte:

| Artefato | Workflow | Conteúdo |
|---|---|---|
| `relatorio-tecnico-projeto` | [`relatorio-tecnico.yml`](../.github/workflows/relatorio-tecnico.yml) | Cada tecnologia com versão, onde é usada, por que foi escolhida e o que foi descartado (texto destes READMEs), rotas da API, modelo de dados, telas, testes e workflows; HTML e `tecnologias.xml` |
| `relatorio-seguranca` | [`seguranca.yml`](../.github/workflows/seguranca.yml) | Bibliotecas vulneráveis, segredos, análise estática e os controles de Segurança conferidos no código; HTML em linguagem simples, `seguranca.xml` e JUnit XML |

Lista completa de artefatos em [`TESTES.md`, seção 2.2](testes-automatizados/TESTES.md#22-registro-de-falhas-artefatos-e-relatórios-de-qualidade).

## Convenções

- Documentos em português; nomes de branch e mensagens de commit em inglês (*Conventional Commits*).
- Um documento novo de uma disciplina entra na pasta dela e ganha uma linha na tabela de entregas do
  `README.md` da pasta.
- Ao mover um documento, procure o caminho antigo no repositório inteiro: workflows e scripts em
  `.github/` também referenciam arquivos de `docs/` (por exemplo, o catálogo de testes e a política da TAS).
- O relatório técnico lê as seções `### N.N Tecnologia` dos READMEs e os rótulos **Como**, **Por quê** e
  **Descartados**. Ao documentar uma tecnologia nova, mantenha esse formato e acrescente-a em
  [`.github/scripts/tech-report/tecnologias.mjs`](../.github/scripts/tech-report/tecnologias.mjs); ao renomear
  uma seção, o relatório avisa que não a encontrou.
