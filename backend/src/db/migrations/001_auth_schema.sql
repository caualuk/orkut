-- 001 · Schema de autenticação (usuários e sessões)
--
-- As tabelas ficam no schema `app`, que NÃO é exposto pela API REST do Supabase
-- (PostgREST expõe apenas `public`). Além disso, RLS é habilitado sem políticas,
-- bloqueando qualquer acesso via roles `anon`/`authenticated` por padrão.

create schema if not exists app;

create table if not exists app.users (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  display_name          text not null,
  password_hash         text not null,
  failed_login_attempts integer not null default 0,
  locked_until          timestamptz,
  last_login_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(email)),
  constraint users_email_length check (char_length(email) between 3 and 254),
  constraint users_display_name_length check (char_length(display_name) between 1 and 80)
);

create unique index if not exists users_email_key on app.users (email);

create table if not exists app.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references app.users (id) on delete cascade,
  token_hash  bytea not null,
  user_agent  text,
  ip_address  inet,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  constraint sessions_token_hash_length check (octet_length(token_hash) = 32)
);

create unique index if not exists sessions_token_hash_key on app.sessions (token_hash);
create index if not exists sessions_user_id_idx on app.sessions (user_id);
create index if not exists sessions_expires_at_idx on app.sessions (expires_at);

alter table app.users enable row level security;
alter table app.sessions enable row level security;

-- Defesa em profundidade: remove qualquer privilégio das roles públicas do Supabase.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on schema app from %I', r);
      execute format('revoke all on all tables in schema app from %I', r);
    end if;
  end loop;
end
$$;

-- Mantém updated_at coerente sem depender da aplicação.
create or replace function app.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists users_touch_updated_at on app.users;
create trigger users_touch_updated_at
  before update on app.users
  for each row execute function app.touch_updated_at();
