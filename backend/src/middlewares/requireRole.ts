import { Request, Response, NextFunction } from 'express';

export type PerfilUsuario = 'Cidadao' | 'Gestor' | 'Admin';

const hierarchyMap: Record<string, string[]> = {
  Admin: ['Admin', 'Gestor', 'Cidadao'],
  Gestor: ['Gestor', 'Cidadao'],
  Cidadao: ['Cidadao'],
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.perfil) {
      return res.status(401).json({ 
        error: 'Não autorizado. Faça login para acessar.',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
    }

    const userPerfil = req.user.perfil;
    const userPermissions = hierarchyMap[userPerfil] || [];

    const hasPermission = allowedRoles.some(role => userPermissions.includes(role));

    if (!hasPermission) {
      return res.status(403).json({ 
        error: 'Acesso negado. Seu perfil não tem permissão para acessar este recurso.',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};
