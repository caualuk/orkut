import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_ORIGIN, TEST_USER, type TestContext } from '../helpers/test-app.js';

function sessionCookie(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith('orkut_sid='));
  if (!cookie) throw new Error('Cookie de sessão ausente');
  return cookie;
}

describe('Rotas /api/auth', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  const postLogin = (body: unknown) =>
    request(ctx.app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send(body as object);

  describe('POST /login', () => {
    it('autentica e define cookie de sessão HttpOnly + SameSite=Strict', async () => {
      const res = await postLogin({ email: TEST_USER.email, password: TEST_USER.password });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: {
          id: expect.any(String),
          email: TEST_USER.email,
          displayName: TEST_USER.displayName,
        },
      });

      const cookie = sessionCookie(res);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\//);
      // Sem "lembrar de mim": cookie de sessão do navegador (sem Expires).
      expect(cookie).not.toMatch(/Expires=/);
    });

    it('define cookie persistente com remember=true', async () => {
      const res = await postLogin({ ...TEST_USER, remember: true });
      expect(sessionCookie(res)).toMatch(/Expires=/);
    });

    it('normaliza o e-mail (trim + minúsculas)', async () => {
      const res = await postLogin({ email: '  PAULO@Orkut.COM ', password: TEST_USER.password });
      expect(res.status).toBe(200);
    });

    it('retorna 400 com detalhes de campo para payload inválido', async () => {
      const res = await postLogin({ email: 'nao-e-email', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'email' }),
          expect.objectContaining({ field: 'password' }),
        ]),
      );
    });

    it('responde de forma idêntica para e-mail inexistente e senha incorreta', async () => {
      const unknownEmail = await postLogin({ email: 'x@orkut.com', password: TEST_USER.password });
      const wrongPassword = await postLogin({ email: TEST_USER.email, password: 'errada' });

      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(unknownEmail.headers['set-cookie']).toBeUndefined();
    });
  });

  describe('GET /me', () => {
    it('retorna 401 sem sessão', async () => {
      const res = await request(ctx.app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('retorna o usuário com sessão válida', async () => {
      const login = await postLogin(TEST_USER);
      const res = await request(ctx.app).get('/api/auth/me').set('Cookie', sessionCookie(login));

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_USER.email);
    });

    it('rejeita cookie adulterado', async () => {
      const res = await request(ctx.app)
        .get('/api/auth/me')
        .set('Cookie', `orkut_sid=${'A'.repeat(43)}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /logout', () => {
    it('revoga a sessão e limpa o cookie', async () => {
      const login = await postLogin(TEST_USER);
      const cookie = sessionCookie(login);

      const logout = await request(ctx.app)
        .post('/api/auth/logout')
        .set('Origin', TEST_ORIGIN)
        .set('Cookie', cookie);

      expect(logout.status).toBe(204);
      expect(sessionCookie(logout)).toMatch(/orkut_sid=;/);

      // Reutilizar o token antigo (ex.: cookie roubado) não funciona mais.
      const me = await request(ctx.app).get('/api/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(401);
    });

    it('é idempotente sem sessão', async () => {
      const res = await request(ctx.app).post('/api/auth/logout').set('Origin', TEST_ORIGIN);
      expect(res.status).toBe(204);
    });
  });

  describe('DELETE /account', () => {
    const deleteAccount = (cookie: string | undefined, body: unknown, origin = TEST_ORIGIN) => {
      const req = request(ctx.app).delete('/api/auth/account').set('Origin', origin);
      if (cookie) req.set('Cookie', cookie);
      return req.send(body as object);
    };

    it('exclui a conta, limpa o cookie e invalida a sessão', async () => {
      const cookie = sessionCookie(await postLogin(TEST_USER));

      const res = await deleteAccount(cookie, { password: TEST_USER.password });

      expect(res.status).toBe(204);
      expect(sessionCookie(res)).toMatch(/orkut_sid=;/);
      expect(await ctx.repository.findUserByEmail(TEST_USER.email)).toBeNull();

      const me = await request(ctx.app).get('/api/auth/me').set('Cookie', cookie);
      expect(me.status).toBe(401);
      expect((await postLogin(TEST_USER)).status).toBe(401);
    });

    it('recusa senha incorreta sem excluir', async () => {
      const cookie = sessionCookie(await postLogin(TEST_USER));

      const res = await deleteAccount(cookie, { password: 'errada' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('INVALID_PASSWORD');
      expect(await ctx.repository.findUserByEmail(TEST_USER.email)).not.toBeNull();
    });

    it('exige sessão', async () => {
      const res = await deleteAccount(undefined, { password: TEST_USER.password });
      expect(res.status).toBe(401);
    });

    it('exige a senha no corpo', async () => {
      const cookie = sessionCookie(await postLogin(TEST_USER));
      const res = await deleteAccount(cookie, {});
      expect(res.status).toBe(400);
    });

    it('bloqueia origem não autorizada (CSRF)', async () => {
      const cookie = sessionCookie(await postLogin(TEST_USER));
      const res = await deleteAccount(
        cookie,
        { password: TEST_USER.password },
        'https://evil.example.com',
      );
      expect(res.status).toBe(403);
      expect(await ctx.repository.findUserByEmail(TEST_USER.email)).not.toBeNull();
    });
  });
});

describe('GET /api/health', () => {
  it('retorna ok quando o banco responde', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('retorna 503 sem vazar o erro do banco', async () => {
    const { app } = buildTestApp({
      healthCheck: async () => {
        throw new Error('connection refused at 10.0.0.1:5432');
      },
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.1');
  });
});

describe('Rotas desconhecidas', () => {
  it('retornam 404 em JSON', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
