import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppError } from '../middlewares/errorMiddleware';
import { prisma } from '../config/prisma';
import { JWT_SECRET, JWT_EXPIRATION } from '../config/env';

const tokenBlocklist = new Set<string>();

export const authService = {
  async register(nome: string, email: string, senha: string) {
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
    });

    if (usuarioExistente) {
      throw new AppError(409, 'E-mail já cadastrado.');
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    const usuario = await prisma.$transaction(async (tx: any) => {
      const created = await tx.usuario.create({
        data: {
          nome,
          email,
          senha: hashedPassword,
          perfil: 'Cidadao',
          status: 'Ativo',
        },
      });

      await tx.cidadao.create({
        data: { id: created.id },
      });

      return created;
    });

    return usuario;
  },

  async login(email: string, senha: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new AppError(401, 'Credenciais inválidas.');
    }

    if (usuario.status !== 'Ativo') {
      throw new AppError(
        403,
        'Usuário inativo. Contate o administrador.'
      );
    }

    const isValidPassword = await bcrypt.compare(
      senha,
      usuario.senha
    );

    if (!isValidPassword) {
      throw new AppError(401, 'Credenciais inválidas.');
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        perfil: usuario.perfil,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION, jwtid: randomUUID() } as SignOptions
    );

    return { usuario, token };
  },

  async getUserById(userId: string) {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        status: true,
        criadoem: true,
      },
    });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    return usuario;
  },

  async updateProfile(
    userId: string,
    data: { nome?: string; email?: string; senhaAtual?: string; novaSenha?: string }
  ) {
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    const changingEmail = data.email !== undefined && data.email !== usuario.email;
    const changingPassword = data.novaSenha !== undefined;

    if (changingEmail || changingPassword) {
      if (!data.senhaAtual) {
        throw new AppError(400, 'Informe a senha atual para alterar e-mail ou senha.');
      }
      const isValidPassword = await bcrypt.compare(data.senhaAtual, usuario.senha);
      if (!isValidPassword) {
        throw new AppError(401, 'Senha atual incorreta.');
      }
    }

    if (changingEmail) {
      const emailEmUso = await prisma.usuario.findUnique({ where: { email: data.email! } });
      if (emailEmUso && emailEmUso.id !== userId) {
        throw new AppError(409, 'E-mail já cadastrado.');
      }
    }

    return prisma.usuario.update({
      where: { id: userId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(changingEmail && { email: data.email! }),
        ...(changingPassword && { senha: await bcrypt.hash(data.novaSenha!, 10) }),
        atualizadoem: new Date(),
        atualizadopor: userId,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        status: true,
        criadoem: true,
      },
    });
  },

  async addTokenToBlocklist(token: string) {
    try {
      const decoded = jwt.decode(token) as any;

      if (decoded && decoded.exp) {
        const ttl =
          decoded.exp - Math.floor(Date.now() / 1000);

        if (ttl > 0) {
          tokenBlocklist.add(token);

          setTimeout(() => {
            tokenBlocklist.delete(token);
          }, ttl * 1000).unref();
        }
      }
    } catch (error) {
      console.error(
        'Erro ao adicionar token à blocklist:',
        error
      );
    }
  },

  isTokenBlocked(token: string): boolean {
    return tokenBlocklist.has(token);
  },
};