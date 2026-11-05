jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../config/redis', () => ({ getRedisClient: jest.fn(), isRedisAvailable: jest.fn() }));

import { prisma } from '../../config/__mocks__/prisma';
import { getRedisClient } from '../../config/redis';
import { metricsService } from '../../services/metricsService';
import {
  deleteCache,
  getCache,
  invalidateMetricsCache,
  metricsCacheKeys,
  metricsScopeKey,
  setCache,
  snapshotRedisKey,
} from '../../utils/cache';

const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
const mockedGetRedisClient = getRedisClient as jest.Mock;

const horas = (h: number) => new Date(Date.UTC(2026, 0, 1, h));

// TC-67: indicadores operacionais (camada de Dados) e cache Redis das métricas
describe('metricsService (unitário)', () => {
  beforeEach(() => {
    mockedGetRedisClient.mockReturnValue(null);
  });

  it('tempo médio considera só chamados com evento de resolução e arredonda para 1 casa', async () => {
    prisma.chamado.findMany.mockResolvedValue([
      { criadoem: horas(0), timeline_event: [{ timestamp: horas(1), dadosnovos: { status: 'Em_Andamento' } }, { timestamp: horas(10), dadosnovos: { status: 'Resolvido' } }] },
      { criadoem: horas(0), timeline_event: [{ timestamp: horas(5), dadosnovos: { status: 'Fechado' } }] },
      { criadoem: horas(0), timeline_event: [{ timestamp: horas(2), dadosnovos: null }] },
    ] as any);

    const result = await metricsService.averageResponseTime({});

    expect(result).toEqual({ total_demandas_consideradas: 2, media_horas: 7.5 });
    expect(prisma.chamado.findMany.mock.calls[0]![0]!.where).toMatchObject({ status: { in: ['Resolvido', 'Fechado'] } });
  });

  it('tempo médio é nulo quando nenhum chamado foi concluído', async () => {
    prisma.chamado.findMany.mockResolvedValue([]);

    expect(await metricsService.computeAverageResponseTime({ orgaoid: 'EMLURB' })).toEqual({ total_demandas_consideradas: 0, media_horas: null });
    expect(prisma.chamado.findMany.mock.calls[0]![0]!.where).toMatchObject({ orgaoid: 'EMLURB' });
  });

  it('distribuição por categoria inclui categorias sem chamados e calcula o percentual', async () => {
    prisma.categoria.findMany.mockResolvedValue([{ id: 1, nome: 'Infraestrutura' }, { id: 2, nome: 'Saneamento' }, { id: 3, nome: 'Iluminação' }] as any);
    (prisma.chamado.groupBy as jest.Mock).mockResolvedValue([
      { categoriaid: 1, _count: { id: 2 } },
      { categoriaid: 3, _count: { id: 1 } },
    ]);

    const result = await metricsService.demandsByCategory({});

    expect(result).toEqual([
      { category: 'Infraestrutura', total: 2, percentage: 66.7 },
      { category: 'Saneamento', total: 0, percentage: 0 },
      { category: 'Iluminação', total: 1, percentage: 33.3 },
    ]);
  });

  it('distribuição sem nenhum chamado fica em 0%, sem divisão por zero', async () => {
    prisma.categoria.findMany.mockResolvedValue([{ id: 1, nome: 'Infraestrutura' }] as any);
    (prisma.chamado.groupBy as jest.Mock).mockResolvedValue([]);

    expect(await metricsService.computeDemandsByCategory({ orgaoid: 'X' })).toEqual([{ category: 'Infraestrutura', total: 0, percentage: 0 }]);
  });

  it('total de demandas conta por status', async () => {
    prisma.chamado.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4).mockResolvedValueOnce(3).mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    expect(await metricsService.totalDemands({})).toEqual({ total: 10, aberta: 4, em_andamento: 3, resolvida: 2, encerrada: 1 });
    expect(await metricsService.computeTotalDemands({ orgaoid: 'X' })).toBeDefined();
  });

  it('com Redis, devolve o valor em cache sem consultar o banco', async () => {
    mockedGetRedisClient.mockReturnValue(redis);
    redis.get.mockResolvedValue(JSON.stringify({ total: 99 }));

    expect(await metricsService.totalDemands({})).toEqual({ total: 99 });
    expect(await metricsService.demandsByCategory({})).toEqual({ total: 99 });
    expect(await metricsService.averageResponseTime({})).toEqual({ total: 99 });
    expect(prisma.chamado.count).not.toHaveBeenCalled();
    expect(redis.get).toHaveBeenCalledWith('metrics:total:platform');
  });

  it('com Redis vazio, calcula e grava no cache com TTL de 5 minutos', async () => {
    mockedGetRedisClient.mockReturnValue(redis);
    redis.get.mockResolvedValue(null);
    prisma.chamado.count.mockResolvedValue(0);

    await metricsService.totalDemands({ orgaoid: 'EMLURB' });

    expect(redis.set).toHaveBeenCalledWith('metrics:total:orgao:EMLURB', expect.any(String), 'EX', 300);
  });
});

describe('utils/cache (unitário)', () => {
  it('sem Redis configurado, todas as operações viram no-op', async () => {
    mockedGetRedisClient.mockReturnValue(null);

    expect(await getCache('k')).toBeNull();
    await expect(setCache('k', 1, 10)).resolves.toBeUndefined();
    await expect(deleteCache('k')).resolves.toBeUndefined();
  });

  it('falha do Redis nunca derruba a requisição', async () => {
    mockedGetRedisClient.mockReturnValue(redis);
    redis.get.mockRejectedValue(new Error('down'));
    redis.set.mockRejectedValue(new Error('down'));
    redis.del.mockRejectedValue(new Error('down'));

    expect(await getCache('k')).toBeNull();
    await expect(setCache('k', 1, 10)).resolves.toBeUndefined();
    await expect(deleteCache('k')).resolves.toBeUndefined();
  });

  it('valor ausente ou JSON inválido no cache retorna null', async () => {
    mockedGetRedisClient.mockReturnValue(redis);
    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce('{quebrado');

    expect(await getCache('k')).toBeNull();
    expect(await getCache('k')).toBeNull();
  });

  it('invalidação apaga as chaves da plataforma e, com gestor, também as dele', async () => {
    mockedGetRedisClient.mockReturnValue(redis);
    redis.del.mockResolvedValue(1);

    await invalidateMetricsCache('g1');

    expect(redis.del).toHaveBeenCalledTimes(6);
    expect(redis.del).toHaveBeenCalledWith('metrics:avg-response:gestor:g1');
    expect(metricsCacheKeys()).toHaveLength(3);
  });

  it('monta as chaves de escopo e de snapshot', () => {
    expect(metricsScopeKey({})).toBe('platform');
    expect(snapshotRedisKey('2026-11-05', { orgaoid: 'EMLURB' })).toBe('metrics:snapshot:2026-11-05:orgao:EMLURB');
  });
});
