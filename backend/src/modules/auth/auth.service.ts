import { AppError } from '../../shared/errors/app-error.js';
import type { PasswordHasher } from '../../shared/security/password.js';
import { generateSessionToken, hashSessionToken } from '../../shared/security/session-token.js';
import type { AuthRepository } from './auth.repository.js';
import {
  toPublicUser,
  type LoginInput,
  type LoginResult,
  type PublicUser,
  type RequestContext,
  type SignupInput,
  type UserRecord,
} from './auth.types.js';

export interface AuthServiceOptions {
  sessionTtlMs: number;
  rememberMs: number;
  maxFailedAttempts?: number;
  lockoutMs?: number;
  now?: () => Date;
}

const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_MS = 15 * 60 * 1000;

export class AuthService {
  private readonly maxFailedAttempts: number;
  private readonly lockoutMs: number;
  private readonly now: () => Date;
  /**
   * Hash descartável usado quando o e-mail não existe, para que a resposta
   * leve o mesmo tempo que uma verificação real (mitiga enumeração por timing).
   */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly repository: AuthRepository,
    private readonly hasher: PasswordHasher,
    private readonly options: AuthServiceOptions,
  ) {
    this.maxFailedAttempts = options.maxFailedAttempts ?? DEFAULT_MAX_FAILED_ATTEMPTS;
    this.lockoutMs = options.lockoutMs ?? DEFAULT_LOCKOUT_MS;
    this.now = options.now ?? (() => new Date());
  }

  async login(input: LoginInput, context: RequestContext): Promise<LoginResult> {
    const user = await this.repository.findUserByEmail(input.email);

    if (!user) {
      await this.hasher.verify(await this.getDummyHash(), input.password);
      throw AppError.invalidCredentials();
    }

    const isLocked = user.lockedUntil !== null && user.lockedUntil > this.now();
    const passwordMatches = await this.hasher.verify(user.passwordHash, input.password);

    if (isLocked) {
      // Conta bloqueada temporariamente: mesma resposta genérica, sem revelar o estado.
      throw AppError.invalidCredentials();
    }

    if (!passwordMatches) {
      await this.repository.registerFailedLogin(user.id, this.maxFailedAttempts, this.lockoutMs);
      throw AppError.invalidCredentials();
    }

    await this.repository.registerSuccessfulLogin(user.id);
    return this.startSession(user, input.remember, context);
  }

  /** Cria a conta e já inicia uma sessão (o cadastro leva direto para a Home). */
  async signup(input: SignupInput, context: RequestContext): Promise<LoginResult> {
    const user = await this.repository.createUser({
      email: input.email,
      displayName: `${input.firstName} ${input.lastName}`,
      passwordHash: await this.hasher.hash(input.password),
      birthDate: input.birthDate,
      gender: input.gender,
    });

    if (!user) throw AppError.emailTaken();
    return this.startSession(user, false, context);
  }

  async getUserFromSession(token: string | undefined): Promise<PublicUser | null> {
    if (!isWellFormedToken(token)) return null;
    return this.repository.findUserBySessionHash(hashSessionToken(token), this.now());
  }

  async logout(token: string | undefined): Promise<void> {
    if (!isWellFormedToken(token)) return;
    await this.repository.revokeSession(hashSessionToken(token));
  }

  /**
   * Exclui a conta do usuário autenticado após confirmar a senha. A remoção em
   * `app.users` apaga em cascata sessões, perfil, recados, fotos, comunidades…
   */
  async deleteAccount(user: PublicUser, password: string): Promise<void> {
    const record = await this.repository.findUserByEmail(user.email);
    if (!record || record.id !== user.id) throw AppError.unauthorized();

    if (!(await this.hasher.verify(record.passwordHash, password))) {
      throw AppError.invalidPassword();
    }

    await this.repository.deleteUser(record.id);
  }

  private async startSession(
    user: UserRecord,
    persistent: boolean,
    context: RequestContext,
  ): Promise<LoginResult> {
    const token = generateSessionToken();
    const lifetime = persistent ? this.options.rememberMs : this.options.sessionTtlMs;
    const expiresAt = new Date(this.now().getTime() + lifetime);

    await this.repository.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      userAgent: context.userAgent?.slice(0, 512) ?? null,
      ipAddress: context.ipAddress,
    });

    return { user: toPublicUser(user), token, expiresAt, persistent };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(generateSessionToken());
    return this.dummyHash;
  }
}

/** Tokens gerados por `generateSessionToken` têm 43 caracteres base64url. */
function isWellFormedToken(token: string | undefined): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}
