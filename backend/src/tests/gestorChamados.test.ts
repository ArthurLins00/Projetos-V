import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../app';
import { JWT_SECRET } from '../config/env';

// Mocks do Prisma e do Cache
jest.mock('../config/prisma', () => require('../config/__mocks__/prisma'));
import { prisma } from '../config/__mocks__/prisma';

// Importante: mockar o invalidateMetricsCache para não tentar conectar ao Redis
jest.mock('../utils/cache', () => ({
  invalidateMetricsCache: jest.fn(),
}));

describe('PUT /gestor/chamados/:id/status', () => {
  const ROUTE = '/gestor/chamados/uuid-chamado/status';
  let tokenGestor: string;

  const mockGestor = {
    id: 'uuid-gestor',
    orgaoid: 'orgao-1',
  };

  const mockUsuario = {
    id: 'uuid-gestor',
    nome: 'Gestor Teste',
    perfil: 'Gestor',
    email: 'gestor@teste.com',
    status: 'Ativo',
  };

  const mockChamado = {
    id: 'uuid-chamado',
    orgaoid: 'orgao-1',
    status: 'Aberto',
    gestorid: 'uuid-gestor',
  };

  beforeAll(() => {
    // Geramos um token válido de Gestor para usar nas requisições
    tokenGestor = jwt.sign(
      { id: mockUsuario.id, email: mockUsuario.email, perfil: mockUsuario.perfil },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock base para autenticação (authMiddleware valida o usuário)
    prisma.usuario.findUnique.mockResolvedValue(mockUsuario as any);
    
    // Mocks padrão para o controller
    // A implementação tem duas chamadas sequenciais para findUnique ou usa findUnique dentro do controller
    prisma.gestor.findUnique.mockResolvedValue(mockGestor as any);
    prisma.chamado.findUnique.mockResolvedValue(mockChamado as any);

    // Mock do transaction (apenas retorna um objeto indicando sucesso)
    prisma.$transaction.mockResolvedValue({
      id: mockChamado.id,
      protocolo: 'PROT-123',
      status: 'Resolvido',
      atualizadoem: new Date(),
    });
  });

  // -------------------------------------------------------------
  // Cenário 1: Caminho Feliz (Status Válido)
  // -------------------------------------------------------------
  it('deve retornar 200 ao alterar o chamado para um status válido', async () => {
    // Ação: Gestor atualiza para "Resolvido"
    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        status: 'Resolvido',
        justificativa: 'Problema solucionado pela equipe técnica',
      });

    // Verificações
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toMatch(/Status atualizado com sucesso/i);
    expect(response.body.chamado.status).toBe('Resolvido');
    
    // Garante que a transaction foi chamada
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  // -------------------------------------------------------------
  // Cenário 2: Erro 400 (Status Inválido)
  // -------------------------------------------------------------
  it('deve retornar 400 quando o status enviado não estiver na lista permitida', async () => {
    // Ação: Envia um status que não existe nas regras de negócio (ex: "Finalizado" em vez de "Fechado")
    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        status: 'Finalizado',
      });

    // Verificações
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Status inválido/i);
  });

  // -------------------------------------------------------------
  // Cenário 3: Erro 404 (Chamado Inexistente)
  // -------------------------------------------------------------
  it('deve retornar 404 ao tentar atualizar um chamado que não existe', async () => {
    // Preparação: Ao buscar o chamado no Prisma, retornamos nulo
    // Como a ordem importa (o middleware e o controller fazem chamadas), precisamos cuidar disso.
    // Para simplificar, o controller busca o chamado após o gestor.
    prisma.chamado.findUnique.mockResolvedValue(null);

    // Ação
    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        status: 'Resolvido',
      });

    // Verificações
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Chamado não encontrado/i);
  });

  // -------------------------------------------------------------
  // Cenário Adicional: Erro 403 (Gestor de Outro Órgão)
  // -------------------------------------------------------------
  it('deve retornar 403 ao tentar atualizar chamado de outro órgão', async () => {
    // Preparação: Mockamos o chamado dizendo que pertence ao 'orgao-2', mas o Gestor é do 'orgao-1'
    prisma.chamado.findUnique.mockResolvedValue({
      ...mockChamado,
      orgaoid: 'orgao-2',
    } as any);

    // Ação
    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        status: 'Aguardando',
      });

    // Verificações
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Você não tem permissão para atualizar este chamado/i);
  });
});
