import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

describe('Termos de uso (/auth/me/terms)', () => {
  const senha = 'Senha@123';
  const base = {
    id: 'cidadao-termos',
    nome: 'Cidadão Termos',
    email: 'termos@example.com',
    senha: bcrypt.hashSync(senha, 4),
    perfil: 'Cidadao',
    status: 'Ativo',
    fotourl: null,
    criadoem: new Date('2026-01-01T00:00:00Z'),
  };
  const token = jwt.sign({ id: base.id, email: base.email, perfil: base.perfil }, JWT_SECRET, { expiresIn: '1h' });
  const auth = { Authorization: `Bearer ${token}` };
  let usuario: any;

  beforeEach(() => {
    usuario = { ...base, termosversao: null, termosaceitoem: null };
    prisma.usuario.findUnique.mockImplementation((async () => usuario) as any);
    prisma.usuario.update.mockImplementation((async ({ data }: any) => {
      usuario = { ...usuario, ...data };
      const { senha: _s, termosaceitoem: _t, ...rest } = usuario;
      return rest;
    }) as any);
  });

  it('login retorna termosversao nula para quem nunca aceitou', async () => {
    const res = await request(app).post('/auth/login').send({ email: base.email, senha });

    expect(res.status).toBe(200);
    expect(res.body.termosversao).toBeNull();
  });

  it('registra o aceite com a versão e a data', async () => {
    const res = await request(app).post('/auth/me/terms').set(auth).send({ versao: 1 });

    expect(res.status).toBe(200);
    expect(res.body.termosversao).toBe(1);
    const data = prisma.usuario.update.mock.calls[0][0].data as any;
    expect(data.termosversao).toBe(1);
    expect(data.termosaceitoem).toBeInstanceOf(Date);
  });

  it('não regride nem regrava quando a versão já foi aceita', async () => {
    usuario.termosversao = 2;

    const res = await request(app).post('/auth/me/terms').set(auth).send({ versao: 1 });

    expect(res.status).toBe(200);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it.each([{}, { versao: 0 }, { versao: 1.5 }, { versao: '1' }])('rejeita versão inválida %j (400)', async (body) => {
    const res = await request(app).post('/auth/me/terms').set(auth).send(body);
    expect(res.status).toBe(400);
  });

  it('exige autenticação (401)', async () => {
    const res = await request(app).post('/auth/me/terms').send({ versao: 1 });
    expect(res.status).toBe(401);
  });

  it('GET /auth/me inclui a termosversao', async () => {
    usuario.termosversao = 1;
    const res = await request(app).get('/auth/me').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.termosversao).toBe(1);
  });
});
