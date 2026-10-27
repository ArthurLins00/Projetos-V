import request from 'supertest';
import bcrypt from 'bcryptjs';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
import { prisma } from '../../config/__mocks__/prisma';

// A flag é lida quando o módulo de env carrega, então precisa existir antes de importar o app
process.env.DEMO_MODE = 'true';
const { app } = require('../../app');

describe('Cadastro com DEMO_MODE: senha já usada por outra conta (API)', () => {
  const ROUTE = '/auth/register';
  const novo = { nome: 'Nova Pessoa', email: 'nova@example.com', senha: 'senhaRepetida1' };

  beforeEach(() => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    prisma.usuario.findMany.mockResolvedValue([
      { email: 'outra@example.com', senha: bcrypt.hashSync('outraSenha1', 4) },
      { email: 'dono@example.com', senha: bcrypt.hashSync('senhaRepetida1', 4) },
    ] as any);
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
    prisma.usuario.create.mockResolvedValue({ id: 'uuid-novo', ...novo, perfil: 'Cidadao' } as any);
    prisma.cidadao.create.mockResolvedValue({} as any);
  });

  afterAll(() => {
    delete process.env.DEMO_MODE;
  });

  it('avisa qual conta já usa a senha e não cria o usuário', async () => {
    const response = await request(app).post(ROUTE).send(novo);

    expect(response.status).toBe(409);
    expect(response.body.details).toEqual({ senhaEmUso: { email: 'dono@example.com', senha: 'senhaRepetida1' } });
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });

  it('cria o usuário quando a pessoa decide prosseguir assim mesmo', async () => {
    const response = await request(app).post(ROUTE).send({ ...novo, ignorarSenhaRepetida: true });

    expect(response.status).toBe(201);
    expect(prisma.usuario.create).toHaveBeenCalled();
  });

  it('cria o usuário direto quando a senha não se repete', async () => {
    const response = await request(app).post(ROUTE).send({ ...novo, senha: 'senhaInedita9' });

    expect(response.status).toBe(201);
  });
});
