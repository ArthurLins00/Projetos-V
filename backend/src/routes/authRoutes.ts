import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
import { authRateLimit } from '../middlewares/rateLimit';

const router = Router();

// As rotas que aceitam senha ou código sem sessão têm limite próprio por IP; o bloqueio por conta
// (5 senhas erradas seguidas) fica no authService.login
router.post('/register', authRateLimit, authController.register);
router.post('/login', authRateLimit, authController.login);
router.post('/login/2fa', authRateLimit, authController.verifyTwoFactor);
router.post('/login/2fa/resend', authRateLimit, authController.resendTwoFactor);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authRateLimit, authController.forgotPassword);
router.post('/reset-password', authRateLimit, authController.resetPassword);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/me', authenticate, authController.updateMe);
router.put('/me/photo', authenticate, authController.uploadPhoto);
router.delete('/me/photo', authenticate, authController.removePhoto);
router.post('/me/terms', authenticate, authController.acceptTerms);
router.put('/me/two-factor', authenticate, authController.updateTwoFactor);
router.post('/me/push-token', authenticate, authController.registerPushToken);
router.delete('/me/push-token', authenticate, authController.removePushToken);

export default router;