import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

// TC-64: cadastro, listagem, edição, status e categorias dos órgãos (/admin/organs)
describe('Órgãos (/admin/organs)', () => {
  const admin = { id: 'uuid-admin', nome: 'Admin', email: 'admin@teste.com', perfil: 'Admin', status: 'Ativo' };
  const gestor = { id: 'uuid-gestor', nome: 'Gestor', email: 'gestor@teste.com', perfil: 'Gestor', status: 'Ativo' };
  const tokenOf = (u: typeof admin) => jwt.sign({ id: u.id, email: u.email, perfil: u.perfil }, JWT_SECRET, { expiresIn: '1h' });
  const asAdmin = { Authorization: `Bearer ${tokenOf(admin)}` };

  const orgao = {
    id: 'EMLURB',
    nome: 'Empresa de Manutenção e Limpeza Urbana',
    sigla: 'EMLURB',
    tipo: 'Municipal',
    slahoras: 72,
    responsavel: 'Ana',
    email: 'contato@emlurb.gov.br',
    telefone: null,
    status: 'Ativo',
    orgao_categoria: [{ categoria: { id: 1, nome: 'Infraestrutura' } }, { categoria: { id: 3, nome: 'Iluminação Pública' } }],
  };

  const novoOrgao = {
    id: 'EMLURB',
    nome: orgao.nome,
    sigla: 'EMLURB',
    slahoras: 72,
    responsavel: 'Ana',
    email: orgao.email,
    telefone: '8133334444',
    categorias: [1, 3],
  };

  beforeEach(() => {
    prisma.usuario.findUnique.mockImplementation((async ({ where }: any) =>
      [admin, gestor].find((u) => u.id === where.id) ?? null) as any);
  });

  describe('GET /admin/organs', () => {
    it('[TC-64] lista os órgãos com o SLA padrão e os nomes das categorias, também para gestor', async () => {
      prisma.orgao.findMany.mockResolvedValue([orgao] as any);

      const response = await request(app).get('/admin/organs').set('Authorization', `Bearer ${tokenOf(gestor)}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        expect.objectContaining({ id: 'EMLURB', slaDefault: 72, status: 'ativo', categorias: ['Infraestrutura', 'Iluminação Pública'] }),
      ]);
      expect(prisma.orgao.findMany.mock.calls[0]![0]).not.toHaveProperty('where');
    });

    it('[TC-64] filtra por status ativo ou inativo', async () => {
      prisma.orgao.findMany.mockResolvedValue([]);

      await request(app).get('/admin/organs?status=inativo').set(asAdmin);

      expect(prisma.orgao.findMany.mock.calls[0]![0]).toMatchObject({ where: { status: 'Inativo' } });
    });

    it('[TC-64] recusa filtro de status desconhecido (400)', async () => {
      const response = await request(app).get('/admin/organs?status=suspenso').set(asAdmin);

      expect(response.status).toBe(400);
      expect(prisma.orgao.findMany).not.toHaveBeenCalled();
    });

    it('[TC-64] não é acessível para cidadão (403)', async () => {
      const cidadao = { ...gestor, id: 'uuid-cidadao', perfil: 'Cidadao' };
      prisma.usuario.findUnique.mockResolvedValue(cidadao as any);

      const response = await request(app).get('/admin/organs').set('Authorization', `Bearer ${tokenOf(cidadao)}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /admin/organs', () => {
    it('[TC-64] cadastra o órgão com as categorias, tipo Municipal por padrão, e registra a auditoria (201)', async () => {
      prisma.orgao.findFirst.mockResolvedValue(null);
      prisma.orgao.create.mockResolvedValue({ ...orgao, orgao_categoria: undefined } as any);
      prisma.orgao.findUnique.mockResolvedValue(orgao as any);

      const response = await request(app).post('/admin/organs').set(asAdmin).send(novoOrgao);

      expect(response.status).toBe(201);
      expect(response.body.orgao.id).toBe('EMLURB');
      expect(prisma.orgao.create.mock.calls[0]![0]!.data).toMatchObject({ tipo: 'Municipal', telefone: '8133334444', status: 'Ativo' });
      expect(prisma.orgao_categoria.create).toHaveBeenCalledTimes(2);
      expect(prisma.audit_logs.create.mock.calls[0]![0]!.data).toMatchObject({ action: 'organ_created', admin_id: admin.id });
    });

    it('[TC-64] recusa cadastro sem os campos obrigatórios e não grava nada (400)', async () => {
      const response = await request(app).post('/admin/organs').set(asAdmin).send({ nome: 'Sem sigla', categorias: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Campos obrigatórios faltando: id, sigla, slahoras, responsavel, email, categorias/);
      expect(prisma.orgao.create).not.toHaveBeenCalled();
    });

    it('[TC-64] recusa sigla já cadastrada (409)', async () => {
      prisma.orgao.findFirst.mockResolvedValueOnce(orgao as any);

      const response = await request(app).post('/admin/organs').set(asAdmin).send(novoOrgao);

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/sigla/);
      expect(prisma.orgao.create).not.toHaveBeenCalled();
    });

    it('[TC-64] recusa nome já cadastrado (409)', async () => {
      prisma.orgao.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(orgao as any);

      const response = await request(app).post('/admin/organs').set(asAdmin).send(novoOrgao);

      expect(response.status).toBe(409);
      expect(response.body.message).toMatch(/nome/);
    });

    it('[TC-64] é exclusivo do admin (403 para gestor)', async () => {
      const response = await request(app).post('/admin/organs').set('Authorization', `Bearer ${tokenOf(gestor)}`).send(novoOrgao);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /admin/organs/:id', () => {
    it('[TC-64] edita os dados, substitui as categorias e registra a auditoria', async () => {
      prisma.orgao.findUnique.mockResolvedValue(orgao as any);
      prisma.orgao.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put('/admin/organs/EMLURB')
        .set(asAdmin)
        .send({ nome: 'EMLURB Recife', tipo: 'Estadual', slahoras: 48, responsavel: 'Bia', email: 'novo@emlurb.gov.br', telefone: '81999', categorias: [1] });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: 'EMLURB', status: 'ativo' });
      expect(prisma.orgao.update.mock.calls[0]![0]!.data).toMatchObject({ nome: 'EMLURB Recife', slahoras: 48, tipo: 'Estadual' });
      expect(prisma.orgao_categoria.deleteMany).toHaveBeenCalledWith({ where: { orgaoid: 'EMLURB' } });
      expect(prisma.orgao_categoria.createMany.mock.calls[0]![0]!.data).toEqual([{ orgaoid: 'EMLURB', categoriaid: 1 }]);
      expect(prisma.audit_logs.create.mock.calls[0]![0]!.data).toMatchObject({ action: 'organ_edited', entity_id: 'EMLURB' });
    });

    it('[TC-64] remover todas as categorias não cria vínculos novos', async () => {
      prisma.orgao.findUnique.mockResolvedValue(orgao as any);

      const response = await request(app).put('/admin/organs/EMLURB').set(asAdmin).send({ categorias: [] });

      expect(response.status).toBe(200);
      expect(prisma.orgao_categoria.deleteMany).toHaveBeenCalled();
      expect(prisma.orgao_categoria.createMany).not.toHaveBeenCalled();
    });

    it('[TC-64] retorna 404 para órgão inexistente', async () => {
      prisma.orgao.findUnique.mockResolvedValue(null);

      const response = await request(app).put('/admin/organs/XYZ').set(asAdmin).send({ nome: 'X' });

      expect(response.status).toBe(404);
    });

    it('[TC-64] recusa nome em uso por outro órgão (409)', async () => {
      prisma.orgao.findUnique.mockResolvedValue(orgao as any);
      prisma.orgao.findFirst.mockResolvedValue({ id: 'OUTRO' } as any);

      const response = await request(app).put('/admin/organs/EMLURB').set(asAdmin).send({ nome: 'Nome do outro' });

      expect(response.status).toBe(409);
      expect(prisma.orgao.findFirst.mock.calls[0]![0]!.where).toMatchObject({ NOT: { id: 'EMLURB' } });
      expect(prisma.orgao.update).not.toHaveBeenCalled();
    });
  });

  describe('PUT /admin/organs/:id/:status', () => {
    it('[TC-64] inativa o órgão e devolve o novo status', async () => {
      prisma.orgao.findUnique.mockResolvedValueOnce(orgao as any).mockResolvedValueOnce({ ...orgao, status: 'Inativo' } as any);

      const response = await request(app).put('/admin/organs/EMLURB/inativo').set(asAdmin);

      expect(response.status).toBe(200);
      expect(response.body).toBe('Inativo');
      expect(prisma.orgao.update).toHaveBeenCalledWith({ where: { id: 'EMLURB' }, data: { status: 'Inativo' } });
    });

    it('[TC-64] recusa status desconhecido (400)', async () => {
      const response = await request(app).put('/admin/organs/EMLURB/suspenso').set(asAdmin);

      expect(response.status).toBe(400);
    });

    it('[TC-64] retorna 404 para órgão inexistente', async () => {
      prisma.orgao.findUnique.mockResolvedValue(null);

      const response = await request(app).put('/admin/organs/XYZ/ativo').set(asAdmin);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /admin/organs/:id/categories', () => {
    it('[TC-64] lista as categorias vinculadas ao órgão', async () => {
      prisma.orgao.findUnique.mockResolvedValue(orgao as any);

      const response = await request(app).get('/admin/organs/EMLURB/categories').set(asAdmin);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ id: 1, nome: 'Infraestrutura' }, { id: 3, nome: 'Iluminação Pública' }]);
    });

    it('[TC-64] retorna 404 para órgão inexistente', async () => {
      prisma.orgao.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/admin/organs/XYZ/categories').set(asAdmin);

      expect(response.status).toBe(404);
    });
  });

  it('[TC-64] erro inesperado do banco vira 500 sem expor detalhes', async () => {
    prisma.orgao.findMany.mockRejectedValue(new Error('conexão perdida'));

    const response = await request(app).get('/admin/organs').set(asAdmin);

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toMatch(/conexão perdida/);
  });
});
