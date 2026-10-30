import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, TEST_ORIGIN, TEST_USER, type TestContext } from '../helpers/test-app.js';

const VALID_SIGNUP = {
  firstName: 'Nina',
  lastName: 'Costa',
  email: 'nina@orkut.com',
  password: 'saudade2004',
  birthDate: '1995-03-12',
  gender: 'feminino',
  relationship: 'solteiro',
  city: 'São Paulo, SP',
  about: 'Fã de café e de scraps.',
  acceptTerms: true,
};

describe('POST /api/auth/signup', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = buildTestApp();
  });

  const postSignup = (body: unknown, app = ctx.app) =>
    request(app)
      .post('/api/auth/signup')
      .set('Origin', TEST_ORIGIN)
      .send(body as object);

  it('cria a conta, inicia sessão e responde 201 sem dados sensíveis', async () => {
    const res = await postSignup(VALID_SIGNUP);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: { id: expect.any(String), email: 'nina@orkut.com', displayName: 'Nina Costa' },
    });

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('orkut_sid='),
    );
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);

    const me = await request(ctx.app).get('/api/auth/me').set('Cookie', cookie!);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('nina@orkut.com');
  });

  it('guarda a senha somente como hash e repassa nascimento e sexo', async () => {
    await postSignup(VALID_SIGNUP);

    const [created] = ctx.repository.created;
    expect(created?.passwordHash).toBe(`hashed:${VALID_SIGNUP.password}`);
    expect(created?.birthDate).toBe('1995-03-12');
    expect(created?.gender).toBe('feminino');
  });

  it('repassa os dados de perfil das etapas 1 e 2 (relacionamento, cidade, descrição)', async () => {
    await postSignup({ ...VALID_SIGNUP, city: '  Recife, PE ', about: '  Oi!  ' });

    expect(ctx.repository.created[0]).toMatchObject({
      firstName: 'Nina',
      lastName: 'Costa',
      relationship: 'solteiro',
      city: 'Recife, PE',
      about: 'Oi!',
    });
  });

  it('aceita campos opcionais ausentes com padrões seguros', async () => {
    const res = await postSignup({
      ...VALID_SIGNUP,
      birthDate: undefined,
      gender: undefined,
      relationship: undefined,
      city: undefined,
      about: undefined,
    });

    expect(res.status).toBe(201);
    expect(ctx.repository.created[0]).toMatchObject({
      birthDate: null,
      gender: null,
      relationship: 'nao-informar',
      city: '',
      about: '',
    });
  });

  it('normaliza e-mail e nomes', async () => {
    const res = await postSignup({
      ...VALID_SIGNUP,
      firstName: '  Nina ',
      lastName: ' Costa  ',
      email: '  NINA@Orkut.COM ',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'nina@orkut.com', displayName: 'Nina Costa' });
  });

  it('responde 409 quando o e-mail já existe, sem criar sessão', async () => {
    const res = await postSignup({ ...VALID_SIGNUP, email: TEST_USER.email });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    ['senha curta', { password: 'abc123' }, 'password'],
    ['senha sem números', { password: 'somenteletras' }, 'password'],
    ['senha sem letras', { password: '1234567890' }, 'password'],
    ['e-mail inválido', { email: 'nina' }, 'email'],
    ['nome vazio', { firstName: '   ' }, 'firstName'],
    ['termos não aceitos', { acceptTerms: false }, 'acceptTerms'],
    ['sexo fora da lista', { gender: 'robô' }, 'gender'],
    ['relacionamento fora da lista', { relationship: 'complicado' }, 'relationship'],
    ['cidade longa demais', { city: 'x'.repeat(81) }, 'city'],
    ['descrição longa demais', { about: 'x'.repeat(501) }, 'about'],
    ['data inválida', { birthDate: '1995-02-30' }, 'birthDate'],
    ['menor de 13 anos', { birthDate: new Date().toISOString().slice(0, 10) }, 'birthDate'],
  ])('rejeita %s com 400', async (_case, override, field) => {
    const res = await postSignup({ ...VALID_SIGNUP, ...override });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(ctx.repository.created).toHaveLength(0);
  });

  it('descarta campos desconhecidos (sem mass assignment)', async () => {
    const res = await postSignup({ ...VALID_SIGNUP, id: 'x', passwordHash: 'x', isAdmin: true });

    expect(res.status).toBe(201);
    expect(ctx.repository.created[0]).not.toHaveProperty('isAdmin');
    expect(ctx.repository.created[0]?.passwordHash).toBe(`hashed:${VALID_SIGNUP.password}`);
  });

  it('bloqueia requisições de outra origem (CSRF)', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/signup')
      .set('Origin', 'https://evil.example')
      .send(VALID_SIGNUP);

    expect(res.status).toBe(403);
    expect(ctx.repository.created).toHaveLength(0);
  });

  it('limita tentativas de cadastro por IP', async () => {
    const limited = buildTestApp({
      rateLimits: { windowMs: 60_000, globalMax: 1_000, loginMax: 1_000, signupMax: 2 },
    });

    await postSignup({ ...VALID_SIGNUP, email: 'a@orkut.com' }, limited.app);
    await postSignup({ ...VALID_SIGNUP, email: 'b@orkut.com' }, limited.app);
    const third = await postSignup({ ...VALID_SIGNUP, email: 'c@orkut.com' }, limited.app);

    expect(third.status).toBe(429);
  });
});
