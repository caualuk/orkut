import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createPool } from './db/pool.js';
import { PgAuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { PgSocialRepository } from './modules/social/social.repository.js';
import { logger } from './shared/logger.js';
import { argon2Hasher } from './shared/security/password.js';

/** Composition root: instancia as dependências concretas e sobe o servidor HTTP. */
const config = loadConfig();
const db = createPool(config.database);

const authService = new AuthService(new PgAuthRepository(db), argon2Hasher, {
  sessionTtlMs: config.session.ttlMs,
  rememberMs: config.session.rememberMs,
});

const app = createApp({
  config,
  logger,
  authService,
  socialRepository: new PgSocialRepository(db),
  healthCheck: async () => {
    await db.query('select 1');
  },
});

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
