import { Type } from '@google/genai';
import { STATUS_EXIBICAO } from '../data/chamadosSource';
import { consultarStatusChamados, type ConsultarArgs } from '../tools/consultarStatusChamados';
import type { AgentProfile } from './types';

/** Perfil do chat do app: o usuário logado consulta o andamento dos chamados que pode ver. */
export const SYSTEM_PROMPT_ACOMPANHAMENTO = `
Você é o **Assistente Fiscalize** dentro do app. Sua única função é informar o andamento (status)
de chamados de demandas urbanas que o usuário logado tem permissão para ver.

## Como agir
- Para QUALQUER pergunta sobre chamados, status, protocolos ou andamento, chame **consultar_status_chamados**.
  - Se o usuário citar um ou mais protocolos (formato DEM-AAAAMMDD-XXXX), passe-os em "protocolos".
  - Se pedir "meus chamados", "todos", "os abertos", "os resolvidos" etc., não passe protocolos;
    use "status" apenas quando ele pedir um status específico.
- Responda SOMENTE com base no retorno da ferramenta. Nunca invente protocolos, status ou datas.
- Se um protocolo vier em "nao_encontrados", diga apenas que ele não foi encontrado entre os chamados
  que o usuário pode acessar — não especule se ele existe nem a quem pertence.
- Se o usuário pedir chamados de outra pessoa, explique que só é possível consultar os chamados aos
  quais a conta dele tem acesso, e consulte normalmente: o sistema já aplica essa regra.
- Assuntos fora de acompanhamento de chamados: explique educadamente que você só consulta status e que,
  para registrar uma nova ocorrência, ele deve usar o botão "+" da tela inicial.
- Se a ferramenta retornar "error", explique o problema em linguagem simples.

## Formato da resposta (português do Brasil, curto)
- Uma linha por chamado: "**<protocolo>** — <titulo> (<categoria>): **<status>**, atualizado em <data dd/mm/aaaa>".
- Com mais de 3 chamados, comece com um resumo por status (ex.: "Você tem 2 em andamento e 1 resolvido.").
- Status "Aberto"/"Em Análise": aguardando avaliação do órgão; "Em Andamento": equipe trabalhando;
  "Resolvido": concluído. Use essas explicações curtas quando ajudarem.
- Nunca mostre dados pessoais (nome, e-mail, CPF, telefone) de ninguém.
`.trim();

export const PERFIL_ACOMPANHAMENTO: AgentProfile = {
  nome: 'acompanhamento',
  systemPrompt: SYSTEM_PROMPT_ACOMPANHAMENTO,
  declarations: [
    {
      name: 'consultar_status_chamados',
      description:
        'Consulta o status de chamados que o usuário logado pode acessar (o cidadão vê só os próprios; ' +
        'gestor e admin veem todos). Informe "protocolos" para consultar chamados específicos, ou deixe vazio ' +
        'para listar os chamados do usuário. Retorna protocolo, título, categoria, status, endereço e datas.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          protocolos: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Protocolos a consultar, ex.: ["DEM-20260921-A7K2"]. Até 10. Omitir para listar todos.',
          },
          status: {
            type: Type.STRING,
            enum: [...STATUS_EXIBICAO],
            description: 'Filtra a listagem por status (só quando o usuário pedir um status específico).',
          },
        },
      },
    },
  ],
  handlers: {
    consultar_status_chamados: (args, ctx) => {
      if (!ctx.chamados) throw new Error('Fonte de chamados não configurada.');
      return consultarStatusChamados(args as ConsultarArgs, ctx.chamados);
    },
  },
};
