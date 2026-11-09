import { PrismaClient } from '@prisma/client';

// Extract: lê do banco operacional só o necessário para os indicadores do painel do gestor.
// Minimização (LGPD): nenhum nome, e-mail, endereço, foto ou coordenada entra no pipeline;
// só status, categoria, datas e os eventos de mudança de status.

export type DadosExtraidos = Awaited<ReturnType<Extract['extrair']>>;

export class Extract {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async extrair() {
    const [categorias, porCategoria, contagem, concluidos] = await Promise.all([
      this.prisma.categoria.findMany({ select: { id: true, nome: true } }),
      this.prisma.chamado.groupBy({ by: ['categoriaid'], _count: { id: true } }),
      this.contarPorStatus(),
      this.prisma.chamado.findMany({
        where: { status: { in: ['Resolvido', 'Fechado'] } },
        select: {
          criadoem: true,
          timeline_event: {
            where: { tipo: 'status' },
            orderBy: { timestamp: 'asc' },
            select: { timestamp: true, dadosnovos: true },
          },
        },
      }),
    ]);

    return { categorias, porCategoria, contagem, concluidos };
  }

  private async contarPorStatus() {
    const [total, aberta, em_andamento, resolvida, encerrada] = await Promise.all([
      this.prisma.chamado.count(),
      this.prisma.chamado.count({ where: { status: 'Aberto' } }),
      this.prisma.chamado.count({ where: { status: 'Em_Andamento' } }),
      this.prisma.chamado.count({ where: { status: 'Resolvido' } }),
      this.prisma.chamado.count({ where: { status: 'Fechado' } }),
    ]);

    return { total, aberta, em_andamento, resolvida, encerrada };
  }
}
