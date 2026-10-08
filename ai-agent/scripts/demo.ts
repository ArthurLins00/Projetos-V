import { FiscalizeAgent } from '../src/agent';
import { CASOS_DE_TESTE } from '../src/casos';
import { GEMINI_MODEL, GEMINI_RPM, requireApiKey } from '../src/config';
import { GeminiClient } from '../src/llm/geminiClient';
import { ciano, formatarChamadaFerramenta, negrito, verde } from '../src/cli/format';

const client = new GeminiClient(requireApiKey(), GEMINI_MODEL, GEMINI_RPM);

for (const caso of CASOS_DE_TESTE) {
  const agent = new FiscalizeAgent(client, { onToolCall: (c) => console.log(formatarChamadaFerramenta(c)) });
  console.log(negrito(`\n═══ ${caso.id} — ${caso.titulo} ═══`));
  console.log(`${ciano('Você ›')} ${caso.prompt}`);
  const resposta = await agent.send(caso.prompt);
  console.log(`\n${verde('Fiscalize ›')} ${resposta.text}`);
}
