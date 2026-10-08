import { PrismaClient, status_chamado } from '@prisma/client';

export class Extract {
  private prisma: PrismaClient;

  private readonly STATUS_VALIDOS: Record<'ativos' | 'encerrados', status_chamado[]> = {
    ativos: [
      status_chamado.Aberto,
      status_chamado.Em_An_lise,
      status_chamado.Em_Andamento,
      status_chamado.Aguardando,
    ],
    encerrados: [
      status_chamado.Resolvido,
      status_chamado.Fechado,
    ],
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getChamadosBrutos(tipo: keyof typeof this.STATUS_VALIDOS) {
    if (!this.STATUS_VALIDOS[tipo]) {
      throw new Error(`Tipo inválido. Opções: ${Object.keys(this.STATUS_VALIDOS).join(', ')}`);
    }

    return await this.prisma.chamado.findMany({
      where: { status: { in: this.STATUS_VALIDOS[tipo] } },
      select: {
        id: true,
        status: true,
        criadoem: true,
        atualizadoem: true,
        categoria: {
          select: { nome: true },
        },
      },
    });
  }
}