import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app';

// Injeta o mock explicitamente no módulo prisma

jest.mock('../config/prisma', () => require('../config/__mocks__/prisma'));

import { prisma } from '../config/__mocks__/prisma';

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
    // Reseta o mock antes de cada teste
    jest.clearAllMocks();
  });

  // Cenário 1: Caminho Feliz (200 + credenciais corretas)
  it('deve retornar 200 e um token/cookie quando as credenciais forem válidas', async () => {
    // Preparação (Arrange): Mockamos o Prisma para retornar um usuário válido
    prisma.usuario.findUnique.mockResolvedValue(mockUsuarioBase as any);

    // Ação (Act): Fazemos a requisição com a senha correta
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: mockUsuarioBase.email,
        senha: senhaPlana,
      });

    // Verificações (Assert)
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.email).toBe(mockUsuarioBase.email);

    // O PDF exige validação do cookie (200 + cookie)
    expect(response.headers['set-cookie']).toBeDefined();
  });

  // Cenário 2: Caminho Negativo (401 + senha incorreta)
  it('deve retornar 401 quando a senha estiver incorreta', async () => {
    // Preparação (Arrange): Retorna o usuário válido, mas usaremos uma senha errada na request
    prisma.usuario.findUnique.mockResolvedValue(mockUsuarioBase as any);

    // Ação (Act)
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: mockUsuarioBase.email,
        senha: 'senha-errada', // Senha incorreta
      });

    // Verificações (Assert)
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Credenciais inválidas/i);
  });

  // Cenário 3: Caminho Negativo (401 + e-mail inexistente)
  it('deve retornar 401 quando o e-mail não existir', async () => {
    // Preparação (Arrange): Mockamos o Prisma para retornar nulo (usuário não encontrado)
    prisma.usuario.findUnique.mockResolvedValue(null);

    // Ação (Act)
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'inexistente@exemplo.com',
        senha: senhaPlana,
      });

    // Verificações (Assert): Comportamento idêntico ao erro de senha para evitar vazamento de contas
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Credenciais inválidas/i);
  });

  // Cenário Adicional: Usuário inativo
  it('deve retornar 403 se o usuário estiver com status inativo', async () => {
    // Preparação (Arrange): Mock de um usuário inativo
    const usuarioInativo = { ...mockUsuarioBase, status: 'Inativo' };
    prisma.usuario.findUnique.mockResolvedValue(usuarioInativo as any);

    // Ação (Act)
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: mockUsuarioBase.email,
        senha: senhaPlana,
      });

    // Verificações (Assert): Acesso negado, mas com alerta de contato ao administrador
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/Usuário inativo/i);
  });
}); 