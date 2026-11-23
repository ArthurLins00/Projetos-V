import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classificarERotearOcorrencia } from '../src/tools/classificarERotearOcorrencia';
import { buscarChamadosSimilares } from '../src/tools/buscarChamadosSimilares';
import { executarFerramenta } from '../src/tools';
import { PERFIL_TRIAGEM } from '../src/perfis/triagem';
import { readFileSync } from 'node:fs';
import { PONTOS } from '../src/data/mockData';
import { buscarCategoriaAtiva, listarChamadosAbertosPorCategoria } from '../src/data/acesso';
import { caminhoLog } from '../src/data/logUso';

const { latitude, longitude } = PONTOS.boaViagem;

describe('classificar_e_rotear_ocorrencia', () => {
  it('[TC-56] reconhece gatilhos de emergência mesmo sem acento (RN-03)', () => {
    const r = classificarERotearOcorrencia({ descricao: 'FIACAO EXPOSTA no poste da esquina', latitude, longitude });
    assert.equal(r.prioridade, 'Crítica');
    assert.equal(r.orgao_sigla, 'CELPE');
  });

  it('[TC-56] poste apagado comum tem prioridade Média', () => {
    const r = classificarERotearOcorrencia({ descricao: 'O poste da minha rua está apagado', latitude, longitude });
    assert.equal(r.subcategoria, 'Poste apagado');
    assert.equal(r.prioridade, 'Média');
  });

  it('[TC-56] texto não reconhecido cai em Outros Problemas → SEMC', () => {
    const r = classificarERotearOcorrencia({ descricao: 'Barulho estranho vindo do viaduto', latitude, longitude });
    assert.equal(r.categoria, 'Outros Problemas');
    assert.equal(r.orgao_sigla, 'SEMC');
    assert.ok(r.observacao);
  });

  it('[TC-56] rejeita coordenadas inválidas (RF-02)', () => {
    assert.throws(() => classificarERotearOcorrencia({ descricao: 'Buraco na rua', latitude: 123, longitude }), /Latitude inválida/);
  });
});

describe('buscar_chamados_similares', () => {
  it('[TC-56] rejeita categoria inativa', () => {
    assert.throws(() => buscarChamadosSimilares({ categoria_id: 7, latitude, longitude }), /inativa/);
  });

  it('[TC-56] filtra por categoria: Infraestrutura no mesmo ponto não traz chamados de Iluminação', () => {
    const r = buscarChamadosSimilares({ categoria_id: 1, latitude, longitude });
    assert.deepEqual(r.chamados.map((c) => c.protocolo), ['DEM-20261001-C4RR']);
  });
});

describe('executarFerramenta', () => {
  it('[TC-56] converte exceções em { error } para o modelo poder se corrigir', async () => {
    assert.deepEqual(await executarFerramenta(PERFIL_TRIAGEM, 'inexistente', {}), { error: 'Ferramenta desconhecida: inexistente' });
    const r = await executarFerramenta(PERFIL_TRIAGEM, 'buscar_chamados_similares', { categoria_id: 99, latitude, longitude });
    assert.ok('error' in r);
  });
});

describe('funções de acesso aos dados e log de uso', () => {
  const origem = { ferramenta: 'teste', canal: 'node:test' };
  const ultimaLinha = () => {
    const linhas = readFileSync(caminhoLog(), 'utf8').trim().split('\n');
    return JSON.parse(linhas[linhas.length - 1]);
  };

  it('[TC-56] categoria sem chamados devolve lista vazia e registra 0 registros com sucesso', () => {
    assert.deepEqual(listarChamadosAbertosPorCategoria(6, origem), []);
    const linha = ultimaLinha();
    assert.equal(linha.funcao, 'listarChamadosAbertosPorCategoria');
    assert.equal(linha.chamador, 'teste');
    assert.equal(linha.canal, 'node:test');
    assert.deepEqual(linha.parametros, { categoria_id: 6 });
    assert.equal(linha.registros_retornados, 0);
    assert.equal(linha.sucesso, true);
    assert.ok(!Number.isNaN(Date.parse(linha.data_hora)));
  });

  it('[TC-56] identificador inexistente gera erro claro e linha de erro no log', () => {
    assert.throws(() => buscarCategoriaAtiva(99, origem), /Categoria inexistente: 99/);
    const linha = ultimaLinha();
    assert.equal(linha.sucesso, false);
    assert.match(linha.erro, /inexistente/);
    assert.equal(linha.registros_retornados, 0);
  });

  it('[TC-56] acrescenta linhas sem apagar as anteriores e nunca grava o relato nem as coordenadas', () => {
    const antes = readFileSync(caminhoLog(), 'utf8').trim().split('\n').length;
    classificarERotearOcorrencia({ descricao: 'Fiação exposta perto da escola municipal', latitude, longitude });
    const depois = readFileSync(caminhoLog(), 'utf8').trim().split('\n');
    assert.equal(depois.length, antes + 3, 'regra, categoria e órgão');
    const novas = depois.slice(antes).join('\n');
    assert.doesNotMatch(novas, /escola|fiacao|Fiação|-8\.1197|-34\.8986/i);
    assert.deepEqual(depois.slice(antes).map((l) => JSON.parse(l).funcao), ['encontrarRegraPorTexto', 'buscarCategoriaAtiva', 'buscarOrgao']);
  });
});
