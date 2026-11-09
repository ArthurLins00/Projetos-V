# Negócios na Internet

| | |
|---|---|
| **Papel no PI** | Estruturar o modelo de negócio digital da plataforma no setor público: proposta de valor, jornada, indicadores e aspectos legais |
| **Documento principal** | [`Sustentabilidade_KPIs_e_Aspectos_Legais.md`](Sustentabilidade_KPIs_e_Aspectos_Legais.md) |
| **Conexões** | orienta o [Mobile](../desenvolvimento-mobile/README.md) sobre a jornada e as funcionalidades de maior valor; usa os indicadores da camada de [Dados](../engenharia-de-dados/README.md); alinha com [Segurança](../seguranca-da-informacao/README.md) a LGPD; os KPIs operacionais conversam com as métricas de [Testes](../testes-automatizados/Metricas_de_Qualidade.md) |

O Fiscalize conecta o cidadão que encontra um problema urbano ao órgão público responsável.
**Modelo em uma frase:** gratuito para o cidadão; assinatura **SaaS B2G** para o órgão público, que
paga pelo painel de gestão, roteamento, métricas, integrações e suporte. Região piloto: Recife/PE
(EMLURB, COMPESA, CELPE, CTTU, SINFRA e SEMC).

---

## 1. Entregas

| Unidade | Entrega | Data | Onde está |
|---|---|---|---|
| U1 | 1 · Canvas Preliminar | 1/9 | [`Canvas_Preliminar.pdf`](Canvas_Preliminar.pdf); versão resumida e atualizada no [Canvas resumido](Sustentabilidade_KPIs_e_Aspectos_Legais.md#canvas-resumido) |
| U1 | 2 · Personas, Mapa de Stakeholders e Jornada do usuário | 15/9 | não versionada no repositório; atores e dores em [Para quem o serviço gera valor](Sustentabilidade_KPIs_e_Aspectos_Legais.md#para-quem-o-serviço-gera-valor) |
| U2 | 3 · Business Model Canvas definitivo | 3/11 | [`Canvas_Fiscalize_Final.pdf`](Canvas_Fiscalize_Final.pdf); base do [Canvas resumido](Sustentabilidade_KPIs_e_Aspectos_Legais.md#canvas-resumido) |
| U2 | 4 · Plano de Sustentabilidade com KPIs e aspectos legais | 17/11 | [`Sustentabilidade_KPIs_e_Aspectos_Legais.md`](Sustentabilidade_KPIs_e_Aspectos_Legais.md) |

> Os canvas das entregas 1 e 3 são cópias dos PDFs da pasta *Negócios para a internet* do
> [Google Drive do projeto](https://drive.google.com/drive/folders/1ruVWIh-5do4PJhHOyn6VlWD9lQpdOxHB).
> Os arquivos visuais da entrega 2 (personas, mapa de stakeholders e jornada) ainda não estão versionados;
> para versioná-los, adicione os PDFs ou imagens nesta pasta e atualize a tabela acima.

### O que o plano de sustentabilidade cobre

| Seção | Conteúdo |
|---|---|
| 0 | Proposta de valor por ator (cidadão, gestor, prefeitura, concessionárias) e canvas resumido |
| 1 | Sustentabilidade em cinco ambientes: econômico-financeiro (receitas, preços por faixa populacional, custos, ponto de equilíbrio), social, ambiental, tecnológico-operacional e institucional-político; roadmap piloto → consolidação → escala |
| 2 | KPIs: indicador norte, efetividade do serviço público, engajamento, operação e tecnologia, financeiros e impacto para o município |
| 3 | Aspectos legais: constituição da empresa, LGPD, Marco Civil e Lei de Acesso à Informação, contratação pública (Lei 14.133 e CPSI do Marco Legal das Startups), propriedade intelectual, IA, lojas de apps e matriz de riscos legais |
| 4 | Conclusão sobre viabilidade e valor da plataforma |

---

## 2. Da estratégia ao produto

Cada decisão de negócio virou uma funcionalidade no app ou no backend:

| Decisão de negócio | Funcionalidade | Onde |
|---|---|---|
| "Ocorrência certa, no órgão certo" | Roteamento automático por **regras de competência** (categoria × região → órgão) | `routingRuleService.ts`, tela de regras do admin |
| Transparência para o cidadão | Protocolo, linha do tempo, notificações push/e-mail/in-app a cada mudança de status | `timeline_event`, `notificationService.ts` |
| Gestão por indicadores para o órgão | Painel do gestor: total, concluídas, tempo médio, distribuição por categoria | `MetricsPanel.tsx`, rotas `/metrics` |
| Evitar duplicidade | Busca de chamados similares num raio de 200 m (agente de IA) | `ai-agent/src/tools/buscarChamadosSimilares.ts` |
| Inclusão de quem tem dificuldade com formulários | Assistente em linguagem natural | [IA Aplicada](../ia-aplicada/README.md) |
| Gratuidade e baixa fricção | Cadastro simples, 2FA opcional para o cidadão | [Segurança](../seguranca-da-informacao/README.md) |
| Conformidade como valor de venda ao setor público | Termos versionados, minimização de dados, auditoria | [Segurança](../seguranca-da-informacao/README.md) |

---

## 3. Tecnologias e escolhas que sustentam o modelo de negócio

### 3.1 Modelo SaaS B2G (assinatura por faixa populacional)

- **Como:** o órgão público assina o serviço; o cidadão usa de graça. Preços por porte do município,
  taxa de implantação e módulos adicionais (integrações, BI, IA com cota ampliada).
- **Por quê:** quem tem orçamento e se beneficia da eficiência é o órgão; cobrar do cidadão
  derrubaria a adesão e, com ela, a base de dados que dá valor ao painel.
- **Descartados:**
  - **Publicidade no app:** coleta comportamental incompatível com um serviço público e com a LGPD,
    e degrada a confiança.
  - **Venda de dados:** vedada pela finalidade declarada à LGPD; só dados **agregados e anônimos** são
    publicados, como transparência.
  - **Licença perpétua *on-premise*:** cada prefeitura teria que operar servidor próprio, o que encarece
    a implantação e fragmenta as versões.

### 3.2 App nativo nas lojas (React Native + Expo)

- **Por quê:** câmera e GPS são o coração do registro; o canal "loja de aplicativos" dá credibilidade
  e notificações push confiáveis.
- **Descartado:** só portal web ou WhatsApp. O portal perde acesso confiável a câmera/GPS em campo; o
  WhatsApp não oferece fila estruturada, SLA nem painel ao gestor. Detalhes técnicos em [Mobile](../desenvolvimento-mobile/README.md).

### 3.3 Nuvem com tecnologias abertas (Node.js, PostgreSQL)

- **Por quê:** escala com o número de municípios sem investimento inicial em infraestrutura; tecnologias
  abertas reduzem a dependência de fornecedor, um risco apontado no ambiente tecnológico do plano.
- **Descartado:** *Backend-as-a-Service* proprietário (Firebase), pelo aprisionamento ao fornecedor e
  pela dificuldade de garantir portabilidade de dados exigida em contrato público.

### 3.4 Indicadores calculados pela própria plataforma

- **Como:** o job de consolidação grava *snapshots* em `metrics_snapshot` e o painel lê do cache Redis
  ([Dados](../engenharia-de-dados/README.md)).
- **Por quê:** os KPIs do plano (taxa de resolução, tempo médio, distribuição por categoria) saem do
  mesmo banco operacional, sem digitação manual.
- **Descartado:** ferramenta de BI externa (Power BI, Looker) já no piloto: custo de licença e envio de
  dados a mais um fornecedor. Fica como módulo adicional pago na fase de consolidação.

### 3.5 IA generativa (Google Gemini)

- **Por quê:** diferencial de acessibilidade e de redução de duplicidade com custo por uso; o Gemini
  tem camada gratuita para o piloto. Escolha técnica detalhada em [IA Aplicada](../ia-aplicada/README.md).
- **Risco de negócio tratado:** dependência de um único provedor de IA. O agente depende de uma
  interface (`ModelClient`), o que permite trocar de provedor (seção 1.4 do plano).

---

## 4. KPIs principais

Lista completa e fórmulas na seção 2 do [plano](Sustentabilidade_KPIs_e_Aspectos_Legais.md#2-kpis-do-negócio).

| KPI | Meta |
|---|---|
| Taxa de resolução | ≥ 75% em 90 dias |
| Cumprimento de SLA | ≥ 80% |
| Tempo médio de primeira resposta | ≤ 48 h |
| Backlog atrasado | ≤ 15% |
| Taxa de roteamento correto | ≥ 95% |
| Taxa de reabertura | ≤ 5% |
| Usuários ativos mensais (piloto) | crescimento ≥ 10% ao mês |
