import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorMiddleware';
import { invalidateMetricsCache } from '../utils/cache';
import { status_chamado } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import { UPLOADS_DIR, UPLOADS_ROUTE } from '../config/uploads';

const STATUS_DISPLAY: Record<status_chamado, string> = {
  Aberto: 'Aberto',
  Em_An_lise: 'Em Análise',
  Em_Andamento: 'Em Andamento',
  Aguardando: 'Aguardando',
  Resolvido: 'Resolvido',
  Fechado: 'Fechado',
};

function displayStatus(s: status_chamado): string {
  return STATUS_DISPLAY[s] ?? s;
}

interface UpdateDemandInput {
  id: string;
  userId: string;
  title?: string;
  description?: string;
  location?: string;
  categoryId?: number;
  latitude?: number;
  longitude?: number;
}

interface ListDemandsInput {
  userId: string;
  perfil: string;
  status?: string;
  categoria?: number;
  regiao?: string;
  busca?: string;
  page: number;
  limit: number;
}

const BLOCKED_STATUSES = ['Em_Andamento', 'Resolvido', 'Fechado'] as const;

// Confere a assinatura do arquivo em vez de confiar no que o cliente declara
function detectImageExtension(buffer: Buffer): 'jpg' | 'png' | null {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
}

interface CreateDemandInput {
  title: string;
  description: string;
  categoryId: number;
  location: string;
  latitude?: number;
  longitude?: number;
  userId: string;
}

function generateProtocolo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DEM-${date}-${rand}`;
}

async function resolveOrgan(categoryId: number): Promise<string | null> {
  const rule = await prisma.routing_rules.findFirst({
    where: { category_id: categoryId, active: true },
  });

  if (!rule) {
    console.warn(`[ROUTING] No active rule found for category_id: ${categoryId}`);
    return null;
  }

  return rule.organ_id;
}

export const demandService = {
  async list(input: ListDemandsInput) {
    const { userId, perfil, status, categoria, regiao, busca, page, limit } = input;

    const where: Record<string, unknown> = {};

    if (perfil === 'Cidadao') where['cidadaoid'] = userId;
    if (status) where['status'] = status;
    // Demandas removidas pelo cidadão (soft delete → Fechado) somem da listagem padrão dele
    else if (perfil === 'Cidadao') where['status'] = { not: 'Fechado' };
    if (categoria) where['categoriaid'] = categoria;
    if (regiao) where['endereco'] = { contains: regiao, mode: 'insensitive' };
    if (busca) {
      where['OR'] = [
        { subcategoria: { contains: busca, mode: 'insensitive' } },
        { descricao: { contains: busca, mode: 'insensitive' } },
        { endereco: { contains: busca, mode: 'insensitive' } },
        { protocolo: { contains: busca, mode: 'insensitive' } },
      ];
    }

    const include = {
      categoria: { select: { id: true, nome: true } },
      cidadao: {
        include: { usuario: { select: { id: true, nome: true, email: true } } },
      },
    };

    const [chamados, total] = await Promise.all([
      prisma.chamado.findMany({
        where,
        include,
        orderBy: { criadoem: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chamado.count({ where }),
    ]);

    return {
      data: chamados.map((c) => ({
        id: c.id,
        protocolo: c.protocolo,
        title: c.subcategoria,
        description: c.descricao,
        status: displayStatus(c.status),
        location: c.endereco,
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        category: c.categoria,
        creator: c.cidadao.usuario,
        photoUrl: c.fotourl,
        createdAt: c.criadoem,
        updatedAt: c.atualizadoem,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async findById(id: string, userId: string, perfil: string) {
    const chamado = await prisma.chamado.findUnique({
      where: { id },
      include: {
        categoria: { select: { id: true, nome: true } },
        cidadao: {
          include: { usuario: { select: { id: true, nome: true, email: true } } },
        },
        timeline_event: {
          orderBy: { timestamp: 'asc' },
          select: { tipo: true, titulo: true, descricao: true, autor: true, timestamp: true },
        },
      },
    });

    if (!chamado) throw new AppError(404, 'Demanda não encontrada.');

    if (perfil === 'Cidadao' && chamado.cidadaoid !== userId) {
      throw new AppError(403, 'Você não tem permissão para acessar esta demanda.');
    }

    return {
      id: chamado.id,
      protocolo: chamado.protocolo,
      title: chamado.subcategoria,
      description: chamado.descricao,
      status: displayStatus(chamado.status),
      location: chamado.endereco,
      latitude: Number(chamado.latitude),
      longitude: Number(chamado.longitude),
      category: chamado.categoria,
      creator: chamado.cidadao.usuario,
      photoUrl: chamado.fotourl,
      createdAt: chamado.criadoem,
      updatedAt: chamado.atualizadoem,
      logs: chamado.timeline_event,
    };
  },

  async update(input: UpdateDemandInput) {
    const { id, userId, title, description, location, categoryId, latitude, longitude } = input;

    // 1. Find demand
    const chamado = await prisma.chamado.findUnique({
      where: { id },
      include: { categoria: { select: { id: true, nome: true } } },
    });
    if (!chamado) throw new AppError(404, 'Demanda não encontrada.');

    // 2. Ownership check
    if (chamado.cidadaoid !== userId) {
      throw new AppError(403, 'Você não tem permissão para editar esta demanda.');
    }

    // 3. Status check
    if ((BLOCKED_STATUSES as readonly string[]).includes(chamado.status)) {
      throw new AppError(403, `Não é possível editar uma demanda com status '${displayStatus(chamado.status)}'.`);
    }

    // 4. If category_id provided, validate and re-resolve org/prioridade/slahoras
    let orgaoid = chamado.orgaoid;
    let prioridade = chamado.prioridade;
    let slahoras = chamado.slahoras;

    if (categoryId !== undefined) {
      const categoria = await prisma.categoria.findUnique({ where: { id: categoryId } });
      if (!categoria || !categoria.ativo) {
        throw new AppError(400, `Categoria inválida: categoria ${categoryId} não encontrada ou inativa.`);
      }

      const regra = await prisma.regra_competencia.findFirst({
        where: { categoriaid: categoryId, subcategoria: title ?? chamado.subcategoria },
      });

      if (regra) {
        orgaoid = regra.orgaoprincipalid;
        prioridade = regra.prioridade;
        slahoras = regra.slahoras;
      } else {
        const orgaoCategoria = await prisma.orgao_categoria.findFirst({
          where: { categoriaid: categoryId },
          include: { orgao: true },
        });
        if (orgaoCategoria) {
          orgaoid = orgaoCategoria.orgaoid;
          slahoras = orgaoCategoria.orgao.slahoras;
        } else {
          const orgao = await prisma.orgao.findFirst({ where: { status: 'Ativo' } });
          if (!orgao) throw new AppError(500, 'Nenhum órgão responsável encontrado no sistema.');
          orgaoid = orgao.id;
          slahoras = orgao.slahoras;
        }
      }
    }

    // 5. Update chamado + log timeline_event atomically
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.chamado.update({
        where: { id },
        data: {
          ...(title !== undefined && { subcategoria: title }),
          ...(description !== undefined && { descricao: description }),
          ...(location !== undefined && { endereco: location }),
          ...(categoryId !== undefined && { categoriaid: categoryId }),
          ...(latitude !== undefined && { latitude }),
          ...(longitude !== undefined && { longitude }),
          orgaoid,
          prioridade,
          slahoras,
          atualizadoem: new Date(),
        },
        include: { categoria: { select: { id: true, nome: true } } },
      });

      const usuario = await tx.usuario.findUnique({
        where: { id: userId },
        select: { nome: true },
      });

      await tx.timeline_event.create({
        data: {
          chamadoid: id,
          tipo: 'mensagem',
          titulo: 'Demanda atualizada',
          descricao: 'Dados da demanda foram atualizados pelo cidadão.',
          autor: usuario?.nome ?? 'Cidadão',
          dadosantigos: {
            subcategoria: chamado.subcategoria,
            descricao: chamado.descricao,
            endereco: chamado.endereco,
            categoriaid: chamado.categoriaid,
          },
          dadosnovos: {
            subcategoria: title ?? chamado.subcategoria,
            descricao: description ?? chamado.descricao,
            endereco: location ?? chamado.endereco,
            categoriaid: categoryId ?? chamado.categoriaid,
          },
        },
      });

      return result;
    });

    if (categoryId !== undefined) {
      await invalidateMetricsCache(chamado.gestorid);
    }

    return {
      id: updated.id,
      protocolo: updated.protocolo,
      title: updated.subcategoria,
      description: updated.descricao,
      category: updated.categoria,
      location: updated.endereco,
      latitude: Number(updated.latitude),
      longitude: Number(updated.longitude),
      status: displayStatus(updated.status),
      photoUrl: updated.fotourl,
      createdAt: updated.criadoem,
      updatedAt: updated.atualizadoem,
    };
  },

  async create(input: CreateDemandInput) {
    const { title, description, categoryId, location, latitude, longitude, userId } = input;

    // 1. Validate category exists and is active
    const categoria = await prisma.categoria.findUnique({ where: { id: categoryId } });
    if (!categoria || !categoria.ativo) {
      throw new AppError(400, `Categoria inválida: categoria ${categoryId} não encontrada ou inativa.`);
    }

    // 2. Verify user has a cidadao profile
    const cidadao = await prisma.cidadao.findUnique({ where: { id: userId } });
    if (!cidadao) {
      throw new AppError(403, 'Usuário não possui perfil de cidadão para registrar demandas.');
    }

    // 3. Resolve orgaoid, prioridade, slahoras via regra_competencia → orgao_categoria fallback
    let orgaoid: string | null = null;
    let prioridade: 'Baixa' | 'Media' | 'Alta' | 'Critica' = 'Media';
    let slahoras = 48;

    // Exact subcategoria match first, then any rule for this category
    const regra = await prisma.regra_competencia.findFirst({
      where: { categoriaid: categoryId, subcategoria: title },
    }) ?? await prisma.regra_competencia.findFirst({
      where: { categoriaid: categoryId },
    });

    if (regra) {
      orgaoid = regra.orgaoprincipalid;
      prioridade = regra.prioridade as typeof prioridade;
      slahoras = regra.slahoras;
    } else {
      // No routing rule — fall back to orgao_categoria
      const oc = await prisma.orgao_categoria.findFirst({
        where: { categoriaid: categoryId },
        include: { orgao: { select: { id: true, slahoras: true } } },
      });
      if (oc) {
        orgaoid = oc.orgaoid;
        slahoras = oc.orgao.slahoras;
      } else {
        console.warn(`[ROUTING] No rule or orgao_categoria found for categoryId: ${categoryId}`);
      }
    }

    const protocolo = generateProtocolo();
    const sladeadline = new Date(Date.now() + slahoras * 60 * 60 * 1000);

    // 4. Create chamado + timeline_event atomically
    const chamado = await prisma.$transaction(async (tx) => {
      const created = await tx.chamado.create({
        data: {
          protocolo,
          descricao: description,
          cidadaoid: userId,
          orgaoid,
          categoriaid: categoryId,
          subcategoria: title,
          endereco: location,
          latitude: latitude ?? 0,
          longitude: longitude ?? 0,
          prioridade,
          slahoras,
          sladeadline,
        },
        include: {
          categoria: { select: { id: true, nome: true } },
        },
      });

      const usuario = await tx.usuario.findUnique({
        where: { id: userId },
        select: { nome: true },
      });

      await tx.timeline_event.create({
        data: {
          chamadoid: created.id,
          tipo: 'criacao',
          titulo: 'Demanda registrada',
          descricao: 'Demanda urbana registrada pelo cidadão.',
          autor: usuario?.nome ?? 'Cidadão',
        },
      });

      return created;
    });

    await invalidateMetricsCache(chamado.gestorid);

    return {
      id: chamado.id,
      protocolo: chamado.protocolo,
      title: chamado.subcategoria,
      description: chamado.descricao,
      category: chamado.categoria,
      location: chamado.endereco,
      latitude: Number(chamado.latitude),
      longitude: Number(chamado.longitude),
      status: displayStatus(chamado.status),
      photoUrl: chamado.fotourl,
      createdAt: chamado.criadoem,
    };
  },

  async uploadPhoto(chamadoId: string, userId: string, base64: string) {
    const chamado = await prisma.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamado) throw new AppError(404, 'Demanda não encontrada.');

    if (chamado.cidadaoid !== userId) {
      throw new AppError(403, 'Você não tem permissão para alterar esta demanda.');
    }
    if ((BLOCKED_STATUSES as readonly string[]).includes(chamado.status)) {
      throw new AppError(403, `Não é possível alterar uma demanda com status '${displayStatus(chamado.status)}'.`);
    }

    const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const extension = detectImageExtension(buffer);
    if (!extension) throw new AppError(400, 'Formato de imagem inválido. Envie JPEG ou PNG.');

    const fileName = `${chamadoId}-${Date.now()}.${extension}`;
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_DIR, fileName), buffer);

    const photoUrl = `${UPLOADS_ROUTE}/${fileName}`;
    await prisma.chamado.update({
      where: { id: chamadoId },
      data: { fotourl: photoUrl, atualizadoem: new Date() },
    });

    // Remove a foto anterior (só arquivos locais gerenciados por esta rota)
    if (chamado.fotourl?.startsWith(`${UPLOADS_ROUTE}/`)) {
      const oldFile = path.join(UPLOADS_DIR, path.basename(chamado.fotourl));
      await fs.unlink(oldFile).catch(() => undefined);
    }

    return { photoUrl };
  },

  async updateStatus(chamadoId: string, userId: string, newStatus: any) {
    const chamado = await prisma.chamado.findUnique({
      where: { id: chamadoId },
    });

    if (!chamado) throw new AppError(404, 'Demanda não encontrada.');

    const validStatuses = [
      'Aberto',
      'Em_An_lise',
      'Em_Andamento',
      'Aguardando',
      'Resolvido',
      'Fechado',
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new AppError(400, `Status inválido.`);
    }

    const oldStatus = chamado.status;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.chamado.update({
        where: { id: chamadoId },
        data: {
          status: newStatus,
          atualizadoem: new Date(),
        },
      });

      await tx.timeline_event.create({
        data: {
          chamadoid: chamadoId,
          tipo: 'status',
          titulo: 'Status atualizado',
          descricao: `Status alterado de ${oldStatus} para ${newStatus}`,
          autor: userId,
          dadosantigos: { status: oldStatus },
          dadosnovos: { status: newStatus },
        },
      });

      return result;
    });

    await invalidateMetricsCache(chamado.gestorid);

    return {
      id: updated.id,
      status: displayStatus(updated.status),
      updatedAt: updated.atualizadoem,
    };
  },

  async deleteDemand(chamadoId: string, userId: string, perfil: string) {
    const chamado = await prisma.chamado.findUnique({
      where: { id: chamadoId },
    });

    if (!chamado) {
      throw new AppError(404, 'Demanda não encontrada.');
    }

    if (perfil === 'Cidadao') {
      if (chamado.cidadaoid !== userId) {
        throw new AppError(403, 'Você não tem permissão para remover esta demanda.');
      }
      if ((BLOCKED_STATUSES as readonly string[]).includes(chamado.status)) {
        throw new AppError(403, `Não é possível remover uma demanda com status '${displayStatus(chamado.status)}'.`);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.chamado.update({
        where: { id: chamadoId },
        data: {
          status: 'Fechado',
        },
      });

      await tx.timeline_event.create({
        data: {
          chamadoid: chamadoId,
          tipo: 'transferencia',
          titulo: 'Demanda removida',
          descricao: 'Demanda marcada como excluída (soft delete).',
          autor: userId,
          dadosantigos: { status: chamado.status },
          dadosnovos: { status: 'Fechado' },
        },
      });
    });

    await invalidateMetricsCache(chamado.gestorid);
  },
}
