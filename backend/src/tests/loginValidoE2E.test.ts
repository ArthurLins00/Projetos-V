import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { app } from '../app';
import { prisma } from '../config/__mocks__/prisma';

jest.mock('../config/prisma', () => require('../config/__mocks__/prisma'));

describe('AUT-01 | Realizar login com credenciais válidas | RF04 (E2E)', () => {
  const senha = 'senhaSegura123';
  const usuario = {
    id: 'usuario-login-valido',
    nome: 'Usuário Teste',
    email: 'usuario.teste@example.com',
    senha: bcrypt.hashSync(senha, 10),
    perfil: 'Cidadao',
    status: 'Ativo',
    criadoem: new Date(),
    atualizadoem: new Date(),
  };

  it('deve autenticar o usuário e retornar um token de acesso', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuario as any);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: usuario.email,
        senha,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    });
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('token=')]),
    );

    const payload = jwt.verify(response.body.token, process.env.JWT_SECRET!);
    expect(payload).toMatchObject({
      id: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
    });
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: { email: usuario.email },
    });
  });
});
