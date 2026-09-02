import { PrismaClient } from '@prisma/client';
import { getRedisClient } from '../config/redis';

export interface MetricasPayload {
  porstatus: Record<string, number>;
  porcategoria: Record<string, number>;
  tempomedioresolucao: number;
  jobstatus: string;
}

export class Load {
  private prisma: PrismaClient;

  /**
   * Inicializa a classe de carga (as credenciais vêm do .env).
   */
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Persiste o resultado transformado no PostgreSQL e espelha no cache Redis.
   * @param metricas Dados limpos gerados pela classe Transform
   */
  async salvarSnapshot(metricas: MetricasPayload) {
    // 1. Equivalente à carga relacional (PostgreSQL estruturado)
    await this.prisma.metrics_snapshot.create({
      data: metricas,
    });

    // 2. Equivalente à carga NoSQL (chave-valor rápido no Redis com tolerância a falhas)
    try {
      const redis = getRedisClient();
      if (redis) {
        // TTL de 24 horas (86400 segundos)
        await redis.set('metrics:latest', JSON.stringify(metricas), 'EX', 86400);
      }
    } catch (error) {
      console.warn('[ETL - Load] Aviso: Falha ao sincronizar com Redis (cache ignorado):', error);
    }
  }
}