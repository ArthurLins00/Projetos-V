import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../utils/cache', () => ({ invalidateMetricsCache: jest.fn() }));
import { prisma } from '../../config/__mocks__/prisma';

describe('TC-27 | Erro inesperado não expõe detalhes internos (API)', () => {
  const cidadao = { id: 'cidadao-1', nome: 'Cidadão', email: 'cidadao@example.com', perfil: 'Cidadao', status: 'Ativo' };
  const auth = {
    Authorization: `Bearer ${jwt.sign({ id: cidadao.id, email: cidadao.email, perfil: cidadao.perfil }, JWT_SECRET, { expiresIn: '1h' })}`,
  };
  const nodeEnvOriginal = process.env.NODE_ENV;

  beforeEach(() => {
    prisma.usuario.findUnique.mockResolvedValue(cidadao as any);
    prisma.chamado.findMany.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432 (senha=segredo)'));
    prisma.chamado.count.mockResolvedValue(0);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = nodeEnvOriginal;
    jest.restoreAllMocks();
  });

  it.each(['production', 'test'])('com NODE_ENV=%s a resposta 500 tem mensagem padrão, sem stack nem mensagem interna', async (env) => {
    process.env.NODE_ENV = env;

    const response = await request(app).get('/demands').set(auth);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Erro interno do servidor.');
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toMatch(/ECONNREFUSED|senha|demandService|\.ts:/);
  });

  it('só em desenvolvimento a resposta inclui o stack, para depuração local', async () => {
    process.env.NODE_ENV = 'development';

    const response = await request(app).get('/demands').set(auth);

    expect(response.status).toBe(500);
    expect(response.body.stack).toEqual(expect.any(String));
  });
});
