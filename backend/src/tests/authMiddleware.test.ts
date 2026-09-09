import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { JWT_SECRET } from '../config/env';

// Injeta o mock explicitamente no módulo prisma
jest.mock('../config/prisma', () => require('../config/__mocks__/prisma'));
import { prisma } from '../config/__mocks__/prisma';

describe('Middleware de Autenticação (Rotas Protegidas)', () => {
  // Vamos usar a rota /auth/me como "cobaia" para testar a proteção
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

  // -------------------------------------------------------------
  // Cenário 1: Token Ausente
  // -------------------------------------------------------------
  it('deve retornar 401 quando nenhum token for enviado', async () => {
    // Ação: Tentamos acessar a rota protegida sem enviar o cookie ou o header de Authorization
    const response = await request(app).get(PROTECTED_ROUTE);

    // Verificações
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Token não fornecido/i);
  });

  // -------------------------------------------------------------
  // Cenário 2: Token Inválido (Malformado)
  // -------------------------------------------------------------
  it('deve retornar 401 quando o token enviado for inválido', async () => {
    // Ação: Enviamos uma string qualquer como token
    const response = await request(app)
      .get(PROTECTED_ROUTE)
      .set('Authorization', 'Bearer token-totalmente-invalido');

    // Verificações
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Token inválido/i);
  });

  // -------------------------------------------------------------
  // Cenário 3: Token Expirado
  // -------------------------------------------------------------
  it('deve retornar 401 quando o token estiver expirado', async () => {
    // Preparação: Criamos um token que já expirou no passado (expiresIn: '-1s')
    const tokenExpirado = jwt.sign(
      { id: mockUsuarioBase.id, email: mockUsuarioBase.email, perfil: mockUsuarioBase.perfil },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    // Ação: Enviamos o token expirado
    const response = await request(app)
      .get(PROTECTED_ROUTE)
      .set('Authorization', `Bearer ${tokenExpirado}`);

    // Verificações
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Token expirado/i);
  });

  // -------------------------------------------------------------
  // Cenário de Sucesso (Validação Básica para contraste)
  // -------------------------------------------------------------
  it('deve permitir acesso (200) com token válido e usuário ativo', async () => {
    // Preparação: Mocka a resposta do Prisma para garantir que o usuário existe e está ativo
    prisma.usuario.findUnique.mockResolvedValue({
        id: mockUsuarioBase.id,
        nome: 'Teste',
        email: mockUsuarioBase.email,
        perfil: mockUsuarioBase.perfil,
        status: mockUsuarioBase.status,
        criadoem: new Date(),
    } as any);

    // Criamos um token válido
    const tokenValido = jwt.sign(
      { id: mockUsuarioBase.id, email: mockUsuarioBase.email, perfil: mockUsuarioBase.perfil },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Ação
    const response = await request(app)
      .get(PROTECTED_ROUTE)
      .set('Authorization', `Bearer ${tokenValido}`);

    // Verificações
    expect(response.status).toBe(200);
    // Como a rota /auth/me devolve os dados do usuário, testamos se o id está lá
    expect(response.body.id).toBe(mockUsuarioBase.id);
  });
});
