alter table public.reviews
  add column if not exists helpful_count integer not null default 0;

create or replace function public.set_review_helpful_count(
  target_review_id uuid,
  p_helpful_count integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  update public.reviews
  set
    helpful_count = greatest(coalesce(p_helpful_count, 0), 0),
    updated_at = now()
  where id = target_review_id
    and is_hidden = false;

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

drop function if exists public.admin_list_reviews(text);

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
    review.helpful_count,
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

revoke all on function public.set_review_helpful_count(uuid, integer) from public;
revoke all on function public.admin_list_reviews(text) from public;

grant execute on function public.set_review_helpful_count(uuid, integer) to anon;
grant execute on function public.set_review_helpful_count(uuid, integer) to authenticated;
grant execute on function public.admin_list_reviews(text) to authenticated;

notify pgrst, 'reload schema';
