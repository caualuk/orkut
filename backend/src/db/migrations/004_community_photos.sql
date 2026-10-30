-- 004 · Foto da comunidade (enviada pelo dono)

create table if not exists app.community_photos (
  community_id uuid primary key references app.communities (id) on delete cascade,
  mime_type    text not null check (mime_type in ('image/jpeg', 'image/png')),
  data         bytea not null check (octet_length(data) <= 5242880),
  updated_at   timestamptz not null default now()
);

alter table app.community_photos enable row level security;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on app.community_photos from %I', r);
    end if;
  end loop;
end
$$;
