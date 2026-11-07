-- =====================================================================
-- GUVIO — MUTIRÃO 4
-- Arquivar/fixar/esconder curtidas, perfil privado com pedidos para
-- seguir, pronomes, destaques de stories, texto no story, silenciar,
-- conversas fixadas/apagadas, lista de desejos e calendário de looks.
-- Pode rodar mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- COLUNAS NOVAS
-- ---------------------------------------------------------------------
alter table public.posts    add column if not exists archived   boolean not null default false;
alter table public.posts    add column if not exists pinned_at  timestamptz;
alter table public.posts    add column if not exists hide_likes boolean not null default false;
alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists pronouns   text not null default '';
alter table public.stories  add column if not exists overlay    jsonb;

-- ---------------------------------------------------------------------
-- QUEM PODE VER O CONTEÚDO DE UM PERFIL
-- (perfil aberto, eu mesmo ou alguém que me aprovou como seguidor)
-- ---------------------------------------------------------------------
create or replace function public.can_see_user(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or not coalesce((select is_private from profiles where id = owner), false)
      or exists (select 1 from follows where follower_id = auth.uid() and following_id = owner);
$$;
grant execute on function public.can_see_user(uuid) to authenticated;

drop policy if exists "ler posts" on public.posts;
create policy "ler posts" on public.posts for select to authenticated
  using (user_id = auth.uid() or (not archived and public.can_see_user(user_id)));

drop policy if exists "ler stories" on public.stories;
create policy "ler stories" on public.stories for select to authenticated
  using (public.can_see_user(user_id));

-- ---------------------------------------------------------------------
-- PEDIDOS PARA SEGUIR (perfil privado)
-- ---------------------------------------------------------------------
create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id    uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (requester_id, target_id),
  check (requester_id <> target_id)
);
alter table public.follow_requests enable row level security;
drop policy if exists "pedir para seguir" on public.follow_requests;
create policy "pedir para seguir" on public.follow_requests for insert to authenticated
  with check (requester_id = auth.uid()
    and not exists (select 1 from public.blocks b where b.blocker_id = target_id and b.blocked_id = auth.uid()));
drop policy if exists "ver pedidos" on public.follow_requests;
create policy "ver pedidos" on public.follow_requests for select to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());
drop policy if exists "cancelar ou recusar pedido" on public.follow_requests;
create policy "cancelar ou recusar pedido" on public.follow_requests for delete to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());

-- seguir direto só vale para perfil aberto; privado passa por pedido
drop policy if exists "seguir" on public.follows;
create policy "seguir" on public.follows for insert to authenticated
  with check (follower_id = auth.uid()
    and not coalesce((select is_private from public.profiles where id = following_id), false));

-- novos tipos de notificação
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
  check (type in ('like', 'comment', 'follow', 'reply', 'comment_like', 'follow_request', 'follow_accept'));

create or replace function public.notify_follow_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, type) values (new.target_id, new.requester_id, 'follow_request');
  return new;
end $$;
drop trigger if exists on_follow_request on public.follow_requests;
create trigger on_follow_request after insert on public.follow_requests
  for each row execute function public.notify_follow_request();

-- aprovar um pedido: vira seguidor e avisa quem pediu
create or replace function public.approve_follow_request(requester uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from follow_requests where requester_id = requester and target_id = auth.uid()) then
    raise exception 'pedido não encontrado';
  end if;
  insert into follows (follower_id, following_id) values (requester, auth.uid()) on conflict do nothing;
  delete from follow_requests where requester_id = requester and target_id = auth.uid();
  delete from notifications where user_id = auth.uid() and actor_id = requester and type = 'follow_request';
  insert into notifications (user_id, actor_id, type) values (requester, auth.uid(), 'follow_accept');
end $$;
grant execute on function public.approve_follow_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- DESTAQUES DE STORIES
-- ---------------------------------------------------------------------
create table if not exists public.highlights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null check (length(title) between 1 and 30),
  cover_url  text,
  created_at timestamptz not null default now()
);
create table if not exists public.highlight_items (
  highlight_id uuid not null references public.highlights(id) on delete cascade,
  story_id     uuid not null references public.stories(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (highlight_id, story_id)
);
alter table public.highlights enable row level security;
alter table public.highlight_items enable row level security;
drop policy if exists "ver destaques" on public.highlights;
create policy "ver destaques" on public.highlights for select to authenticated using (public.can_see_user(user_id));
drop policy if exists "meus destaques" on public.highlights;
create policy "meus destaques" on public.highlights for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ver itens de destaque" on public.highlight_items;
create policy "ver itens de destaque" on public.highlight_items for select to authenticated
  using (exists (select 1 from public.highlights h where h.id = highlight_id and public.can_see_user(h.user_id)));
drop policy if exists "meus itens de destaque" on public.highlight_items;
create policy "meus itens de destaque" on public.highlight_items for all to authenticated
  using (exists (select 1 from public.highlights h where h.id = highlight_id and h.user_id = auth.uid()))
  with check (exists (select 1 from public.highlights h where h.id = highlight_id and h.user_id = auth.uid())
              and exists (select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- SILENCIAR (some do feed sem deixar de seguir) e PREFERÊNCIAS DO DIRECT
-- ---------------------------------------------------------------------
create table if not exists public.mutes (
  muter_id   uuid not null references public.profiles(id) on delete cascade,
  muted_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id)
);
alter table public.mutes enable row level security;
drop policy if exists "meus silenciados" on public.mutes;
create policy "meus silenciados" on public.mutes for all to authenticated
  using (muter_id = auth.uid()) with check (muter_id = auth.uid());

create table if not exists public.dm_prefs (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  other_id   uuid not null references public.profiles(id) on delete cascade,
  pinned     boolean not null default false,
  cleared_at timestamptz,
  primary key (user_id, other_id)
);
alter table public.dm_prefs enable row level security;
drop policy if exists "minhas conversas" on public.dm_prefs;
create policy "minhas conversas" on public.dm_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- GUARDA-ROUPA: LISTA DE DESEJOS E CALENDÁRIO DE LOOKS (privados)
-- ---------------------------------------------------------------------
create table if not exists public.wishlist_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null check (length(name) between 1 and 80),
  link       text,
  price      text,
  image_url  text,
  bought     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists wishlist_user_idx on public.wishlist_items (user_id, created_at desc);

create table if not exists public.outfit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  item_ids   jsonb not null default '[]'::jsonb,
  note       text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.wishlist_items enable row level security;
alter table public.outfit_log enable row level security;
drop policy if exists "meus desejos" on public.wishlist_items;
create policy "meus desejos" on public.wishlist_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "meu calendario" on public.outfit_log;
create policy "meu calendario" on public.outfit_log for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- VIEWS (recriadas para trazer as colunas novas)
-- ---------------------------------------------------------------------
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

-- contagem de posts aparece mesmo para perfil privado (só os posts ficam escondidos)
create or replace function public.user_post_count(uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from posts where user_id = uid and not archived;
$$;
grant execute on function public.user_post_count(uuid) to authenticated;

drop view if exists public.profile_stats;
create view public.profile_stats with (security_invoker = true) as
select
  pr.*,
  (select count(*) from public.follows f where f.following_id = pr.id)::int as followers_count,
  (select count(*) from public.follows f where f.follower_id = pr.id)::int  as following_count,
  public.user_post_count(pr.id) as posts_count
from public.profiles pr;

-- ---------------------------------------------------------------------
-- TEMPO REAL
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['follow_requests'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
