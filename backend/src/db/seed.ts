import { z } from 'zod';
import { loadConfig } from '../config/env.js';
import { logger } from '../shared/logger.js';
import { argon2Hasher } from '../shared/security/password.js';
import { createPool } from './pool.js';

/**
 * Cria (ou atualiza) o usuário de desenvolvimento definido no `.env`.
 * Bloqueado em produção para evitar contas com credenciais conhecidas.
 */
const seedSchema = z.object({
  SEED_USER_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  SEED_USER_NAME: z.string().trim().min(1).max(80),
  SEED_USER_PASSWORD: z.string().min(12, 'SEED_USER_PASSWORD deve ter ao menos 12 caracteres'),
});

async function seed(): Promise<void> {
  const config = loadConfig();
  if (config.isProduction) {
    throw new Error('O seed de desenvolvimento não pode ser executado em produção.');
  }

  const env = seedSchema.parse(process.env);
  const db = createPool(config.database);

  try {
    const passwordHash = await argon2Hasher.hash(env.SEED_USER_PASSWORD);
    await db.query(
      `insert into app.users (email, display_name, password_hash)
       values ($1, $2, $3)
       on conflict (email) do update
         set display_name = excluded.display_name,
             password_hash = excluded.password_hash,
             failed_login_attempts = 0,
             locked_until = null`,
      [env.SEED_USER_EMAIL, env.SEED_USER_NAME, passwordHash],
    );
    logger.info({ email: env.SEED_USER_EMAIL }, 'Usuário de desenvolvimento pronto');
  } finally {
    await db.end();
  }
}

seed().catch((error: unknown) => {
  logger.error({ err: error }, 'Erro no seed');
  process.exitCode = 1;
});
