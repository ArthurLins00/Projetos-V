export const TERMS_VERSION = 1;
export const TERMS_UPDATED_AT = 'outubro de 2026';

export interface TermsSection {
  title: string;
  body: string;
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: '1. Sobre o aplicativo',
    body:
      'O Fiscalize é um projeto acadêmico, desenvolvido como trabalho de faculdade para fins de estudo e demonstração. ' +
      'Ele não é um serviço oficial da prefeitura ou de qualquer outro órgão público.',
  },
  {
    title: '2. Uso não emergencial',
    body:
      'O aplicativo serve apenas para registrar problemas urbanos não emergenciais, como buracos, iluminação e lixo. ' +
      'Em situações de risco à vida ou à segurança, ligue para 190 (Polícia), 192 (SAMU) ou 193 (Bombeiros).',
  },
  {
    title: '3. Atendimento dos chamados',
    body:
      'Por ser um projeto acadêmico, não há garantia de que os chamados registrados sejam encaminhados a órgãos reais, ' +
      'atendidos ou resolvidos, nem de que os prazos exibidos sejam cumpridos.',
  },
  {
    title: '4. Seus dados',
    body:
      'Guardamos as informações que você fornece (nome, e-mail, foto de perfil, fotos e localização dos chamados) apenas ' +
      'para o funcionamento do aplicativo. Elas não são vendidas nem usadas para publicidade, e podem ser apagadas ao fim do projeto. ' +
      'As mensagens enviadas ao assistente são processadas por um serviço externo de inteligência artificial.',
  },
  {
    title: '5. Suas responsabilidades',
    body:
      'Ao usar o aplicativo, você se compromete a informar dados verdadeiros, não enviar conteúdo ofensivo ou ilegal ' +
      'e evitar fotos que exponham outras pessoas.',
  },
  {
    title: '6. Sem garantias',
    body: 'O aplicativo é oferecido "como está" e pode ficar indisponível, apresentar erros ou ser encerrado a qualquer momento.',
  },
  {
    title: '7. Alterações',
    body: 'Estes termos podem ser atualizados. Quando isso acontecer, a nova versão será exibida para você aceitar novamente.',
  },
];
