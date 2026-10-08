import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FiscalizeAgent, type AgentReply } from '../../src/agent';
import { CASOS_DE_TESTE } from '../../src/casos';
import { GEMINI_MODEL, GEMINI_RPM, getApiKey } from '../../src/config';
import { GeminiClient } from '../../src/llm/geminiClient';
import { MockChamadosSource, USUARIOS_DEMO } from '../../src/data/chamadosSource';
import { PERFIL_ACOMPANHAMENTO } from '../../src/perfis/acompanhamento';

const apiKey = getApiKey();
const skip = apiKey ? false : 'GEMINI_API_KEY não configurada — teste ao vivo ignorado';
const [CT01, CT02, CT03] = CASOS_DE_TESTE;

async function perguntar(prompt: string): Promise<AgentReply> {
  const agent = new FiscalizeAgent(new GeminiClient(apiKey!, GEMINI_MODEL, GEMINI_RPM));
  return agent.send(prompt);
}

function saidaDe(reply: AgentReply, nome: string): any {
  const call = reply.toolCalls.find((c) => c.name === nome);
  assert.ok(call, `o modelo deveria ter chamado ${nome}; chamou: ${reply.toolCalls.map((c) => c.name).join(', ') || 'nada'}`);
  assert.ok('output' in call.outcome, JSON.stringify(call.outcome));
  return call.outcome.output;
}

describe('Gemini ao vivo', { skip, timeout: 600_000 }, () => {
  it(`${CT01.id}: chama as 2 ferramentas e responde com CELPE / Crítica / protocolos`, async () => {
    const reply = await perguntar(CT01.prompt);
    assert.equal(saidaDe(reply, 'classificar_e_rotear_ocorrencia').prioridade, 'Crítica');
    assert.equal(saidaDe(reply, 'buscar_chamados_similares').total_encontrado, 2);
    assert.match(reply.text, /CELPE/);
    assert.match(reply.text, /DEM-20260921-A7K2/);
  });

  it(`${CT02.id}: roteia para COMPESA com prioridade Crítica`, async () => {
    const reply = await perguntar(CT02.prompt);
    assert.equal(saidaDe(reply, 'classificar_e_rotear_ocorrencia').orgao_sigla, 'COMPESA');
    assert.equal(saidaDe(reply, 'buscar_chamados_similares').total_encontrado, 1);
    assert.match(reply.text, /DEM-20261003-E8SG/);
  });

  it(`${CT03.id}: EMLURB / Alta sem chamados similares`, async () => {
    const reply = await perguntar(CT03.prompt);
    const c = saidaDe(reply, 'classificar_e_rotear_ocorrencia');
    assert.equal(c.orgao_sigla, 'EMLURB');
    assert.equal(c.prioridade, 'Alta');
    assert.equal(saidaDe(reply, 'buscar_chamados_similares').total_encontrado, 0);
  });

  it('sem coordenadas, o agente pede a localização em vez de chamar ferramentas', async () => {
    const reply = await perguntar('Tem um poste apagado na minha rua.');
    assert.equal(reply.toolCalls.length, 0);
    assert.match(reply.text, /latitude|localiza|coordenad/i);
  });
});

describe('Gemini ao vivo — perfil acompanhamento', { skip, timeout: 600_000 }, () => {
  const novoAgente = (usuario: typeof USUARIOS_DEMO.cidadao) =>
    new FiscalizeAgent(new GeminiClient(apiKey!, GEMINI_MODEL, GEMINI_RPM), {
      perfil: PERFIL_ACOMPANHAMENTO,
      contexto: { chamados: new MockChamadosSource(usuario) },
    });

  it('cidadão consulta dois protocolos e não vê o chamado de outro cidadão', async () => {
    const reply = await novoAgente(USUARIOS_DEMO.cidadao).send(
      'Qual o status do DEM-20260921-A7K2 e do DEM-20261003-E8SG?',
    );
    const r = saidaDe(reply, 'consultar_status_chamados');
    assert.deepEqual(r.chamados.map((c: any) => c.protocolo), ['DEM-20260921-A7K2']);
    assert.deepEqual(r.nao_encontrados, ['DEM-20261003-E8SG']);
    assert.match(reply.text, /Em Andamento/);
    assert.doesNotMatch(reply.text, /Em Análise/);
  });

  it('admin consulta o mesmo protocolo de outro cidadão', async () => {
    const reply = await novoAgente(USUARIOS_DEMO.admin).send('Qual o status do DEM-20261003-E8SG?');
    assert.equal(saidaDe(reply, 'consultar_status_chamados').chamados[0].status, 'Em Análise');
  });
});
