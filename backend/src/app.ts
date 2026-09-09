import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import gestorRoutes from './routes/gestorRoutes';
import userRoutes from './routes/userRoutes';
import demandRoutes from './routes/demandRoutes';
import categoryRoutes from './routes/categoryRoutes';
import adminRoutes from './routes/adminRoutes';
import metricsRoutes from './routes/metricsRoutes';
import { errorHandler } from './middlewares/errorMiddleware';
import { createCorsMiddleware } from './config/cors';
import { healthCheckHandler } from './config/health';
import { openApiSpec, swaggerHtml } from './config/swagger';
import 'dotenv/config';

const app = express();

app.use(createCorsMiddleware());
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  void healthCheckHandler(req, res);
});

app.get('/docs.json', (_req, res) => {
  res.json(openApiSpec);
});

app.get('/docs', (_req, res) => {
  res.type('html').send(swaggerHtml);
});

app.use('/auth', authRoutes);
app.use('/gestor', gestorRoutes);
app.use('/users', userRoutes);
app.use('/demands', demandRoutes);
app.use('/categories', categoryRoutes);
app.use('/admin', adminRoutes);
app.use('/metrics', metricsRoutes);

app.use(errorHandler);

export { app };
