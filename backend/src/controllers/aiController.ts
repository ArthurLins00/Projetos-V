import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { AppError } from '../middlewares/errorMiddleware';
import { aiService } from '../services/aiService';

const MAX_MESSAGE_CHARS = 1000;

// Mesmo critério do authMiddleware: cookie primeiro, depois Authorization: Bearer
function getToken(req: AuthRequest): string | undefined {
  const fromCookie = req.cookies?.token as string | undefined;
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.substring(7) : undefined;
}

export const aiController = {
  async chat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { message, sessionId } = req.body ?? {};

      if (typeof message !== 'string' || !message.trim()) {
        throw new AppError(400, 'Campo obrigatório: message');
      }
      if (message.length > MAX_MESSAGE_CHARS) {
        throw new AppError(400, `A mensagem deve ter no máximo ${MAX_MESSAGE_CHARS} caracteres.`);
      }
      if (sessionId !== undefined && (typeof sessionId !== 'string' || !/^[\w-]{1,64}$/.test(sessionId))) {
        throw new AppError(400, 'sessionId inválido.');
      }

      const result = await aiService.chat({
        userId: req.user!.id,
        token: getToken(req)!,
        ...(sessionId && { sessionId }),
        message: message.trim(),
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
