# Fiscalize — Sustentabilidade, KPIs e Aspectos Legais do Negócio

> **Objetivo:** avaliar e sustentar o serviço digital Fiscalize para dar viabilidade ao negócio.
> Este documento fecha a visão de serviço e mostra o valor da plataforma para o cidadão, para o
> órgão público e para quem a mantém.

| | |
|---|---|
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Turma** | 5º Período de ADS Regular — Grupo 6 |
| **Escopo** | App mobile (Android/iOS), API REST, painel do gestor, métricas e Assistente de IA |
| **Região piloto** | Recife/PE (órgãos EMLURB, COMPESA, CELPE, CTTU, SINFRA e SEMC) |

---

## Sumário

0. [Visão do serviço e proposta de valor](#0-visão-do-serviço-e-proposta-de-valor)
1. [Plano de sustentabilidade](#1-plano-de-sustentabilidade)
2. [KPIs do negócio](#2-kpis-do-negócio)
3. [Aspectos legais do negócio](#3-aspectos-legais-do-negócio)
4. [Conclusão: viabilidade e valor da plataforma](#4-conclusão-viabilidade-e-valor-da-plataforma)

---

## 0. Visão do serviço e proposta de valor

O Fiscalize conecta o cidadão que encontra um problema urbano (buraco, poste apagado, vazamento,
sinalização danificada…) ao órgão público responsável por resolvê-lo. O cidadão fotografa, o GPS
marca o local e a plataforma **encaminha automaticamente** a ocorrência ao órgão competente pela
categoria, com prioridade e SLA. O cidadão acompanha cada mudança de status até a resolução, e o
gestor público trabalha numa fila única, com histórico, responsáveis e métricas.

### Para quem o serviço gera valor

| Ator | Dor atual | Valor entregue pelo Fiscalize |
|---|---|---|
| **Cidadão** | Não sabe a quem reclamar; liga, espera, não recebe retorno | Registro em menos de 1 minuto, protocolo, notificações e acompanhamento transparente |
| **Gestor do órgão** | Demandas espalhadas em telefone, e-mail, redes sociais; duplicadas e sem localização | Fila única, geolocalizada, com foto, prioridade, SLA, responsável e histórico |
| **Prefeitura / governo** | Pouca visibilidade sobre onde e quanto a cidade "quebra"; pressão por transparência | Indicadores por bairro, categoria e órgão para planejar manutenção e prestar contas |
| **Órgãos estaduais e concessionárias** (COMPESA, CELPE) | Recebem demandas fora da sua competência | Regras de competência que roteiam para o órgão certo na primeira vez |

### Modelo de negócio em uma frase

**Gratuito para o cidadão; assinatura (SaaS B2G) para o órgão público**, que paga pelo painel de
gestão, roteamento, métricas, integrações e suporte.

### Canvas resumido

| Bloco | Fiscalize |
|---|---|
| **Segmentos de clientes** | Prefeituras (cliente pagante), órgãos estaduais e concessionárias (cliente pagante ou parceiro), cidadãos (usuários) |
| **Proposta de valor** | Ocorrência certa, no órgão certo, com dados certos; transparência para o cidadão e gestão por indicadores para o órgão |
| **Canais** | Lojas de aplicativos (Google Play, App Store), portal da prefeitura, campanhas institucionais, eventos de gestão pública |
| **Relacionamento** | Implantação assistida, treinamento de gestores, suporte com SLA contratual, relatórios periódicos |
| **Fontes de receita** | Assinatura anual por faixa populacional, taxa de implantação, módulos adicionais (integrações, BI, IA avançada) |
| **Recursos-chave** | Plataforma (app + API + painel), base de regras de competência, equipe técnica, dados históricos |
| **Atividades-chave** | Desenvolvimento e operação da plataforma, implantação, suporte, segurança e conformidade |
| **Parcerias-chave** | Prefeituras e consórcios municipais, provedores de nuvem, Google (Gemini API), universidades e programas de inovação pública |
| **Estrutura de custos** | Equipe, infraestrutura em nuvem, API de IA, lojas de apps, jurídico/conformidade, comercial |

---

## 1. Plano de sustentabilidade

A sustentabilidade do Fiscalize é tratada em **cinco ambientes do modelo de negócio**. Cada um tem
riscos próprios e ações para manter o serviço vivo no longo prazo.

```
                ┌────────────────────────────┐
                │  Ambiente institucional e  │
                │         político           │
                └─────────────┬──────────────┘
┌──────────────────┐   ┌──────┴───────┐   ┌──────────────────┐
│ Econômico-       │───│  FISCALIZE   │───│ Social           │
│ financeiro       │   │  (serviço)   │   │                  │
└──────────────────┘   └──────┬───────┘   └──────────────────┘
          ┌───────────────────┴───────────────────┐
┌─────────┴──────────┐                  ┌─────────┴──────────┐
│ Tecnológico e      │                  │ Ambiental          │
│ operacional        │                  │                    │
└────────────────────┘                  └────────────────────┘
```

### 1.1 Ambiente econômico-financeiro

**Meta:** a receita recorrente das assinaturas cobre os custos fixos e variáveis e financia a
evolução do produto, sem depender de um único contrato.

#### Fontes de receita

| Fonte | Descrição | Recorrência |
|---|---|---|
| **Assinatura SaaS por faixa populacional** | Licença de uso do painel do gestor, roteamento, métricas e app para os cidadãos do município | Mensal/anual |
| **Taxa de implantação** | Cadastro de órgãos, categorias e regras de competência; importação de dados; treinamento | Única |
| **Módulos adicionais** | Integração com sistemas legados (ouvidoria, ERP, 156), BI avançado, Assistente de IA com cota ampliada | Mensal |
| **Contratos com órgãos estaduais / concessionárias** | Acesso à fila de ocorrências de sua competência em vários municípios | Anual |
| **Editais e programas de inovação** | Recursos de fomento (FINEP, FACEPE, programas de GovTech) e CPSI do Marco Legal das Startups | Pontual |

#### Tabela de preços (hipótese para validação)

| Plano | Faixa populacional | Mensalidade | Implantação |
|---|---|---|---|
| **Essencial** | até 50 mil hab. | R$ 2.500 | R$ 5.000 |
| **Cidade** | 50 mil a 300 mil hab. | R$ 7.500 | R$ 15.000 |
| **Metrópole** | acima de 300 mil hab. | R$ 18.000 | R$ 40.000 |

> Valores estimados para fins de planejamento acadêmico; precisam ser validados com entrevistas a
> gestores e pesquisa de preços de soluções similares em licitações públicas.

#### Estrutura de custos (estimativa mensal, fase de operação)

| Item | Custo estimado | Observação |
|---|---|---|
| Equipe (4 pessoas: 2 dev, 1 suporte/implantação, 1 comercial/gestão) | R$ 38.000 | Maior custo; cresce por degraus |
| Infraestrutura em nuvem (API, PostgreSQL gerenciado, Redis, armazenamento de fotos, backups) | R$ 2.500 | Escala com número de municípios e fotos |
| API de IA (Gemini) | R$ 800 | Cota controlada por `GEMINI_RPM` e limite por usuário |
| Notificações push, e-mail, monitoramento | R$ 400 | |
| Contas de desenvolvedor (Google Play, Apple) | R$ 60 | Rateio anual |
| Contabilidade, jurídico e conformidade (LGPD) | R$ 3.000 | |
| Marketing institucional e eventos | R$ 2.000 | |
| **Total** | **≈ R$ 46.760** | |

#### Ponto de equilíbrio

Com a receita média de um mix de contratos (ex.: 4 *Essencial* + 3 *Cidade* + 1 *Metrópole* =
R$ 50.500/mês), a operação cobre os custos com **8 contratos ativos**. A meta é chegar a esse
número em até **18 meses** após o piloto, começando por Recife e municípios da Região
Metropolitana (Olinda, Jaboatão, Paulista, Camaragibe), que têm os mesmos órgãos estaduais.

#### Ações de sustentabilidade financeira

- **Contratos anuais com reajuste por índice oficial (IPCA)** para dar previsibilidade.
- **Diversificação de clientes:** nenhum contrato deve passar de 35% da receita.
- **Controle do custo variável:** compressão de fotos, retenção por prazo definido, cache de
  métricas no Redis e limite de requisições de IA por usuário.
- **Reserva de caixa** equivalente a 6 meses de custos fixos.
- **Venda regionalizada:** um órgão estadual (COMPESA, CELPE) atende vários municípios, o que
  reduz o custo de implantação a cada nova cidade.

### 1.2 Ambiente social

**Meta:** o cidadão usa o app porque ele resolve, e a confiança no serviço público aumenta.

| Ação | Como sustenta o serviço |
|---|---|
| **Gratuidade para o cidadão** | Remove a barreira de entrada e amplia a base de usuários |
| **Transparência do andamento** (status, histórico, notificações) | O cidadão vê que a ocorrência anda e volta a usar |
| **Acessibilidade** (contraste, tamanho de fonte, leitores de tela, linguagem simples) | Inclui idosos e pessoas com deficiência, em linha com a LBI |
| **Assistente de IA em linguagem natural** | Ajuda quem tem dificuldade com formulários a consultar seus chamados |
| **Detecção de chamados similares (raio de 200 m)** | Evita duplicidade e mostra ao cidadão que o problema já está registrado |
| **Campanhas com a prefeitura e associações de bairro** | Leva o serviço a regiões com menor acesso digital |
| **Dados públicos agregados** (sem dados pessoais) | Permite controle social: imprensa, conselhos e cidadãos acompanham a gestão |

**Risco:** se o órgão não responder, o cidadão abandona o app e o serviço perde valor. Por isso o
SLA e o tempo de resposta são KPIs contratuais (seção 2) e o painel mostra os chamados atrasados.

### 1.3 Ambiente ambiental

**Meta:** o serviço reduz desperdício e impacto ambiental da manutenção urbana e da própria
operação digital.

| Ação | Impacto |
|---|---|
| **Vazamentos de água e esgoto** encaminhados direto à COMPESA com localização exata | Menos água tratada perdida e menos contaminação de vias e canais |
| **Iluminação pública** (postes acesos de dia ou apagados) | Economia de energia e segurança |
| **Saneamento básico e descarte irregular** (EMLURB) | Menos lixo acumulado, menos alagamentos por bueiros entupidos |
| **Roteamento correto na primeira vez** | Menos deslocamentos de equipes a locais errados ou ocorrências duplicadas, menos combustível |
| **Processo 100% digital** | Elimina formulários em papel e atendimento presencial |
| **Operação em nuvem eficiente** | Compressão de imagens, política de retenção de fotos, preferência por provedores com metas de energia renovável |

### 1.4 Ambiente tecnológico e operacional

**Meta:** o serviço está disponível, seguro e evolui sem quebrar o que já funciona.

| Pilar | Situação atual | Próximos passos para sustentar |
|---|---|---|
| **Qualidade** | Testes unitários, de API, E2E (Playwright) e de tela (Maestro); Quality Gate no GitHub Actions bloqueia merge com falha; regressão diária | Manter cobertura mínima como critério de pronto |
| **Arquitetura** | App MVVM em React Native/Expo; API Express + Prisma + PostgreSQL; Redis opcional para cache de métricas | Separar ambientes (desenvolvimento, homologação, produção) |
| **Armazenamento** | Fotos no disco do servidor (`backend/uploads/`) | Migrar para armazenamento de objetos em nuvem com backup e CDN |
| **Segurança** | JWT com refresh token e revogação; perfis hierárquicos (Cidadão, Gestor, Admin) | Rate limiting, varredura de dependências, testes de intrusão anuais, criptografia de dados em repouso |
| **Disponibilidade** | Health check (`/health`) | Monitoramento, alertas, backups diários com teste de restauração, plano de recuperação de desastre |
| **Métricas** | Job agendado consolida métricas em `metrics_snapshot` | Painel de BI por município e exportação de dados abertos |
| **IA** | Gemini com function calling, controle de cota e nova tentativa em `429` | Abstração do provedor de IA para evitar dependência de um único fornecedor |
| **Dependência de fornecedores** | Expo, Google, provedores de nuvem | Uso de tecnologias abertas (PostgreSQL, Node.js) e contratos com portabilidade de dados |

### 1.5 Ambiente institucional e político

**Meta:** o serviço sobrevive à troca de gestão e se torna parte da rotina do órgão público.

| Risco | Ação de mitigação |
|---|---|
| Troca de prefeito ou secretário encerra o contrato | Mostrar resultados com indicadores públicos; envolver servidores de carreira, não só cargos comissionados |
| Processo de contratação pública longo | Usar modalidades adequadas (CPSI, pregão, adesão a ata de registro de preços) e começar por pilotos |
| Resistência interna dos órgãos | Treinamento, painel simples, ganho visível de produtividade; o gestor deixa de receber demanda fora da sua competência |
| Conflito de competência entre órgãos municipais e estaduais | Regras de competência configuráveis (órgão principal e secundário) acordadas com cada órgão |
| Uso político dos dados | Dados agregados e públicos, regras claras de acesso e publicação |

### 1.6 Roadmap de sustentabilidade

| Fase | Período | Entregas | Critério de sucesso |
|---|---|---|---|
| **Piloto** | Meses 0–6 | Implantação em Recife (um ou dois bairros), integração com os 6 órgãos do seed | 70% das ocorrências respondidas dentro do SLA; NPS ≥ 30 |
| **Consolidação** | Meses 6–18 | Expansão para a Região Metropolitana; armazenamento em nuvem; painel de BI | 8 contratos ativos (ponto de equilíbrio) |
| **Escala** | Meses 18–36 | Outros estados; integrações com sistemas de ouvidoria; dados abertos | Receita recorrente cobrindo custos com margem ≥ 20% |

---

## 2. KPIs do negócio

Os indicadores estão divididos em cinco grupos. Vários já podem ser medidos com os dados que a
plataforma guarda hoje (status, histórico de alterações, datas, categorias, órgãos) e com as rotas
de métricas (`/metrics/total-demands`, `/metrics/demands-by-category`,
`/metrics/average-response-time`) e o painel do gestor (`/gestor/dashboard`).

### 2.1 Indicador norte (North Star)

> **Percentual de ocorrências resolvidas dentro do SLA.**

É o indicador que resume o valor da plataforma: o cidadão teve o problema resolvido, o órgão
cumpriu o prazo e o município tem evidência disso. Meta: **≥ 80%** após a fase de piloto.

### 2.2 KPIs de efetividade do serviço público

| KPI | Fórmula | Meta | Fonte |
|---|---|---|---|
| **Taxa de resolução** | Ocorrências `Resolvido` ou `Fechado` ÷ total registradas no período | ≥ 75% em 90 dias | Status do chamado |
| **Cumprimento de SLA** | Resolvidas no prazo ÷ total resolvidas | ≥ 80% | Datas + SLA da categoria/prioridade |
| **Tempo médio de primeira resposta** | Média (data da 1ª mudança de status − data de abertura) | ≤ 48 h | Histórico (`logs`) |
| **Tempo médio de resolução** | Média (data de `Resolvido` − data de abertura), por categoria e prioridade | Crítica ≤ 24 h; Alta ≤ 72 h; Média ≤ 7 dias; Baixa ≤ 15 dias | Histórico |
| **Backlog atrasado** | Ocorrências abertas fora do SLA ÷ ocorrências abertas | ≤ 15% | Filtro `Atrasados` do gestor |
| **Taxa de roteamento correto** | Ocorrências que não precisaram ser redirecionadas a outro órgão ÷ total | ≥ 95% | Histórico de órgão responsável |
| **Taxa de reabertura** | Ocorrências reabertas após `Resolvido` ÷ total resolvidas | ≤ 5% | Histórico |
| **Taxa de duplicidade evitada** | Registros desistidos ou vinculados após aviso de chamado similar ÷ avisos exibidos | Acompanhar tendência | Busca de similares (200 m) |

### 2.3 KPIs de engajamento e satisfação do cidadão

| KPI | Fórmula | Meta |
|---|---|---|
| **Usuários ativos mensais (MAU)** | Cidadãos que abriram o app ou registraram ocorrência no mês | Crescimento ≥ 10% ao mês no piloto |
| **Adesão por habitante** | Cidadãos cadastrados ÷ população do município | ≥ 2% no primeiro ano |
| **Conversão cadastro → 1ª ocorrência** | Cidadãos com ≥ 1 ocorrência ÷ cadastrados | ≥ 50% |
| **Retenção em 90 dias** | Cidadãos que registram ou consultam novamente em até 90 dias | ≥ 35% |
| **Satisfação (CSAT)** | Média da avaliação de 1 a 5 ao fechar a ocorrência | ≥ 4,0 |
| **NPS** | % promotores − % detratores | ≥ 30 no piloto; ≥ 50 em escala |
| **Uso do Assistente de IA** | Conversas com o assistente ÷ MAU | Acompanhar; meta de satisfação da resposta ≥ 80% |

### 2.4 KPIs operacionais e de tecnologia

| KPI | Fórmula | Meta |
|---|---|---|
| **Disponibilidade da API** | Tempo no ar ÷ tempo total do mês | ≥ 99,5% |
| **Latência (p95)** | Percentil 95 do tempo de resposta das rotas principais | ≤ 800 ms |
| **Sessões sem falha (crash-free)** | Sessões sem travamento ÷ total de sessões no app | ≥ 99% |
| **Taxa de sucesso dos testes no pipeline** | Execuções verdes do Quality Gate ÷ total | ≥ 95% |
| **Tempo médio de recuperação (MTTR)** | Média do tempo entre o início e o fim de um incidente | ≤ 2 h |
| **Precisão da triagem por IA** | Classificações (categoria/órgão) aceitas pelo gestor sem correção ÷ total | ≥ 90% |
| **Custo de infraestrutura por ocorrência** | Custo mensal de nuvem + IA ÷ ocorrências do mês | Tendência de queda |

### 2.5 KPIs financeiros e comerciais

| KPI | Fórmula | Meta |
|---|---|---|
| **MRR / ARR** | Soma das mensalidades ativas (× 12 para ARR) | Ponto de equilíbrio em 18 meses |
| **Contratos ativos** | Número de órgãos/municípios com assinatura vigente | 8 em 18 meses |
| **Churn de contratos** | Contratos não renovados ÷ contratos a vencer no período | ≤ 10% ao ano |
| **CAC** (custo de aquisição de cliente) | Custo comercial e de implantação ÷ novos contratos | ≤ 6 meses de mensalidade |
| **LTV** (valor do cliente no tempo) | Mensalidade média × margem bruta × tempo médio de contrato | LTV/CAC ≥ 3 |
| **Margem bruta** | (Receita − custos diretos de operação) ÷ receita | ≥ 70% |
| **Concentração de receita** | Maior contrato ÷ receita total | ≤ 35% |

### 2.6 KPIs de impacto para o município (valor da plataforma)

Estes indicadores são o argumento de venda e de renovação do contrato: mostram o que o município
ganha com o Fiscalize.

| KPI | Como medir |
|---|---|
| **Ocorrências por 10 mil habitantes, por bairro** | Mapa de calor que orienta o planejamento de manutenção preventiva |
| **Redução de atendimento telefônico/presencial** | Comparação com o volume do canal anterior (ex.: 156) antes e depois da implantação |
| **Redução do tempo de resolução** | Comparação com a linha de base medida no início do piloto |
| **Horas de equipe economizadas** | Deslocamentos evitados por roteamento correto e duplicidades evitadas |
| **Índice de transparência** | % de ocorrências com status público atualizado nos últimos 7 dias |

### 2.7 Acompanhamento

| Frequência | Quem acompanha | Indicadores |
|---|---|---|
| **Diária** | Equipe técnica | Disponibilidade, latência, erros, pipeline |
| **Semanal** | Gestores dos órgãos | Backlog atrasado, tempo de primeira resposta, fila por responsável |
| **Mensal** | Prefeitura + equipe Fiscalize | North Star, SLA, resolução, CSAT/NPS, MAU, custo por ocorrência |
| **Trimestral** | Direção do negócio | MRR, churn, CAC, LTV, margem, impacto no município |

---

## 3. Aspectos legais do negócio

O Fiscalize trata dados pessoais de cidadãos (nome, e-mail, localização e fotos), presta serviço a
órgãos públicos e usa IA de terceiros. Por isso precisa estar em conformidade com as normas abaixo.

> Este levantamento tem finalidade acadêmica e de planejamento. Antes da operação comercial, deve
> ser revisado por advogado especializado em direito digital e contratações públicas.

### 3.1 Constituição jurídica da empresa

| Aspecto | Definição |
|---|---|
| **Natureza jurídica** | Sociedade Limitada (LTDA) ou Sociedade Limitada Unipessoal, com CNPJ |
| **Enquadramento como startup** | Lei Complementar nº 182/2021 (Marco Legal das Startups), que permite o **Contrato Público para Solução Inovadora (CPSI)** com a administração pública |
| **Regime tributário** | Simples Nacional na fase inicial (Anexo III ou V, conforme o fator R); avaliar Lucro Presumido com o crescimento |
| **Tributos sobre a receita** | ISS sobre licenciamento/cessão de uso de software (LC nº 116/2003, item 1.05) e tributos federais; acompanhar a transição da **Reforma Tributária** (EC nº 132/2023 e LC nº 214/2025: IBS e CBS) |
| **Regularidade fiscal** | Certidões negativas (federal, estadual, municipal, FGTS e trabalhista) são exigidas para contratar com o poder público |
| **Acordo de sócios** | Participação, vesting, propriedade intelectual e saída de sócios |

### 3.2 Proteção de dados pessoais — LGPD (Lei nº 13.709/2018)

É o tema legal mais importante do serviço.

| Ponto | Como o Fiscalize atende |
|---|---|
| **Papéis** | O **órgão público contratante é o controlador** dos dados das ocorrências do seu município; o **Fiscalize é operador** (trata dados em nome do órgão). Para a conta do cidadão no app, avaliar controladoria conjunta, definida em contrato |
| **Bases legais** | Execução de políticas públicas pela administração (art. 7º, III, e art. 23); execução de contrato/termos de uso para a conta do cidadão (art. 7º, V); consentimento para usos opcionais, como notificações de marketing (art. 7º, I) |
| **Dados tratados** | Nome, e-mail, senha (armazenada com hash), localização da ocorrência, fotos, token de push e histórico de chamados |
| **Minimização** | Somente os dados necessários; a busca de chamados similares devolve **apenas protocolo, distância e status**, sem dados pessoais |
| **Fotos e localização** | Orientar o cidadão a não fotografar pessoas ou placas de veículos; avaliar desfoque automático de rostos e placas antes de publicar qualquer imagem |
| **Termos de uso e política de privacidade** | Aceite versionado já registrado no banco (`termosversao`, `termosaceitoem`); nova versão exige novo aceite |
| **Direitos do titular** (art. 18) | Canal para acesso, correção, portabilidade, anonimização e exclusão da conta, respeitando a guarda obrigatória de registros públicos |
| **Segurança** (art. 46) | Controle de acesso por perfil, JWT com revogação, criptografia em trânsito (HTTPS) e em repouso, backups, registro de acessos |
| **Encarregado (DPO)** | Indicar encarregado e publicar o canal de contato (art. 41) |
| **Relatório de Impacto (RIPD)** | Elaborar relatório de impacto, pois há tratamento de localização e uso de IA (art. 38) |
| **Incidentes** | Plano de resposta e comunicação à ANPD e aos titulares em prazo razoável (art. 48 e Resolução CD/ANPD nº 15/2024) |
| **Retenção** | Prazos definidos por tipo de dado; anonimização das ocorrências antigas para uso estatístico |
| **Crianças e adolescentes** (art. 14) | Cadastro restrito a maiores de 18 anos ou com consentimento do responsável |
| **Transferência internacional** (art. 33) | O Assistente de IA usa a Gemini API (Google); avaliar onde os dados são processados, usar cláusulas contratuais (Resolução CD/ANPD nº 19/2024) e **não enviar dados pessoais desnecessários ao modelo** |

### 3.3 Internet, serviço público digital e transparência

| Norma | Aplicação ao Fiscalize |
|---|---|
| **Marco Civil da Internet** (Lei nº 12.965/2014) | Guarda dos registros de acesso a aplicações por 6 meses (art. 15), sigilo das comunicações, termos claros |
| **Código de Defesa do Usuário do Serviço Público** (Lei nº 13.460/2017) | Direito do usuário de apresentar manifestações e receber resposta; o Fiscalize funciona como canal digital que apoia a ouvidoria e os prazos de resposta do órgão |
| **Lei do Governo Digital** (Lei nº 14.129/2021) | Prestação digital de serviços públicos, interoperabilidade, dados abertos e transparência; reforça o valor da plataforma para o órgão |
| **Lei de Acesso à Informação** (Lei nº 12.527/2011) | Dados agregados das ocorrências podem ser publicados como transparência ativa; dados pessoais seguem protegidos (art. 31) |
| **Lei Brasileira de Inclusão** (Lei nº 13.146/2015) | Acessibilidade obrigatória em serviços digitais (art. 63); seguir o eMAG e as diretrizes WCAG |
| **Crimes informáticos** (Lei nº 12.737/2012) | Proteção contra invasão de dispositivos e sistemas; base para tratar incidentes |
| **Uso indevido pelo cidadão** | Termos de uso proíbem conteúdo ofensivo, falso ou de terceiros; o gestor pode recusar/fechar ocorrências e o Admin pode inativar contas |

### 3.4 Contratação pela administração pública

| Aspecto | Definição |
|---|---|
| **Lei de Licitações e Contratos** (Lei nº 14.133/2021) | Modalidades possíveis: pregão eletrônico para software como serviço, adesão a ata de registro de preços, dispensa por valor nos pilotos menores |
| **CPSI** (LC nº 182/2021, arts. 13 a 15) | Contratação de solução inovadora em teste por até 12 meses (prorrogável), com possibilidade de contrato de fornecimento depois, sem nova licitação |
| **Contrato e SLA** | Cláusulas de disponibilidade, suporte, multas, reajuste, confidencialidade, LGPD (cláusula de operador) e **devolução/portabilidade dos dados ao fim do contrato** |
| **Responsabilidade fiscal** (LC nº 101/2000) | O órgão precisa ter dotação orçamentária; contratos plurianuais exigem previsão no PPA e na LOA |
| **Anticorrupção** (Lei nº 12.846/2013) | Programa de integridade e conduta ética nas relações com agentes públicos |

### 3.5 Propriedade intelectual

| Aspecto | Definição |
|---|---|
| **Software** (Lei nº 9.609/1998) | Código-fonte é protegido por direito autoral; registro opcional no INPI para facilitar a prova de autoria |
| **Marca "Fiscalize"** (Lei nº 9.279/1996) | Pesquisa de anterioridade e registro no INPI nas classes de software (9) e serviços de TI (42) |
| **Contratos com colaboradores** | Cláusula de cessão de direitos sobre o código desenvolvido para a empresa |
| **Licenças de terceiros** | Inventário das bibliotecas de código aberto (React Native, Expo, Express, Prisma) e respeito às licenças (MIT, Apache etc.) |
| **Conteúdo enviado pelo cidadão** | Termos de uso com licença de uso das fotos e descrições para a finalidade do serviço |

### 3.6 Inteligência artificial

| Aspecto | Definição |
|---|---|
| **Termos da Gemini API** | Respeitar os termos e políticas de uso do Google; no plano pago, os dados não são usados para treinar o modelo — preferir esse plano em produção |
| **Transparência** | Informar ao cidadão que o assistente é uma IA e que a decisão final sobre a ocorrência é de um gestor humano |
| **Revisão humana** | Classificação, prioridade e roteamento sugeridos pela IA podem ser corrigidos pelo gestor (art. 20 da LGPD: direito de revisão de decisões automatizadas) |
| **Regulação em discussão** | Acompanhar o PL nº 2.338/2023 (marco legal da IA no Brasil) e adequar o produto à classificação de risco que for aprovada |

### 3.7 Lojas de aplicativos e relações de consumo

| Aspecto | Definição |
|---|---|
| **Google Play e App Store** | Política de privacidade publicada, formulário de segurança de dados (Data Safety / Privacy Nutrition Labels), justificativa para uso de câmera e localização, opção de exclusão de conta dentro do app |
| **Código de Defesa do Consumidor** (Lei nº 8.078/1990) | Aplicável à relação com o cidadão no que couber: informação clara, termos acessíveis, canal de atendimento |

### 3.8 Matriz de riscos legais

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Vazamento de dados pessoais | Média | Alto | Segurança por padrão, criptografia, testes de intrusão, plano de incidentes |
| Foto com rosto ou placa exposta publicamente | Média | Médio | Orientação no app, moderação pelo gestor, desfoque automático |
| Dado pessoal enviado ao modelo de IA sem necessidade | Média | Médio | Ferramentas da IA retornam só protocolo, distância e status; filtros antes do envio |
| Contrato público encerrado por troca de gestão | Média | Alto | Indicadores de impacto, contratos plurianuais, base diversificada de clientes |
| Uso da marca por terceiros | Baixa | Médio | Registro da marca no INPI |
| Descumprimento de acessibilidade | Média | Médio | Testes de acessibilidade no ciclo de qualidade |

---

## 4. Conclusão: viabilidade e valor da plataforma

O Fiscalize é viável porque:

1. **Resolve uma dor real dos dois lados:** o cidadão quer ser ouvido e acompanhar; o órgão quer
   receber a demanda certa, com local e foto, e provar que respondeu.
2. **Tem um modelo de receita recorrente e escalável:** a assinatura B2G cobre a operação com cerca
   de 8 contratos, e cada novo município reaproveita os órgãos estaduais e as regras de competência
   já cadastradas.
3. **É sustentável nos cinco ambientes:** econômico (receita recorrente e custo controlado), social
   (gratuidade, transparência, acessibilidade), ambiental (menos desperdício de água, energia e
   deslocamentos), tecnológico (qualidade automatizada, segurança, plano de evolução) e
   institucional (indicadores que sobrevivem à troca de gestão).
4. **Mede o próprio valor:** o indicador norte — ocorrências resolvidas dentro do SLA — e os KPIs de
   impacto transformam o uso do app em evidência para a renovação do contrato.
5. **Nasce em conformidade:** LGPD, Lei do Governo Digital, Código de Defesa do Usuário do Serviço
   Público e Marco Legal das Startups dão base jurídica para operar e para vender ao poder público.

O valor da plataforma está em transformar reclamações dispersas em **dados de gestão urbana**:
cada ocorrência registrada ajuda a cidade a consertar mais rápido hoje e a planejar melhor amanhã.
