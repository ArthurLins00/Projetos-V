import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../utils/cache', () => ({ invalidateMetricsCache: jest.fn() }));
jest.mock('../../services/notificationService', () => ({ notificationService: { notifyDemandUpdate: jest.fn() } }));
import { prisma } from '../../config/__mocks__/prisma';
import { notificationService } from '../../services/notificationService';

const gestor = { id: 'uuid-gestor', nome: 'Gestor Teste', email: 'gestor@teste.com', perfil: 'Gestor', status: 'Ativo' };
const auth = { Authorization: `Bearer ${jwt.sign({ id: gestor.id, email: gestor.email, perfil: gestor.perfil }, JWT_SECRET, { expiresIn: '1h' })}` };
const notify = notificationService.notifyDemandUpdate as jest.Mock;

const chamado = {
  id: 'c1',
  protocolo: 'DEM-20260101-ABCD',
  subcategoria: 'Buraco',
  descricao: 'Buraco grande',
  status: 'Aberto',
  prioridade: 'Alta',
  endereco: 'Rua A, 1',
  cidade: 'Recife',
  uf: 'PE',
  zona: 'Urbana',
  latitude: -8,
  longitude: -34,
  slahoras: 48,
  sladeadline: new Date('2026-01-03T00:00:00Z'),
  slajustification: null,
  resolutionnote: null,
  criadoem: new Date('2026-01-01T00:00:00Z'),
  atualizadoem: new Date('2026-01-01T00:00:00Z'),
  gestorid: null,
  orgaoid: 'EMLURB',
  categoria: { id: 1, nome: 'Infraestrutura' },
  orgao: { id: 'EMLURB', nome: 'EMLURB', sigla: 'EMLURB' },
  cidadao: null,
  gestor: null,
  chamado_foto: [],
  timeline_event: [],
};

beforeEach(() => {
  prisma.usuario.findUnique.mockImplementation((async ({ where }: any) => (where.id === gestor.id ? gestor : null)) as any);
  prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
});

// TC-71: painel, fila e detalhe do gestor
describe('Painel e fila do gestor (/gestor)', () => {
  it('GET /gestor/dashboard conta os chamados por status, atrasados e do próprio gestor', async () => {
    prisma.chamado.count.mockResolvedValue(2);

    const response = await request(app).get('/gestor/dashboard').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.gestor).toMatchObject({ id: gestor.id });
    expect(response.body.chamados).toEqual({ total: 2, abertos: 2, emAnalise: 2, emAndamento: 2, aguardando: 2, resolvidos: 2, atrasados: 2, meus: 2 });
  });

  it('GET /gestor/dashboard retorna 404 se o usuário sumiu entre a sessão e a consulta', async () => {
    prisma.usuario.findUnique.mockResolvedValueOnce(gestor as any).mockResolvedValueOnce(null);

    const response = await request(app).get('/gestor/dashboard').set(auth);

    expect(response.status).toBe(404);
  });

  it('GET /gestor/chamados com "Atrasados" filtra prazo vencido e não encerrado; "sem" filtra sem responsável', async () => {
    prisma.chamado.findMany.mockResolvedValue([{ ...chamado, gestorid: 'g2', gestor: { usuario: { nome: 'Outro' } }, chamado_foto: [{ url: '/f.jpg' }] }] as any);
    prisma.chamado.count.mockResolvedValue(1);

    const response = await request(app).get('/gestor/chamados').query({ status: 'Atrasados', responsavel: 'sem', limit: 5, offset: 5 }).set(auth);

    expect(response.status).toBe(200);
    const where = prisma.chamado.findMany.mock.calls[0]![0]!.where as any;
    expect(where).toMatchObject({ status: { notIn: ['Resolvido', 'Fechado'] }, gestorid: null });
    expect(where.sladeadline.lt).toBeInstanceOf(Date);
    expect(response.body.chamados[0]).toMatchObject({ cidadaoNome: '', responsavel: { id: 'g2', nome: 'Outro' }, photoUrl: '/f.jpg' });
    expect(response.body.pagina).toEqual({ total: 1, limit: 5, offset: 5 });
  });

  it('GET /gestor/chamados com "Todos" não filtra status e recusa status desconhecido (400)', async () => {
    prisma.chamado.findMany.mockResolvedValue([]);
    prisma.chamado.count.mockResolvedValue(0);

    const todos = await request(app).get('/gestor/chamados?status=Todos').set(auth);
    const invalido = await request(app).get('/gestor/chamados?status=Arquivado').set(auth);

    expect(todos.status).toBe(200);
    expect(prisma.chamado.findMany.mock.calls[0]![0]!.where).not.toHaveProperty('status');
    expect(invalido.status).toBe(400);
  });

  it('GET /gestor/chamados/:id devolve o detalhe com status de exibição', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ ...chamado, status: 'Em_An_lise' } as any);

    const response = await request(app).get('/gestor/chamados/c1').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.chamado).toMatchObject({ id: 'c1', status: 'Em Análise', cidadao: { nome: '', email: '' }, responsavel: null });
  });

  it('GET /gestor/equipe lista gestores e admins ativos', async () => {
    prisma.usuario.findMany.mockResolvedValue([{ id: gestor.id, nome: gestor.nome }] as any);

    const response = await request(app).get('/gestor/equipe').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.equipe).toHaveLength(1);
    expect(prisma.usuario.findMany.mock.calls[0]![0]!.where).toEqual({ perfil: { in: ['Gestor', 'Admin'] }, status: 'Ativo' });
  });

  it('GET /gestor/chamados/:id retorna 404 para chamado inexistente', async () => {
    prisma.chamado.findUnique.mockResolvedValue(null);

    const response = await request(app).get('/gestor/chamados/nao-existe').set(auth);

    expect(response.status).toBe(404);
  });
});

// TC-72: mudança de status, aceite, comentário e transferência pelo gestor
describe('Atendimento do chamado pelo gestor', () => {
  beforeEach(() => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);
    prisma.chamado.update.mockResolvedValue({ id: 'c1', protocolo: chamado.protocolo, status: 'Resolvido', atualizadoem: new Date(), gestorid: gestor.id } as any);
  });

  it('concluir com nota de resolução grava a nota, registra a conclusão e notifica o cidadão', async () => {
    const response = await request(app).put('/gestor/chamados/c1/status').set(auth).send({ status: 'Resolvido', resolutionNote: 'Buraco tapado' });

    expect(response.status).toBe(200);
    expect(prisma.chamado.update.mock.calls[0]![0]!.data).toMatchObject({ status: 'Resolvido', resolutionnote: 'Buraco tapado' });
    expect(prisma.timeline_event.create.mock.calls[0]![0]!.data).toMatchObject({ tipo: 'conclusao', descricao: 'Chamado concluído. Buraco tapado' });
    expect(notify).toHaveBeenCalledWith('c1', expect.objectContaining({ titulo: 'Chamado resolvido', tipo: 'chamado_concluido', mensagem: expect.stringContaining('Buraco tapado') }));
  });

  it('mudar status sem justificativa descreve a transição no histórico', async () => {
    prisma.chamado.update.mockResolvedValue({ id: 'c1', status: 'Em_Andamento' } as any);

    await request(app).put('/gestor/chamados/c1/status').set(auth).send({ status: 'Em Andamento' });

    expect(prisma.timeline_event.create.mock.calls[0]![0]!.data).toMatchObject({ tipo: 'status', descricao: 'Status alterado de Aberto para Em Andamento' });
    expect(notify).toHaveBeenCalledWith('c1', expect.objectContaining({ tipo: 'status_atualizado' }));
  });

  it('exige o status (400)', async () => {
    const response = await request(app).put('/gestor/chamados/c1/status').set(auth).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/obrigatório/);
  });

  it('aceitar indicando outro gestor ativo designa o responsável e notifica, pois o chamado estava Aberto', async () => {
    const destino = { id: 'uuid-g2', nome: 'Gestora Dois', perfil: 'Gestor', status: 'Ativo' };
    prisma.usuario.findUnique.mockImplementation((async ({ where }: any) => ({ [gestor.id]: gestor, [destino.id]: destino } as any)[where.id] ?? null) as any);
    prisma.chamado.update.mockResolvedValue({ id: 'c1', status: 'Em_An_lise', gestorid: destino.id } as any);

    const response = await request(app).put('/gestor/chamados/c1/aceitar').set(auth).send({ gestorDestinoId: destino.id });

    expect(response.status).toBe(200);
    expect(response.body.chamado.status).toBe('Em Análise');
    expect(prisma.timeline_event.create.mock.calls[0]![0]!.data).toMatchObject({
      titulo: 'Responsável designado',
      descricao: 'Chamado atribuído a Gestora Dois por Gestor Teste.',
    });
    expect(notify).toHaveBeenCalledWith('c1', expect.objectContaining({ tipo: 'equipe_designada' }));
  });

  it('aceitar chamado que já está em andamento mantém o status e não notifica de novo', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ ...chamado, status: 'Em_Andamento' } as any);
    prisma.chamado.update.mockResolvedValue({ id: 'c1', status: 'Em_Andamento', gestorid: gestor.id } as any);

    const response = await request(app).put('/gestor/chamados/c1/aceitar').set(auth).send({});

    expect(response.status).toBe(200);
    expect(prisma.chamado.update.mock.calls[0]![0]!.data).toMatchObject({ status: 'Em_Andamento', gestorid: gestor.id });
    expect(notify).not.toHaveBeenCalled();
  });

  it('aceitar chamado inexistente retorna 404', async () => {
    prisma.chamado.findUnique.mockResolvedValue(null);

    const response = await request(app).put('/gestor/chamados/c1/aceitar').set(auth).send({});

    expect(response.status).toBe(404);
  });

  it('comentário acima de 1000 caracteres (400) e em chamado inexistente (404)', async () => {
    const longo = await request(app).post('/gestor/chamados/c1/comentarios').set(auth).send({ mensagem: 'x'.repeat(1001) });
    prisma.chamado.findUnique.mockResolvedValue(null);
    const inexistente = await request(app).post('/gestor/chamados/c1/comentarios').set(auth).send({ mensagem: 'Equipe a caminho' });

    expect(longo.status).toBe(400);
    expect(inexistente.status).toBe(404);
  });

  describe('PUT /gestor/chamados/:id/transferir', () => {
    it('transfere para outro órgão e registra o motivo no histórico', async () => {
      prisma.orgao.findUnique.mockResolvedValue({ id: 'COMPESA', nome: 'Compesa' } as any);

      const response = await request(app).put('/gestor/chamados/c1/transferir').set(auth).send({ orgaoId: 'COMPESA', justificativa: 'Vazamento de água' });

      expect(response.status).toBe(200);
      expect(prisma.chamado.update.mock.calls[0]![0]!.data).toMatchObject({ orgaoid: 'COMPESA' });
      expect(prisma.timeline_event.create.mock.calls[0]![0]!.data).toMatchObject({
        tipo: 'transferencia',
        descricao: 'Encaminhado para Compesa. Motivo: Vazamento de água',
      });
    });

    it.each([
      ['sem órgão ou justificativa', { orgaoId: 'COMPESA' }, () => undefined, 400],
      ['chamado inexistente', { orgaoId: 'COMPESA', justificativa: 'x' }, () => prisma.chamado.findUnique.mockResolvedValue(null), 404],
      ['órgão inexistente', { orgaoId: 'XYZ', justificativa: 'x' }, () => prisma.orgao.findUnique.mockResolvedValue(null), 400],
      ['mesmo órgão', { orgaoId: 'EMLURB', justificativa: 'x' }, () => prisma.orgao.findUnique.mockResolvedValue({ id: 'EMLURB' } as any), 400],
    ])('recusa %s', async (_caso, body, arrange, status) => {
      arrange();

      const response = await request(app).put('/gestor/chamados/c1/transferir').set(auth).send(body);

      expect(response.status).toBe(status);
      expect(prisma.chamado.update).not.toHaveBeenCalled();
    });
  });
});
