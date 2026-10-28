import { randomUUID } from 'node:crypto';
import type { AuthRepository } from '../../src/modules/auth/auth.repository.js';
import type { NewSession, PublicUser, UserRecord } from '../../src/modules/auth/auth.types.js';

interface StoredSession extends NewSession {
  revokedAt: Date | null;
}

/** Implementação em memória do repositório, usada nos testes sem banco. */
export class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, UserRecord>();
  readonly sessions: StoredSession[] = [];

  constructor(private readonly clock: () => Date = () => new Date()) {}

  addUser(data: { email: string; displayName: string; passwordHash: string }): UserRecord {
    const user: UserRecord = {
      id: randomUUID(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      ...data,
    };
    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async registerFailedLogin(userId: string, maxAttempts: number, lockMs: number): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= maxAttempts) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = new Date(this.clock().getTime() + lockMs);
    }
  }

  async registerSuccessfulLogin(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }

  async createSession(session: NewSession): Promise<void> {
    this.sessions.push({ ...session, revokedAt: null });
  }

  async findUserBySessionHash(tokenHash: Buffer, now: Date): Promise<PublicUser | null> {
    const session = this.sessions.find(
      (s) => s.tokenHash.equals(tokenHash) && s.revokedAt === null && s.expiresAt > now,
    );
    const user = session && this.users.get(session.userId);
    return user ? { id: user.id, email: user.email, displayName: user.displayName } : null;
  }

  async revokeSession(tokenHash: Buffer): Promise<void> {
    const session = this.sessions.find((s) => s.tokenHash.equals(tokenHash));
    if (session) session.revokedAt = new Date();
  }
}
