alter table public.reviews
  add column if not exists title text;

update public.reviews
set title = left(regexp_replace(coalesce(content, ''), '\s+', ' ', 'g'), 60)
where title is null
  or length(trim(title)) = 0;

alter table public.reviews
  alter column title set default '차량 후기';

create or replace function public.update_review(
  target_review_id uuid,
  next_title text,
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
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.reviews
  set
    title = left(coalesce(nullif(trim(next_title), ''), '차량 후기'), 60),
    content = next_content,
    tags = coalesce(next_tags, '{}'),
    images = coalesce(next_images, '[]'::jsonb),
    updated_at = now()
  where id = target_review_id
    and (
      author_id = current_user_id
      or public.current_user_has_admin_role()
    );

  return found;
end;
$$;

revoke all on function public.update_review(uuid, text, text, text[], jsonb)
  from public;
grant execute on function public.update_review(uuid, text, text, text[], jsonb)
  to authenticated;

create or replace function public.public_get_recent_home_reviews(
  review_limit integer default 20
)
returns table (
  id uuid,
  vehicle_id uuid,
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
    review.title,
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
      where view.created_at >= now() - interval '7 days'
    ) as recent_view_count
  from public.reviews as review
  left join public.page_views as view
    on view.review_id = review.id
  where review.is_hidden = false
  group by review.id
  order by review.created_at desc, review.id desc
  limit greatest(1, least(coalesce(review_limit, 20), 60));
$$;

revoke all on function public.public_get_recent_home_reviews(integer)
  from public;
grant execute on function public.public_get_recent_home_reviews(integer) to anon;
grant execute on function public.public_get_recent_home_reviews(integer)
  to authenticated;

create or replace function public.get_vehicle_review_keyword_stats(
  target_vehicle_id uuid,
  minimum_review_count integer default 10
)
returns table (
  keyword text,
  mention_count bigint,
  mention_rate numeric
)
language sql
security definer
set search_path = public
as $$
  with visible_reviews as (
    select
      review.id,
      regexp_replace(
        lower(coalesce(review.title, '') || ' ' || coalesce(review.content, '')),
        '[^0-9a-z가-힣]+',
        '',
        'g'
      ) as normalized_text
    from public.reviews as review
    where review.vehicle_id = target_vehicle_id
      and review.is_hidden = false
  ),
  review_count as (
    select count(*) as total_count
    from visible_reviews
  ),
  keyword_aliases(keyword, aliases) as (
    values
      ('냉간시동 소음', array['냉간시동', '냉간소음', '시동소음']),
      ('냉각계통 문제', array['냉각수', '냉각수감소', '냉각수누수', '워터펌프', '서모스탯']),
      ('미션 충격', array['미션충격', '변속충격', '저속울컥']),
      ('하체 소음', array['하체소음', '하체잡소리', '로어암']),
      ('배터리 방전', array['배터리방전', 'agm']),
      ('터보 계통', array['터보', '터보차저', '부스트', '웨이스트게이트']),
      ('오일 누유', array['오일누유', '엔진오일누유', '누유']),
      ('엔진 떨림', array['엔진떨림', '공회전떨림', '실화', '부조']),
      ('에어컨 문제', array['에어컨', '컴프레서', '냉방', '공조']),
      ('허브베어링 소음', array['허브베어링', '웅웅', '주행소음'])
  )
  select
    keyword_aliases.keyword,
    count(visible_reviews.id) as mention_count,
    round(
      count(visible_reviews.id)::numeric /
        nullif(max(review_count.total_count), 0)::numeric * 100,
      1
    ) as mention_rate
  from keyword_aliases
  cross join review_count
  join visible_reviews
    on review_count.total_count >= greatest(1, coalesce(minimum_review_count, 10))
   and exists (
     select 1
     from unnest(keyword_aliases.aliases) as alias
     where visible_reviews.normalized_text like '%' || lower(alias) || '%'
   )
  group by keyword_aliases.keyword
  having count(visible_reviews.id) > 0
  order by mention_count desc, keyword_aliases.keyword;
$$;

revoke all on function public.get_vehicle_review_keyword_stats(uuid, integer)
  from public;
grant execute on function public.get_vehicle_review_keyword_stats(uuid, integer)
  to anon;
grant execute on function public.get_vehicle_review_keyword_stats(uuid, integer)
  to authenticated;
