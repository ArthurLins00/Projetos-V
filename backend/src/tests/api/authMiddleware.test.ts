import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

describe('Middleware de Autenticação (Rotas Protegidas)', () => {
  const PROTECTED_ROUTE = '/auth/me';

  const mockUsuarioBase = {
    id: 'uuid-1234',
    email: 'teste@exemplo.com',
    perfil: 'Cidadao',
    status: 'Ativo',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar 401 quando nenhum token for enviado', async () => {
    const response = await request(app).get(PROTECTED_ROUTE);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Token não fornecido/i);
  });

  it('deve retornar 401 quando o token enviado for inválido', async () => {
    const response = await request(app)
      .get(PROTECTED_ROUTE)
      .set('Authorization', 'Bearer token-totalmente-invalido');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Token inválido/i);
  });

  it('deve retornar 401 quando o token estiver expirado', async () => {
    const tokenExpirado = jwt.sign(
      { id: mockUsuarioBase.id, email: mockUsuarioBase.email, perfil: mockUsuarioBase.perfil },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const response = await request(app)
      .get(PROTECTED_ROUTE)
      .set('Authorization', `Bearer ${tokenExpirado}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Token expirado/i);
  });

  it('deve permitir acesso (200) com token válido e usuário ativo', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
        id: mockUsuarioBase.id,
        nome: 'Teste',
        email: mockUsuarioBase.email,
        perfil: mockUsuarioBase.perfil,
        status: mockUsuarioBase.status,
        criadoem: new Date(),
    } as any);

    const tokenValido = jwt.sign(
      { id: mockUsuarioBase.id, email: mockUsuarioBase.email, perfil: mockUsuarioBase.perfil },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const response = await request(app)
      .get(PROTECTED_ROUTE)
      .set('Authorization', `Bearer ${tokenValido}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(mockUsuarioBase.id);
  });
});
