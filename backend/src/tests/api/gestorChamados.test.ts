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

  it('deve permitir atualizar chamado de qualquer órgão (gestor não é vinculado a órgão)', async () => {
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

    expect(response.status).toBe(200);
    expect(prisma.gestor.findUnique).not.toHaveBeenCalled();
  });

  it('deve permitir que um admin atualize o status de um chamado', async () => {
    const admin = { ...mockUsuario, id: 'uuid-admin', perfil: 'Admin', email: 'admin@teste.com' };
    prisma.usuario.findUnique.mockResolvedValue(admin as any);
    const tokenAdmin = jwt.sign({ id: admin.id, email: admin.email, perfil: admin.perfil }, JWT_SECRET, { expiresIn: '1h' });

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ status: 'Em Andamento' });

    expect(response.status).toBe(200);
  });

  it('deve retornar 403 para cidadão', async () => {
    const cidadao = { ...mockUsuario, id: 'uuid-cidadao', perfil: 'Cidadao', email: 'cidadao@teste.com' };
    prisma.usuario.findUnique.mockResolvedValue(cidadao as any);
    const tokenCidadao = jwt.sign({ id: cidadao.id, email: cidadao.email, perfil: cidadao.perfil }, JWT_SECRET, { expiresIn: '1h' });

    const response = await request(app)
      .put(ROUTE)
      .set('Authorization', `Bearer ${tokenCidadao}`)
      .send({ status: 'Resolvido' });

    expect(response.status).toBe(403);
  });
});

describe('Gestão de chamados (/gestor)', () => {
  const gestor = { id: 'uuid-gestor', nome: 'Gestor Teste', perfil: 'Gestor', email: 'gestor@teste.com', status: 'Ativo' };
  let token: string;

  beforeAll(() => {
    token = jwt.sign({ id: gestor.id, email: gestor.email, perfil: gestor.perfil }, JWT_SECRET, { expiresIn: '1h' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.usuario.findUnique.mockResolvedValue(gestor as any);
  });

  it('GET /gestor/chamados lista chamados de todos os órgãos e aplica o filtro "meus"', async () => {
    prisma.chamado.findMany.mockResolvedValue([]);
    prisma.chamado.count.mockResolvedValue(0);

    const response = await request(app)
      .get('/gestor/chamados')
      .query({ responsavel: 'meus', status: 'Em Análise' })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const where = prisma.chamado.findMany.mock.calls[0]![0]!.where as Record<string, unknown>;
    expect(where).not.toHaveProperty('orgaoid');
    expect(where).toMatchObject({ gestorid: gestor.id, status: 'Em_An_lise' });
  });

  it('PUT /gestor/chamados/:id/aceitar rejeita responsável que não é gestor', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ id: 'c1', status: 'Aberto', gestorid: null } as any);
    prisma.usuario.findUnique.mockImplementation((async ({ where }: any) =>
      where.id === 'uuid-cidadao' ? { perfil: 'Cidadao', status: 'Ativo' } : gestor) as any);

    const response = await request(app)
      .put('/gestor/chamados/c1/aceitar')
      .set('Authorization', `Bearer ${token}`)
      .send({ gestorDestinoId: 'uuid-cidadao' });

    expect(response.status).toBe(400);
    expect(prisma.chamado.update).not.toHaveBeenCalled();
  });

  it('PUT /gestor/chamados/:id/aceitar atribui o chamado a quem aceitou', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ id: 'c1', status: 'Aberto', gestorid: null } as any);
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
    prisma.chamado.update.mockResolvedValue({ id: 'c1', status: 'Em_An_lise', gestorid: gestor.id } as any);

    const response = await request(app)
      .put('/gestor/chamados/c1/aceitar')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(prisma.gestor.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: gestor.id } }));
    expect(prisma.chamado.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gestorid: gestor.id, status: 'Em_An_lise' }) }),
    );
    expect(response.body.chamado.status).toBe('Em Análise');
  });

  it('POST /gestor/chamados/:id/comentarios exige mensagem', async () => {
    const response = await request(app)
      .post('/gestor/chamados/c1/comentarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ mensagem: '   ' });

    expect(response.status).toBe(400);
  });

  it('POST /gestor/chamados/:id/comentarios registra a mensagem no histórico', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ id: 'c1' } as any);
    prisma.timeline_event.create.mockResolvedValue({ id: 'e1', tipo: 'mensagem' } as any);

    const response = await request(app)
      .post('/gestor/chamados/c1/comentarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ mensagem: 'Equipe agendada para amanhã' });

    expect(response.status).toBe(201);
    expect(prisma.timeline_event.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'mensagem', descricao: 'Equipe agendada para amanhã' }) }),
    );
  });
});
