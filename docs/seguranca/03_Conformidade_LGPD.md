# Atividade 3 — Atendimento a requisitos de LGPD

| | |
|---|---|
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Disciplina** | Segurança de Dados — Unidade 1 |
| **Entrega** | 25/09 |

**Integrantes do grupo:** Felipe Cisneiros Agostinho, Ramom de Oliveira Aguiar, Arthur Borba Lins,
Victor Simas Azevedo de Almeida, Paulo Henrique Alves de Barros Pereira, Michelangelo Morais do Rego,
Bruno Dornelas Costa Ciro da Penha, João Guilherme Aires Chagas de Oliveira, Thyalles Araujo Campos,
Bruno Felipe de Castilho Gomes Rego

---

A seguir, o tratamento de dados previsto em cada fluxo do sistema.

## Fluxo 1 — Cadastrar novos usuários (minimização e consentimento)

**Foco:** coletar somente o necessário e provar que o cidadão consentiu com o uso dos seus dados.

- **Preenchimento:** o cidadão informa apenas Nome, E-mail, CPF (chave única para o governo) e
  senha. Nenhum dado extra (como gênero ou data de nascimento) é pedido nesta etapa, respeitando o
  princípio da **minimização de dados** da LGPD.
- **Validação de senha e hashing:** o front-end obriga o uso de senha forte. O backend não salva a
  senha em texto limpo; aplica um algoritmo de hashing seguro com *salt* (ex.: bcrypt), garantindo
  que nem o administrador do banco tenha acesso a ela.
- **Consentimento explícito (*opt-in*):** o usuário deve marcar ativamente um checkbox (desmarcado
  por padrão) concordando com a política de privacidade.
- **Registro de auditoria:** o backend salva o usuário e cria um log de consentimento contendo o
  *timestamp* (data e hora exatas) e o IP do dispositivo, servindo como prova, perante a lei, de que
  o usuário consentiu.

## Fluxo 2 — Login (proteção contra acesso indevido)

**Foco:** impedir ataques de força bruta, roubo de sessão e vazamento de credenciais.

- **Autenticação e *rate limiting*:** o cidadão envia e-mail e senha; o backend verifica as
  credenciais passando por um limitador de requisições. Após **5 tentativas erradas seguidas**, a
  conta é bloqueada temporariamente (**15 minutos**) para evitar ataques de robôs.
- **Geração de tokens (JWT):** com o login válido, o backend gera um **Access Token** de vida curta
  (ex.: 15 minutos) para autorizar requisições e um **Refresh Token** opaco e longo, salvo no banco
  e vinculado àquele dispositivo.
- **Entrega segura:** o app recebe os tokens e os armazena no cofre seguro do sistema operacional.
- **Auditoria limpa:** o sistema registra "Login bem-sucedido" ou "Falha de login", mas nunca grava
  a senha tentada ou o token nos logs, nem informa se o erro foi de senha ou de e-mail.

## Fluxo 3 — Criar novas demandas (*just-in-time* e sanitização)

**Foco:** proteger o cidadão de rastreamento contínuo e proteger terceiros que apareçam nas fotos.

- **Consentimento contextual (GPS e câmera):** o app não pede permissão de localização ao ser
  instalado. Pede apenas quando o cidadão toca em "Abrir Demanda", explicando que a coordenada serve
  para achar o órgão competente e a unidade mais próxima.
- **Idempotência (*offline-first*):** o app gera um `client_uuid`. Se a internet cair e o app
  reenviar a requisição, o backend identifica o UUID e não duplica a denúncia no banco.
- **Upload e validação de mídia:** o cidadão anexa uma foto do problema. O backend valida a extensão
  (rejeitando scripts maliciosos ou `.exe`) e o limite de tamanho (ex.: 5 MB).
- **Pseudoanonimização de imagens:** antes de salvar definitivamente a foto no serviço de
  armazenamento, um *worker* aplica desfoque (*blur*) automático em rostos de pedestres ou placas de
  carros que tenham saído na foto sem querer, protegendo dados de terceiros.
- **Roteamento seguro:** a demanda é salva vinculada ao ID do cidadão e encaminhada ao órgão
  competente. O órgão recebe o relato e a foto, mas os dados pessoais do reclamante só são liberados
  se a natureza do serviço exigir identificação formal.

## Fluxo 4 — Acompanhamento de demandas (controle de acesso)

**Foco:** garantir que um usuário não consiga ver a demanda do vizinho e não sobrecarregar o
servidor.

- **Proteção contra IDOR:** ao listar seus chamados, o backend ignora qualquer parâmetro enviado na
  URL (ex.: `?user_id=123`) e extrai a identidade do usuário diretamente do Access Token validado.
  Isso impede que um atacante troque o ID na URL para ler denúncias alheias.
- **Otimização de payload (paginação):** o banco retorna as demandas de forma paginada. O app exibe o
  status atual sem carregar imagens pesadas de imediato, economizando o pacote de dados do usuário e
  blindando a API contra sobrecarga.
- **Notificação push discreta:** quando o órgão atualiza o status de "Aberto" para "Resolvido", o
  sistema dispara um push sem dados sensíveis — não diz "Seu vazamento na Rua X foi arrumado", diz
  apenas "Sua demanda #1234 teve o status atualizado" —, obrigando o cidadão a abrir o app para ver
  os detalhes e evitando a visualização por terceiros.

## Fluxo 5 — Exclusão da conta (direito ao esquecimento e anonimização)

**Foco:** cumprir o **Art. 18 da LGPD** de forma irreversível, sem destruir os relatórios
estatísticos de infraestrutura da prefeitura e dos órgãos envolvidos.

- **Solicitação e barreira de segurança:** o cidadão vai às configurações e toca em "Excluir Conta".
  O app exige que ele digite a senha novamente para confirmar (evitando que alguém com o celular
  desbloqueado faça isso de propósito).
- **Revogação imediata:** o backend invalida todos os Refresh Tokens daquele cidadão, que é deslogado
  imediatamente de todos os dispositivos.
- ***Soft delete* e mascaramento:** o registro do usuário não recebe um simples `DELETE` físico. Seus
  dados pessoais (Nome, E-mail, CPF, IP) são sobrescritos por strings vazias ou hashes irreversíveis,
  e o status da conta passa a "excluída" no mesmo instante.
- **Manutenção do valor público:** as demandas criadas pelo usuário (ex.: buraco na rua, lâmpada
  queimada) não são apagadas, pois pertencem ao interesse público do município. Elas ficam "órfãs" no
  banco: como não há mais como ligar o chamado à pessoa física, o dado deixa de ser pessoal à luz da
  LGPD, encerrando o ciclo de vida da informação previsto em lei.
