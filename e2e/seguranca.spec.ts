import { test, expect } from '@playwright/test';
import { JPEG_BASE64, SEED, createDemand, login, registerAndLogin, uniqueSuffix } from './helpers';

test.describe('Autenticação', () => {
  test('rotas protegidas exigem login (401 sem token)', async ({ request }) => {
    for (const path of ['/demands', '/categories', '/auth/me']) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
    }
  });

  test('login com senha errada é recusado com mensagem genérica', async ({ request }) => {
    const response = await request.post('/auth/login', { data: { email: SEED.cidadao.email, senha: 'senha-incorreta' } });

    expect(response.status()).toBe(401);
    expect((await response.json()).error).toMatch(/Credenciais inválidas/i);
  });

  test('não permite cadastrar o mesmo e-mail duas vezes (409)', async ({ request }) => {
    const { email } = await registerAndLogin(request, 'duplicado');

    const response = await request.post('/auth/register', { data: { nome: 'Outro', email, senha: 'Outra@123' } });

    expect(response.status()).toBe(409);
  });

  test('cadastro ignora tentativa de se registrar como Admin', async ({ request }) => {
    const email = `escalada.${uniqueSuffix()}@teste.fiscalize`;
    const response = await request.post('/auth/register', {
      data: { nome: 'Invasor', email, senha: 'Invasor@123', perfil: 'Admin' },
    });

    expect(response.status()).toBe(201);
    expect((await response.json()).perfil).toBe('Cidadao');
  });
});

test.describe('Isolamento entre cidadãos', () => {
  test('um cidadão não vê, não edita, não anexa foto e não remove a ocorrência de outro', async ({ request }) => {
    const dono = await registerAndLogin(request, 'dono');
    const intruso = await registerAndLogin(request, 'intruso');
    const demand = await createDemand(request, dono);

    const lista = await (await request.get('/demands', { headers: intruso.headers })).json();
    expect(lista.data.map((d: { id: string }) => d.id)).not.toContain(demand.id);

    expect((await request.get(`/demands/${demand.id}`, { headers: intruso.headers })).status()).toBe(403);
    expect(
      (await request.put(`/demands/${demand.id}`, { headers: intruso.headers, data: { title: 'Invadido' } })).status(),
    ).toBe(403);
    expect(
      (await request.put(`/demands/${demand.id}/photo`, { headers: intruso.headers, data: { photo: JPEG_BASE64 } })).status(),
    ).toBe(403);
    expect((await request.delete(`/demands/${demand.id}`, { headers: intruso.headers })).status()).toBe(403);

    const detail = await (await request.get(`/demands/${demand.id}`, { headers: dono.headers })).json();
    expect(detail).toMatchObject({ title: demand.title, status: 'Aberto' });
  });

  test('o logout de uma sessão não derruba outra sessão do mesmo usuário', async ({ request }) => {
    const celular = await registerAndLogin(request, 'multisessao');
    const computador = await login(request, celular.email, celular.senha);

    await request.post('/auth/logout', { headers: celular.headers });

    expect((await request.get('/demands', { headers: celular.headers })).status()).toBe(401);
    expect((await request.get('/demands', { headers: computador.headers })).status()).toBe(200);
  });
});

test.describe('Validação de dados', () => {
  test('ocorrência sem campos obrigatórios ou com categoria inválida é recusada', async ({ request }) => {
    const session = await registerAndLogin(request, 'validacao');

    const semCampos = await request.post('/demands', { headers: session.headers, data: { title: 'Só título' } });
    expect(semCampos.status()).toBe(400);

    const categoriaInvalida = await request.post('/demands', {
      headers: session.headers,
      data: { title: 'X', description: 'Y', location: 'Z', category_id: 999999, latitude: 0, longitude: 0 },
    });
    expect(categoriaInvalida.status()).toBe(400);
  });

  test('arquivo que não é imagem é recusado como foto', async ({ request }) => {
    const session = await registerAndLogin(request, 'foto');
    const demand = await createDemand(request, session);

    const response = await request.put(`/demands/${demand.id}/photo`, {
      headers: session.headers,
      data: { photo: Buffer.from('<script>alert(1)</script>').toString('base64') },
    });

    expect(response.status()).toBe(400);
  });
});
