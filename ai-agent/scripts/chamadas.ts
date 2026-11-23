// Chamadas reproduzíveis do agente, SEM chave do Gemini: o loop do agente e as ferramentas reais
// rodam de verdade (lendo os JSON de dados/ e gravando logs/uso-dados.jsonl); só a decisão do modelo
// é roteirizada (ScriptedModelClient), igual ao npm test.
//
//   npm run chamadas -- ct01      emergência na Av. Boa Viagem (2 chamados semelhantes)
//   npm run chamadas -- ct03      buraco na Madalena (caso difícil: nenhum semelhante)
//   npm run chamadas -- erro      modelo pede a categoria 7, descontinuada (caso difícil: erro claro)
//   npm run chamadas -- ct02      esgoto na Rua da Aurora (opcional, usa a COMPESA)
//   npm run chamadas              ct01, ct03 e erro, em sequência
import { FiscalizeAgent } from '../src/agent';
import { CASOS_DE_TESTE } from '../src/casos';
import { formatarChamadaFerramenta, ciano, cinza, negrito, verde } from '../src/cli/format';
import { caminhoLog } from '../src/data/logUso';
import { PONTOS } from '../src/data/mockData';
import { chamarFerramenta, responder, roteiroCompleto, ScriptedModelClient, type Passo } from '../src/llm/scriptedClient';

const [CT01, CT02, CT03] = CASOS_DE_TESTE;
const PADRAO = ['ct01', 'ct03', 'erro'];

const PROMPT_ERRO =
  'Tem um galho de árvore enorme pendurado precisando de poda na Rua das Graças. Estou em -8.0469, -34.8990.';

interface Chamada {
  id: string;
  titulo: string;
  prompt: string;
  roteiro: () => Passo[];
}

const CHAMADAS: Chamada[] = [
  {
    id: 'ct01',
    titulo: 'CT-01: fiação exposta na Av. Boa Viagem',
    prompt: CT01.prompt,
    roteiro: () => roteiroCompleto(CT01.prompt, PONTOS.boaViagem.latitude, PONTOS.boaViagem.longitude),
  },
  {
    id: 'ct03',
    titulo: 'CT-03: buraco na Madalena (nenhum chamado semelhante)',
    prompt: CT03.prompt,
    roteiro: () => roteiroCompleto(CT03.prompt, PONTOS.madalena.latitude, PONTOS.madalena.longitude),
  },
  {
    id: 'ct02',
    titulo: 'CT-02: esgoto em via na Rua da Aurora',
    prompt: CT02.prompt,
    roteiro: () => roteiroCompleto(CT02.prompt, PONTOS.ruaDaAurora.latitude, PONTOS.ruaDaAurora.longitude),
  },
  {
    id: 'erro',
    titulo: 'Caso difícil: o modelo pede a categoria 7 (Poda de Árvores, descontinuada)',
    prompt: PROMPT_ERRO,
    roteiro: () => [
      chamarFerramenta('classificar_e_rotear_ocorrencia', { descricao: PROMPT_ERRO, latitude: -8.0469, longitude: -34.899 }),
      chamarFerramenta('buscar_chamados_similares', { categoria_id: 7, latitude: -8.0469, longitude: -34.899 }),
      responder(() =>
        'A categoria Poda de Árvores foi descontinuada, então não consigo procurar chamados semelhantes nela. ' +
        'Sua ocorrência foi encaminhada para triagem manual (Outros Problemas / SEMC).',
      ),
    ],
  },
];

const pedidos = process.argv.slice(2).map((a) => a.toLowerCase());
const selecionadas = CHAMADAS.filter((c) => (pedidos.length ? pedidos : PADRAO).includes(c.id));
if (selecionadas.length === 0) {
  console.error(`Chamada desconhecida: ${pedidos.join(', ')}. Use: ${CHAMADAS.map((c) => c.id).join(', ')}.`);
  process.exit(1);
}

for (const chamada of selecionadas) {
  const agent = new FiscalizeAgent(new ScriptedModelClient(chamada.roteiro()), {
    contexto: { canal: `npm run chamadas -- ${chamada.id}` },
    onToolCall: (c) => console.log(formatarChamadaFerramenta(c)),
  });
  console.log(negrito(`\n═══ ${chamada.titulo} ═══`));
  console.log(`${ciano('Você ›')} ${chamada.prompt}`);
  const resposta = await agent.send(chamada.prompt);
  console.log(`\n${verde('Fiscalize ›')} ${resposta.text}`);
}

console.log(cinza(`\nUso dos dados registrado em ${caminhoLog()} (veja o resumo com npm run resumo).`));
