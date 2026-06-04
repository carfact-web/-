alter table public.user_profiles
  add column if not exists is_suspended boolean not null default false;

create table if not exists public.popup_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  link_url text,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.popup_notices enable row level security;

drop policy if exists "Popup notices are readable when active" on public.popup_notices;
create policy "Popup notices are readable when active"
  on public.popup_notices
  for select
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create or replace function public.current_user_has_super_admin_role()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

drop function if exists public.admin_list_user_profiles(text);

create or replace function public.admin_list_user_profiles(search_text text default '')
returns table (
  id uuid,
  nickname text,
  nickname_changed boolean,
  role text,
  is_suspended boolean,
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
    profile.created_at,
    profile.updated_at
  from public.user_profiles as profile
  where coalesce(search_text, '') = ''
    or coalesce(profile.nickname, '') ilike '%' || search_text || '%'
    or profile.id::text ilike '%' || search_text || '%'
    or profile.role ilike '%' || search_text || '%'
  order by profile.created_at desc
  limit 300;
end;
$$;

create or replace function public.admin_set_user_suspended(
  target_user_id uuid,
  next_is_suspended boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  affected_count integer;
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if auth.uid() = target_user_id then
    raise exception '본인 계정은 정지할 수 없습니다.';
  end if;

  select role into target_role
  from public.user_profiles
  where id = target_user_id;

  if target_role is null then
    return false;
  end if;

  if target_role = 'super_admin' then
    raise exception 'super_admin 계정은 정지할 수 없습니다.';
  end if;

  update public.user_profiles
  set
    is_suspended = next_is_suspended,
    updated_at = now()
  where id = target_user_id;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

create or replace function public.admin_set_user_role(
  target_user_id uuid,
  next_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  if not public.current_user_has_super_admin_role() then
    raise exception 'super_admin 권한이 필요합니다.';
  end if;

  if auth.uid() = target_user_id then
    raise exception '본인 role은 변경할 수 없습니다.';
  end if;

  if next_role not in ('user', 'admin') then
    raise exception '허용되지 않는 role입니다.';
  end if;

  update public.user_profiles
  set
    role = next_role,
    updated_at = now()
  where id = target_user_id
    and role <> 'super_admin';

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

create or replace function public.admin_upsert_community_notice(
  target_post_id uuid default null,
  next_title text default '',
  next_content text default '',
  next_category text default 'news',
  next_is_pinned boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_nickname text;
  notice_id uuid;
  affected_count integer;
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if length(trim(next_title)) = 0 or length(trim(next_content)) = 0 then
    raise exception '공지 제목과 내용을 입력해야 합니다.';
  end if;

  if next_category not in ('free', 'maintenance', 'news', 'electric', 'imported', 'domestic', 'partner') then
    raise exception '허용되지 않는 카테고리입니다.';
  end if;

  select coalesce(nickname, '관리자')
  into actor_nickname
  from public.user_profiles
  where id = actor_id;

  if target_post_id is null then
    insert into public.community_posts (
      category,
      title,
      content,
      user_id,
      author_nickname,
      images,
      is_hidden,
      is_notice,
      is_pinned,
      report_count,
      like_count,
      comment_count,
      created_at,
      updated_at
    )
    values (
      next_category,
      trim(next_title),
      trim(next_content),
      actor_id,
      actor_nickname,
      '[]'::jsonb,
      false,
      true,
      next_is_pinned,
      0,
      0,
      0,
      now(),
      now()
    )
    returning id into notice_id;

    return notice_id;
  end if;

  update public.community_posts
  set
    category = next_category,
    title = trim(next_title),
    content = trim(next_content),
    is_notice = true,
    is_pinned = next_is_pinned,
    updated_at = now()
  where id = target_post_id;

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    return null;
  end if;

  return target_post_id;
end;
$$;

create or replace function public.admin_delete_community_notice(target_post_id uuid)
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

  delete from public.community_posts
  where id = target_post_id
    and is_notice = true;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

create or replace function public.admin_list_popup_notices(search_text text default '')
returns table (
  id uuid,
  title text,
  content text,
  link_url text,
  is_active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
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
    notice.id,
    notice.title,
    notice.content,
    notice.link_url,
    notice.is_active,
    notice.starts_at,
    notice.ends_at,
    notice.created_by,
    notice.created_at,
    notice.updated_at
  from public.popup_notices as notice
  where coalesce(search_text, '') = ''
    or notice.title ilike '%' || search_text || '%'
    or notice.content ilike '%' || search_text || '%'
    or coalesce(notice.link_url, '') ilike '%' || search_text || '%'
  order by notice.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_upsert_popup_notice(
  target_notice_id uuid default null,
  next_title text default '',
  next_content text default '',
  next_link_url text default null,
  next_is_active boolean default true,
  next_starts_at timestamptz default null,
  next_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notice_id uuid;
  affected_count integer;
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if length(trim(next_title)) = 0 or length(trim(next_content)) = 0 then
    raise exception '팝업공지 제목과 내용을 입력해야 합니다.';
  end if;

  if target_notice_id is null then
    insert into public.popup_notices (
      title,
      content,
      link_url,
      is_active,
      starts_at,
      ends_at,
      created_by,
      created_at,
      updated_at
    )
    values (
      trim(next_title),
      trim(next_content),
      nullif(trim(coalesce(next_link_url, '')), ''),
      next_is_active,
      next_starts_at,
      next_ends_at,
      auth.uid(),
      now(),
      now()
    )
    returning id into notice_id;

    return notice_id;
  end if;

  update public.popup_notices
  set
    title = trim(next_title),
    content = trim(next_content),
    link_url = nullif(trim(coalesce(next_link_url, '')), ''),
    is_active = next_is_active,
    starts_at = next_starts_at,
    ends_at = next_ends_at,
    updated_at = now()
  where id = target_notice_id;

  get diagnostics affected_count = row_count;

  if affected_count = 0 then
    return null;
  end if;

  return target_notice_id;
end;
$$;

create or replace function public.admin_delete_popup_notice(target_notice_id uuid)
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

  delete from public.popup_notices
  where id = target_notice_id;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.current_user_has_super_admin_role() from public;
revoke all on function public.admin_list_user_profiles(text) from public;
revoke all on function public.admin_set_user_suspended(uuid, boolean) from public;
revoke all on function public.admin_set_user_role(uuid, text) from public;
revoke all on function public.admin_upsert_community_notice(uuid, text, text, text, boolean) from public;
revoke all on function public.admin_delete_community_notice(uuid) from public;
revoke all on function public.admin_list_popup_notices(text) from public;
revoke all on function public.admin_upsert_popup_notice(uuid, text, text, text, boolean, timestamptz, timestamptz) from public;
revoke all on function public.admin_delete_popup_notice(uuid) from public;

grant execute on function public.current_user_has_super_admin_role() to authenticated;

create or replace function public.prevent_user_profile_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_has_super_admin_role() then
    return new;
  end if;

  if tg_op = 'INSERT' and auth.uid() is not null and new.role <> 'user' then
    raise exception 'profile role cannot be set by client';
  end if;

  if tg_op = 'UPDATE'
    and auth.uid() is not null
    and new.role is distinct from old.role then
    raise exception 'profile role cannot be changed by client';
  end if;

  return new;
end;
$$;

grant execute on function public.admin_list_user_profiles(text) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean) to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_upsert_community_notice(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_community_notice(uuid) to authenticated;
grant execute on function public.admin_list_popup_notices(text) to authenticated;
grant execute on function public.admin_upsert_popup_notice(uuid, text, text, text, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_delete_popup_notice(uuid) to authenticated;

drop function if exists public.admin_list_reports(text);

create or replace function public.admin_list_reports(search_text text default '')
returns table (
  report_type text,
  report_id uuid,
  target_id uuid,
  reason text,
  reporter_id uuid,
  created_at timestamptz,
  report_count bigint,
  target_title text,
  target_content text,
  target_author text,
  is_hidden boolean,
  target_path text
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
  with community_report_rows as (
    select
      '게시글'::text as report_type,
      report.id as report_id,
      report.post_id as target_id,
      coalesce(report.reason, '사유 없음') as reason,
      report.user_id as reporter_id,
      report.created_at,
      count(*) over (partition by report.post_id) as report_count,
      post.title as target_title,
      post.content as target_content,
      post.author_nickname as target_author,
      post.is_hidden,
      '/community?post=' || post.id::text as target_path
    from public.community_reports as report
    join public.community_posts as post on post.id = report.post_id
  ),
  review_report_rows as (
    select
      '후기'::text as report_type,
      report.id as report_id,
      report.review_id as target_id,
      report.reason as reason,
      null::uuid as reporter_id,
      report.created_at,
      count(*) over (partition by report.review_id) as report_count,
      null::text as target_title,
      review.content as target_content,
      review.author_nickname as target_author,
      review.is_hidden,
      case
        when vehicle.car_number is not null then '/car/' || vehicle.car_number
        else null
      end as target_path
    from public.review_reports as report
    join public.reviews as review on review.id = report.review_id
    left join public.vehicles as vehicle on vehicle.id = review.vehicle_id
  ),
  combined_reports as (
    select * from community_report_rows
    union all
    select * from review_report_rows
  )
  select *
  from combined_reports as combined
  where coalesce(search_text, '') = ''
    or combined.reason ilike '%' || search_text || '%'
    or coalesce(combined.target_title, '') ilike '%' || search_text || '%'
    or combined.target_content ilike '%' || search_text || '%'
    or coalesce(combined.target_author, '') ilike '%' || search_text || '%'
  order by combined.report_count desc, combined.created_at desc
  limit 300;
end;
$$;

revoke all on function public.admin_list_reports(text) from public;
grant execute on function public.admin_list_reports(text) to authenticated;
