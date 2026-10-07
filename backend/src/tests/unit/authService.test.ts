import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';
import { authService } from '../../services/authService';

describe('authService (unitário)', () => {
  const senha = 'senhaSegura123';
  const usuario = {
    id: 'usuario-1',
    nome: 'Usuário',
    email: 'usuario@example.com',
    senha: bcrypt.hashSync(senha, 10),
    perfil: 'Cidadao',
    status: 'Ativo',
  };

  beforeEach(() => {
    prisma.usuario.findUnique.mockResolvedValue(usuario as any);
  });

  it('login gera um JWT com id, e-mail e perfil do usuário', async () => {
    const { token } = await authService.login(usuario.email, senha);

    const payload = jwt.decode(token) as Record<string, unknown>;
    expect(payload).toMatchObject({ id: usuario.id, email: usuario.email, perfil: 'Cidadao' });
    expect(payload.exp).toEqual(expect.any(Number));
  });

  it('dois logins seguidos geram tokens diferentes (sessões independentes)', async () => {
    const primeiro = await authService.login(usuario.email, senha);
    const segundo = await authService.login(usuario.email, senha);

    expect(primeiro.token).not.toBe(segundo.token);
  });

  it('login com senha errada falha com 401 sem revelar se o e-mail existe', async () => {
    await expect(authService.login(usuario.email, 'errada')).rejects.toMatchObject({ statusCode: 401 });

    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(authService.login('nao@existe.com', senha)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('logout revoga apenas o token informado', async () => {
    const sessaoA = await authService.login(usuario.email, senha);
    const sessaoB = await authService.login(usuario.email, senha);

    await authService.addTokenToBlocklist(sessaoA.token);

    expect(authService.isTokenBlocked(sessaoA.token)).toBe(true);
    expect(authService.isTokenBlocked(sessaoB.token)).toBe(false);
  });

  it('token inválido não é adicionado à blocklist', async () => {
    await authService.addTokenToBlocklist('nao-e-um-jwt');

    expect(authService.isTokenBlocked('nao-e-um-jwt')).toBe(false);
  });
});
