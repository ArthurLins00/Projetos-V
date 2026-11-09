import 'dotenv/config';
import { prisma, disconnectPrisma } from '../config/prisma';
import { runMetricsConsolidation } from '../services/metricsConsolidationService';

// Roda sob demanda o mesmo pipeline do agendamento (Extract → Transform → Load) e mostra o snapshot gerado
async function main() {
  console.log('=== PIPELINE DE MÉTRICAS (Fiscalize) ===');

  try {
    const resultado = await runMetricsConsolidation();
    if (!resultado.success || !resultado.snapshotId) throw new Error(resultado.error);

    const snapshot = await prisma.metrics_snapshot.findUnique({ where: { id: resultado.snapshotId } });
    console.log('=== CONCLUÍDO: snapshot gravado em metrics_snapshot ===');
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (error) {
    console.error('Erro na execução do pipeline:', error);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
    process.exit(process.exitCode || 0);
  }
}

void main();
