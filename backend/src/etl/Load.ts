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

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async salvarSnapshot(metricas: MetricasPayload) {
    await this.prisma.metrics_snapshot.create({
      data: metricas,
    });

    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.set('metrics:latest', JSON.stringify(metricas), 'EX', 86400);
      }
    } catch (error) {
      console.warn('[ETL - Load] Aviso: Falha ao sincronizar com Redis (cache ignorado):', error);
    }
  }
}