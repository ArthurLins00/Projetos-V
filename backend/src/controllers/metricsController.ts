import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService';

// Gestores e administradores enxergam todos os chamados, então as métricas são sempre da plataforma.
// Os valores vêm do snapshot gerado pelo pipeline de dados; geradoEm diz quando ele foi calculado.

export const metricsController = {
  async averageResponseTime(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await metricsService.averageResponseTime();

      res.status(200).json({ escopo: 'plataforma', ...result });
    } catch (error) {
      next(error);
    }
  },

  async demandsByCategory(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await metricsService.demandsByCategory();

      res.status(200).json({ escopo: 'plataforma', ...result });
    } catch (error) {
      next(error);
    }
  },

  async totalDemands(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await metricsService.totalDemands();

      res.status(200).json({ escopo: 'plataforma', ...result });
    } catch (error) {
      next(error);
    }
  },
};
