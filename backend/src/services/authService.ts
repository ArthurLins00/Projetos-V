import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppError } from '../middlewares/errorMiddleware';
import { prisma } from '../config/prisma';
import { JWT_SECRET, JWT_EXPIRATION } from '../config/env';
import { mailService } from './mailService';
import { promises as fs } from 'fs';
import path from 'path';
import { UPLOADS_DIR, UPLOADS_ROUTE } from '../config/uploads';
import { detectImageExtension } from '../utils/image';

const tokenBlocklist = new Set<string>();

const PROFILE_SELECT = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  status: true,
  fotourl: true,
  termosversao: true,
  criadoem: true,
} as const;

async function deleteUploadedFile(url: string | null) {
  if (url?.startsWith(`${UPLOADS_ROUTE}/`)) {
    await fs.unlink(path.join(UPLOADS_DIR, path.basename(url))).catch(() => undefined);
  }
}

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_CODE_RESEND_MS = 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;

type ResetCode = { hash: string; expiresAt: number; createdAt: number; attempts: number };
const resetCodes = new Map<string, ResetCode>();

const hashCode = (code: string) => createHash('sha256').update(code).digest();

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
      select: PROFILE_SELECT,
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
      select: PROFILE_SELECT,
    });
  },

  async updatePhoto(userId: string, base64: string) {
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const extension = detectImageExtension(buffer);
    if (!extension) throw new AppError(400, 'Formato de imagem inválido. Envie JPEG ou PNG.');

    const fileName = `avatar-${userId}-${Date.now()}.${extension}`;
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_DIR, fileName), buffer);

    const atualizado = await prisma.usuario.update({
      where: { id: userId },
      data: { fotourl: `${UPLOADS_ROUTE}/${fileName}`, atualizadoem: new Date(), atualizadopor: userId },
      select: PROFILE_SELECT,
    });

    await deleteUploadedFile(usuario.fotourl);

    return atualizado;
  },

  async acceptTerms(userId: string, versao: number) {
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    if (usuario.termosversao !== null && usuario.termosversao >= versao) {
      return prisma.usuario.findUnique({ where: { id: userId }, select: PROFILE_SELECT });
    }

    return prisma.usuario.update({
      where: { id: userId },
      data: { termosversao: versao, termosaceitoem: new Date() },
      select: PROFILE_SELECT,
    });
  },

  async removePhoto(userId: string) {
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });

    if (!usuario) {
      throw new AppError(404, 'Usuário não encontrado.');
    }

    const atualizado = await prisma.usuario.update({
      where: { id: userId },
      data: { fotourl: null, atualizadoem: new Date(), atualizadopor: userId },
      select: PROFILE_SELECT,
    });

    await deleteUploadedFile(usuario.fotourl);

    return atualizado;
  },

  async requestPasswordReset(email: string) {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario || usuario.status !== 'Ativo') {
      return;
    }

    const existente = resetCodes.get(email);
    if (existente && Date.now() - existente.createdAt < RESET_CODE_RESEND_MS) {
      return;
    }

    const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const now = Date.now();
    resetCodes.set(email, {
      hash: hashCode(codigo).toString('hex'),
      createdAt: now,
      expiresAt: now + RESET_CODE_TTL_MS,
      attempts: 0,
    });

    await mailService.send(
      email,
      'Fiscalize — código de recuperação de senha',
      `Olá, ${usuario.nome}.\n\nSeu código para redefinir a senha é: ${codigo}\n\n` +
        'Ele expira em 15 minutos. Se você não solicitou a recuperação, ignore este e-mail.'
    );
  },

  async resetPassword(email: string, codigo: string, novaSenha: string) {
    const invalido = new AppError(400, 'Código inválido ou expirado.');
    const registro = resetCodes.get(email);

    if (!registro || registro.expiresAt < Date.now()) {
      resetCodes.delete(email);
      throw invalido;
    }

    registro.attempts += 1;
    if (registro.attempts > RESET_CODE_MAX_ATTEMPTS) {
      resetCodes.delete(email);
      throw invalido;
    }

    if (!timingSafeEqual(hashCode(codigo), Buffer.from(registro.hash, 'hex'))) {
      throw invalido;
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || usuario.status !== 'Ativo') {
      resetCodes.delete(email);
      throw invalido;
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senha: await bcrypt.hash(novaSenha, 10),
        atualizadoem: new Date(),
        atualizadopor: usuario.id,
      },
    });

    resetCodes.delete(email);
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