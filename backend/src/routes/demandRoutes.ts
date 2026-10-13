import { Router } from 'express';
import { demandController } from '../controllers/demandController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.get('/', authenticate, demandController.list);
router.post('/', authenticate, requireRole(['Cidadao']), demandController.create);
router.get('/:id', authenticate, demandController.getById);
router.put('/:id', authenticate, requireRole(['Cidadao']), demandController.update);

router.post('/:id/photos', authenticate, requireRole(['Cidadao']), demandController.addPhoto);
router.delete('/:id/photos/:photoId', authenticate, requireRole(['Cidadao']), demandController.removePhoto);

router.patch(
  '/:id/status',
  authenticate,
  requireRole(['Gestor']),
  demandController.updateStatus
);

router.delete(
  '/:id',
  authenticate,
  requireRole(['Cidadao']),
  demandController.delete
);

export default router;
