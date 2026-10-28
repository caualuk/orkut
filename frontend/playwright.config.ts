import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * Testes E2E.
 * - `*.ui.spec.ts`: API simulada (page.route) — determinísticos, rodam em qualquer ambiente.
 * - `*.fullstack.spec.ts`: frontend + backend + PostgreSQL reais, usando o usuário do seed.
 *
 * As credenciais do usuário de teste vêm do `backend/.env` (nunca versionado).
 */
const backendEnv = '../backend/.env';
if (existsSync(backendEnv)) process.loadEnvFile(backendEnv);

const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // O dev server + Argon2 ficam saturados com muitos workers locais.
  workers: isCI ? 2 : 3,
  timeout: 45_000,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: [
    {
      command: 'npm --prefix ../backend run dev',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    {
      command: 'npm start',
      url: 'http://localhost:4200',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
});
