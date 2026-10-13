import request from 'supertest';
import { app } from '../../app';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

describe('POST /auth/register', () => {
  const ROUTE = '/auth/register';

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.usuario.findUnique.mockResolvedValue(null);

    prisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback(prisma);
    });

    prisma.usuario.create.mockResolvedValue({
      id: 'uuid-123',
      nome: 'Usuário Teste',
      email: 'teste@exemplo.com',
      perfil: 'Cidadao',
      status: 'Ativo',
    } as any);

    prisma.cidadao.create.mockResolvedValue({} as any);
  });

  it('deve registrar o usuário com sucesso (201) e forçar o perfil como Cidadão', async () => {
    const response = await request(app)
      .post(ROUTE)
      .send({
        nome: 'Usuário Teste',
        email: 'teste@exemplo.com',
        senha: 'senha-super-segura',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.nome).toBe('Usuário Teste');
    
    expect(response.body.perfil).toBe('Cidadao');
    
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ perfil: 'Cidadao' }),
      })
    );
  });

  it('deve IGNORAR tentativa de injeção e registrar o usuário como Cidadão mesmo enviando perfil de Admin', async () => {
    const response = await request(app)
      .post(ROUTE)
      .send({
        nome: 'Hacker Invasor',
        email: 'hacker@exemplo.com',
        senha: 'senha-super-segura',
        perfil: 'Admin',
        role: 'Admin',
        isAdmin: true,
      });

    expect(response.status).toBe(201);
    
    expect(response.body.perfil).toBe('Cidadao');
    expect(response.body.perfil).not.toBe('Admin');

    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ perfil: 'Cidadao' }),
      })
    );
  });

  it('deve retornar 409 quando tentar registrar um e-mail já existente', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'existente' } as any);

    const response = await request(app)
      .post(ROUTE)
      .send({
        nome: 'Outro Usuário',
        email: 'jaexiste@exemplo.com',
        senha: 'senha-super-segura',
      });

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toMatch(/E-mail já cadastrado/i);
    
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });
});
