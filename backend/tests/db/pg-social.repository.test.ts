import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';
import { runMigrations } from '../../src/db/migrate.js';
import { createPool, type Database } from '../../src/db/pool.js';
import { PgSocialRepository } from '../../src/modules/social/social.repository.js';

/**
 * Fluxo social completo no PostgreSQL real, com dois usuários temporários
 * (removidos ao final; o `on delete cascade` limpa tudo o que criaram).
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const stamp = Date.now();
const emails = [`social-a+${stamp}@orkut.test`, `social-b+${stamp}@orkut.test`];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe.skipIf(!hasDatabase)('PgSocialRepository (PostgreSQL)', () => {
  let db: Database;
  let repo: PgSocialRepository;
  let ana: string;
  let bia: string;
  let communitySlug: string | null = null;

  beforeAll(async () => {
    db = createPool(loadConfig().database);
    await runMigrations(db);
    const insert = async (email: string, name: string) =>
      (
        await db.query<{ id: string }>(
          `insert into app.users (email, display_name, password_hash) values ($1, $2, 'x') returning id`,
          [email, name],
        )
      ).rows[0]!.id;
    ana = await insert(emails[0]!, 'Ana Teste');
    bia = await insert(emails[1]!, 'Bia Teste');
    repo = new PgSocialRepository(db);
  });

  afterAll(async () => {
    if (communitySlug)
      await db.query('delete from app.communities where slug = $1', [communitySlug]);
    await db.query('delete from app.users where email = any($1)', [emails]);
    await db.end();
  });

  it('cria o perfil a partir do nome da conta e começa sem dados', async () => {
    const state = await repo.getState(ana);
    expect(state.profile).toMatchObject({ firstName: 'Ana', lastName: 'Teste', fans: 0 });
    expect(state.friends).toEqual([]);
    expect(state.scraps).toEqual([]);
    expect(state.settings.appearOnline).toBe(true);
  });

  it('recados e mensagens exigem amizade', async () => {
    await repo.touch(bia);
    expect(await repo.createScrap(ana, bia, 'oi')).toBe('forbidden');
    expect(await repo.sendMessage(ana, bia, 'oi')).toBe('forbidden');
  });

  it('pedido → aceite → amizade, sem duplicar pedido invertido', async () => {
    expect(await repo.requestFriendship(ana, bia)).toBe('ok');
    expect((await repo.listFriendRequests(bia)).map((r) => r.id)).toEqual([ana]);
    expect(await repo.acceptFriendRequest(bia, ana)).toBe('ok');
    expect(await repo.requestFriendship(bia, ana)).toBe('conflict');
    expect((await repo.listFriends(ana)).map((f) => f.name)).toEqual(['Bia Teste']);
  });

  it('recado, resposta, curtida, leitura e exclusão', async () => {
    expect(await repo.createScrap(ana, bia, 'Saudades!')).toBe('ok');
    const [received] = await repo.listScraps(bia);
    expect(received).toMatchObject({ text: 'Saudades!', direction: 'recebido', read: false });

    expect(await repo.toggleScrapLike(bia, received!.id)).toBe('ok');
    expect(await repo.replyToScrap(bia, received!.id, 'Eu também!')).toBe('ok');
    const [updated] = (await repo.listScraps(bia)).filter((s) => s.id === received!.id);
    expect(updated).toMatchObject({ read: true, liked: true, likes: 1, replies: ['Eu também!'] });
    expect((await repo.listScraps(ana)).some((s) => s.text === 'Eu também!')).toBe(true);

    expect(await repo.deleteScrap(bia, received!.id)).toBe('ok');
  });

  it('mensagens: conversa, não lidas e leitura', async () => {
    expect(await repo.sendMessage(ana, bia, 'Bora no sábado?')).toBe('ok');
    const [conversation] = await repo.listConversations(bia);
    expect(conversation).toMatchObject({ unread: 1, person: { id: ana } });
    await repo.markConversationRead(bia, ana);
    expect((await repo.listConversations(bia))[0]?.unread).toBe(0);
  });

  it('depoimento fica pendente até a aprovação', async () => {
    expect(await repo.writeTestimonial(ana, bia, 'Amiga demais!')).toBe('ok');
    const [pending] = await repo.listTestimonials(bia);
    expect(pending?.status).toBe('pendente');
    expect(await repo.approveTestimonial(bia, pending!.id)).toBe('ok');
    expect((await repo.listTestimonials(bia))[0]?.status).toBe('recebido');
    expect((await repo.listTestimonials(ana))[0]?.status).toBe('enviado');
  });

  it('álbum: foto visível para amigos só quando o álbum permite', async () => {
    const privateAlbum = await repo.createAlbum(ana, 'Privado', 'somente-eu');
    const friendsAlbum = await repo.createAlbum(ana, 'Viagem', 'amigos');
    await repo.addPhoto(ana, privateAlbum, { mimeType: 'image/png', data: PNG }, '');
    await repo.addPhoto(ana, friendsAlbum, { mimeType: 'image/png', data: PNG }, '');
    const photos = await repo.listRecentPhotos(ana);
    const privatePhoto = photos.find((p) => p.albumId === privateAlbum)!;
    const friendsPhoto = photos.find((p) => p.albumId === friendsAlbum)!;

    expect(await repo.getPhoto(bia, privatePhoto.id)).toBeNull();
    expect((await repo.getPhoto(bia, friendsPhoto.id))?.data.equals(PNG)).toBe(true);
    expect(await repo.addPhoto(bia, friendsAlbum, { mimeType: 'image/png', data: PNG }, '')).toBe(
      'not-found',
    );
  });

  it('feed: status do amigo com curtida e comentário', async () => {
    await repo.postStatus(ana, 'Partiu praia!');
    const item = (await repo.listFeed(bia)).find((i) => i.kind === 'status');
    expect(item).toMatchObject({ status: 'Partiu praia!', actor: { id: ana }, likes: 0 });
    await repo.toggleFeedLike(bia, item!.id);
    await repo.commentOnFeed(bia, item!.id, 'Leva protetor!');
    const updated = (await repo.listFeed(bia)).find((i) => i.id === item!.id);
    expect(updated).toMatchObject({ likes: 1, liked: true, comments: 1 });
    expect(updated?.commentList?.[0]).toMatchObject({
      text: 'Leva protetor!',
      author: { id: bia },
    });
  });

  it('comunidade: criar, entrar, tópico, enquete e evento', async () => {
    communitySlug = await repo.createCommunity(ana, {
      slug: `teste-${stamp}`,
      name: 'Comunidade de teste',
      category: 'Testes',
      about: '',
      icon: 'groups',
    });
    expect(communitySlug).toBe(`teste-${stamp}`);
    const created = (await repo.getCommunity(bia, communitySlug!))!;
    expect(created).toMatchObject({ joined: false, members: 1, owner: { id: ana } });

    expect(await repo.createTopic(bia, created.id, 'Olá pessoal')).toBe('forbidden');
    expect(await repo.joinCommunity(bia, created.id)).toBe('ok');
    expect(await repo.createTopic(bia, created.id, 'Olá pessoal')).toBe('ok');
    expect(await repo.createPoll(ana, created.id, 'Café ou chá?', ['Café', 'Chá'])).toBe('ok');
    const poll = (await repo.getCommunity(bia, communitySlug!))!.polls[0]!;
    expect(await repo.vote(bia, poll.id, 0)).toBe('ok');
    expect(await repo.vote(bia, poll.id, 1)).toBe('conflict');
    expect(await repo.leaveCommunity(ana, created.id)).toBe('forbidden');

    const detail = (await repo.getCommunity(bia, communitySlug!))!;
    expect(detail.topics[0]).toMatchObject({ title: 'Olá pessoal', author: { id: bia } });
    expect(detail.polls[0]).toMatchObject({ votedIndex: 0, options: [{ votes: 1 }, { votes: 0 }] });
    expect(detail.friendsInside.map((p) => p.id)).toEqual([ana]);
  });

  it('foto da comunidade: só o dono troca e remove', async () => {
    const created = (await repo.getCommunity(bia, communitySlug!))!;
    const image = { mimeType: 'image/png', data: PNG };

    expect(await repo.setCommunityPhoto(bia, created.id, image)).toBe('forbidden');
    expect(await repo.setCommunityPhoto(ana, created.id, image)).toBe('ok');
    expect((await repo.getCommunity(bia, communitySlug!))!.hasPhoto).toBe(true);
    expect(await repo.getCommunityPhoto(created.id)).toMatchObject({ mimeType: 'image/png' });

    expect(await repo.removeCommunityPhoto(bia, created.id)).toBe('forbidden');
    expect(await repo.removeCommunityPhoto(ana, created.id)).toBe('ok');
    expect((await repo.getCommunity(bia, communitySlug!))!.hasPhoto).toBe(false);
  });

  it('excluir comunidade: só o dono, levando junto o que é dela no feed', async () => {
    const slug = `excluir-${stamp}`;
    await repo.createCommunity(ana, {
      slug,
      name: 'Comunidade a excluir',
      category: 'Testes',
      about: '',
      icon: 'groups',
    });
    const { id } = (await repo.getCommunity(ana, slug))!;
    await repo.createTopic(ana, id, 'Vai sumir');
    const item = `comunidades:${id}:${ana}`;
    await repo.toggleFeedLike(bia, item);
    await repo.commentOnFeed(bia, item, 'Vai sumir também');

    expect(await repo.deleteCommunity(bia, id)).toBe('forbidden');
    expect(await repo.getCommunity(bia, slug)).not.toBeNull();

    expect(await repo.deleteCommunity(ana, id)).toBe('ok');
    expect(await repo.getCommunity(ana, slug)).toBeNull();
    expect(await repo.deleteCommunity(ana, id)).toBe('not-found');
    const leftovers = await db.query(
      `select 1 from app.feed_likes where item_key = $1
       union all select 1 from app.feed_comments where item_key = $1`,
      [item],
    );
    expect(leftovers.rowCount).toBe(0);
  });

  it('busca de pessoas trata curingas do LIKE como texto', async () => {
    expect((await repo.searchPeople(ana, 'Bia')).map((p) => p.id)).toContain(bia);
    expect(await repo.searchPeople(ana, '%')).toEqual([]);
  });
});
