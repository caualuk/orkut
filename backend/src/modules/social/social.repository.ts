import type { Database } from '../../db/pool.js';
import { communityHasPhoto, person, TOUCH_PROFILE } from './sql.js';
import {
  DEFAULT_SETTINGS,
  type AlbumDto,
  type CommunityDetailDto,
  type CommunitySummaryDto,
  type ConversationDto,
  type FeedItemDto,
  type FriendDto,
  type FriendRequestDto,
  type PersonDto,
  type PhotoDto,
  type ProfileDto,
  type ScrapDto,
  type SettingsDto,
  type SocialStateDto,
  type SuggestionDto,
  type TestimonialDto,
  type Visibility,
} from './social.types.js';

export interface ProfileChanges {
  firstName: string;
  lastName: string;
  gender: string | null;
  relationship: string;
  birthday: string | null;
  city: string;
  country: string;
  about: string;
  interests: string[];
  social: Record<string, string>;
  contact: Record<string, string>;
  professional: Record<string, string>;
  personal: Record<string, string>;
}

export interface StoredImage {
  mimeType: string;
  data: Buffer;
}

/** Resultado de ações que dependem de outra pessoa/recurso existir e ser permitido. */
export type ActionResult = 'ok' | 'not-found' | 'forbidden' | 'conflict';

const MAX_SCRAPS = 100;
const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 100;
const MAX_FEED = 40;

/**
 * Persistência da rede social em PostgreSQL. Todas as queries são
 * parametrizadas; regras de permissão (amizade, dono, visibilidade) ficam no
 * próprio SQL para não haver janela entre a checagem e a escrita.
 */
export class PgSocialRepository {
  constructor(private readonly db: Database) {}

  // ── Sessão / estado ────────────────────────────────────────────────────────

  async touch(userId: string): Promise<void> {
    await this.db.query(TOUCH_PROFILE, [userId]);
  }

  async getState(userId: string): Promise<SocialStateDto> {
    await this.touch(userId);
    const [
      profile,
      settings,
      friends,
      friendRequests,
      suggestions,
      scraps,
      conversations,
      testimonials,
      albums,
      photos,
      feed,
      communities,
    ] = await Promise.all([
      this.getProfile(userId),
      this.getSettings(userId),
      this.listFriends(userId),
      this.listFriendRequests(userId),
      this.listSuggestions(userId),
      this.listScraps(userId),
      this.listConversations(userId),
      this.listTestimonials(userId),
      this.listAlbums(userId),
      this.listRecentPhotos(userId),
      this.listFeed(userId),
      this.listCommunities(userId),
    ]);
    return {
      profile,
      settings,
      friends,
      friendRequests,
      suggestions,
      scraps,
      conversations,
      testimonials,
      albums,
      photos,
      feed,
      communities,
    };
  }

  // ── Perfil ────────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<ProfileDto> {
    const { rows } = await this.db.query<ProfileDto>(
      `select u.id, u.email,
              p.first_name as "firstName", p.last_name as "lastName",
              coalesce(u.gender, 'nao-informar') as gender,
              p.relationship, to_char(u.birth_date, 'YYYY-MM-DD') as birthday,
              p.city, p.country, p.about, p.interests,
              p.social, p.contact, p.professional, p.personal,
              exists (select 1 from app.profile_photos pp where pp.user_id = u.id) as "hasPhoto",
              (select count(*)::int from app.fans f where f.user_id = u.id) as fans,
              u.created_at as "memberSince",
              json_build_object(
                'total', (select count(*)::int from app.profile_visits v where v.visited_id = u.id),
                'lastWeek', (select count(*)::int from app.profile_visits v
                              where v.visited_id = u.id and v.visited_at > now() - interval '7 days'),
                'yesterday', (select count(*)::int from app.profile_visits v
                               where v.visited_id = u.id
                                 and v.visited_at >= date_trunc('day', now()) - interval '1 day'
                                 and v.visited_at < date_trunc('day', now()))
              ) as visits,
              coalesce((
                select json_agg(${person('vu')} order by v.visited_at desc)
                  from (select * from app.profile_visits v where v.visited_id = u.id
                         order by v.visited_at desc limit 5) v
                  join app.users vu on vu.id = v.visitor_id
              ), '[]') as "recentVisitors"
         from app.users u
         join app.profiles p on p.user_id = u.id
        where u.id = $1`,
      [userId],
    );
    const profile = rows[0];
    if (!profile) throw new Error('Perfil inexistente para usuário autenticado');
    return { ...profile, memberSince: new Date(profile.memberSince).toISOString() };
  }

  /** Atualização parcial: só os campos enviados mudam. */
  async updateProfile(userId: string, partial: Partial<ProfileChanges>): Promise<void> {
    const current = await this.getProfile(userId);
    const changes: ProfileChanges = {
      firstName: current.firstName,
      lastName: current.lastName,
      gender: current.gender,
      relationship: current.relationship,
      birthday: current.birthday,
      city: current.city,
      country: current.country,
      about: current.about,
      interests: current.interests,
      social: current.social,
      contact: current.contact,
      professional: current.professional,
      personal: current.personal,
      ...partial,
    };
    const client = await this.db.connect();
    try {
      await client.query('begin');
      await client.query(
        `update app.profiles
            set first_name = $2, last_name = $3, relationship = $4, city = $5, country = $6,
                about = $7, interests = $8, social = $9, contact = $10, professional = $11,
                personal = $12, updated_at = now()
          where user_id = $1`,
        [
          userId,
          changes.firstName,
          changes.lastName,
          changes.relationship,
          changes.city,
          changes.country,
          changes.about,
          changes.interests,
          changes.social,
          changes.contact,
          changes.professional,
          changes.personal,
        ],
      );
      await client.query(
        `update app.users set display_name = $2, gender = $3, birth_date = $4 where id = $1`,
        [
          userId,
          `${changes.firstName} ${changes.lastName}`.trim(),
          changes.gender,
          changes.birthday,
        ],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async setProfilePhoto(userId: string, image: StoredImage): Promise<void> {
    await this.db.query(
      `insert into app.profile_photos (user_id, mime_type, data) values ($1, $2, $3)
       on conflict (user_id) do update set mime_type = $2, data = $3, updated_at = now()`,
      [userId, image.mimeType, image.data],
    );
  }

  async removeProfilePhoto(userId: string): Promise<void> {
    await this.db.query('delete from app.profile_photos where user_id = $1', [userId]);
  }

  /** Fotos de perfil são visíveis para qualquer membro autenticado. */
  async getProfilePhoto(userId: string): Promise<StoredImage | null> {
    const { rows } = await this.db.query<{ mime_type: string; data: Buffer }>(
      'select mime_type, data from app.profile_photos where user_id = $1',
      [userId],
    );
    const row = rows[0];
    return row ? { mimeType: row.mime_type, data: row.data } : null;
  }

  // ── Preferências ──────────────────────────────────────────────────────────

  async getSettings(userId: string): Promise<SettingsDto> {
    const { rows } = await this.db.query<{ settings: Partial<SettingsDto> }>(
      'select settings from app.profiles where user_id = $1',
      [userId],
    );
    const stored = rows[0]?.settings ?? {};
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...stored.notifications },
    };
  }

  async updateSettings(userId: string, settings: SettingsDto): Promise<void> {
    await this.db.query('update app.profiles set settings = $2 where user_id = $1', [
      userId,
      settings,
    ]);
  }

  // ── Pessoas e amizades ────────────────────────────────────────────────────

  async userExists(userId: string): Promise<boolean> {
    const { rows } = await this.db.query('select 1 from app.users where id = $1', [userId]);
    return rows.length > 0;
  }

  /** Busca membros reais pelo nome (exceto o próprio usuário). */
  async searchPeople(userId: string, query: string): Promise<SuggestionDto[]> {
    const { rows } = await this.db.query<SuggestionDto>(
      `select ${person('u')}::jsonb || jsonb_build_object(
                'mutualFriends', app.mutual_friends($1, u.id),
                'requested', exists (select 1 from app.friendships f
                                      where f.requester_id = $1 and f.addressee_id = u.id
                                        and f.accepted_at is null),
                'friend', app.are_friends($1, u.id)
              ) as item
         from app.users u
        where u.id <> $1
          and u.display_name ilike '%' || $2 || '%' escape '\\'
        order by app.are_friends($1, u.id) desc, u.display_name
        limit 20`,
      [userId, escapeLike(query)],
    );
    return rows.map((row) => (row as unknown as { item: SuggestionDto }).item);
  }

  async listFriends(userId: string): Promise<FriendDto[]> {
    const { rows } = await this.db.query<{ item: FriendDto }>(
      `select ${person('u')}::jsonb || jsonb_build_object(
                'bestFriend', exists (select 1 from app.best_friends b
                                       where b.user_id = $1 and b.friend_id = u.id),
                'mutualFriends', app.mutual_friends($1, u.id),
                -- Aniversário de hoje no fuso do Brasil (o mesmo do público do orkut).
                'birthdayToday', u.birth_date is not null
                  and to_char(u.birth_date, 'MM-DD')
                    = to_char(now() at time zone 'America/Sao_Paulo', 'MM-DD')
              ) as item
         from app.friend_ids($1) fid
         join app.users u on u.id = fid
        order by u.display_name`,
      [userId],
    );
    return rows.map((row) => row.item);
  }

  async listFriendRequests(userId: string): Promise<FriendRequestDto[]> {
    const { rows } = await this.db.query<{ item: FriendRequestDto }>(
      `select ${person('u')}::jsonb || jsonb_build_object(
                'mutualFriends', app.mutual_friends($1, u.id),
                'createdAt', f.created_at
              ) as item
         from app.friendships f
         join app.users u on u.id = f.requester_id
        where f.addressee_id = $1 and f.accepted_at is null
        order by f.created_at desc`,
      [userId],
    );
    return rows.map((row) => row.item);
  }

  /** Amigos de amigos primeiro; depois membros recentes que ainda não são amigos. */
  async listSuggestions(userId: string): Promise<SuggestionDto[]> {
    const { rows } = await this.db.query<{ item: SuggestionDto }>(
      `select ${person('u')}::jsonb || jsonb_build_object(
                'mutualFriends', app.mutual_friends($1, u.id),
                'requested', exists (select 1 from app.friendships f
                                      where f.requester_id = $1 and f.addressee_id = u.id)
              ) as item
         from app.users u
        where u.id <> $1
          and not exists (
            select 1 from app.friendships f
             where least(f.requester_id, f.addressee_id) = least($1::uuid, u.id)
               and greatest(f.requester_id, f.addressee_id) = greatest($1::uuid, u.id)
               and (f.accepted_at is not null or f.requester_id = u.id)
          )
        order by app.mutual_friends($1, u.id) desc, u.created_at desc
        limit 6`,
      [userId],
    );
    return rows.map((row) => row.item);
  }

  /**
   * Pede amizade. Se a outra pessoa já tinha pedido, aceita direto.
   * `conflict` quando já são amigos.
   */
  async requestFriendship(userId: string, targetId: string): Promise<ActionResult> {
    if (userId === targetId || !(await this.userExists(targetId))) return 'not-found';
    const reverse = await this.db.query(
      `update app.friendships set accepted_at = now()
        where requester_id = $2 and addressee_id = $1 and accepted_at is null`,
      [userId, targetId],
    );
    if (reverse.rowCount) return 'ok';
    const inserted = await this.db.query(
      `insert into app.friendships (requester_id, addressee_id) values ($1, $2)
       on conflict do nothing`,
      [userId, targetId],
    );
    if (inserted.rowCount) return 'ok';
    return (await this.areFriends(userId, targetId)) ? 'conflict' : 'ok';
  }

  async cancelFriendRequest(userId: string, targetId: string): Promise<void> {
    await this.db.query(
      `delete from app.friendships
        where requester_id = $1 and addressee_id = $2 and accepted_at is null`,
      [userId, targetId],
    );
  }

  async acceptFriendRequest(userId: string, requesterId: string): Promise<ActionResult> {
    const { rowCount } = await this.db.query(
      `update app.friendships set accepted_at = now()
        where requester_id = $2 and addressee_id = $1 and accepted_at is null`,
      [userId, requesterId],
    );
    return rowCount ? 'ok' : 'not-found';
  }

  async rejectFriendRequest(userId: string, requesterId: string): Promise<void> {
    await this.db.query(
      `delete from app.friendships
        where requester_id = $2 and addressee_id = $1 and accepted_at is null`,
      [userId, requesterId],
    );
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.db.query(
      `delete from app.friendships
        where least(requester_id, addressee_id) = least($1::uuid, $2::uuid)
          and greatest(requester_id, addressee_id) = greatest($1::uuid, $2::uuid)`,
      [userId, friendId],
    );
    await this.db.query(
      `delete from app.best_friends
        where (user_id = $1 and friend_id = $2) or (user_id = $2 and friend_id = $1)`,
      [userId, friendId],
    );
  }

  async setBestFriend(userId: string, friendId: string, best: boolean): Promise<ActionResult> {
    if (!(await this.areFriends(userId, friendId))) return 'forbidden';
    await this.db.query(
      best
        ? 'insert into app.best_friends (user_id, friend_id) values ($1, $2) on conflict do nothing'
        : 'delete from app.best_friends where user_id = $1 and friend_id = $2',
      [userId, friendId],
    );
    return 'ok';
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    const { rows } = await this.db.query<{ ok: boolean }>('select app.are_friends($1, $2) as ok', [
      a,
      b,
    ]);
    return rows[0]?.ok ?? false;
  }

  /** Torna-se fã (ou deixa de ser) de um amigo. */
  async setFan(userId: string, targetId: string, fan: boolean): Promise<ActionResult> {
    if (!(await this.areFriends(userId, targetId))) return 'forbidden';
    await this.db.query(
      fan
        ? 'insert into app.fans (user_id, fan_id) values ($2, $1) on conflict do nothing'
        : 'delete from app.fans where user_id = $2 and fan_id = $1',
      [userId, targetId],
    );
    return 'ok';
  }

  // ── Recados ───────────────────────────────────────────────────────────────

  async listScraps(userId: string): Promise<ScrapDto[]> {
    const { rows } = await this.db.query<{ item: ScrapDto }>(
      `select json_build_object(
                'id', s.id,
                'author', ${person('a')},
                'recipient', ${person('r')},
                'text', s.body,
                'createdAt', s.created_at,
                -- O que o próprio usuário escreveu (inclusive no próprio mural) conta como lido
                -- e aparece em "Enviados".
                'read', s.author_id = $1 or s.read_at is not null,
                'liked', exists (select 1 from app.scrap_likes l where l.scrap_id = s.id and l.user_id = $1),
                'likes', (select count(*)::int from app.scrap_likes l where l.scrap_id = s.id),
                'direction', case when s.author_id = $1 then 'enviado' else 'recebido' end,
                'replies', coalesce((select json_agg(rp.body order by rp.created_at)
                                       from app.scraps rp
                                      where rp.reply_to_id = s.id and rp.author_id = $1), '[]')
              ) as item
         from app.scraps s
         join app.users a on a.id = s.author_id
         join app.users r on r.id = s.recipient_id
        where s.recipient_id = $1
           or (s.author_id = $1 and s.reply_to_id is null)
        order by s.created_at desc
        limit ${MAX_SCRAPS}`,
      [userId],
    );
    return rows.map((row) => row.item);
  }

  /** Recados só entre amigos (ou no próprio perfil). */
  async createScrap(
    userId: string,
    recipientId: string,
    text: string,
    replyToId: string | null = null,
  ): Promise<ActionResult> {
    if (recipientId !== userId && !(await this.areFriends(userId, recipientId))) {
      return (await this.userExists(recipientId)) ? 'forbidden' : 'not-found';
    }
    await this.db.query(
      `insert into app.scraps (author_id, recipient_id, body, reply_to_id) values ($1, $2, $3, $4)`,
      [userId, recipientId, text, replyToId],
    );
    return 'ok';
  }

  /** Responde no perfil de quem escreveu o recado recebido. */
  async replyToScrap(userId: string, scrapId: string, text: string): Promise<ActionResult> {
    const { rows } = await this.db.query<{ author_id: string }>(
      'select author_id from app.scraps where id = $1 and recipient_id = $2',
      [scrapId, userId],
    );
    const original = rows[0];
    if (!original) return 'not-found';
    await this.db.query('update app.scraps set read_at = coalesce(read_at, now()) where id = $1', [
      scrapId,
    ]);
    return this.createScrap(userId, original.author_id, text, scrapId);
  }

  async toggleScrapLike(userId: string, scrapId: string): Promise<ActionResult> {
    const { rows } = await this.db.query(
      'select 1 from app.scraps where id = $1 and (recipient_id = $2 or author_id = $2)',
      [scrapId, userId],
    );
    if (!rows.length) return 'not-found';
    const removed = await this.db.query(
      'delete from app.scrap_likes where scrap_id = $1 and user_id = $2',
      [scrapId, userId],
    );
    if (!removed.rowCount) {
      await this.db.query('insert into app.scrap_likes (scrap_id, user_id) values ($1, $2)', [
        scrapId,
        userId,
      ]);
    }
    return 'ok';
  }

  async markScrapRead(userId: string, scrapId: string): Promise<void> {
    await this.db.query(
      `update app.scraps set read_at = coalesce(read_at, now())
        where id = $1 and recipient_id = $2`,
      [scrapId, userId],
    );
  }

  /** Quem escreveu ou quem recebeu pode apagar o recado. */
  async deleteScrap(userId: string, scrapId: string): Promise<ActionResult> {
    const { rowCount } = await this.db.query(
      'delete from app.scraps where id = $1 and (recipient_id = $2 or author_id = $2)',
      [scrapId, userId],
    );
    return rowCount ? 'ok' : 'not-found';
  }

  // ── Mensagens ─────────────────────────────────────────────────────────────

  async listConversations(userId: string): Promise<ConversationDto[]> {
    const { rows } = await this.db.query<{ item: ConversationDto }>(
      `with pairs as (
         select case when m.sender_id = $1 then m.recipient_id else m.sender_id end as other_id,
                max(m.created_at) as last_at
           from app.messages m
          where $1 in (m.sender_id, m.recipient_id)
          group by 1
          order by 2 desc
          limit ${MAX_CONVERSATIONS}
       )
       select json_build_object(
                'person', ${person('u')},
                'unread', (select count(*)::int from app.messages m
                            where m.sender_id = u.id and m.recipient_id = $1 and m.read_at is null),
                'lastActivity', p.last_at,
                'messages', coalesce((
                  select json_agg(json_build_object(
                           'id', x.id, 'fromMe', x.sender_id = $1, 'text', x.body,
                           'createdAt', x.created_at, 'read', x.read_at is not null)
                         order by x.created_at)
                    from (select * from app.messages m
                           where (m.sender_id = $1 and m.recipient_id = u.id)
                              or (m.sender_id = u.id and m.recipient_id = $1)
                           order by m.created_at desc
                           limit ${MAX_MESSAGES}) x
                ), '[]')
              ) as item
         from pairs p
         join app.users u on u.id = p.other_id
        order by p.last_at desc`,
      [userId],
    );
    return rows.map((row) => row.item);
  }

  /** Mensagens privadas só entre amigos. */
  async sendMessage(userId: string, recipientId: string, text: string): Promise<ActionResult> {
    if (userId === recipientId) return 'forbidden';
    if (!(await this.areFriends(userId, recipientId))) {
      return (await this.userExists(recipientId)) ? 'forbidden' : 'not-found';
    }
    await this.db.query(
      'insert into app.messages (sender_id, recipient_id, body) values ($1, $2, $3)',
      [userId, recipientId, text],
    );
    return 'ok';
  }

  async markConversationRead(userId: string, otherId: string): Promise<void> {
    await this.db.query(
      `update app.messages set read_at = now()
        where recipient_id = $1 and sender_id = $2 and read_at is null`,
      [userId, otherId],
    );
  }

  // ── Depoimentos ───────────────────────────────────────────────────────────

  async listTestimonials(userId: string): Promise<TestimonialDto[]> {
    const { rows } = await this.db.query<{ item: TestimonialDto }>(
      `select json_build_object(
                'id', t.id,
                'author', ${person('a')},
                'recipient', ${person('r')},
                'text', t.body,
                'createdAt', coalesce(t.approved_at, t.created_at),
                'likes', (select count(*)::int from app.testimonial_likes l where l.testimonial_id = t.id),
                'liked', exists (select 1 from app.testimonial_likes l
                                  where l.testimonial_id = t.id and l.user_id = $1),
                'status', case
                            when t.author_id = $1 then 'enviado'
                            when t.approved_at is null then 'pendente'
                            else 'recebido'
                          end
              ) as item
         from app.testimonials t
         join app.users a on a.id = t.author_id
         join app.users r on r.id = t.recipient_id
        where $1 in (t.author_id, t.recipient_id)
        order by t.created_at desc`,
      [userId],
    );
    return rows.map((row) => row.item);
  }

  /** Só para amigos que aceitam depoimentos; fica pendente até a aprovação. */
  async writeTestimonial(userId: string, recipientId: string, text: string): Promise<ActionResult> {
    if (!(await this.areFriends(userId, recipientId))) {
      return (await this.userExists(recipientId)) ? 'forbidden' : 'not-found';
    }
    const settings = await this.getSettings(recipientId);
    if (!settings.allowTestimonials) return 'forbidden';
    await this.db.query(
      'insert into app.testimonials (author_id, recipient_id, body) values ($1, $2, $3)',
      [userId, recipientId, text],
    );
    return 'ok';
  }

  async approveTestimonial(userId: string, id: string): Promise<ActionResult> {
    const { rowCount } = await this.db.query(
      `update app.testimonials set approved_at = now()
        where id = $1 and recipient_id = $2 and approved_at is null`,
      [id, userId],
    );
    return rowCount ? 'ok' : 'not-found';
  }

  /** Recusar (pendente) ou remover do perfil (aprovado); o autor também pode apagar. */
  async deleteTestimonial(userId: string, id: string): Promise<ActionResult> {
    const { rowCount } = await this.db.query(
      'delete from app.testimonials where id = $1 and (recipient_id = $2 or author_id = $2)',
      [id, userId],
    );
    return rowCount ? 'ok' : 'not-found';
  }

  async toggleTestimonialLike(userId: string, id: string): Promise<ActionResult> {
    const { rows } = await this.db.query(
      `select 1 from app.testimonials t
        where t.id = $1 and t.approved_at is not null
          and ($2 in (t.author_id, t.recipient_id) or app.are_friends($2, t.recipient_id))`,
      [id, userId],
    );
    if (!rows.length) return 'not-found';
    const removed = await this.db.query(
      'delete from app.testimonial_likes where testimonial_id = $1 and user_id = $2',
      [id, userId],
    );
    if (!removed.rowCount) {
      await this.db.query(
        'insert into app.testimonial_likes (testimonial_id, user_id) values ($1, $2)',
        [id, userId],
      );
    }
    return 'ok';
  }

  // ── Álbuns e fotos ────────────────────────────────────────────────────────

  async listAlbums(userId: string): Promise<AlbumDto[]> {
    const { rows } = await this.db.query<AlbumDto>(
      `select a.id, a.title, a.visibility, a.created_at as "createdAt",
              (select count(*)::int from app.photos p where p.album_id = a.id) as photos,
              (select p.id from app.photos p where p.album_id = a.id
                order by p.created_at desc limit 1) as "coverPhotoId"
         from app.albums a
        where a.owner_id = $1
        order by a.created_at`,
      [userId],
    );
    return rows;
  }

  async createAlbum(userId: string, title: string, visibility: Visibility): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      'insert into app.albums (owner_id, title, visibility) values ($1, $2, $3) returning id',
      [userId, title, visibility],
    );
    return rows[0]!.id;
  }

  async deleteAlbum(userId: string, albumId: string): Promise<ActionResult> {
    const { rowCount } = await this.db.query(
      'delete from app.albums where id = $1 and owner_id = $2',
      [albumId, userId],
    );
    return rowCount ? 'ok' : 'not-found';
  }

  async addPhoto(
    userId: string,
    albumId: string,
    image: StoredImage,
    caption: string,
  ): Promise<ActionResult> {
    const { rowCount } = await this.db.query(
      `insert into app.photos (album_id, owner_id, mime_type, data, caption)
       select a.id, $2, $3, $4, $5 from app.albums a where a.id = $1 and a.owner_id = $2`,
      [albumId, userId, image.mimeType, image.data, caption],
    );
    return rowCount ? 'ok' : 'not-found';
  }

  async deletePhoto(userId: string, photoId: string): Promise<ActionResult> {
    const { rowCount } = await this.db.query(
      'delete from app.photos where id = $1 and owner_id = $2',
      [photoId, userId],
    );
    return rowCount ? 'ok' : 'not-found';
  }

  async listRecentPhotos(userId: string): Promise<PhotoDto[]> {
    const { rows } = await this.db.query<PhotoDto>(
      `select p.id, p.album_id as "albumId", p.caption, p.created_at as "createdAt"
         from app.photos p
        where p.owner_id = $1
        order by p.created_at desc
        limit 24`,
      [userId],
    );
    return rows;
  }

  /** Respeita a visibilidade do álbum: dono, amigos (se "amigos") ou todos. */
  async getPhoto(userId: string, photoId: string): Promise<StoredImage | null> {
    const { rows } = await this.db.query<{ mime_type: string; data: Buffer }>(
      `select p.mime_type, p.data
         from app.photos p
         join app.albums a on a.id = p.album_id
        where p.id = $1
          and (a.owner_id = $2
               or a.visibility = 'todos'
               or (a.visibility = 'amigos' and app.are_friends($2, a.owner_id)))`,
      [photoId, userId],
    );
    const row = rows[0];
    return row ? { mimeType: row.mime_type, data: row.data } : null;
  }

  // ── Status e feed ─────────────────────────────────────────────────────────

  async postStatus(userId: string, text: string): Promise<void> {
    await this.db.query('insert into app.statuses (user_id, body) values ($1, $2)', [userId, text]);
  }

  /**
   * Atividades recentes dos amigos (e do próprio usuário): status, fotos novas
   * (agrupadas por álbum e dia), entradas em comunidades e novas amizades.
   */
  async listFeed(userId: string): Promise<FeedItemDto[]> {
    const { rows } = await this.db.query<{ item: FeedItemDto }>(
      `with circle as (select app.friend_ids($1) as id union select $1::uuid),
       activity as (
         select 'status:' || s.id as id, 'status' as kind, s.user_id as actor_id, s.created_at,
                jsonb_build_object('status', s.body) as extra
           from app.statuses s where s.user_id in (select id from circle)
         union all
         select 'fotos:' || a.id || ':' || to_char(date_trunc('day', max(p.created_at)), 'YYYYMMDD'),
                'fotos', a.owner_id, max(p.created_at),
                jsonb_build_object(
                  'albumTitle', a.title,
                  'photoCount', count(*),
                  'photoIds', (array_agg(p.id order by p.created_at desc))[1:4])
           from app.photos p
           join app.albums a on a.id = p.album_id
          where a.owner_id in (select id from circle)
            and (a.owner_id = $1 or a.visibility in ('todos', 'amigos'))
            and p.created_at > now() - interval '30 days'
          group by a.id, a.owner_id, a.title, date_trunc('day', p.created_at)
         union all
         select 'comunidades:' || m.community_id || ':' || m.user_id, 'comunidades', m.user_id,
                m.joined_at, jsonb_build_object('community', jsonb_build_object(
                  'id', c.id, 'slug', c.slug, 'name', c.name, 'icon', c.icon,
                  'category', c.category, 'visibility', c.visibility,
                  'hasPhoto', ${communityHasPhoto('c')},
                  'members', (select count(*)::int from app.community_members cm
                               where cm.community_id = c.id),
                  'joined', exists (select 1 from app.community_members cm
                                     where cm.community_id = c.id and cm.user_id = $1)))
           from app.community_members m
           join app.communities c on c.id = m.community_id
          where m.user_id in (select id from circle)
         union all
         select 'amigos:' || f.requester_id || ':' || f.addressee_id, 'amigos',
                case when f.requester_id in (select id from circle) then f.requester_id
                     else f.addressee_id end,
                f.accepted_at,
                jsonb_build_object('friendId',
                  case when f.requester_id in (select id from circle) then f.addressee_id
                       else f.requester_id end)
           from app.friendships f
          where f.accepted_at is not null
            and (f.requester_id in (select id from circle) or f.addressee_id in (select id from circle))
       )
       select (jsonb_build_object(
                 'id', x.id,
                 'kind', x.kind,
                 'actor', ${person('u')},
                 'createdAt', x.created_at,
                 'likes', (select count(*)::int from app.feed_likes l where l.item_key = x.id),
                 'liked', exists (select 1 from app.feed_likes l where l.item_key = x.id and l.user_id = $1),
                 'comments', (select count(*)::int from app.feed_comments c where c.item_key = x.id),
                 'commentList', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', c.id, 'author', ${person('ca')}, 'text', c.body,
                            'createdAt', c.created_at) order by c.created_at)
                     from (select * from app.feed_comments fc where fc.item_key = x.id
                            order by fc.created_at desc limit 20) c
                     join app.users ca on ca.id = c.author_id
                 ), '[]'::jsonb)
               ) || (x.extra - 'friendId')
                 || case when x.extra ? 'friendId' then jsonb_build_object(
                      'friend', (select ${person('fu')} from app.users fu
                                  where fu.id = (x.extra ->> 'friendId')::uuid))
                    else '{}'::jsonb end) as item
         from activity x
         join app.users u on u.id = x.actor_id
        order by x.created_at desc
        limit ${MAX_FEED}`,
      [userId],
    );
    return rows.map((row) => row.item);
  }

  async toggleFeedLike(userId: string, itemKey: string): Promise<void> {
    const removed = await this.db.query(
      'delete from app.feed_likes where item_key = $1 and user_id = $2',
      [itemKey, userId],
    );
    if (!removed.rowCount) {
      await this.db.query('insert into app.feed_likes (item_key, user_id) values ($1, $2)', [
        itemKey,
        userId,
      ]);
    }
  }

  async commentOnFeed(userId: string, itemKey: string, text: string): Promise<void> {
    await this.db.query(
      'insert into app.feed_comments (item_key, author_id, body) values ($1, $2, $3)',
      [itemKey, userId, text],
    );
  }

  // ── Comunidades ───────────────────────────────────────────────────────────

  /** Comunidades do usuário primeiro, depois as mais populares para descobrir. */
  async listCommunities(userId: string, query = ''): Promise<CommunitySummaryDto[]> {
    const { rows } = await this.db.query<CommunitySummaryDto>(
      `select c.id, c.slug, c.name, c.icon, c.category, c.visibility,
              ${communityHasPhoto('c')} as "hasPhoto",
              (select count(*)::int from app.community_members m where m.community_id = c.id) as members,
              exists (select 1 from app.community_members m
                       where m.community_id = c.id and m.user_id = $1) as joined
         from app.communities c
        where $2 = '' or c.name ilike '%' || $2 || '%' escape '\\'
        order by joined desc, members desc, c.created_at desc
        limit 50`,
      [userId, escapeLike(query)],
    );
    return rows;
  }

  async createCommunity(
    userId: string,
    data: { name: string; category: string; about: string; icon: string; slug: string },
  ): Promise<string | null> {
    const client = await this.db.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<{ id: string; slug: string }>(
        `insert into app.communities (slug, name, category, about, icon, owner_id)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (slug) do nothing
         returning id, slug`,
        [data.slug, data.name, data.category, data.about, data.icon, userId],
      );
      const created = rows[0];
      if (!created) {
        await client.query('rollback');
        return null;
      }
      await client.query(
        'insert into app.community_members (community_id, user_id) values ($1, $2)',
        [created.id, userId],
      );
      await client.query('commit');
      return created.slug;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async getCommunity(userId: string, slug: string): Promise<CommunityDetailDto | null> {
    const { rows } = await this.db.query<{ item: CommunityDetailDto }>(
      `select json_build_object(
                'id', c.id, 'slug', c.slug, 'name', c.name, 'icon', c.icon,
                'category', c.category, 'visibility', c.visibility, 'about', c.about,
                'hasPhoto', ${communityHasPhoto('c')},
                'createdAt', c.created_at, 'language', c.language, 'location', c.location,
                'owner', ${person('o')},
                'members', (select count(*)::int from app.community_members m where m.community_id = c.id),
                'joined', exists (select 1 from app.community_members m
                                   where m.community_id = c.id and m.user_id = $1),
                'friendsInside', coalesce((
                  select json_agg(${person('fu')} order by fu.display_name)
                    from app.community_members m
                    join app.users fu on fu.id = m.user_id
                   where m.community_id = c.id and app.are_friends($1, m.user_id)
                ), '[]'),
                'related', coalesce((
                  select json_agg(json_build_object(
                           'id', rc.id, 'slug', rc.slug, 'name', rc.name, 'icon', rc.icon,
                           'category', rc.category, 'visibility', rc.visibility,
                           'hasPhoto', ${communityHasPhoto('rc')},
                           'members', (select count(*)::int from app.community_members m
                                        where m.community_id = rc.id),
                           'joined', exists (select 1 from app.community_members m
                                              where m.community_id = rc.id and m.user_id = $1)))
                    from (select * from app.communities r
                           where r.category = c.category and r.id <> c.id
                           order by r.created_at desc limit 3) rc
                ), '[]'),
                'topics', coalesce((
                  select json_agg(json_build_object(
                           'id', t.id, 'title', t.title, 'author', ${person('ta')},
                           'pinned', t.pinned, 'createdAt', t.created_at,
                           'replies', (select count(*)::int from app.topic_posts tp where tp.topic_id = t.id),
                           'lastActivity', coalesce((select max(tp.created_at) from app.topic_posts tp
                                                      where tp.topic_id = t.id), t.created_at))
                         order by t.pinned desc, t.created_at desc)
                    from app.community_topics t
                    join app.users ta on ta.id = t.author_id
                   where t.community_id = c.id
                ), '[]'),
                'polls', coalesce((
                  select json_agg(json_build_object(
                           'id', p.id, 'question', p.question,
                           'options', (select json_agg(json_build_object(
                                          'label', o.label,
                                          'votes', (select count(*)::int from app.poll_votes v
                                                     where v.poll_id = p.id and v.option_index = o.idx - 1))
                                        order by o.idx)
                                         from unnest(p.options) with ordinality as o(label, idx)),
                           'votedIndex', (select v.option_index from app.poll_votes v
                                           where v.poll_id = p.id and v.user_id = $1))
                         order by p.created_at desc)
                    from app.community_polls p where p.community_id = c.id
                ), '[]'),
                'events', coalesce((
                  select json_agg(json_build_object(
                           'id', e.id, 'title', e.title, 'startsAt', e.starts_at, 'place', e.place,
                           'attendees', (select count(*)::int from app.event_attendees ea where ea.event_id = e.id),
                           'going', exists (select 1 from app.event_attendees ea
                                             where ea.event_id = e.id and ea.user_id = $1))
                         order by e.starts_at)
                    from app.community_events e
                   where e.community_id = c.id and e.starts_at > now() - interval '1 day'
                ), '[]')
              ) as item
         from app.communities c
         join app.users o on o.id = c.owner_id
        where c.slug = $2`,
      [userId, slug],
    );
    return rows[0]?.item ?? null;
  }

  /** Só o dono troca a foto da comunidade. */
  async setCommunityPhoto(
    userId: string,
    communityId: string,
    image: StoredImage,
  ): Promise<ActionResult> {
    const access = await this.communityOwnership(userId, communityId);
    if (access !== 'ok') return access;
    await this.db.query(
      `insert into app.community_photos (community_id, mime_type, data) values ($1, $2, $3)
       on conflict (community_id) do update
         set mime_type = excluded.mime_type, data = excluded.data, updated_at = now()`,
      [communityId, image.mimeType, image.data],
    );
    return 'ok';
  }

  async removeCommunityPhoto(userId: string, communityId: string): Promise<ActionResult> {
    const access = await this.communityOwnership(userId, communityId);
    if (access !== 'ok') return access;
    await this.db.query('delete from app.community_photos where community_id = $1', [communityId]);
    return 'ok';
  }

  /** Fotos de comunidade são visíveis para qualquer membro autenticado da rede. */
  async getCommunityPhoto(communityId: string): Promise<StoredImage | null> {
    const { rows } = await this.db.query<{ mime_type: string; data: Buffer }>(
      'select mime_type, data from app.community_photos where community_id = $1',
      [communityId],
    );
    const row = rows[0];
    return row ? { mimeType: row.mime_type, data: row.data } : null;
  }

  /** Só o dono exclui. O resto cai em cascata; o feed guarda só a chave do item. */
  async deleteCommunity(userId: string, communityId: string): Promise<ActionResult> {
    const access = await this.communityOwnership(userId, communityId);
    if (access !== 'ok') return access;
    await this.db.query(
      `with removed as (delete from app.communities where id = $1 returning id),
            likes as (delete from app.feed_likes f using removed r
                       where f.item_key like 'comunidades:' || r.id || ':%'),
            comments as (delete from app.feed_comments f using removed r
                          where f.item_key like 'comunidades:' || r.id || ':%')
       select 1`,
      [communityId],
    );
    return 'ok';
  }

  private async communityOwnership(userId: string, communityId: string): Promise<ActionResult> {
    const { rows } = await this.db.query<{ owner_id: string }>(
      'select owner_id from app.communities where id = $1',
      [communityId],
    );
    const community = rows[0];
    if (!community) return 'not-found';
    return community.owner_id === userId ? 'ok' : 'forbidden';
  }

  async joinCommunity(userId: string, communityId: string): Promise<ActionResult> {
    const { rowCount } = await this.db.query(
      `insert into app.community_members (community_id, user_id)
       select c.id, $2 from app.communities c where c.id = $1
       on conflict do nothing`,
      [communityId, userId],
    );
    if (rowCount) return 'ok';
    return (await this.isMember(userId, communityId)) ? 'ok' : 'not-found';
  }

  /** O dono não pode sair (a comunidade ficaria sem responsável). */
  async leaveCommunity(userId: string, communityId: string): Promise<ActionResult> {
    const { rows } = await this.db.query<{ owner_id: string }>(
      'select owner_id from app.communities where id = $1',
      [communityId],
    );
    const community = rows[0];
    if (!community) return 'not-found';
    if (community.owner_id === userId) return 'forbidden';
    await this.db.query(
      'delete from app.community_members where community_id = $1 and user_id = $2',
      [communityId, userId],
    );
    return 'ok';
  }

  async isMember(userId: string, communityId: string): Promise<boolean> {
    const { rows } = await this.db.query(
      'select 1 from app.community_members where community_id = $1 and user_id = $2',
      [communityId, userId],
    );
    return rows.length > 0;
  }

  /** Tópicos, enquetes e eventos: apenas membros publicam. */
  async createTopic(userId: string, communityId: string, title: string): Promise<ActionResult> {
    if (!(await this.isMember(userId, communityId))) return 'forbidden';
    await this.db.query(
      'insert into app.community_topics (community_id, author_id, title) values ($1, $2, $3)',
      [communityId, userId, title],
    );
    return 'ok';
  }

  async createPoll(
    userId: string,
    communityId: string,
    question: string,
    options: string[],
  ): Promise<ActionResult> {
    if (!(await this.isMember(userId, communityId))) return 'forbidden';
    await this.db.query(
      `insert into app.community_polls (community_id, author_id, question, options)
       values ($1, $2, $3, $4)`,
      [communityId, userId, question, options],
    );
    return 'ok';
  }

  async vote(userId: string, pollId: string, optionIndex: number): Promise<ActionResult> {
    const { rows } = await this.db.query<{ options: string[]; community_id: string }>(
      'select options, community_id from app.community_polls where id = $1',
      [pollId],
    );
    const poll = rows[0];
    if (!poll || optionIndex >= poll.options.length) return 'not-found';
    if (!(await this.isMember(userId, poll.community_id))) return 'forbidden';
    const { rowCount } = await this.db.query(
      `insert into app.poll_votes (poll_id, user_id, option_index) values ($1, $2, $3)
       on conflict do nothing`,
      [pollId, userId, optionIndex],
    );
    return rowCount ? 'ok' : 'conflict';
  }

  async createEvent(
    userId: string,
    communityId: string,
    data: { title: string; startsAt: string; place: string },
  ): Promise<ActionResult> {
    if (!(await this.isMember(userId, communityId))) return 'forbidden';
    await this.db.query(
      `insert into app.community_events (community_id, author_id, title, starts_at, place)
       values ($1, $2, $3, $4, $5)`,
      [communityId, userId, data.title, data.startsAt, data.place],
    );
    return 'ok';
  }

  async toggleEventAttendance(userId: string, eventId: string): Promise<ActionResult> {
    const { rows } = await this.db.query<{ community_id: string }>(
      'select community_id from app.community_events where id = $1',
      [eventId],
    );
    const event = rows[0];
    if (!event) return 'not-found';
    if (!(await this.isMember(userId, event.community_id))) return 'forbidden';
    const removed = await this.db.query(
      'delete from app.event_attendees where event_id = $1 and user_id = $2',
      [eventId, userId],
    );
    if (!removed.rowCount) {
      await this.db.query('insert into app.event_attendees (event_id, user_id) values ($1, $2)', [
        eventId,
        userId,
      ]);
    }
    return 'ok';
  }
}

/** Escapa curingas do LIKE para que a busca seja literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export type { PersonDto };
