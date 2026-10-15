import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../app';
import { JWT_SECRET } from '../../config/env';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../utils/cache', () => ({ invalidateMetricsCache: jest.fn() }));
import { prisma } from '../../config/__mocks__/prisma';

describe('API de Demandas (/demands)', () => {
  const cidadao = { id: 'cidadao-1', nome: 'Cidadão', email: 'cidadao@example.com', perfil: 'Cidadao', status: 'Ativo' };
  const tokenCidadao = jwt.sign({ id: cidadao.id, email: cidadao.email, perfil: cidadao.perfil }, JWT_SECRET, {
    expiresIn: '1h',
  });

  const chamado = {
    id: 'chamado-1',
    protocolo: 'DEM-20260101-ABCD',
    subcategoria: 'Poste apagado',
    descricao: 'Rua escura à noite',
    status: 'Aberto',
    endereco: 'Rua das Flores, 123',
    latitude: -8.05,
    longitude: -34.9,
    cidadaoid: cidadao.id,
    gestorid: null,
    categoria: { id: 3, nome: 'Iluminação Pública' },
    cidadao: { usuario: { id: cidadao.id, nome: cidadao.nome, email: cidadao.email } },
    timeline_event: [],
    criadoem: new Date('2026-01-01T10:00:00Z'),
    atualizadoem: new Date('2026-01-01T10:00:00Z'),
  };

  const auth = { Authorization: `Bearer ${tokenCidadao}` };

  beforeEach(() => {
    prisma.usuario.findUnique.mockResolvedValue(cidadao as any);
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
  });

  it('exige autenticação (401 sem token)', async () => {
    const response = await request(app).get('/demands');

    expect(response.status).toBe(401);
  });

  it('GET /demands lista com paginação e repassa a pesquisa para o banco', async () => {
    prisma.chamado.findMany.mockResolvedValue([chamado] as any);
    prisma.chamado.count.mockResolvedValue(1);

    const response = await request(app).get('/demands?busca=poste&page=1&limit=10').set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(response.body.data[0]).toMatchObject({
      id: 'chamado-1',
      title: 'Poste apagado',
      category: { id: 3, nome: 'Iluminação Pública' },
      photoUrl: null,
    });
    const { where } = prisma.chamado.findMany.mock.calls[0][0] as any;
    expect(where.OR).toHaveLength(5);
  });

  it('GET /demands ignora pesquisa vazia', async () => {
    prisma.chamado.findMany.mockResolvedValue([]);
    prisma.chamado.count.mockResolvedValue(0);

    await request(app).get('/demands?busca=%20%20').set(auth);

    const { where } = prisma.chamado.findMany.mock.calls[0][0] as any;
    expect(where.OR).toBeUndefined();
  });

  it('GET /demands/:id retorna a demanda com histórico', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);

    const response = await request(app).get('/demands/chamado-1').set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'chamado-1', protocolo: 'DEM-20260101-ABCD', logs: [] });
  });

  it('GET /demands/:id bloqueia acesso à demanda de outro cidadão (403)', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ ...chamado, cidadaoid: 'outro-cidadao' } as any);

    const response = await request(app).get('/demands/chamado-1').set(auth);

    expect(response.status).toBe(403);
  });

  it('POST /demands valida campos obrigatórios (400)', async () => {
    const response = await request(app).post('/demands').set(auth).send({ title: 'Sem descrição' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Campos obrigatórios/i);
    expect(prisma.chamado.create).not.toHaveBeenCalled();
  });

  it('POST /demands rejeita categoria inexistente ou inativa (400)', async () => {
    prisma.categoria.findUnique.mockResolvedValue(null);

    const response = await request(app).post('/demands').set(auth).send({
      title: 'Poste apagado',
      description: 'Rua escura',
      category_id: 999,
      location: 'Rua A, 1',
      latitude: -8.05,
      longitude: -34.9,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Categoria inválida/i);
  });

  it.each([
    [{ state: 'XX' }, /Estado inválido/i],
    [{ state: 'PE', city: '   ' }, /Cidade/i],
    [{ state: 'PE', city: 'Recife', zone: 'Litoral' }, /Zona inválida/i],
  ])('POST /demands valida estado, cidade e zona %j (400)', async (region, mensagem) => {
    const response = await request(app).post('/demands').set(auth).send({
      title: 'Poste apagado',
      description: 'Rua escura',
      category_id: 1,
      location: 'Rua A, 1',
      ...region,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(mensagem);
    expect(prisma.chamado.create).not.toHaveBeenCalled();
  });

  it('DELETE /demands/:id: cidadão remove a própria demanda (204)', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);

    const response = await request(app).delete('/demands/chamado-1').set(auth);

    expect(response.status).toBe(204);
    expect(prisma.chamado.update).toHaveBeenCalledWith({ where: { id: 'chamado-1' }, data: { status: 'Fechado' } });
  });

  it('DELETE /demands/:id: cidadão não remove demanda de outra pessoa (403)', async () => {
    prisma.chamado.findUnique.mockResolvedValue({ ...chamado, cidadaoid: 'outro-cidadao' } as any);

    const response = await request(app).delete('/demands/chamado-1').set(auth);

    expect(response.status).toBe(403);
    expect(prisma.chamado.update).not.toHaveBeenCalled();
  });

  it('POST /demands/:id/photos exige o campo photo (400)', async () => {
    const response = await request(app).post('/demands/chamado-1/photos').set(auth).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/photo/i);
  });

  it('POST /demands/:id/photos recusa arquivo que não é imagem (422)', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);
    prisma.chamado_foto.count.mockResolvedValue(0);

    const response = await request(app)
      .post('/demands/chamado-1/photos')
      .set(auth)
      .send({ photo: Buffer.from('texto qualquer').toString('base64') });

    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/Formato de imagem inválido/i);
  });

  it('POST /demands/:id/photos aceita corpo maior que o limite padrão de 100kb', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);
    prisma.chamado_foto.count.mockResolvedValue(0);
    const grande = Buffer.alloc(300 * 1024, 1).toString('base64');

    const response = await request(app).post('/demands/chamado-1/photos').set(auth).send({ photo: grande });

    // Passou pelo parser (não é 413) e chegou à validação do conteúdo
    expect(response.status).toBe(422);
    expect(response.body.error).toMatch(/Formato de imagem inválido/i);
  });

  it('DELETE /demands/:id/photos/:photoId remove a foto (204)', async () => {
    prisma.chamado.findUnique.mockResolvedValue(chamado as any);
    prisma.chamado_foto.findFirst.mockResolvedValue({ id: 'foto-1', chamadoid: 'chamado-1', url: '/uploads/nao-existe.jpg' } as any);

    const response = await request(app).delete('/demands/chamado-1/photos/foto-1').set(auth);

    expect(response.status).toBe(204);
    expect(prisma.chamado_foto.delete).toHaveBeenCalledWith({ where: { id: 'foto-1' } });
  });

  it('GET /categories lista as categorias ativas', async () => {
    prisma.categoria.findMany.mockResolvedValue([{ id: 1, nome: 'Infraestrutura', descricao: null }] as any);

    const response = await request(app).get('/categories').set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 1, nome: 'Infraestrutura', descricao: null }]);
  });

  describe('limite de tamanho da foto (TC-12)', () => {
    const LIMITE = 15 * 1024 * 1024;
    // Corpo JSON com exatamente `bytes` bytes: {"photo":"AAAA..."}
    const corpoCom = (bytes: number) => `{"photo":"${'A'.repeat(bytes - '{"photo":""}'.length)}"}`;

    beforeEach(() => {
      prisma.chamado.findUnique.mockResolvedValue(chamado as any);
      prisma.chamado_foto.count.mockResolvedValue(0);
    });

    it('corpo exatamente no limite de 15 MB passa pelo parser e chega à validação da imagem', async () => {
      const response = await request(app)
        .post('/demands/chamado-1/photos')
        .set(auth)
        .set('Content-Type', 'application/json')
        .send(corpoCom(LIMITE));

      expect(response.status).toBe(422);
    });

    it('1 byte acima do limite retorna 413 e nada é gravado', async () => {
      const response = await request(app)
        .post('/demands/chamado-1/photos')
        .set(auth)
        .set('Content-Type', 'application/json')
        .send(corpoCom(LIMITE + 1));

      expect(response.status).toBe(413);
      expect(response.body.error).toMatch(/muito grande/i);
      expect(prisma.chamado_foto.create).not.toHaveBeenCalled();
    });
  });

  it('TC-13: POST /demands/:id/photos em demanda inexistente retorna 404 e nada é gravado', async () => {
    prisma.chamado.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post('/demands/nao-existe/photos')
      .set(auth)
      .send({ photo: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString('base64') });

    expect(response.status).toBe(404);
    expect(prisma.chamado_foto.create).not.toHaveBeenCalled();
  });

  describe('roteamento na criação', () => {
    const payload = { title: 'Poste apagado', description: 'Rua escura', category_id: 3, location: 'Rua A, 1' };

    beforeEach(() => {
      prisma.categoria.findUnique.mockResolvedValue({ id: 3, nome: 'Iluminação Pública', ativo: true } as any);
      prisma.cidadao.findUnique.mockResolvedValue({ id: cidadao.id } as any);
      prisma.chamado.create.mockImplementation((async ({ data }: any) => ({
        id: 'novo',
        status: 'Aberto',
        criadoem: new Date(),
        categoria: { id: 3, nome: 'Iluminação Pública' },
        ...data,
      })) as any);
    });

    it('TC-17: chamado sem coordenadas é aceito e roteado pela categoria', async () => {
      prisma.regra_competencia.findFirst.mockResolvedValue(null);
      prisma.orgao_categoria.findFirst.mockResolvedValue({ orgaoid: 'EMLURB', orgao: { id: 'EMLURB', slahoras: 72 } } as any);

      const response = await request(app).post('/demands').set(auth).send(payload);

      expect(response.status).toBe(201);
      expect(response.body.protocolo).toMatch(/^DEM-\d{8}-[A-Z0-9]{4}$/);
      const { data } = prisma.chamado.create.mock.calls[0][0] as any;
      expect(data.orgaoid).toBe('EMLURB');
      expect(data.slahoras).toBe(72);
    });

    it('TC-44: órgão inativo nunca recebe o chamado, nem pela regra de competência nem pelo vínculo com a categoria', async () => {
      // O banco só tem regra e vínculo apontando para um órgão inativo: quem filtra por órgão ativo não encontra nada
      const filtraOrgaoAtivo = (where: any) =>
        where?.orgao_regra_competencia_orgaoprincipalidToorgao?.status === 'Ativo' || where?.orgao?.status === 'Ativo';
      prisma.regra_competencia.findFirst.mockImplementation((async ({ where }: any) =>
        filtraOrgaoAtivo(where) ? null : { orgaoprincipalid: 'INATIVO', prioridade: 'Alta', slahoras: 24 }) as any);
      prisma.orgao_categoria.findFirst.mockImplementation((async ({ where }: any) =>
        filtraOrgaoAtivo(where) ? null : { orgaoid: 'INATIVO', orgao: { id: 'INATIVO', slahoras: 24 } }) as any);
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      const response = await request(app).post('/demands').set(auth).send(payload);

      expect(response.status).toBe(201);
      const { data } = prisma.chamado.create.mock.calls[0][0] as any;
      expect(data.orgaoid).not.toBe('INATIVO');
    });
  });

  it('TC-28: listagem devolve payload enxuto, sem relacionamentos completos do Prisma', async () => {
    prisma.chamado.findMany.mockResolvedValue([
      { ...chamado, categoriaid: 3, orgaoid: 'EMLURB', uf: 'PE', cidade: 'Recife', zona: 'Urbana', chamado_foto: [{ url: '/uploads/a.jpg' }], slahoras: 48, sladeadline: new Date() },
    ] as any);
    prisma.chamado.count.mockResolvedValue(1);

    const response = await request(app).get('/demands').set(auth);

    expect(response.status).toBe(200);
    const [item] = response.body.data;
    for (const campo of ['cidadao', 'timeline_event', 'chamado_foto', 'photos', 'cidadaoid', 'categoriaid', 'orgaoid', 'gestorid']) {
      expect(item).not.toHaveProperty(campo);
    }
    expect(Object.keys(item.creator).sort()).toEqual(['email', 'id', 'nome']);
    expect(Object.keys(item.category).sort()).toEqual(['id', 'nome']);
    expect(item.photoUrl).toBe('/uploads/a.jpg');
  });
});
