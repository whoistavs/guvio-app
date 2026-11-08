-- =====================================================================
-- GUVIO — CONTAGENS NO SERVIDOR
-- Enquetes e avaliações passam a ser contadas no banco (antes o app baixava
-- voto por voto, o que fica lento e passa do limite de 1000 linhas).
-- Pode rodar mais de uma vez.
-- =====================================================================

create or replace function public.post_extras(ids uuid[])
returns table (post_id uuid, fire int, ice int, mine int, votes jsonb, my_vote int)
language sql stable security invoker set search_path = public as $$
  select
    p.id,
    (select count(*) from post_ratings r where r.post_id = p.id and r.value = 1)::int,
    (select count(*) from post_ratings r where r.post_id = p.id and r.value = -1)::int,
    coalesce((select r.value from post_ratings r where r.post_id = p.id and r.user_id = auth.uid()), 0)::int,
    coalesce((select jsonb_object_agg(o.option::text, o.n)
              from (select v.option, count(*) as n from poll_votes v where v.post_id = p.id group by v.option) o), '{}'::jsonb),
    (select v.option from poll_votes v where v.post_id = p.id and v.user_id = auth.uid())::int
  from unnest(ids) as p(id);
$$;
grant execute on function public.post_extras(uuid[]) to authenticated;
