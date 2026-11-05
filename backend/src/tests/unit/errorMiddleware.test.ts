import type { Request, Response } from 'express';
import { AppError, asyncHandler, errorHandler } from '../../middlewares/errorMiddleware';

function run(error: Error) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
  errorHandler(error, { method: 'POST', originalUrl: '/x' } as Request, res, jest.fn());
  return { status: res.status.mock.calls[0]![0], body: res.json.mock.calls[0]![0] };
}

const prismaError = (code: string) => Object.assign(new Error('prisma'), { name: 'PrismaClientKnownRequestError', code, meta: {} });
const named = (name: string, message = 'msg') => Object.assign(new Error(message), { name });

// TC-70: tradução de erros para respostas HTTP sem vazar detalhes internos
describe('errorMiddleware (unitário)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('AppError usa o status e inclui details quando há', () => {
    expect(run(new AppError(422, 'inválido', { campo: 'x' }))).toMatchObject({ status: 422, body: { error: 'inválido', details: { campo: 'x' } } });
    expect(run(new AppError(404, 'sumiu')).body).not.toHaveProperty('details');
  });

  it.each([
    ['P2002', 409],
    ['P2025', 404],
    ['P2003', 400],
    ['P2011', 400],
    ['P2012', 400],
    ['P2014', 409],
    ['P1000', 503],
    ['P5000', 503],
  ])('erro conhecido do Prisma %s vira %i', (code, status) => {
    const { status: got, body } = run(prismaError(code));

    expect(got).toBe(status);
    expect(body.code).toBe(code);
  });

  it('erro desconhecido do Prisma vira 500 genérico', () => {
    expect(run(prismaError('P9999'))).toMatchObject({ status: 500, body: { error: 'Erro ao processar dados.' } });
  });

  it.each([
    [named('TokenExpiredError'), 401, /expirado/],
    [named('JsonWebTokenError'), 401, /Token inválido/],
    [named('ValidationError', 'campo x'), 400, /campo x/],
    [new Error('E-mail já cadastrado.'), 409, /E-mail já cadastrado/],
    [Object.assign(new Error('big'), { type: 'entity.too.large' }), 413, /muito grande/],
  ])('%s vira %i', (error, status, message) => {
    const result = run(error);

    expect(result.status).toBe(status);
    expect(result.body.error).toMatch(message);
  });

  it('asyncHandler encaminha a rejeição para o next', async () => {
    const next = jest.fn();
    const error = new Error('falhou');

    asyncHandler(async () => {
      throw error;
    })({} as Request, {} as Response, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(error);
  });
});
