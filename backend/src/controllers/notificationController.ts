import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { AppError } from '../middlewares/errorMiddleware';
import { notificationService } from '../services/notificationService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const notificationController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, unread } = req.query;

      const result = await notificationService.list(req.user!.id, {
        page: page ? Math.max(1, Number(page) || 1) : 1,
        limit: limit ? Math.min(50, Math.max(1, Number(limit) || 20)) : 20,
        unreadOnly: unread === 'true',
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'];

      if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
        throw new AppError(404, 'Notificação não encontrada.');
      }

      await notificationService.markAsRead(req.user!.id, id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationService.markAllAsRead(req.user!.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
