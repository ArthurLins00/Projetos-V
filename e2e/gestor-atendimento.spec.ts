import { test, expect } from '@playwright/test';
import { SEED, categoryIdByName, createDemand, login, registerAndLogin } from './helpers';

// Jornada entre perfis: o cidadão registra, o gestor do órgão responsável atende,
// e o cidadão acompanha a mudança de status no app.
test.describe.serial('Jornada do gestor: atendimento de uma ocorrência', () => {
  let cidadao: Awaited<ReturnType<typeof registerAndLogin>>;
  let gestor: Awaited<ReturnType<typeof login>>;
  let demand: { id: string; protocolo: string };

  test('cidadão registra um vazamento (categoria Água e Esgoto → COMPESA)', async ({ request }) => {
    cidadao = await registerAndLogin(request, 'vazamento');
    const categoryId = await categoryIdByName(request, cidadao, 'Água e Esgoto');
    demand = await createDemand(request, cidadao, {
      title: 'Vazamento na calçada',
      description: 'Água limpa escorrendo há dois dias',
      category_id: categoryId,
    });
  });

  test('a ocorrência chega à fila do gestor do órgão responsável', async ({ request }) => {
    gestor = await login(request, SEED.gestorCompesa.email, SEED.gestorCompesa.senha);

    const fila = await request.get('/gestor/chamados', { headers: gestor.headers, params: { limit: '100' } });
    expect(fila.status()).toBe(200);
    const ids = (await fila.json()).chamados.map((c: { id: string }) => c.id);
    expect(ids).toContain(demand.id);
  });

  test('cidadão não tem acesso às rotas do gestor', async ({ request }) => {
    const response = await request.get('/gestor/chamados', { headers: cidadao.headers });

    expect(response.status()).toBe(403);
  });

  test('gestor move a ocorrência para "Em Andamento"', async ({ request }) => {
    const response = await request.put(`/gestor/chamados/${demand.id}/status`, {
      headers: gestor.headers,
      data: { status: 'Em Andamento', justificativa: 'Equipe enviada ao local' },
    });

    expect(response.status(), await response.text()).toBe(200);
  });

  test('cidadão vê o novo status e o registro no histórico', async ({ request }) => {
    const detail = await (await request.get(`/demands/${demand.id}`, { headers: cidadao.headers })).json();

    expect(detail.status).toBe('Em Andamento');
    expect(detail.logs.map((l: { titulo: string }) => l.titulo)).toContain('Status atualizado');
  });

  test('com a ocorrência em andamento, o cidadão não pode mais editar nem remover', async ({ request }) => {
    const update = await request.put(`/demands/${demand.id}`, { headers: cidadao.headers, data: { title: 'Mudança' } });
    expect(update.status()).toBe(403);

    const remove = await request.delete(`/demands/${demand.id}`, { headers: cidadao.headers });
    expect(remove.status()).toBe(403);
  });

  test('gestor conclui a ocorrência e ela aparece como Resolvido para o cidadão', async ({ request }) => {
    const response = await request.put(`/gestor/chamados/${demand.id}/status`, {
      headers: gestor.headers,
      data: { status: 'Resolvido', resolutionNote: 'Tubulação substituída' },
    });
    expect(response.status()).toBe(200);

    const resolvidas = await (
      await request.get('/demands', { headers: cidadao.headers, params: { status: 'Resolvido' } })
    ).json();
    expect(resolvidas.data.map((d: { id: string }) => d.id)).toContain(demand.id);
  });
});
