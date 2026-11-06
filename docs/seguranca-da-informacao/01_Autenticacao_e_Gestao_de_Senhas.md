# Atividade 1 — Gestão de autenticação de usuários e gestão de senhas

| | |
|---|---|
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Disciplina** | Segurança de Dados — Unidade 1 |
| **Entrega** | 28/08 |

**Integrantes do grupo:** Felipe Cisneiros Agostinho, Ramom de Oliveira Aguiar, Arthur Borba Lins,
Victor Simas Azevedo de Almeida, Paulo Henrique Alves de Barros Pereira, Michelangelo Morais do Rego,
Bruno Dornelas Costa Ciro da Penha, João Guilherme Aires Chagas de Oliveira, Thyalles Araujo Campos,
Bruno Felipe de Castilho Gomes Rego

---

## 1. Autenticação de usuário

A autenticação de usuário do aplicativo será implementada utilizando login tradicional (e-mail e
senha) combinado com **autenticação de dois fatores (2FA)** via Google Authenticator, com exigência
diferenciada por papel.

Após o cadastro e a validação das credenciais primárias, o usuário deverá associar sua conta a um
aplicativo autenticador compatível com o padrão **TOTP** (*Time-based One-Time Password*),
escaneando um QR Code gerado pelo backend.

| Papel | Responsabilidade | 2FA |
|---|---|---|
| **Cidadão** | Usuário do app mobile que abre e acompanha demandas | **Recomendado** — ativável pelo próprio usuário |
| **Gestor** | Tria e encaminha demandas de múltiplos cidadãos no painel administrativo | **Obrigatório** em todo login |
| **Administrador** | Gerencia usuários, papéis e configurações do sistema | **Obrigatório** em todo login |

- Para o **Cidadão**, o 2FA é oferecido como recomendação de segurança, priorizando a fluidez de
  acesso a um público amplo e heterogêneo.
- Para o **Gestor** e o **Administrador**, todo login exigirá, além da senha, o código temporário de
  6 dígitos gerado pelo Google Authenticator, garantindo que, mesmo em caso de vazamento de senha, o
  acesso indevido a dados sensíveis de cidadãos e a funções administrativas seja dificultado.

Essa diferenciação reflete o nível de exposição a dados sensíveis de cada perfil: **quanto maior o
privilégio de acesso, maior a exigência de segurança na autenticação.**

## 2. Gestão de senhas

A gestão de senhas seguirá políticas rígidas para reduzir o risco de comprometimento de contas,
aplicadas de forma homogênea aos três papéis quanto aos requisitos mínimos, com reforços adicionais
para os papéis de maior privilégio.

### 2.1 Requisitos aplicados a todos os papéis

- **Complexidade:** mínimo de 8 caracteres, combinando obrigatoriamente letras maiúsculas, letras
  minúsculas, números e símbolos especiais.
- **Validação em duas camadas:** no front-end (feedback imediato ao usuário) e no back-end (garante a
  integridade mesmo em chamadas diretas à API).
- **Armazenamento:** as senhas nunca são armazenadas em texto puro; passam por hashing seguro
  (bcrypt ou Argon2) antes de serem persistidas no banco de dados.
- **Recuperação:** fluxo de recuperação de senha via e-mail ou SMS, com tokens de expiração curta,
  disponível igualmente para Cidadão, Gestor e Administrador.

### 2.2 Troca periódica obrigatória (diferenciada por papel)

| Papel | Troca obrigatória | Justificativa |
|---|---|---|
| **Cidadão** | Não há | Evita fricção desnecessária num app de uso esporádico pelo público em geral |
| **Gestor** | A cada **90 dias** | Acesso a dados de múltiplos cidadãos |
| **Administrador** | A cada **60 dias** | Maior nível de acesso do sistema, incluindo a atribuição de papéis a outros usuários |

A troca mais frequente para o Administrador reduz a janela de exposição em caso de comprometimento
de uma conta com privilégios administrativos.
