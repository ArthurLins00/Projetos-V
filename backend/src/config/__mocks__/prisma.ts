import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';

// Cria um mock profundo de todos os métodos do Prisma Client
export const prisma = mockDeep<PrismaClient>();
export const connectPrisma = jest.fn();
export const disconnectPrisma = jest.fn();

// O reset garante que nenhum estado/chamada vaze entre um teste e outro
beforeEach(() => {
  mockReset(prisma);
  connectPrisma.mockClear();
  disconnectPrisma.mockClear();
});
