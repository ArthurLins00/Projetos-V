jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../config/redis', () => ({ getRedisClient: jest.fn(), isRedisAvailable: jest.fn() }));

import { prisma } from '../../config/__mocks__/prisma';
import { getRedisClient } from '../../config/redis';
import { Transform, distribuicaoPorCategoria, tempoMedioDeResolucao } from '../../etl/Transform';
import { runMetricsConsolidation } from '../../services/metricsConsolidationService';
import { metricsService } from '../../services/metricsService';
import { deleteCache, getCache, setCache } from '../../utils/cache';

const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
const mockedGetRedisClient = getRedisClient as jest.Mock;

const horas = (h: number) => new Date(Date.UTC(2026, 0, 1, h));

function snapshotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snap-1',
    porstatus: { total: 3, aberta: 1, em_andamento: 0, resolvida: 2, encerrada: 0 },
    porcategoria: [{ category: 'Infraestrutura', total: 3, percentage: 100 }],
    tempomedioresolucao: 7.5,
    demandasconsideradas: 2,
    jobstatus: 'success',
    errormessage: null,
    criadoem: new Date(Date.now() - 60_000),
    ...overrides,
  };
}

function mockExtract() {
  prisma.categoria.findMany.mockResolvedValue([{ id: 1, nome: 'Infraestrutura' }] as any);
  (prisma.chamado.groupBy as jest.Mock).mockResolvedValue([{ categoriaid: 1, _count: { id: 3 } }]);
  prisma.chamado.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(2).mockResolvedValueOnce(0);
  prisma.chamado.findMany.mockResolvedValue([
    { criadoem: horas(0), timeline_event: [{ timestamp: horas(10), dadosnovos: { status: 'Resolvido' } }] },
  ] as any);
}

// TC-67: produto de dados do painel do gestor (pipeline ETL → metrics_snapshot → API) e acesso ao Redis
describe('Transform do pipeline de métricas (unitário)', () => {
  it('[TC-67] tempo médio considera só chamados com evento de resolução e arredonda para 1 casa', () => {
    const resultado = tempoMedioDeResolucao([
      { criadoem: horas(0), timeline_event: [{ timestamp: horas(1), dadosnovos: { status: 'Em_Andamento' } }, { timestamp: horas(10), dadosnovos: { status: 'Resolvido' } }] },
      { criadoem: horas(0), timeline_event: [{ timestamp: horas(5), dadosnovos: { status: 'Fechado' } }] },
      { criadoem: horas(0), timeline_event: [{ timestamp: horas(2), dadosnovos: null }] },
    ] as any);

    expect(resultado).toEqual({ total_demandas_consideradas: 2, media_horas: 7.5 });
  });

  it('[TC-67] tempo médio é nulo quando nenhum chamado foi concluído', () => {
    expect(tempoMedioDeResolucao([])).toEqual({ total_demandas_consideradas: 0, media_horas: null });
  });

  it('[TC-67] distribuição por categoria inclui categorias sem chamados e calcula o percentual', () => {
    const resultado = distribuicaoPorCategoria(
      [{ id: 1, nome: 'Infraestrutura' }, { id: 2, nome: 'Saneamento' }, { id: 3, nome: 'Iluminação' }],
      [{ categoriaid: 1, _count: { id: 2 } }, { categoriaid: 3, _count: { id: 1 } }] as any,
    );

    expect(resultado).toEqual([
      { category: 'Infraestrutura', total: 2, percentage: 66.7 },
      { category: 'Saneamento', total: 0, percentage: 0 },
      { category: 'Iluminação', total: 1, percentage: 33.3 },
    ]);
  });

  it('[TC-67] distribuição sem nenhum chamado fica em 0%, sem divisão por zero', () => {
    expect(distribuicaoPorCategoria([{ id: 1, nome: 'Infraestrutura' }], [])).toEqual([
      { category: 'Infraestrutura', total: 0, percentage: 0 },
    ]);
  });

  it('[TC-67] junta totais por status, categorias e tempo médio no produto do painel', () => {
    const payload = new Transform().processarMetricas({
      contagem: { total: 10, aberta: 4, em_andamento: 3, resolvida: 2, encerrada: 1 },
      categorias: [{ id: 1, nome: 'Infraestrutura' }],
      porCategoria: [{ categoriaid: 1, _count: { id: 10 } }],
      concluidos: [],
    } as any);

    expect(payload).toEqual({
      totalByStatus: { total: 10, aberta: 4, em_andamento: 3, resolvida: 2, encerrada: 1 },
      byCategory: [{ category: 'Infraestrutura', total: 10, percentage: 100 }],
      averageResponseTime: { total_demandas_consideradas: 0, media_horas: null },
    });
  });
});

describe('Pipeline de métricas: Extract → Transform → Load (unitário)', () => {
  beforeEach(() => {
    mockedGetRedisClient.mockReturnValue(null);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('[TC-67] grava o snapshot com os indicadores e a quantidade de chamados considerados', async () => {
    mockExtract();
    prisma.metrics_snapshot.create.mockResolvedValue(snapshotRow() as any);

    const resultado = await runMetricsConsolidation();

    expect(resultado).toMatchObject({ success: true, snapshotId: 'snap-1' });
    expect(prisma.metrics_snapshot.create).toHaveBeenCalledWith({
      data: {
        porstatus: { total: 3, aberta: 1, em_andamento: 0, resolvida: 2, encerrada: 0 },
        porcategoria: [{ category: 'Infraestrutura', total: 3, percentage: 100 }],
        tempomedioresolucao: 10,
        demandasconsideradas: 1,
        jobstatus: 'success',
      },
    });
    // Minimização: a extração não pede nenhum campo pessoal
    expect(JSON.stringify(prisma.chamado.findMany.mock.calls)).not.toMatch(/usuario|email|endereco|latitude|foto/);
  });

  it('[TC-67] falha do pipeline vira uma linha com jobstatus error, sem lançar erro', async () => {
    prisma.categoria.findMany.mockRejectedValue(new Error('banco fora do ar'));

    const resultado = await runMetricsConsolidation();

    expect(resultado).toMatchObject({ success: false, error: 'banco fora do ar' });
    expect(prisma.metrics_snapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ jobstatus: 'error', errormessage: 'banco fora do ar' }),
    });
  });
});

describe('metricsService: leitura do snapshot pelo painel (unitário)', () => {
  beforeEach(() => {
    mockedGetRedisClient.mockReturnValue(null);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('[TC-67] reaproveita o snapshot recente quando nenhum chamado mudou depois dele', async () => {
    const row = snapshotRow();
    prisma.metrics_snapshot.findFirst.mockResolvedValue(row as any);
    prisma.chamado.aggregate.mockResolvedValue({ _count: { id: 3 }, _max: { atualizadoem: new Date(row.criadoem.getTime() - 1000) } } as any);

    const total = await metricsService.totalDemands();
    const tempo = await metricsService.averageResponseTime();

    expect(total).toEqual({ total: 3, aberta: 1, em_andamento: 0, resolvida: 2, encerrada: 0, geradoEm: row.criadoem });
    expect(tempo).toEqual({ total_demandas_consideradas: 2, media_horas: 7.5, geradoEm: row.criadoem });
    expect(prisma.metrics_snapshot.create).not.toHaveBeenCalled();
  });

  it.each([
    ['um chamado mudou depois do snapshot', { _count: { id: 3 }, _max: { atualizadoem: new Date() } }],
    ['um chamado foi criado ou apagado', { _count: { id: 4 }, _max: { atualizadoem: null } }],
  ])('[TC-67] roda o pipeline de novo quando %s', async (_caso, agregado) => {
    const antigo = snapshotRow({ criadoem: new Date(Date.now() - 120_000) });
    const novo = snapshotRow({ id: 'snap-2', criadoem: new Date() });
    prisma.metrics_snapshot.findFirst.mockResolvedValueOnce(antigo as any).mockResolvedValueOnce(novo as any);
    prisma.chamado.aggregate.mockResolvedValue(agregado as any);
    mockExtract();
    prisma.metrics_snapshot.create.mockResolvedValue(novo as any);

    const resultado = await metricsService.demandsByCategory();

    expect(prisma.metrics_snapshot.create).toHaveBeenCalledTimes(1);
    expect(resultado.geradoEm).toBe(novo.criadoem);
  });

  it('[TC-67] snapshot vencido (mais velho que METRICS_SNAPSHOT_MAX_AGE_MINUTES) ou no formato antigo é regenerado', async () => {
    process.env.METRICS_SNAPSHOT_MAX_AGE_MINUTES = '1';
    const vencido = snapshotRow({ criadoem: new Date(Date.now() - 5 * 60_000) });
    const formatoAntigo = snapshotRow({ porstatus: { Aberto: 2 }, porcategoria: { Infraestrutura: 2 } });
    const novo = snapshotRow({ id: 'snap-3', criadoem: new Date() });
    mockExtract();
    prisma.metrics_snapshot.create.mockResolvedValue(novo as any);

    prisma.metrics_snapshot.findFirst.mockResolvedValueOnce(vencido as any).mockResolvedValueOnce(novo as any);
    await metricsService.totalDemands();
    mockExtract();
    prisma.metrics_snapshot.findFirst.mockResolvedValueOnce(formatoAntigo as any).mockResolvedValueOnce(novo as any);
    await metricsService.totalDemands();

    expect(prisma.metrics_snapshot.create).toHaveBeenCalledTimes(2);
    expect(prisma.chamado.aggregate).not.toHaveBeenCalled();
    delete process.env.METRICS_SNAPSHOT_MAX_AGE_MINUTES;
  });

  it('[TC-67] três pedidos ao mesmo tempo disparam uma única execução do pipeline', async () => {
    const novo = snapshotRow({ id: 'snap-4', criadoem: new Date() });
    prisma.metrics_snapshot.findFirst
      .mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      .mockResolvedValue(novo as any);
    mockExtract();
    prisma.metrics_snapshot.create.mockResolvedValue(novo as any);

    await Promise.all([metricsService.totalDemands(), metricsService.demandsByCategory(), metricsService.averageResponseTime()]);

    expect(prisma.metrics_snapshot.create).toHaveBeenCalledTimes(1);
  });

  it('[TC-67] se o pipeline falhar, mostra o último snapshot válido; sem nenhum, responde 503', async () => {
    const antigo = snapshotRow({ criadoem: new Date(Date.now() - 120_000) });
    prisma.metrics_snapshot.findFirst.mockResolvedValueOnce(antigo as any);
    prisma.chamado.aggregate.mockResolvedValue({ _count: { id: 9 }, _max: { atualizadoem: null } } as any);
    prisma.categoria.findMany.mockRejectedValue(new Error('banco instável'));

    expect((await metricsService.totalDemands()).geradoEm).toBe(antigo.criadoem);

    prisma.metrics_snapshot.findFirst.mockResolvedValue(null);
    await expect(metricsService.totalDemands()).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe('utils/cache (unitário)', () => {
  it('[TC-67] sem Redis configurado, todas as operações viram no-op', async () => {
    mockedGetRedisClient.mockReturnValue(null);

    expect(await getCache('k')).toBeNull();
    await expect(setCache('k', 1, 10)).resolves.toBeUndefined();
    await expect(deleteCache('k')).resolves.toBeUndefined();
  });

  it('[TC-67] falha do Redis nunca derruba a requisição', async () => {
    mockedGetRedisClient.mockReturnValue(redis);
    redis.get.mockRejectedValue(new Error('down'));
    redis.set.mockRejectedValue(new Error('down'));
    redis.del.mockRejectedValue(new Error('down'));

    expect(await getCache('k')).toBeNull();
    await expect(setCache('k', 1, 10)).resolves.toBeUndefined();
    await expect(deleteCache('k')).resolves.toBeUndefined();
  });

  it('[TC-67] valor ausente ou JSON inválido no cache retorna null', async () => {
    mockedGetRedisClient.mockReturnValue(redis);
    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce('{quebrado');

    expect(await getCache('k')).toBeNull();
    expect(await getCache('k')).toBeNull();
  });

  it('[TC-67] o pipeline guarda a cópia do snapshot mais recente no Redis por 24 h', async () => {
    mockedGetRedisClient.mockReturnValue(redis);
    redis.set.mockResolvedValue('OK');
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockExtract();
    prisma.metrics_snapshot.create.mockResolvedValue(snapshotRow() as any);

    await runMetricsConsolidation();

    expect(redis.set).toHaveBeenCalledWith('metrics:latest', expect.stringContaining('"totalByStatus"'), 'EX', 86400);
  });
});
