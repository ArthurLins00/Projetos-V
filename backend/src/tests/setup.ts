import { prisma } from '../config/__mocks__/prisma';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

jest.mock('../config/prisma');

afterAll(() => {
  jest.clearAllMocks();
});
