import { prisma } from '../config/prisma';
import { Extract } from '../etl/Extract';
import { Transform } from '../etl/Transform';
import { Load } from '../etl/Load';

// Pipeline de dados do painel do gestor: Extract → Transform → Load, gravando um snapshot em
// metrics_snapshot. É o mesmo pipeline para o agendamento (config/cron.ts, de hora em hora), para o
// "npm run etl" (scripts/runMetricsEtl.ts) e para a API, quando o snapshot ficou desatualizado.

export interface ConsolidationResult {
  success: boolean;
  timestamp: string;
  snapshotId?: string;
  error?: string;
}

export async function runMetricsConsolidation(): Promise<ConsolidationResult> {
  const timestamp = new Date().toISOString();
  const load = new Load(prisma as any);

  try {
    const dados = await new Extract(prisma as any).extrair();
    const payload = new Transform().processarMetricas(dados);
    const snapshot = await load.salvarSnapshot(payload);

    console.log(`[Pipeline] Snapshot de métricas gerado em ${timestamp} (${payload.totalByStatus.total} chamado(s))`);
    return { success: true, timestamp, snapshotId: snapshot.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Pipeline] Falha ao gerar o snapshot de métricas em ${timestamp}:`, message);

    // A falha também vira uma linha (jobstatus = error), para auditar o job
    await load.salvarFalha(message).catch(() => undefined);
    return { success: false, timestamp, error: message };
  }
}
