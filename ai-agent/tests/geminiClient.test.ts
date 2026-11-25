import { beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { GenerateContentResponse } from '@google/genai';
import { GeminiClient, type GerarConteudo } from '../src/llm/geminiClient';
import { PERFIL_TRIAGEM } from '../src/perfis/triagem';

function erroApi(status: number, message = `erro ${status}`) {
  return Object.assign(new Error(message), { status });
}

function resposta(texto: string): GenerateContentResponse {
  return { candidates: [{ content: { role: 'model', parts: [{ text: texto }] } }] } as GenerateContentResponse;
}

/** Simula a API: cada modelo tem uma fila de resultados; o último se repete. */
function apiFalsa(roteiro: Record<string, Array<Error | string>>) {
  const chamadas: string[] = [];
  const gerar: GerarConteudo = async (model) => {
    chamadas.push(model);
    const fila = roteiro[model] ?? [erroApi(404)];
    const item = fila.length > 1 ? fila.shift()! : fila[0]!;
    if (item instanceof Error) throw item;
    return resposta(item);
  };
  return { gerar, chamadas };
}

let rpm = 1000;
function cliente(models: string[], gerar: GerarConteudo) {
  // rpm diferente por teste: os limitadores são compartilhados por modelo+rpm.
  return new GeminiClient('chave-falsa', models, rpm++, { gerar, esperar: async () => {} });
}

const enviar = (c: GeminiClient) => c.generate([{ role: 'user', parts: [{ text: 'oi' }] }], PERFIL_TRIAGEM);

describe('GeminiClient — modelos de reserva', () => {
  beforeEach(() => {
    mock.method(console, 'warn', () => {});
  });

  it('[TC-56] usa o modelo principal quando ele responde', async () => {
    const api = apiFalsa({ a: ['resposta de a'], b: ['resposta de b'] });
    const reply = await enviar(cliente(['a', 'b'], api.gerar));
    assert.equal(reply.text, 'resposta de a');
    assert.deepEqual(api.chamadas, ['a']);
  });

  it('[TC-56] principal sobrecarregado (503) cai em silêncio para a reserva', async () => {
    const api = apiFalsa({ a: [erroApi(503)], b: ['resposta de b'] });
    const reply = await enviar(cliente(['a', 'b'], api.gerar));
    assert.equal(reply.text, 'resposta de b');
    assert.deepEqual(api.chamadas, ['a', 'a', 'b'], 'tenta o principal 2 vezes antes de trocar');
  });

  it('[TC-56] modelo descontinuado (404) ou cota diária (429) troca na hora, sem nova tentativa', async () => {
    const api = apiFalsa({ a: [erroApi(404)], b: [erroApi(429, 'GenerateRequestsPerDay exceeded')], c: ['ok c'] });
    const reply = await enviar(cliente(['a', 'b', 'c'], api.gerar));
    assert.equal(reply.text, 'ok c');
    assert.deepEqual(api.chamadas, ['a', 'b', 'c']);
  });

  it('[TC-56] o modelo que falhou fica fora da rotação nas perguntas seguintes', async () => {
    const api = apiFalsa({ a: [erroApi(503)], b: ['ok b'] });
    const c = cliente(['a', 'b'], api.gerar);
    await enviar(c);
    api.chamadas.length = 0;
    await enviar(c);
    assert.deepEqual(api.chamadas, ['b']);
  });

  it('[TC-56] erro da requisição (400) não troca de modelo e chega ao chamador', async () => {
    const api = apiFalsa({ a: [erroApi(400, 'pedido inválido')], b: ['ok b'] });
    await assert.rejects(enviar(cliente(['a', 'b'], api.gerar)), /pedido inválido/);
    assert.deepEqual(api.chamadas, ['a']);
  });

  it('[TC-56] se todos falharem, o último erro chega ao chamador', async () => {
    const api = apiFalsa({ a: [erroApi(503)], b: [erroApi(503, 'b sobrecarregado')] });
    await assert.rejects(enviar(cliente(['a', 'b'], api.gerar)), /b sobrecarregado/);
    assert.equal(api.chamadas.filter((m) => m === 'b').length, 5, 'o último modelo usa todas as tentativas');
  });
});
