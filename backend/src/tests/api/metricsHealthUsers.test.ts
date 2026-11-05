import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../config/redis', () => ({ getRedisClient: jest.fn(() => null), isRedisAvailable: jest.fn() }));
import { prisma } from '../../config/__mocks__/prisma';
import { isRedisAvailable } from '../../config/redis';

const users = {
  Gestor: { id: 'uuid-gestor', nome: 'Gestor', email: 'gestor@teste.com', perfil: 'Gestor', status: 'Ativo' },
  Cidadao: { id: 'uuid-cidadao', nome: 'Cidadão', email: 'cidadao@teste.com', perfil: 'Cidadao', status: 'Ativo' },
  Admin: { id: 'uuid-admin', nome: 'Admin', email: 'admin@teste.com', perfil: 'Admin', status: 'Ativo' },
};
const authAs = (perfil: keyof typeof users) => {
  const u = users[perfil];
  return { Authorization: `Bearer ${jwt.sign({ id: u.id, email: u.email, perfil: u.perfil }, JWT_SECRET, { expiresIn: '1h' })}` };
};

beforeEach(() => {
  prisma.usuario.findUnique.mockImplementation((async ({ where }: any) =>
    Object.values(users).find((u) => u.id === where.id) ?? null) as any);
});

// TC-67: rotas de métricas do painel do gestor
describe('Métricas (/metrics)', () => {
  it('GET /metrics/total-demands devolve os totais por status no escopo da plataforma', async () => {
    prisma.chamado.count.mockResolvedValue(5);

    const response = await request(app).get('/metrics/total-demands').set(authAs('Gestor'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ escopo: 'plataforma', total: 5, aberta: 5, em_andamento: 5, resolvida: 5, encerrada: 5 });
  });

  it('GET /metrics/demands-by-category devolve a distribuição', async () => {
    prisma.categoria.findMany.mockResolvedValue([{ id: 1, nome: 'Infraestrutura' }] as any);
    (prisma.chamado.groupBy as jest.Mock).mockResolvedValue([{ categoriaid: 1, _count: { id: 3 } }]);

    const response = await request(app).get('/metrics/demands-by-category').set(authAs('Admin'));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([{ category: 'Infraestrutura', total: 3, percentage: 100 }]);
  });

  it('GET /metrics/average-response-time devolve a média em horas', async () => {
    prisma.chamado.findMany.mockResolvedValue([]);

    const response = await request(app).get('/metrics/average-response-time').set(authAs('Gestor'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ escopo: 'plataforma', total_demandas_consideradas: 0, media_horas: null });
  });

  it('cidadão não acessa as métricas (403)', async () => {
    const response = await request(app).get('/metrics/total-demands').set(authAs('Cidadao'));

    expect(response.status).toBe(403);
  });

  it.each(['/metrics/total-demands', '/metrics/demands-by-category', '/metrics/average-response-time'])(
    'falha do banco em %s vira 500',
    async (rota) => {
      prisma.chamado.count.mockRejectedValue(new Error('db'));
      prisma.categoria.findMany.mockRejectedValue(new Error('db'));
      prisma.chamado.findMany.mockRejectedValue(new Error('db'));

      const response = await request(app).get(rota).set(authAs('Gestor'));

      expect(response.status).toBe(500);
    }
  );
});

// TC-68: health check usado pelo CI e pelo monitoramento
describe('GET /health', () => {
  it('banco no ar: 200 ok, com o Redis marcado como indisponível quando não responde', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);
    (isRedisAvailable as jest.Mock).mockResolvedValue(false);

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'connected', redis: 'unavailable' });
  });

  it('banco fora do ar: 503 degraded', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('down'));
    (isRedisAvailable as jest.Mock).mockResolvedValue(true);

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ status: 'degraded', database: 'disconnected', redis: 'connected' });
  });
});

// TC-69: consulta de usuários e de categorias
describe('Usuários (/users) e categorias (/categories)', () => {
  const uuid = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

  it('GET /users lista com paginação e nomes de campo da API', async () => {
    prisma.usuario.findMany.mockResolvedValue([{ id: uuid, nome: 'Maria', email: 'm@t.com', perfil: 'Cidadao', criadoem: new Date() }] as any);
    prisma.usuario.count.mockResolvedValue(21);

    const response = await request(app).get('/users?page=2&limit=10').set(authAs('Admin'));

    expect(response.status).toBe(200);
    expect(response.body.usuarios[0]).toMatchObject({ id: uuid, name: 'Maria', role: 'Cidadao' });
    expect(response.body.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(prisma.usuario.findMany.mock.calls[0]![0]).toMatchObject({ skip: 10, take: 10 });
  });

  it('GET /users/:id devolve o usuário', async () => {
    prisma.usuario.findUnique.mockImplementation((async ({ where }: any) =>
      where.id === uuid ? { id: uuid, nome: 'Maria' } : Object.values(users).find((u) => u.id === where.id) ?? null) as any);

    const response = await request(app).get(`/users/${uuid}`).set(authAs('Admin'));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: uuid, nome: 'Maria' });
  });

  it('GET /users/:id recusa ID fora do formato UUID (400) e informa inexistente (404)', async () => {
    const invalido = await request(app).get('/users/123').set(authAs('Admin'));
    const inexistente = await request(app).get(`/users/${uuid}`).set(authAs('Admin'));

    expect(invalido.status).toBe(400);
    expect(inexistente.status).toBe(404);
  });

  it('GET /users repassa erro do banco (500)', async () => {
    prisma.usuario.findMany.mockRejectedValue(new Error('db'));

    const response = await request(app).get('/users').set(authAs('Admin'));

    expect(response.status).toBe(500);
  });

  it('GET /categories/:id devolve a categoria ativa', async () => {
    prisma.categoria.findUnique.mockResolvedValue({ id: 3, nome: 'Iluminação', descricao: null, ativo: true } as any);

    const response = await request(app).get('/categories/3').set(authAs('Cidadao'));

    expect(response.status).toBe(200);
    expect(response.body.nome).toBe('Iluminação');
  });

  it('GET /categories/:id: ID não numérico (400), inexistente ou inativa (404)', async () => {
    prisma.categoria.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 4, ativo: false } as any);

    const invalido = await request(app).get('/categories/abc').set(authAs('Cidadao'));
    const inexistente = await request(app).get('/categories/9').set(authAs('Cidadao'));
    const inativa = await request(app).get('/categories/4').set(authAs('Cidadao'));

    expect(invalido.status).toBe(400);
    expect(inexistente.status).toBe(404);
    expect(inativa.status).toBe(404);
  });

  it('GET /categories repassa erro do banco (500)', async () => {
    prisma.categoria.findMany.mockRejectedValue(new Error('db'));

    const response = await request(app).get('/categories').set(authAs('Cidadao'));

    expect(response.status).toBe(500);
  });
});
