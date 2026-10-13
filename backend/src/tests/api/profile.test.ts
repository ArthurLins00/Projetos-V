import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

describe('PUT /auth/me', () => {
  const senhaAtual = 'Senha@123';
  const usuario = {
    id: 'cidadao-1',
    nome: 'Cidadão Teste',
    email: 'cidadao@example.com',
    senha: bcrypt.hashSync(senhaAtual, 4),
    perfil: 'Cidadao',
    status: 'Ativo',
    criadoem: new Date('2026-01-01T00:00:00Z'),
  };
  const outro = { ...usuario, id: 'outro-1', email: 'outro@example.com' };
  const token = jwt.sign({ id: usuario.id, email: usuario.email, perfil: usuario.perfil }, JWT_SECRET, { expiresIn: '1h' });
  const auth = { Authorization: `Bearer ${token}` };

  beforeEach(() => {
    prisma.usuario.findUnique.mockImplementation((async ({ where }: any) => {
      if (where.id === usuario.id || where.email === usuario.email) return usuario;
      if (where.email === outro.email) return outro;
      return null;
    }) as any);
    prisma.usuario.update.mockImplementation((async ({ data }: any) => {
      const { senha, atualizadoem, atualizadopor, ...rest } = { ...usuario, ...data };
      return rest;
    }) as any);
  });

  it('atualiza o nome sem exigir a senha atual', async () => {
    const res = await request(app).put('/auth/me').set(auth).send({ nome: '  Novo Nome  ' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: usuario.id, nome: 'Novo Nome', email: usuario.email });
    expect(res.body).not.toHaveProperty('senha');
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: usuario.id }, data: expect.objectContaining({ nome: 'Novo Nome', atualizadopor: usuario.id }) })
    );
  });

  it('atualiza o e-mail quando a senha atual está correta', async () => {
    const res = await request(app).put('/auth/me').set(auth).send({ email: 'novo@example.com', senhaAtual });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('novo@example.com');
  });

  it('troca a senha gravando o novo hash', async () => {
    const res = await request(app).put('/auth/me').set(auth).send({ senhaAtual, novaSenha: 'NovaSenha@1' });

    expect(res.status).toBe(200);
    const { data } = prisma.usuario.update.mock.calls[0]![0] as any;
    expect(await bcrypt.compare('NovaSenha@1', data.senha)).toBe(true);
  });

  it('exige a senha atual para alterar o e-mail (400)', async () => {
    const res = await request(app).put('/auth/me').set(auth).send({ email: 'novo@example.com' });

    expect(res.status).toBe(400);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('recusa senha atual incorreta (401)', async () => {
    const res = await request(app).put('/auth/me').set(auth).send({ senhaAtual: 'errada', novaSenha: 'NovaSenha@1' });

    expect(res.status).toBe(401);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('recusa e-mail já usado por outra conta (409)', async () => {
    const res = await request(app).put('/auth/me').set(auth).send({ email: outro.email, senhaAtual });

    expect(res.status).toBe(409);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'sem campos'],
    [{ nome: '   ' }, 'nome vazio'],
    [{ email: 'invalido', senhaAtual }, 'e-mail inválido'],
    [{ novaSenha: '123', senhaAtual }, 'senha curta'],
  ])('valida os dados (400): %s', async (body) => {
    const res = await request(app).put('/auth/me').set(auth).send(body);

    expect(res.status).toBe(400);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('exige autenticação (401)', async () => {
    const res = await request(app).put('/auth/me').send({ nome: 'X' });

    expect(res.status).toBe(401);
  });
});
