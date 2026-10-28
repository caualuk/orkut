import { defineConfig } from 'vitest/config';

/**
 * Testes de integração contra o PostgreSQL real (Supabase).
 * Executar com `npm run test:db` — requer DATABASE_URL no `.env`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: loadEnvFile(),
  },
});

function loadEnvFile(): Record<string, string> {
  try {
    process.loadEnvFile('.env');
  } catch {
    // Sem .env: os testes de banco serão ignorados (describe.skipIf).
  }
  return {};
}
