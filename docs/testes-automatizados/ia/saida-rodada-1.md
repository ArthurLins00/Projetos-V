# Saída da IA: rodada 1

> Registro da primeira rodada de geração de casos de teste com IA. A saída abaixo está íntegra, sem correção.
>
> - **Modelo:** Claude Opus 5.5
> - **Data da geração:** 26/09/2026
> - **Insumos anexados:** nenhum (só o prompt)

## Prompt enviado

```
Atue como QA. Escreva casos de teste para o sistema Fiscalize (registro de demandas de cidadãos usando GPS e consulta a API de órgãos). Faça os cenários de login, cadastro e registro de denúncia.
```

## Saída recebida

---

Claro! Abaixo estão os casos de teste para o sistema **Fiscalize**, organizados por funcionalidade: Login, Cadastro e Registro de Denúncia.

### Observações antes dos casos

Como não recebi a especificação detalhada do sistema, alguns pontos ficaram em aberto e foram tratados como suposições. Recomendo confirmar com o time de produto:

1. **Tamanho máximo dos anexos:** não está definido qual o limite de tamanho (nem a quantidade) das fotos anexadas à denúncia. Assumi 10 MB por imagem.
2. **GPS desligado:** não está claro o que o app deve fazer quando o GPS do dispositivo está desligado ou a permissão de localização é negada (bloquear o registro? permitir digitar o endereço?).
3. **Política de senha:** não sei os requisitos mínimos de senha. Assumi mínimo de 8 caracteres com letras e números.
4. **Órgãos inativos:** não está claro se a API de órgãos pode retornar órgãos inativos e como o app deve tratá-los.

---

### 1. Login

**CT-01: Login com credenciais válidas**
- **Pré-condição:** Usuário cadastrado e ativo.
- **Passos:**
  1. Abrir o aplicativo Fiscalize.
  2. Informar e-mail válido.
  3. Informar senha correta.
  4. Tocar em "Entrar".
- **Resultado esperado:** Usuário é autenticado e redirecionado para a tela inicial com a lista de denúncias.

**CT-02: Login com senha incorreta**
- **Pré-condição:** Usuário cadastrado.
- **Passos:**
  1. Abrir o aplicativo.
  2. Informar e-mail cadastrado.
  3. Informar senha incorreta.
  4. Tocar em "Entrar".
- **Resultado esperado:** Sistema exibe mensagem "E-mail ou senha inválidos" e permanece na tela de login.

**CT-03: Login com e-mail não cadastrado**
- **Passos:**
  1. Informar e-mail inexistente.
  2. Informar qualquer senha.
  3. Tocar em "Entrar".
- **Resultado esperado:** Sistema exibe mensagem de erro genérica, sem informar se o e-mail existe.

**CT-04: Login com campos vazios**
- **Passos:**
  1. Deixar e-mail e senha em branco.
  2. Tocar em "Entrar".
- **Resultado esperado:** Sistema exibe mensagem indicando que os campos são obrigatórios.

**CT-05: Login com formato de e-mail inválido**
- **Passos:**
  1. Informar "usuario.com" no campo e-mail.
  2. Informar senha.
  3. Tocar em "Entrar".
- **Resultado esperado:** Sistema exibe mensagem "E-mail inválido".

**CT-06: Persistência de sessão**
- **Pré-condição:** Usuário logado.
- **Passos:**
  1. Fechar o aplicativo.
  2. Abrir novamente.
- **Resultado esperado:** Usuário continua logado.

**CT-07: Logout**
- **Pré-condição:** Usuário logado.
- **Passos:**
  1. Tocar em "Sair".
- **Resultado esperado:** Usuário é redirecionado para a tela de login e não consegue acessar telas autenticadas.

---

### 2. Cadastro

**CT-08: Cadastro com dados válidos**
- **Passos:**
  1. Na tela de login, tocar em "Criar conta".
  2. Preencher nome, e-mail e senha válidos.
  3. Tocar em "Cadastrar".
- **Resultado esperado:** Conta criada com sucesso e mensagem de confirmação exibida.

**CT-09: Cadastro com e-mail já existente**
- **Pré-condição:** E-mail já cadastrado.
- **Passos:**
  1. Preencher o formulário com o e-mail já cadastrado.
  2. Tocar em "Cadastrar".
- **Resultado esperado:** Sistema exibe "E-mail já cadastrado".

**CT-10: Cadastro com senha fraca**
- **Passos:**
  1. Preencher o formulário com senha "123".
  2. Tocar em "Cadastrar".
- **Resultado esperado:** Sistema rejeita e informa os requisitos da senha.

**CT-11: Cadastro com campos obrigatórios vazios**
- **Passos:**
  1. Deixar o nome em branco.
  2. Tocar em "Cadastrar".
- **Resultado esperado:** Sistema destaca os campos obrigatórios.

**CT-12: Cadastro com e-mail inválido**
- **Passos:**
  1. Informar "teste@" como e-mail.
  2. Tocar em "Cadastrar".
- **Resultado esperado:** Sistema exibe "E-mail inválido".

**CT-13: Login com a conta recém-criada**
- **Pré-condição:** CT-08 executado.
- **Passos:**
  1. Fazer login com o e-mail e a senha cadastrados.
- **Resultado esperado:** Login realizado com sucesso.

---

### 3. Registro de Denúncia

**CT-14: Registrar denúncia com todos os dados**
- **Pré-condição:** Usuário logado; GPS ativo; permissão de localização concedida.
- **Passos:**
  1. Tocar em "Nova denúncia".
  2. Informar título e descrição.
  3. Selecionar a categoria.
  4. Tocar em "Usar minha localização".
  5. Tirar uma foto.
  6. Tocar em "Enviar".
- **Resultado esperado:** Denúncia registrada com sucesso, número de protocolo exibido e denúncia aparece na lista com status "Aberto".

**CT-15: Captura de localização pelo GPS**
- **Pré-condição:** GPS ativo.
- **Passos:**
  1. Na tela de nova denúncia, tocar em "Usar minha localização".
- **Resultado esperado:** Latitude e longitude são capturadas e o endereço é preenchido automaticamente.

**CT-16: Registrar denúncia com GPS desligado**
- **Pré-condição:** GPS do dispositivo desligado.
- **Passos:**
  1. Tocar em "Nova denúncia".
  2. Tocar em "Usar minha localização".
- **Resultado esperado:** Sistema solicita que o usuário ative o GPS ou permite informar o endereço manualmente.

**CT-17: Permissão de localização negada**
- **Passos:**
  1. Negar a permissão de localização quando solicitada.
- **Resultado esperado:** Sistema informa que a localização é necessária e permite tentar novamente.

**CT-18: Registrar denúncia sem campos obrigatórios**
- **Passos:**
  1. Deixar título ou categoria em branco.
  2. Tocar em "Enviar".
- **Resultado esperado:** Sistema impede o envio e destaca os campos obrigatórios.

**CT-19: Anexar foto acima do limite**
- **Passos:**
  1. Anexar imagem com mais de 10 MB.
  2. Tocar em "Enviar".
- **Resultado esperado:** Sistema exibe mensagem de tamanho excedido.

**CT-20: Anexar arquivo que não é imagem**
- **Passos:**
  1. Tentar anexar um arquivo PDF.
- **Resultado esperado:** Sistema rejeita o arquivo.

**CT-21: Encaminhamento ao órgão responsável**
- **Pré-condição:** API de órgãos disponível.
- **Passos:**
  1. Registrar uma denúncia na categoria "Água e Esgoto".
- **Resultado esperado:** Denúncia é encaminhada ao órgão responsável pela categoria (ex.: COMPESA).

**CT-22: API de órgãos indisponível**
- **Pré-condição:** API de órgãos fora do ar.
- **Passos:**
  1. Registrar uma denúncia.
- **Resultado esperado:** Sistema exibe mensagem amigável de erro e não perde os dados preenchidos.

**CT-23: Registrar denúncia sem conexão com a internet**
- **Pré-condição:** Dispositivo sem internet.
- **Passos:**
  1. Preencher a denúncia.
  2. Tocar em "Enviar".
- **Resultado esperado:** Sistema informa a falta de conexão.

**CT-24: Visualizar denúncia registrada**
- **Pré-condição:** Denúncia registrada.
- **Passos:**
  1. Tocar na denúncia na lista.
- **Resultado esperado:** Detalhes exibidos com foto, localização, categoria e status.

---

### Resumo

| Funcionalidade | Quantidade de casos |
|---|---|
| Login | 7 |
| Cadastro | 6 |
| Registro de Denúncia | 11 |
| **Total** | **24** |

Se quiser, posso transformar esses casos em scripts automatizados (por exemplo, com Appium ou Detox) ou detalhar casos de segurança e desempenho.
