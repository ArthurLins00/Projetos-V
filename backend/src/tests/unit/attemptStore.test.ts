jest.mock('../../config/redis', () => ({ getRedisClient: jest.fn(), isRedisAvailable: jest.fn() }));

import { getRedisClient } from '../../config/redis';
import { attemptStore } from '../../utils/attemptStore';
import { trustProxySetting } from '../../config/security';

const mockedGetRedisClient = getRedisClient as jest.Mock;

function fakeRedis(overrides: Record<string, unknown> = {}) {
  const chain = {
    incr: jest.fn().mockReturnThis(),
    pexpire: jest.fn().mockReturnThis(),
    pttl: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 3], [null, 1], [null, 60_000]]),
  };
  return {
    status: 'ready',
    chain,
    multi: jest.fn(() => chain),
    get: jest.fn().mockResolvedValue('2'),
    pttl: jest.fn().mockResolvedValue(30_000),
    del: jest.fn().mockResolvedValue(1),
    ...overrides,
  };
}

// TC-77: contadores do rate limit e do bloqueio de login, no Redis ou na memória
describe('attemptStore (unitário)', () => {
  beforeEach(() => {
    mockedGetRedisClient.mockReset();
  });

  it('[TC-77] com o Redis pronto conta no Redis, sem estender a janela já aberta', async () => {
    const redis = fakeRedis();
    mockedGetRedisClient.mockReturnValue(redis);

    const resultado = await attemptStore.hit('login-fail:a@b.com', 900_000);

    expect(resultado.count).toBe(3);
    expect(resultado.resetAt).toBeGreaterThan(Date.now());
    expect(redis.chain.incr).toHaveBeenCalledWith('fiscalize:attempts:login-fail:a@b.com');
    expect(redis.chain.pexpire).toHaveBeenCalledWith('fiscalize:attempts:login-fail:a@b.com', 900_000, 'NX');
  });

  it('[TC-77] lê e apaga contadores no Redis', async () => {
    const redis = fakeRedis();
    mockedGetRedisClient.mockReturnValue(redis);

    expect(await attemptStore.peek('login-lock:a@b.com')).toEqual({ count: 2, resetAt: expect.any(Number) });

    redis.get.mockResolvedValueOnce(null);
    expect(await attemptStore.peek('login-lock:a@b.com')).toBeNull();

    await attemptStore.clear('login-lock:a@b.com');
    expect(redis.del).toHaveBeenCalledWith('fiscalize:attempts:login-lock:a@b.com');
  });

  it('[TC-77] se o Redis falhar ou não estiver pronto, usa a memória e a API segue respondendo', async () => {
    const quebrado = fakeRedis({
      multi: jest.fn(() => { throw new Error('conexão perdida'); }),
      get: jest.fn().mockRejectedValue(new Error('conexão perdida')),
      del: jest.fn().mockRejectedValue(new Error('conexão perdida')),
    });
    mockedGetRedisClient.mockReturnValue(quebrado);

    expect((await attemptStore.hit('chave', 1000)).count).toBe(1);
    expect((await attemptStore.hit('chave', 1000)).count).toBe(2);
    expect((await attemptStore.peek('chave'))?.count).toBe(2);
    await expect(attemptStore.clear('chave')).resolves.toBeUndefined();
    expect(await attemptStore.peek('chave')).toBeNull();

    mockedGetRedisClient.mockReturnValue(fakeRedis({ status: 'connecting' }));
    expect((await attemptStore.hit('outra', 1000)).count).toBe(1);
  });

  it('[TC-77] na memória a janela expira e a contagem recomeça', async () => {
    mockedGetRedisClient.mockReturnValue(null);
    const inicio = Date.now();
    const relogio = jest.spyOn(Date, 'now').mockReturnValue(inicio);

    await attemptStore.hit('janela', 1000);
    expect((await attemptStore.hit('janela', 1000)).count).toBe(2);

    relogio.mockReturnValue(inicio + 1001);
    expect(await attemptStore.peek('janela')).toBeNull();
    expect((await attemptStore.hit('janela', 1000)).count).toBe(1);
    relogio.mockRestore();
  });

  it('[TC-77] TRUST_PROXY aceita vazio, número de proxies, true ou uma lista de endereços', () => {
    expect(trustProxySetting(undefined)).toBeUndefined();
    expect(trustProxySetting('')).toBeUndefined();
    expect(trustProxySetting('false')).toBeUndefined();
    expect(trustProxySetting('1')).toBe(1);
    expect(trustProxySetting('true')).toBe(true);
    expect(trustProxySetting('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});
