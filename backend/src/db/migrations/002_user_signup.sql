-- 002 · Dados coletados no cadastro (tela "Criar conta")
--
-- Nascimento e sexo são opcionais no formulário. O aceite dos termos é
-- obrigatório para novas contas e fica registrado com data/hora.

alter table app.users
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists terms_accepted_at timestamptz;

alter table app.users drop constraint if exists users_gender_valid;
alter table app.users
  add constraint users_gender_valid
  check (gender is null or gender in ('feminino', 'masculino', 'outro', 'nao-informar'));

alter table app.users drop constraint if exists users_birth_date_range;
alter table app.users
  add constraint users_birth_date_range
  check (birth_date is null or birth_date between date '1900-01-01' and current_date);
