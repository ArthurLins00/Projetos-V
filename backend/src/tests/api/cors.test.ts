import request from 'supertest';
import type { Express } from 'express';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));

const PAINEL = 'https://painel.fiscalize.gov.br';
const INTRUSO = 'https://site-malicioso.example.com';

// A whitelist é lida quando o app é montado, então precisa estar no ambiente antes do require
process.env.ALLOWED_ORIGINS = PAINEL;
const { app } = require('../../app') as { app: Express };

describe('HU-09 | CORS para o app nativo e whitelist do painel (API)', () => {
  afterAll(() => {
    delete process.env.ALLOWED_ORIGINS;
  });

  it('TC-36: requisição do app nativo (sem header Origin) é processada normalmente', async () => {
    const response = await request(app).get('/docs.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBeDefined();
  });

  it('TC-37: Origin da whitelist é processada e recebe Access-Control-Allow-Origin', async () => {
    const response = await request(app).get('/docs.json').set('Origin', PAINEL);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(PAINEL);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('TC-37: preflight da Origin da whitelist libera método e headers', async () => {
    const response = await request(app)
      .options('/demands')
      .set('Origin', PAINEL)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Authorization, Content-Type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(PAINEL);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('TC-38: Origin fora da whitelist não recebe Access-Control-Allow-Origin (o navegador bloqueia)', async () => {
    const simples = await request(app).get('/docs.json').set('Origin', INTRUSO);
    expect(simples.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await request(app)
      .options('/demands')
      .set('Origin', INTRUSO)
      .set('Access-Control-Request-Method', 'DELETE');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    expect(preflight.headers['access-control-allow-methods']).toBeUndefined();
  });
});
