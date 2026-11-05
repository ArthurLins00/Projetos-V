import jwt from 'jsonwebtoken';
import type { NextFunction, Response } from 'express';

jest.mock('../../services/authService', () => ({
  authService: new Proxy({}, { get: (target: any, prop) => (target[prop] ??= jest.fn()) }),
}));
jest.mock('../../services/notificationService', () => ({
  notificationService: { registerPushToken: jest.fn(), removePushToken: jest.fn() },
}));

import { authController } from '../../controllers/authController';
import { authService } from '../../services/authService';
import { notificationService } from '../../services/notificationService';

const service = authService as unknown as Record<string, jest.Mock>;
const token = jwt.sign({ id: 'u1' }, 'secret', { expiresIn: '15m' });
const usuario = { id: 'u1', nome: 'Maria', email: 'maria@t.com', perfil: 'Cidadao', fotourl: null, termosversao: 1 };

function call(method: keyof typeof authController, req: Record<string, unknown> = {}) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
  const next = jest.fn() as NextFunction & jest.Mock;
  const request = { body: {}, cookies: {}, headers: {}, ...req };
  return (authController[method] as any)(request, res as unknown as Response, next).then(() => ({
    res,
    next,
    status: res.status.mock.calls[0]?.[0],
    body: res.json.mock.calls[0]?.[0],
    error: next.mock.calls[0]?.[0] as { statusCode?: number; message?: string } | undefined,
  }));
}

const logged = { user: { id: 'u1', perfil: 'Cidadao' } };

// TC-73: validação de entrada do controller de autenticação, isolada do serviço
describe('authController (unitário)', () => {
  it.each([
    ['register', { body: {} }, /nome, email, senha/],
    ['register', { body: { nome: 'M', email: 'sem-arroba', senha: '123456' } }, /E-mail inválido/],
    ['register', { body: { nome: 'M', email: 'm@t.com', senha: '123' } }, /6 caracteres/],
    ['login', { body: { email: 'm@t.com' } }, /email, senha/],
    ['verifyTwoFactor', { body: {} }, /desafioId, codigo/],
    ['verifyTwoFactor', { body: { desafioId: 'd1', codigo: '12ab56' } }, /Código inválido/],
    ['resendTwoFactor', { body: { desafioId: 42 } }, /desafioId/],
    ['refresh', { body: {} }, /refreshToken/],
    ['forgotPassword', { body: { email: 'invalido' } }, /E-mail inválido/],
    ['resetPassword', { body: { email: 'm@t.com' } }, /email, codigo, novaSenha/],
    ['resetPassword', { body: { email: 'm@t.com', codigo: '12', novaSenha: '123456' } }, /Código inválido/],
    ['resetPassword', { body: { email: 'm@t.com', codigo: '123456', novaSenha: '123' } }, /6 caracteres/],
    ['updateTwoFactor', { ...logged, body: { ativo: 'sim' } }, /booleano/],
    ['updateTwoFactor', { ...logged, body: { ativo: true } }, /senha atual/],
    ['uploadPhoto', { ...logged, body: {} }, /photo/],
    ['registerPushToken', { ...logged, body: {} }, /token/],
    ['removePushToken', { ...logged, body: { token: 1 } }, /token/],
    ['acceptTerms', { ...logged, body: { versao: 0 } }, /versao/],
    ['updateMe', { ...logged, body: {} }, /ao menos um campo/],
    ['updateMe', { ...logged, body: { nome: '   ' } }, /Nome/],
    ['updateMe', { ...logged, body: { email: 'x' } }, /E-mail inválido/],
    ['updateMe', { ...logged, body: { novaSenha: '1' } }, /6 caracteres/],
  ] as const)('%s recusa entrada inválida (400): %j', async (method, req, message) => {
    const { error } = await call(method, req);

    expect(error?.statusCode).toBe(400);
    expect(error?.message).toMatch(message);
  });

  it.each(['updateTwoFactor', 'me', 'uploadPhoto', 'registerPushToken', 'removePushToken', 'acceptTerms', 'removePhoto', 'updateMe'] as const)(
    '%s sem usuário autenticado retorna 401',
    async (method) => {
      const { error } = await call(method);

      expect(error?.statusCode).toBe(401);
    }
  );

  it('register cria o cidadão e devolve 201 sem a senha', async () => {
    service.register!.mockResolvedValue({ ...usuario, senha: 'hash' });

    const { status, body } = await call('register', { body: { nome: 'Maria', email: 'maria@t.com', senha: '123456', ignorarSenhaRepetida: true } });

    expect(status).toBe(201);
    expect(body).toEqual({ id: 'u1', nome: 'Maria', email: 'maria@t.com', perfil: 'Cidadao' });
    expect(service.register).toHaveBeenCalledWith('Maria', 'maria@t.com', '123456', true);
  });

  it('login com 2FA devolve o desafio e, em demonstração, o código', async () => {
    service.login!.mockResolvedValue({ desafioId: 'd1', usuario, codigo: '123456' });

    const { body, res } = await call('login', { body: { email: 'maria@t.com', senha: '123456' } });

    expect(body).toEqual({ requer2fa: true, desafioId: 'd1', email: 'maria@t.com', codigo: '123456' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('login sem 2FA abre a sessão com cookie httpOnly que expira junto com o token', async () => {
    service.login!.mockResolvedValue({ usuario, token, refreshToken: 'r1' });

    const { body, res } = await call('login', { body: { email: 'maria@t.com', senha: '123456' } });

    expect(body).toMatchObject({ id: 'u1', token, refreshToken: 'r1' });
    const [, , options] = res.cookie.mock.calls[0]!;
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'strict' });
    expect(options.maxAge).toBeGreaterThan(14 * 60 * 1000);
  });

  it('verifyTwoFactor aceita o código com espaços e abre a sessão', async () => {
    service.verifyTwoFactor!.mockResolvedValue({ usuario, token, refreshToken: 'r1' });

    const { status } = await call('verifyTwoFactor', { body: { desafioId: 'd1', codigo: ' 123456 ' } });

    expect(status).toBe(200);
    expect(service.verifyTwoFactor).toHaveBeenCalledWith('d1', '123456');
  });

  it('resendTwoFactor só inclui o código quando o serviço o devolve', async () => {
    service.resendTwoFactor!.mockResolvedValueOnce({ codigo: '654321' }).mockResolvedValueOnce({});

    const demo = await call('resendTwoFactor', { body: { desafioId: 'd1' } });
    const real = await call('resendTwoFactor', { body: { desafioId: 'd1' } });

    expect(demo.body.codigo).toBe('654321');
    expect(real.body).not.toHaveProperty('codigo');
  });

  it('refresh renova o cookie e devolve o novo par de tokens', async () => {
    service.refresh!.mockResolvedValue({ token, refreshToken: 'r2' });

    const { body, res } = await call('refresh', { body: { refreshToken: 'r1' } });

    expect(body).toEqual({ token, refreshToken: 'r2' });
    expect(res.cookie).toHaveBeenCalled();
  });

  it('forgotPassword e resetPassword normalizam o e-mail e o código', async () => {
    await call('forgotPassword', { body: { email: ' maria@t.com ' } });
    await call('resetPassword', { body: { email: ' maria@t.com ', codigo: ' 123456 ', novaSenha: 'nova123' } });

    expect(service.requestPasswordReset).toHaveBeenCalledWith('maria@t.com');
    expect(service.resetPassword).toHaveBeenCalledWith('maria@t.com', '123456', 'nova123');
  });

  it('logout revoga o token do header e o refresh token da sessão', async () => {
    const { res, status } = await call('logout', {
      ...logged,
      headers: { authorization: `Bearer ${token}` },
      body: { refreshToken: 'r1' },
    });

    expect(status).toBe(200);
    expect(res.clearCookie).toHaveBeenCalledWith('token');
    expect(service.addTokenToBlocklist).toHaveBeenCalledWith(token);
    expect(service.revokeRefreshToken).toHaveBeenCalledWith('r1', 'u1');
  });

  it('logout sem token nenhum só limpa o cookie', async () => {
    await call('logout');

    expect(service.addTokenToBlocklist).not.toHaveBeenCalled();
    expect(service.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it('me devolve o perfil do usuário logado', async () => {
    service.getUserById!.mockResolvedValue({ ...usuario, status: 'Ativo', doisfatores: false, criadoem: new Date(0), senha: 'hash' });

    const { body } = await call('me', logged);

    expect(body).toMatchObject({ id: 'u1', status: 'Ativo', doisfatores: false });
    expect(body).not.toHaveProperty('senha');
  });

  it('ações da conta repassam ao serviço com os dados normalizados', async () => {
    service.setTwoFactor!.mockResolvedValue(usuario);
    service.updatePhoto!.mockResolvedValue(usuario);
    service.removePhoto!.mockResolvedValue(usuario);
    service.acceptTerms!.mockResolvedValue(usuario);
    service.updateProfile!.mockResolvedValue(usuario);

    await call('updateTwoFactor', { ...logged, body: { ativo: true, senhaAtual: 'senha123' } });
    await call('uploadPhoto', { ...logged, body: { photo: 'base64' } });
    await call('removePhoto', logged);
    await call('acceptTerms', { ...logged, body: { versao: 2 } });
    const push = await call('registerPushToken', { ...logged, body: { token: 'ExponentPushToken[x]' } });
    const unpush = await call('removePushToken', { ...logged, body: { token: 'ExponentPushToken[x]' } });
    await call('updateMe', { ...logged, body: { nome: ' Maria ', email: ' maria@t.com ', senhaAtual: 'a', novaSenha: 'nova123' } });

    expect(service.setTwoFactor).toHaveBeenCalledWith('u1', true, 'senha123');
    expect(service.acceptTerms).toHaveBeenCalledWith('u1', 2);
    expect(push.status).toBe(204);
    expect(unpush.status).toBe(204);
    expect(notificationService.registerPushToken).toHaveBeenCalledWith('u1', 'ExponentPushToken[x]');
    expect(service.updateProfile).toHaveBeenCalledWith('u1', { nome: 'Maria', email: 'maria@t.com', senhaAtual: 'a', novaSenha: 'nova123' });
  });

  it('erro do serviço é repassado ao middleware de erro', async () => {
    const falha = new Error('db');
    service.login!.mockRejectedValue(falha);

    const { next } = await call('login', { body: { email: 'm@t.com', senha: '123456' } });

    expect(next).toHaveBeenCalledWith(falha);
  });
});
