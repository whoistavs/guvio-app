-- =====================================================================
-- GUVIO — banco de dados completo (Supabase / Postgres)
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- Pode rodar de novo sem problema (é idempotente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- PERFIS
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9._]{3,30}$'),
  display_name text not null default '',
  avatar_url   text,
  bio          text not null default '',
  website      text not null default '',
  location     text not null default '',
  created_at   timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Verifica se um @username está livre (usado na tela de cadastro)
create or replace function public.username_available(name text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(name));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- POSTS, CURTIDAS, SALVOS, COMENTÁRIOS
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  image_url     text not null,
  caption       text not null default '',
  city          text not null default '',
  country       text not null default '',
  style_tag     text not null default 'Novo look',
  clothing_tags jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_user_idx on public.posts (user_id);

create table if not exists public.likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.saves (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  text       text not null check (length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- ---------------------------------------------------------------------
-- SEGUIDORES, STORIES, DIRECT, GUARDA-ROUPA, NOTIFICAÇÕES
-- ---------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.stories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  image_url  text not null,
  caption    text,
  created_at timestamptz not null default now()
);
create index if not exists stories_created_idx on public.stories (created_at desc);

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  text         text,
  image_url    text,
  reaction     text,
  created_at   timestamptz not null default now(),
  check (text is not null or image_url is not null)
);
create index if not exists messages_pair_idx on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at);

create table if not exists public.wardrobe_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  category   text not null default '',
  color_tag  text not null default '',
  image_url  text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade, -- quem recebe
  actor_id   uuid not null references public.profiles(id) on delete cascade, -- quem fez
  type       text not null check (type in ('like', 'comment', 'follow')),
  post_id    uuid references public.posts(id) on delete cascade,
  text       text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- Gera notificações automaticamente
create or replace function public.notify_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id) values (owner, new.user_id, 'like', new.post_id);
  end if;
  return new;
end $$;

create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if owner is not null and owner <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id, text) values (owner, new.user_id, 'comment', new.post_id, new.text);
  end if;
  return new;
end $$;

create or replace function public.notify_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, actor_id, type) values (new.following_id, new.follower_id, 'follow');
  return new;
end $$;

drop trigger if exists on_like on public.likes;
create trigger on_like after insert on public.likes for each row execute function public.notify_like();
drop trigger if exists on_comment on public.comments;
create trigger on_comment after insert on public.comments for each row execute function public.notify_comment();
drop trigger if exists on_follow on public.follows;
create trigger on_follow after insert on public.follows for each row execute function public.notify_follow();

-- ---------------------------------------------------------------------
-- VIEWS COM CONTADORES
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

drop view if exists public.profile_stats;
create view public.profile_stats with (security_invoker = true) as
select
  pr.*,
  (select count(*) from public.follows f where f.following_id = pr.id)::int as followers_count,
  (select count(*) from public.follows f where f.follower_id = pr.id)::int  as following_count,
  (select count(*) from public.posts p where p.user_id = pr.id)::int        as posts_count
from public.profiles pr;

-- ---------------------------------------------------------------------
-- SEGURANÇA (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.posts          enable row level security;
alter table public.likes          enable row level security;
alter table public.saves          enable row level security;
alter table public.comments       enable row level security;
alter table public.follows        enable row level security;
alter table public.stories        enable row level security;
alter table public.messages       enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.blocks         enable row level security;
alter table public.notifications  enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('profiles','posts','likes','saves','comments','follows','stories',
                      'messages','wardrobe_items','blocks','notifications')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Conteúdo público da comunidade: qualquer usuário logado lê
create policy "ler perfis"      on public.profiles for select to authenticated using (true);
create policy "editar meu perfil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "ler posts"       on public.posts for select to authenticated using (true);
create policy "criar post"      on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "editar meu post" on public.posts for update to authenticated using (user_id = auth.uid());
create policy "apagar meu post" on public.posts for delete to authenticated using (user_id = auth.uid());

create policy "ler curtidas"    on public.likes for select to authenticated using (true);
create policy "curtir"          on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "descurtir"       on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "ver meus salvos" on public.saves for select to authenticated using (user_id = auth.uid());
create policy "salvar"          on public.saves for insert to authenticated with check (user_id = auth.uid());
create policy "dessalvar"       on public.saves for delete to authenticated using (user_id = auth.uid());

create policy "ler comentarios" on public.comments for select to authenticated using (true);
create policy "comentar"        on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "apagar comentario" on public.comments for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()));

create policy "ler follows"     on public.follows for select to authenticated using (true);
create policy "seguir"          on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "deixar de seguir" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "ler stories"     on public.stories for select to authenticated using (true);
create policy "criar story"     on public.stories for insert to authenticated with check (user_id = auth.uid());
create policy "apagar story"    on public.stories for delete to authenticated using (user_id = auth.uid());

create policy "ler minhas mensagens" on public.messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "enviar mensagem" on public.messages for insert to authenticated
  with check (sender_id = auth.uid()
    and not exists (select 1 from public.blocks b where b.blocker_id = recipient_id and b.blocked_id = auth.uid()));
create policy "reagir mensagem" on public.messages for update to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "meu guarda-roupa" on public.wardrobe_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "meus bloqueios"  on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy "minhas notificacoes" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "apagar notificacao" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- FOTOS (Storage) — bucket público "media", cada usuário grava na própria pasta
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media leitura publica" on storage.objects;
drop policy if exists "media upload proprio"  on storage.objects;
drop policy if exists "media apagar proprio"  on storage.objects;
create policy "media leitura publica" on storage.objects for select using (bucket_id = 'media');
create policy "media upload proprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "media apagar proprio" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- TEMPO REAL
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['posts','likes','comments','messages','notifications','stories'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- PERFIS PARA CONTAS QUE JÁ EXISTIAM antes deste schema
-- (cria um perfil para cada usuário do Auth que ainda não tem; o @ pode ser trocado no app)
-- ---------------------------------------------------------------------
insert into public.profiles (id, username, display_name, bio)
select
  u.id,
  left(lower(regexp_replace(coalesce(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
                            '[^a-zA-Z0-9._]', '', 'g')), 20)
    || '_' || left(replace(u.id::text, '-', ''), 4),
  coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), split_part(u.email, '@', 1), 'Membro Guvio'),
  ''
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- APAGAR MINHA CONTA (exigido pela App Store)
-- Apaga o usuário logado e, em cascata, tudo dele (perfil, posts, mensagens...).
-- As fotos são apagadas pelo app via Storage API antes de chamar esta função.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ===== MUTIRÃO (migration_002) =====

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

-- ===== PERFIL LIMPO (migration_003) =====
update public.profiles set bio = ''
where bio in ('Novo criador de estilo na comunidade Guvio ✨',
              'Amante da moda minimalista e composições contemporâneas ✨');
update public.profiles set avatar_url = null
where avatar_url like '%googleusercontent.com%';

-- ===== MUTIRÃO 2 (migration_004) =====
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

-- ===== MUTIRÃO 3 (migration_005) =====

-- ---------------------------------------------------------------------
-- COMENTÁRIOS: respostas e curtidas
-- ---------------------------------------------------------------------
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_likes enable row level security;
drop policy if exists "ler curtidas de comentarios" on public.comment_likes;
create policy "ler curtidas de comentarios" on public.comment_likes for select to authenticated using (true);
drop policy if exists "curtir comentario" on public.comment_likes;
create policy "curtir comentario" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "descurtir comentario" on public.comment_likes;
create policy "descurtir comentario" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

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
  check (type in ('like', 'comment', 'follow', 'reply', 'comment_like'));

-- comentário avisa o dono do post; resposta avisa também quem fez o comentário
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; parent_author uuid;
begin
  select user_id into owner from posts where id = new.post_id;
  if new.parent_id is not null then
    select user_id into parent_author from comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.user_id then
      insert into notifications (user_id, actor_id, type, post_id, text)
      values (parent_author, new.user_id, 'reply', new.post_id, new.text);
    end if;
  end if;
  if owner is not null and owner <> new.user_id and owner is distinct from parent_author then
    insert into notifications (user_id, actor_id, type, post_id, text) values (owner, new.user_id, 'comment', new.post_id, new.text);
  end if;
  return new;
end $$;

create or replace function public.notify_comment_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare author uuid; pid uuid; body text;
begin
  select user_id, post_id, text into author, pid, body from comments where id = new.comment_id;
  if author is not null and author <> new.user_id then
    insert into notifications (user_id, actor_id, type, post_id, text) values (author, new.user_id, 'comment_like', pid, body);
  end if;
  return new;
end $$;
drop trigger if exists on_comment_like on public.comment_likes;
create trigger on_comment_like after insert on public.comment_likes for each row execute function public.notify_comment_like();

-- ---------------------------------------------------------------------
-- COLEÇÕES DE SALVOS (privadas)
-- ---------------------------------------------------------------------
create table if not exists public.collections (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null check (length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create index if not exists collections_user_idx on public.collections (user_id, created_at desc);

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  post_id       uuid not null references public.posts(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (collection_id, post_id)
);

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
drop policy if exists "minhas colecoes" on public.collections;
create policy "minhas colecoes" on public.collections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "itens das minhas colecoes" on public.collection_items;
create policy "itens das minhas colecoes" on public.collection_items for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- DIRECT: post compartilhado, responder, apagar e reação segura
-- ---------------------------------------------------------------------
alter table public.messages add column if not exists post_id    uuid references public.posts(id) on delete set null;
alter table public.messages add column if not exists reply_to   uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists deleted_at timestamptz;

-- a mensagem precisa ter texto, foto ou post (ou estar apagada)
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.messages'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%image_url%' loop
    execute format('alter table public.messages drop constraint %I', c);
  end loop;
end $$;
alter table public.messages add constraint messages_content_check
  check (text is not null or image_url is not null or post_id is not null or deleted_at is not null);

-- antes qualquer um da conversa podia alterar a mensagem inteira;
-- agora reação e apagar passam só por estas funções
drop policy if exists "reagir mensagem" on public.messages;

create or replace function public.react_message(msg uuid, emoji text)
returns void language sql security definer set search_path = public as $$
  update public.messages set reaction = nullif(left(emoji, 8), '')
  where id = msg and deleted_at is null
    and (sender_id = auth.uid() or recipient_id = auth.uid());
$$;
grant execute on function public.react_message(uuid, text) to authenticated;

create or replace function public.delete_message(msg uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages
     set deleted_at = now(), text = null, image_url = null, post_id = null, reaction = null
   where id = msg and sender_id = auth.uid();
$$;
grant execute on function public.delete_message(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- SUGESTÕES DE PERFIS: amigos de quem eu sigo primeiro, depois os populares
-- ---------------------------------------------------------------------
create or replace function public.suggested_profiles(lim int default 15)
returns table (id uuid, username text, display_name text, avatar_url text, location text,
               followers int, mutuals int)
language sql stable security invoker set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.location,
         (select count(*) from follows f where f.following_id = p.id)::int as followers,
         (select count(*) from follows f1 join follows f2 on f2.follower_id = f1.following_id
           where f1.follower_id = auth.uid() and f2.following_id = p.id)::int as mutuals
  from profiles p
  where p.id <> auth.uid()
    and not exists (select 1 from follows f where f.follower_id = auth.uid() and f.following_id = p.id)
    and not exists (select 1 from blocks b where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
                                              or (b.blocker_id = p.id and b.blocked_id = auth.uid()))
  order by mutuals desc, followers desc, p.created_at desc
  limit greatest(1, least(lim, 50));
$$;
grant execute on function public.suggested_profiles(int) to authenticated;

-- ---------------------------------------------------------------------
-- FEEDBACK DOS TESTERS (você lê em Table Editor › feedback)
-- ---------------------------------------------------------------------
create table if not exists public.feedback (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete set null,
  kind           text not null default 'bug' check (kind in ('bug', 'ideia', 'outro')),
  text           text not null check (length(text) between 1 and 4000),
  screenshot_url text,
  app_version    text,
  platform       text,
  created_at     timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "enviar feedback" on public.feedback;
create policy "enviar feedback" on public.feedback for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "ver meu feedback" on public.feedback;
create policy "ver meu feedback" on public.feedback for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- TEMPO REAL
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['comment_likes'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ===== MUTIRÃO 4 (migration_006) =====

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

-- ===== DESEMPENHO (migration_007) =====

-- contagem de seguidores (perfil, sugestões) e "quem eu sigo"
create index if not exists follows_following_idx on public.follows (following_id);

-- minhas curtidas e salvos (feed, "Salvos", estatísticas)
create index if not exists likes_user_idx on public.likes (user_id, created_at desc);
create index if not exists saves_user_idx on public.saves (user_id, created_at desc);

-- stories: os que eu já vi, arquivo para destaques
create index if not exists story_views_viewer_idx on public.story_views (viewer_id);
create index if not exists stories_user_idx on public.stories (user_id, created_at desc);
create index if not exists highlight_items_story_idx on public.highlight_items (story_id);

-- feed só com posts visíveis, perfil com fixados primeiro
create index if not exists posts_feed_idx on public.posts (created_at desc) where not archived;
create index if not exists posts_profile_idx on public.posts (user_id, pinned_at desc nulls last, created_at desc) where not archived;

-- denúncias, pedidos para seguir, coleções
create index if not exists reports_reporter_idx on public.reports (reporter_id);
create index if not exists follow_requests_target_idx on public.follow_requests (target_id, created_at desc);
create index if not exists collection_items_post_idx on public.collection_items (post_id);

-- busca por texto (legenda, cidade, #hashtags, @marcações, desafio) sem ler a tabela inteira
create extension if not exists pg_trgm with schema extensions;
create index if not exists posts_caption_trgm on public.posts using gin (caption extensions.gin_trgm_ops);
create index if not exists posts_city_trgm on public.posts using gin (city extensions.gin_trgm_ops);

-- atualiza as estatísticas do planejador
analyze public.posts;
analyze public.likes;
analyze public.follows;

-- ===== MUTIRÃO 5 (migration_008) =====

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
