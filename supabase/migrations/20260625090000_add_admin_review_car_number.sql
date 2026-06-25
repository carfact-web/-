drop function if exists public.admin_list_reviews(text);

create or replace function public.admin_list_reviews(search_text text default '')
returns table (
  id uuid,
  vehicle_id uuid,
  car_number text,
  author_id uuid,
  author_nickname text,
  title text,
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
    vehicle.car_number,
    review.author_id,
    review.author_nickname,
    review.title,
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
  left join public.vehicles as vehicle on vehicle.id = review.vehicle_id
  where coalesce(search_text, '') = ''
    or review.content ilike '%' || search_text || '%'
    or coalesce(review.author_nickname, '') ilike '%' || search_text || '%'
    or coalesce(review.title, '') ilike '%' || search_text || '%'
    or coalesce(vehicle.car_number, '') ilike '%' || search_text || '%'
    or review.vehicle_snapshot::text ilike '%' || search_text || '%'
  order by review.created_at desc
  limit 200;
end;
$$;

revoke all on function public.admin_list_reviews(text) from public;
grant execute on function public.admin_list_reviews(text) to authenticated;

notify pgrst, 'reload schema';
