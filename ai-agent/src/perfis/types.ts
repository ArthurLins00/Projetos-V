import type { FunctionDeclaration } from '@google/genai';
import type { ChamadosSource } from '../data/chamadosSource';

export interface ToolContext {
  chamados?: ChamadosSource;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => unknown | Promise<unknown>;

export interface AgentProfile {
  nome: 'triagem' | 'acompanhamento';
  systemPrompt: string;
  declarations: FunctionDeclaration[];
  handlers: Record<string, ToolHandler>;
}
