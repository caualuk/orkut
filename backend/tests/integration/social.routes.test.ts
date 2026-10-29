import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PgSocialRepository } from '../../src/modules/social/social.repository.js';
import { buildTestApp, TEST_ORIGIN, TEST_USER, type TestContext } from '../helpers/test-app.js';

const FRIEND = '6f1c1d38-6f3e-4a51-9a1f-6c0d5a1b2c3d';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

/** Repositório falso: cada método é um vi.fn configurável por teste. */
function fakeRepository() {
  return {
    getState: vi.fn(async () => ({ profile: { id: 'me' } })),
    updateProfile: vi.fn(async () => {}),
    setProfilePhoto: vi.fn(async () => {}),
    getProfilePhoto: vi.fn(async () => null),
    getSettings: vi.fn(async () => ({
      scrapVisibility: 'amigos',
      showRecentVisitors: true,
      allowTestimonials: true,
      appearOnline: true,
      theme: 'claro',
      language: 'pt-BR',
      notifications: { scraps: true, testimonials: true, friendRequests: true, birthdays: true },
    })),
    updateSettings: vi.fn(async () => {}),
    createScrap: vi.fn(async () => 'ok'),
    requestFriendship: vi.fn(async () => 'ok'),
    sendMessage: vi.fn(async () => 'ok'),
    searchPeople: vi.fn(async () => []),
    createCommunity: vi.fn(async (_user: string, data: { slug: string }) => data.slug),
    getCommunity: vi.fn(async () => null),
    toggleFeedLike: vi.fn(async () => {}),
    commentOnFeed: vi.fn(async () => {}),
  };
}

describe('Rotas /api/social', () => {
  let ctx: TestContext;
  let repo: ReturnType<typeof fakeRepository>;
  let cookie: string;

  beforeEach(async () => {
    repo = fakeRepository();
    ctx = buildTestApp({ socialRepository: repo as unknown as PgSocialRepository });
    const login = await request(ctx.app)
      .post('/api/auth/login')
      .set('Origin', TEST_ORIGIN)
      .send({ email: TEST_USER.email, password: TEST_USER.password });
    const header = login.headers['set-cookie'] as unknown as string[];
    cookie = header.find((c) => c.startsWith('orkut_sid='))!.split(';')[0]!;
  });

  const post = (path: string, body?: object) =>
    request(ctx.app)
      .post(`/api/social${path}`)
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookie)
      .send(body);

  it('exige sessão em todas as rotas', async () => {
    const res = await request(ctx.app).get('/api/social/state');
    expect(res.status).toBe(401);
    expect(repo.getState).not.toHaveBeenCalled();
  });

  it('bloqueia escrita sem Origin confiável (CSRF)', async () => {
    const res = await request(ctx.app)
      .post('/api/social/scraps')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .send({ to: FRIEND, text: 'oi' });
    expect(res.status).toBe(403);
    expect(repo.createScrap).not.toHaveBeenCalled();
  });

  it('GET /state devolve o estado do usuário da sessão', async () => {
    const res = await request(ctx.app).get('/api/social/state').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(repo.getState).toHaveBeenCalledWith(expect.any(String));
  });

  it('recado: valida e normaliza o texto e mapeia regras de amizade para 403', async () => {
    expect((await post('/scraps', { to: FRIEND, text: '   ' })).status).toBe(400);
    expect((await post('/scraps', { to: 'nao-e-uuid', text: 'oi' })).status).toBe(400);
    expect((await post('/scraps', { to: FRIEND, text: 'x'.repeat(1001) })).status).toBe(400);

    const ok = await post('/scraps', { to: FRIEND, text: '  oi\u0007 turma  ' });
    expect(ok.status).toBe(204);
    expect(repo.createScrap).toHaveBeenLastCalledWith(expect.any(String), FRIEND, 'oi turma');

    repo.createScrap.mockResolvedValueOnce('forbidden');
    const forbidden = await post('/scraps', { to: FRIEND, text: 'oi' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('perfil: aceita atualização parcial e rejeita campos desconhecidos ou inválidos', async () => {
    expect((await post('/profile', { interests: ['Música', 'Café'] })).status).toBe(204);
    expect(repo.updateProfile).toHaveBeenLastCalledWith(expect.any(String), {
      interests: ['Música', 'Café'],
    });

    expect((await post('/profile', { isAdmin: true })).status).toBe(400);
    expect((await post('/profile', { firstName: '<script>' })).status).toBe(400);
    expect((await post('/profile', { birthday: '2999-01-01' })).status).toBe(400);
  });

  it('preferências: mescla com as atuais', async () => {
    expect(
      (await post('/settings', { theme: 'escuro', notifications: { scraps: false } })).status,
    ).toBe(204);
    expect(repo.updateSettings).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        theme: 'escuro',
        appearOnline: true,
        notifications: expect.objectContaining({ scraps: false, testimonials: true }),
      }),
    );
  });

  it('foto: aceita PNG verdadeiro e recusa arquivos disfarçados', async () => {
    const ok = await request(ctx.app)
      .post('/api/social/profile/photo')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookie)
      .set('Content-Type', 'image/png')
      .send(PNG);
    expect(ok.status).toBe(204);
    expect(repo.setProfilePhoto).toHaveBeenCalledWith(expect.any(String), {
      mimeType: 'image/png',
      data: PNG,
    });

    const fake = await request(ctx.app)
      .post('/api/social/profile/photo')
      .set('Origin', TEST_ORIGIN)
      .set('Cookie', cookie)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('<svg onload=alert(1)>'));
    expect(fake.status).toBe(400);
  });

  it('foto inexistente → 404 e ids inválidos não chegam ao banco', async () => {
    const missing = await request(ctx.app)
      .get(`/api/social/users/${FRIEND}/photo`)
      .set('Cookie', cookie);
    expect(missing.status).toBe(404);
    const invalid = await request(ctx.app)
      .get('/api/social/users/1%27or%271/photo')
      .set('Cookie', cookie);
    expect(invalid.status).toBe(404);
    expect(repo.getProfilePhoto).toHaveBeenCalledTimes(1);
  });

  it('comunidade: gera o slug a partir do nome e tenta sufixos quando já existe', async () => {
    repo.createCommunity.mockResolvedValueOnce(null as unknown as string);
    const res = await post('/communities', {
      name: 'Eu odeio acordar cedo!',
      category: 'Humor',
      about: '',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ slug: 'eu-odeio-acordar-cedo-2' });

    expect((await post('/communities', { name: '!!!', category: 'Humor', about: '' })).status).toBe(
      400,
    );
    expect(
      (await post('/communities', { name: 'Ok ok', category: 'x', about: '', icon: 'javascript' }))
        .status,
    ).toBe(400);
  });

  it('feed: só aceita chaves de item no formato esperado', async () => {
    expect((await post('/feed/like', { item: `status:${FRIEND}` })).status).toBe(204);
    expect((await post('/feed/like', { item: "status:'; drop table app.users; --" })).status).toBe(
      400,
    );
    expect((await post('/feed/comment', { item: `status:${FRIEND}`, text: 'Boa!' })).status).toBe(
      204,
    );
    expect(repo.commentOnFeed).toHaveBeenCalledWith(expect.any(String), `status:${FRIEND}`, 'Boa!');
  });
});
