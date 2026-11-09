import { getRedisClient } from '../config/redis';

// Contadores com janela fixa, usados pelo rate limit e pelo bloqueio de login.
// Com o Redis conectado, os contadores ficam nele (valem para todas as instâncias da API e sobrevivem a
// reinícios); sem Redis, ou se ele falhar, ficam na memória do processo, como os códigos de 2FA.

export type Attempts = { count: number; resetAt: number };

const PREFIX = 'fiscalize:attempts:';
const MEMORY_SWEEP_SIZE = 10_000;
const memory = new Map<string, Attempts>();

function readyRedis() {
  const redis = getRedisClient();
  return redis && redis.status === 'ready' ? redis : null;
}

function sweepMemory(now: number) {
  if (memory.size < MEMORY_SWEEP_SIZE) return;
  for (const [key, entry] of memory) {
    if (entry.resetAt <= now) memory.delete(key);
  }
}

function hitMemory(key: string, windowMs: number): Attempts {
  const now = Date.now();
  sweepMemory(now);
  const current = memory.get(key);
  const entry = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  entry.count += 1;
  memory.set(key, entry);
  return { ...entry };
}

export const attemptStore = {
  // Soma uma tentativa; a janela começa na primeira e não é estendida pelas seguintes
  async hit(key: string, windowMs: number): Promise<Attempts> {
    const redis = readyRedis();
    if (redis) {
      try {
        const redisKey = PREFIX + key;
        const results = await redis.multi().incr(redisKey).pexpire(redisKey, windowMs, 'NX').pttl(redisKey).exec();
        const count = Number(results?.[0]?.[1]);
        const ttl = Number(results?.[2]?.[1]);
        if (Number.isFinite(count) && count > 0) {
          return { count, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
        }
      } catch {
        // cai para a memória
      }
    }
    return hitMemory(key, windowMs);
  },

  async peek(key: string): Promise<Attempts | null> {
    const redis = readyRedis();
    if (redis) {
      try {
        const redisKey = PREFIX + key;
        const [value, ttl] = await Promise.all([redis.get(redisKey), redis.pttl(redisKey)]);
        if (value === null || ttl <= 0) return null;
        return { count: Number(value), resetAt: Date.now() + ttl };
      } catch {
        // cai para a memória
      }
    }
    const entry = memory.get(key);
    if (!entry || entry.resetAt <= Date.now()) return null;
    return { ...entry };
  },

  async clear(key: string): Promise<void> {
    memory.delete(key);
    const redis = readyRedis();
    if (!redis) return;
    try {
      await redis.del(PREFIX + key);
    } catch {
      // nada a fazer
    }
  },

  // Só para os testes: zera os contadores mantidos em memória
  resetMemory() {
    memory.clear();
  },
};
