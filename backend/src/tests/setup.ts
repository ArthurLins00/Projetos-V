import { prisma } from '../config/__mocks__/prisma';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Fixados aqui para que o .env de quem roda os testes não altere a validade das sessões
process.env.JWT_EXPIRATION = '15m';
process.env.REFRESH_TOKEN_TTL_DAYS = '30';

jest.mock('../config/prisma');

afterAll(() => {
  jest.clearAllMocks();
});
