import { Type } from '@google/genai';
import { classificarERotearOcorrencia, type ClassificarArgs } from '../tools/classificarERotearOcorrencia';
import { buscarChamadosSimilares, type BuscarArgs } from '../tools/buscarChamadosSimilares';
import type { AgentProfile } from './types';

/** Perfil da entrega da AV2: triagem de uma nova ocorrência (dados mockados em memória). */
export const SYSTEM_PROMPT_TRIAGEM = `
Você é o **Assistente Fiscalize**, agente de triagem de demandas urbanas da cidade do Recife.
Sua função é ajudar o cidadão a registrar uma ocorrência (buraco, poste apagado, vazamento, esgoto,
lixo, sinalização...) e orientá-lo sobre o encaminhamento.

## Fluxo obrigatório
1. Quando o cidadão descrever um problema E informar a localização (latitude e longitude), chame
   **classificar_e_rotear_ocorrencia** passando a descrição completa e as coordenadas.
2. Em seguida, com o categoria_id retornado, chame **buscar_chamados_similares** com as MESMAS coordenadas.
3. Só então responda ao cidadão.

Se faltar a descrição do problema ou as coordenadas, NÃO chame ferramentas: peça a informação que falta
(ex.: "Pode me enviar a latitude e longitude do local?"). Nunca invente coordenadas, categorias,
órgãos, protocolos ou prioridades — use apenas o que as ferramentas retornarem.
Se uma ferramenta retornar "error", explique o problema ao cidadão e peça o dado corrigido.

## Formato da resposta (português do Brasil, objetivo)
**Triagem da ocorrência**
- Categoria: <categoria> (<subcategoria>)
- Órgão responsável: <sigla> — <nome do órgão>
- Prioridade: <prioridade> | SLA: <sla_horas> h
(Se a prioridade for Crítica, acrescente um alerta de segurança curto, ex.: manter distância do local.)

**Chamados semelhantes (até 200 m)**
- Liste cada chamado como "<protocolo> — ~<distância> m — <status>".
- Se houver algum, sugira acompanhar/apoiar o chamado existente em vez de abrir um duplicado.
- Se não houver nenhum, diga que não há chamados abertos próximos e que a ocorrência pode ser registrada.

## Privacidade (LGPD)
Nunca exponha nem peça dados pessoais de terceiros. Informe apenas protocolo, distância e status.
`.trim();

export const PERFIL_TRIAGEM: AgentProfile = {
  nome: 'triagem',
  systemPrompt: SYSTEM_PROMPT_TRIAGEM,
  // As descrições são lidas pelo modelo para decidir QUANDO e COMO chamar cada ferramenta.
  declarations: [
    {
      name: 'classificar_e_rotear_ocorrencia',
      description:
        'Classifica o relato de um problema urbano em uma categoria ativa do Fiscalize, identifica o órgão ' +
        'competente pela regra de roteamento (ex.: CELPE, COMPESA, EMLURB, CTTU) e define a prioridade e o SLA. ' +
        'Gatilhos de emergência urbana (ex.: fiação exposta, esgoto em via) resultam em prioridade Crítica. ' +
        'Use sempre que o cidadão descrever um problema e informar a localização.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          descricao: {
            type: Type.STRING,
            description: 'Descrição do problema nas palavras do cidadão (texto completo, sem resumir).',
          },
          latitude: { type: Type.NUMBER, description: 'Latitude em graus decimais (ex.: -8.1197).' },
          longitude: { type: Type.NUMBER, description: 'Longitude em graus decimais (ex.: -34.8986).' },
        },
        required: ['descricao', 'latitude', 'longitude'],
      },
    },
    {
      name: 'buscar_chamados_similares',
      description:
        'Procura chamados NÃO finalizados da mesma categoria num raio de até 200 metros da localização informada, ' +
        'para evitar registros duplicados. Retorna somente protocolo, distância aproximada e status ' +
        '(nunca dados pessoais de outros cidadãos). Use o categoria_id retornado por classificar_e_rotear_ocorrencia.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          categoria_id: { type: Type.INTEGER, description: 'ID numérico da categoria (ex.: 3 = Iluminação Pública).' },
          latitude: { type: Type.NUMBER, description: 'Latitude em graus decimais.' },
          longitude: { type: Type.NUMBER, description: 'Longitude em graus decimais.' },
        },
        required: ['categoria_id', 'latitude', 'longitude'],
      },
    },
  ],
  handlers: {
    classificar_e_rotear_ocorrencia: (args) => classificarERotearOcorrencia(args as unknown as ClassificarArgs),
    buscar_chamados_similares: (args) => buscarChamadosSimilares(args as unknown as BuscarArgs),
  },
};
