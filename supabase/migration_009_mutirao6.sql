-- =====================================================================
-- GUVIO — MUTIRÃO 6
-- Proporção de cada post (foto inteira, 1:1, 4:5, 16:9), escolhida no corte.
-- Pode rodar mais de uma vez.
-- =====================================================================

alter table public.posts add column if not exists aspect real not null default 1;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_aspect_check') then
    alter table public.posts add constraint posts_aspect_check check (aspect between 0.3 and 3.5);
  end if;
end $$;

-- a view lista as colunas na hora em que é criada: recria para incluir "aspect"
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

-- ---------------------------------------------------------------------
-- POSTS PERTO DE VOCÊ (raio em km)
-- ---------------------------------------------------------------------
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
