// TC-67: conexão com o Redis é opcional; sem ele o cache é desligado e o backend segue funcionando
const handlers: Record<string, (arg?: any) => void> = {};
const instance = {
  on: jest.fn((event: string, cb: (arg?: any) => void) => {
    handlers[event] = cb;
  }),
  connect: jest.fn(),
  ping: jest.fn(),
};
const RedisMock = jest.fn((_url: string, _options: any) => instance);
jest.mock('ioredis', () => ({ __esModule: true, default: RedisMock }));

function loadRedis() {
  let mod!: typeof import('../../config/redis');
  jest.isolateModules(() => {
    mod = require('../../config/redis');
  });
  return mod;
}

describe('config/redis (unitário)', () => {
  const originalUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    instance.connect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.REDIS_URL = originalUrl;
    jest.restoreAllMocks();
  });

  it('[TC-67] sem REDIS_URL o cliente é nulo e o Redis aparece como indisponível', async () => {
    delete process.env.REDIS_URL;
    const { getRedisClient, isRedisAvailable } = loadRedis();

    expect(getRedisClient()).toBeNull();
    expect(await isRedisAvailable()).toBe(false);
    expect(RedisMock).not.toHaveBeenCalled();
  });

  it('[TC-67] com REDIS_URL cria um único cliente, sem fila offline e com poucas tentativas', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const { getRedisClient } = loadRedis();

    const first = getRedisClient();
    const second = getRedisClient();

    expect(first).toBe(instance);
    expect(second).toBe(first);
    expect(RedisMock).toHaveBeenCalledTimes(1);
    const options = RedisMock.mock.calls[0]![1];
    expect(options).toMatchObject({ enableOfflineQueue: false, lazyConnect: true, maxRetriesPerRequest: 1 });
    expect(options.retryStrategy(1)).toBe(200);
    expect(options.retryStrategy(10)).toBeNull();
    handlers.connect!();
    handlers.error!(new Error('falhou'));
    expect(console.warn).toHaveBeenCalledWith('[Redis] Connection error:', 'falhou');
  });

  it('[TC-67] falha na conexão inicial só gera aviso', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    instance.connect.mockRejectedValue(new Error('recusada'));
    const { getRedisClient } = loadRedis();

    getRedisClient();
    await new Promise((resolve) => setImmediate(resolve));

    expect(console.warn).toHaveBeenCalledWith('[Redis] Initial connection failed:', 'recusada');
  });

  it('[TC-67] isRedisAvailable responde ao PING e trata erro como indisponível', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const { isRedisAvailable } = loadRedis();

    instance.ping.mockResolvedValueOnce('PONG').mockRejectedValueOnce(new Error('timeout'));

    expect(await isRedisAvailable()).toBe(true);
    expect(await isRedisAvailable()).toBe(false);
  });
});
