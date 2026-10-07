import { APIRequestContext, expect, request as playwrightRequest } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

// Credenciais criadas pelo seed do backend (backend/prisma/seed.ts)
export const SEED = {
  cidadao: { email: 'cidadao@fiscalize.gov.br', senha: 'Cidadao@123456' },
  gestorCompesa: { email: 'gestor.compesa@fiscalize.gov.br', senha: 'Gestor@123456' },
};

// JPEG mínimo (assinatura FF D8 FF) usado como "foto" da ocorrência
export const JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]).toString('base64');

export function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export type Session = { token: string; headers: Record<string, string>; user: { id: string; perfil: string } };

// Cria um cidadão novo (dados isolados por teste) e já faz login
export async function registerAndLogin(request: APIRequestContext, prefix = 'e2e'): Promise<Session & { email: string; senha: string }> {
  const email = `${prefix}.${uniqueSuffix()}@teste.fiscalize`;
  const senha = 'SenhaE2E@123';

  const register = await request.post('/auth/register', { data: { nome: `Cidadão ${prefix}`, email, senha } });
  expect(register.status(), await register.text()).toBe(201);

  return { ...(await login(request, email, senha)), email, senha };
}

// O login também devolve o token em cookie, e o backend dá prioridade ao cookie sobre o header.
// Por isso o login roda num contexto isolado: cada sessão usa só o header Authorization (como o app),
// e testes com mais de um usuário não se misturam.
export async function login(_request: APIRequestContext, email: string, senha: string): Promise<Session> {
  const context = await playwrightRequest.newContext({ baseURL: API_URL });
  try {
    const response = await context.post('/auth/login', { data: { email, senha } });
    expect(response.status(), await response.text()).toBe(200);
    const body = await response.json();
    return { token: body.token, headers: { Authorization: `Bearer ${body.token}` }, user: body };
  } finally {
    await context.dispose();
  }
}

export async function categoryIdByName(request: APIRequestContext, session: Session, nome: string): Promise<number> {
  const response = await request.get('/categories', { headers: session.headers });
  expect(response.ok()).toBeTruthy();
  const categories: { id: number; nome: string }[] = await response.json();
  const category = categories.find((c) => c.nome === nome);
  expect(category, `categoria "${nome}" não encontrada — o seed foi executado?`).toBeDefined();
  return category!.id;
}

export async function createDemand(
  request: APIRequestContext,
  session: Session,
  overrides: Partial<{ title: string; description: string; category_id: number; location: string }> = {},
) {
  const categoryId = overrides.category_id ?? (await categoryIdByName(request, session, 'Iluminação Pública'));
  const response = await request.post('/demands', {
    headers: session.headers,
    data: {
      title: `Poste apagado ${uniqueSuffix()}`,
      description: 'Rua completamente escura à noite',
      location: 'Rua das Flores, 123 - Recife',
      latitude: -8.0476,
      longitude: -34.877,
      ...overrides,
      category_id: categoryId,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}
