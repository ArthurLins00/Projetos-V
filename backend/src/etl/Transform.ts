import { status_chamado } from '@prisma/client';

export interface ChamadoBruto {
  id: string;
  status: status_chamado;
  criadoem: Date;
  atualizadoem: Date;
  categoria?: { nome: string } | null;
}

const STATUS_DISPLAY: Record<status_chamado, string> = {
  [status_chamado.Aberto]: 'Aberto',
  [status_chamado.Em_An_lise]: 'Em Análise',
  [status_chamado.Em_Andamento]: 'Em Andamento',
  [status_chamado.Aguardando]: 'Aguardando',
  [status_chamado.Resolvido]: 'Resolvido',
  [status_chamado.Fechado]: 'Fechado',
};

export class Transform {
  /**
   * Converte os chamados brutos em um payload de métricas pronto para carga.
   * @param chamados Array de chamados brutos extraídos do banco
   */
  processarMetricas(chamados: ChamadoBruto[]) {
    const porStatus: Record<string, number> = {};
    const porCategoria: Record<string, number> = {};
    let tempoTotalHoras = 0;
    let totalResolvidos = 0;

    chamados.forEach((chamado) => {
      // 1. Contagem agrupada por status (nome legível)
      const statusLegivel = STATUS_DISPLAY[chamado.status] ?? chamado.status;
      porStatus[statusLegivel] = (porStatus[statusLegivel] || 0) + 1;

      // 2. Contagem agrupada por categoria
      if (chamado.categoria?.nome) {
        const catNome = chamado.categoria.nome;
        porCategoria[catNome] = (porCategoria[catNome] || 0) + 1;
      }

      // 3. Tempo de resolução apenas para chamados concluídos/encerrados
      if (chamado.status === status_chamado.Resolvido || chamado.status === status_chamado.Fechado) {
        const horas = (chamado.atualizadoem.getTime() - chamado.criadoem.getTime()) / 3600000;
        tempoTotalHoras += Math.max(0, horas);
        totalResolvidos++;
      }
    });

    // Média dividida pelo número de chamados efetivamente resolvidos
    const media = totalResolvidos > 0 ? tempoTotalHoras / totalResolvidos : 0;

    return {
      porstatus: porStatus,
      porcategoria: porCategoria,
      tempomedioresolucao: Number(media.toFixed(2)),
      jobstatus: 'success',
    };
  }
}