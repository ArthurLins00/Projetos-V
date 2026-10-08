import { test, expect } from '@playwright/test';
import { JPEG_BASE64, categoryIdByName, createDemand, registerAndLogin, uniqueSuffix } from './helpers';

test.describe.serial('Jornada do cidadão: ciclo de vida de uma ocorrência', () => {
  let session: Awaited<ReturnType<typeof registerAndLogin>>;
  let demand: { id: string; protocolo: string; title: string };
  const title = `Buraco na via ${uniqueSuffix()}`;

  test('cadastro e login de um novo cidadão', async ({ request }) => {
    session = await registerAndLogin(request, 'jornada');

    expect(session.user.perfil).toBe('Cidadao');
    const me = await request.get('/auth/me', { headers: session.headers });
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(session.email);
  });

  test('lista de ocorrências começa vazia para um cidadão novo', async ({ request }) => {
    const response = await request.get('/demands', { headers: session.headers });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ data: [], total: 0 });
  });

  test('registra uma ocorrência com categoria, endereço e coordenadas do GPS', async ({ request }) => {
    const categoryId = await categoryIdByName(request, session, 'Infraestrutura');
    demand = await createDemand(request, session, {
      title,
      description: 'Asfalto cedeu e há risco de acidentes',
      location: 'Avenida Central, 500 - Recife',
      category_id: categoryId,
    });

    expect(demand.protocolo).toMatch(/^DEM-\d{8}-[A-Z0-9]{4}$/);
    expect(demand).toMatchObject({ title, status: 'Aberto' });
  });

  test('a ocorrência aparece na listagem com status Aberto', async ({ request }) => {
    const response = await request.get('/demands', { headers: session.headers });
    const body = await response.json();

    expect(body.total).toBe(1);
    expect(body.data[0]).toMatchObject({
      id: demand.id,
      title,
      status: 'Aberto',
      category: { nome: 'Infraestrutura' },
      latitude: -8.0476,
      longitude: -34.877,
    });
  });

  test('pesquisa por título, endereço e protocolo encontra a ocorrência; termo inexistente não', async ({ request }) => {
    for (const termo of ['buraco na via', 'avenida central', demand.protocolo]) {
      const response = await request.get('/demands', { headers: session.headers, params: { busca: termo } });
      const ids = (await response.json()).data.map((d: { id: string }) => d.id);
      expect(ids, `pesquisa por "${termo}"`).toContain(demand.id);
    }

    const semResultado = await request.get('/demands', { headers: session.headers, params: { busca: 'termo-que-nao-existe' } });
    expect((await semResultado.json()).total).toBe(0);
  });

  test('filtro por status: aparece em "Aberto" e não em "Resolvido"', async ({ request }) => {
    const aberto = await request.get('/demands', { headers: session.headers, params: { status: 'Aberto' } });
    expect((await aberto.json()).total).toBe(1);

    const resolvido = await request.get('/demands', { headers: session.headers, params: { status: 'Resolvido' } });
    expect((await resolvido.json()).total).toBe(0);
  });

  test('detalhe mostra os dados e o histórico da ocorrência', async ({ request }) => {
    const response = await request.get(`/demands/${demand.id}`, { headers: session.headers });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body).toMatchObject({ id: demand.id, protocolo: demand.protocolo, title });
    expect(Array.isArray(body.logs)).toBe(true);
  });

  test('edita título, descrição e categoria; a alteração fica no histórico', async ({ request }) => {
    const novaCategoria = await categoryIdByName(request, session, 'Sinalização');
    const update = await request.put(`/demands/${demand.id}`, {
      headers: session.headers,
      data: { title: `${title} (atualizado)`, description: 'Buraco aumentou após a chuva', category_id: novaCategoria },
    });
    expect(update.status(), await update.text()).toBe(200);

    const detail = await (await request.get(`/demands/${demand.id}`, { headers: session.headers })).json();
    expect(detail).toMatchObject({
      title: `${title} (atualizado)`,
      description: 'Buraco aumentou após a chuva',
      category: { nome: 'Sinalização' },
    });
    expect(detail.logs.map((l: { titulo: string }) => l.titulo)).toContain('Demanda atualizada');
  });

  test('anexa uma foto e ela fica disponível para exibição no app', async ({ request }) => {
    const upload = await request.put(`/demands/${demand.id}/photo`, {
      headers: session.headers,
      data: { photo: JPEG_BASE64 },
    });
    expect(upload.status(), await upload.text()).toBe(200);
    const { photoUrl } = await upload.json();
    expect(photoUrl).toMatch(/^\/uploads\/.+\.jpg$/);

    const detail = await (await request.get(`/demands/${demand.id}`, { headers: session.headers })).json();
    expect(detail.photoUrl).toBe(photoUrl);

    const image = await request.get(photoUrl);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/jpeg');
  });

  test('remove a ocorrência: some da lista padrão e aparece em "Removidas"', async ({ request }) => {
    const remove = await request.delete(`/demands/${demand.id}`, { headers: session.headers });
    expect(remove.status()).toBe(204);

    const padrao = await (await request.get('/demands', { headers: session.headers })).json();
    expect(padrao.total).toBe(0);

    const removidas = await (await request.get('/demands', { headers: session.headers, params: { status: 'Fechado' } })).json();
    expect(removidas.data.map((d: { id: string }) => d.id)).toContain(demand.id);
  });

  test('ocorrência removida não pode mais ser editada', async ({ request }) => {
    const update = await request.put(`/demands/${demand.id}`, { headers: session.headers, data: { title: 'Tentativa' } });

    expect(update.status()).toBe(403);
  });

  test('logout encerra a sessão: o token deixa de funcionar', async ({ request }) => {
    const logout = await request.post('/auth/logout', { headers: session.headers });
    expect(logout.status()).toBe(200);

    const depois = await request.get('/demands', { headers: session.headers });
    expect(depois.status()).toBe(401);
  });
});
