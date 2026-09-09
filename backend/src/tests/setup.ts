// Este arquivo é executado antes de todos os testes
import { prisma } from '../config/__mocks__/prisma';

// Instrui o Jest a sempre utilizar a versão mockada do arquivo prisma.ts
jest.mock('../config/prisma');

// Você pode adicionar outras inicializações globais para seus testes aqui
beforeAll(() => {
  // Configurações globais antes de todos os testes (ex: carregar .env.test)
  process.env.JWT_SECRET = 'test-secret';
});

afterAll(() => {
  // Limpeza após os testes
  jest.clearAllMocks();
});
