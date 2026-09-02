import { PrismaClient, status_chamado } from '@prisma/client';

export class Extract {
  private prisma: PrismaClient;

  // Dicionário de opções válidas utilizando o enum oficial do Prisma
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

  /**
   * Inicializa a classe com valores fixos.
   * @param prisma Instância do banco de dados (injetada usando DATABASE_URL do .env)
   */
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Extrai os chamados brutos do banco, validando o parâmetro contra o dicionário.
   * @param tipo Chave do dicionário para filtrar ('ativos' ou 'encerrados')
   */
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