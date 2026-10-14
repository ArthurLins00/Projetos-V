import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorMiddleware';
import { Prisma, status_chamado } from '@prisma/client';
import { prisma } from '../config/prisma';
import { invalidateMetricsCache } from '../utils/cache';
import { notificationService } from '../services/notificationService';

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

const STATUS_FROM_DISPLAY = Object.fromEntries(
  Object.entries(STATUS_DISPLAY).map(([key, label]) => [label, key]),
) as Record<string, status_chamado>;

function parseStatus(value: unknown): status_chamado | undefined {
  if (typeof value !== 'string') return undefined;
  if (value in STATUS_DISPLAY) return value as status_chamado;
  return STATUS_FROM_DISPLAY[value];
}

const STATUS_ENCERRADOS: status_chamado[] = ['Resolvido', 'Fechado'];

const PERFIS_GESTAO = ['Gestor', 'Admin'] as const;

async function ensureGestor(usuarioId: string) {
  await prisma.gestor.upsert({
    where: { id: usuarioId },
    update: {},
    create: { id: usuarioId },
  });
}

async function nomeDoUsuario(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true } });
  return usuario?.nome ?? usuarioId;
}

export const gestorController = {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) throw new AppError(401, 'Usuário não autenticado.');

      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, nome: true, email: true, perfil: true },
      });
      if (!usuario) throw new AppError(404, 'Usuário não encontrado.');

      const pendentes = { status: { notIn: STATUS_ENCERRADOS } };

      const [total, abertos, emAnalise, emAndamento, aguardando, resolvidos, atrasados, meus] =
        await Promise.all([
          prisma.chamado.count(),
          prisma.chamado.count({ where: { status: 'Aberto' } }),
          prisma.chamado.count({ where: { status: 'Em_An_lise' } }),
          prisma.chamado.count({ where: { status: 'Em_Andamento' } }),
          prisma.chamado.count({ where: { status: 'Aguardando' } }),
          prisma.chamado.count({ where: { status: 'Resolvido' } }),
          prisma.chamado.count({ where: { ...pendentes, sladeadline: { lt: new Date() } } }),
          prisma.chamado.count({ where: { ...pendentes, gestorid: usuarioId } }),
        ]);

      res.status(200).json({
        gestor: usuario,
        chamados: { total, abertos, emAnalise, emAndamento, aguardando, resolvidos, atrasados, meus },
      });
    } catch (error) {
      next(error);
    }
  },

  async listarChamados(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) throw new AppError(401, 'Usuário não autenticado.');

      const { status, busca, responsavel, limit = 20, offset = 0 } = req.query;

      const where: Prisma.chamadoWhereInput = {};

      if (status === 'Atrasados') {
        where.status = { notIn: STATUS_ENCERRADOS };
        where.sladeadline = { lt: new Date() };
      } else if (status && status !== 'Todos') {
        const filtro = parseStatus(status);
        if (!filtro) throw new AppError(400, 'Status inválido.');
        where.status = filtro;
      }

      if (responsavel === 'meus') where.gestorid = usuarioId;
      if (responsavel === 'sem') where.gestorid = null;

      if (typeof busca === 'string' && busca.trim()) {
        const termo = busca.trim();
        where.OR = [
          { protocolo: { contains: termo, mode: 'insensitive' } },
          { subcategoria: { contains: termo, mode: 'insensitive' } },
          { descricao: { contains: termo, mode: 'insensitive' } },
          { endereco: { contains: termo, mode: 'insensitive' } },
          { categoria: { nome: { contains: termo, mode: 'insensitive' } } },
        ];
      }

      const [chamados, total] = await Promise.all([
        prisma.chamado.findMany({
          where,
          select: {
            id: true,
            protocolo: true,
            subcategoria: true,
            descricao: true,
            status: true,
            prioridade: true,
            endereco: true,
            cidade: true,
            uf: true,
            slahoras: true,
            sladeadline: true,
            criadoem: true,
            gestorid: true,
            categoria: { select: { id: true, nome: true } },
            orgao: { select: { id: true, sigla: true } },
            cidadao: { select: { usuario: { select: { nome: true } } } },
            gestor: { select: { usuario: { select: { nome: true } } } },
            chamado_foto: { orderBy: { criadoem: 'asc' }, take: 1, select: { url: true } },
          },
          orderBy: [{ sladeadline: 'asc' }, { criadoem: 'desc' }],
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.chamado.count({ where }),
      ]);

      res.status(200).json({
        chamados: chamados.map((c) => ({
          id: c.id,
          protocolo: c.protocolo,
          titulo: c.subcategoria,
          descricao: c.descricao,
          status: displayStatus(c.status),
          prioridade: c.prioridade,
          endereco: c.endereco,
          cidade: c.cidade,
          uf: c.uf,
          slaHoras: c.slahoras,
          slaDeadline: c.sladeadline,
          criadoEm: c.criadoem,
          categoria: c.categoria,
          orgao: c.orgao,
          cidadaoNome: c.cidadao?.usuario?.nome ?? '',
          responsavel: c.gestorid ? { id: c.gestorid, nome: c.gestor?.usuario?.nome ?? '' } : null,
          photoUrl: c.chamado_foto?.[0]?.url ?? null,
        })),
        pagina: { total, limit: Number(limit), offset: Number(offset) },
      });
    } catch (error) {
      next(error);
    }
  },

  async detalharChamado(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const c = await prisma.chamado.findUnique({
        where: { id },
        select: {
          id: true,
          protocolo: true,
          subcategoria: true,
          descricao: true,
          status: true,
          prioridade: true,
          endereco: true,
          cidade: true,
          uf: true,
          zona: true,
          latitude: true,
          longitude: true,
          slahoras: true,
          sladeadline: true,
          slajustification: true,
          resolutionnote: true,
          criadoem: true,
          atualizadoem: true,
          gestorid: true,
          categoria: { select: { id: true, nome: true } },
          orgao: { select: { id: true, nome: true, sigla: true } },
          cidadao: { include: { usuario: { select: { nome: true, email: true } } } },
          gestor: { select: { usuario: { select: { nome: true } } } },
          chamado_foto: { orderBy: { criadoem: 'asc' }, select: { id: true, url: true } },
          timeline_event: {
            orderBy: { timestamp: 'asc' },
            select: { id: true, tipo: true, titulo: true, descricao: true, autor: true, timestamp: true },
          },
        },
      });

      if (!c) throw new AppError(404, 'Chamado não encontrado.');

      res.status(200).json({
        chamado: {
          id: c.id,
          protocolo: c.protocolo,
          titulo: c.subcategoria,
          descricao: c.descricao,
          status: displayStatus(c.status),
          prioridade: c.prioridade,
          endereco: c.endereco,
          cidade: c.cidade,
          uf: c.uf,
          zona: c.zona,
          latitude: Number(c.latitude),
          longitude: Number(c.longitude),
          slaHoras: c.slahoras,
          slaDeadline: c.sladeadline,
          justificativa: c.slajustification,
          notaResolucao: c.resolutionnote,
          criadoEm: c.criadoem,
          atualizadoEm: c.atualizadoem,
          categoria: c.categoria,
          orgao: c.orgao,
          cidadao: { nome: c.cidadao?.usuario?.nome ?? '', email: c.cidadao?.usuario?.email ?? '' },
          responsavel: c.gestorid ? { id: c.gestorid, nome: c.gestor?.usuario?.nome ?? '' } : null,
          fotos: c.chamado_foto,
          timeline: c.timeline_event,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async atualizarStatusChamado(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;
      const id = req.params.id as string;
      const { status, justificativa, resolutionNote } = req.body;

      if (!usuarioId) throw new AppError(401, 'Usuário não autenticado.');
      if (!status)    throw new AppError(400, 'Status é obrigatório.');

      const novoStatus = STATUS_FROM_DISPLAY[status];
      if (!novoStatus) {
        throw new AppError(400, `Status inválido. Valores aceitos: ${Object.keys(STATUS_FROM_DISPLAY).join(', ')}`);
      }

      const chamado = await prisma.chamado.findUnique({ where: { id } });
      if (!chamado) throw new AppError(404, 'Chamado não encontrado.');

      const autor = await nomeDoUsuario(usuarioId);
      const oldStatus = chamado.status;

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.chamado.update({
          where: { id },
          data: {
            status: novoStatus,
            atualizadoem: new Date(),
            ...(justificativa  ? { slajustification: String(justificativa) }  : {}),
            ...(resolutionNote ? { resolutionnote:   String(resolutionNote) } : {}),
          },
          select: { id: true, protocolo: true, status: true, atualizadoem: true },
        });

        const descricao = resolutionNote
          ? `Chamado concluído. ${resolutionNote}`
          : justificativa
            ? `Status alterado para ${status}. Motivo: ${justificativa}`
            : `Status alterado de ${displayStatus(oldStatus)} para ${status}`;

        await tx.timeline_event.create({
          data: {
            chamadoid: id,
            tipo: novoStatus === 'Resolvido' ? 'conclusao' : 'status',
            titulo: 'Status atualizado',
            descricao,
            autor,
            dadosantigos: { status: oldStatus },
            dadosnovos: { status: novoStatus },
          },
        });

        return result;
      });

      await invalidateMetricsCache(chamado.gestorid);

      const detalhe = resolutionNote ? ` ${resolutionNote}` : justificativa ? ` Motivo: ${justificativa}` : '';
      await notificationService.notifyDemandUpdate(id, {
        titulo: novoStatus === 'Resolvido' ? 'Chamado resolvido' : 'Status atualizado',
        mensagem: `Seu chamado agora está "${status}".${detalhe}`,
        tipo: novoStatus === 'Resolvido' ? 'chamado_concluido' : 'status_atualizado',
      });

      res.status(200).json({
        message: 'Status atualizado com sucesso.',
        chamado: updated && { ...updated, status: displayStatus(updated.status) },
      });
    } catch (error) {
      next(error);
    }
  },

  async aceitarChamado(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;
      const id = req.params['id'] as string;
      const gestorDestinoId = req.body?.gestorDestinoId as string | undefined;

      if (!usuarioId) throw new AppError(401, 'Usuário não autenticado.');

      const chamado = await prisma.chamado.findUnique({ where: { id } });
      if (!chamado) throw new AppError(404, 'Chamado não encontrado.');

      const responsavelId = gestorDestinoId ?? usuarioId;

      if (gestorDestinoId) {
        const destino = await prisma.usuario.findUnique({
          where: { id: gestorDestinoId },
          select: { perfil: true, status: true },
        });
        if (!destino || destino.status !== 'Ativo' || !(PERFIS_GESTAO as readonly string[]).includes(destino.perfil)) {
          throw new AppError(400, 'Responsável inválido: escolha um gestor ou administrador ativo.');
        }
      }

      await ensureGestor(responsavelId);

      const novoStatus: status_chamado = chamado.status === 'Aberto' ? status_chamado.Em_An_lise : chamado.status;

      const autor = await nomeDoUsuario(usuarioId);
      const responsavel = gestorDestinoId ? await nomeDoUsuario(gestorDestinoId) : autor;

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.chamado.update({
          where: { id },
          data: { gestorid: responsavelId, status: novoStatus, atualizadoem: new Date() },
          select: { id: true, status: true, gestorid: true },
        });

        await tx.timeline_event.create({
          data: {
            chamadoid: id,
            tipo: 'status',
            titulo: gestorDestinoId ? 'Responsável designado' : 'Chamado aceito',
            descricao: gestorDestinoId
              ? `Chamado atribuído a ${responsavel} por ${autor}.`
              : `Chamado aceito por ${autor}.`,
            autor,
            dadosantigos: { gestorid: chamado.gestorid, status: chamado.status },
            dadosnovos: { gestorid: responsavelId, status: novoStatus },
          },
        });

        return result;
      });

      await invalidateMetricsCache(responsavelId);

      if (chamado.status === 'Aberto') {
        await notificationService.notifyDemandUpdate(id, {
          titulo: 'Chamado em análise',
          mensagem: 'Seu chamado foi aceito pela equipe responsável e está em análise.',
          tipo: 'equipe_designada',
        });
      }

      res.status(200).json({
        message: 'Chamado aceito com sucesso.',
        chamado: updated && { ...updated, status: displayStatus(updated.status) },
      });
    } catch (error) {
      next(error);
    }
  },

  async comentarChamado(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;
      const id = req.params['id'] as string;
      const mensagem = typeof req.body?.mensagem === 'string' ? req.body.mensagem.trim() : '';

      if (!usuarioId) throw new AppError(401, 'Usuário não autenticado.');
      if (!mensagem) throw new AppError(400, 'A mensagem é obrigatória.');
      if (mensagem.length > 1000) throw new AppError(400, 'A mensagem deve ter no máximo 1000 caracteres.');

      const chamado = await prisma.chamado.findUnique({ where: { id }, select: { id: true } });
      if (!chamado) throw new AppError(404, 'Chamado não encontrado.');

      const evento = await prisma.timeline_event.create({
        data: {
          chamadoid: id,
          tipo: 'mensagem',
          titulo: 'Atualização da equipe',
          descricao: mensagem,
          autor: await nomeDoUsuario(usuarioId),
        },
        select: { id: true, tipo: true, titulo: true, descricao: true, autor: true, timestamp: true },
      });

      await notificationService.notifyDemandUpdate(id, {
        titulo: 'Nova atualização da equipe',
        mensagem,
        tipo: 'status_atualizado',
      });

      res.status(201).json({ evento });
    } catch (error) {
      next(error);
    }
  },

  async transferirChamado(req: Request, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;
      const id = req.params['id'] as string;
      const orgaoId       = req.body.orgaoId       as string | undefined;
      const justificativa = req.body.justificativa as string | undefined;

      if (!usuarioId) throw new AppError(401, 'Usuário não autenticado.');
      if (!orgaoId || !justificativa) throw new AppError(400, 'orgaoId e justificativa são obrigatórios.');

      const chamado = await prisma.chamado.findUnique({ where: { id } });
      if (!chamado) throw new AppError(404, 'Chamado não encontrado.');

      const orgaoDestino = await prisma.orgao.findUnique({ where: { id: orgaoId } });
      if (!orgaoDestino) throw new AppError(400, 'Órgão destino não encontrado.');
      if (orgaoDestino.id === chamado.orgaoid) throw new AppError(400, 'O chamado já está com este órgão.');

      const autor = await nomeDoUsuario(usuarioId);

      await prisma.$transaction(async (tx) => {
        await tx.chamado.update({
          where: { id },
          data: { orgaoid: orgaoId, atualizadoem: new Date() },
        });

        await tx.timeline_event.create({
          data: {
            chamadoid: id,
            tipo: 'transferencia',
            titulo: 'Chamado transferido',
            descricao: `Encaminhado para ${orgaoDestino.nome}. Motivo: ${justificativa}`,
            autor,
            dadosantigos: { orgaoid: chamado.orgaoid },
            dadosnovos:   { orgaoid: orgaoId },
          },
        });
      });

      await invalidateMetricsCache(chamado.gestorid);

      await notificationService.notifyDemandUpdate(id, {
        titulo: 'Chamado encaminhado',
        mensagem: `Seu chamado foi encaminhado para ${orgaoDestino.nome}.`,
        tipo: 'status_atualizado',
      });

      res.status(200).json({ message: 'Chamado transferido com sucesso.' });
    } catch (error) {
      next(error);
    }
  },

  async listarEquipe(_req: Request, res: Response, next: NextFunction) {
    try {
      const equipe = await prisma.usuario.findMany({
        where: { perfil: { in: [...PERFIS_GESTAO] }, status: 'Ativo' },
        select: { id: true, nome: true, email: true, perfil: true },
        orderBy: { nome: 'asc' },
      });

      res.status(200).json({ equipe });
    } catch (error) {
      next(error);
    }
  },
};
