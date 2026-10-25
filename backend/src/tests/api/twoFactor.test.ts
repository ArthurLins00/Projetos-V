import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../../app';

jest.mock('../../config/prisma', () => require('../../config/__mocks__/prisma'));
jest.mock('../../services/mailService', () => ({ mailService: { send: jest.fn() } }));
import { prisma } from '../../config/__mocks__/prisma';
import { mailService } from '../../services/mailService';

const sendMock = mailService.send as jest.Mock;

describe('Verificação em duas etapas por e-mail (API)', () => {
  const senha = 'senhaSegura123';
  let seq = 0;
  let usuario: any;

  const codigoEnviado = (): string => {
    const texto: string = sendMock.mock.calls.at(-1)[2];
    return texto.match(/(\d{6})/)![1];
  };

  const codigoErrado = (codigo: string) => (codigo === '000000' ? '111111' : '000000');

  const iniciarLogin = () => request(app).post('/auth/login').send({ email: usuario.email, senha });

  beforeEach(() => {
    sendMock.mockReset();
    seq += 1;
    usuario = {
      id: `usuario-2fa-${seq}`,
      nome: 'Usuário 2FA',
      email: `usuario.2fa${seq}@example.com`,
      senha: bcrypt.hashSync(senha, 10),
      perfil: 'Cidadao',
      status: 'Ativo',
      doisfatores: true,
      fotourl: null,
      termosversao: 1,
      criadoem: new Date(),
      atualizadoem: new Date(),
    };
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.refresh_token.create.mockResolvedValue({} as any);
  });

  it('não entrega tokens no login e envia o código por e-mail', async () => {
    const response = await iniciarLogin();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      requer2fa: true,
      desafioId: expect.any(String),
      email: usuario.email,
    });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(sendMock).toHaveBeenCalledWith(usuario.email, expect.any(String), expect.stringMatching(/\d{6}/));
  });

  it('autentica com o código correto e não permite reutilizá-lo', async () => {
    const { body } = await iniciarLogin();
    const codigo = codigoEnviado();

    const ok = await request(app).post('/auth/login/2fa').send({ desafioId: body.desafioId, codigo });

    expect(ok.status).toBe(200);
    expect(ok.body.refreshToken).toEqual(expect.any(String));
    expect(jwt.verify(ok.body.token, process.env.JWT_SECRET!)).toMatchObject({ id: usuario.id });

    const reuso = await request(app).post('/auth/login/2fa').send({ desafioId: body.desafioId, codigo });
    expect(reuso.status).toBe(400);
  });

  it('rejeita código incorreto e invalida o desafio após 5 tentativas', async () => {
    const { body } = await iniciarLogin();
    const codigo = codigoEnviado();

    for (let i = 0; i < 5; i++) {
      const errado = await request(app)
        .post('/auth/login/2fa')
        .send({ desafioId: body.desafioId, codigo: codigoErrado(codigo) });
      expect(errado.status).toBe(400);
    }

    const response = await request(app).post('/auth/login/2fa').send({ desafioId: body.desafioId, codigo });
    expect(response.status).toBe(400);
  });

  it('rejeita desafio desconhecido', async () => {
    const response = await request(app)
      .post('/auth/login/2fa')
      .send({ desafioId: 'inexistente', codigo: '123456' });

    expect(response.status).toBe(400);
  });

  it('limita o reenvio do código a um por minuto', async () => {
    const { body } = await iniciarLogin();

    const response = await request(app).post('/auth/login/2fa/resend').send({ desafioId: body.desafioId });

    expect(response.status).toBe(429);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('mantém o login direto para quem não ativou a verificação', async () => {
    usuario.doisfatores = false;

    const response = await iniciarLogin();

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(sendMock).not.toHaveBeenCalled();
  });

  describe('PUT /auth/me/two-factor', () => {
    const tokenDe = (u: any) => jwt.sign({ id: u.id, email: u.email, perfil: u.perfil }, process.env.JWT_SECRET!);

    it('ativa a verificação com a senha atual', async () => {
      usuario.doisfatores = false;
      prisma.usuario.update.mockResolvedValue({ ...usuario, doisfatores: true });

      const response = await request(app)
        .put('/auth/me/two-factor')
        .set('Authorization', `Bearer ${tokenDe(usuario)}`)
        .send({ ativo: true, senhaAtual: senha });

      expect(response.status).toBe(200);
      expect(response.body.doisfatores).toBe(true);
      expect(prisma.usuario.update.mock.calls[0][0].data).toMatchObject({ doisfatores: true });
    });

    it('recusa a alteração com senha incorreta', async () => {
      const response = await request(app)
        .put('/auth/me/two-factor')
        .set('Authorization', `Bearer ${tokenDe(usuario)}`)
        .send({ ativo: false, senhaAtual: 'senhaErrada' });

      expect(response.status).toBe(401);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('exige o campo ativo booleano', async () => {
      const response = await request(app)
        .put('/auth/me/two-factor')
        .set('Authorization', `Bearer ${tokenDe(usuario)}`)
        .send({ ativo: 'sim', senhaAtual: senha });

      expect(response.status).toBe(400);
    });
  });
});
