import { PrismaClient } from '@prisma/client';
import { setCache } from '../utils/cache';
import type { MetricsSnapshotPayload } from './Transform';

// Load: grava o produto de dados em metrics_snapshot (histórico, uma linha por execução) e uma cópia
// do mais recente no Redis. A API do painel do gestor lê esse snapshot (services/metricsService.ts).

export const LATEST_SNAPSHOT_KEY = 'metrics:latest';

export class Load {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async salvarSnapshot(payload: MetricsSnapshotPayload) {
    const snapshot = await this.prisma.metrics_snapshot.create({
      data: {
        porstatus: payload.totalByStatus,
        porcategoria: payload.byCategory,
        tempomedioresolucao: payload.averageResponseTime.media_horas ?? 0,
        demandasconsideradas: payload.averageResponseTime.total_demandas_consideradas,
        jobstatus: 'success',
      },
    });

    // Sem Redis o setCache não faz nada: o snapshot continua no PostgreSQL
    await setCache(LATEST_SNAPSHOT_KEY, { ...payload, geradoEm: snapshot.criadoem }, 24 * 60 * 60);
    return snapshot;
  }

  async salvarFalha(mensagem: string) {
    await this.prisma.metrics_snapshot.create({
      data: { porstatus: {}, porcategoria: [], tempomedioresolucao: 0, jobstatus: 'error', errormessage: mensagem },
    });
  }
}
