import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { parseArgs } from 'node:util';
import { FiscalizeAgent } from './agent';
import { CASOS_DE_TESTE } from './casos';
import { GEMINI_MODEL, GEMINI_RPM, requireApiKey } from './config';
import { GeminiClient } from './llm/geminiClient';
import { MockChamadosSource, USUARIOS_DEMO } from './data/chamadosSource';
import { PERFIL_ACOMPANHAMENTO } from './perfis/acompanhamento';
import { PERFIL_TRIAGEM } from './perfis/triagem';
import { ciano, cinza, formatarChamadaFerramenta, negrito, verde } from './cli/format';

const AJUDA = `
Comandos:
  /casos        mostra os casos de teste prontos para copiar
  /ferramentas  lista as ferramentas (function declarations) do agente
  /limpar       reinicia a conversa
  /sair         encerra
`;

const CASOS_ACOMPANHAMENTO = [
  'Como estão os meus chamados?',
  'Qual o status do DEM-20260921-A7K2 e do DEM-20261001-C4RR?',
  'E o protocolo DEM-20261003-E8SG?   (do vizinho: cidadão não vê; admin vê)',
];

// npm start                                  → perfil triagem (entrega da AV2)
// npm start -- --acompanhamento              → consulta de status como cidadão (dados mockados)
// npm start -- --acompanhamento --admin      → consulta de status como admin (vê todos)
const { values: flags } = parseArgs({
  options: { acompanhamento: { type: 'boolean' }, admin: { type: 'boolean' } },
});

async function main() {
  const acompanhamento = Boolean(flags.acompanhamento);
  const usuario = flags.admin ? USUARIOS_DEMO.admin : USUARIOS_DEMO.cidadao;

  const agent = new FiscalizeAgent(new GeminiClient(requireApiKey(), GEMINI_MODEL, GEMINI_RPM), {
    perfil: acompanhamento ? PERFIL_ACOMPANHAMENTO : PERFIL_TRIAGEM,
    contexto: { chamados: new MockChamadosSource(usuario) },
    onToolCall: (call) => console.log(formatarChamadaFerramenta(call)),
  });

  console.log(negrito('\n🏙️  Assistente Fiscalize — ' + (acompanhamento ? 'Acompanhamento de Chamados' : 'Triagem de Demandas Urbanas')));
  console.log(cinza(`Modelo: ${GEMINI_MODEL} | Perfil: ${agent.perfil.nome}` + (acompanhamento ? ` | Usuário demo: ${usuario.id} (${usuario.perfil})` : '')));
  console.log(cinza(`Ferramentas: ${agent.perfil.declarations.map((f) => f.name).join(', ')}`));
  console.log(cinza(AJUDA));

  const rl = readline.createInterface({ input, output });
  rl.on('SIGINT', () => {
    rl.close();
    process.exit(0);
  });

  while (true) {
    let linha: string;
    try {
      linha = (await rl.question(ciano('Você › '))).trim();
    } catch {
      break; // stdin fechado
    }
    if (!linha) continue;

    if (linha === '/sair') break;
    if (linha === '/limpar') {
      agent.reset();
      console.log(cinza('Conversa reiniciada.\n'));
      continue;
    }
    if (linha === '/casos') {
      if (acompanhamento) for (const p of CASOS_ACOMPANHAMENTO) console.log(`  ${p}\n`);
      else for (const c of CASOS_DE_TESTE) console.log(`${negrito(c.id)} ${c.titulo}\n  ${c.prompt}\n`);
      continue;
    }
    if (linha === '/ferramentas') {
      for (const f of agent.perfil.declarations) console.log(`${negrito(f.name ?? '')}\n  ${cinza(f.description ?? '')}\n`);
      continue;
    }

    try {
      const resposta = await agent.send(linha);
      console.log(`\n${verde('Fiscalize ›')} ${resposta.text}\n`);
    } catch (err) {
      console.error(`\n[ERRO] ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  rl.close();
  console.log(cinza('Até logo!'));
}

main();
