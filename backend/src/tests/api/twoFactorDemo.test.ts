import request from 'supertest';
import bcrypt from 'bcryptjs';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../services/mailService', () => ({ mailService: { send: jest.fn() } }));
import { prisma } from '../../config/__mocks__/prisma';

// A flag é lida quando o módulo de env carrega, então precisa existir antes de importar o app
process.env.TWO_FACTOR_DEMO = 'true';
const { app } = require('../../app');

describe('Verificação em duas etapas com TWO_FACTOR_DEMO (API)', () => {
  const senha = 'senhaSegura123';

  afterAll(() => {
    delete process.env.TWO_FACTOR_DEMO;
  });

  it('devolve o código na resposta do login e ele conclui a autenticação', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'usuario-2fa-demo',
      nome: 'Usuário Demo',
      email: 'usuario.demo@example.com',
      senha: bcrypt.hashSync(senha, 10),
      perfil: 'Cidadao',
      status: 'Ativo',
      doisfatores: true,
    } as any);
    prisma.refresh_token.create.mockResolvedValue({} as any);

    const login = await request(app).post('/auth/login').send({ email: 'usuario.demo@example.com', senha });

    expect(login.status).toBe(200);
    expect(login.body.codigo).toMatch(/^\d{6}$/);

    const verificacao = await request(app)
      .post('/auth/login/2fa')
      .send({ desafioId: login.body.desafioId, codigo: login.body.codigo });

    expect(verificacao.status).toBe(200);
    expect(verificacao.body.token).toEqual(expect.any(String));
  });
});
