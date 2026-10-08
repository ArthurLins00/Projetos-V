import type { Content, FunctionCall } from '@google/genai';
import type { ModelClient, ModelTurn } from '../src/agent';

/**
 * Dublê do Gemini para testes offline e determinísticos.
 * Cada passo recebe o histórico (inclusive os functionResponse produzidos pelas ferramentas REAIS)
 * e devolve o que o modelo "responderia". Assim validamos o loop de function calling sem rede.
 */
export type Passo = (history: Content[]) => ModelTurn;

export class ScriptedModelClient implements ModelClient {
  public chamadas = 0;
  constructor(private readonly passos: Passo[]) {}

  async generate(history: Content[]): Promise<ModelTurn> {
    const passo = this.passos[this.chamadas++];
    if (!passo) throw new Error(`Roteiro sem passo #${this.chamadas}`);
    return passo(history);
  }
}

export function chamarFerramenta(name: string, args: Record<string, unknown>): Passo {
  return () => {
    const call: FunctionCall = { id: `call-${name}`, name, args };
    return { content: { role: 'model', parts: [{ functionCall: call }] }, functionCalls: [call], text: '' };
  };
}

export function responder(gerarTexto: (history: Content[]) => string): Passo {
  return (history) => {
    const text = gerarTexto(history);
    return { content: { role: 'model', parts: [{ text }] }, functionCalls: [], text };
  };
}

/** Saída (`output`) da última resposta de ferramenta com esse nome presente no histórico. */
export function ultimaSaida<T = any>(history: Content[], nome: string): T {
  for (let i = history.length - 1; i >= 0; i--) {
    for (const part of history[i].parts ?? []) {
      if (part.functionResponse?.name === nome) return (part.functionResponse.response as any).output as T;
    }
  }
  throw new Error(`Nenhuma resposta da ferramenta ${nome} no histórico`);
}

/** Atalho: o "modelo" encadeia as 2 ferramentas — a segunda usa o categoria_id vindo da primeira. */
export function roteiroCompleto(descricao: string, latitude: number, longitude: number): Passo[] {
  return [
    chamarFerramenta('classificar_e_rotear_ocorrencia', { descricao, latitude, longitude }),
    (history) => {
      const { categoria_id } = ultimaSaida(history, 'classificar_e_rotear_ocorrencia');
      return chamarFerramenta('buscar_chamados_similares', { categoria_id, latitude, longitude })(history);
    },
    responder((history) => {
      const c = ultimaSaida(history, 'classificar_e_rotear_ocorrencia');
      const b = ultimaSaida(history, 'buscar_chamados_similares');
      const lista = b.chamados.map((x: any) => `${x.protocolo} — ~${x.distancia_aproximada_metros} m — ${x.status}`);
      return [
        `Categoria: ${c.categoria} (${c.subcategoria})`,
        `Órgão responsável: ${c.orgao_sigla}`,
        `Prioridade: ${c.prioridade} | SLA: ${c.sla_horas} h`,
        lista.length ? `Chamados semelhantes:\n${lista.join('\n')}` : 'Nenhum chamado aberto em até 200 m.',
      ].join('\n');
    }),
  ];
}
