import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../app';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));

import { prisma } from '../../config/__mocks__/prisma';

describe('POST /auth/login', () => {

  const senhaPlana = 'senha123';

  const senhaHasheada = bcrypt.hashSync(senhaPlana, 10);

  const mockUsuarioBase = {
    id: 'uuid-1234',
    nome: 'Usuário Teste',
    email: 'teste@exemplo.com',
    senha: senhaHasheada,
    perfil: 'Cidadao',
    status: 'Ativo',
    criadoem: new Date(),
    atualizadoem: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar 200 e um token/cookie quando as credenciais forem válidas', async () => {
    prisma.usuario.findUnique.mockResolvedValue(mockUsuarioBase as any);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: mockUsuarioBase.email,
        senha: senhaPlana,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.email).toBe(mockUsuarioBase.email);

    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('deve retornar 401 quando a senha estiver incorreta', async () => {
    prisma.usuario.findUnique.mockResolvedValue(mockUsuarioBase as any);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: mockUsuarioBase.email,
        senha: 'senha-errada',
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Credenciais inválidas/i);
  });

  it('deve retornar 401 quando o e-mail não existir', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'inexistente@exemplo.com',
        senha: senhaPlana,
      });

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Credenciais inválidas/i);
  });

  it('deve retornar 403 se o usuário estiver com status inativo', async () => {
    const usuarioInativo = { ...mockUsuarioBase, status: 'Inativo' };
    prisma.usuario.findUnique.mockResolvedValue(usuarioInativo as any);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: mockUsuarioBase.email,
        senha: senhaPlana,
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/Usuário inativo/i);
  });
});