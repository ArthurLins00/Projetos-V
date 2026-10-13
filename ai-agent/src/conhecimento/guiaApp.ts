/**
 * Como o app Fiscalize funciona, do ponto de vista do cidadão.
 * Mantenha em sincronia com a tela de Ajuda do app (mobile/src/models/Faq.ts).
 */
export const GUIA_DO_APP = `
Tela inicial ("Minhas Demandas")
- Mostra os chamados do usuário, do mais recente para o mais antigo. Puxar a lista para baixo atualiza.
- No topo: a foto ou as iniciais do usuário (abre o Perfil), o botão "?" (abre a Ajuda), o botão de estrelinhas (abre este assistente) e o sino (abre as Notificações; um número vermelho mostra quantas não foram lidas). Para sair da conta, use o Perfil.
- Busca: procura por título, categoria, endereço ou protocolo, em todos os status. Enquanto há texto na busca, o filtro de status fica em "Todos"; tocar em um status limpa a busca.
- Filtros de status logo abaixo da busca: Todos, Aberto, Em Análise, Aguardando, Em Andamento, Resolvido e Removidas. Há setas nas laterais para ver os filtros escondidos.
- Botão "Nova demanda", no canto inferior direito, para registrar um chamado.

Registrar um chamado (botão "Nova demanda")
1. "O problema": título, categoria, endereço e descrição.
2. "Região": estado, cidade e zona (urbana ou rural). Todos obrigatórios.
3. "Localização": tocar em "Usar GPS" (obrigatório). O GPS também preenche endereço, estado e cidade se estiverem vazios.
4. "Fotos": opcional, até 5 fotos, pela "Câmera" ou pela "Galeria" (dá para escolher várias de uma vez). O "X" na miniatura remove a foto.
5. Tocar em "Registrar Demanda". O chamado recebe um protocolo no formato DEM-AAAAMMDD-XXXX.

Detalhes de um chamado (tocar no chamado na lista)
- Mostra fotos (deslize para o lado para ver todas), status, protocolo, título, descrição, categoria, endereço, município e zona, e o histórico de atualizações.
- "Localização (GPS)" mostra o endereço aproximado; tocar nela abre um mapa, com opção de abrir no app de mapas do celular.
- Botões "Editar" e "Excluir" aparecem enquanto o chamado está Aberto, Em Análise ou Aguardando. Depois que o atendimento começa (Em Andamento), é resolvido ou removido, não dá mais para alterar.

Status de um chamado
- Aberto: recebido, aguardando a equipe responsável.
- Em Análise: a equipe aceitou e está avaliando.
- Aguardando: depende de alguma informação ou etapa externa.
- Em Andamento: a equipe está resolvendo o problema.
- Resolvido: atendimento concluído.
- Removidas (Fechado): chamados excluídos pelo usuário ou encerrados pela equipe.

Prazos
- Cada chamado recebe um prazo estimado de atendimento (SLA, em horas) quando é registrado. Ele depende da categoria e do órgão responsável; problemas com risco à segurança têm prazos menores.
- O prazo é uma estimativa e não uma garantia, principalmente por se tratar de um projeto acadêmico.

Avisos
- Quando a equipe aceita, transfere, muda o status, conclui ou encerra um chamado, o usuário recebe um e-mail e, se tiver permitido, uma notificação no celular. Tocar na notificação abre o chamado.
- Todos os avisos ficam guardados na tela "Notificações" (sino no topo da tela inicial). Os não lidos aparecem destacados; tocar em um aviso marca como lido e abre o chamado. Há a opção "Marcar todas como lidas".
- Se as notificações não chegam, verifique se elas estão permitidas para o app nas configurações do celular.

Perfil (tocar na foto ou nas iniciais, no topo da tela inicial)
- Alterar nome, e-mail (pede a senha atual), senha e foto de perfil (câmera ou galeria).
- Escolher o tema: claro, escuro ou o do sistema.
- Botão "Ajuda e termos de uso" e botão "Sair da conta".

Senha
- Esqueceu a senha: na tela de login, tocar em "Esqueceu a senha?", informar o e-mail, receber um código de 6 dígitos (válido por 15 minutos) e escolher a nova senha.

Ajuda
- Tela "Ajuda": botão "?" no topo da tela inicial, ou Perfil > "Ajuda e termos de uso". Tem perguntas frequentes, os números de emergência e os termos de uso.

Emergências
- O app não é para emergências. Em risco à vida ou à segurança: 190 (Polícia), 192 (SAMU) ou 193 (Bombeiros).

Sobre o Fiscalize e os dados
- Projeto acadêmico, não é um serviço oficial da prefeitura; não há garantia de que os chamados sejam atendidos por órgãos reais.
- Os dados do usuário servem apenas para o funcionamento do app. As mensagens enviadas a este assistente são processadas por um serviço externo de inteligência artificial.
`.trim();
