delete from public.community_reports as report
using public.community_reports as duplicate
where report.post_id = duplicate.post_id
  and report.user_id = duplicate.user_id
  and report.created_at > duplicate.created_at;

create unique index if not exists community_likes_post_user_unique_idx
  on public.community_likes (post_id, user_id);

create unique index if not exists community_reports_post_user_unique_idx
  on public.community_reports (post_id, user_id);

create or replace function public.sync_community_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts
      set like_count = (
        select count(*)::integer
        from public.community_likes
        where post_id = new.post_id
      )
      where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.community_posts
      set like_count = (
        select count(*)::integer
        from public.community_likes
        where post_id = old.post_id
      )
      where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

create or replace function public.sync_community_post_report_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_posts
      set report_count = (
        select count(*)::integer
        from public.community_reports
        where post_id = new.post_id
      )
      where id = new.post_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.community_posts
      set report_count = (
        select count(*)::integer
        from public.community_reports
        where post_id = old.post_id
      )
      where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists community_likes_sync_post_count
  on public.community_likes;
create trigger community_likes_sync_post_count
  after insert or delete on public.community_likes
  for each row execute function public.sync_community_post_like_count();

drop trigger if exists community_reports_sync_post_count
  on public.community_reports;
create trigger community_reports_sync_post_count
  after insert or delete on public.community_reports
  for each row execute function public.sync_community_post_report_count();

update public.community_posts as post
  set like_count = counts.count
  from (
    select post_id, count(*)::integer as count
    from public.community_likes
    group by post_id
  ) as counts
  where post.id = counts.post_id;

update public.community_posts as post
  set report_count = counts.count
  from (
    select post_id, count(*)::integer as count
    from public.community_reports
    group by post_id
  ) as counts
  where post.id = counts.post_id;
