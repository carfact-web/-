alter table public.user_profiles
  add column if not exists is_verified_dealer boolean not null default false;

create or replace function public.list_verified_dealer_profiles(target_user_ids uuid[])
returns table (
  id uuid,
  is_verified_dealer boolean
)
language sql
security definer
set search_path = public
as $$
  select
    profile.id,
    profile.is_verified_dealer
  from public.user_profiles as profile
  where profile.id = any(target_user_ids)
    and profile.is_verified_dealer = true;
$$;

drop function if exists public.admin_list_user_profiles(text);

create or replace function public.admin_list_user_profiles(search_text text default '')
returns table (
  id uuid,
  nickname text,
  nickname_changed boolean,
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

create or replace function public.admin_set_user_verified_dealer(
  target_user_id uuid,
  next_is_verified_dealer boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  update public.user_profiles
  set
    is_verified_dealer = next_is_verified_dealer,
    updated_at = now()
  where id = target_user_id;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

create or replace function public.prevent_user_profile_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_has_admin_role() then
    return new;
  end if;

  if tg_op = 'INSERT' and auth.uid() is not null and (
    new.role <> 'user'
    or new.is_verified_dealer <> false
  ) then
    raise exception 'profile privileged fields cannot be set by client';
  end if;

  if tg_op = 'UPDATE'
    and auth.uid() is not null
    and (
      new.role is distinct from old.role
      or new.is_verified_dealer is distinct from old.is_verified_dealer
    ) then
    raise exception 'profile privileged fields cannot be changed by client';
  end if;

  return new;
end;
$$;

revoke all on function public.list_verified_dealer_profiles(uuid[]) from public;
revoke all on function public.admin_list_user_profiles(text) from public;
revoke all on function public.admin_set_user_verified_dealer(uuid, boolean) from public;

grant execute on function public.list_verified_dealer_profiles(uuid[]) to anon;
grant execute on function public.list_verified_dealer_profiles(uuid[]) to authenticated;
grant execute on function public.admin_list_user_profiles(text) to authenticated;
grant execute on function public.admin_set_user_verified_dealer(uuid, boolean) to authenticated;
