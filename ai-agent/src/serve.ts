import { AI_AGENT_HOST, AI_AGENT_PORT, AI_AGENT_SECRET, FISCALIZE_API_URL, GEMINI_MODEL, GEMINI_RPM, requireApiKey } from './config';
import { GeminiClient } from './llm/geminiClient';
import { createAgentServer } from './server';

const server = createAgentServer({
  client: new GeminiClient(requireApiKey(), GEMINI_MODEL, GEMINI_RPM),
  apiUrl: FISCALIZE_API_URL,
  ...(AI_AGENT_SECRET && { secret: AI_AGENT_SECRET }),
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[ERRO] A porta ${AI_AGENT_PORT} já está em uso: provavelmente outro "npm run serve" já está rodando.\n` +
        '  Feche o outro terminal do agente, ou use outra porta com AI_AGENT_PORT no ai-agent/.env\n' +
        '  (e o mesmo endereço em AI_AGENT_URL no backend/.env).\n',
    );
    process.exit(1);
  }
  throw err;
});

server.listen(AI_AGENT_PORT, AI_AGENT_HOST, () => {
  console.log(`[ai-agent] Assistente Fiscalize (perfil acompanhamento) em http://${AI_AGENT_HOST}:${AI_AGENT_PORT}`);
  console.log(`[ai-agent] Modelo: ${GEMINI_MODEL} | Backend consultado: ${FISCALIZE_API_URL}`);
});
