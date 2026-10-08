import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Assistente de IA: consulta o status dos chamados que o usuário logado pode ver
router.post('/chat', authenticate, aiController.chat);

export default router;
