-- =====================================================================
-- GUVIO — MUTIRÃO 7
-- 1) Clima no post (filtro "looks para dias de chuva")
-- 2) Coleções públicas
-- 3) Look da semana da cidade (votação)
-- 4) Painel do criador (só administradores)
-- 5) Avisos no celular (push): aparelhos inscritos
-- Pode rodar mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CLIMA DO DIA EM QUE O LOOK FOI PUBLICADO
-- ---------------------------------------------------------------------
alter table public.posts add column if not exists temp_c  smallint;
alter table public.posts add column if not exists weather text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_weather_check') then
    alter table public.posts add constraint posts_weather_check
      check (weather is null or weather in ('sol', 'nublado', 'chuva', 'neve'));
  end if;
end $$;

-- a view lista as colunas na hora em que é criada: recria para incluir as novas
drop function if exists public.nearby_posts(double precision, double precision, double precision, int);
drop view if exists public.feed_posts;
create view public.feed_posts with (security_invoker = true) as
select
  p.*,
  pr.username,
  pr.display_name,
  pr.avatar_url,
  (select count(*) from public.likes l where l.post_id = p.id)::int    as likes_count,
  (select count(*) from public.comments c where c.post_id = p.id)::int as comments_count,
  op.username   as original_username,
  op.avatar_url as original_avatar_url
from public.posts p
join public.profiles pr on pr.id = p.user_id
left join public.posts o on o.id = p.repost_of
left join public.profiles op on op.id = o.user_id;

create or replace function public.nearby_posts(p_lat double precision, p_lng double precision, km double precision default 60, lim int default 60)
returns setof public.feed_posts language sql stable security invoker set search_path = public as $$
  select f.* from feed_posts f
  where f.lat is not null and f.lng is not null and not f.archived
    and f.lat between p_lat - km / 111.0 and p_lat + km / 111.0
    and 2 * 6371 * asin(sqrt(least(1,
          power(sin(radians(f.lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(f.lat)) * power(sin(radians(f.lng - p_lng) / 2), 2)
        ))) <= km
  order by f.created_at desc
  limit greatest(1, least(lim, 100));
$$;
grant execute on function public.nearby_posts(double precision, double precision, double precision, int) to authenticated;

-- ---------------------------------------------------------------------
-- 2) COLEÇÕES PÚBLICAS (aparecem no perfil)
-- ---------------------------------------------------------------------
alter table public.collections add column if not exists is_public boolean not null default false;

drop policy if exists "ver colecoes publicas" on public.collections;
create policy "ver colecoes publicas" on public.collections for select to authenticated
  using (is_public and public.can_see_user(user_id));

drop policy if exists "ver itens de colecoes publicas" on public.collection_items;
create policy "ver itens de colecoes publicas" on public.collection_items for select to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.is_public and public.can_see_user(c.user_id)
  ));

-- ---------------------------------------------------------------------
-- 3) LOOK DA SEMANA DA CIDADE
-- Um voto por pessoa, por cidade, por semana (a semana começa na segunda).
-- ---------------------------------------------------------------------
create table if not exists public.city_votes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  week       date not null,
  city       text not null check (length(city) between 1 and 80),
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, week, city)
);
create index if not exists city_votes_city_idx on public.city_votes (lower(city), week);
alter table public.city_votes enable row level security;

drop policy if exists "meu voto" on public.city_votes;
create policy "meu voto" on public.city_votes for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and week = date_trunc('week', now())::date
    and exists (
      select 1 from public.posts p
      where p.id = city_votes.post_id
        and lower(p.city) = lower(city_votes.city)
        and p.user_id <> auth.uid()
        and not p.archived
        and p.created_at >= date_trunc('week', now()) - interval '7 days'
    )
  );

-- votos de cada look da cidade nesta semana (sem mostrar quem votou)
create or replace function public.city_week_votes(p_city text)
returns table (post_id uuid, votes int, mine boolean)
language sql stable security definer set search_path = public as $$
  select v.post_id, count(*)::int, bool_or(v.user_id = auth.uid())
  from city_votes v
  where lower(v.city) = lower(p_city) and v.week = date_trunc('week', now())::date
  group by v.post_id;
$$;
grant execute on function public.city_week_votes(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4) PAINEL DO CRIADOR
-- Quem é administrador fica numa tabela que o app NÃO consegue alterar.
-- Para se tornar administrador, rode no SQL Editor (troque o @):
--   insert into public.app_admins (user_id)
--   select id from public.profiles where username = 'SEU_USUARIO'
--   on conflict do nothing;
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.app_admins enable row level security;
-- sem políticas: ninguém lê nem escreve pelo app

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_overview()
returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if not exists (select 1 from app_admins where user_id = auth.uid()) then
    raise exception 'sem permissão';
  end if;
  select json_build_object(
    'users',        (select count(*) from profiles),
    'users_7d',     (select count(*) from profiles where created_at > now() - interval '7 days'),
    'posts',        (select count(*) from posts),
    'posts_7d',     (select count(*) from posts where created_at > now() - interval '7 days'),
    'comments_7d',  (select count(*) from comments where created_at > now() - interval '7 days'),
    'messages_7d',  (select count(*) from messages where created_at > now() - interval '7 days'),
    'reports_open', (select count(distinct post_id) from reports),
    'feedback_7d',  (select count(*) from feedback where created_at > now() - interval '7 days'),
    'new_users', coalesce((
      select json_agg(x) from (
        select id, username, display_name, avatar_url, created_at,
               (select count(*) from posts p where p.user_id = pr.id) as posts
        from profiles pr order by created_at desc limit 30
      ) x), '[]'::json),
    'recent_posts', coalesce((
      select json_agg(x) from (
        select p.id, p.image_url, p.caption, p.created_at, pr.username
        from posts p join profiles pr on pr.id = p.user_id
        order by p.created_at desc limit 30
      ) x), '[]'::json),
    'reports', coalesce((
      select json_agg(x) from (
        select r.post_id, count(*)::int as total, max(r.created_at) as last_at,
               string_agg(distinct r.reason, ' · ') as reasons,
               p.image_url, p.caption, pr.username
        from reports r
        join posts p on p.id = r.post_id
        join profiles pr on pr.id = p.user_id
        group by r.post_id, p.image_url, p.caption, pr.username
        order by max(r.created_at) desc limit 50
      ) x), '[]'::json),
    'feedback', coalesce((
      select json_agg(x) from (
        select f.id, f.kind, f.text, f.screenshot_url, f.platform, f.app_version, f.created_at, pr.username
        from feedback f left join profiles pr on pr.id = f.user_id
        order by f.created_at desc limit 50
      ) x), '[]'::json)
  ) into r;
  return r;
end $$;
grant execute on function public.admin_overview() to authenticated;

-- apagar um look denunciado
create or replace function public.admin_delete_post(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from app_admins where user_id = auth.uid()) then
    raise exception 'sem permissão';
  end if;
  delete from posts where id = p_post;
end $$;
grant execute on function public.admin_delete_post(uuid) to authenticated;

-- manter o look e arquivar as denúncias dele
create or replace function public.admin_dismiss_reports(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from app_admins where user_id = auth.uid()) then
    raise exception 'sem permissão';
  end if;
  delete from reports where post_id = p_post;
end $$;
grant execute on function public.admin_dismiss_reports(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) AVISOS NO CELULAR (PUSH)
-- Cada aparelho/navegador que aceitou receber avisos.
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('web', 'fcm')),
  endpoint   text not null unique,   -- web: endpoint do navegador · fcm: token do aparelho
  p256dh     text,
  auth       text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
-- o que a pessoa quer receber: {"pauseAll":false,"like":true,"comment":true,"follow":true,"message":true}
alter table public.push_subscriptions add column if not exists prefs jsonb not null default '{}'::jsonb;
alter table public.push_subscriptions enable row level security;
drop policy if exists "meus aparelhos" on public.push_subscriptions;
create policy "meus aparelhos" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- se o mesmo aparelho trocar de conta, a inscrição passa para a conta nova
create or replace function public.save_push_subscription(p_kind text, p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'entre na conta'; end if;
  insert into push_subscriptions (user_id, kind, endpoint, p256dh, auth)
  values (auth.uid(), p_kind, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, kind = excluded.kind, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
