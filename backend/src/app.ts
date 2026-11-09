import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import gestorRoutes from './routes/gestorRoutes';
import userRoutes from './routes/userRoutes';
import demandRoutes from './routes/demandRoutes';
import categoryRoutes from './routes/categoryRoutes';
import adminRoutes from './routes/adminRoutes';
import metricsRoutes from './routes/metricsRoutes';
import aiRoutes from './routes/aiRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { errorHandler } from './middlewares/errorMiddleware';
import { createCorsMiddleware } from './config/cors';
import { healthCheckHandler } from './config/health';
import { openApiSpec, swaggerHtml } from './config/swagger';
import { PHOTO_BODY_LIMIT, UPLOADS_DIR, UPLOADS_ROUTE } from './config/uploads';
import { docsContentSecurityPolicy, securityHeaders, trustProxySetting } from './config/security';
import { globalRateLimit } from './middlewares/rateLimit';
import 'dotenv/config';

const app = express();

const trustProxy = trustProxySetting();
if (trustProxy !== undefined) {
  app.set('trust proxy', trustProxy);
}
app.disable('x-powered-by');

app.use(securityHeaders);
app.use(createCorsMiddleware());
app.use(globalRateLimit);
app.use('/demands/:id/photos', express.json({ limit: PHOTO_BODY_LIMIT }));
app.use('/auth/me/photo', express.json({ limit: PHOTO_BODY_LIMIT }));
app.use(express.json());
app.use(cookieParser());

app.use(UPLOADS_ROUTE, express.static(UPLOADS_DIR));

app.get('/health', (req, res) => {
  void healthCheckHandler(req, res);
});

app.get('/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

app.get('/docs', docsContentSecurityPolicy, (_req, res) => {
  res.type('html').send(swaggerHtml);
});

app.use('/auth', authRoutes);
app.use('/gestor', gestorRoutes);
app.use('/users', userRoutes);
app.use('/demands', demandRoutes);
app.use('/categories', categoryRoutes);
app.use('/admin', adminRoutes);
app.use('/metrics', metricsRoutes);
app.use('/ai', aiRoutes);
app.use('/notifications', notificationRoutes);

app.use(errorHandler);

export { app };
