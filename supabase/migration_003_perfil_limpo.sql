-- =====================================================================
-- GUVIO — Perfis novos começam sem foto e sem bio
-- Pode rodar de novo sem problema.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  n int := 0;
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    '[^a-zA-Z0-9._]', '', 'g'));
  if length(base_username) < 3 then base_username := base_username || 'user'; end if;
  base_username := left(base_username, 26);
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    n := n + 1;
    final_username := base_username || n::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url, location, bio)
  values (
    new.id,
    final_username,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''),
             nullif(new.raw_user_meta_data->>'full_name', ''),
             final_username),
    null, -- sem foto do Google: a pessoa escolhe a sua no app
    '',
    ''
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Limpa perfis que já existem:
-- 1) tira a bio automática
update public.profiles set bio = ''
where bio in ('Novo criador de estilo na comunidade Guvio ✨',
              'Amante da moda minimalista e composições contemporâneas ✨');

-- 2) tira a foto que veio do Google (fotos enviadas pelo app ficam)
update public.profiles set avatar_url = null
where avatar_url like '%googleusercontent.com%';
