alter table public.user_profiles
  add column if not exists nickname_change_available integer not null default 0;

alter table public.user_profiles
  drop constraint if exists user_profiles_nickname_change_available_check;

alter table public.user_profiles
  add constraint user_profiles_nickname_change_available_check
  check (nickname_change_available >= 0);

create table if not exists public.nickname_change_grant_logs (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.user_profiles(id) on delete cascade,
  granted_by uuid references public.user_profiles(id) on delete set null,
  grant_amount integer not null default 1,
  previous_available integer not null,
  next_available integer not null,
  created_at timestamptz not null default now()
);

alter table public.nickname_change_grant_logs
  add column if not exists id uuid default gen_random_uuid();

alter table public.nickname_change_grant_logs
  add column if not exists target_user_id uuid references public.user_profiles(id) on delete cascade;

alter table public.nickname_change_grant_logs
  add column if not exists granted_by uuid references public.user_profiles(id) on delete set null;

alter table public.nickname_change_grant_logs
  add column if not exists grant_amount integer not null default 1;

alter table public.nickname_change_grant_logs
  add column if not exists previous_available integer not null default 0;

alter table public.nickname_change_grant_logs
  add column if not exists next_available integer not null default 0;

alter table public.nickname_change_grant_logs
  add column if not exists created_at timestamptz not null default now();

alter table public.nickname_change_grant_logs enable row level security;

drop function if exists public.admin_list_user_profiles(text);

create or replace function public.admin_list_user_profiles(search_text text default '')
returns table (
  id uuid,
  nickname text,
  nickname_changed boolean,
  nickname_change_available integer,
  role text,
  is_suspended boolean,
  is_verified_dealer boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  select
    profile.id,
    profile.nickname,
    profile.nickname_changed,
    profile.nickname_change_available,
    profile.role,
    profile.is_suspended,
    profile.is_verified_dealer,
    profile.created_at,
    profile.updated_at
  from public.user_profiles as profile
  where coalesce(search_text, '') = ''
    or coalesce(profile.nickname, '') ilike '%' || search_text || '%'
    or profile.id::text ilike '%' || search_text || '%'
    or profile.role ilike '%' || search_text || '%'
    or (
      profile.is_verified_dealer = true
      and '인증딜러' ilike '%' || search_text || '%'
    )
  order by profile.created_at desc
  limit 300;
end;
$$;

create or replace function public.admin_grant_nickname_change_ticket(
  target_user_id uuid,
  grant_amount integer default 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  previous_count integer;
  next_count integer;
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if grant_amount is null or grant_amount <= 0 then
    raise exception '변경권 수량은 1 이상이어야 합니다.';
  end if;

  select profile.nickname_change_available
    into previous_count
  from public.user_profiles as profile
  where profile.id = target_user_id
  for update;

  if previous_count is null then
    raise exception '대상 회원을 찾지 못했습니다.';
  end if;

  next_count := previous_count + grant_amount;

  update public.user_profiles
  set
    nickname_change_available = next_count,
    updated_at = now()
  where id = target_user_id;

  insert into public.nickname_change_grant_logs (
    target_user_id,
    granted_by,
    grant_amount,
    previous_available,
    next_available
  )
  values (
    target_user_id,
    actor_id,
    grant_amount,
    previous_count,
    next_count
  );

  return next_count;
end;
$$;

create or replace function public.prevent_user_profile_nickname_rechange()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nickname_change_available < 0 then
    raise exception 'nickname change ticket cannot be negative';
  end if;

  if tg_op = 'UPDATE'
    and old.nickname is distinct from new.nickname then
    if old.nickname_changed = false then
      new.nickname_changed := true;
    elsif old.nickname_change_available > 0 then
      new.nickname_changed := true;
      new.nickname_change_available := old.nickname_change_available - 1;
    elsif public.current_user_has_admin_role() then
      return new;
    else
      raise exception 'nickname can only be changed once';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.nickname_changed = true
    and old.nickname is not distinct from new.nickname
    and new.nickname_changed is distinct from old.nickname_changed
    and not public.current_user_has_admin_role() then
    raise exception 'nickname change state cannot be changed by client';
  end if;

  return new;
end;
$$;

revoke all on function public.admin_list_user_profiles(text) from public;
revoke all on function public.admin_grant_nickname_change_ticket(uuid, integer) from public;

grant execute on function public.admin_list_user_profiles(text) to authenticated;
grant execute on function public.admin_grant_nickname_change_ticket(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
