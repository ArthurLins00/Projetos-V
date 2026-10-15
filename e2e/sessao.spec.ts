import { test, expect } from '@playwright/test';
import { login, registerAndLogin } from './helpers';

test.describe('Sessão com refresh token', () => {
  test('refresh troca o par de tokens, o novo access token funciona e o refresh antigo deixa de valer', async ({ request }) => {
    const sessao = await registerAndLogin(request, 'refresh');
    expect(sessao.refreshToken).toEqual(expect.any(String));

    const renovado = await request.post('/auth/refresh', { data: { refreshToken: sessao.refreshToken } });
    expect(renovado.status(), await renovado.text()).toBe(200);
    const { token, refreshToken } = await renovado.json();
    expect(refreshToken).not.toBe(sessao.refreshToken);

    const me = await request.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(sessao.email);

    // Reutilizar o refresh já trocado é tratado como cópia do token e derruba a sessão inteira
    const reuso = await request.post('/auth/refresh', { data: { refreshToken: sessao.refreshToken } });
    expect(reuso.status()).toBe(401);

    const depoisDoReuso = await request.post('/auth/refresh', { data: { refreshToken } });
    expect(depoisDoReuso.status()).toBe(401);
  });

  test('logout revoga o refresh token daquela sessão sem derrubar a outra', async ({ request }) => {
    const sessaoA = await registerAndLogin(request, 'refresh-logout');
    const sessaoB = await login(request, sessaoA.email, sessaoA.senha);

    const logout = await request.post('/auth/logout', {
      headers: sessaoA.headers,
      data: { refreshToken: sessaoA.refreshToken },
    });
    expect(logout.status()).toBe(200);

    const refreshA = await request.post('/auth/refresh', { data: { refreshToken: sessaoA.refreshToken } });
    expect(refreshA.status()).toBe(401);

    const refreshB = await request.post('/auth/refresh', { data: { refreshToken: sessaoB.refreshToken } });
    expect(refreshB.status()).toBe(200);
  });

  test('refresh sem o campo retorna 400 e com token desconhecido retorna 401', async ({ request }) => {
    const semCampo = await request.post('/auth/refresh', { data: {} });
    expect(semCampo.status()).toBe(400);

    const desconhecido = await request.post('/auth/refresh', { data: { refreshToken: 'token-que-nunca-existiu' } });
    expect(desconhecido.status()).toBe(401);
  });
});
