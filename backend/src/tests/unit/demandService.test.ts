import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

// Fotos vão para uma pasta temporária durante os testes
const TMP_UPLOADS = path.join(os.tmpdir(), `fiscalize-uploads-${process.pid}`);
jest.mock('../../config/uploads', () => ({
  UPLOADS_DIR: TMP_UPLOADS,
  UPLOADS_ROUTE: '/uploads',
  PHOTO_BODY_LIMIT: '15mb',
}));
jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../utils/cache', () => ({ invalidateMetricsCache: jest.fn() }));

import { prisma } from '../../config/__mocks__/prisma';
import { demandService } from '../../services/demandService';

const CIDADAO_ID = 'cidadao-1';
const OUTRO_CIDADAO_ID = 'cidadao-2';

function makeChamado(overrides: Record<string, unknown> = {}) {
  return {
    id: 'chamado-1',
    protocolo: 'DEM-20260101-ABCD',
    subcategoria: 'Buraco na via',
    descricao: 'Buraco grande na pista',
    status: 'Aberto',
    endereco: 'Rua das Flores, 123',
    latitude: -8.05,
    longitude: -34.9,
    fotourl: null,
    cidadaoid: CIDADAO_ID,
    gestorid: null,
    categoria: { id: 1, nome: 'Infraestrutura' },
    cidadao: { usuario: { id: CIDADAO_ID, nome: 'Cidadão', email: 'c@x.com' } },
    criadoem: new Date('2026-01-01T10:00:00Z'),
    atualizadoem: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  } as any;
}

// JPEG mínimo válido (assinatura FF D8 FF)
const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64');

describe('demandService (unitário)', () => {
  beforeEach(() => {
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
  });

  afterAll(async () => {
    await fs.rm(TMP_UPLOADS, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------
  // Listagem e pesquisa
  // ---------------------------------------------------------------
  describe('list', () => {
    beforeEach(() => {
      prisma.chamado.findMany.mockResolvedValue([makeChamado()]);
      prisma.chamado.count.mockResolvedValue(1);
    });

    it('cidadão vê só as próprias demandas e, sem filtro, as removidas (Fechado) ficam ocultas', async () => {
      await demandService.list({ userId: CIDADAO_ID, perfil: 'Cidadao', page: 1, limit: 20 });

      const { where } = prisma.chamado.findMany.mock.calls[0][0] as any;
      expect(where.cidadaoid).toBe(CIDADAO_ID);
      expect(where.status).toEqual({ not: 'Fechado' });
    });

    it('filtro de status explícito substitui a regra padrão (permite ver "Removidas")', async () => {
      await demandService.list({ userId: CIDADAO_ID, perfil: 'Cidadao', status: 'Fechado', page: 1, limit: 20 });

      const { where } = prisma.chamado.findMany.mock.calls[0][0] as any;
      expect(where.status).toBe('Fechado');
    });

    it('gestor não fica restrito às próprias demandas', async () => {
      await demandService.list({ userId: 'gestor-1', perfil: 'Gestor', page: 1, limit: 20 });

      const { where } = prisma.chamado.findMany.mock.calls[0][0] as any;
      expect(where.cidadaoid).toBeUndefined();
      expect(where.status).toBeUndefined();
    });

    it('pesquisa textual busca em título, descrição, endereço e protocolo (sem diferenciar maiúsculas)', async () => {
      await demandService.list({ userId: CIDADAO_ID, perfil: 'Cidadao', busca: 'buraco', page: 1, limit: 20 });

      const { where } = prisma.chamado.findMany.mock.calls[0][0] as any;
      const campos = where.OR.map((cond: Record<string, unknown>) => Object.keys(cond)[0]);
      expect(campos).toEqual(['subcategoria', 'descricao', 'endereco', 'protocolo']);
      expect(where.OR[0].subcategoria).toEqual({ contains: 'buraco', mode: 'insensitive' });
    });

    it('aplica paginação e converte o registro para o formato da API', async () => {
      const result = await demandService.list({ userId: CIDADAO_ID, perfil: 'Cidadao', page: 3, limit: 10 });

      const args = prisma.chamado.findMany.mock.calls[0][0] as any;
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
      expect(result).toMatchObject({ total: 1, page: 3, limit: 10, totalPages: 1 });
      expect(result.data[0]).toMatchObject({
        title: 'Buraco na via',
        description: 'Buraco grande na pista',
        location: 'Rua das Flores, 123',
        status: 'Aberto',
        photoUrl: null,
      });
    });
  });

  // ---------------------------------------------------------------
  // Remoção (soft delete)
  // ---------------------------------------------------------------
  describe('deleteDemand', () => {
    it('cidadão dono remove a demanda aberta: status vira Fechado e o histórico é registrado', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado());

      await demandService.deleteDemand('chamado-1', CIDADAO_ID, 'Cidadao');

      expect(prisma.chamado.update).toHaveBeenCalledWith({
        where: { id: 'chamado-1' },
        data: { status: 'Fechado' },
      });
      expect(prisma.timeline_event.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ titulo: 'Demanda removida' }) }),
      );
    });

    it('cidadão não pode remover demanda de outra pessoa (403)', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado({ cidadaoid: OUTRO_CIDADAO_ID }));

      await expect(demandService.deleteDemand('chamado-1', CIDADAO_ID, 'Cidadao')).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(prisma.chamado.update).not.toHaveBeenCalled();
    });

    it.each(['Em_Andamento', 'Resolvido', 'Fechado'])(
      'cidadão não pode remover demanda com status %s (403)',
      async (status) => {
        prisma.chamado.findUnique.mockResolvedValue(makeChamado({ status }));

        await expect(demandService.deleteDemand('chamado-1', CIDADAO_ID, 'Cidadao')).rejects.toMatchObject({
          statusCode: 403,
        });
      },
    );

    it('gestor pode remover demanda de qualquer cidadão', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado({ cidadaoid: OUTRO_CIDADAO_ID, status: 'Em_Andamento' }));

      await demandService.deleteDemand('chamado-1', 'gestor-1', 'Gestor');

      expect(prisma.chamado.update).toHaveBeenCalled();
    });

    it('retorna 404 para demanda inexistente', async () => {
      prisma.chamado.findUnique.mockResolvedValue(null);

      await expect(demandService.deleteDemand('nao-existe', CIDADAO_ID, 'Cidadao')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ---------------------------------------------------------------
  // Edição
  // ---------------------------------------------------------------
  describe('update', () => {
    it('cidadão não pode editar demanda de outra pessoa (403)', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado({ cidadaoid: OUTRO_CIDADAO_ID }));

      await expect(
        demandService.update({ id: 'chamado-1', userId: CIDADAO_ID, title: 'Novo título' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('não permite editar demanda já em andamento (403)', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado({ status: 'Em_Andamento' }));

      await expect(
        demandService.update({ id: 'chamado-1', userId: CIDADAO_ID, title: 'Novo título' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('atualiza os campos enviados e registra o histórico com dados antigos e novos', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado());
      prisma.chamado.update.mockResolvedValue(makeChamado({ subcategoria: 'Novo título' }));
      prisma.usuario.findUnique.mockResolvedValue({ nome: 'Cidadão' } as any);

      const result = await demandService.update({ id: 'chamado-1', userId: CIDADAO_ID, title: 'Novo título' });

      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ subcategoria: 'Novo título' }) }),
      );
      expect(prisma.timeline_event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dadosantigos: expect.objectContaining({ subcategoria: 'Buraco na via' }),
            dadosnovos: expect.objectContaining({ subcategoria: 'Novo título' }),
          }),
        }),
      );
      expect(result.title).toBe('Novo título');
    });
  });

  // ---------------------------------------------------------------
  // Foto da ocorrência
  // ---------------------------------------------------------------
  describe('uploadPhoto', () => {
    it('salva um JPEG válido no disco e grava o caminho em fotourl', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado());

      const { photoUrl } = await demandService.uploadPhoto('chamado-1', CIDADAO_ID, JPEG_BASE64);

      expect(photoUrl).toMatch(/^\/uploads\/chamado-1-\d+\.jpg$/);
      const saved = await fs.readFile(path.join(TMP_UPLOADS, path.basename(photoUrl)));
      expect(saved.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
      expect(prisma.chamado.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fotourl: photoUrl }) }),
      );
    });

    it('aceita o prefixo data URI (data:image/jpeg;base64,...)', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado());

      const { photoUrl } = await demandService.uploadPhoto('chamado-1', CIDADAO_ID, `data:image/jpeg;base64,${JPEG_BASE64}`);

      expect(photoUrl).toMatch(/\.jpg$/);
    });

    it('rejeita conteúdo que não é imagem, mesmo em base64 (400)', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado());
      const texto = Buffer.from('não sou uma imagem').toString('base64');

      await expect(demandService.uploadPhoto('chamado-1', CIDADAO_ID, texto)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(prisma.chamado.update).not.toHaveBeenCalled();
    });

    it('substitui a foto anterior e apaga o arquivo antigo', async () => {
      await fs.mkdir(TMP_UPLOADS, { recursive: true });
      const antigo = path.join(TMP_UPLOADS, 'chamado-1-antigo.jpg');
      await fs.writeFile(antigo, Buffer.from([0xff, 0xd8, 0xff]));
      prisma.chamado.findUnique.mockResolvedValue(makeChamado({ fotourl: '/uploads/chamado-1-antigo.jpg' }));

      await demandService.uploadPhoto('chamado-1', CIDADAO_ID, JPEG_BASE64);

      await expect(fs.access(antigo)).rejects.toThrow();
    });

    it('cidadão não pode enviar foto para demanda de outra pessoa (403)', async () => {
      prisma.chamado.findUnique.mockResolvedValue(makeChamado({ cidadaoid: OUTRO_CIDADAO_ID }));

      await expect(demandService.uploadPhoto('chamado-1', CIDADAO_ID, JPEG_BASE64)).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });
});
