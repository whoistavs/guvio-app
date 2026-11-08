-- =====================================================================
-- GUVIO — PRIVACIDADE (VOTOS E BLOQUEIO)
-- Cada pessoa só consegue ler os PRÓPRIOS votos de enquete e avaliações.
-- Os totais continuam aparecendo para todos, pela função post_extras.
-- Pode rodar mais de uma vez.
-- =====================================================================

drop policy if exists "ver votos" on public.poll_votes;
create policy "ver votos" on public.poll_votes for select to authenticated using (user_id = auth.uid());

drop policy if exists "ver avaliacoes" on public.post_ratings;
create policy "ver avaliacoes" on public.post_ratings for select to authenticated using (user_id = auth.uid());

-- totais: roda com permissão própria, mas só para posts que a pessoa pode ver
create or replace function public.post_extras(ids uuid[])
returns table (post_id uuid, fire int, ice int, mine int, votes jsonb, my_vote int)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    (select count(*) from post_ratings r where r.post_id = p.id and r.value = 1)::int,
    (select count(*) from post_ratings r where r.post_id = p.id and r.value = -1)::int,
    coalesce((select r.value from post_ratings r where r.post_id = p.id and r.user_id = auth.uid()), 0)::int,
    coalesce((select jsonb_object_agg(o.option::text, o.n)
              from (select v.option, count(*) as n from poll_votes v where v.post_id = p.id group by v.option) o), '{}'::jsonb),
    (select v.option from poll_votes v where v.post_id = p.id and v.user_id = auth.uid())::int
  from posts p
  where p.id = any(ids)
    and (p.user_id = auth.uid() or (not p.archived and public.can_see_user(p.user_id)));
$$;
grant execute on function public.post_extras(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- BLOQUEIO DE VERDADE
-- quem eu bloqueei não vê meus posts/stories, não comenta, não curte,
-- não me segue; e o bloqueio desfaz quem seguia quem
-- ---------------------------------------------------------------------
create or replace function public.can_see_user(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
      or (
        not exists (select 1 from blocks b where b.blocker_id = owner and b.blocked_id = auth.uid())
        and (
          not coalesce((select is_private from profiles where id = owner), false)
          or exists (select 1 from follows where follower_id = auth.uid() and following_id = owner)
        )
      );
$$;
grant execute on function public.can_see_user(uuid) to authenticated;

create or replace function public.blocked_by(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks b where b.blocker_id = owner and b.blocked_id = auth.uid());
$$;
grant execute on function public.blocked_by(uuid) to authenticated;

-- só dá para comentar/curtir um post que você pode ver (e cujo dono não te bloqueou)
create or replace function public.can_interact_post(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from posts p where p.id = pid
                 and (p.user_id = auth.uid() or (not p.archived and public.can_see_user(p.user_id))));
$$;
grant execute on function public.can_interact_post(uuid) to authenticated;

drop policy if exists "comentar" on public.comments;
create policy "comentar" on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_interact_post(post_id));

drop policy if exists "curtir" on public.likes;
create policy "curtir" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_interact_post(post_id));

drop policy if exists "seguir" on public.follows;
create policy "seguir" on public.follows for insert to authenticated
  with check (follower_id = auth.uid()
    and not public.blocked_by(following_id)
    and not coalesce((select is_private from public.profiles where id = following_id), false));

create or replace function public.on_block_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from follows where (follower_id = new.blocker_id and following_id = new.blocked_id)
                         or (follower_id = new.blocked_id and following_id = new.blocker_id);
  delete from follow_requests where (requester_id = new.blocker_id and target_id = new.blocked_id)
                                 or (requester_id = new.blocked_id and target_id = new.blocker_id);
  return new;
end $$;
drop trigger if exists on_block_cleanup on public.blocks;
create trigger on_block_cleanup after insert on public.blocks
  for each row execute function public.on_block_cleanup();
