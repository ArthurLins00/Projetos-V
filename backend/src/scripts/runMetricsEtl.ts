import 'dotenv/config';
import { prisma, disconnectPrisma } from '../config/prisma';
import { Extract } from '../etl/Extract';
import { Transform } from '../etl/Transform';
import { Load } from '../etl/Load';

async function main() {
  console.log('=== INICIANDO PIPELINE ETL (Fiscalize) ===');

  try {
    const extractor = new Extract(prisma);
    const transformer = new Transform();
    const loader = new Load(prisma);

    console.log('[1/3] Extraindo dados do banco...');
    const [chamadosAtivos, chamadosEncerrados] = await Promise.all([
      extractor.getChamadosBrutos('ativos'),
      extractor.getChamadosBrutos('encerrados'),
    ]);
    const todosChamados = [...chamadosAtivos, ...chamadosEncerrados];
    console.log(`      Extraídos: ${chamadosAtivos.length} ativo(s), ${chamadosEncerrados.length} encerrado(s).`);

    console.log(`[2/3] Transformando ${todosChamados.length} chamado(s)...`);
    const metricas = transformer.processarMetricas(todosChamados);

    console.log('[3/3] Carregando dados no PostgreSQL e Redis...');
    await loader.salvarSnapshot(metricas);

    console.log('=== ETL CONCLUÍDO COM SUCESSO ===');
    console.log('Resumo do Snapshot Gerado:');
    console.log(JSON.stringify(metricas, null, 2));
  } catch (error) {
    console.error('Erro na execução do pipeline ETL:', error);
    process.exitCode = 1;
  } finally {
    await disconnectPrisma();
    process.exit(process.exitCode || 0);
  }
}

void main();