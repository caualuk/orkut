import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_ORIGIN, TEST_USER } from '../helpers/test-app.js';

/**
 * Testes de segurança da API (OWASP Top 10 aplicável à tela de login).
 */
describe('Segurança da API', () => {
  describe('Cabeçalhos HTTP', () => {
    it('aplica cabeçalhos de proteção do Helmet e remove X-Powered-By', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/health');

      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
    });

    it('impede cache das respostas da API', async () => {
      const { app } = buildTestApp();
      const res = await request(app).get('/api/health');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('envia HSTS somente em produção', async () => {
      const dev = await request(buildTestApp().app).get('/api/health');
      expect(dev.headers['strict-transport-security']).toBeUndefined();

      const prod = await request(buildTestApp({ env: { NODE_ENV: 'production' } }).app).get(
        '/api/health',
      );
      expect(prod.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    });
  });

  describe('Cookie de sessão em produção', () => {
    it('usa __Host- e Secure', async () => {
      const { app } = buildTestApp({ env: { NODE_ENV: 'production' } });
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', TEST_ORIGIN)
        .send(TEST_USER);

      const cookie = (res.headers['set-cookie'] as unknown as string[])[0];
      expect(cookie).toMatch(/^__Host-orkut_sid=/);
      expect(cookie).toMatch(/; Secure/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).not.toMatch(/Domain=/);
    });
  });

  describe('CORS', () => {
    it('libera apenas origens autorizadas com credenciais', async () => {
      const { app } = buildTestApp();
      const allowed = await request(app).options('/api/auth/login').set('Origin', TEST_ORIGIN);
      expect(allowed.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');

      const evil = await request(app).options('/api/auth/login').set('Origin', 'https://evil.com');
      expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('CSRF (verificação de Origin)', () => {
    it.each([
      ['sem Origin/Referer', {}],
      ['com Origin malicioso', { Origin: 'https://evil.com' }],
      ['com Referer malicioso', { Referer: 'https://evil.com/form' }],
      ['com Origin "null"', { Origin: 'null' }],
    ])('bloqueia POST %s', async (_label, headers) => {
      const { app } = buildTestApp();
      const res = await request(app).post('/api/auth/login').set(headers).send(TEST_USER);
      expect(res.status).toBe(403);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('aceita Referer da origem autorizada', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/auth/login')
        .set('Referer', `${TEST_ORIGIN}/login`)
        .send(TEST_USER);
      expect(res.status).toBe(200);
    });

    it('rejeita corpo text/plain (formulário cross-site "simples")', async () => {
      const { app } = buildTestApp();
      const res = await request(app)
        .post('/api/auth/login')
        .set('Origin', TEST_ORIGIN)
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify(TEST_USER));
      expect(res.status).toBe(400);
    });
  });

  describe('Validação de entrada', () => {
    const post = (body: string | object, contentType = 'application/json') => {
      const { app } = buildTestApp();
      return request(app)
        .post('/api/auth/login')
        .set('Origin', TEST_ORIGIN)
        .set('Content-Type', contentType)
        .send(body);
    };

    it('rejeita JSON malformado sem expor stack trace', async () => {
      const res = await post('{"email": ');
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js|SyntaxError|stack/i);
    });

    it('rejeita payload maior que 10kb (413)', async () => {
      const res = await post({ email: TEST_USER.email, password: 'x'.repeat(20_000) });
      expect(res.status).toBe(413);
    });

    it('rejeita senha acima de 128 caracteres (DoS no hashing)', async () => {
      const res = await post({ email: TEST_USER.email, password: 'x'.repeat(129) });
      expect(res.status).toBe(400);
    });

    it.each([
      ["' OR '1'='1' --", 'qualquer'],
      ['paulo@orkut.com', "' OR '1'='1"],
      ['admin@orkut.com"; drop table app.users; --', 'x'],
    ])('trata tentativas de SQL injection como dados (email=%s)', async (email, password) => {
      const res = await post({ email, password });
      expect([400, 401]).toContain(res.status);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it.each([
      [{ email: { $ne: null }, password: { $ne: null } }],
      [{ email: ['paulo@orkut.com'], password: [TEST_USER.password] }],
      [{ email: TEST_USER.email, password: TEST_USER.password, remember: 'yes' }],
    ])('rejeita tipos inesperados (injeção de operadores) %#', async (body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
    });

    it('não é afetado por prototype pollution', async () => {
      const res = await post(
        `{"email":"${TEST_USER.email}","password":"${TEST_USER.password}","__proto__":{"isAdmin":true}}`,
      );
      expect(res.status).toBe(200);
      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    });

    it('descarta campos extras (mass assignment) e nunca retorna dados sensíveis', async () => {
      const res = await post({ ...TEST_USER, role: 'admin', id: 'forjado' });
      expect(res.status).toBe(200);
      expect(res.body.user.id).not.toBe('forjado');
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash|role/i);
    });
  });

  describe('Força bruta', () => {
    it('limita tentativas de login por IP (429)', async () => {
      const { app } = buildTestApp({
        rateLimits: { windowMs: 60_000, globalMax: 1_000, loginMax: 3 },
      });
      const attempt = () =>
        request(app)
          .post('/api/auth/login')
          .set('Origin', TEST_ORIGIN)
          .send({ email: TEST_USER.email, password: 'errada' });

      for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);

      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(blocked.headers['ratelimit-policy']).toBeDefined();
    });

    it('limita o volume global de requisições na API', async () => {
      const { app } = buildTestApp({
        rateLimits: { windowMs: 60_000, globalMax: 2, loginMax: 100 },
      });
      await request(app).get('/api/health');
      await request(app).get('/api/health');
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(429);
    });

    it('bloqueia a conta após 5 senhas incorretas, mesmo vindo de IPs diferentes', async () => {
      const { app } = buildTestApp();
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('Origin', TEST_ORIGIN)
          .send({ email: TEST_USER.email, password: `errada-${i}` });
      }
      const res = await request(app).post('/api/auth/login').set('Origin', TEST_ORIGIN).send(TEST_USER);
      expect(res.status).toBe(401);
    });
  });
});
