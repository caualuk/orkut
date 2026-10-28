import type { Express } from 'express';
import { createApp, type AppDependencies } from '../../src/app.js';
import { loadConfig, type AppConfig } from '../../src/config/env.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { logger } from '../../src/shared/logger.js';
import type { PasswordHasher } from '../../src/shared/security/password.js';
import { InMemoryAuthRepository } from './in-memory-auth.repository.js';

export const TEST_ORIGIN = 'http://localhost:4200';
export const TEST_USER = {
  email: 'paulo@orkut.com',
  password: 'senha-super-secreta-123',
  displayName: 'Paulo',
};

/** Hasher determinístico e rápido: os testes de rota não precisam do custo do Argon2. */
export const fakeHasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  verify: async (hash, plain) => hash === `hashed:${plain}`,
};

export function testConfig(overrides: Partial<NodeJS.ProcessEnv> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
    DATABASE_SSL: 'false',
    CORS_ORIGINS: TEST_ORIGIN,
    ...overrides,
  });
}

export interface TestContext {
  app: Express;
  repository: InMemoryAuthRepository;
  service: AuthService;
  config: AppConfig;
}

export function buildTestApp(
  options: {
    healthCheck?: AppDependencies['healthCheck'];
    rateLimits?: AppDependencies['rateLimits'];
    env?: Partial<NodeJS.ProcessEnv>;
  } = {},
): TestContext {
  const config = testConfig(options.env);
  const repository = new InMemoryAuthRepository();
  repository.addUser({
    email: TEST_USER.email,
    displayName: TEST_USER.displayName,
    passwordHash: `hashed:${TEST_USER.password}`,
  });

  const service = new AuthService(repository, fakeHasher, {
    sessionTtlMs: config.session.ttlMs,
    rememberMs: config.session.rememberMs,
  });

  const app = createApp({
    config,
    logger,
    authService: service,
    healthCheck: options.healthCheck ?? (async () => {}),
    rateLimits: options.rateLimits ?? { windowMs: 60_000, globalMax: 1_000, loginMax: 1_000 },
  });

  return { app, repository, service, config };
}
