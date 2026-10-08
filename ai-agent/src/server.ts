import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { FiscalizeAgent, type ModelClient } from './agent';
import { BackendChamadosSource, type ChamadosSource } from './data/chamadosSource';
import { PERFIL_ACOMPANHAMENTO } from './perfis/acompanhamento';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_CHARS = 1000;

export interface AgentServerOptions {
  client: ModelClient;
  /** URL do backend do Fiscalize (ex.: http://localhost:3000). */
  apiUrl: string;
  /** Se definido, toda requisição precisa do header x-agent-secret com este valor. */
  secret?: string;
  sessionTtlMs?: number;
  maxSessions?: number;
  /** Permite trocar a fonte de chamados nos testes. Padrão: API real com o JWT recebido. */
  createSource?: (token: string) => ChamadosSource;
}

interface Session {
  agent: FiscalizeAgent;
  lastUsed: number;
}

/**
 * Servidor HTTP do agente (perfil "acompanhamento") usado pelo backend em POST /ai/chat.
 *   POST /chat  { sessionId?, message }  + Authorization: Bearer <JWT do usuário>
 *   GET  /health
 * O JWT é repassado ao backend nas consultas das ferramentas: o escopo de acesso
 * (cidadão → só os seus; gestor/admin → todos) é sempre decidido pelo backend.
 */
export function createAgentServer(options: AgentServerOptions): Server {
  const ttl = options.sessionTtlMs ?? 30 * 60 * 1000;
  const maxSessions = options.maxSessions ?? 500;
  const createSource = options.createSource ?? ((token) => new BackendChamadosSource(options.apiUrl, token));
  const sessions = new Map<string, Session>();

  function getSession(id: string): Session {
    const now = Date.now();
    for (const [key, s] of sessions) if (now - s.lastUsed > ttl) sessions.delete(key);
    let session = sessions.get(id);
    if (!session) {
      if (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value!); // remove a mais antiga
      session = { agent: new FiscalizeAgent(options.client, { perfil: PERFIL_ACOMPANHAMENTO }), lastUsed: now };
      sessions.set(id, session);
    }
    session.lastUsed = now;
    return session;
  }

  return createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return json(res, 200, { status: 'ok', perfil: PERFIL_ACOMPANHAMENTO.nome });
      }
      if (req.method !== 'POST' || req.url !== '/chat') {
        return json(res, 404, { error: 'Rota não encontrada.' });
      }
      if (options.secret && !segredoConfere(req.headers['x-agent-secret'], options.secret)) {
        return json(res, 403, { error: 'Acesso negado ao serviço do agente.' });
      }

      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        return json(res, 401, { error: 'Token do usuário ausente.' });
      }
      const token = auth.slice(7);

      const body = await lerJson(req);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message || message.length > MAX_MESSAGE_CHARS) {
        return json(res, 400, { error: `Mensagem obrigatória (até ${MAX_MESSAGE_CHARS} caracteres).` });
      }
      const sessionId =
        typeof body.sessionId === 'string' && body.sessionId.length > 0 && body.sessionId.length <= 200
          ? body.sessionId
          : randomUUID();

      const { agent } = getSession(sessionId);
      const reply = await agent.send(message, { chamados: createSource(token) });

      return json(res, 200, {
        sessionId,
        reply: reply.text,
        toolCalls: reply.toolCalls.map((c) => ({
          name: c.name,
          args: c.args,
          ...('error' in c.outcome ? { ok: false, error: c.outcome.error } : { ok: true, output: c.outcome.output }),
        })),
      });
    } catch (err) {
      if (err instanceof BodyError) return json(res, 400, { error: err.message });
      console.error('[ai-agent] erro ao processar /chat:', err);
      return json(res, 502, { error: 'Falha ao consultar o modelo de IA. Tente novamente.' });
    }
  });
}

class BodyError extends Error {}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function lerJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new BodyError('Corpo da requisição muito grande.');
    chunks.push(chunk as Buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new BodyError('JSON inválido.');
  }
}

function segredoConfere(recebido: string | string[] | undefined, esperado: string): boolean {
  if (typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
