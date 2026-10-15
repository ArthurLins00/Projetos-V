import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    promises: { ...actual.promises, mkdir: jest.fn(), writeFile: jest.fn(), unlink: jest.fn().mockResolvedValue(undefined) },
  };
});
import { promises as fs } from 'fs';
import { prisma } from '../../config/__mocks__/prisma';

describe('Foto de perfil (/auth/me/photo)', () => {
  const usuario = {
    id: 'cidadao-foto',
    nome: 'Cidadão Foto',
    email: 'foto@example.com',
    perfil: 'Cidadao',
    status: 'Ativo',
    fotourl: '/uploads/avatar-cidadao-foto-1.jpg' as string | null,
    criadoem: new Date('2026-01-01T00:00:00Z'),
  };
  const token = jwt.sign({ id: usuario.id, email: usuario.email, perfil: usuario.perfil }, JWT_SECRET, { expiresIn: '1h' });
  const auth = { Authorization: `Bearer ${token}` };
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]).toString('base64');

  beforeEach(() => {
    (fs.writeFile as jest.Mock).mockClear();
    (fs.unlink as jest.Mock).mockClear();
    prisma.usuario.findUnique.mockResolvedValue(usuario as any);
    prisma.usuario.update.mockImplementation((async ({ data }: any) => {
      const { atualizadoem, atualizadopor, ...rest } = { ...usuario, ...data };
      return rest;
    }) as any);
  });

  it('salva a nova foto, retorna a fotourl e apaga a anterior', async () => {
    const res = await request(app).put('/auth/me/photo').set(auth).send({ photo: `data:image/jpeg;base64,${jpeg}` });

    expect(res.status).toBe(200);
    expect(res.body.fotourl).toMatch(/^\/uploads\/avatar-cidadao-foto-\d+\.jpg$/);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('avatar-cidadao-foto-1.jpg'));
  });

  it('recusa arquivo que não é imagem (422)', async () => {
    const res = await request(app)
      .put('/auth/me/photo')
      .set(auth)
      .send({ photo: Buffer.from('texto qualquer').toString('base64') });

    expect(res.status).toBe(422);
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('exige o campo photo (400)', async () => {
    const res = await request(app).put('/auth/me/photo').set(auth).send({});
    expect(res.status).toBe(400);
  });

  it('aceita corpo maior que o limite padrão de 100kb', async () => {
    const grande = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300 * 1024)]).toString('base64');
    const res = await request(app).put('/auth/me/photo').set(auth).send({ photo: grande });
    expect(res.status).toBe(200);
  });

  it('exige autenticação (401)', async () => {
    const res = await request(app).put('/auth/me/photo').send({ photo: jpeg });
    expect(res.status).toBe(401);
  });

  it('DELETE remove a foto e apaga o arquivo', async () => {
    const res = await request(app).delete('/auth/me/photo').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.fotourl).toBeNull();
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('avatar-cidadao-foto-1.jpg'));
  });

  it('GET /auth/me inclui a fotourl', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ ...usuario } as any);
    const res = await request(app).get('/auth/me').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.fotourl).toBe(usuario.fotourl);
  });
});
