import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/env.js';
import { logger } from '../shared/logger.js';
import { createPool, type Database } from './pool.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
// Chave arbitrária do advisory lock: impede duas execuções simultâneas.
const MIGRATION_LOCK_KEY = 7_420_001;

/**
 * Executa, em ordem, os arquivos `NNN_nome.sql` ainda não aplicados.
 * Cada migration roda em uma transação própria e é registrada em
 * `app.schema_migrations`.
 */
export async function runMigrations(db: Database): Promise<string[]> {
  const client = await db.connect();
  const applied: string[] = [];

  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query('create schema if not exists app');
    await client.query(`
      create table if not exists app.schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    await client.query('alter table app.schema_migrations enable row level security');

    const { rows } = await client.query<{ name: string }>('select name from app.schema_migrations');
    const done = new Set(rows.map((row) => row.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      if (done.has(file)) continue;

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('insert into app.schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
        applied.push(file);
        logger.info({ migration: file }, 'Migration aplicada');
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Falha na migration ${file}`, { cause: error });
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }

  return applied;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const db = createPool(loadConfig().database);
  runMigrations(db)
    .then((applied) => {
      logger.info({ count: applied.length }, 'Migrations concluídas');
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Erro ao executar migrations');
      process.exitCode = 1;
    })
    .finally(() => db.end());
}
