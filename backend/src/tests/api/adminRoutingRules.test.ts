import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

const admin = { id: 'uuid-admin', nome: 'Admin', email: 'admin@teste.com', perfil: 'Admin', status: 'Ativo' };
const auth = { Authorization: `Bearer ${jwt.sign({ id: admin.id, email: admin.email, perfil: admin.perfil }, JWT_SECRET, { expiresIn: '1h' })}` };

const categoria = { id: 1, nome: 'Infraestrutura' };
const orgaoAtivo = { id: 'EMLURB', nome: 'EMLURB', status: 'Ativo', slahoras: 72 };
const regra = {
  id: 'regra-1',
  categoriaid: 1,
  subcategoria: 'Buraco na via',
  orgaoprincipalid: 'EMLURB',
  orgaosecundarioid: null,
  slahoras: 48,
  prioridade: 'Alta',
  categoria,
  orgao_regra_competencia_orgaoprincipalidToorgao: { id: 'EMLURB', nome: 'EMLURB', sigla: 'EMLURB' },
  orgao_regra_competencia_orgaosecundarioidToorgao: null,
};

function mockAdminSession() {
  prisma.usuario.findUnique.mockImplementation((async ({ where }: any) => (where.id === admin.id ? admin : null)) as any);
}

function mockRegraValida() {
  prisma.categoria.findUnique.mockResolvedValue(categoria as any);
  prisma.orgao.findUnique.mockResolvedValue(orgaoAtivo as any);
  prisma.orgao_categoria.findUnique.mockResolvedValue({ orgaoid: 'EMLURB', categoriaid: 1 } as any);
  prisma.regra_competencia.findUnique.mockResolvedValue(null);
  prisma.regra_competencia.create.mockResolvedValue(regra as any);
}

// TC-65: regras de competência que decidem para qual órgão o chamado vai
describe('Regras de competência (/admin/routing-rules)', () => {
  const body = { categoriaId: 1, subcategoria: 'Buraco na via', orgaoprincipalId: 'EMLURB', prioridade: 'Alta' };

  beforeEach(mockAdminSession);

  describe('POST', () => {
    it('[TC-65] cria a regra herdando o SLA do órgão quando não é informado (201)', async () => {
      mockRegraValida();

      const response = await request(app).post('/admin/routing-rules').set(auth).send(body);

      expect(response.status).toBe(201);
      expect(prisma.regra_competencia.create.mock.calls[0]![0]!.data).toMatchObject({ slahoras: 72, orgaosecundarioid: null, prioridade: 'Alta' });
    });

    it('[TC-65] usa o SLA e o órgão secundário informados', async () => {
      mockRegraValida();

      await request(app).post('/admin/routing-rules').set(auth).send({ ...body, slaHoras: 24, orgaosecundarioId: 'COMPESA' });

      expect(prisma.regra_competencia.create.mock.calls[0]![0]!.data).toMatchObject({ slahoras: 24, orgaosecundarioid: 'COMPESA' });
    });

    it.each([
      ['sem categoria', { ...body, categoriaId: undefined }, 400, /obrigatórios/],
      ['prioridade inválida', { ...body, prioridade: 'Urgentissima' }, 400, /Prioridade inválida/],
    ])('[TC-65] recusa %s', async (_caso, payload, status, message) => {
      const response = await request(app).post('/admin/routing-rules').set(auth).send(payload);

      expect(response.status).toBe(status);
      expect(response.body.error).toMatch(message);
      expect(prisma.regra_competencia.create).not.toHaveBeenCalled();
    });

    it('[TC-65] recusa categoria inexistente (404)', async () => {
      mockRegraValida();
      prisma.categoria.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/admin/routing-rules').set(auth).send(body);

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/Categoria/);
    });

    it('[TC-65] recusa órgão principal inexistente (404) ou inativo (400)', async () => {
      mockRegraValida();
      prisma.orgao.findUnique.mockResolvedValueOnce(null);
      const inexistente = await request(app).post('/admin/routing-rules').set(auth).send(body);

      prisma.orgao.findUnique.mockResolvedValueOnce({ ...orgaoAtivo, status: 'Inativo' } as any);
      const inativo = await request(app).post('/admin/routing-rules').set(auth).send(body);

      expect(inexistente.status).toBe(404);
      expect(inativo.status).toBe(400);
      expect(inativo.body.error).toMatch(/não está ativo/);
    });

    it('[TC-65] recusa órgão secundário inexistente (404)', async () => {
      mockRegraValida();
      prisma.orgao.findUnique.mockResolvedValueOnce(orgaoAtivo as any).mockResolvedValueOnce(null);

      const response = await request(app).post('/admin/routing-rules').set(auth).send({ ...body, orgaosecundarioId: 'NAOEXISTE' });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/secundário/);
    });

    it('[TC-65] recusa categoria que não pertence ao órgão (400)', async () => {
      mockRegraValida();
      prisma.orgao_categoria.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/admin/routing-rules').set(auth).send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/não está vinculada/);
    });

    it('[TC-65] recusa regra duplicada para a mesma categoria e subcategoria (409)', async () => {
      mockRegraValida();
      prisma.regra_competencia.findUnique.mockResolvedValue(regra as any);

      const response = await request(app).post('/admin/routing-rules').set(auth).send(body);

      expect(response.status).toBe(409);
    });
  });

  it('[TC-65] GET lista as regras filtrando por órgão (principal ou secundário) e categoria', async () => {
    prisma.regra_competencia.findMany.mockResolvedValue([regra] as any);
    prisma.regra_competencia.count.mockResolvedValue(1);

    const response = await request(app).get('/admin/routing-rules?organ_id=EMLURB&category_id=1&page=1&limit=10').set(auth);

    expect(response.status).toBe(200);
    expect(response.body.regras[0]).toMatchObject({ id: 'regra-1', sla: 48, orgaoPrincipal: { id: 'EMLURB' }, orgaoSecundario: null });
    expect(response.body.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(prisma.regra_competencia.findMany.mock.calls[0]![0]!.where).toEqual({
      OR: [{ orgaoprincipalid: 'EMLURB' }, { orgaosecundarioid: 'EMLURB' }],
      categoriaid: 1,
    });
  });

  describe('PATCH', () => {
    beforeEach(() => {
      mockRegraValida();
      prisma.regra_competencia.findUnique.mockResolvedValue(regra as any);
      prisma.regra_competencia.findFirst.mockResolvedValue(null);
      prisma.regra_competencia.update.mockResolvedValue({ ...regra, slahoras: 12 } as any);
    });

    it('[TC-65] atualiza só os campos enviados', async () => {
      const response = await request(app)
        .patch('/admin/routing-rules/regra-1')
        .set(auth)
        .send({ slaHoras: '12', prioridade: 'Critica', orgaosecundarioId: 'COMPESA' });

      expect(response.status).toBe(200);
      expect(response.body.sla).toBe(12);
      expect(prisma.regra_competencia.update.mock.calls[0]![0]!.data).toEqual({ slahoras: 12, prioridade: 'Critica', orgaosecundarioid: 'COMPESA' });
    });

    it('[TC-65] pode trocar categoria, subcategoria e órgão principal', async () => {
      await request(app)
        .patch('/admin/routing-rules/regra-1')
        .set(auth)
        .send({ categoriaId: '1', subcategoria: 'Calçada', orgaoprincipalId: 'EMLURB' });

      expect(prisma.regra_competencia.update.mock.calls[0]![0]!.data).toMatchObject({ categoriaid: 1, subcategoria: 'Calçada', orgaoprincipalid: 'EMLURB' });
      expect(prisma.regra_competencia.findFirst.mock.calls[0]![0]!.where).toMatchObject({ NOT: { id: 'regra-1' } });
    });

    it('[TC-65] retorna 404 para regra inexistente', async () => {
      prisma.regra_competencia.findUnique.mockResolvedValue(null);

      const response = await request(app).patch('/admin/routing-rules/nao-existe').set(auth).send({ slaHoras: 1 });

      expect(response.status).toBe(404);
    });

    it.each([
      ['categoria inexistente', () => prisma.categoria.findUnique.mockResolvedValue(null), 404],
      ['órgão principal inexistente', () => prisma.orgao.findUnique.mockResolvedValue(null), 404],
      ['órgão principal inativo', () => prisma.orgao.findUnique.mockResolvedValue({ ...orgaoAtivo, status: 'Inativo' } as any), 400],
      ['categoria fora do órgão', () => prisma.orgao_categoria.findUnique.mockResolvedValue(null), 400],
      ['outra regra igual', () => prisma.regra_competencia.findFirst.mockResolvedValue({ id: 'regra-2' } as any), 409],
    ])('[TC-65] recusa %s', async (_caso, arrange, status) => {
      arrange();

      const response = await request(app).patch('/admin/routing-rules/regra-1').set(auth).send({ slaHoras: 10 });

      expect(response.status).toBe(status);
      expect(prisma.regra_competencia.update).not.toHaveBeenCalled();
    });

    it('[TC-65] recusa órgão secundário inexistente (404)', async () => {
      prisma.orgao.findUnique.mockResolvedValueOnce(orgaoAtivo as any).mockResolvedValueOnce(null);

      const response = await request(app).patch('/admin/routing-rules/regra-1').set(auth).send({ orgaosecundarioId: 'NAOEXISTE' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE', () => {
    it('[TC-65] remove a regra', async () => {
      prisma.regra_competencia.findUnique.mockResolvedValue(regra as any);

      const response = await request(app).delete('/admin/routing-rules/regra-1').set(auth);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prisma.regra_competencia.delete).toHaveBeenCalledWith({ where: { id: 'regra-1' } });
    });

    it('[TC-65] retorna 404 para regra inexistente', async () => {
      prisma.regra_competencia.findUnique.mockResolvedValue(null);

      const response = await request(app).delete('/admin/routing-rules/nao-existe').set(auth);

      expect(response.status).toBe(404);
      expect(prisma.regra_competencia.delete).not.toHaveBeenCalled();
    });
  });
});

// TC-66: ativação, desativação e criação de usuários pelo admin, com trilha de auditoria
describe('Ciclo de vida dos usuários e auditoria (/admin)', () => {
  const cidadao = { id: 'uuid-cidadao', nome: 'Maria', email: 'maria@teste.com', perfil: 'Cidadao', status: 'Ativo' };

  function mockUsuarios(...usuarios: object[]) {
    prisma.usuario.findUnique.mockImplementation((async ({ where }: any) =>
      [admin, ...usuarios].find((u: any) => u.id === where.id || u.email === where.email) ?? null) as any);
  }

  beforeEach(() => {
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
  });

  it('[TC-66] desativa o usuário e registra o status anterior na auditoria', async () => {
    mockUsuarios(cidadao);
    prisma.usuario.update.mockResolvedValue({ ...cidadao, status: 'Inativo' } as any);

    const response = await request(app).patch(`/admin/users/${cidadao.id}/deactivate`).set(auth);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Inativo');
    expect(prisma.audit_logs.create.mock.calls[0]![0]!.data).toMatchObject({
      action: 'user_deactivated',
      entity_id: cidadao.id,
      metadata: { previous_status: 'Ativo' },
    });
  });

  it('[TC-66] reativa um usuário inativo', async () => {
    mockUsuarios({ ...cidadao, status: 'Inativo' });
    prisma.usuario.update.mockResolvedValue(cidadao as any);

    const response = await request(app).patch(`/admin/users/${cidadao.id}/activate`).set(auth);

    expect(response.status).toBe(200);
    expect(prisma.audit_logs.create.mock.calls[0]![0]!.data).toMatchObject({ action: 'user_activated' });
  });

  it.each([
    ['ativar quem já está ativo', 'activate', cidadao, 409],
    ['desativar quem já está inativo', 'deactivate', { ...cidadao, status: 'Inativo' }, 409],
    ['ativar outro admin', 'activate', { ...cidadao, perfil: 'Admin', status: 'Inativo' }, 403],
    ['desativar outro admin', 'deactivate', { ...cidadao, perfil: 'Admin' }, 403],
  ])('[TC-66] não permite %s', async (_caso, acao, usuario, status) => {
    mockUsuarios(usuario);

    const response = await request(app).patch(`/admin/users/${cidadao.id}/${acao}`).set(auth);

    expect(response.status).toBe(status);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('[TC-66] retorna 404 ao ativar ou desativar usuário inexistente', async () => {
    mockUsuarios();

    const ativar = await request(app).patch('/admin/users/nao-existe/activate').set(auth);
    const desativar = await request(app).patch('/admin/users/nao-existe/deactivate').set(auth);

    expect(ativar.status).toBe(404);
    expect(desativar.status).toBe(404);
  });

  it('[TC-66] admin não pode se desativar (403)', async () => {
    // 1ª consulta: sessão (admin); 2ª: alvo, com perfil não-admin para chegar à regra de autodesativação
    prisma.usuario.findUnique.mockResolvedValueOnce(admin as any).mockResolvedValueOnce({ ...admin, perfil: 'Gestor' } as any);

    const response = await request(app).patch(`/admin/users/${admin.id}/deactivate`).set(auth);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/não pode se desativar/);
  });

  it('[TC-66] cria gestor já ativo, com senha criptografada e registro de gestor (201)', async () => {
    mockUsuarios();
    prisma.usuario.create.mockResolvedValue({ id: 'uuid-novo', nome: 'Novo', email: 'novo@teste.com', perfil: 'Gestor', status: 'Ativo' } as any);

    const response = await request(app)
      .post('/admin/users')
      .set(auth)
      .send({ name: 'Novo', email: 'novo@teste.com', password: 'Senha@123', role: 'Gestor' });

    expect(response.status).toBe(201);
    const { data } = prisma.usuario.create.mock.calls[0]![0]! as any;
    expect(data).toMatchObject({ perfil: 'Gestor', status: 'Ativo', atualizadopor: admin.id });
    expect(data.senha).not.toBe('Senha@123');
    expect(prisma.gestor.upsert).toHaveBeenCalled();
  });

  it.each([
    ['campos faltando', { name: 'X' }, 400],
    ['perfil Admin', { name: 'X', email: 'x@t.com', password: 'Senha@123', role: 'Admin' }, 400],
  ])('[TC-66] recusa criação com %s', async (_caso, payload, status) => {
    mockUsuarios();

    const response = await request(app).post('/admin/users').set(auth).send(payload);

    expect(response.status).toBe(status);
  });

  it('[TC-66] recusa e-mail já cadastrado (409)', async () => {
    mockUsuarios(cidadao);

    const response = await request(app)
      .post('/admin/users')
      .set(auth)
      .send({ name: 'Maria', email: cidadao.email, password: 'Senha@123', role: 'Cidadao' });

    expect(response.status).toBe(409);
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('[TC-66] PATCH role recusa perfil fora de Cidadao/Gestor e mudança para o mesmo perfil', async () => {
    mockUsuarios(cidadao);

    const invalido = await request(app).patch(`/admin/users/${cidadao.id}/role`).set(auth).send({ role: 'Root' });
    const igual = await request(app).patch(`/admin/users/${cidadao.id}/role`).set(auth).send({ role: 'Cidadao' });
    const proprio = await request(app).patch(`/admin/users/${admin.id}/role`).set(auth).send({ role: 'Gestor' });
    const inexistente = await request(app).patch('/admin/users/nao-existe/role').set(auth).send({ role: 'Gestor' });

    expect(invalido.status).toBe(400);
    expect(igual.status).toBe(409);
    expect(proprio.status).toBe(403);
    expect(inexistente.status).toBe(404);
  });

  it('[TC-66] GET /admin/audit-logs filtra por ação e admin, com paginação', async () => {
    mockUsuarios();
    prisma.audit_logs.findMany.mockResolvedValue([{ id: 'log-1', action: 'role_change' }] as any);
    prisma.audit_logs.count.mockResolvedValue(1);

    const response = await request(app).get(`/admin/audit-logs?action=role_change&admin_id=${admin.id}&page=2&limit=5`).set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 1, page: 2, limit: 5 });
    expect(prisma.audit_logs.findMany.mock.calls[0]![0]).toMatchObject({ where: { action: 'role_change', admin_id: admin.id }, skip: 5, take: 5 });
  });
});
