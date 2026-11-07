-- =====================================================================
-- GUVIO — MUTIRÃO 5
-- Vídeo, enquete "Qual look?", repost, comentário fixado, avaliação
-- 🔥/🧊, "não tenho interesse", stories com enquete/pergunta,
-- melhores amigos, marcar pessoas no story, link de loja nas peças,
-- busca por cor, posts perto de você e criadores da semana.
-- Pode rodar mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- POSTS: tipo (foto, vídeo, enquete, repost), comentário fixado
-- ---------------------------------------------------------------------
alter table public.posts add column if not exists kind text not null default 'photo';
alter table public.posts add column if not exists video_url text;
alter table public.posts add column if not exists poll jsonb;            -- {"options":["Look A","Look B"]}
alter table public.posts add column if not exists repost_of uuid references public.posts(id) on delete cascade;
alter table public.posts add column if not exists pinned_comment_id uuid references public.comments(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'posts_kind_check') then
    alter table public.posts add constraint posts_kind_check check (kind in ('photo', 'video', 'poll', 'repost'));
  end if;
end $$;

-- texto das peças marcadas (nome, categoria, cor) para buscar "looks com azul"
alter table public.posts add column if not exists tags_text text generated always as (lower(clothing_tags::text)) stored;
create extension if not exists pg_trgm with schema extensions;
create index if not exists posts_tags_trgm on public.posts using gin (tags_text extensions.gin_trgm_ops);
create index if not exists posts_repost_idx on public.posts (repost_of);
create index if not exists posts_geo_idx on public.posts (lat, lng) where lat is not null;

-- link de loja nas peças do guarda-roupa ("Comprar o look")
alter table public.wardrobe_items add column if not exists link text;

-- ---------------------------------------------------------------------
-- ENQUETE "QUAL LOOK?": um voto por pessoa (pode trocar)
-- ---------------------------------------------------------------------
create table if not exists public.poll_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  option     smallint not null check (option between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.poll_votes enable row level security;
drop policy if exists "ver votos" on public.poll_votes;
create policy "ver votos" on public.poll_votes for select to authenticated using (true);
drop policy if exists "votar" on public.poll_votes;
create policy "votar" on public.poll_votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- AVALIAÇÃO 🔥 (1) ou 🧊 (-1)
-- ---------------------------------------------------------------------
create table if not exists public.post_ratings (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_ratings enable row level security;
drop policy if exists "ver avaliacoes" on public.post_ratings;
create policy "ver avaliacoes" on public.post_ratings for select to authenticated using (true);
drop policy if exists "avaliar" on public.post_ratings;
create policy "avaliar" on public.post_ratings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- "NÃO TENHO INTERESSE" (privado)
-- ---------------------------------------------------------------------
create table if not exists public.not_interested (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  style_tag  text,
  author_id  uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.not_interested enable row level security;
drop policy if exists "meus nao interessa" on public.not_interested;
create policy "meus nao interessa" on public.not_interested for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- STORIES: público (todos / melhores amigos) e sticker (enquete/pergunta)
-- ---------------------------------------------------------------------
alter table public.stories add column if not exists audience text not null default 'all';
alter table public.stories add column if not exists sticker jsonb;   -- {"type":"poll","question":"..","options":["Sim","Não"]} | {"type":"question","prompt":".."}
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stories_audience_check') then
    alter table public.stories add constraint stories_audience_check check (audience in ('all', 'close'));
  end if;
end $$;

create table if not exists public.close_friends (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id)
);
alter table public.close_friends enable row level security;
drop policy if exists "meus melhores amigos" on public.close_friends;
create policy "meus melhores amigos" on public.close_friends for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- quem está na lista pode saber que está (para ver o anel verde)
drop policy if exists "estou na lista" on public.close_friends;
create policy "estou na lista" on public.close_friends for select to authenticated using (friend_id = auth.uid());

create or replace function public.is_close_friend(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or exists (select 1 from close_friends where owner_id = owner and friend_id = auth.uid());
$$;
grant execute on function public.is_close_friend(uuid) to authenticated;

drop policy if exists "ler stories" on public.stories;
create policy "ler stories" on public.stories for select to authenticated
  using (public.can_see_user(user_id) and (audience = 'all' or public.is_close_friend(user_id)));

-- respostas aos stickers: voto na enquete ou resposta da caixinha
create table if not exists public.story_responses (
  story_id   uuid not null references public.stories(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('vote', 'answer')),
  value      text not null check (length(value) between 1 and 300),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id, kind)
);
alter table public.story_responses enable row level security;
drop policy if exists "responder story" on public.story_responses;
create policy "responder story" on public.story_responses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- já votei nesta enquete? (função à parte para a regra não consultar a própria tabela em loop)
create or replace function public.voted_on_story(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from story_responses where story_id = sid and user_id = auth.uid() and kind = 'vote');
$$;
grant execute on function public.voted_on_story(uuid) to authenticated;

-- o dono do story vê todas as respostas; quem votou vê os votos (para mostrar a %)
drop policy if exists "ver respostas" on public.story_responses;
create policy "ver respostas" on public.story_responses for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid())
    or (kind = 'vote' and public.voted_on_story(story_id))
  );

-- ---------------------------------------------------------------------
-- NOTIFICAÇÕES: marcado no story, repost
-- ---------------------------------------------------------------------
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.notifications'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%type%' loop
    execute format('alter table public.notifications drop constraint %I', c);
  end loop;
end $$;
alter table public.notifications add constraint notifications_type_check
  check (type in ('like', 'comment', 'follow', 'reply', 'comment_like', 'follow_request', 'follow_accept', 'story_mention', 'repost'));

-- @menções no texto do story avisam a pessoa
create or replace function public.notify_story_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.overlay is null or coalesce(new.overlay->>'text', '') !~ '@' then return new; end if;
  insert into notifications (user_id, actor_id, type, text)
  select distinct p.id, new.user_id, 'story_mention', left(new.overlay->>'text', 120)
  from regexp_matches(new.overlay->>'text', '@([A-Za-z0-9_.]{2,30})', 'g') as m(u)
  join profiles p on lower(p.username) = lower(rtrim(m.u[1], '.'))
  where p.id <> new.user_id;
  return new;
end $$;
drop trigger if exists on_story_mentions on public.stories;
create trigger on_story_mentions after insert on public.stories for each row execute function public.notify_story_mentions();

create or replace function public.notify_repost() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  if new.repost_of is null then return new; end if;
  select user_id into owner from posts where id = new.repost_of;
  if owner is not null and owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id) values (owner, new.user_id, 'repost', new.repost_of);
  end if;
  return new;
end $$;
drop trigger if exists on_repost on public.posts;
create trigger on_repost after insert on public.posts for each row execute function public.notify_repost();

-- ---------------------------------------------------------------------
-- VIEW DO FEED (traz o autor original do repost)
-- ---------------------------------------------------------------------
-- a função "perto de você" depende da view: sai antes e volta logo abaixo
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

-- ---------------------------------------------------------------------
-- CRIADORES DA SEMANA (mais curtidas recebidas desde uma data)
-- ---------------------------------------------------------------------
create or replace function public.top_creators(since timestamptz, lim int default 10)
returns table (id uuid, username text, display_name text, avatar_url text, likes int, posts int)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.username, pr.display_name, pr.avatar_url,
         count(l.*)::int as likes,
         count(distinct p.id)::int as posts
  from likes l
  join posts p on p.id = l.post_id and not p.archived
  join profiles pr on pr.id = p.user_id
  where l.created_at >= since and not pr.is_private
    and not exists (select 1 from blocks b where (b.blocker_id = auth.uid() and b.blocked_id = pr.id)
                                              or (b.blocker_id = pr.id and b.blocked_id = auth.uid()))
  group by pr.id
  order by likes desc, posts desc
  limit greatest(1, least(lim, 50));
$$;
grant execute on function public.top_creators(timestamptz, int) to authenticated;

-- ---------------------------------------------------------------------
-- TEMPO REAL
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['poll_votes', 'post_ratings', 'story_responses'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
