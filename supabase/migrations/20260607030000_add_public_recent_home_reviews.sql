create or replace function public.public_get_recent_home_reviews(review_limit integer default 20)
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
  updated_at timestamptz,
  view_count bigint,
  recent_view_count bigint
)
language sql
security definer
set search_path = public
as $$
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
    review.updated_at,
    count(view.id) as view_count,
    count(view.id) filter (
      where view.created_at >= now() - interval '24 hours'
    ) as recent_view_count
  from public.reviews as review
  left join public.page_views as view
    on view.review_id = review.id
  where review.is_hidden = false
  group by review.id
  order by review.created_at desc, review.id desc
  limit greatest(1, least(coalesce(review_limit, 20), 60));
$$;

revoke all on function public.public_get_recent_home_reviews(integer) from public;
grant execute on function public.public_get_recent_home_reviews(integer) to anon;
grant execute on function public.public_get_recent_home_reviews(integer) to authenticated;
