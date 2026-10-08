import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

// POST /ai/chat: autenticação, validação e repasse ao serviço do agente (fetch simulado)
describe('API do Assistente (/ai/chat)', () => {
  const cidadao = { id: 'cidadao-1', nome: 'Cidadão', email: 'cidadao@example.com', perfil: 'Cidadao', status: 'Ativo' };
  const token = jwt.sign({ id: cidadao.id, email: cidadao.email, perfil: cidadao.perfil }, JWT_SECRET, { expiresIn: '1h' });
  const auth = { Authorization: `Bearer ${token}` };

  let fetchSpy: jest.SpyInstance;

  function agentRespondsWith(status: number, body: unknown) {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  }

  beforeEach(() => {
    prisma.usuario.findUnique.mockResolvedValue(cidadao as any);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('exige autenticação (401 sem token)', async () => {
    const response = await request(app).post('/ai/chat').send({ message: 'oi' });

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('valida a mensagem e o sessionId (400)', async () => {
    expect((await request(app).post('/ai/chat').set(auth).send({})).status).toBe(400);
    expect((await request(app).post('/ai/chat').set(auth).send({ message: 'x'.repeat(1001) })).status).toBe(400);
    expect((await request(app).post('/ai/chat').set(auth).send({ message: 'oi', sessionId: '../outro' })).status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('repassa o token do usuário e prende a sessão ao id dele', async () => {
    agentRespondsWith(200, {
      sessionId: 'cidadao-1:sessao-abc',
      reply: 'O chamado DEM-20261005-ABCD está Em Andamento.',
      toolCalls: [
        {
          name: 'consultar_status_chamados',
          ok: true,
          output: {
            chamados: [{ id: 'uuid-1', protocolo: 'DEM-20261005-ABCD', titulo: 'Poste apagado', status: 'Em Andamento', endereco: 'Rua X' }],
          },
        },
      ],
    });

    const response = await request(app)
      .post('/ai/chat')
      .set(auth)
      .send({ message: 'Qual o status do DEM-20261005-ABCD?', sessionId: 'sessao-abc' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sessionId: 'sessao-abc',
      reply: 'O chamado DEM-20261005-ABCD está Em Andamento.',
      chamados: [{ id: 'uuid-1', protocolo: 'DEM-20261005-ABCD', titulo: 'Poste apagado', status: 'Em Andamento' }],
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/chat$/);
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(JSON.parse(init.body)).toEqual({ sessionId: 'cidadao-1:sessao-abc', message: 'Qual o status do DEM-20261005-ABCD?' });
  });

  it('retorna 503 quando o serviço do agente está fora do ar', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    const response = await request(app).post('/ai/chat').set(auth).send({ message: 'Como estão meus chamados?' });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/indisponível/);
  });

  it('retorna 502 quando o agente falha ao consultar o modelo', async () => {
    agentRespondsWith(502, { error: 'Falha ao consultar o modelo de IA.' });

    const response = await request(app).post('/ai/chat').set(auth).send({ message: 'Como estão meus chamados?' });

    expect(response.status).toBe(502);
  });
});
