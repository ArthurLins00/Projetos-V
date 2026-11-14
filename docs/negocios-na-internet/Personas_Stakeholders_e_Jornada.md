# Fiscalize — Personas, Mapa de Stakeholders e Jornada do Usuário

> **Entrega 2 de Negócios na Internet (U1).** Quem usa o Fiscalize, quem influencia ou é afetado por ele e como
> o cidadão vai do problema na rua à resolução. Base para o [Canvas](Canvas_Fiscalize_Final.pdf) e para o
> [Plano de Sustentabilidade](Sustentabilidade_KPIs_e_Aspectos_Legais.md); as funcionalidades citadas existem no app
> e no backend deste repositório.

| | |
|---|---|
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Turma** | 5º Período de ADS Regular — Grupo 6 |
| **Região piloto** | Recife/PE (EMLURB, COMPESA, CELPE, CTTU, SINFRA e SEMC) |

As personas são **arquétipos fictícios**, montados a partir das dores levantadas pela equipe para cada perfil do
sistema (Cidadão, Gestor e Admin); nomes e detalhes não se referem a pessoas reais.

---

## Sumário

1. [Personas](#1-personas)
2. [Mapa de stakeholders](#2-mapa-de-stakeholders)
3. [Jornada do cidadão: do registro à resolução](#3-jornada-do-cidadão-do-registro-à-resolução)
4. [Como as personas aparecem no produto](#4-como-as-personas-aparecem-no-produto)

---

## 1. Personas

### 1.1 Cidadã — Ana, 34 anos, técnica de enfermagem (perfil **Cidadão**)

| | |
|---|---|
| **Contexto** | Mora em Afogados e trabalha em plantões de 12 horas. Vai a pé até a parada de ônibus, de madrugada. |
| **Tecnologia** | Celular Android intermediário, plano de dados limitado; usa WhatsApp, Instagram e o app do banco. |
| **Objetivo** | Ver resolvido o poste apagado da rua dela e saber quando vai ser consertado. |
| **Dores** | Não sabe se o poste é da prefeitura ou da concessionária; já ligou para o 156, esperou na linha e nunca recebeu retorno; reclamar em rede social não gera protocolo. |
| **Frase** | "Eu reclamo, mas parece que cai num buraco negro." |
| **O que ela precisa do Fiscalize** | Registrar em menos de um minuto, sem saber qual órgão é o responsável; protocolo; aviso a cada mudança de status; funcionar com internet ruim. |
| **Critério de sucesso** | Recebe a notificação "Resolvido" com a descrição do que foi feito. |

### 1.2 Cidadão idoso — Seu Raimundo, 67 anos, aposentado (perfil **Cidadão**)

| | |
|---|---|
| **Contexto** | Mora em Casa Amarela, participa da associação de moradores e leva as reclamações do bairro à prefeitura. |
| **Tecnologia** | Usa o celular para ligações e áudios; tem dificuldade com formulários longos e letras pequenas. |
| **Objetivo** | Registrar os problemas que os vizinhos relatam e cobrar com um número de protocolo. |
| **Dores** | Formulários com muitos campos; não sabe escolher categoria técnica ("drenagem" ou "saneamento"?); medo de registrar a mesma coisa duas vezes. |
| **Frase** | "Eu sei explicar o problema, só não sei preencher o formulário." |
| **O que ele precisa do Fiscalize** | Descrever o problema em linguagem natural; ver se o problema já foi registrado perto dali; tema e tamanho de texto legíveis. |
| **Critério de sucesso** | Registra pelo Assistente sem ajuda e acompanha o protocolo na reunião da associação. |

### 1.3 Gestor de órgão — Carla, 41 anos, coordenadora de manutenção (perfil **Gestor**)

| | |
|---|---|
| **Contexto** | Coordena as equipes de campo de um órgão de manutenção urbana; responde ao secretário pelo prazo de atendimento. |
| **Tecnologia** | Notebook no escritório e celular em campo; planilhas e e-mail. |
| **Objetivo** | Distribuir as ocorrências para as equipes, cumprir o prazo e mostrar resultado. |
| **Dores** | Demandas chegam por telefone, e-mail, ouvidoria e redes sociais, sem foto nem localização exata; muitas são de outro órgão; não consegue medir tempo de atendimento. |
| **Frase** | "Metade do meu dia é descobrir onde fica o problema e se ele é mesmo nosso." |
| **O que ela precisa do Fiscalize** | Fila única com foto, GPS, prioridade e prazo (SLA); atribuir a um membro da equipe; transferir o que não é do órgão; indicadores por categoria e tempo médio. |
| **Critério de sucesso** | Fecha o mês com o painel mostrando tempo médio dentro da meta e poucos chamados vencidos. |

### 1.4 Administrador da plataforma — Rafael, 29 anos, analista de TI da prefeitura (perfil **Admin**)

| | |
|---|---|
| **Contexto** | Responsável pelos sistemas da secretaria e pela implantação do Fiscalize no município. |
| **Tecnologia** | Alta familiaridade; preocupado com segurança, LGPD e auditoria. |
| **Objetivo** | Manter usuários, perfis, órgãos e regras de competência corretos para o roteamento funcionar. |
| **Dores** | Sistemas antigos sem controle de acesso por perfil; cobrança da controladoria sobre quem alterou o quê; medo de vazamento de dados de cidadãos. |
| **Frase** | "Se o roteamento estiver errado, a culpa do atraso vem para a TI." |
| **O que ele precisa do Fiscalize** | Gestão de usuários e perfis; regras de competência (categoria × região → órgão); termos versionados; registros de acesso; 2FA. |
| **Critério de sucesso** | Novos órgãos entram em operação sem chamado de suporte e a auditoria encontra o histórico completo. |

### 1.5 Tomador de decisão — Secretária Helena, 52 anos, secretária de serviços urbanos (cliente pagante)

| | |
|---|---|
| **Contexto** | Decide a contratação e presta contas ao prefeito, à Câmara e ao Tribunal de Contas. |
| **Objetivo** | Melhorar a percepção de zeladoria da cidade e justificar o orçamento de manutenção com dados. |
| **Dores** | Não sabe onde a cidade "quebra" mais; pressão da imprensa e das redes; contratos de TI caros e difíceis de medir. |
| **O que ela precisa do Fiscalize** | Indicadores por bairro, categoria e órgão; relatórios de prestação de contas; contrato com SLA e conformidade com a LGPD. |
| **Critério de sucesso** | Renova a assinatura com base nos KPIs de efetividade (ver [KPIs](Sustentabilidade_KPIs_e_Aspectos_Legais.md#2-kpis-do-negócio)). |

---

## 2. Mapa de stakeholders

### 2.1 Matriz poder × interesse

```
                        INTERESSE NO FISCALIZE
                 baixo                              alto
           ┌──────────────────────────┬──────────────────────────────┐
           │ MANTER SATISFEITOS       │ GERENCIAR DE PERTO           │
     alto  │ • Tribunal de Contas /   │ • Prefeitura / Secretaria de │
           │   Controladoria          │   Serviços Urbanos (cliente) │
 PODER     │ • ANPD                   │ • Órgãos municipais (EMLURB, │
           │ • Câmara de Vereadores   │   CTTU, SINFRA, SEMC)        │
           │ • Lojas de apps          │ • Concessionárias (COMPESA,  │
           │   (Google, Apple)        │   CELPE)                     │
           ├──────────────────────────┼──────────────────────────────┤
           │ MONITORAR                │ MANTER INFORMADOS            │
    baixo  │ • Imprensa local         │ • Cidadãos (usuários)        │
           │ • Fornecedores de nuvem  │ • Associações de moradores   │
           │   e de IA (Google)       │ • Equipes de campo dos órgãos│
           │ • Universidades          │ • Ouvidoria municipal / 156  │
           └──────────────────────────┴──────────────────────────────┘
```

### 2.2 Stakeholders, interesses e estratégia de relacionamento

| Stakeholder | Tipo | Interesse | Influência sobre o negócio | Estratégia |
|---|---|---|---|---|
| **Prefeitura / Secretaria de Serviços Urbanos** | Cliente pagante | Zeladoria eficiente, transparência e dados para planejar | Decide contratação e renovação | Implantação assistida, relatórios periódicos, KPIs de efetividade no contrato |
| **Órgãos municipais** (EMLURB, CTTU, SINFRA, SEMC) | Usuário-gestor | Fila única, menos retrabalho, cumprir SLA | Adoção diária define o sucesso | Treinamento de gestores, painel com indicadores, transferência entre órgãos |
| **Concessionárias e órgãos estaduais** (COMPESA, CELPE) | Parceiro / cliente | Receber só o que é da sua competência | Sem adesão, parte das ocorrências fica sem destino | Regras de competência, integração futura com os sistemas deles |
| **Cidadãos** | Usuário final | Registrar fácil e ver resolvido | Volume e reputação nas lojas | App gratuito, notificações, Assistente de IA, modo offline |
| **Associações de moradores** | Influenciador | Cobrar o bairro com protocolo | Multiplicam a adoção | Divulgação comunitária, registro em nome do bairro |
| **Equipes de campo** | Usuário indireto | Saber onde é e o que fazer | Qualidade do atendimento | Foto, GPS e mapa no chamado |
| **Ouvidoria / Central 156** | Canal existente | Reduzir ligações repetidas | Pode ver o app como concorrente | Posicionar como canal complementar, com o mesmo protocolo |
| **Tribunal de Contas / Controladoria** | Regulador | Legalidade da contratação e uso de recursos | Pode barrar contrato | Contratação pela Lei 14.133 ou CPSI, transparência dos indicadores |
| **ANPD** | Regulador | Proteção de dados pessoais | Sanções pela LGPD | Minimização, termos versionados, RIPD, encarregado (ver [aspectos legais](Sustentabilidade_KPIs_e_Aspectos_Legais.md#3-aspectos-legais-do-negócio)) |
| **Câmara de Vereadores** | Influenciador político | Atender o eleitor | Pressão por funcionalidades e por bairro | Relatórios públicos por região |
| **Lojas de aplicativos** | Plataforma | Políticas de privacidade e qualidade | Publicação e atualização do app | Política de privacidade, permissões justificadas, atualizações OTA |
| **Fornecedores de nuvem e IA** (Google Gemini) | Fornecedor | Uso contínuo e pago | Custo variável e dependência | Controle de cota, abstração do provedor |
| **Imprensa local** | Influenciador | Pautas sobre a cidade | Reputação do cliente | Dados abertos e casos de sucesso |
| **Universidades** | Parceiro | Pesquisa e inovação pública | Credibilidade e talentos | Parcerias e uso dos dados anonimizados |

---

## 3. Jornada do cidadão: do registro à resolução

Persona: **Ana** (1.1). Cenário: o poste em frente à casa dela está apagado há uma semana.

| Etapa | 1. Percebe o problema | 2. Descobre o Fiscalize | 3. Registra a ocorrência | 4. Encaminhamento | 5. Acompanha | 6. Resolução | 7. Pós-atendimento |
|---|---|---|---|---|---|---|---|
| **O que Ana faz** | Passa pelo poste apagado indo para o plantão | Vê a divulgação da prefeitura e instala o app pela loja | Cria a conta, toca em *Nova demanda*, tira a foto, usa o GPS e descreve o problema (ou conta ao Assistente) | Nada: recebe o protocolo e segue o dia | Recebe notificações; abre o detalhe e vê a linha do tempo | Recebe "Resolvido" com a descrição do serviço | Confere o poste aceso; recomenda o app à vizinha |
| **Pontos de contato** | Rua | Portal da prefeitura, redes, loja de apps | App: cadastro, termos, formulário, câmera, GPS, Assistente de IA | Protocolo na tela | Push, e-mail, notificações no app, lista *Minhas Demandas* | Push e linha do tempo | Loja de apps (avaliação) |
| **O que acontece por trás** | — | — | Validação dos campos e da foto; busca de chamados parecidos num raio de 200 m | Regras de competência roteiam para o órgão certo; prioridade e SLA calculados | Gestor aceita, atribui à equipe e muda o status (*Em Análise* → *Em Andamento*) | Gestor marca *Resolvido* com a nota obrigatória do que foi feito | Indicadores alimentam o painel do órgão e os KPIs |
| **Sentimento** | 😠 frustração e insegurança | 🤔 desconfiança ("mais um app?") | 🙂 alívio: foi rápido e não precisou saber o órgão | 😐 expectativa | 🙂 confiança: vê que alguém está cuidando | 😀 satisfação | 😀 lealdade |
| **Dores possíveis** | Não sabe a quem recorrer | Medo de expor dados pessoais | Internet ruim na rua; não saber a categoria | Ocorrência ir para o órgão errado | Silêncio por dias | Status "resolvido" sem o problema resolvido | — |
| **Como o Fiscalize responde** | Campanha com a mensagem "fotografe e pronto" | Termos claros, minimização de dados, gratuidade | Categorias simples, Assistente em linguagem natural, cache offline das demandas consultadas | Roteamento automático por categoria × região | Notificação a cada mudança, SLA visível para o gestor | Nota de resolução obrigatória; reabertura via novo registro | Pesquisa de satisfação (KPI de NPS) |
| **KPI relacionado** | — | Downloads, cadastros | Tempo de registro, taxa de conclusão do formulário | Taxa de roteamento correto na primeira vez | Tempo até a primeira resposta | Tempo médio de resolução, % dentro do SLA | NPS, retenção (MAU) |

### 3.1 Jornada resumida do gestor (Carla)

1. **Entra** no app com o perfil Gestor e vê a fila do órgão com filtros por status, categoria e região.
2. **Abre** o chamado: foto, mapa, descrição, prioridade e prazo (SLA) restante.
3. **Aceita** ou **atribui** a um membro da equipe; se não for competência do órgão, **transfere** com justificativa.
4. **Atualiza o status** e comenta; o cidadão é notificado a cada mudança.
5. **Resolve** com a descrição do que foi feito.
6. **Acompanha** o painel de indicadores (total, resolvidas, tempo médio, distribuição por categoria) para a reunião com a secretaria.

---

## 4. Como as personas aparecem no produto

| Persona | Necessidade | Funcionalidade | Onde |
|---|---|---|---|
| Ana | Registrar rápido sem saber o órgão | Formulário com foto, GPS e categorias; roteamento automático | [`DemandFormView.tsx`](../../mobile/src/views/DemandFormView.tsx), `routingRuleService.ts` |
| Ana | Saber o que está acontecendo | Protocolo, linha do tempo, notificações push, e-mail e no app | [`DemandDetailView.tsx`](../../mobile/src/views/DemandDetailView.tsx), [`NotificationsView.tsx`](../../mobile/src/views/NotificationsView.tsx) |
| Ana | Internet ruim | Modo offline com cache das demandas consultadas | [`offlineCache.ts`](../../mobile/src/services/offlineCache.ts) |
| Seu Raimundo | Descrever em linguagem natural | Assistente Fiscalize (IA) | [`AssistantView.tsx`](../../mobile/src/views/AssistantView.tsx), [IA Aplicada](../ia-aplicada/README.md) |
| Seu Raimundo | Não duplicar | Busca de chamados similares num raio de 200 m | `ai-agent/src/tools/buscarChamadosSimilares.ts` |
| Carla | Fila única com prazo | Painel do gestor, filtros, SLA, aceitar, atribuir, transferir | [`ManagementDashboardView.tsx`](../../mobile/src/views/ManagementDashboardView.tsx), [`ManagedTicketView.tsx`](../../mobile/src/views/ManagedTicketView.tsx) |
| Carla e Helena | Indicadores | Métricas geradas pelo pipeline de dados | [`MetricsPanel.tsx`](../../mobile/src/components/MetricsPanel.tsx), [Engenharia de Dados](../engenharia-de-dados/README.md) |
| Rafael | Controle de acesso e auditoria | Perfis hierárquicos, gestão de usuários, 2FA, termos versionados | [`AdminUsersView.tsx`](../../mobile/src/views/AdminUsersView.tsx), [Segurança](../seguranca-da-informacao/README.md) |
