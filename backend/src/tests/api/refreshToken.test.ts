import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { app } from '../../app';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

type RefreshRow = {
  id: string;
  usuarioid: string;
  tokenhash: string;
  expiraem: Date;
  revogadoem: Date | null;
};

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('HU-01 / HU-02 | Sessão com access token e refresh token (API)', () => {
  const senha = 'senhaSegura123';
  const usuario = {
    id: 'usuario-refresh',
    nome: 'Usuário Refresh',
    email: 'usuario.refresh@example.com',
    senha: bcrypt.hashSync(senha, 10),
    perfil: 'Cidadao',
    status: 'Ativo',
    criadoem: new Date(),
  };

  // Tabela refresh_token em memória: o comportamento de rotação depende do estado entre as chamadas
  let tabela: RefreshRow[];

  const matches = (row: RefreshRow, where: any) =>
    (where.id === undefined || row.id === where.id) &&
    (where.tokenhash === undefined || row.tokenhash === where.tokenhash) &&
    (where.usuarioid === undefined || row.usuarioid === where.usuarioid) &&
    (where.revogadoem !== null || row.revogadoem === null);

  const linhaDo = (refreshToken: string) => tabela.find((row) => row.tokenhash === sha256(refreshToken));

  async function login() {
    const response = await request(app).post('/auth/login').send({ email: usuario.email, senha });
    expect(response.status).toBe(200);
    return response.body as { token: string; refreshToken: string };
  }

  beforeEach(() => {
    tabela = [];
    let seq = 0;

    prisma.usuario.findUnique.mockResolvedValue(usuario as any);
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

    prisma.refresh_token.create.mockImplementation((async ({ data }: any) => {
      const row = { id: `rt-${++seq}`, revogadoem: null, ...data };
      tabela.push(row);
      return row;
    }) as any);

    prisma.refresh_token.findUnique.mockImplementation((async ({ where }: any) => {
      const row = tabela.find((r) => r.tokenhash === where.tokenhash);
      return row ? { ...row, usuario } : null;
    }) as any);

    prisma.refresh_token.updateMany.mockImplementation((async ({ where, data }: any) => {
      const alvo = tabela.filter((row) => matches(row, where));
      alvo.forEach((row) => Object.assign(row, data));
      return { count: alvo.length };
    }) as any);
  });

  it('TC-01: login devolve access token de curta duração e refresh token de longa duração', async () => {
    const { token, refreshToken } = await login();

    const payload = jwt.decode(token) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(15 * 60);

    expect(refreshToken).toEqual(expect.any(String));
    const row = linhaDo(refreshToken)!;
    expect(row).toBeDefined();
    expect(row.tokenhash).not.toContain(refreshToken);
    const dias = (row.expiraem.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(dias).toBeGreaterThan(29.9);
    expect(dias).toBeLessThanOrEqual(30);
  });

  it('TC-03: refresh válido devolve um novo par e o novo access token é aceito em rota protegida', async () => {
    const sessao = await login();

    const response = await request(app).post('/auth/refresh').send({ refreshToken: sessao.refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.refreshToken).not.toBe(sessao.refreshToken);
    expect(linhaDo(sessao.refreshToken)!.revogadoem).toBeInstanceOf(Date);
    expect(response.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringMatching(/^token=/)]));

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${response.body.token}`);
    expect(me.status).toBe(200);
  });

  it('TC-04: refresh expirado retorna 401 (1 s antes do vencimento ainda é aceito)', async () => {
    const quaseVencendo = await login();
    linhaDo(quaseVencendo.refreshToken)!.expiraem = new Date(Date.now() + 1000);

    const aceito = await request(app).post('/auth/refresh').send({ refreshToken: quaseVencendo.refreshToken });
    expect(aceito.status).toBe(200);

    const vencido = await login();
    linhaDo(vencido.refreshToken)!.expiraem = new Date(Date.now() - 1000);

    const recusado = await request(app).post('/auth/refresh').send({ refreshToken: vencido.refreshToken });
    expect(recusado.status).toBe(401);
    expect(recusado.body.error).toMatch(/Faça login novamente/i);
  });

  it('TC-05: refresh token reutilizado depois do logout retorna 401', async () => {
    const sessao = await login();

    const logout = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${sessao.token}`)
      .send({ refreshToken: sessao.refreshToken });
    expect(logout.status).toBe(200);

    const response = await request(app).post('/auth/refresh').send({ refreshToken: sessao.refreshToken });
    expect(response.status).toBe(401);
  });

  it('logout de uma sessão não revoga o refresh token de outra, nem quando o refresh da sessão encerrada é reutilizado', async () => {
    const sessaoA = await login();
    const sessaoB = await login();

    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${sessaoA.token}`)
      .send({ refreshToken: sessaoA.refreshToken });

    const reusoA = await request(app).post('/auth/refresh').send({ refreshToken: sessaoA.refreshToken });
    expect(reusoA.status).toBe(401);

    const response = await request(app).post('/auth/refresh').send({ refreshToken: sessaoB.refreshToken });
    expect(response.status).toBe(200);
  });

  it('reutilizar um refresh token já trocado revoga todas as sessões do usuário', async () => {
    const sessao = await login();
    const outroAparelho = await login();

    const renovado = await request(app).post('/auth/refresh').send({ refreshToken: sessao.refreshToken });
    expect(renovado.status).toBe(200);

    const reuso = await request(app).post('/auth/refresh').send({ refreshToken: sessao.refreshToken });
    expect(reuso.status).toBe(401);

    for (const refreshToken of [renovado.body.refreshToken, outroAparelho.refreshToken]) {
      const response = await request(app).post('/auth/refresh').send({ refreshToken });
      expect(response.status).toBe(401);
    }
  });

  it('usuário inativado não consegue renovar a sessão (403)', async () => {
    const sessao = await login();
    prisma.refresh_token.findUnique.mockImplementation((async ({ where }: any) => {
      const row = tabela.find((r) => r.tokenhash === where.tokenhash);
      return row ? { ...row, usuario: { ...usuario, status: 'Inativo' } } : null;
    }) as any);

    const response = await request(app).post('/auth/refresh').send({ refreshToken: sessao.refreshToken });

    expect(response.status).toBe(403);
    expect(linhaDo(sessao.refreshToken)!.revogadoem).toBeNull();
  });

  it('refresh sem o campo refreshToken retorna 400 e com token desconhecido retorna 401', async () => {
    const semCampo = await request(app).post('/auth/refresh').send({});
    expect(semCampo.status).toBe(400);

    const desconhecido = await request(app).post('/auth/refresh').send({ refreshToken: 'token-que-nunca-existiu' });
    expect(desconhecido.status).toBe(401);
  });
});
