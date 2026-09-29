import { Router } from 'express';
import { demandController } from '../controllers/demandController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.get('/', authenticate, demandController.list);
router.post('/', authenticate, requireRole(['Cidadao']), demandController.create);
router.get('/:id', authenticate, demandController.getById);
router.put('/:id', authenticate, requireRole(['Cidadao']), demandController.update);

// Foto da ocorrência em base64 (o limite de tamanho do JSON é ampliado em app.ts)
router.put('/:id/photo', authenticate, requireRole(['Cidadao']), demandController.uploadPhoto);

router.patch(
  '/:id/status',
  authenticate,
  requireRole(['Gestor']),
  demandController.updateStatus
);

// Cidadão pode remover a própria demanda (enquanto não estiver em andamento);
// Gestor/Admin herdam a permissão via hierarquia de perfis.
router.delete(
  '/:id',
  authenticate,
  requireRole(['Cidadao']),
  demandController.delete
);

export default router;
