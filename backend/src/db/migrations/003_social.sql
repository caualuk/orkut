-- 003 · Rede social: perfil, amizades, recados, mensagens, depoimentos, álbuns,
-- status, comunidades (tópicos, enquetes, eventos), feed e preferências.
--
-- Tudo pertence a usuários reais de app.users (on delete cascade). Nenhum dado
-- de exemplo é inserido aqui.

-- ── Perfil e preferências ──────────────────────────────────────────────────
create table if not exists app.profiles (
  user_id      uuid primary key references app.users (id) on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  relationship text not null default 'nao-informar',
  city         text not null default '',
  country      text not null default '',
  about        text not null default '',
  interests    text[] not null default '{}',
  social       jsonb not null default '{}',
  contact      jsonb not null default '{}',
  professional jsonb not null default '{}',
  personal     jsonb not null default '{}',
  settings     jsonb not null default '{}',
  last_seen_at timestamptz,
  updated_at   timestamptz not null default now(),
  constraint profiles_relationship_valid check (relationship in
    ('solteiro', 'namorando', 'casado', 'relacionamento-aberto', 'nao-informar')),
  constraint profiles_lengths check (
    char_length(first_name) <= 40 and char_length(last_name) <= 40 and
    char_length(city) <= 80 and char_length(country) <= 60 and char_length(about) <= 500 and
    cardinality(interests) <= 20)
);

create table if not exists app.profile_photos (
  user_id    uuid primary key references app.users (id) on delete cascade,
  mime_type  text not null check (mime_type in ('image/jpeg', 'image/png')),
  data       bytea not null check (octet_length(data) <= 5242880),
  updated_at timestamptz not null default now()
);

create table if not exists app.profile_visits (
  visitor_id uuid not null references app.users (id) on delete cascade,
  visited_id uuid not null references app.users (id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (visitor_id, visited_id),
  check (visitor_id <> visited_id)
);
create index if not exists profile_visits_visited_idx on app.profile_visits (visited_id, visited_at desc);

create table if not exists app.fans (
  user_id uuid not null references app.users (id) on delete cascade,
  fan_id  uuid not null references app.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, fan_id),
  check (user_id <> fan_id)
);

-- ── Amizades ───────────────────────────────────────────────────────────────
-- Um par por linha: quem pediu e quem recebeu. `accepted_at` nulo = pendente.
create table if not exists app.friendships (
  requester_id uuid not null references app.users (id) on delete cascade,
  addressee_id uuid not null references app.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists friendships_addressee_idx on app.friendships (addressee_id);
-- Impede o pedido "ao contrário" duplicado (A→B e B→A).
create unique index if not exists friendships_pair_key
  on app.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table if not exists app.best_friends (
  user_id   uuid not null references app.users (id) on delete cascade,
  friend_id uuid not null references app.users (id) on delete cascade,
  primary key (user_id, friend_id)
);

-- ── Recados ────────────────────────────────────────────────────────────────
create table if not exists app.scraps (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references app.users (id) on delete cascade,
  recipient_id uuid not null references app.users (id) on delete cascade,
  reply_to_id  uuid references app.scraps (id) on delete set null,
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists scraps_recipient_idx on app.scraps (recipient_id, created_at desc);
create index if not exists scraps_author_idx on app.scraps (author_id, created_at desc);

create table if not exists app.scrap_likes (
  scrap_id uuid not null references app.scraps (id) on delete cascade,
  user_id  uuid not null references app.users (id) on delete cascade,
  primary key (scrap_id, user_id)
);

-- ── Mensagens privadas ─────────────────────────────────────────────────────
create table if not exists app.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references app.users (id) on delete cascade,
  recipient_id uuid not null references app.users (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists messages_pair_idx
  on app.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);
create index if not exists messages_recipient_unread_idx
  on app.messages (recipient_id) where read_at is null;

-- ── Depoimentos ────────────────────────────────────────────────────────────
create table if not exists app.testimonials (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references app.users (id) on delete cascade,
  recipient_id uuid not null references app.users (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  check (author_id <> recipient_id)
);
create index if not exists testimonials_recipient_idx on app.testimonials (recipient_id, created_at desc);
create index if not exists testimonials_author_idx on app.testimonials (author_id, created_at desc);

create table if not exists app.testimonial_likes (
  testimonial_id uuid not null references app.testimonials (id) on delete cascade,
  user_id        uuid not null references app.users (id) on delete cascade,
  primary key (testimonial_id, user_id)
);

-- ── Álbuns e fotos ─────────────────────────────────────────────────────────
create table if not exists app.albums (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references app.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 60),
  visibility text not null default 'somente-eu' check (visibility in ('todos', 'amigos', 'somente-eu')),
  created_at timestamptz not null default now()
);
create index if not exists albums_owner_idx on app.albums (owner_id, created_at);

create table if not exists app.photos (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references app.albums (id) on delete cascade,
  owner_id   uuid not null references app.users (id) on delete cascade,
  mime_type  text not null check (mime_type in ('image/jpeg', 'image/png')),
  data       bytea not null check (octet_length(data) <= 5242880),
  caption    text not null default '' check (char_length(caption) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists photos_owner_idx on app.photos (owner_id, created_at desc);
create index if not exists photos_album_idx on app.photos (album_id);

-- ── Status (aparecem no feed dos amigos) ───────────────────────────────────
create table if not exists app.statuses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references app.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists statuses_user_idx on app.statuses (user_id, created_at desc);

-- ── Comunidades ────────────────────────────────────────────────────────────
create table if not exists app.communities (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name       text not null check (char_length(name) between 3 and 80),
  category   text not null check (char_length(category) between 1 and 40),
  about      text not null default '' check (char_length(about) <= 1000),
  icon       text not null default 'groups' check (icon ~ '^[a-z_]{1,40}$'),
  language   text not null default 'Português (BR)',
  location   text not null default 'Brasil',
  visibility text not null default 'pública' check (visibility in ('pública', 'moderada')),
  owner_id   uuid not null references app.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists app.community_members (
  community_id uuid not null references app.communities (id) on delete cascade,
  user_id      uuid not null references app.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_user_idx on app.community_members (user_id, joined_at desc);

create table if not exists app.community_topics (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references app.communities (id) on delete cascade,
  author_id    uuid not null references app.users (id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 120),
  pinned       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists community_topics_idx on app.community_topics (community_id, created_at desc);

create table if not exists app.topic_posts (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references app.community_topics (id) on delete cascade,
  author_id  uuid not null references app.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists topic_posts_topic_idx on app.topic_posts (topic_id, created_at);

create table if not exists app.community_polls (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references app.communities (id) on delete cascade,
  author_id    uuid not null references app.users (id) on delete cascade,
  question     text not null check (char_length(question) between 3 and 160),
  options      text[] not null check (cardinality(options) between 2 and 6),
  created_at   timestamptz not null default now()
);

create table if not exists app.poll_votes (
  poll_id      uuid not null references app.community_polls (id) on delete cascade,
  user_id      uuid not null references app.users (id) on delete cascade,
  option_index smallint not null check (option_index between 0 and 5),
  primary key (poll_id, user_id)
);

create table if not exists app.community_events (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references app.communities (id) on delete cascade,
  author_id    uuid not null references app.users (id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 120),
  starts_at    timestamptz not null,
  place        text not null default '' check (char_length(place) <= 120),
  created_at   timestamptz not null default now()
);

create table if not exists app.event_attendees (
  event_id uuid not null references app.community_events (id) on delete cascade,
  user_id  uuid not null references app.users (id) on delete cascade,
  primary key (event_id, user_id)
);

-- ── Feed: curtidas e comentários em atividades ─────────────────────────────
-- `item_key` identifica a atividade (ex.: "status:<uuid>", "photos:<album>:<dia>").
create table if not exists app.feed_likes (
  item_key text not null check (char_length(item_key) <= 120),
  user_id  uuid not null references app.users (id) on delete cascade,
  primary key (item_key, user_id)
);

create table if not exists app.feed_comments (
  id         uuid primary key default gen_random_uuid(),
  item_key   text not null check (char_length(item_key) <= 120),
  author_id  uuid not null references app.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists feed_comments_item_idx on app.feed_comments (item_key);

-- ── Funções auxiliares (usadas pelas queries da API) ───────────────────────
create or replace function app.friend_ids(p_user uuid) returns setof uuid
language sql stable
set search_path = ''
as $$
  select case when f.requester_id = p_user then f.addressee_id else f.requester_id end
    from app.friendships f
   where f.accepted_at is not null
     and p_user in (f.requester_id, f.addressee_id)
$$;

create or replace function app.are_friends(a uuid, b uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from app.friendships f
     where f.accepted_at is not null
       and least(f.requester_id, f.addressee_id) = least(a, b)
       and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  )
$$;

-- Online = visto nos últimos 5 minutos e sem ter desligado "Aparecer como online".
create or replace function app.is_online(p_user uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((
    select p.last_seen_at > now() - interval '5 minutes'
           and coalesce((p.settings ->> 'appearOnline')::boolean, true)
      from app.profiles p where p.user_id = p_user
  ), false)
$$;

create or replace function app.mutual_friends(a uuid, b uuid) returns integer
language sql stable
set search_path = ''
as $$
  select count(*)::int from (
    select app.friend_ids(a) intersect select app.friend_ids(b)
  ) m
$$;

-- ── Segurança: mesmas regras das tabelas de autenticação ───────────────────
do $$
declare
  t text;
  r text;
begin
  foreach t in array array[
    'profiles', 'profile_photos', 'profile_visits', 'fans', 'friendships', 'best_friends',
    'scraps', 'scrap_likes', 'messages', 'testimonials', 'testimonial_likes', 'albums',
    'photos', 'statuses', 'communities', 'community_members', 'community_topics',
    'topic_posts', 'community_polls', 'poll_votes', 'community_events', 'event_attendees',
    'feed_likes', 'feed_comments'
  ] loop
    execute format('alter table app.%I enable row level security', t);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on app.%I from %I', t, r);
      end if;
    end loop;
  end loop;
end
$$;
