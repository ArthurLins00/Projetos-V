import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/chat', authenticate, aiController.chat);

export default router;
