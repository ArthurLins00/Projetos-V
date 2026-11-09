import type { DadosExtraidos } from './Extract';

// Transform: função pura (sem banco) que transforma os dados extraídos no produto de dados do painel.

export interface MetricsSnapshotPayload {
  totalByStatus: {
    total: number;
    aberta: number;
    em_andamento: number;
    resolvida: number;
    encerrada: number;
  };
  byCategory: Array<{ category: string; total: number; percentage: number }>;
  averageResponseTime: { total_demandas_consideradas: number; media_horas: number | null };
}

const STATUS_DE_CONCLUSAO = ['Resolvido', 'Fechado'];

// Tempo até o primeiro evento que levou o chamado a Resolvido ou Fechado; chamados concluídos sem
// esse evento (ex.: importados) ficam fora da média
export function tempoMedioDeResolucao(concluidos: DadosExtraidos['concluidos']) {
  const horas: number[] = [];

  for (const chamado of concluidos) {
    const resolucao = chamado.timeline_event.find((evento) => {
      const dados = evento.dadosnovos as Record<string, unknown> | null;
      return STATUS_DE_CONCLUSAO.includes(String(dados?.status));
    });
    if (resolucao) {
      horas.push((resolucao.timestamp.getTime() - chamado.criadoem.getTime()) / 3_600_000);
    }
  }

  const media = horas.length === 0 ? null : horas.reduce((a, b) => a + b, 0) / horas.length;
  return {
    total_demandas_consideradas: horas.length,
    media_horas: media === null ? null : Math.round(media * 10) / 10,
  };
}

// Inclui as categorias sem chamados (com 0%), para o painel mostrar todas
export function distribuicaoPorCategoria(
  categorias: DadosExtraidos['categorias'],
  porCategoria: DadosExtraidos['porCategoria'],
) {
  const contagem = new Map(porCategoria.map((grupo) => [grupo.categoriaid, grupo._count.id]));
  const total = porCategoria.reduce((soma, grupo) => soma + grupo._count.id, 0);

  return categorias.map((categoria) => {
    const quantidade = contagem.get(categoria.id) ?? 0;
    return {
      category: categoria.nome,
      total: quantidade,
      percentage: total === 0 ? 0 : Math.round((quantidade / total) * 1000) / 10,
    };
  });
}

export class Transform {
  processarMetricas(dados: DadosExtraidos): MetricsSnapshotPayload {
    return {
      totalByStatus: dados.contagem,
      byCategory: distribuicaoPorCategoria(dados.categorias, dados.porCategoria),
      averageResponseTime: tempoMedioDeResolucao(dados.concluidos),
    };
  }
}
