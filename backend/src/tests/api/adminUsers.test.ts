import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

describe('Gestão de usuários pelo admin (/admin/users)', () => {
  const admin = { id: 'uuid-admin', nome: 'Admin', email: 'admin@teste.com', perfil: 'Admin', status: 'Ativo' };
  const cidadao = { id: 'uuid-cidadao', nome: 'Maria', email: 'maria@teste.com', perfil: 'Cidadao', status: 'Ativo' };
  const gestor = { id: 'uuid-gestor', nome: 'João', email: 'joao@teste.com', perfil: 'Gestor', status: 'Ativo' };

  const tokenOf = (u: { id: string; email: string; perfil: string }) =>
    jwt.sign({ id: u.id, email: u.email, perfil: u.perfil }, JWT_SECRET, { expiresIn: '1h' });

  function mockUsuarios(...usuarios: { id: string }[]) {
    prisma.usuario.findUnique.mockImplementation((async ({ where }: any) =>
      usuarios.find((u) => u.id === where.id) ?? null) as any);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
  });

  it('GET lista os usuários com busca por nome ou e-mail', async () => {
    mockUsuarios(admin);
    prisma.usuario.findMany.mockResolvedValue([cidadao] as any);
    prisma.usuario.count.mockResolvedValue(1);

    const response = await request(app)
      .get('/admin/users')
      .query({ busca: 'maria', role: 'Cidadao' })
      .set('Authorization', `Bearer ${tokenOf(admin)}`);

    expect(response.status).toBe(200);
    expect(response.body.usuarios).toHaveLength(1);
    const where = prisma.usuario.findMany.mock.calls[0]![0]!.where as any;
    expect(where.perfil).toBe('Cidadao');
    expect(where.OR).toEqual([
      { nome: { contains: 'maria', mode: 'insensitive' } },
      { email: { contains: 'maria', mode: 'insensitive' } },
    ]);
  });

  it('GET retorna 403 para gestor', async () => {
    mockUsuarios(gestor);

    const response = await request(app).get('/admin/users').set('Authorization', `Bearer ${tokenOf(gestor)}`);

    expect(response.status).toBe(403);
  });

  it('PATCH promove cidadão a gestor e cria o registro de gestor', async () => {
    mockUsuarios(admin, cidadao);
    prisma.usuario.update.mockResolvedValue({ ...cidadao, perfil: 'Gestor' } as any);

    const response = await request(app)
      .patch(`/admin/users/${cidadao.id}/role`)
      .set('Authorization', `Bearer ${tokenOf(admin)}`)
      .send({ role: 'Gestor' });

    expect(response.status).toBe(200);
    expect(response.body.perfil).toBe('Gestor');
    expect(prisma.gestor.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: cidadao.id } }));
  });

  it('PATCH rebaixa gestor a cidadão e garante o registro de cidadão', async () => {
    mockUsuarios(admin, gestor);
    prisma.usuario.update.mockResolvedValue({ ...gestor, perfil: 'Cidadao' } as any);

    const response = await request(app)
      .patch(`/admin/users/${gestor.id}/role`)
      .set('Authorization', `Bearer ${tokenOf(admin)}`)
      .send({ role: 'Cidadao' });

    expect(response.status).toBe(200);
    expect(prisma.cidadao.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: gestor.id } }));
  });

  it('PATCH não permite alterar o perfil de outro admin', async () => {
    const outroAdmin = { ...admin, id: 'uuid-admin-2', email: 'admin2@teste.com' };
    mockUsuarios(admin, outroAdmin);

    const response = await request(app)
      .patch(`/admin/users/${outroAdmin.id}/role`)
      .set('Authorization', `Bearer ${tokenOf(admin)}`)
      .send({ role: 'Cidadao' });

    expect(response.status).toBe(403);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('PATCH rejeita perfil Admin', async () => {
    mockUsuarios(admin, cidadao);

    const response = await request(app)
      .patch(`/admin/users/${cidadao.id}/role`)
      .set('Authorization', `Bearer ${tokenOf(admin)}`)
      .send({ role: 'Admin' });

    expect(response.status).toBe(400);
  });

  it('a mudança de perfil vale sem novo login: o token antigo de cidadão passa a acessar /gestor', async () => {
    const promovido = { ...cidadao, perfil: 'Gestor' };
    mockUsuarios(promovido);
    prisma.chamado.count.mockResolvedValue(0);

    const response = await request(app)
      .get('/gestor/dashboard')
      .set('Authorization', `Bearer ${tokenOf(cidadao)}`);

    expect(response.status).toBe(200);
  });
});
