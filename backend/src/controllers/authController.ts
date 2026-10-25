import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import { AppError } from '../middlewares/errorMiddleware';
import { AuthRequest } from '../middlewares/authMiddleware';
import { isProduction } from '../config/env';

function setTokenCookie(res: Response, token: string) {
  const { exp } = jwt.decode(token) as { exp: number };

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: exp * 1000 - Date.now(),
  });
}

type Session = {
  usuario: { id: string; nome: string; email: string; perfil: string; fotourl: string | null; termosversao: number | null };
  token: string;
  refreshToken: string;
};

function sendSession(res: Response, { usuario, token, refreshToken }: Session) {
  setTokenCookie(res, token);

  res.status(200).json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
    fotourl: usuario.fotourl,
    termosversao: usuario.termosversao,
    token,
    refreshToken,
  });
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { nome, email, senha, ignorarSenhaRepetida } = req.body;
      
      if (!nome || !email || !senha) {
        throw new AppError(400, 'Campos obrigatórios: nome, email, senha');
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError(400, 'E-mail inválido');
      }
      
      if (senha.length < 6) {
        throw new AppError(400, 'Senha deve ter no mínimo 6 caracteres');
      }
      
      const usuario = await authService.register(nome, email, senha, ignorarSenhaRepetida === true);
      
      res.status(201).json({ id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha } = req.body;
      
      if (!email || !senha) {
        throw new AppError(400, 'Campos obrigatórios: email, senha');
      }
      
      const resultado = await authService.login(email, senha);

      if ('desafioId' in resultado) {
        res.status(200).json({
          requer2fa: true,
          desafioId: resultado.desafioId,
          email: resultado.usuario.email,
          ...(resultado.codigo && { codigo: resultado.codigo }),
        });
        return;
      }

      sendSession(res, resultado);
    } catch (error) {
      next(error);
    }
  },

  async verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const { desafioId, codigo } = req.body ?? {};

      if (!desafioId || !codigo) {
        throw new AppError(400, 'Campos obrigatórios: desafioId, codigo');
      }

      if (typeof desafioId !== 'string' || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo.trim())) {
        throw new AppError(400, 'Código inválido ou expirado.');
      }

      sendSession(res, await authService.verifyTwoFactor(desafioId, codigo.trim()));
    } catch (error) {
      next(error);
    }
  },

  async resendTwoFactor(req: Request, res: Response, next: NextFunction) {
    try {
      const { desafioId } = req.body ?? {};

      if (!desafioId || typeof desafioId !== 'string') {
        throw new AppError(400, 'Campo obrigatório: desafioId');
      }

      const { codigo } = await authService.resendTwoFactor(desafioId);

      res.status(200).json({ message: 'Enviamos um novo código para o seu e-mail.', ...(codigo && { codigo }) });
    } catch (error) {
      next(error);
    }
  },

  async updateTwoFactor(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      const { ativo, senhaAtual } = req.body ?? {};

      if (typeof ativo !== 'boolean') {
        throw new AppError(400, 'Campo obrigatório: ativo (booleano)');
      }

      if (!senhaAtual || typeof senhaAtual !== 'string') {
        throw new AppError(400, 'Informe a senha atual para alterar a verificação em duas etapas.');
      }

      const usuario = await authService.setTwoFactor(usuarioId, ativo, senhaAtual);

      res.status(200).json(usuario);
    } catch (error) {
      next(error);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body ?? {};

      if (!refreshToken || typeof refreshToken !== 'string') {
        throw new AppError(400, 'Campo obrigatório: refreshToken');
      }

      const { token, refreshToken: novoRefreshToken } = await authService.refresh(refreshToken);

      setTokenCookie(res, token);

      res.status(200).json({ token, refreshToken: novoRefreshToken });
    } catch (error) {
      next(error);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body ?? {};

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== 'string' || !emailRegex.test(email.trim())) {
        throw new AppError(400, 'E-mail inválido');
      }

      await authService.requestPasswordReset(email.trim());

      res.status(200).json({
        message: 'Se o e-mail estiver cadastrado, você receberá um código de recuperação.',
      });
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, codigo, novaSenha } = req.body ?? {};

      if (!email || !codigo || !novaSenha) {
        throw new AppError(400, 'Campos obrigatórios: email, codigo, novaSenha');
      }

      if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo.trim())) {
        throw new AppError(400, 'Código inválido ou expirado.');
      }

      if (typeof novaSenha !== 'string' || novaSenha.length < 6) {
        throw new AppError(400, 'Senha deve ter no mínimo 6 caracteres');
      }

      await authService.resetPassword(String(email).trim(), codigo.trim(), novaSenha);

      res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    } catch (error) {
      next(error);
    }
  },

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let token = req.cookies.token;

      if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.substring(7);
      }

      res.clearCookie('token');

      if (token) {
        await authService.addTokenToBlocklist(token);
      }

      const { refreshToken } = req.body ?? {};
      if (typeof refreshToken === 'string' && req.user) {
        await authService.revokeRefreshToken(refreshToken, req.user.id);
      }

      res.status(200).json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
      next(error);
    }
  },

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      const usuario = await authService.getUserById(usuarioId);

      res.status(200).json({ 
        id: usuario.id, 
        nome: usuario.nome, 
        email: usuario.email, 
        perfil: usuario.perfil,
        status: usuario.status,
        fotourl: usuario.fotourl,
        termosversao: usuario.termosversao,
        doisfatores: usuario.doisfatores,
        criadoem: usuario.criadoem
      });
    } catch (error) {
      next(error);
    }
  },

  async uploadPhoto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      const { photo } = req.body ?? {};

      if (!photo || typeof photo !== 'string') {
        throw new AppError(400, 'Campo obrigatório: photo (imagem em base64)');
      }

      const usuario = await authService.updatePhoto(usuarioId, photo);

      res.status(200).json(usuario);
    } catch (error) {
      next(error);
    }
  },

  async registerPushToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      const { token } = req.body ?? {};

      if (!token || typeof token !== 'string') {
        throw new AppError(400, 'Campo obrigatório: token');
      }

      await notificationService.registerPushToken(usuarioId, token);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async removePushToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      const { token } = req.body ?? {};

      if (!token || typeof token !== 'string') {
        throw new AppError(400, 'Campo obrigatório: token');
      }

      await notificationService.removePushToken(usuarioId, token);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async acceptTerms(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      const { versao } = req.body ?? {};

      if (!Number.isInteger(versao) || versao < 1) {
        throw new AppError(400, 'Campo obrigatório: versao (inteiro positivo)');
      }

      const usuario = await authService.acceptTerms(usuarioId, versao);

      res.status(200).json(usuario);
    } catch (error) {
      next(error);
    }
  },

  async removePhoto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      const usuario = await authService.removePhoto(usuarioId);

      res.status(200).json(usuario);
    } catch (error) {
      next(error);
    }
  },

  async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usuarioId = req.user?.id;

      if (!usuarioId) {
        throw new AppError(401, 'Usuário não identificado.');
      }

      const { nome, email, senhaAtual, novaSenha } = req.body ?? {};

      if (nome === undefined && email === undefined && novaSenha === undefined) {
        throw new AppError(400, 'Informe ao menos um campo: nome, email ou novaSenha');
      }

      if (nome !== undefined && (typeof nome !== 'string' || !nome.trim() || nome.trim().length > 150)) {
        throw new AppError(400, 'Nome deve ter entre 1 e 150 caracteres');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email !== undefined && (typeof email !== 'string' || !emailRegex.test(email.trim()) || email.trim().length > 100)) {
        throw new AppError(400, 'E-mail inválido');
      }

      if (novaSenha !== undefined && (typeof novaSenha !== 'string' || novaSenha.length < 6)) {
        throw new AppError(400, 'Senha deve ter no mínimo 6 caracteres');
      }

      const usuario = await authService.updateProfile(usuarioId, {
        ...(nome !== undefined && { nome: nome.trim() }),
        ...(email !== undefined && { email: email.trim() }),
        ...(senhaAtual !== undefined && { senhaAtual }),
        ...(novaSenha !== undefined && { novaSenha }),
      });

      res.status(200).json(usuario);
    } catch (error) {
      next(error);
    }
  }
};
