import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../utils/cache', () => ({ invalidateMetricsCache: jest.fn() }));
import { prisma } from '../../config/__mocks__/prisma';

describe('API de Demandas (/demands)', () => {
  const cidadao = { id: 'cidadao-1', nome: 'Cidadão', email: 'cidadao@example.com', perfil: 'Cidadao', status: 'Ativo' };
  const tokenCidadao = jwt.sign({ id: cidadao.id, email: cidadao.email, perfil: cidadao.perfil }, JWT_SECRET, {
    expiresIn: '1h',
  });

  const chamado = {
    id: 'chamado-1',
    protocolo: 'DEM-20260101-ABCD',
    subcategoria: 'Poste apagado',
    descricao: 'Rua escura à noite',
    status: 'Aberto',
    endereco: 'Rua das Flores, 123',
    latitude: -8.05,
    longitude: -34.9,
    fotourl: null,
    cidadaoid: cidadao.id,
    gestorid: null,
    categoria: { id: 3, nome: 'Iluminação Pública' },
    cidadao: { usuario: { id: cidadao.id, nome: cidadao.nome, email: cidadao.email } },
    timeline_event: [],
    criadoem: new Date('2026-01-01T10:00:00Z'),
    atualizadoem: new Date('2026-01-01T10:00:00Z'),
  };

  const auth = { Authorization: `Bearer ${tokenCidadao}` };

  beforeEach(() => {
    prisma.usuario.findUnique.mockResolvedValue(cidadao as any);
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
  });

  it('exige autenticação (401 sem token)', async () => {
    const response = await request(app).get('/demands');

    expect(response.status).toBe(401);
  });

  it('GET /demands lista com paginação e repassa a pesquisa para o banco', async () => {
    prisma.chamado.findMany.mockResolvedValue([chamado] as any);
    prisma.chamado.count.mockResolvedValue(1);

    const response = await request(app).get('/demands?busca=poste&page=1&limit=10').set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(response.body.data[0]).toMatchObject({
      id: 'chamado-1',
      title: 'Poste apagado',
      category: { id: 3, nome: 'Iluminação Pública' },
      photoUrl: null,
    });
    const { where } = prisma.chamado.findMany.mock.calls[0][0] as any;
    expect(where.OR).toHaveLength(4);
  });

  it('GET /demands ignora pesquisa vazia', async () => {
    prisma.chamado.findMany.mockResolvedValue([]);
    prisma.chamado.count.mockResolvedValue(0);

    await request(app).get('/demands?busca=%20%20').set(auth);

    const { where } = prisma.chamado.findMany.mock.calls[0][0] as any;
    expect(where.OR).toBeUndefined();
  });

  it('GET /demands/:id retorna a demanda com histórico', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);

    const response = await request(app).get('/demands/chamado-1').set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'chamado-1', protocolo: 'DEM-20260101-ABCD', logs: [] });
  });

  it('GET /demands/:id bloqueia acesso à demanda de outro cidadão (403)', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ ...chamado, cidadaoid: 'outro-cidadao' } as any);

    const response = await request(app).get('/demands/chamado-1').set(auth);

    expect(response.status).toBe(403);
  });

  it('POST /demands valida campos obrigatórios (400)', async () => {
    const response = await request(app).post('/demands').set(auth).send({ title: 'Sem descrição' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Campos obrigatórios/i);
    expect(prisma.chamado.create).not.toHaveBeenCalled();
  });

  it('POST /demands rejeita categoria inexistente ou inativa (400)', async () => {
    prisma.categoria.findUnique.mockResolvedValue(null);

    const response = await request(app).post('/demands').set(auth).send({
      title: 'Poste apagado',
      description: 'Rua escura',
      category_id: 999,
      location: 'Rua A, 1',
      latitude: -8.05,
      longitude: -34.9,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Categoria inválida/i);
  });

  it('DELETE /demands/:id: cidadão remove a própria demanda (204)', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);

    const response = await request(app).delete('/demands/chamado-1').set(auth);

    expect(response.status).toBe(204);
    expect(prisma.chamado.update).toHaveBeenCalledWith({ where: { id: 'chamado-1' }, data: { status: 'Fechado' } });
  });

  it('DELETE /demands/:id: cidadão não remove demanda de outra pessoa (403)', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ ...chamado, cidadaoid: 'outro-cidadao' } as any);

    const response = await request(app).delete('/demands/chamado-1').set(auth);

    expect(response.status).toBe(403);
    expect(prisma.chamado.update).not.toHaveBeenCalled();
  });

  it('PUT /demands/:id/photo exige o campo photo (400)', async () => {
    const response = await request(app).put('/demands/chamado-1/photo').set(auth).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/photo/i);
  });

  it('PUT /demands/:id/photo recusa arquivo que não é imagem (400)', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);

    const response = await request(app)
      .put('/demands/chamado-1/photo')
      .set(auth)
      .send({ photo: Buffer.from('texto qualquer').toString('base64') });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Formato de imagem inválido/i);
  });

  it('PUT /demands/:id/photo aceita corpo maior que o limite padrão de 100kb', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);
    const grande = Buffer.alloc(300 * 1024, 1).toString('base64');

    const response = await request(app).put('/demands/chamado-1/photo').set(auth).send({ photo: grande });

    expect(response.status).toBe(400);
  });

  it('GET /categories lista as categorias ativas', async () => {
    prisma.categoria.findMany.mockResolvedValue([{ id: 1, nome: 'Infraestrutura', descricao: null }] as any);

    const response = await request(app).get('/categories').set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 1, nome: 'Infraestrutura', descricao: null }]);
  });
});
