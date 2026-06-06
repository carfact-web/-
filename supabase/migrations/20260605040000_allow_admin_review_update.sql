create or replace function public.update_review(
  target_review_id uuid,
  next_content text,
  next_tags text[],
  next_images jsonb
)
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

  update public.reviews
  set
    content = next_content,
    tags = coalesce(next_tags, '{}'::text[]),
    images = coalesce(next_images, '[]'::jsonb),
    updated_at = now()
  where id = target_review_id
    and is_hidden = false
    and (
      author_id = auth.uid()
      or public.current_user_has_admin_role()
    );

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.update_review(uuid, text, text[], jsonb) from public;
grant execute on function public.update_review(uuid, text, text[], jsonb) to authenticated;

notify pgrst, 'reload schema';
