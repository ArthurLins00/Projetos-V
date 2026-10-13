import { randomUUID } from 'crypto';
import { AI_AGENT_SECRET, AI_AGENT_URL } from '../config/env';
import { AppError } from '../middlewares/errorMiddleware';

const AGENT_TIMEOUT_MS = 60_000;

interface ChatInput {
  userId: string;
  token: string;
  sessionId?: string;
  message: string;
}

interface AgentToolCall {
  name: string;
  ok: boolean;
  output?: { chamados?: { id: string; protocolo: string; titulo: string; status: string }[] };
}

interface AgentResponse {
  sessionId: string;
  reply: string;
  toolCalls?: AgentToolCall[];
  error?: string;
}

export const aiService = {
  async chat({ userId, token, sessionId, message }: ChatInput) {
    const clientSession = sessionId || randomUUID();

    let response: Response;
    try {
      response = await fetch(`${AI_AGENT_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(AI_AGENT_SECRET && { 'x-agent-secret': AI_AGENT_SECRET }),
        },
        body: JSON.stringify({ sessionId: `${userId}:${clientSession}`, message }),
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      });
    } catch {
      throw new AppError(503, 'O assistente está indisponível no momento. Tente novamente em instantes.');
    }

    const body = (await response.json().catch(() => ({}))) as Partial<AgentResponse>;
    if (!response.ok) {
      if (response.status === 400) throw new AppError(400, body.error ?? 'Mensagem inválida.');
      console.error(`[AI] Serviço do agente respondeu ${response.status}: ${body.error ?? ''}`);
      throw new AppError(502, 'Não foi possível obter a resposta do assistente. Tente novamente.');
    }

    const chamados = new Map<string, { id: string; protocolo: string; titulo: string; status: string }>();
    for (const call of body.toolCalls ?? []) {
      for (const c of (call.ok && call.output?.chamados) || []) {
        chamados.set(c.id, { id: c.id, protocolo: c.protocolo, titulo: c.titulo, status: c.status });
      }
    }

    return {
      sessionId: clientSession,
      reply: body.reply ?? '',
      chamados: [...chamados.values()],
    };
  },
};
