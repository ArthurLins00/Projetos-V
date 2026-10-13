import { Request, Response, NextFunction } from 'express';
import jwt, {
  TokenExpiredError,
  JsonWebTokenError,
} from 'jsonwebtoken';
import { authService } from '../services/authService';
import { JWT_SECRET } from '../config/env';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        perfil: string;
      };
    }
  }
}

export type AuthRequest = Request;

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token = req.cookies.token;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;

      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        error: 'Acesso negado. Token não fornecido.',
      });
    }

    if (authService.isTokenBlocked(token)) {
      return res.status(401).json({
        error: 'Token foi revogado (logout realizado).',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      perfil: string;
    };

    const user = await authService.getUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'Usuário não encontrado.',
      });
    }

    if (user.status !== 'Ativo') {
      return res.status(403).json({
        error: 'Usuário inativo. Acesso bloqueado.',
      });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      perfil: decoded.perfil,
    };

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expirado. Faça login novamente.',
      });
    }

    if (error instanceof JsonWebTokenError) {
      return res.status(401).json({
        error: 'Token inválido.',
      });
    }

    return res.status(401).json({
      error: 'Erro na autenticação.',
    });
  }
};