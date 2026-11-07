-- =====================================================================
-- GUVIO — MUTIRÃO 3 (versão beta)
-- Respostas e curtidas em comentários, coleções de salvos, Direct
-- (post compartilhado, responder, apagar, reações seguras), sugestões de
-- perfis e feedback dos testers. Pode rodar mais de uma vez.
-- =====================================================================

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
