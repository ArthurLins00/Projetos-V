import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService';

// Gestores e administradores enxergam todos os chamados, então as métricas são sempre da plataforma
const SCOPE = {};

export const metricsController = {
  async averageResponseTime(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await metricsService.averageResponseTime(SCOPE);

      res.status(200).json({ escopo: 'plataforma', ...result });
    } catch (error) {
      next(error);
    }
  },

  async demandsByCategory(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await metricsService.demandsByCategory(SCOPE);

      res.status(200).json({ escopo: 'plataforma', data });
    } catch (error) {
      next(error);
    }
  },

  async totalDemands(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await metricsService.totalDemands(SCOPE);

      res.status(200).json({ escopo: 'plataforma', ...result });
    } catch (error) {
      next(error);
    }
  },
};
