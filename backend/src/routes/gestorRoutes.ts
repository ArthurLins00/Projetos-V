import { Router } from 'express';
import { gestorController } from '../controllers/gestorController';
import { authenticate } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.use(authenticate);
router.use(requireRole(['Gestor']));

router.get('/dashboard', gestorController.dashboard);

router.get('/equipe', gestorController.listarEquipe);

router.get('/chamados', gestorController.listarChamados);

router.get('/chamados/:id', gestorController.detalharChamado);

router.put('/chamados/:id/aceitar', gestorController.aceitarChamado);

router.put('/chamados/:id/transferir', gestorController.transferirChamado);

router.put('/chamados/:id/status', gestorController.atualizarStatusChamado);

export default router;
