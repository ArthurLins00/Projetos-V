import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorMiddleware';
import type { MetricsSnapshotPayload } from '../etl/Transform';
import { runMetricsConsolidation } from './metricsConsolidationService';

// O painel do gestor não calcula nada: lê o produto de dados gerado pelo pipeline (metrics_snapshot).
// O snapshot mais recente é reaproveitado enquanto nenhum chamado mudou depois dele e enquanto ele tem
// menos de METRICS_SNAPSHOT_MAX_AGE_MINUTES (padrão 60, o intervalo do agendamento). Se algo mudou, se
// passou da idade ou se ainda não existe snapshot, a API roda o pipeline e devolve o snapshot novo.

export type PanelSnapshot = MetricsSnapshotPayload & { geradoEm: Date };

function maxAgeMs() {
  const minutes = Number(process.env.METRICS_SNAPSHOT_MAX_AGE_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60_000;
}

async function latestSnapshot(): Promise<PanelSnapshot | null> {
  const row = await prisma.metrics_snapshot.findFirst({
    where: { jobstatus: 'success' },
    orderBy: { criadoem: 'desc' },
  });
  const porStatus = row?.porstatus as MetricsSnapshotPayload['totalByStatus'] | null;
  // Snapshots gravados no formato antigo do ETL (sem os totais do painel) não servem
  if (!row || typeof porStatus?.total !== 'number' || !Array.isArray(row.porcategoria)) return null;

  return {
    totalByStatus: porStatus,
    byCategory: row.porcategoria as MetricsSnapshotPayload['byCategory'],
    averageResponseTime: {
      total_demandas_consideradas: row.demandasconsideradas,
      media_horas: row.demandasconsideradas === 0 ? null : Number(row.tempomedioresolucao),
    },
    geradoEm: row.criadoem,
  };
}

async function isFresh(snapshot: PanelSnapshot) {
  if (Date.now() - snapshot.geradoEm.getTime() > maxAgeMs()) return false;

  const atual = await prisma.chamado.aggregate({ _count: { id: true }, _max: { atualizadoem: true } });
  const ultimaMudanca = atual._max.atualizadoem;
  return atual._count.id === snapshot.totalByStatus.total && (!ultimaMudanca || ultimaMudanca <= snapshot.geradoEm);
}

// O app pede os três indicadores ao mesmo tempo: uma única execução do pipeline atende os três
let regenerating: ReturnType<typeof runMetricsConsolidation> | null = null;

function regenerate() {
  regenerating ??= runMetricsConsolidation().finally(() => {
    regenerating = null;
  });
  return regenerating;
}

async function panelSnapshot(): Promise<PanelSnapshot> {
  const atual = await latestSnapshot();
  if (atual && (await isFresh(atual))) return atual;

  const resultado = await regenerate();
  const novo = resultado.success ? await latestSnapshot() : null;
  if (novo) return novo;
  // Pipeline falhou: mostra o último snapshot válido, mesmo antigo, em vez de deixar o painel vazio
  if (atual) return atual;
  throw new AppError(503, 'Indicadores indisponíveis no momento. Tente novamente em instantes.');
}

export const metricsService = {
  panelSnapshot,

  async averageResponseTime() {
    const snapshot = await panelSnapshot();
    return { ...snapshot.averageResponseTime, geradoEm: snapshot.geradoEm };
  },

  async demandsByCategory() {
    const snapshot = await panelSnapshot();
    return { data: snapshot.byCategory, geradoEm: snapshot.geradoEm };
  },

  async totalDemands() {
    const snapshot = await panelSnapshot();
    return { ...snapshot.totalByStatus, geradoEm: snapshot.geradoEm };
  },
};
