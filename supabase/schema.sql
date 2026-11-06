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
    coalesce(new.raw_user_meta_data->>'avatar_url', null),
    '',
    'Novo criador de estilo na comunidade Guvio ✨'
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
create or replace view public.feed_posts with (security_invoker = true) as
select
  p.*,
  pr.username,
  pr.display_name,
  pr.avatar_url,
  (select count(*) from public.likes l where l.post_id = p.id)::int    as likes_count,
  (select count(*) from public.comments c where c.post_id = p.id)::int as comments_count
from public.posts p
join public.profiles pr on pr.id = p.user_id;

create or replace view public.profile_stats with (security_invoker = true) as
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
  'Novo criador de estilo na comunidade Guvio ✨'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;
