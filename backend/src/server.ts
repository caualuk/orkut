import { bootstrap } from './bootstrap.js';
import { logger } from './shared/logger.js';

/** Servidor HTTP (desenvolvimento e hospedagem tradicional). Na Vercel, ver `api/index.mjs`. */
const { app, config, db } = bootstrap();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'API do orkut iniciada');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Encerrando servidor');
  server.close(() => {
    db.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
