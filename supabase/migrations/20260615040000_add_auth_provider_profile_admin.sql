alter table public.user_profiles
  add column if not exists login_provider text,
  add column if not exists email text,
  add column if not exists provider_profile_name text,
  add column if not exists provider_avatar_url text,
  add column if not exists provider_user_id text,
  add column if not exists last_sign_in_at timestamptz;

create or replace function public.get_auth_user_profile_name(metadata jsonb)
returns text
language sql
immutable
as $$
  select nullif(
    coalesce(
      metadata ->> 'nickname',
      metadata ->> 'name',
      metadata ->> 'full_name',
      metadata ->> 'preferred_username',
      metadata ->> 'user_name'
    ),
    ''
  );
$$;

create or replace function public.get_auth_user_avatar_url(metadata jsonb)
returns text
language sql
immutable
as $$
  select nullif(
    coalesce(
      metadata ->> 'avatar_url',
      metadata ->> 'picture',
      metadata ->> 'profile_image',
      metadata ->> 'profile_image_url'
    ),
    ''
  );
$$;

create or replace function public.sync_user_profile_auth_metadata(target_user_id uuid)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_user auth.users%rowtype;
  auth_identity auth.identities%rowtype;
  synced_profile public.user_profiles%rowtype;
begin
  select *
    into auth_user
  from auth.users
  where id = target_user_id;

  if auth_user.id is null then
    raise exception '대상 회원을 찾지 못했습니다.';
  end if;

  select *
    into auth_identity
  from auth.identities
  where user_id = target_user_id
  order by
    case when provider = coalesce(auth_user.raw_app_meta_data ->> 'provider', '') then 0 else 1 end,
    updated_at desc nulls last,
    created_at desc nulls last
  limit 1;

  perform set_config('app.syncing_auth_profile', 'true', true);

  update public.user_profiles as profile
  set
    login_provider = coalesce(
      nullif(auth_user.raw_app_meta_data ->> 'provider', ''),
      nullif(auth_identity.provider, ''),
      'email'
    ),
    email = nullif(auth_user.email, ''),
    provider_profile_name = public.get_auth_user_profile_name(auth_user.raw_user_meta_data),
    provider_avatar_url = public.get_auth_user_avatar_url(auth_user.raw_user_meta_data),
    provider_user_id = nullif(
      coalesce(
        auth_identity.identity_data ->> 'provider_id',
        auth_identity.identity_data ->> 'sub',
        auth_identity.id::text
      ),
      ''
    ),
    last_sign_in_at = auth_user.last_sign_in_at,
    updated_at = now()
  where profile.id = target_user_id
  returning *
    into synced_profile;

  return synced_profile;
end;
$$;

create or replace function public.sync_current_user_auth_profile()
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return public.sync_user_profile_auth_metadata(current_user_id);
end;
$$;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_profile public.user_profiles%rowtype;
begin
  insert into public.user_profiles (
    id,
    nickname,
    nickname_changed,
    role,
    login_provider,
    email,
    provider_profile_name,
    provider_avatar_url,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    public.generate_random_profile_nickname(),
    false,
    'user',
    coalesce(nullif(new.raw_app_meta_data ->> 'provider', ''), 'email'),
    nullif(new.email, ''),
    public.get_auth_user_profile_name(new.raw_user_meta_data),
    public.get_auth_user_avatar_url(new.raw_user_meta_data),
    new.last_sign_in_at,
    now(),
    now()
  )
  on conflict (id) do nothing
  returning *
    into new_profile;

  if new_profile.id is not null then
    perform public.sync_user_profile_auth_metadata(new.id);
  end if;

  return new;
end;
$$;

do $$
declare
  profile_row record;
begin
  for profile_row in select id from public.user_profiles loop
    perform public.sync_user_profile_auth_metadata(profile_row.id);
  end loop;
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

  if current_setting('app.syncing_auth_profile', true) = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' and auth.uid() is not null and (
    new.role <> 'user'
    or new.is_verified_dealer <> false
    or new.login_provider is not null
    or new.email is not null
    or new.provider_profile_name is not null
    or new.provider_avatar_url is not null
    or new.provider_user_id is not null
    or new.last_sign_in_at is not null
  ) then
    raise exception 'profile privileged fields cannot be set by client';
  end if;

  if tg_op = 'UPDATE'
    and auth.uid() is not null
    and (
      new.role is distinct from old.role
      or new.is_verified_dealer is distinct from old.is_verified_dealer
      or new.login_provider is distinct from old.login_provider
      or new.email is distinct from old.email
      or new.provider_profile_name is distinct from old.provider_profile_name
      or new.provider_avatar_url is distinct from old.provider_avatar_url
      or new.provider_user_id is distinct from old.provider_user_id
      or new.last_sign_in_at is distinct from old.last_sign_in_at
    ) then
    raise exception 'profile privileged fields cannot be changed by client';
  end if;

  return new;
end;
$$;

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
  login_provider text,
  email text,
  provider_profile_name text,
  provider_avatar_url text,
  provider_user_id text,
  last_sign_in_at timestamptz,
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
    coalesce(profile.login_provider, '정보 없음') as login_provider,
    profile.email,
    profile.provider_profile_name,
    profile.provider_avatar_url,
    profile.provider_user_id,
    profile.last_sign_in_at,
    profile.created_at,
    profile.updated_at
  from public.user_profiles as profile
  where coalesce(search_text, '') = ''
    or coalesce(profile.nickname, '') ilike '%' || search_text || '%'
    or coalesce(profile.email, '') ilike '%' || search_text || '%'
    or coalesce(profile.provider_profile_name, '') ilike '%' || search_text || '%'
    or coalesce(profile.login_provider, '') ilike '%' || search_text || '%'
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

revoke all on function public.get_auth_user_profile_name(jsonb) from public;
revoke all on function public.get_auth_user_avatar_url(jsonb) from public;
revoke all on function public.sync_user_profile_auth_metadata(uuid) from public;
revoke all on function public.sync_current_user_auth_profile() from public;
revoke all on function public.admin_list_user_profiles(text) from public;

grant execute on function public.sync_current_user_auth_profile() to authenticated;
grant execute on function public.admin_list_user_profiles(text) to authenticated;

notify pgrst, 'reload schema';
