create or replace function public.hide_own_community_post(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.community_posts
  set
    is_hidden = true,
    updated_at = now()
  where id = target_post_id
    and user_id = auth.uid()
    and is_hidden = false;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.hide_own_community_post(uuid) from public;
grant execute on function public.hide_own_community_post(uuid) to authenticated;
