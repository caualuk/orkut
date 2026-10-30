import type { Database } from '../../db/pool.js';
import type { NewSession, NewUser, PublicUser, UserRecord } from './auth.types.js';

/**
 * Porta de persistência do módulo de autenticação. A camada de serviço depende
 * apenas desta interface, o que permite testes com implementação em memória.
 */
export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  /** Cria o usuário; retorna `null` se o e-mail já estiver cadastrado. */
  createUser(user: NewUser): Promise<UserRecord | null>;
  registerFailedLogin(userId: string, maxAttempts: number, lockMs: number): Promise<void>;
  registerSuccessfulLogin(userId: string): Promise<void>;
  createSession(session: NewSession): Promise<void>;
  findUserBySessionHash(tokenHash: Buffer, now: Date): Promise<PublicUser | null>;
  revokeSession(tokenHash: Buffer): Promise<void>;
  /** Remove o usuário; as chaves estrangeiras apagam todos os dados dele em cascata. */
  deleteUser(userId: string): Promise<void>;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  failed_login_attempts: number;
  locked_until: Date | null;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
  };
}

/** Implementação PostgreSQL. Todas as queries são parametrizadas ($1, $2…). */
export class PgAuthRepository implements AuthRepository {
  constructor(private readonly db: Database) {}

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.db.query<UserRow>(
      `select id, email, display_name, password_hash, failed_login_attempts, locked_until
         from app.users
        where email = $1`,
      [email],
    );
    return rows[0] ? toUserRecord(rows[0]) : null;
  }

  async createUser(user: NewUser): Promise<UserRecord | null> {
    // `on conflict do nothing` evita corrida entre dois cadastros com o mesmo e-mail.
    const { rows } = await this.db.query<UserRow>(
      `with created as (
         insert into app.users
                (email, display_name, password_hash, birth_date, gender, terms_accepted_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (email) do nothing
         returning id, email, display_name, password_hash, failed_login_attempts, locked_until
       ), profile as (
         -- Mesmo comando = mesma transação: não existe usuário sem perfil.
         insert into app.profiles (user_id, first_name, last_name, relationship, city, about)
         select id, $6, $7, $8, $9, $10 from created
       )
       select * from created`,
      [
        user.email,
        user.displayName,
        user.passwordHash,
        user.birthDate,
        user.gender,
        user.firstName,
        user.lastName,
        user.relationship,
        user.city,
        user.about,
      ],
    );
    return rows[0] ? toUserRecord(rows[0]) : null;
  }

  async registerFailedLogin(userId: string, maxAttempts: number, lockMs: number): Promise<void> {
    // Incremento atômico; ao atingir o limite, bloqueia e zera o contador.
    await this.db.query(
      `update app.users
          set failed_login_attempts = case
                when failed_login_attempts + 1 >= $2 then 0
                else failed_login_attempts + 1
              end,
              locked_until = case
                when failed_login_attempts + 1 >= $2 then now() + ($3 || ' milliseconds')::interval
                else locked_until
              end
        where id = $1`,
      [userId, maxAttempts, String(lockMs)],
    );
  }

  async registerSuccessfulLogin(userId: string): Promise<void> {
    await this.db.query(
      `update app.users
          set failed_login_attempts = 0, locked_until = null, last_login_at = now()
        where id = $1`,
      [userId],
    );
  }

  async createSession(session: NewSession): Promise<void> {
    await this.db.query(
      `insert into app.sessions (user_id, token_hash, expires_at, user_agent, ip_address)
       values ($1, $2, $3, $4, $5)`,
      [session.userId, session.tokenHash, session.expiresAt, session.userAgent, session.ipAddress],
    );
  }

  async findUserBySessionHash(tokenHash: Buffer, now: Date): Promise<PublicUser | null> {
    const { rows } = await this.db.query<Pick<UserRow, 'id' | 'email' | 'display_name'>>(
      `select u.id, u.email, u.display_name
         from app.sessions s
         join app.users u on u.id = s.user_id
        where s.token_hash = $1
          and s.revoked_at is null
          and s.expires_at > $2`,
      [tokenHash, now],
    );
    const row = rows[0];
    return row ? { id: row.id, email: row.email, displayName: row.display_name } : null;
  }

  async revokeSession(tokenHash: Buffer): Promise<void> {
    await this.db.query(
      `update app.sessions set revoked_at = now()
        where token_hash = $1 and revoked_at is null`,
      [tokenHash],
    );
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.query('delete from app.users where id = $1', [userId]);
  }
}
