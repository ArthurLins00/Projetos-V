import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../app';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

describe('AUT-10 | Realizar logout e revogar o token | RF04 (API)', () => {
  const senha = 'senhaSegura123';
  const usuario = {
    id: 'usuario-logout',
    nome: 'Usuário Logout',
    email: 'usuario.logout@example.com',
    senha: bcrypt.hashSync(senha, 10),
    perfil: 'Cidadao',
    status: 'Ativo',
    criadoem: new Date(),
    atualizadoem: new Date(),
  };

  let token: string;

  beforeEach(async () => {
    // O mesmo mock atende o login e a verificação do usuário no middleware de autenticação
    prisma.usuario.findUnique.mockResolvedValue(usuario as any);

    const login = await request(app).post('/auth/login').send({ email: usuario.email, senha });
    expect(login.status).toBe(200);
    token = login.body.token;
  });

  it('deve realizar o logout com sucesso (200) e limpar o cookie', async () => {
    const response = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/Logout realizado com sucesso/i);
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringMatching(/^token=;/)]),
    );
  });

  it('o token deve funcionar antes do logout e ser rejeitado (401) depois', async () => {
    const antes = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(antes.status).toBe(200);

    await request(app).post('/auth/logout').set('Authorization', `Bearer ${token}`);

    const depois = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(depois.status).toBe(401);
    expect(depois.body.error).toMatch(/revogado/i);
  });
});
