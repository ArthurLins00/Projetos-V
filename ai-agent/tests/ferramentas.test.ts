import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classificarERotearOcorrencia } from '../src/tools/classificarERotearOcorrencia';
import { buscarChamadosSimilares } from '../src/tools/buscarChamadosSimilares';
import { executarFerramenta } from '../src/tools';
import { PERFIL_TRIAGEM } from '../src/perfis/triagem';
import { PONTOS } from '../src/data/mockData';

const { latitude, longitude } = PONTOS.boaViagem;

describe('classificar_e_rotear_ocorrencia', () => {
  it('reconhece gatilhos de emergência mesmo sem acento (RN-03)', () => {
    const r = classificarERotearOcorrencia({ descricao: 'FIACAO EXPOSTA no poste da esquina', latitude, longitude });
    assert.equal(r.prioridade, 'Crítica');
    assert.equal(r.orgao_sigla, 'CELPE');
  });

  it('poste apagado comum tem prioridade Média', () => {
    const r = classificarERotearOcorrencia({ descricao: 'O poste da minha rua está apagado', latitude, longitude });
    assert.equal(r.subcategoria, 'Poste apagado');
    assert.equal(r.prioridade, 'Média');
  });

  it('texto não reconhecido cai em Outros Problemas → SEMC', () => {
    const r = classificarERotearOcorrencia({ descricao: 'Barulho estranho vindo do viaduto', latitude, longitude });
    assert.equal(r.categoria, 'Outros Problemas');
    assert.equal(r.orgao_sigla, 'SEMC');
    assert.ok(r.observacao);
  });

  it('rejeita coordenadas inválidas (RF-02)', () => {
    assert.throws(() => classificarERotearOcorrencia({ descricao: 'Buraco na rua', latitude: 123, longitude }), /Latitude inválida/);
  });
});

describe('buscar_chamados_similares', () => {
  it('rejeita categoria inativa', () => {
    assert.throws(() => buscarChamadosSimilares({ categoria_id: 7, latitude, longitude }), /inativa/);
  });

  it('filtra por categoria: Infraestrutura no mesmo ponto não traz chamados de Iluminação', () => {
    const r = buscarChamadosSimilares({ categoria_id: 1, latitude, longitude });
    assert.deepEqual(r.chamados.map((c) => c.protocolo), ['DEM-20261001-C4RR']);
  });
});

describe('executarFerramenta', () => {
  it('converte exceções em { error } para o modelo poder se corrigir', async () => {
    assert.deepEqual(await executarFerramenta(PERFIL_TRIAGEM, 'inexistente', {}), { error: 'Ferramenta desconhecida: inexistente' });
    const r = await executarFerramenta(PERFIL_TRIAGEM, 'buscar_chamados_similares', { categoria_id: 99, latitude, longitude });
    assert.ok('error' in r);
  });
});
