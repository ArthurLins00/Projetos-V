import request from 'supertest';
import { app } from '../app';

// Mocks do Prisma
jest.mock('../config/prisma', () => require('../config/__mocks__/prisma'));
import { prisma } from '../config/__mocks__/prisma';

describe('POST /auth/register', () => {
  const ROUTE = '/auth/register';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock básico: por padrão, o e-mail não existe no banco
    prisma.usuario.findUnique.mockResolvedValue(null);

    // Precisamos mockar a transação para executar os callbacks passando o próprio mock do prisma
    // Isso permite que o código real chame tx.usuario.create e tx.cidadao.create usando nossos mocks
    prisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback(prisma);
    });

    prisma.usuario.create.mockResolvedValue({
      id: 'uuid-123',
      nome: 'Usuário Teste',
      email: 'teste@exemplo.com',
      perfil: 'Cidadao', // O perfil DEVE ser forçado pelo backend
      status: 'Ativo',
    } as any);

    prisma.cidadao.create.mockResolvedValue({} as any);
  });

  // -------------------------------------------------------------
  // Cenário 1: Caminho Feliz (201)
  // -------------------------------------------------------------
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
    
    // Verifica se o sistema blindou o perfil
    expect(response.body.perfil).toBe('Cidadao');
    
    // Garante que o banco foi chamado com o perfil Cidadão hardcoded
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ perfil: 'Cidadao' }),
      })
    );
  });

  // -------------------------------------------------------------
  // Cenário 2: Segurança (Prevenção contra Escalada de Privilégio)
  // -------------------------------------------------------------
  it('deve IGNORAR tentativa de injeção e registrar o usuário como Cidadão mesmo enviando perfil de Admin', async () => {
    const response = await request(app)
      .post(ROUTE)
      .send({
        nome: 'Hacker Invasor',
        email: 'hacker@exemplo.com',
        senha: 'senha-super-segura',
        perfil: 'Admin', // TENTATIVA DE ESCALADA DE PRIVILÉGIO (Injection)
        role: 'Admin',   // Algumas vezes tentam outros nomes de campos comuns
        isAdmin: true,
      });

    // A API bloqueia a escalada de privilégio de forma passiva (ignorando os dados intrusos)
    // O controller desestrutura apenas { nome, email, senha } e joga fora o resto,
    // e o service chumba "Cidadao" no payload do Prisma.
    expect(response.status).toBe(201);
    
    // A verificação mais importante: o perfil resultante DEVE ser Cidadao
    expect(response.body.perfil).toBe('Cidadao');
    expect(response.body.perfil).not.toBe('Admin');

    // Valida que o objeto persistido no banco foi criado como Cidadão (blindagem no service)
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ perfil: 'Cidadao' }),
      })
    );
  });

  // -------------------------------------------------------------
  // Cenário 3: Erro 409 (E-mail já cadastrado)
  // -------------------------------------------------------------
  it('deve retornar 409 quando tentar registrar um e-mail já existente', async () => {
    // Preparação: Mocka para simular que o e-mail já foi achado no banco
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
    
    // Garante que não tentou criar no banco
    expect(prisma.usuario.create).not.toHaveBeenCalled();
  });
});
