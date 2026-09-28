// Este arquivo é executado antes de todos os testes
import { prisma } from '../config/__mocks__/prisma';

// O segredo precisa existir antes dos módulos da aplicação serem carregados.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Instrui o Jest a sempre utilizar a versão mockada do arquivo prisma.ts
jest.mock('../config/prisma');

afterAll(() => {
  // Limpeza após os testes
  jest.clearAllMocks();
});
