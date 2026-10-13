import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireRole(['Gestor']),
  userController.listarUsuarios
);

router.get(
  '/:id',
  requireRole(['Gestor']),
  userController.buscarUsuarioPorId
);

export default router;