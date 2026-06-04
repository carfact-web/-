create or replace function public.admin_delete_community_post(target_post_id uuid)
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

  delete from public.community_posts
  where id = target_post_id;

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
  if not public.current_user_has_super_admin_role() then
    raise exception 'super_admin 권한이 필요합니다.';
  end if;

  delete from public.reviews
  where id = target_review_id;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.admin_delete_community_post(uuid) from public;
revoke all on function public.admin_delete_review(uuid) from public;

grant execute on function public.admin_delete_community_post(uuid) to authenticated;
grant execute on function public.admin_delete_review(uuid) to authenticated;
