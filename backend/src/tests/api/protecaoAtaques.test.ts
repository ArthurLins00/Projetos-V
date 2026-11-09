import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../app';
import { LOGIN_LOCK_MS } from '../../services/authService';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));

import { prisma } from '../../config/__mocks__/prisma';

// TC-77: proteção contra força bruta (bloqueio da conta e limite por IP) e cabeçalhos de segurança
describe('Proteção contra ataques', () => {
  const senha = 'senha123';
  const usuario = {
    id: 'uuid-protecao',
    nome: 'Usuária Protegida',
    email: 'protegida@exemplo.com',
    senha: bcrypt.hashSync(senha, 4),
    perfil: 'Cidadao',
    status: 'Ativo',
    doisfatores: false,
    criadoem: new Date(),
    atualizadoem: new Date(),
  };

  const login = (email: string, senhaTentada: string) =>
    request(app).post('/auth/login').send({ email, senha: senhaTentada });

  async function errarSenha(vezes: number, email = usuario.email) {
    const respostas = [];
    for (let i = 0; i < vezes; i += 1) {
      respostas.push(await login(email, 'senha-errada'));
    }
    return respostas;
  }

  beforeEach(() => {
    prisma.usuario.findUnique.mockImplementation(((args: any) =>
      Promise.resolve(args?.where?.email === usuario.email ? usuario : null)) as any);
    prisma.refresh_token.create.mockResolvedValue({} as any);
    delete process.env.RATE_LIMIT_AUTH_MAX;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.RATE_LIMIT_AUTH_MAX;
  });

  it('[TC-77] cinco senhas erradas seguidas bloqueiam a conta, inclusive para a senha certa', async () => {
    const respostas = await errarSenha(5);

    expect(respostas.slice(0, 4).map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(respostas[4].status).toBe(429);
    expect(respostas[4].body.error).toMatch(/bloqueada temporariamente/i);
    expect(respostas[4].body.details.bloqueadoAte).toBeDefined();

    const comSenhaCerta = await login(usuario.email, senha);
    expect(comSenhaCerta.status).toBe(429);
    expect(comSenhaCerta.body).not.toHaveProperty('token');
  });

  it('[TC-77] e-mail inexistente também é bloqueado, sem revelar quais contas existem', async () => {
    const respostas = await errarSenha(5, 'ninguem@exemplo.com');

    expect(respostas.slice(0, 4).every((r) => r.status === 401)).toBe(true);
    expect(respostas[4].status).toBe(429);

    // O bloqueio é por conta: outra conta segue entrando normalmente
    const outra = await login(usuario.email, senha);
    expect(outra.status).toBe(200);
  });

  it('[TC-77] login certo antes da quinta falha zera a contagem', async () => {
    await errarSenha(4);
    expect((await login(usuario.email, senha)).status).toBe(200);

    const depois = await errarSenha(4);
    expect(depois.every((r) => r.status === 401)).toBe(true);
    expect((await login(usuario.email, senha)).status).toBe(200);
  });

  it('[TC-77] o bloqueio termina depois de 15 minutos e vale para o e-mail em maiúsculas', async () => {
    const inicio = Date.now();
    const relogio = jest.spyOn(Date, 'now').mockReturnValue(inicio);

    await errarSenha(5);
    expect((await login(usuario.email.toUpperCase(), senha)).status).toBe(429);

    relogio.mockReturnValue(inicio + LOGIN_LOCK_MS + 1000);
    const liberado = await login(usuario.email, senha);
    expect(liberado.status).toBe(200);
    expect(liberado.body).toHaveProperty('token');
  });

  it('[TC-77] as rotas de autenticação limitam as tentativas por IP com 429 e Retry-After', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '3';

    const permitidas = [];
    for (let i = 0; i < 3; i += 1) {
      permitidas.push(await request(app).post('/auth/forgot-password').send({ email: `x${i}@exemplo.com` }));
    }
    expect(permitidas.every((r) => r.status !== 429)).toBe(true);
    expect(permitidas[0].headers['ratelimit-limit']).toBe('3');

    const excedente = await login(usuario.email, senha);
    expect(excedente.status).toBe(429);
    expect(Number(excedente.headers['retry-after'])).toBeGreaterThan(0);
    expect(excedente.body.error).toMatch(/Muitas tentativas/i);

    // As rotas com sessão não entram nesse limite
    expect((await request(app).get('/health')).status).not.toBe(429);
  });

  it('[TC-77] as respostas trazem os cabeçalhos de segurança e o Swagger tem CSP própria', async () => {
    const health = await request(app).get('/health');

    expect(health.headers['x-content-type-options']).toBe('nosniff');
    expect(health.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(health.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(health.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(health.headers['x-powered-by']).toBeUndefined();

    const docs = await request(app).get('/docs');
    expect(docs.status).toBe(200);
    expect(docs.headers['content-security-policy']).toMatch(/script-src [^;]*https:\/\/unpkg\.com/);
  });
});
