alter table public.community_posts
  drop constraint if exists community_posts_category_check;

alter table public.community_posts
  add constraint community_posts_category_check
  check (
    category in (
      'developer_note',
      'free',
      'news',
      'maintenance',
      'electric',
      'imported',
      'domestic',
      'partner'
    )
  );

create or replace function public.update_community_post(
  target_post_id uuid,
  next_category text,
  next_title text,
  next_content text,
  next_images jsonb,
  next_is_notice boolean,
  next_is_pinned boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
  is_admin boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if next_category not in (
    'developer_note',
    'free',
    'news',
    'maintenance',
    'electric',
    'imported',
    'domestic',
    'partner'
  ) then
    raise exception 'invalid community category';
  end if;

  is_admin := public.current_user_has_admin_role();

  update public.community_posts
  set
    category = next_category,
    title = next_title,
    content = next_content,
    images = coalesce(next_images, '[]'::jsonb),
    is_notice = case when is_admin then coalesce(next_is_notice, false) else is_notice end,
    is_pinned = case when is_admin then coalesce(next_is_pinned, false) else is_pinned end,
    updated_at = now()
  where id = target_post_id
    and is_hidden = false
    and (
      user_id = auth.uid()
      or is_admin
    );

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.update_community_post(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  boolean
) from public;
grant execute on function public.update_community_post(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  boolean
) to authenticated;

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

  if next_category not in (
    'developer_note',
    'free',
    'maintenance',
    'news',
    'electric',
    'imported',
    'domestic',
    'partner'
  ) then
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

revoke all on function public.admin_upsert_community_notice(
  uuid,
  text,
  text,
  text,
  boolean
) from public;
grant execute on function public.admin_upsert_community_notice(
  uuid,
  text,
  text,
  text,
  boolean
) to authenticated;
