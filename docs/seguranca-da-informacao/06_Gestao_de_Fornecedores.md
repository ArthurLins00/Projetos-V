# Atividade 6 — Gestão de fornecedores

| | |
|---|---|
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Disciplina** | Segurança de Dados — Unidade 2 |
| **Entrega** | 11/12 |

**Integrantes do grupo:** Felipe Cisneiros Agostinho, Ramom de Oliveira Aguiar, Arthur Borba Lins,
Victor Simas Azevedo de Almeida, Paulo Henrique Alves de Barros Pereira, Michelangelo Morais do Rego,
Bruno Dornelas Costa Ciro da Penha, João Guilherme Aires Chagas de Oliveira, Thyalles Araujo Campos,
Bruno Felipe de Castilho Gomes Rego

---

O Fiscalize depende de serviços de terceiros para hospedar a API, enviar e-mails e notificações,
rodar o assistente de IA e publicar o app. Cada fornecedor que toca dados do cidadão amplia a
superfície de risco: um vazamento no fornecedor é, perante o cidadão e a LGPD, um vazamento do
Fiscalize. Este documento define como os fornecedores são escolhidos, contratados, monitorados e
desligados.

## 1. Papéis perante a LGPD

| Agente | Quem é no Fiscalize | Responsabilidade |
|---|---|---|
| **Controlador** | Prefeitura / órgãos públicos que adotam a plataforma | Decide as finalidades do tratamento dos dados dos cidadãos |
| **Operador** | Equipe que desenvolve e mantém o Fiscalize | Trata os dados em nome do controlador, seguindo suas instruções |
| **Suboperadores** | Fornecedores listados abaixo | Tratam dados em nome do operador; só podem ser contratados com ciência do controlador |

Conforme os Arts. 39 e 42 da LGPD, o operador responde solidariamente pelos danos quando descumpre a
lei ou as instruções do controlador. Por isso, toda obrigação de segurança do Fiscalize deve ser
repassada, por contrato, aos suboperadores.

## 2. Inventário de fornecedores

| Fornecedor / serviço | Uso no Fiscalize | Dados a que tem acesso | Criticidade |
|---|---|---|---|
| **Provedor de nuvem** (hospedagem da API, PostgreSQL gerenciado, Redis, armazenamento de fotos, backups) | Infraestrutura de produção | **Todos** os dados: nome, e-mail, CPF, localização, fotos, chamados, logs | **Crítica** |
| **Google — API Gemini** | Assistente de IA para consulta de status | Mensagem digitada pelo usuário e protocolo, título e status dos chamados consultados | Alta |
| **Provedor SMTP** (Gmail/Google Workspace ou serviço transacional) | E-mails de recuperação de senha e código de 2FA | E-mail do usuário e códigos temporários | Alta |
| **Expo (EAS e Expo Push)** | Build do app e envio de notificações push | Token de push do aparelho e texto da notificação (sem dados sensíveis, Atividade 3) | Média |
| **GitHub** (repositório e GitHub Actions) | Código-fonte, CI/CD e *secrets* de pipeline | Código e segredos de integração; nenhum dado real de cidadão (os testes usam dados fictícios do *seed*) | Alta |
| **CDN / WAF** | Proteção anti-DDoS e cache de borda (Atividade 4) | Tráfego HTTP em trânsito, IPs e cabeçalhos | Alta |
| **Google Play e Apple App Store** | Distribuição do app | Dados de instalação e de *crash* coletados pelas lojas | Média |
| **Geocodificação do sistema operacional** (Google/Apple, via Expo Location) | Converter coordenadas em endereço | Coordenadas do problema no momento do registro | Média |
| **Bibliotecas open source** (npm: Express, Prisma, bcrypt, jsonwebtoken, React Native…) | Base de todo o código | Executam dentro do nosso ambiente | Alta (cadeia de suprimentos) |

O inventário é mantido atualizado: nenhum serviço externo novo entra em produção sem antes ser
registrado aqui.

## 3. Classificação de risco

Cada fornecedor recebe uma classificação que define o rigor da avaliação e do monitoramento:

| Nível | Critério | Exigências |
|---|---|---|
| **Crítico** | Acesso a dados pessoais em larga escala ou indisponibilidade derruba o serviço | Avaliação completa, contrato com DPA, revisão **semestral**, plano de saída documentado |
| **Alto** | Acesso a dados pessoais limitados ou a segredos/código | Avaliação completa, DPA, revisão **anual** |
| **Médio** | Acesso a dados mínimos ou pseudonimizados | Questionário simplificado, revisão anual |
| **Baixo** | Nenhum acesso a dados pessoais | Registro no inventário |

## 4. Due diligence antes da contratação

Antes de contratar ou integrar um fornecedor de nível médio ou superior, a equipe verifica:

1. **Certificações de segurança:** ISO/IEC 27001, SOC 2 Tipo II ou equivalentes.
2. **Localização dos dados:** em que país os dados ficam armazenados e processados. Havendo
   **transferência internacional** (comum em Google, Expo e GitHub), é preciso enquadrá-la no Art. 33
   da LGPD — cláusulas contratuais padrão, país com nível adequado de proteção ou outra hipótese
   legal — e priorizar regiões no Brasil para o banco e os backups.
3. **Criptografia:** dados cifrados em trânsito (TLS 1.2+) e em repouso (AES-256).
4. **Controle de acesso:** suporte a 2FA, SSO e permissões granulares para as contas da equipe.
5. **Uso secundário dos dados:** o fornecedor não pode usar os dados do Fiscalize para outras
   finalidades. Para a API Gemini, usar o plano/termos em que **as entradas não são usadas para
   treinar modelos**.
6. **Histórico de incidentes** e transparência na comunicação de vazamentos.
7. **Disponibilidade:** SLA publicado compatível com a meta de 99,5 % da Atividade 4.
8. **Portabilidade e saída:** possibilidade de exportar os dados em formato aberto e de exigir sua
   exclusão ao fim do contrato.

## 5. Requisitos contratuais

Todo contrato com fornecedor crítico ou alto deve conter um **Acordo de Tratamento de Dados (DPA)**
com, no mínimo:

- finalidade, duração e tipos de dados tratados;
- obrigação de seguir somente as instruções do Fiscalize/controlador;
- medidas técnicas e administrativas de segurança exigidas;
- **notificação de incidentes em até 48 horas**, para que o Fiscalize consiga comunicar a ANPD e os
  titulares em prazo razoável (Art. 48);
- proibição de subcontratar sem autorização prévia;
- direito de auditoria ou de receber relatórios de auditoria independente;
- apoio ao atendimento dos direitos dos titulares (acesso, correção, exclusão — Art. 18);
- **devolução ou eliminação dos dados** ao fim do contrato, com comprovação;
- confidencialidade para todos os funcionários do fornecedor com acesso aos dados.

## 6. Minimização dos dados enviados a cada fornecedor

O melhor controle sobre um fornecedor é não lhe entregar o que ele não precisa:

- **Assistente de IA (Gemini):** o agente recebe apenas a pergunta do usuário e, via *function
  calling*, protocolo, título e status dos chamados que o próprio usuário pode ver. **CPF, e-mail,
  nome completo e fotos nunca são enviados ao modelo.** A identidade é verificada pela própria API do
  Fiscalize, que repassa o token do usuário; o agente só é chamado com o segredo compartilhado
  `x-agent-secret`.
- **Notificações push:** o texto da notificação só cita o protocolo da demanda (Atividade 3,
  Fluxo 4), então o Expo e os serviços da Apple/Google não recebem detalhes do problema nem o
  endereço.
- **E-mail:** as mensagens contêm apenas o código temporário e instruções; nenhuma informação dos
  chamados.
- **GitHub e CI:** a pipeline usa exclusivamente dados fictícios do *seed* e um banco descartável; o
  modo de demonstração é bloqueado em produção.
- **Logs:** as regras de sanitização da Atividade 2 valem também para logs enviados a ferramentas
  externas de monitoramento.

## 7. Gestão de acessos e segredos de fornecedores

- Cada integração usa uma **credencial própria** (chave de API, usuário SMTP, token), com o menor
  privilégio possível, guardada em variáveis de ambiente/cofre de segredos — nunca no código.
- As contas da equipe nos painéis dos fornecedores (nuvem, GitHub, Expo, Google) exigem **2FA**.
- As credenciais são **giradas a cada 90 dias**, imediatamente quando um integrante sai da equipe e
  sempre que houver suspeita de vazamento.
- Acesso aos painéis é revisado a cada semestre, removendo contas que não são mais necessárias.

## 8. Cadeia de suprimentos de software (bibliotecas)

- Adotar apenas bibliotecas mantidas ativamente, com licença compatível e comunidade relevante.
- Versões travadas no `package-lock.json` e instalação com `npm ci` na pipeline.
- `npm audit` e Dependabot apontam vulnerabilidades conhecidas; falhas **críticas ou altas** são
  corrigidas em até **7 dias**.
- Toda atualização de dependência passa pela suíte completa de testes antes do *merge*.

## 9. Monitoramento contínuo

| Atividade | Frequência |
|---|---|
| Acompanhar páginas de status e boletins de segurança dos fornecedores críticos | Contínuo |
| Revisar SLA cumprido e incidentes ocorridos | Trimestral |
| Reavaliar certificações, DPA e localização dos dados | Semestral (críticos) / anual (altos) |
| Atualizar o inventário de fornecedores | A cada novo serviço ou mudança de escopo |

Se um fornecedor sofrer um incidente que envolva dados do Fiscalize, aplica-se o plano de resposta a
incidentes da Atividade 4 e, se necessário, o plano de continuidade da Atividade 5.

## 10. Desligamento de fornecedores (*offboarding*)

1. Exportar os dados necessários em formato aberto e validar a cópia.
2. Migrar a integração para o novo fornecedor e testar em homologação.
3. Revogar todas as credenciais, chaves e acessos ao fornecedor antigo.
4. Solicitar a **eliminação dos dados** e obter a confirmação por escrito.
5. Atualizar o inventário e registrar o desligamento.

Para os fornecedores críticos, este roteiro é mantido como **plano de saída** desde a contratação,
evitando a dependência total de um único fornecedor (*vendor lock-in*).
