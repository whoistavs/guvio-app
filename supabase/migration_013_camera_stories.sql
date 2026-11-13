-- =====================================================================
-- GUVIO · migração 013: stories em vídeo + pedidos de acesso de admin
-- Rode inteiro no SQL Editor do Supabase (pode rodar mais de uma vez).
-- =====================================================================

-- 1) story em vídeo (a imagem continua sendo a capa)
alter table public.stories add column if not exists video_url text;

-- 2) pedidos de acesso de admin (botão no modo desenvolvedor)
--    pedir NÃO dá poder nenhum: só um admin aprova no Painel do criador
create table if not exists public.admin_requests (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);
alter table public.admin_requests enable row level security;
-- sem políticas: só pelas funções abaixo

create or replace function public.request_admin(p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'entre na sua conta'; end if;
  if exists (select 1 from app_admins where user_id = auth.uid()) then return 'already'; end if;
  insert into admin_requests (user_id, note, status, created_at)
  values (auth.uid(), left(coalesce(p_note, ''), 300), 'pending', now())
  on conflict (user_id) do update
    set note = excluded.note,
        status = case when admin_requests.status = 'denied' then 'pending' else admin_requests.status end,
        created_at = case when admin_requests.status = 'denied' then now() else admin_requests.created_at end;
  return (select status from admin_requests where user_id = auth.uid());
end $$;
grant execute on function public.request_admin(text) to authenticated;

create or replace function public.my_admin_request()
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from app_admins where user_id = auth.uid()) then 'admin'
    else (select status from admin_requests where user_id = auth.uid())
  end;
$$;
grant execute on function public.my_admin_request() to authenticated;

create or replace function public.admin_list_requests()
returns table (user_id uuid, username text, avatar_url text, note text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from app_admins a where a.user_id = auth.uid()) then
    raise exception 'sem permissão';
  end if;
  return query
    select r.user_id, p.username, p.avatar_url, r.note, r.status, r.created_at
    from admin_requests r join profiles p on p.id = r.user_id
    where r.status = 'pending'
    order by r.created_at desc;
end $$;
grant execute on function public.admin_list_requests() to authenticated;

create or replace function public.admin_decide_request(p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from app_admins where user_id = auth.uid()) then
    raise exception 'sem permissão';
  end if;
  update admin_requests
    set status = case when p_approve then 'approved' else 'denied' end, decided_at = now(), decided_by = auth.uid()
    where user_id = p_user;
  if p_approve then
    insert into app_admins (user_id) values (p_user) on conflict do nothing;
  end if;
end $$;
grant execute on function public.admin_decide_request(uuid, boolean) to authenticated;
