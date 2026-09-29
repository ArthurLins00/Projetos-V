# Testes automatizados — Fiscalize

A suíte tem três níveis. Os comandos rodam a partir da **raiz do repositório**.

| Comando | O que roda | Ferramenta | Precisa de |
|---|---|---|---|
| `npm run test:unit` | Testes unitários (35) | Jest | nada (banco mockado) |
| `npm run test:api` | Testes de API (33) | Jest + Supertest | nada (banco mockado) |
| `npm run test:e2e` | Jornadas E2E contra o backend real (27) | Playwright | PostgreSQL com seed |
| `npm test` / `npm run test:all` | Unitários → API → E2E, em sequência | — | PostgreSQL com seed |
| `npm run test:e2e:mobile` | Fluxos de tela no app (5) | Maestro | emulador + app instalado + backend |

## Preparação (uma vez)

```bash
npm install                 # instala o Playwright (raiz)
npm install --prefix backend
```

Para os E2E, o banco precisa estar criado e populado (`backend/COMO_RODAR_O_BACK.md`):

```bash
cd backend
npx prisma migrate deploy
npm run seed
```

O `npm run test:e2e` sobe o backend sozinho (`npm run dev`) se ele não estiver rodando na porta 3000.
Para apontar para outro servidor: `E2E_API_URL=http://host:3000 npm run test:e2e`.
Relatório HTML da última execução: `npm run test:e2e:report`.

> Os E2E criam cidadãos novos a cada execução (e-mails `*@teste.fiscalize`) para não depender
> de dados existentes nem interferir entre si.

### Por que Playwright testa a API e o Maestro testa as telas

O app é **React Native nativo, só Android e iOS** (requisito do projeto: sem build web). Playwright e Cypress
controlam navegadores, então aqui o Playwright executa as jornadas completas do usuário contra a API real que o
app consome. Os fluxos de tela ficam no **Maestro**, ferramenta de E2E para apps mobile, usando os `testID`
dos componentes como seletores estáveis.

Para rodar o Maestro, deixe no ar: o emulador com o app de debug instalado (`npx expo run:android`),
o Metro (`npx expo start` em `mobile/`) e o backend (com seed). Depois:
- **CLI:** instale o Maestro (https://maestro.mobile.dev) e rode `npm run test:e2e:mobile`;
- **Maestro Studio:** abra a pasta `mobile/e2e` e execute cada fluxo (os de `subflows/` são chamados pelos outros).

Dicas para escrever fluxos novos neste app:
- Use os `testID` (`id:`) em vez de textos; o texto digitado num campo também conta como "texto visível".
- Espere pelo elemento da próxima tela (ex.: `id: "form-title"`) antes de interagir; a tela pode estar carregando.
- No Android os botões de alerta aparecem em maiúsculas: use `"(?i)remover"`.
- Evite acentos no `inputText` (o Maestro não os digita de forma confiável no Android).

---

## O que é testado em cada nível

### Unitário — regras de negócio isoladas (`backend/src/tests/unit`)
- **Autorização por perfil:** hierarquia Admin › Gestor › Cidadão; 401 sem login, 403 sem permissão.
- **Listagem e pesquisa:** cidadão vê só as próprias ocorrências; as removidas ficam ocultas por padrão;
  a busca textual cobre título, descrição, endereço e protocolo; paginação e formato da resposta.
- **Edição:** só o dono edita; bloqueada quando a ocorrência está em andamento, resolvida ou fechada;
  o histórico guarda os dados antigos e os novos.
- **Remoção (soft delete):** só o dono remove, e só enquanto não está em andamento; o gestor pode remover
  qualquer uma; o status vira "Fechado" e o histórico é registrado.
- **Foto:** aceita JPEG/PNG pela assinatura do arquivo (não pela extensão), recusa outros formatos,
  substitui e apaga a foto anterior.
- **Sessão:** o JWT leva id, e-mail e perfil; cada login gera um token único; o logout revoga só aquela sessão.

### API — rotas HTTP com banco mockado (`backend/src/tests/api`)
- **Login:** credenciais válidas (token + cookie); senha errada e e-mail inexistente (401 com a mesma
  mensagem); usuário inativo (403).
- **Cadastro:** sucesso (201); e-mail duplicado (409); tentativa de se cadastrar como Admin é ignorada.
- **Middleware de autenticação:** sem token, token inválido e token expirado (401); token válido (200).
- **Logout:** retorna 200, limpa o cookie, e o mesmo token passa a ser recusado.
- **Demandas:** listagem paginada com pesquisa; detalhe; campos obrigatórios e categoria inválida (400);
  acesso, edição e remoção de ocorrência alheia (403); upload de foto (validação e limite de tamanho);
  categorias.
- **Gestor:** atualização de status (válido, inválido, chamado inexistente, órgão diferente) e conversão
  de "Em Análise"/"Em Andamento" para o valor gravado no banco.

### E2E — jornadas completas contra o backend real (`e2e/`, Playwright)
- **Ciclo de vida da ocorrência (cidadão):** cadastro → login → registrar com categoria e GPS → aparece
  na lista → pesquisa por título, endereço e protocolo → filtro por status → detalhe → edição → foto
  anexada e servida → remoção (sai da lista, aparece em "Removidas") → logout invalida o token.
- **Atendimento (cidadão + gestor):** a ocorrência é roteada para a fila do órgão certo (Água e Esgoto →
  COMPESA); o gestor muda para "Em Andamento" e depois "Resolvido"; o cidadão vê o novo status e o
  histórico e deixa de poder editar ou remover.
- **Segurança:** rotas protegidas sem login; senha errada; e-mail duplicado; escalada para Admin;
  isolamento total entre cidadãos; logout de uma sessão não derruba outra; validação de dados e de foto.

### E2E mobile — telas do app (`mobile/e2e`, Maestro)
- `login_invalid_password` — erro de login e usuário continua deslogado.
- `register` — cadastro pela tela e primeiro login com a conta nova.
- `session_persistence` — fechar e reabrir o app mantém a sessão (useState + useEffect + SecureStore).
- `logout` — sair e continuar deslogado ao reabrir o app.
- `demand_crud` — criar com GPS e câmera → pesquisar na FlatList → detalhar → editar → excluir.
