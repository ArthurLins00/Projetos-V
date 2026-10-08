import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

jest.mock('../../utils/cache', () => ({
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
    tokenGestor = jwt.sign(
      { id: mockUsuario.id, email: mockUsuario.email, perfil: mockUsuario.perfil },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.usuario.findUnique.mockResolvedValue(mockUsuario as any);
    
    prisma.gestor.findUnique.mockResolvedValue(mockGestor as any);
    prisma.chamado.findUnique.mockResolvedValue(mockChamado as any);

    prisma.$transaction.mockResolvedValue({
      id: mockChamado.id,
      protocolo: 'PROT-123',
      status: 'Resolvido',
      atualizadoem: new Date(),
    });
  });

  it('deve retornar 200 ao alterar o chamado para um status válido', async () => {
    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        status: 'Resolvido',
        justificativa: 'Problema solucionado pela equipe técnica',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toMatch(/Status atualizado com sucesso/i);
    expect(response.body.chamado.status).toBe('Resolvido');
    
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('deve retornar 400 quando o status enviado não estiver na lista permitida', async () => {
    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        status: 'Finalizado',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Status inválido/i);
  });

  it.each([
    ['Em Análise', 'Em_An_lise'],
    ['Em Andamento', 'Em_Andamento'],
  ])('deve gravar "%s" no banco como %s', async (statusApi, statusBanco) => {
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
    prisma.chamado.update.mockResolvedValue({ id: mockChamado.id, status: statusBanco } as any);

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({ status: statusApi });

    expect(response.status).toBe(200);
    expect(prisma.chamado.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: statusBanco }) }),
    );
  });

  it('deve retornar 404 ao tentar atualizar um chamado que não existe', async () => {
    prisma.chamado.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        status: 'Resolvido',
      });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Chamado não encontrado/i);
  });

  it('deve retornar 403 ao tentar atualizar chamado de outro órgão', async () => {
    prisma.chamado.findUnique.mockResolvedValue({
      ...mockChamado,
      orgaoid: 'orgao-2',
    } as any);

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenGestor}`)
      .send({
        status: 'Aguardando',
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/Você não tem permissão para atualizar este chamado/i);
  });
});
