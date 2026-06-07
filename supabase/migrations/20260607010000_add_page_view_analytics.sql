create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  review_id uuid references public.reviews(id) on delete set null,
  user_id uuid references public.user_profiles(id) on delete set null,
  session_id text not null,
  ip_hash text,
  user_agent text
);

create index if not exists page_views_created_at_idx
  on public.page_views (created_at desc);

create index if not exists page_views_vehicle_id_created_at_idx
  on public.page_views (vehicle_id, created_at desc)
  where vehicle_id is not null;

create index if not exists page_views_review_id_created_at_idx
  on public.page_views (review_id, created_at desc)
  where review_id is not null;

create index if not exists page_views_session_target_created_at_idx
  on public.page_views (session_id, vehicle_id, review_id, created_at desc);

alter table public.page_views enable row level security;

drop function if exists public.record_page_view(uuid, uuid, text, text, text);

create or replace function public.record_page_view(
  target_vehicle_id uuid default null,
  target_review_id uuid default null,
  view_session_id text default '',
  view_ip_hash text default null,
  view_user_agent text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_session_id text := nullif(trim(view_session_id), '');
  resolved_vehicle_id uuid := target_vehicle_id;
begin
  if normalized_session_id is null then
    return false;
  end if;

  if target_review_id is not null and resolved_vehicle_id is null then
    select review.vehicle_id
      into resolved_vehicle_id
    from public.reviews as review
    where review.id = target_review_id;
  end if;

  if resolved_vehicle_id is null and target_review_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.page_views as view
    where view.session_id = normalized_session_id
      and view.created_at >= now() - interval '30 minutes'
      and view.vehicle_id is not distinct from resolved_vehicle_id
      and view.review_id is not distinct from target_review_id
    limit 1
  ) then
    return false;
  end if;

  insert into public.page_views (
    vehicle_id,
    review_id,
    user_id,
    session_id,
    ip_hash,
    user_agent
  )
  values (
    resolved_vehicle_id,
    target_review_id,
    auth.uid(),
    normalized_session_id,
    nullif(trim(view_ip_hash), ''),
    nullif(left(view_user_agent, 500), '')
  );

  return true;
end;
$$;

drop function if exists public.admin_get_traffic_stats();

create or replace function public.admin_get_traffic_stats()
returns table (
  today_visitors bigint,
  seven_day_visitors bigint,
  thirty_day_visitors bigint,
  total_visitors bigint,
  today_reviews_count bigint,
  total_reviews_count bigint,
  total_users_count bigint,
  top_vehicles jsonb,
  top_reviews jsonb
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
    (
      select count(distinct view.session_id)
      from public.page_views as view
      where timezone('Asia/Seoul', view.created_at)::date =
        timezone('Asia/Seoul', now())::date
    ) as today_visitors,
    (
      select count(distinct view.session_id)
      from public.page_views as view
      where view.created_at >= now() - interval '7 days'
    ) as seven_day_visitors,
    (
      select count(distinct view.session_id)
      from public.page_views as view
      where view.created_at >= now() - interval '30 days'
    ) as thirty_day_visitors,
    (
      select count(distinct view.session_id)
      from public.page_views as view
    ) as total_visitors,
    (
      select count(*)
      from public.reviews as review
      where timezone('Asia/Seoul', review.created_at)::date =
        timezone('Asia/Seoul', now())::date
    ) as today_reviews_count,
    (
      select count(*)
      from public.reviews
    ) as total_reviews_count,
    (
      select count(*)
      from public.user_profiles
    ) as total_users_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'vehicle_id', ranked.vehicle_id,
            'view_count', ranked.view_count,
            'car_number', vehicle.car_number,
            'manufacturer', vehicle.manufacturer,
            'model', vehicle.model,
            'generation', vehicle.generation,
            'year', vehicle.year
          )
          order by ranked.view_count desc, ranked.vehicle_id
        )
        from (
          select view.vehicle_id, count(*) as view_count
          from public.page_views as view
          where view.vehicle_id is not null
            and view.review_id is null
          group by view.vehicle_id
          order by count(*) desc, view.vehicle_id
          limit 10
        ) as ranked
        left join public.vehicles as vehicle on vehicle.id = ranked.vehicle_id
      ),
      '[]'::jsonb
    ) as top_vehicles,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'review_id', ranked.review_id,
            'vehicle_id', review.vehicle_id,
            'view_count', ranked.view_count,
            'content', left(review.content, 120),
            'author_nickname', review.author_nickname,
            'car_number', review.vehicle_snapshot ->> 'plateNumber',
            'created_at', review.created_at
          )
          order by ranked.view_count desc, ranked.review_id
        )
        from (
          select view.review_id, count(*) as view_count
          from public.page_views as view
          where view.review_id is not null
          group by view.review_id
          order by count(*) desc, view.review_id
          limit 10
        ) as ranked
        left join public.reviews as review on review.id = ranked.review_id
      ),
      '[]'::jsonb
    ) as top_reviews;
end;
$$;

revoke all on table public.page_views from public;
revoke all on function public.record_page_view(uuid, uuid, text, text, text) from public;
revoke all on function public.admin_get_traffic_stats() from public;

grant execute on function public.record_page_view(uuid, uuid, text, text, text)
  to anon, authenticated;
grant execute on function public.admin_get_traffic_stats()
  to authenticated;

