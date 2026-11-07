-- =====================================================================
-- GUVIO — Mutirão 2: várias fotos por post e looks montados
-- Pode rodar de novo sem problema.
-- =====================================================================

-- Fotos extras do post (a primeira continua em image_url)
alter table public.posts add column if not exists images jsonb not null default '[]'::jsonb;

-- Looks montados no guarda-roupa
create table if not exists public.outfits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null default 'Meu look',
  item_ids   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists outfits_user_idx on public.outfits (user_id, created_at desc);
alter table public.outfits enable row level security;
drop policy if exists "meus looks" on public.outfits;
create policy "meus looks" on public.outfits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- feed_posts precisa ser recriada para incluir a coluna nova
drop function if exists public.nearby_posts(double precision, double precision, double precision, int);
drop view if exists public.feed_posts;
create view public.feed_posts with (security_invoker = true) as
select
  p.*,
  pr.username,
  pr.display_name,
  pr.avatar_url,
  (select count(*) from public.likes l where l.post_id = p.id)::int    as likes_count,
  (select count(*) from public.comments c where c.post_id = p.id)::int as comments_count
from public.posts p
join public.profiles pr on pr.id = p.user_id;
