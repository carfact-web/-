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
  top_reviews jsonb,
  device_breakdown jsonb,
  browser_breakdown jsonb,
  os_breakdown jsonb,
  referrer_top jsonb,
  path_top jsonb,
  hourly_visitors jsonb,
  daily_visitors jsonb
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
  with totals as (
    select greatest(count(distinct view.session_id), 1)::numeric as visitor_total
    from public.page_views as view
  )
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
    ) as top_reviews,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'label', ranked.device_type,
            'visitor_count', ranked.visitor_count,
            'percentage', round(ranked.visitor_count::numeric * 100 / totals.visitor_total, 1)
          )
          order by ranked.visitor_count desc, ranked.device_type
        )
        from (
          select view.device_type, count(distinct view.session_id) as visitor_count
          from public.page_views as view
          group by view.device_type
        ) as ranked
      ),
      '[]'::jsonb
    ) as device_breakdown,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'label', ranked.browser,
            'visitor_count', ranked.visitor_count,
            'percentage', round(ranked.visitor_count::numeric * 100 / totals.visitor_total, 1)
          )
          order by ranked.visitor_count desc, ranked.browser
        )
        from (
          select view.browser, count(distinct view.session_id) as visitor_count
          from public.page_views as view
          group by view.browser
        ) as ranked
      ),
      '[]'::jsonb
    ) as browser_breakdown,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'label', ranked.os,
            'visitor_count', ranked.visitor_count,
            'percentage', round(ranked.visitor_count::numeric * 100 / totals.visitor_total, 1)
          )
          order by ranked.visitor_count desc, ranked.os
        )
        from (
          select view.os, count(distinct view.session_id) as visitor_count
          from public.page_views as view
          group by view.os
        ) as ranked
      ),
      '[]'::jsonb
    ) as os_breakdown,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'label', ranked.referrer_label,
            'visitor_count', ranked.visitor_count
          )
          order by ranked.visitor_count desc, ranked.referrer_label
        )
        from (
          select
            coalesce(nullif(view.referrer, ''), 'direct') as referrer_label,
            count(distinct view.session_id) as visitor_count
          from public.page_views as view
          group by coalesce(nullif(view.referrer, ''), 'direct')
          order by count(distinct view.session_id) desc
          limit 10
        ) as ranked
      ),
      '[]'::jsonb
    ) as referrer_top,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'label', ranked.path_label,
            'visitor_count', ranked.visitor_count
          )
          order by ranked.visitor_count desc, ranked.path_label
        )
        from (
          select
            coalesce(nullif(view.path, ''), 'unknown') as path_label,
            count(distinct view.session_id) as visitor_count
          from public.page_views as view
          group by coalesce(nullif(view.path, ''), 'unknown')
          order by count(distinct view.session_id) desc
          limit 10
        ) as ranked
      ),
      '[]'::jsonb
    ) as path_top,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'label', lpad(hours.hour::text, 2, '0') || ':00',
            'hour', hours.hour,
            'visitor_count', coalesce(hour_counts.visitor_count, 0)
          )
          order by hours.hour
        )
        from generate_series(0, 23) as hours(hour)
        left join (
          select
            extract(hour from timezone('Asia/Seoul', view.created_at))::integer as hour,
            count(distinct view.session_id) as visitor_count
          from public.page_views as view
          where timezone('Asia/Seoul', view.created_at)::date =
            timezone('Asia/Seoul', now())::date
          group by extract(hour from timezone('Asia/Seoul', view.created_at))::integer
        ) as hour_counts on hour_counts.hour = hours.hour
      ),
      '[]'::jsonb
    ) as hourly_visitors,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'label', to_char(days.day, 'YYYY-MM-DD'),
            'visitor_count', coalesce(day_counts.visitor_count, 0)
          )
          order by days.day
        )
        from generate_series(
          timezone('Asia/Seoul', now())::date - interval '29 days',
          timezone('Asia/Seoul', now())::date,
          interval '1 day'
        ) as days(day)
        left join (
          select
            timezone('Asia/Seoul', view.created_at)::date as day,
            count(distinct view.session_id) as visitor_count
          from public.page_views as view
          where view.created_at >= now() - interval '30 days'
          group by timezone('Asia/Seoul', view.created_at)::date
        ) as day_counts on day_counts.day = days.day::date
      ),
      '[]'::jsonb
    ) as daily_visitors
  from totals;
end;
$$;

revoke all on function public.admin_get_traffic_stats() from public;
grant execute on function public.admin_get_traffic_stats() to authenticated;

