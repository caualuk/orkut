/**
 * Fragmentos SQL compartilhados pelos repositórios sociais. Nunca recebem dados
 * do usuário: só aliases de tabela fixos no código (valores vão sempre em $n).
 */

/** Pessoa (PersonDto) a partir de um alias de app.users. */
export const person = (alias: string): string => `json_build_object(
  'id', ${alias}.id,
  'name', ${alias}.display_name,
  'online', app.is_online(${alias}.id),
  'hasPhoto', exists (select 1 from app.profile_photos pp where pp.user_id = ${alias}.id)
)`;

/** Garante a linha de perfil e registra a última atividade (no máximo 1×/min). */
export const TOUCH_PROFILE = `
  insert into app.profiles (user_id, first_name, last_name, last_seen_at)
  select u.id,
         split_part(u.display_name, ' ', 1),
         substr(u.display_name, length(split_part(u.display_name, ' ', 1)) + 2),
         now()
    from app.users u where u.id = $1
  on conflict (user_id) do update
     set last_seen_at = now()
   where app.profiles.last_seen_at is null
      or app.profiles.last_seen_at < now() - interval '1 minute'`;
