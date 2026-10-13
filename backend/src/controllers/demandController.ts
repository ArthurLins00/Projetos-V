import { Response, NextFunction } from 'express';

import { AuthRequest } from '../middlewares/authMiddleware';
import { demandService } from '../services/demandService';
import { AppError } from '../middlewares/errorMiddleware';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
const ZONAS = ['Urbana', 'Rural'] as const;

function parseRegion(body: any) {
  const { state, city, zone } = body ?? {};
  const region: { state?: string; city?: string; zone?: (typeof ZONAS)[number] } = {};

  if (state !== undefined) {
    const uf = typeof state === 'string' ? state.trim().toUpperCase() : '';
    if (!UFS.includes(uf)) throw new AppError(400, 'Estado inválido: informe a sigla da UF (ex: PE).');
    region.state = uf;
  }

  if (city !== undefined) {
    const nome = typeof city === 'string' ? city.trim() : '';
    if (!nome || nome.length > 100) throw new AppError(400, 'Cidade deve ter entre 1 e 100 caracteres.');
    region.city = nome;
  }

  if (zone !== undefined) {
    if (!ZONAS.includes(zone)) throw new AppError(400, "Zona inválida: use 'Urbana' ou 'Rural'.");
    region.zone = zone;
  }

  return region;
}

export const demandController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { title, description, category_id, location, latitude, longitude } = req.body;

      if (!title || !description || !category_id || !location) {
        throw new AppError(400, 'Campos obrigatórios: title, description, category_id, location');
      }

      const demand = await demandService.create({
        title: String(title),
        description: String(description),
        categoryId: Number(category_id),
        location: String(location),
        ...(latitude !== undefined && { latitude: Number(latitude) }),
        ...(longitude !== undefined && { longitude: Number(longitude) }),
        ...parseRegion(req.body),
        userId: req.user!.id,
      });

      res.status(201).json(demand);
    } catch (error) {
      next(error);
    }
  },
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, categoria, regiao, busca, page, limit } = req.query;

      const result = await demandService.list({
        userId: req.user!.id,
        perfil: req.user!.perfil,
        ...(status !== undefined && { status: String(status) }),
        ...(categoria !== undefined && { categoria: Number(categoria) }),
        ...(regiao !== undefined && { regiao: String(regiao) }),
        ...(busca !== undefined && String(busca).trim() !== '' && { busca: String(busca).trim() }),
        page: page ? Math.max(1, Number(page)) : 1,
        limit: limit ? Math.min(100, Math.max(1, Number(limit))) : 20,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const demand = await demandService.findById(id, req.user!.id, req.user!.perfil);
      res.status(200).json(demand);
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params['id'] as string;
      const { title, description, location, category_id, latitude, longitude } = req.body;

      const demand = await demandService.update({
        id,
        userId: req.user!.id,
        ...(title !== undefined && { title: String(title) }),
        ...(description !== undefined && { description: String(description) }),
        ...(location !== undefined && { location: String(location) }),
        ...(category_id !== undefined && { categoryId: Number(category_id) }),
        ...(latitude !== undefined && { latitude: Number(latitude) }),
        ...(longitude !== undefined && { longitude: Number(longitude) }),
        ...parseRegion(req.body),
      });

      res.status(200).json(demand);
    } catch (error) {
      next(error);
    }
  },

async updateStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new AppError(400, 'ID inválido');
    }

    const { status_id } = req.body;

    if (!status_id) {
      throw new AppError(400, 'status_id obrigatório');
    }

    const result = await demandService.updateStatus(
      id,
      req.user!.id,
      status_id
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
},

async addPhoto(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new AppError(400, 'ID inválido');
    }

    const { photo } = req.body ?? {};

    if (!photo || typeof photo !== 'string') {
      throw new AppError(400, 'Campo obrigatório: photo (imagem em base64)');
    }

    const result = await demandService.addPhoto(id, req.user!.id, photo);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
},

async removePhoto(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id, photoId } = req.params;

    if (!id || Array.isArray(id) || !photoId || Array.isArray(photoId)) {
      throw new AppError(400, 'ID inválido');
    }

    await demandService.removePhoto(id, req.user!.id, photoId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
},

async delete(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      throw new AppError(400, 'ID inválido');
    }

    await demandService.deleteDemand(id, req.user!.id, req.user!.perfil);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
},

};
