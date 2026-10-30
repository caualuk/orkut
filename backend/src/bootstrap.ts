import type { Express } from 'express';
import { createApp } from './app.js';
import { loadConfig, type AppConfig } from './config/env.js';
import { createPool, type Database } from './db/pool.js';
import { PgAuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { PgSocialRepository } from './modules/social/social.repository.js';
import { logger } from './shared/logger.js';
import { argon2Hasher } from './shared/security/password.js';

export interface Runtime {
  app: Express;
  config: AppConfig;
  db: Database;
}

/**
 * Composition root: instancia as dependências concretas e monta a app Express.
 * Usado pelo servidor HTTP local (`server.ts`) e pela Serverless Function da
 * Vercel (`api/index.mjs`), que não chama `listen`.
 */
export function bootstrap(env: NodeJS.ProcessEnv = process.env): Runtime {
  const config = loadConfig(env);
  // Em serverless cada instância abre o próprio pool: poucas conexões por instância
  // evitam esgotar o limite do PostgreSQL (prefira o pooler do Supabase na URL).
  const db = createPool(config.database, { max: env['VERCEL'] ? 3 : 10 });

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

  return { app, config, db };
}
