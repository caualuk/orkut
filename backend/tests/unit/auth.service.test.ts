import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { AppError } from '../../src/shared/errors/app-error.js';
import { InMemoryAuthRepository } from '../helpers/in-memory-auth.repository.js';
import { fakeHasher, TEST_USER } from '../helpers/test-app.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const context = { ipAddress: '127.0.0.1', userAgent: 'vitest' };

describe('AuthService', () => {
  let now: Date;
  let repository: InMemoryAuthRepository;
  let service: AuthService;

  beforeEach(() => {
    now = new Date('2026-10-28T12:00:00Z');
    repository = new InMemoryAuthRepository(() => now);
    repository.addUser({
      email: TEST_USER.email,
      displayName: TEST_USER.displayName,
      passwordHash: `hashed:${TEST_USER.password}`,
    });
    service = new AuthService(repository, fakeHasher, {
      sessionTtlMs: 12 * HOUR,
      rememberMs: 30 * DAY,
      maxFailedAttempts: 3,
      lockoutMs: 15 * 60 * 1000,
      now: () => now,
    });
  });

  const login = (overrides: Partial<{ email: string; password: string; remember: boolean }> = {}) =>
    service.login(
      { email: TEST_USER.email, password: TEST_USER.password, remember: false, ...overrides },
      context,
    );

  it('autentica com credenciais válidas e cria sessão de 12h', async () => {
    const result = await login();

    expect(result.user).toEqual({
      id: expect.any(String),
      email: TEST_USER.email,
      displayName: TEST_USER.displayName,
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.persistent).toBe(false);
    expect(result.expiresAt.getTime() - now.getTime()).toBe(12 * HOUR);
    expect(repository.sessions).toHaveLength(1);
    // O token puro nunca é persistido.
    expect(repository.sessions[0]?.tokenHash.toString('base64url')).not.toBe(result.token);
  });

  it('cria sessão de 30 dias com "Lembrar de mim"', async () => {
    const result = await login({ remember: true });
    expect(result.persistent).toBe(true);
    expect(result.expiresAt.getTime() - now.getTime()).toBe(30 * DAY);
  });

  it('rejeita senha incorreta com erro genérico', async () => {
    await expect(login({ password: 'errada' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(repository.sessions).toHaveLength(0);
  });

  it('rejeita e-mail inexistente com o mesmo erro e ainda executa verificação de hash', async () => {
    const verify = vi.spyOn(fakeHasher, 'verify');

    const error = await login({ email: 'ninguem@orkut.com' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(verify).toHaveBeenCalledTimes(1);
    verify.mockRestore();
  });

  it('bloqueia a conta após N falhas, mesmo com a senha correta', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(login({ password: 'errada' })).rejects.toBeInstanceOf(AppError);
    }

    await expect(login()).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    // Após o período de bloqueio, o login volta a funcionar.
    now = new Date(now.getTime() + 16 * 60 * 1000);
    await expect(login()).resolves.toHaveProperty('token');
  });

  it('zera o contador de falhas após login bem-sucedido', async () => {
    await login({ password: 'errada' }).catch(() => {});
    await login({ password: 'errada' }).catch(() => {});
    await login();

    const user = await repository.findUserByEmail(TEST_USER.email);
    expect(user?.failedLoginAttempts).toBe(0);
  });

  it('resolve o usuário a partir de um token válido', async () => {
    const { token, user } = await login();
    await expect(service.getUserFromSession(token)).resolves.toEqual(user);
  });

  it('ignora tokens ausentes, malformados ou expirados', async () => {
    const { token } = await login();

    await expect(service.getUserFromSession(undefined)).resolves.toBeNull();
    await expect(service.getUserFromSession("' or 1=1 --")).resolves.toBeNull();
    await expect(service.getUserFromSession('a'.repeat(43))).resolves.toBeNull();

    now = new Date(now.getTime() + 13 * HOUR);
    await expect(service.getUserFromSession(token)).resolves.toBeNull();
  });

  it('revoga a sessão no logout', async () => {
    const { token } = await login();
    await service.logout(token);
    await expect(service.getUserFromSession(token)).resolves.toBeNull();
  });

  describe('signup', () => {
    const signupInput = {
      firstName: 'Nina',
      lastName: 'Costa',
      email: 'nina@orkut.com',
      password: 'saudade2004',
      birthDate: '1995-03-12',
      gender: 'feminino' as const,
    };

    it('cria o usuário com hash da senha e inicia sessão não persistente', async () => {
      const result = await service.signup(signupInput, context);

      expect(result.user).toEqual({
        id: expect.any(String),
        email: 'nina@orkut.com',
        displayName: 'Nina Costa',
      });
      expect(result.persistent).toBe(false);
      expect(result.expiresAt.getTime() - now.getTime()).toBe(12 * HOUR);
      expect(repository.created[0]?.passwordHash).toBe('hashed:saudade2004');
      await expect(service.getUserFromSession(result.token)).resolves.toEqual(result.user);
    });

    it('recusa e-mail já cadastrado com EMAIL_TAKEN e não cria sessão', async () => {
      await expect(
        service.signup({ ...signupInput, email: TEST_USER.email }, context),
      ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
      expect(repository.sessions).toHaveLength(0);
    });
  });
});
