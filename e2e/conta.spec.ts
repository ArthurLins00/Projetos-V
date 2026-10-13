import { test, expect } from '@playwright/test';
import { JPEG_BASE64, registerAndLogin } from './helpers';

test.describe.serial('Conta do cidadão: termos, foto de perfil, notificações e recuperação de senha', () => {
  let session: Awaited<ReturnType<typeof registerAndLogin>>;

  test('conta nova ainda não aceitou os termos de uso', async ({ request }) => {
    session = await registerAndLogin(request, 'conta');

    const me = await (await request.get('/auth/me', { headers: session.headers })).json();
    expect(me.termosversao).toBeNull();
  });

  test('aceite dos termos fica gravado e não regride para uma versão anterior', async ({ request }) => {
    const aceite = await request.post('/auth/me/terms', { headers: session.headers, data: { versao: 2 } });
    expect(aceite.status(), await aceite.text()).toBe(200);
    expect((await aceite.json()).termosversao).toBe(2);

    await request.post('/auth/me/terms', { headers: session.headers, data: { versao: 1 } });
    const me = await (await request.get('/auth/me', { headers: session.headers })).json();
    expect(me.termosversao).toBe(2);
  });

  test('envia a foto de perfil, ela fica disponível e pode ser removida', async ({ request }) => {
    const upload = await request.put('/auth/me/photo', { headers: session.headers, data: { photo: JPEG_BASE64 } });
    expect(upload.status(), await upload.text()).toBe(200);
    const { fotourl } = await upload.json();
    expect(fotourl).toMatch(/^\/uploads\/avatar-.+\.jpg$/);

    const image = await request.get(fotourl);
    expect(image.status()).toBe(200);

    const remove = await request.delete('/auth/me/photo', { headers: session.headers });
    expect((await remove.json()).fotourl).toBeNull();
    expect((await request.get(fotourl)).status()).toBe(404);
  });

  test('registra e remove o token de push do aparelho; token inválido é recusado', async ({ request }) => {
    const token = `ExponentPushToken[e2e-${Date.now()}]`;

    const registro = await request.post('/auth/me/push-token', { headers: session.headers, data: { token } });
    expect(registro.status(), await registro.text()).toBe(204);
    const repetido = await request.post('/auth/me/push-token', { headers: session.headers, data: { token } });
    expect(repetido.status()).toBe(204);

    const remocao = await request.delete('/auth/me/push-token', { headers: session.headers, data: { token } });
    expect(remocao.status()).toBe(204);

    const invalido = await request.post('/auth/me/push-token', { headers: session.headers, data: { token: 'nao-e-um-token' } });
    expect(invalido.status()).toBe(400);
  });

  test('recuperação de senha responde igual para e-mail existente e inexistente e recusa código errado', async ({ request }) => {
    const existente = await request.post('/auth/forgot-password', { data: { email: session.email } });
    const inexistente = await request.post('/auth/forgot-password', { data: { email: 'ninguem.e2e@teste.fiscalize' } });
    expect(existente.status()).toBe(200);
    expect(inexistente.status()).toBe(200);
    expect((await existente.json()).message).toBe((await inexistente.json()).message);

    const reset = await request.post('/auth/reset-password', {
      data: { email: session.email, codigo: '000000', novaSenha: 'OutraSenha@123' },
    });
    expect(reset.status()).toBe(400);

    const loginAntigo = await request.post('/auth/login', { data: { email: session.email, senha: session.senha } });
    expect(loginAntigo.status()).toBe(200);
  });
});
