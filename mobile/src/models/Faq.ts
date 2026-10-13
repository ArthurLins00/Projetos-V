export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSection {
  title: string;
  icon: 'information-circle-outline' | 'create-outline' | 'time-outline' | 'person-circle-outline';
  items: FaqItem[];
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    title: 'Sobre o app',
    icon: 'information-circle-outline',
    items: [
      {
        question: 'O que é o Fiscalize?',
        answer:
          'É um app para registrar e acompanhar problemas urbanos não emergenciais, como buracos, iluminação apagada e lixo acumulado. ' +
          'É um projeto acadêmico e não é um serviço oficial da prefeitura.',
      },
      {
        question: 'Posso usar o app em uma emergência?',
        answer:
          'Não. Os chamados não são atendidos em tempo real. Em situações de risco à vida ou à segurança, ligue para 190 (Polícia), ' +
          '192 (SAMU) ou 193 (Bombeiros). Os números estão no fim desta página.',
      },
      {
        question: 'O que o assistente (botão de estrelinhas) faz?',
        answer:
          'É um assistente com inteligência artificial. Ele informa o status e o prazo estimado dos seus chamados, avisa quando ' +
          'algum está atrasado e explica como usar o app, por exemplo como registrar um chamado ou anexar fotos. ' +
          'Ele não registra nem altera chamados por você.',
      },
    ],
  },
  {
    title: 'Registrar um chamado',
    icon: 'create-outline',
    items: [
      {
        question: 'Como registro um chamado?',
        answer:
          'Na tela inicial, toque em "Nova demanda". Informe título, categoria, endereço e descrição, escolha estado, cidade e zona ' +
          '(urbana ou rural), toque em "Usar GPS" para marcar o local e, se quiser, anexe fotos. Depois toque em "Registrar Demanda".',
      },
      {
        question: 'Por que o app pede minha localização?',
        answer:
          'O GPS marca o ponto exato do problema, o que ajuda a equipe a encontrar o local. Ao usar o GPS, o endereço, o estado ' +
          'e a cidade são preenchidos automaticamente. A localização só é usada quando você toca em "Usar GPS".',
      },
      {
        question: 'Quantas fotos posso anexar?',
        answer: 'Até 5 fotos por chamado. Você pode tirar na hora pela câmera ou escolher várias de uma vez na galeria.',
      },
      {
        question: 'Posso editar ou excluir um chamado?',
        answer:
          'Sim, enquanto ele estiver como Aberto, Em Análise ou Aguardando. Depois que o atendimento começa (Em Andamento) ' +
          'ou é concluído, o chamado não pode mais ser alterado.',
      },
    ],
  },
  {
    title: 'Acompanhar',
    icon: 'time-outline',
    items: [
      {
        question: 'O que significa cada status?',
        answer:
          'Aberto: recebido, aguardando a equipe.\n' +
          'Em Análise: a equipe responsável aceitou e está avaliando.\n' +
          'Aguardando: depende de alguma informação ou etapa externa.\n' +
          'Em Andamento: o problema está sendo resolvido.\n' +
          'Resolvido: a equipe concluiu o atendimento.\n' +
          'Removidas: chamados que você excluiu ou que foram encerrados.',
      },
      {
        question: 'Vou ser avisado quando meu chamado mudar?',
        answer:
          'Sim. Quando a equipe aceita, transfere, muda o status ou conclui o chamado, você recebe um e-mail e, se permitir, ' +
          'uma notificação no celular. Tocar na notificação abre o chamado.',
      },
      {
        question: 'Como encontro um chamado específico?',
        answer:
          'Use a busca da tela inicial. Ela procura por título, categoria, endereço e protocolo, em todos os status. ' +
          'Para filtrar por status, limpe a busca e toque em um dos filtros.',
      },
      {
        question: 'Onde vejo o local do chamado no mapa?',
        answer: 'Abra o chamado e toque em "Localização (GPS)". O mapa mostra o ponto marcado e permite abrir no app de mapas do celular.',
      },
    ],
  },
  {
    title: 'Conta',
    icon: 'person-circle-outline',
    items: [
      {
        question: 'Esqueci minha senha. E agora?',
        answer:
          'Na tela de login, toque em "Esqueceu a senha?". Você recebe um código de 6 dígitos no e-mail, válido por 15 minutos, ' +
          'e escolhe uma nova senha.',
      },
      {
        question: 'Como altero meus dados, foto ou tema?',
        answer:
          'Toque na sua foto (ou iniciais) no topo da tela inicial para abrir o Perfil. Lá você muda nome, e-mail, senha, ' +
          'foto de perfil e escolhe entre tema claro, escuro ou o do sistema.',
      },
      {
        question: 'O que é feito com os meus dados?',
        answer: 'Seus dados são usados apenas para o funcionamento do app. Os detalhes estão nos Termos de Uso, no fim desta página.',
      },
    ],
  },
];
