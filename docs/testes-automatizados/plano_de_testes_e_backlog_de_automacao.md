# Entrega: Plano de Testes e Backlog de Automação

## 1. Objetivo

Definir uma estratégia de testes automatizados para o Sistema de Gestão de Demandas Urbanas, contemplando o aplicativo mobile, a API REST e os principais mecanismos de autenticação e segurança relacionados ao gerenciamento de usuários e senhas.

O plano tem como objetivo garantir que os principais fluxos funcionais estejam funcionando corretamente e que os requisitos de segurança definidos para autenticação, sessão e recuperação de senha sejam verificados de forma repetível.

---

## 2. Escopo dos testes

### 2.1 Testes funcionais

| Funcionalidade | O que será validado | Tipo |
|---|---|---|
| Login | Usuário consegue realizar login utilizando e-mail e senha válidos. | E2E / Integração |
| Login inválido | Sistema rejeita credenciais inválidas sem revelar informações sobre a existência do usuário. | E2E / Integração |
| Access token | Login bem-sucedido gera um access token de curta duração. | Integração |
| Refresh token | Sistema permite renovar o access token enquanto o refresh token for válido. | Integração |
| Rotação de token | Refresh token utilizado uma vez não pode ser reutilizado. | Integração |
| Logout | Logout invalida o refresh token associado à sessão. | E2E / Integração |
| Token revogado | Refresh token revogado não pode ser utilizado novamente. | Integração |
| Cadastro de senha | Nova senha respeita a política definida para o sistema. | Integração / E2E |
| Alteração de senha | Usuário autenticado consegue alterar sua senha mediante confirmação da senha atual. | E2E / Integração |
| Recuperação de senha | Usuário consegue solicitar recuperação informando seu e-mail. | E2E / Integração |
| Link de recuperação | Link ou código possui validade limitada e pode ser utilizado apenas uma vez. | Integração |
| Nova senha | Usuário consegue definir uma nova senha utilizando um link/código válido. | E2E / Integração |
| Bloqueio de conta | Conta é bloqueada após 5 tentativas inválidas consecutivas por 15 minutos. | Integração |
| Auditoria | Tentativas de login, logout, alteração e recuperação de senha são registradas com data/hora e resultado. | Integração |
| Múltiplas sessões | Usuário pode possuir sessões simultâneas e elas podem ser revogadas individualmente. | Integração |

### 2.2 Testes de segurança

| Requisito | Validação |
|---|---|
| RNF01 | Verificar que senhas não são armazenadas em texto plano e utilizam hash com salt. |
| RNF02 | Verificar a validade configurada do access token e do refresh token. |
| RNF03 | Verificar que a comunicação entre cliente e backend ocorre exclusivamente por HTTPS. |
| RNF04 | Verificar a existência de rate limiting no endpoint de login. |
| RNF05 | Verificar que o link/código de recuperação expira em no máximo 1 hora. |
| RNF06 | Verificar que login e refresh possuem tempo de resposta inferior a 1 segundo em condições normais de carga. |
| RNF07 | Verificar que os dados de autenticação armazenados são limitados ao necessário para o funcionamento do sistema. |
| RNF08 | Verificar que mensagens de erro não permitem identificar se determinado e-mail está cadastrado. |

---

## 3. Níveis de teste

### Testes unitários

Serão utilizados para validar regras isoladas, como validação da política de senha, geração e validação de tokens, expiração, bloqueio após tentativas inválidas e regras de recuperação de senha.

**Ferramenta:** Jest

### Testes de integração

Serão utilizados para validar a comunicação entre API, banco de dados e mecanismos de autenticação, incluindo login, refresh token, logout, revogação, alteração e recuperação de senha.

**Ferramenta:** Jest

### Testes E2E

Serão utilizados para validar os principais fluxos do usuário diretamente no aplicativo mobile, principalmente login, logout, criação de chamados e funcionalidades que dependem de autenticação.

**Ferramenta:** Appium

### Testes de segurança

Serão realizados principalmente sobre a API, verificando os requisitos de segurança definidos no documento de requisitos.

**Ferramenta:** Jest e ferramentas/scripts auxiliares quando necessário.

---

## 4. Estratégia de automação

A automação será dividida em três camadas:

**Jest**

Responsável pelos testes unitários e de integração do backend TypeScript e da API REST.

↓

**Appium**

Responsável pelos testes E2E do aplicativo mobile, simulando as ações realizadas pelo cidadão.

↓

**GitHub Actions**

Responsável pela execução automatizada das suítes durante o desenvolvimento e integração do código.

---

## 5. Backlog de automação

| ID | Teste | Requisito relacionado | Prioridade | Tipo | Status |
|---|---|---|---|---|---|
| AUT-01 | Login com e-mail e senha válidos. | RF01 | P0 | E2E / Integração | A Fazer |
| AUT-02 | Login com senha incorreta. | RF01 | P0 | E2E / Integração | A Fazer |
| AUT-03 | Login com e-mail não cadastrado. | RNF08 | P0 | Integração | A Fazer |
| AUT-04 | Verificar geração do access token após login. | RF02 | P0 | Integração | A Fazer |
| AUT-05 | Verificar geração do refresh token após login. | RF02 | P0 | Integração | A Fazer |
| AUT-06 | Renovar access token utilizando refresh token válido. | RF03 | P0 | Integração | A Fazer |
| AUT-07 | Recusar refresh token expirado. | RF03/RF05 | P0 | Integração | A Fazer |
| AUT-08 | Verificar rotação do refresh token. | RN03 | P0 | Integração | A Fazer |
| AUT-09 | Tentar reutilizar refresh token já utilizado. | RF05/RN03 | P0 | Integração | A Fazer |
| AUT-10 | Realizar logout e revogar refresh token. | RF04 | P0 | E2E / Integração | A Fazer |
| AUT-11 | Tentar utilizar refresh token após logout. | RF05 | P0 | Integração | A Fazer |
| AUT-12 | Cadastrar senha respeitando a política definida. | RF06/RN01 | P0 | Integração | A Fazer |
| AUT-13 | Recusar senha com menos de 8 caracteres. | RN01 | P1 | Unitário / Integração | A Fazer |
| AUT-14 | Recusar senha sem letra maiúscula. | RN01 | P1 | Unitário / Integração | A Fazer |
| AUT-15 | Recusar senha sem letra minúscula. | RN01 | P1 | Unitário / Integração | A Fazer |
| AUT-16 | Recusar senha sem número. | RN01 | P1 | Unitário / Integração | A Fazer |
| AUT-17 | Alterar senha informando a senha atual correta. | RF07 | P0 | E2E / Integração | A Fazer |
| AUT-18 | Recusar alteração de senha quando a senha atual estiver incorreta. | RF07 | P0 | Integração | A Fazer |
| AUT-19 | Solicitar recuperação de senha utilizando e-mail cadastrado. | RF08 | P0 | E2E / Integração | A Fazer |
| AUT-20 | Solicitar recuperação utilizando e-mail não cadastrado sem revelar sua existência. | RF08/RNF08 | P0 | Integração | A Fazer |
| AUT-21 | Validar expiração do link/código de recuperação após o período definido. | RF09/RNF05 | P0 | Integração | A Fazer |
| AUT-22 | Definir nova senha utilizando link/código válido. | RF10 | P0 | E2E / Integração | A Fazer |
| AUT-23 | Impedir reutilização do link/código de recuperação. | RF10/RN04 | P0 | Integração | A Fazer |
| AUT-24 | Invalidar sessões existentes após alteração da senha. | RN05 | P0 | Integração | A Fazer |
| AUT-25 | Invalidar sessões existentes após recuperação da senha. | RN05 | P0 | Integração | A Fazer |
| AUT-26 | Bloquear conta após 5 tentativas consecutivas de login inválido. | RF11/RN02 | P0 | Integração | A Fazer |
| AUT-27 | Impedir login durante o período de bloqueio de 15 minutos. | RN02 | P0 | Integração | A Fazer |
| AUT-28 | Permitir login após o término do bloqueio. | RN02 | P1 | Integração | A Fazer |
| AUT-29 | Registrar tentativa de login com sucesso no log de auditoria. | RF12 | P1 | Integração | A Fazer |
| AUT-30 | Registrar tentativa de login com falha no log de auditoria. | RF12 | P1 | Integração | A Fazer |
| AUT-31 | Registrar logout no log de auditoria. | RF12 | P1 | Integração | A Fazer |
| AUT-32 | Registrar alteração e recuperação de senha no log de auditoria. | RF12 | P1 | Integração | A Fazer |
| AUT-33 | Validar armazenamento da senha utilizando hash com salt. | RNF01 | P0 | Integração | A Fazer |
| AUT-34 | Validar tempo de expiração do access token. | RNF02 | P0 | Integração | A Fazer |
| AUT-35 | Validar tempo de expiração do refresh token. | RNF02 | P0 | Integração | A Fazer |
| AUT-36 | Verificar que endpoints de autenticação utilizam HTTPS. | RNF03 | P0 | Integração / Segurança | A Fazer |
| AUT-37 | Verificar rate limiting no endpoint de login. | RNF04 | P0 | Segurança | A Fazer |
| AUT-38 | Verificar que o tempo de resposta do login está abaixo de 1 segundo em condições normais. | RNF06 | P1 | Desempenho | A Fazer |
| AUT-39 | Verificar que o tempo de resposta do refresh está abaixo de 1 segundo em condições normais. | RNF06 | P1 | Desempenho | A Fazer |
| AUT-40 | Verificar que mensagens de autenticação não permitem enumeração de usuários. | RNF08 | P0 | Segurança | A Fazer |
| AUT-41 | Validar múltiplas sessões simultâneas para o mesmo usuário. | RF13 | P2 | Integração | A Fazer |
| AUT-42 | Validar revogação individual de uma sessão. | RF13 | P2 | Integração | A Fazer |
| AUT-43 | Automatizar execução dos testes pelo terminal. | Infraestrutura | P1 | CI | A Fazer |
| AUT-44 | Executar a suíte automaticamente pelo GitHub Actions. | Infraestrutura | P0 | CI | A Fazer |
| AUT-45 | Gerar relatório com os resultados dos testes automatizados. | Infraestrutura | P1 | Relatório | A Fazer |

---

## 6. Casos prioritários para a primeira automação

Considerando o risco de segurança, os primeiros testes a serem implementados devem ser:

1. AUT-01 — Login válido
2. AUT-02 — Login inválido
3. AUT-03 — Não enumeração de usuário
4. AUT-04 — Access token
5. AUT-06 — Refresh token
6. AUT-08 — Rotação do refresh token
7. AUT-09 — Reutilização de refresh token
8. AUT-10 — Logout
9. AUT-11 — Refresh após logout
10. AUT-17 — Alteração de senha
11. AUT-19 — Recuperação de senha
12. AUT-21 — Expiração do link de recuperação
13. AUT-23 — Reutilização do link de recuperação
14. AUT-24 — Invalidação das sessões após alteração de senha
15. AUT-26 — Bloqueio após cinco tentativas
16. AUT-33 — Hash da senha
17. AUT-36 — HTTPS
18. AUT-37 — Rate limiting
19. AUT-40 — Proteção contra enumeração
20. AUT-44 — Execução no GitHub Actions

---

## 7. Exemplos de casos de teste

### CT-01 — Login válido

**Pré-condição:** Usuário cadastrado e ativo.

**Passos:**

1. Abrir o aplicativo.
2. Informar e-mail válido.
3. Informar senha válida.
4. Selecionar a opção de login.

**Resultado esperado:** O login é realizado com sucesso e o usuário recebe acesso às funcionalidades autenticadas.

**Automação:** Appium + Jest

---

### CT-02 — Login com senha inválida

**Pré-condição:** Usuário cadastrado e ativo.

**Passos:**

1. Informar e-mail cadastrado.
2. Informar senha incorreta.
3. Realizar login.

**Resultado esperado:** O acesso é negado e a mensagem apresentada não revela informações desnecessárias sobre a conta.

**Automação:** Jest / Appium

---

### CT-03 — Rotação do refresh token

**Pré-condição:** Usuário autenticado e refresh token válido.

**Passos:**

1. Enviar refresh token válido.
2. Receber novo access token e novo refresh token.
3. Tentar utilizar novamente o refresh token anterior.

**Resultado esperado:** O primeiro refresh é aceito e o segundo uso do token anterior é rejeitado.

**Automação:** Jest

---

### CT-04 — Bloqueio da conta

**Passos:**

1. Realizar cinco tentativas consecutivas de login com senha incorreta.
2. Realizar uma nova tentativa utilizando a senha correta.

**Resultado esperado:** A conta permanece bloqueada durante os 15 minutos definidos pela RN02.

**Automação:** Jest

---

### CT-05 — Recuperação de senha

**Passos:**

1. Selecionar "Esqueci minha senha".
2. Informar e-mail cadastrado.
3. Utilizar o link/código recebido.
4. Cadastrar nova senha.
5. Tentar utilizar novamente o mesmo link/código.

**Resultado esperado:** A nova senha é definida com sucesso e o link/código não pode ser utilizado novamente.

**Automação:** Jest + Appium

---

## 8. Critérios de entrada

Os testes poderão ser executados quando:

- O backend estiver disponível em ambiente de testes.
- A API estiver acessível.
- O banco de dados de teste estiver configurado.
- Os usuários e dados necessários estiverem disponíveis.
- O aplicativo possuir uma build testável.
- O dispositivo/emulador estiver configurado.
- As dependências do Jest e Appium estiverem instaladas.
- Os dados sensíveis utilizados nos testes forem fictícios ou próprios do ambiente de teste.

---

## 9. Critérios de saída

A execução será considerada concluída quando:

- Todos os testes planejados para a execução forem executados.
- Nenhum teste P0 apresentar falha sem justificativa.
- Falhas encontradas forem registradas no backlog.
- Os resultados estiverem disponíveis no relatório.
- Os defeitos críticos de segurança forem tratados antes da liberação.
- A suíte puder ser executada novamente pelo pipeline de CI.

---

## 10. Organização no Kanban

O backlog seguirá o fluxo definido pelo projeto:

**Backlog → A Fazer → Em andamento → Revisão de código → Teste**

### Backlog

Itens ainda não refinados ou que dependem de definição técnica.

### A Fazer

Testes priorizados e prontos para implementação.

### Em andamento

Testes que estão sendo desenvolvidos por um integrante da equipe.

### Revisão de código

Testes concluídos que possuem Pull Request aberto e aguardam revisão.

### Teste

Testes aprovados na revisão de código e prontos para execução e validação.

---

## 11. Modelo de cartão

**Descrição:** Automatizar o cenário de bloqueio da conta após cinco tentativas consecutivas de login inválido, conforme RN02.

**Critérios de aceite:**

- Realizar cinco tentativas consecutivas com senha inválida.
- Verificar que a conta foi bloqueada.
- Tentar realizar login com a senha correta durante o período de bloqueio.
- Verificar que o acesso continua bloqueado.
- Após o período definido, verificar que o login volta a ser permitido.

**Requisito relacionado:** RF11 / RN02

**Tipo:** Teste de segurança

**Ferramenta:** Jest

**Linguagem:** TypeScript

**Pull request:** link do PR

**Responsável:** nome do integrante

**Revisor:** nome do integrante

**Etiqueta:** automação / segurança / P0

---

## 12. Execução no CI

O pipeline planejado será:

**Commit/PR**  
↓  
**Build**  
↓  
**Testes unitários — Jest**  
↓  
**Testes de integração — Jest**  
↓  
**Build do aplicativo**  
↓  
**Testes E2E — Appium**  
↓  
**Relatório**  
↓  
**Resultado do GitHub Actions**

| Etapa | Ferramenta |
|---|---|
| Testes unitários | Jest |
| Testes de integração | Jest |
| Testes de segurança da API | Jest / scripts auxiliares |
| Testes E2E mobile | Appium |
| Linguagem | TypeScript |
| CI | GitHub Actions |
| Relatórios | Ferramenta de relatório compatível com a suíte utilizada |

---

## 13. Resultado esperado

Ao final da implementação, a equipe deverá possuir uma suíte automatizada capaz de verificar os principais fluxos do aplicativo mobile e, principalmente, os requisitos críticos de autenticação e segurança da API.

A camada de testes com Jest ficará responsável por validar as regras de negócio e segurança do backend TypeScript, enquanto o Appium será utilizado para validar os fluxos E2E no aplicativo mobile.

Os cenários de maior risco, como login, refresh token, rotação de tokens, logout, bloqueio de conta, recuperação de senha, invalidação de sessões, rate limiting e proteção contra enumeração de usuários, terão prioridade na automação.

Os testes deverão ser integrados ao GitHub Actions para que alterações no código possam executar automaticamente a suíte e indicar falhas antes que sejam incorporadas ao projeto.
