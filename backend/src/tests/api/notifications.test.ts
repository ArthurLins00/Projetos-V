import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

describe('Notificações (/notifications)', () => {
  const usuarioId = 'cidadao-notif';
  const token = jwt.sign({ id: usuarioId, email: 'notif@example.com', perfil: 'Cidadao' }, JWT_SECRET, { expiresIn: '1h' });
  const auth = { Authorization: `Bearer ${token}` };
  const NOTIF_ID = '6f1c2a5e-8b3d-4c7a-9e2f-1a2b3c4d5e6f';

  beforeEach(() => {
    prisma.usuario.findUnique.mockResolvedValue({ id: usuarioId, perfil: 'Cidadao', status: 'Ativo' } as any);
  });

  it('lista as notificações do usuário, da mais recente para a mais antiga, com o total de não lidas', async () => {
    prisma.notificacao.findMany.mockResolvedValue([
      {
        id: NOTIF_ID,
        titulo: 'Status atualizado',
        mensagem: 'Seu chamado agora está "Em Andamento".',
        tipo: 'status_atualizado',
        lida: false,
        criadoem: new Date('2026-10-13T12:00:00Z'),
        chamadoid: 'chamado-1',
        chamado: { protocolo: 'DEM-20261013-ABCD' },
      },
    ] as any);
    prisma.notificacao.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const res = await request(app).get('/notifications').set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 1, unreadCount: 1, page: 1 });
    expect(res.body.data[0]).toEqual({
      id: NOTIF_ID,
      title: 'Status atualizado',
      message: 'Seu chamado agora está "Em Andamento".',
      type: 'status_atualizado',
      read: false,
      demandId: 'chamado-1',
      protocolo: 'DEM-20261013-ABCD',
      createdAt: '2026-10-13T12:00:00.000Z',
    });
    const args = prisma.notificacao.findMany.mock.calls[0]![0] as any;
    expect(args.where).toEqual({ usuarioid: usuarioId });
    expect(args.orderBy).toEqual({ criadoem: 'desc' });
  });

  it('filtra só as não lidas com ?unread=true', async () => {
    prisma.notificacao.findMany.mockResolvedValue([]);
    prisma.notificacao.count.mockResolvedValue(0);

    await request(app).get('/notifications?unread=true').set(auth);

    expect((prisma.notificacao.findMany.mock.calls[0]![0] as any).where).toEqual({ usuarioid: usuarioId, lida: false });
  });

  it('marca uma notificação como lida, só se for do próprio usuário', async () => {
    prisma.notificacao.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).patch(`/notifications/${NOTIF_ID}/read`).set(auth);

    expect(res.status).toBe(204);
    expect(prisma.notificacao.updateMany).toHaveBeenCalledWith({
      where: { id: NOTIF_ID, usuarioid: usuarioId },
      data: { lida: true, lida_em: expect.any(Date) },
    });
  });

  it('retorna 404 para notificação de outra pessoa ou id inválido', async () => {
    prisma.notificacao.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(app).patch(`/notifications/${NOTIF_ID}/read`).set(auth)).status).toBe(404);

    expect((await request(app).patch('/notifications/nao-e-uuid/read').set(auth)).status).toBe(404);
  });

  it('marca todas como lidas', async () => {
    prisma.notificacao.updateMany.mockResolvedValue({ count: 3 });

    const res = await request(app).patch('/notifications/read-all').set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 3 });
  });

  it('exige autenticação (401)', async () => {
    expect((await request(app).get('/notifications')).status).toBe(401);
  });
});
