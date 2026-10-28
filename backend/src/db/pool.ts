import pg from 'pg';
import type { AppConfig } from '../config/env.js';

export type Database = pg.Pool;

/**
 * Pool de conexões com o PostgreSQL. O TLS valida o certificado do servidor
 * contra a CA raiz do Supabase (nunca `rejectUnauthorized: false`).
 */
export function createPool(config: AppConfig['database']): Database {
  return new pg.Pool({
    connectionString: config.url,
    ssl: config.ssl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'orkut-api',
  });
}
