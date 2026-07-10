create or replace function public.get_auth_user_login_profile_name(
  metadata jsonb,
  provider text default ''
)
returns text
language sql
immutable
as $$
  select nullif(
    case lower(coalesce(provider, ''))
      when 'google' then coalesce(
        metadata ->> 'full_name',
        metadata ->> 'name',
        metadata ->> 'user_name'
      )
      when 'kakao' then coalesce(
        metadata ->> 'name',
        metadata ->> 'full_name',
        metadata ->> 'nickname',
        metadata ->> 'preferred_username'
      )
      else coalesce(
        metadata ->> 'full_name',
        metadata ->> 'name',
        metadata ->> 'user_name',
        metadata ->> 'nickname',
        metadata ->> 'preferred_username'
      )
    end,
    ''
  );
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
  login_profile_name text,
  provider_avatar_url text,
  provider_user_id text,
  last_sign_in_at timestamptz,
  review_count integer,
  post_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  with profile_rows as (
    select
      profile.id,
      profile.nickname,
      profile.nickname_changed,
      profile.nickname_change_available,
      profile.role,
      profile.is_suspended,
      profile.is_verified_dealer,
      coalesce(profile.login_provider, auth_user.raw_app_meta_data ->> 'provider', 'email') as login_provider,
      coalesce(profile.email, auth_user.email) as email,
      profile.provider_profile_name,
      coalesce(
        public.get_auth_user_login_profile_name(
          auth_user.raw_user_meta_data,
          coalesce(profile.login_provider, auth_user.raw_app_meta_data ->> 'provider', 'email')
        ),
        profile.provider_profile_name,
        '정보 없음'
      ) as login_profile_name,
      profile.provider_avatar_url,
      profile.provider_user_id,
      coalesce(profile.last_sign_in_at, auth_user.last_sign_in_at) as last_sign_in_at,
      coalesce(review_counts.review_count, 0)::integer as review_count,
      coalesce(post_counts.post_count, 0)::integer as post_count,
      profile.created_at,
      profile.updated_at
    from public.user_profiles as profile
    left join auth.users as auth_user on auth_user.id = profile.id
    left join (
      select review.author_id as user_id, count(*)::integer as review_count
      from public.reviews as review
      where coalesce(review.is_hidden, false) = false
      group by review.author_id
    ) as review_counts on review_counts.user_id = profile.id
    left join (
      select post.user_id, count(*)::integer as post_count
      from public.community_posts as post
      where coalesce(post.is_hidden, false) = false
      group by post.user_id
    ) as post_counts on post_counts.user_id = profile.id
  )
  select
    profile.id,
    profile.nickname,
    profile.nickname_changed,
    profile.nickname_change_available,
    profile.role,
    profile.is_suspended,
    profile.is_verified_dealer,
    profile.login_provider,
    profile.email,
    profile.provider_profile_name,
    profile.login_profile_name,
    profile.provider_avatar_url,
    profile.provider_user_id,
    profile.last_sign_in_at,
    profile.review_count,
    profile.post_count,
    profile.created_at,
    profile.updated_at
  from profile_rows as profile
  where coalesce(search_text, '') = ''
    or coalesce(profile.nickname, '') ilike '%' || search_text || '%'
    or coalesce(profile.login_profile_name, '') ilike '%' || search_text || '%'
    or coalesce(profile.email, '') ilike '%' || search_text || '%'
    or profile.id::text ilike '%' || search_text || '%'
    or coalesce(profile.login_provider, '') ilike '%' || search_text || '%'
    or coalesce(profile.provider_user_id, '') ilike '%' || search_text || '%'
    or profile.role ilike '%' || search_text || '%'
    or (
      profile.is_verified_dealer = true
      and '인증딜러' ilike '%' || search_text || '%'
    )
  order by profile.created_at desc
  limit 300;
end;
$$;

revoke all on function public.get_auth_user_login_profile_name(jsonb, text) from public;
revoke all on function public.admin_list_user_profiles(text) from public;
grant execute on function public.admin_list_user_profiles(text) to authenticated;

notify pgrst, 'reload schema';
