import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/me', authenticate, authController.updateMe);
router.put('/me/photo', authenticate, authController.uploadPhoto);
router.delete('/me/photo', authenticate, authController.removePhoto);
router.post('/me/terms', authenticate, authController.acceptTerms);

export default router;