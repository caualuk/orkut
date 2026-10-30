import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { runMigrations } from '../../src/db/migrate.js';
import { createPool, type Database } from '../../src/db/pool.js';
import { PgAuthRepository } from '../../src/modules/auth/auth.repository.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { argon2Hasher } from '../../src/shared/security/password.js';

/**
 * Integração com o PostgreSQL real (Supabase). Usa um e-mail único por execução
 * e remove os dados criados ao final.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const email = `teste+${Date.now()}@orkut.test`;
const password = 'senha-de-teste-123';
const signupEmail = `cadastro+${Date.now()}@orkut.test`;
const deleteEmail = `excluir+${Date.now()}@orkut.test`;

describe.skipIf(!hasDatabase)('PgAuthRepository (PostgreSQL)', () => {
  let db: Database;
  let service: AuthService;

  beforeAll(async () => {
    db = createPool(loadConfig().database);
    await runMigrations(db);
    await db.query(
      'insert into app.users (email, display_name, password_hash) values ($1, $2, $3)',
      [email, 'Teste', await argon2Hasher.hash(password)],
    );
    service = new AuthService(new PgAuthRepository(db), argon2Hasher, {
      sessionTtlMs: 60_000,
      rememberMs: 120_000,
      maxFailedAttempts: 3,
    });
  });

  afterAll(async () => {
    await db.query('delete from app.users where email = any($1)', [
      [email, signupEmail, deleteEmail],
    ]);
    await db.end();
  });

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'vitest-db' };

  it('conecta com TLS validado', async () => {
    const { rows } = await db.query<{ ssl: boolean }>(
      'select ssl from pg_stat_ssl where pid = pg_backend_pid()',
    );
    expect(rows[0]?.ssl).toBe(true);
  });

  it('executa o fluxo completo: login → sessão → logout', async () => {
    const { token, user } = await service.login({ email, password, remember: false }, ctx);
    expect(user.email).toBe(email);

    await expect(service.getUserFromSession(token)).resolves.toEqual(user);

    const { rows } = await db.query<{ ip_address: string; token_hash: Buffer }>(
      'select host(ip_address) as ip_address, token_hash from app.sessions where user_id = $1',
      [user.id],
    );
    expect(rows[0]?.ip_address).toBe('127.0.0.1');
    expect(rows[0]?.token_hash.toString('base64url')).not.toBe(token);

    await service.logout(token);
    await expect(service.getUserFromSession(token)).resolves.toBeNull();
  });

  it('registra falhas e bloqueia após o limite', async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        service.login({ email, password: 'errada', remember: false }, ctx),
      ).rejects.toMatchObject({ status: 401 });
    }
    const { rows } = await db.query<{ locked: boolean }>(
      'select locked_until > now() as locked from app.users where email = $1',
      [email],
    );
    expect(rows[0]?.locked).toBe(true);
    await expect(service.login({ email, password, remember: false }, ctx)).rejects.toMatchObject({
      status: 401,
    });
  });

  it('não expõe o schema app às roles públicas do Supabase e mantém RLS ativo', async () => {
    const { rows: roles } = await db.query<{ rolname: string; usage: boolean }>(
      `select rolname, has_schema_privilege(rolname, 'app', 'USAGE') as usage
         from pg_roles where rolname in ('anon', 'authenticated')`,
    );
    for (const role of roles) expect(role.usage, role.rolname).toBe(false);

    const { rows: tables } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'app' and c.relkind = 'r'`,
    );
    expect(tables.length).toBeGreaterThanOrEqual(3);
    for (const table of tables) expect(table.relrowsecurity, table.relname).toBe(true);
  });

  it('impõe e-mail em minúsculas no banco', async () => {
    await expect(
      db.query('insert into app.users (email, display_name, password_hash) values ($1, $2, $3)', [
        'MAIUSCULO@orkut.test',
        'X',
        'x',
      ]),
    ).rejects.toThrow(/users_email_lowercase/);
  });

  it('cadastra usuário com nascimento, sexo e aceite dos termos; recusa e-mail repetido', async () => {
    const input = {
      firstName: 'Cadastro',
      lastName: 'Teste',
      email: signupEmail,
      password: 'senha-teste-123',
      birthDate: '1994-03-12',
      gender: 'masculino' as const,
      relationship: 'namorando' as const,
      city: 'Recife, PE',
      about: 'Teste de cadastro em etapas.',
    };
    const { user, token } = await service.signup(input, ctx);
    expect(user.displayName).toBe('Cadastro Teste');
    await expect(service.getUserFromSession(token)).resolves.toEqual(user);

    const { rows } = await db.query<{ birth: string; gender: string; terms: boolean }>(
      `select to_char(birth_date, 'YYYY-MM-DD') as birth, gender,
              terms_accepted_at is not null as terms
         from app.users where id = $1`,
      [user.id],
    );
    expect(rows[0]).toEqual({ birth: '1994-03-12', gender: 'masculino', terms: true });

    // O perfil nasce no mesmo comando do usuário.
    const profile = await db.query(
      'select first_name, last_name, relationship, city, about from app.profiles where user_id = $1',
      [user.id],
    );
    expect(profile.rows[0]).toEqual({
      first_name: 'Cadastro',
      last_name: 'Teste',
      relationship: 'namorando',
      city: 'Recife, PE',
      about: 'Teste de cadastro em etapas.',
    });

    await expect(service.signup(input, ctx)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('exclui a conta e apaga as sessões em cascata', async () => {
    const { user, token } = await service.signup(
      {
        firstName: 'Excluir',
        lastName: 'Teste',
        email: deleteEmail,
        password,
        birthDate: null,
        gender: null,
        relationship: 'nao-informar',
        city: '',
        about: '',
      },
      ctx,
    );

    await expect(service.deleteAccount(user, 'senha-errada-1')).rejects.toMatchObject({
      code: 'INVALID_PASSWORD',
    });
    await service.deleteAccount(user, password);

    const { rows } = await db.query<{ users: number; sessions: number }>(
      `select (select count(*)::int from app.users where id = $1) as users,
              (select count(*)::int from app.sessions where user_id = $1) as sessions`,
      [user.id],
    );
    expect(rows[0]).toEqual({ users: 0, sessions: 0 });
    await expect(service.getUserFromSession(token)).resolves.toBeNull();
  });
});
