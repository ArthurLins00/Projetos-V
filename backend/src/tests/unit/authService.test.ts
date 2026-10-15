import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../services/mailService', () => ({ mailService: { send: jest.fn() } }));
import { prisma } from '../../config/__mocks__/prisma';
import { authService } from '../../services/authService';
import { mailService } from '../../services/mailService';

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

  describe('refresh token', () => {
    const registro = (overrides: Record<string, unknown> = {}) => ({
      id: 'rt-1',
      usuarioid: usuario.id,
      tokenhash: 'hash',
      expiraem: new Date(Date.now() + 60_000),
      revogadoem: null,
      usuario,
      ...overrides,
    });

    beforeEach(() => {
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    });

    it('login grava só o hash do refresh token, nunca o token em si', async () => {
      const { refreshToken } = await authService.login(usuario.email, senha);

      const { data } = prisma.refresh_token.create.mock.calls[0][0] as any;
      expect(data.usuarioid).toBe(usuario.id);
      expect(data.tokenhash).toMatch(/^[0-9a-f]{64}$/);
      expect(data.tokenhash).not.toBe(refreshToken);
    });

    it('duas renovações simultâneas com o mesmo token: a segunda falha com 401 e não emite novo token', async () => {
      prisma.refresh_token.findUnique.mockResolvedValue(registro() as any);
      prisma.refresh_token.updateMany.mockResolvedValue({ count: 0 });

      await expect(authService.refresh('token')).rejects.toMatchObject({ statusCode: 401 });
      expect(prisma.refresh_token.create).not.toHaveBeenCalled();
    });

    it('token já trocado por rotação sendo reutilizado: revoga todas as sessões ativas do usuário', async () => {
      prisma.refresh_token.findUnique.mockResolvedValue(
        registro({ revogadoem: new Date(), substituidoem: new Date() }) as any,
      );

      await expect(authService.refresh('token')).rejects.toMatchObject({ statusCode: 401 });
      expect(prisma.refresh_token.updateMany).toHaveBeenCalledWith({
        where: { usuarioid: usuario.id, revogadoem: null },
        data: { revogadoem: expect.any(Date) },
      });
    });

    it('token revogado por logout: recusa com 401 sem derrubar as outras sessões', async () => {
      prisma.refresh_token.findUnique.mockResolvedValue(registro({ revogadoem: new Date(), substituidoem: null }) as any);

      await expect(authService.refresh('token')).rejects.toMatchObject({ statusCode: 401 });
      expect(prisma.refresh_token.updateMany).not.toHaveBeenCalled();
    });

    it('logout só revoga refresh token do próprio usuário', async () => {
      await authService.revokeRefreshToken('token-de-outra-pessoa', usuario.id);

      expect(prisma.refresh_token.updateMany).toHaveBeenCalledWith({
        where: { tokenhash: expect.stringMatching(/^[0-9a-f]{64}$/), usuarioid: usuario.id, revogadoem: null },
        data: { revogadoem: expect.any(Date) },
      });
    });

    it('recuperar a senha revoga todas as sessões do usuário', async () => {
      await authService.requestPasswordReset(usuario.email);
      const texto = (mailService.send as jest.Mock).mock.calls[0][2] as string;
      const codigo = texto.match(/\b(\d{6})\b/)![1];

      await authService.resetPassword(usuario.email, codigo, 'NovaSenha@123');

      expect(prisma.refresh_token.updateMany).toHaveBeenCalledWith({
        where: { usuarioid: usuario.id, revogadoem: null },
        data: { revogadoem: expect.any(Date) },
      });
    });
  });
});
