import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FiscalizeAgent } from '../src/agent';
import { CASOS_DE_TESTE } from '../src/casos';
import { PONTOS } from '../src/data/mockData';
import { ScriptedModelClient, roteiroCompleto } from './scriptedClient';

const [CT01, CT02, CT03] = CASOS_DE_TESTE;
const CAMPOS_PUBLICOS = ['distancia_aproximada_metros', 'protocolo', 'status'];

async function executar(prompt: string, ponto: { latitude: number; longitude: number }) {
  const client = new ScriptedModelClient(roteiroCompleto(prompt, ponto.latitude, ponto.longitude));
  const agent = new FiscalizeAgent(client);
  const reply = await agent.send(prompt);
  return { reply, client, agent };
}

function saida(reply: Awaited<ReturnType<FiscalizeAgent['send']>>, idx: number): any {
  const outcome = reply.toolCalls[idx].outcome;
  assert.ok('output' in outcome, `ferramenta #${idx} retornou erro: ${JSON.stringify(outcome)}`);
  return outcome.output;
}

describe('CT-01 — fiação exposta na Av. Boa Viagem', () => {
  it('classifica como Iluminação Pública/CELPE com prioridade Crítica e encontra 2 chamados similares', async () => {
    const { reply, client } = await executar(CT01.prompt, PONTOS.boaViagem);

    assert.deepEqual(reply.toolCalls.map((c) => c.name), ['classificar_e_rotear_ocorrencia', 'buscar_chamados_similares']);
    assert.equal(client.chamadas, 3, 'modelo → tool 1 → modelo → tool 2 → modelo (resposta final)');

    const classificacao = saida(reply, 0);
    assert.equal(classificacao.categoria_id, 3);
    assert.equal(classificacao.categoria, 'Iluminação Pública');
    assert.equal(classificacao.orgao_sigla, 'CELPE');
    assert.equal(classificacao.prioridade, 'Crítica');
    assert.equal(classificacao.emergencia, true);

    const busca = saida(reply, 1);
    assert.equal(reply.toolCalls[1].args.categoria_id, 3, 'segunda tool recebe o categoria_id da primeira');
    assert.deepEqual(busca.chamados.map((c: any) => c.protocolo), ['DEM-20260921-A7K2', 'DEM-20260930-Q3MZ']);
    assert.deepEqual(busca.chamados.map((c: any) => c.distancia_aproximada_metros), [80, 150]);
    for (const c of busca.chamados) assert.deepEqual(Object.keys(c).sort(), CAMPOS_PUBLICOS);
    assert.doesNotMatch(JSON.stringify(busca), /Maria|João|cpf|telefone|solicitante/i);

    assert.match(reply.text, /Prioridade: Crítica/);
    assert.match(reply.text, /DEM-20260921-A7K2 — ~80 m — Em Andamento/);
  });
});

describe('CT-02 — esgoto em via na Rua da Aurora', () => {
  it('roteia para a COMPESA com prioridade Crítica e ignora chamado já Fechado', async () => {
    const { reply } = await executar(CT02.prompt, PONTOS.ruaDaAurora);

    const classificacao = saida(reply, 0);
    assert.equal(classificacao.categoria, 'Água e Esgoto');
    assert.equal(classificacao.orgao_sigla, 'COMPESA');
    assert.equal(classificacao.prioridade, 'Crítica');
    assert.ok(classificacao.termos_identificados.includes('esgoto em via'));

    const busca = saida(reply, 1);
    assert.equal(busca.total_encontrado, 1);
    assert.deepEqual(busca.chamados[0], { protocolo: 'DEM-20261003-E8SG', distancia_aproximada_metros: 120, status: 'Em Análise' });
    assert.match(reply.text, /COMPESA/);
  });
});

describe('CT-03 — buraco no asfalto na Madalena', () => {
  it('roteia para a EMLURB com prioridade Alta e não encontra similares', async () => {
    const { reply } = await executar(CT03.prompt, PONTOS.madalena);

    const classificacao = saida(reply, 0);
    assert.equal(classificacao.categoria, 'Infraestrutura');
    assert.equal(classificacao.subcategoria, 'Buraco na pista');
    assert.equal(classificacao.orgao_sigla, 'EMLURB');
    assert.equal(classificacao.prioridade, 'Alta');
    assert.equal(classificacao.emergencia, false);

    const busca = saida(reply, 1);
    assert.equal(busca.total_encontrado, 0);
    assert.match(reply.text, /Nenhum chamado aberto em até 200 m/);
  });
});
