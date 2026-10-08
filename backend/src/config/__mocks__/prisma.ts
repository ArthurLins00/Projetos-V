import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';

export const prisma = mockDeep<PrismaClient>();
export const connectPrisma = jest.fn();
export const disconnectPrisma = jest.fn();

beforeEach(() => {
  mockReset(prisma);
  connectPrisma.mockClear();
  disconnectPrisma.mockClear();
});
