import { app } from './app';
import { connectPrisma, disconnectPrisma } from './config/prisma';
import { isRedisAvailable } from './config/redis';
import { NODE_ENV, PORT } from './config/env';
import { registerCronJobs } from './config/cron';

async function startServer(): Promise<void> {
  await connectPrisma();

  const redisAvailable = await isRedisAvailable();

  const server = app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Server] NODE_ENV=${NODE_ENV}`);
    console.log(`[Server] Redis: ${redisAvailable ? 'available' : 'unavailable'}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/health`);
    console.log(`[Server] API docs (Swagger): http://localhost:${PORT}/docs`);
    registerCronJobs();
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nERRO: a porta ${PORT} já está em uso.`);
      console.error('Encerre o processo anterior e tente novamente.');
      console.error(`PowerShell: Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n`);
      process.exit(1);
    }
    console.error('Erro ao iniciar servidor:', err);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received. Closing server...`);
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

startServer().catch((error) => {
  console.error('[Server] Startup failed:', error);
  process.exit(1);
});
