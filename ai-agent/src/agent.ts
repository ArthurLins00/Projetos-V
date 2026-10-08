import type { Content, FunctionCall, Part } from '@google/genai';
import type { AgentProfile, ToolContext } from './perfis/types';
import { PERFIL_TRIAGEM } from './perfis/triagem';
import { executarFerramenta, type ToolOutcome } from './tools';

/** Resposta de UM passo do modelo (pode ser texto final ou pedidos de função). */
export interface ModelTurn {
  content: Content;
  functionCalls: FunctionCall[];
  text: string;
}

/** Abstração do LLM: o Gemini real em produção, um cliente roteirizado nos testes. */
export interface ModelClient {
  generate(history: Content[], perfil: AgentProfile): Promise<ModelTurn>;
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  outcome: ToolOutcome;
}

export interface AgentReply {
  text: string;
  toolCalls: ToolCallRecord[];
}

export interface AgentOptions {
  /** Instrução de sistema + ferramentas. Padrão: triagem (entrega da AV2). */
  perfil?: AgentProfile;
  /** Dependências das ferramentas (ex.: fonte de chamados do usuário). */
  contexto?: ToolContext;
  /** Limite de idas e voltas modelo ↔ ferramentas por mensagem do usuário. */
  maxSteps?: number;
  /** Chamado a cada ferramenta executada (a CLI usa para mostrar o rastro). */
  onToolCall?: (call: ToolCallRecord) => void;
}

/**
 * Loop de Function Calling:
 * usuário → modelo → (functionCall → executa ferramenta → functionResponse → modelo)* → texto final.
 * Mantém o histórico para permitir conversa com várias mensagens.
 */
export class FiscalizeAgent {
  private history: Content[] = [];
  private readonly maxSteps: number;
  readonly perfil: AgentProfile;

  constructor(private readonly client: ModelClient, private readonly options: AgentOptions = {}) {
    this.maxSteps = options.maxSteps ?? 6;
    this.perfil = options.perfil ?? PERFIL_TRIAGEM;
  }

  /** `contexto` sobrescreve o do construtor nesta mensagem (ex.: token renovado do usuário). */
  async send(message: string, contexto: ToolContext = this.options.contexto ?? {}): Promise<AgentReply> {
    this.history.push({ role: 'user', parts: [{ text: message }] });
    const toolCalls: ToolCallRecord[] = [];

    for (let step = 0; step < this.maxSteps; step++) {
      const turn = await this.client.generate(this.history, this.perfil);
      this.history.push(turn.content);

      if (turn.functionCalls.length === 0) {
        return { text: turn.text, toolCalls };
      }

      const responses: Part[] = [];
      for (const call of turn.functionCalls) {
        const name = call.name ?? '';
        const args = (call.args ?? {}) as Record<string, unknown>;
        const outcome = await executarFerramenta(this.perfil, name, args, contexto);
        const record = { name, args, outcome };
        toolCalls.push(record);
        this.options.onToolCall?.(record);
        responses.push({ functionResponse: { id: call.id, name, response: outcome as Record<string, unknown> } });
      }
      this.history.push({ role: 'user', parts: responses });
    }

    throw new Error(`O agente excedeu ${this.maxSteps} passos sem produzir uma resposta final.`);
  }

  reset(): void {
    this.history = [];
  }

  getHistory(): readonly Content[] {
    return this.history;
  }
}
