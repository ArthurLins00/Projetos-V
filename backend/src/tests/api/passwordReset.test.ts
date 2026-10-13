import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../app';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../services/mailService', () => ({ mailService: { send: jest.fn() } }));
import { prisma } from '../../config/__mocks__/prisma';
import { mailService } from '../../services/mailService';

const sendMock = mailService.send as jest.Mock;

describe('Recuperação de senha (API)', () => {
  let seq = 0;
  let usuario: any;

  const codigoEnviado = (): string => {
    const texto: string = sendMock.mock.calls.at(-1)[2];
    return texto.match(/(\d{6})/)![1];
  };

  beforeEach(() => {
    sendMock.mockReset();
    seq += 1;
    usuario = {
      id: `usuario-reset-${seq}`,
      nome: 'Usuário Reset',
      email: `usuario.reset${seq}@example.com`,
      senha: bcrypt.hashSync('senhaAntiga1', 10),
      perfil: 'Cidadao',
      status: 'Ativo',
      criadoem: new Date(),
      atualizadoem: new Date(),
    };
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.usuario.update.mockResolvedValue(usuario);
  });

  it('envia o código e redefine a senha com o código correto', async () => {
    const forgot = await request(app).post('/auth/forgot-password').send({ email: usuario.email });
    expect(forgot.status).toBe(200);
    expect(sendMock).toHaveBeenCalledWith(usuario.email, expect.any(String), expect.any(String));

    const reset = await request(app)
      .post('/auth/reset-password')
      .send({ email: usuario.email, codigo: codigoEnviado(), novaSenha: 'senhaNova123' });

    expect(reset.status).toBe(200);
    const novoHash = prisma.usuario.update.mock.calls[0][0].data.senha as string;
    expect(bcrypt.compareSync('senhaNova123', novoHash)).toBe(true);
  });

  it('responde 200 sem enviar e-mail quando o usuário não existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    const response = await request(app).post('/auth/forgot-password').send({ email: 'ninguem@example.com' });

    expect(response.status).toBe(200);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejeita código incorreto e não permite reutilizar o código', async () => {
    await request(app).post('/auth/forgot-password').send({ email: usuario.email });
    const codigo = codigoEnviado();
    const errado = codigo === '000000' ? '111111' : '000000';

    const invalido = await request(app)
      .post('/auth/reset-password')
      .send({ email: usuario.email, codigo: errado, novaSenha: 'senhaNova123' });
    expect(invalido.status).toBe(400);

    const ok = await request(app)
      .post('/auth/reset-password')
      .send({ email: usuario.email, codigo, novaSenha: 'senhaNova123' });
    expect(ok.status).toBe(200);

    const reuso = await request(app)
      .post('/auth/reset-password')
      .send({ email: usuario.email, codigo, novaSenha: 'outraSenha123' });
    expect(reuso.status).toBe(400);
  });

  it('invalida o código após exceder o limite de tentativas', async () => {
    await request(app).post('/auth/forgot-password').send({ email: usuario.email });
    const codigo = codigoEnviado();
    const errado = codigo === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      await request(app).post('/auth/reset-password').send({ email: usuario.email, codigo: errado, novaSenha: 'senhaNova123' });
    }

    const response = await request(app)
      .post('/auth/reset-password')
      .send({ email: usuario.email, codigo, novaSenha: 'senhaNova123' });
    expect(response.status).toBe(400);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('valida o tamanho mínimo da nova senha', async () => {
    const response = await request(app)
      .post('/auth/reset-password')
      .send({ email: usuario.email, codigo: '123456', novaSenha: '123' });

    expect(response.status).toBe(400);
  });
});
