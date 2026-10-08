import { Router } from 'express';
import { organController } from '../controllers/organController';
import { adminController } from '../controllers/adminController';
import { routingRuleController } from '../controllers/routingRuleController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.use(authenticate);

router.get(
  '/organs',
  requireRole(['Admin', 'Gestor']),
  organController.list
);

router.post(
  '/organs',
  requireRole(['Admin']),
  organController.cadastrarOrgao
);

router.put(
  '/organs/:id',
  requireRole(['Admin']),
  organController.editarOrgao
);

router.put(
  '/organs/:id/:status',
  requireRole(['Admin']),
  organController.editarStatus
);

router.get(
  '/organs/:id/categories',
  requireRole(['Admin']),
  organController.listarCategoriasPorOrgao
);

router.get(
  '/users',
  requireRole(['Admin']),
  adminController.listarUsuarios
);

router.patch(
  '/users/:id/activate',
  requireRole(['Admin']),
  adminController.ativarUsuario
);

router.patch(
  '/users/:id/deactivate',
  requireRole(['Admin']),
  adminController.desativarUsuario
);

router.patch(
  '/users/:id/role',
  requireRole(['Admin']),
  adminController.alterarRole
);

router.post(
  '/users',
  requireRole(['Admin']),
  adminController.criarUsuario
);

router.post(
  '/routing-rules',
  requireRole(['Admin']),
  adminController.criarRegraCompetencia
);

router.get(
  '/routing-rules',
  requireRole(['Admin']),
  adminController.listarRegrasCompetencia
);

router.patch(
  '/routing-rules/:id',
  requireRole(['Admin']),
  adminController.editarRegraCompetencia
);

router.delete(
  '/routing-rules/:id',
  requireRole(['Admin']),
  adminController.deletarRegraCompetencia
);

router.get(
  '/audit-logs',
  requireRole(['Admin']),
  adminController.listarAuditLogs
);

export default router;