import { prisma } from '../config/__mocks__/prisma';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
// Fixados aqui para que o .env de quem roda os testes não altere a validade das sessões
process.env.JWT_EXPIRATION = '15m';
process.env.REFRESH_TOKEN_TTL_DAYS = '30';
// Vazio (e não removido) para o dotenv não trazer o REDIS_URL do .env: os contadores do rate limit e do
// bloqueio de login ficam na memória e são zerados antes de cada teste
process.env.REDIS_URL = '';

jest.mock('../config/prisma');

// require aqui (e não import no topo) para não carregar o módulo antes dos jest.mock de cada arquivo
beforeEach(() => {
  require('../utils/attemptStore').attemptStore.resetMemory();
});

afterAll(() => {
  jest.clearAllMocks();
});
