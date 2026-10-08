import type { FunctionDeclaration } from '@google/genai';
import type { ChamadosSource } from '../data/chamadosSource';

/** Dependências que as ferramentas recebem a cada execução. */
export interface ToolContext {
  /** Origem dos chamados do usuário (mock ou API real com o JWT do usuário). */
  chamados?: ChamadosSource;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => unknown | Promise<unknown>;

/**
 * Um "perfil" de agente = instrução de sistema + conjunto de ferramentas.
 * - triagem: entrega da AV2 (classificar/rotear + chamados similares), dados mockados.
 * - acompanhamento: chat do app, consulta o status dos chamados do usuário logado.
 */
export interface AgentProfile {
  nome: 'triagem' | 'acompanhamento';
  systemPrompt: string;
  declarations: FunctionDeclaration[];
  handlers: Record<string, ToolHandler>;
}
