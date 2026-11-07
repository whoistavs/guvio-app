-- =====================================================================
-- GUVIO — Mutirão de melhorias (rode depois do schema.sql)
-- Stories vistos, denúncias, mensagens lidas, localização nos posts.
-- Pode rodar de novo sem problema.
-- =====================================================================

-- Quem viu cada story
create table if not exists public.story_views (
  story_id   uuid not null references public.stories(id) on delete cascade,
  viewer_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
alter table public.story_views enable row level security;
drop policy if exists "registrar visualizacao" on public.story_views;
drop policy if exists "ver visualizacoes" on public.story_views;
create policy "registrar visualizacao" on public.story_views for insert to authenticated
  with check (viewer_id = auth.uid());
create policy "ver visualizacoes" on public.story_views for select to authenticated
  using (viewer_id = auth.uid()
         or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));

-- Denúncias de posts
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id     uuid not null references public.posts(id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),
  unique (reporter_id, post_id)
);
alter table public.reports enable row level security;
drop policy if exists "denunciar" on public.reports;
drop policy if exists "ver minhas denuncias" on public.reports;
create policy "denunciar" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "ver minhas denuncias" on public.reports for select to authenticated using (reporter_id = auth.uid());

-- Mensagens lidas
alter table public.messages add column if not exists read_at timestamptz;
create index if not exists messages_unread_idx on public.messages (recipient_id) where read_at is null;

-- Marca como lidas as mensagens de uma conversa (só as que eu recebi)
create or replace function public.mark_thread_read(other uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
  where recipient_id = auth.uid() and sender_id = other and read_at is null;
$$;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- Coordenadas do post (para o globo)
alter table public.posts add column if not exists lat double precision;
alter table public.posts add column if not exists lng double precision;

-- feed_posts precisa ser recriada para incluir as colunas novas de posts
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

-- Tempo real para stories vistos e leitura de mensagens
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'story_views') then
    alter publication supabase_realtime add table public.story_views;
  end if;
end $$;
