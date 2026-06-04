create or replace function public.admin_get_dashboard_stats()
returns table (
  users_count bigint,
  community_posts_count bigint,
  reviews_count bigint,
  comments_count bigint,
  reports_count bigint
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
    (select count(*) from public.user_profiles),
    (select count(*) from public.community_posts),
    (select count(*) from public.reviews),
    (select count(*) from public.community_comments),
    (select count(*) from public.community_reports) +
      (select count(*) from public.review_reports);
end;
$$;

create or replace function public.admin_list_community_posts(search_text text default '')
returns table (
  id uuid,
  category text,
  title text,
  content text,
  user_id uuid,
  author_nickname text,
  images jsonb,
  is_hidden boolean,
  is_notice boolean,
  is_pinned boolean,
  report_count integer,
  like_count integer,
  comment_count integer,
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
    post.id,
    post.category,
    post.title,
    post.content,
    post.user_id,
    post.author_nickname,
    post.images,
    post.is_hidden,
    post.is_notice,
    post.is_pinned,
    post.report_count,
    post.like_count,
    post.comment_count,
    post.created_at,
    post.updated_at
  from public.community_posts as post
  where coalesce(search_text, '') = ''
    or post.title ilike '%' || search_text || '%'
    or post.content ilike '%' || search_text || '%'
    or coalesce(post.author_nickname, '') ilike '%' || search_text || '%'
  order by post.created_at desc
  limit 200;
end;
$$;

create or replace function public.admin_set_community_post_state(
  target_post_id uuid,
  next_is_hidden boolean default null,
  next_is_notice boolean default null,
  next_is_pinned boolean default null
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

  update public.community_posts
  set
    is_hidden = coalesce(next_is_hidden, is_hidden),
    is_notice = coalesce(next_is_notice, is_notice),
    is_pinned = coalesce(next_is_pinned, is_pinned),
    updated_at = now()
  where id = target_post_id;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

create or replace function public.admin_delete_community_post(target_post_id uuid)
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
  where id = target_post_id;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

create or replace function public.admin_list_reviews(search_text text default '')
returns table (
  id uuid,
  vehicle_id uuid,
  author_id uuid,
  author_nickname text,
  content text,
  tags text[],
  images jsonb,
  vehicle_snapshot jsonb,
  helpful_count integer,
  report_count integer,
  is_hidden boolean,
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
    review.id,
    review.vehicle_id,
    review.author_id,
    review.author_nickname,
    review.content,
    review.tags,
    review.images,
    review.vehicle_snapshot,
    0::integer as helpful_count,
    review.report_count,
    review.is_hidden,
    review.created_at,
    review.updated_at
  from public.reviews as review
  where coalesce(search_text, '') = ''
    or review.content ilike '%' || search_text || '%'
    or coalesce(review.author_nickname, '') ilike '%' || search_text || '%'
    or review.vehicle_snapshot::text ilike '%' || search_text || '%'
  order by review.created_at desc
  limit 200;
end;
$$;

create or replace function public.admin_set_review_hidden(
  target_review_id uuid,
  next_is_hidden boolean
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

  update public.reviews
  set
    is_hidden = next_is_hidden,
    updated_at = now()
  where id = target_review_id;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

create or replace function public.admin_delete_review(target_review_id uuid)
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

  delete from public.reviews
  where id = target_review_id;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

create or replace function public.admin_list_user_profiles(search_text text default '')
returns table (
  id uuid,
  nickname text,
  nickname_changed boolean,
  role text,
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
  is_hidden boolean
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
      post.is_hidden
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
      review.is_hidden
    from public.review_reports as report
    join public.reviews as review on review.id = report.review_id
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

revoke all on function public.admin_get_dashboard_stats() from public;
revoke all on function public.admin_list_community_posts(text) from public;
revoke all on function public.admin_set_community_post_state(uuid, boolean, boolean, boolean) from public;
revoke all on function public.admin_delete_community_post(uuid) from public;
revoke all on function public.admin_list_reviews(text) from public;
revoke all on function public.admin_set_review_hidden(uuid, boolean) from public;
revoke all on function public.admin_delete_review(uuid) from public;
revoke all on function public.admin_list_user_profiles(text) from public;
revoke all on function public.admin_list_reports(text) from public;

grant execute on function public.admin_get_dashboard_stats() to authenticated;
grant execute on function public.admin_list_community_posts(text) to authenticated;
grant execute on function public.admin_set_community_post_state(uuid, boolean, boolean, boolean) to authenticated;
grant execute on function public.admin_delete_community_post(uuid) to authenticated;
grant execute on function public.admin_list_reviews(text) to authenticated;
grant execute on function public.admin_set_review_hidden(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_review(uuid) to authenticated;
grant execute on function public.admin_list_user_profiles(text) to authenticated;
grant execute on function public.admin_list_reports(text) to authenticated;
