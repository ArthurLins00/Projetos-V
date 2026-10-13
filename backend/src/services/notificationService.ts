import { tipo_notificacao } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorMiddleware';
import { mailService } from './mailService';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_REGEX = /^Expo(nent)?PushToken\[.+\]$/;

interface DemandUpdate {
  titulo: string;
  mensagem: string;
  tipo: tipo_notificacao;
}

interface Recipient {
  id: string;
  nome: string;
  email: string;
}

async function sendEmail(usuario: Recipient, protocolo: string, assunto: string, update: DemandUpdate) {
  await mailService.send(
    usuario.email,
    `Fiscalize — ${update.titulo} (${protocolo})`,
    `Olá, ${usuario.nome}.\n\n${update.mensagem}\n\nChamado: ${protocolo} — ${assunto}\n\nAcompanhe os detalhes pelo app Fiscalize.`
  );
}

async function sendPush(usuarioId: string, chamadoId: string, protocolo: string, update: DemandUpdate) {
  const tokens = await prisma.push_token.findMany({ where: { usuarioid: usuarioId }, select: { token: true } });
  if (!tokens?.length) return;

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: `${update.titulo} · ${protocolo}`,
    body: update.mensagem,
    sound: 'default',
    channelId: 'chamados',
    data: { demandId: chamadoId },
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`Expo Push respondeu ${response.status}`);

  const { data: tickets = [] } = (await response.json()) as {
    data?: { status: string; message?: string; details?: { error?: string } }[];
  };
  const invalidos = tickets
    .map((ticket, i) => (ticket.details?.error === 'DeviceNotRegistered' ? messages[i]!.to : null))
    .filter((token): token is string => !!token);

  if (invalidos.length) {
    await prisma.push_token.deleteMany({ where: { token: { in: invalidos } } });
  }
}

export const notificationService = {
  async notifyDemandUpdate(chamadoId: string, update: DemandUpdate) {
    try {
      const chamado = await prisma.chamado.findUnique({
        where: { id: chamadoId },
        select: {
          protocolo: true,
          subcategoria: true,
          cidadao: { select: { usuario: { select: { id: true, nome: true, email: true } } } },
        },
      });
      const usuario = chamado?.cidadao?.usuario;
      if (!chamado || !usuario) return;

      await prisma.notificacao.create({
        data: { usuarioid: usuario.id, chamadoid: chamadoId, titulo: update.titulo, mensagem: update.mensagem, tipo: update.tipo },
      });

      const results = await Promise.allSettled([
        sendEmail(usuario, chamado.protocolo, chamado.subcategoria, update),
        sendPush(usuario.id, chamadoId, chamado.protocolo, update),
      ]);
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(`[Notificação] Falha ao enviar ${i === 0 ? 'e-mail' : 'push'}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('[Notificação] Erro ao notificar atualização do chamado:', error);
    }
  },

  async list(usuarioId: string, { page, limit, unreadOnly }: { page: number; limit: number; unreadOnly: boolean }) {
    const where = { usuarioid: usuarioId, ...(unreadOnly && { lida: false }) };

    const [notificacoes, total, unreadCount] = await Promise.all([
      prisma.notificacao.findMany({
        where,
        orderBy: { criadoem: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          titulo: true,
          mensagem: true,
          tipo: true,
          lida: true,
          criadoem: true,
          chamadoid: true,
          chamado: { select: { protocolo: true } },
        },
      }),
      prisma.notificacao.count({ where }),
      prisma.notificacao.count({ where: { usuarioid: usuarioId, lida: false } }),
    ]);

    return {
      data: notificacoes.map((n) => ({
        id: n.id,
        title: n.titulo,
        message: n.mensagem,
        type: n.tipo,
        read: n.lida,
        demandId: n.chamadoid,
        protocolo: n.chamado?.protocolo ?? null,
        createdAt: n.criadoem,
      })),
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async markAsRead(usuarioId: string, notificacaoId: string) {
    const { count } = await prisma.notificacao.updateMany({
      where: { id: notificacaoId, usuarioid: usuarioId },
      data: { lida: true, lida_em: new Date() },
    });
    if (count === 0) throw new AppError(404, 'Notificação não encontrada.');
  },

  async markAllAsRead(usuarioId: string) {
    const { count } = await prisma.notificacao.updateMany({
      where: { usuarioid: usuarioId, lida: false },
      data: { lida: true, lida_em: new Date() },
    });
    return { updated: count };
  },

  async registerPushToken(usuarioId: string, token: string) {
    if (!EXPO_TOKEN_REGEX.test(token)) {
      throw new AppError(400, 'Token de push inválido.');
    }

    await prisma.push_token.upsert({
      where: { token },
      create: { usuarioid: usuarioId, token },
      update: { usuarioid: usuarioId },
    });
  },

  async removePushToken(usuarioId: string, token: string) {
    await prisma.push_token.deleteMany({ where: { usuarioid: usuarioId, token } });
  },
};
