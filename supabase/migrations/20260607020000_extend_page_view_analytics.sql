alter table public.page_views
  add column if not exists device_type text not null default 'unknown',
  add column if not exists browser text not null default 'etc',
  add column if not exists os text not null default 'etc',
  add column if not exists referrer text,
  add column if not exists path text,
  add column if not exists event_type text not null default 'page_view';

update public.page_views
set user_agent = null
where user_agent is not null;

alter table public.page_views
  drop constraint if exists page_views_device_type_check,
  drop constraint if exists page_views_event_type_check;

alter table public.page_views
  add constraint page_views_device_type_check
    check (device_type in ('mobile', 'desktop', 'tablet', 'unknown')),
  add constraint page_views_event_type_check
    check (event_type in ('page_view', 'vehicle_view', 'review_view'));

create index if not exists page_views_device_type_created_at_idx
  on public.page_views (device_type, created_at desc);

create index if not exists page_views_browser_created_at_idx
  on public.page_views (browser, created_at desc);

create index if not exists page_views_os_created_at_idx
  on public.page_views (os, created_at desc);

create index if not exists page_views_event_type_created_at_idx
  on public.page_views (event_type, created_at desc);

create index if not exists page_views_referrer_created_at_idx
  on public.page_views (referrer, created_at desc)
  where referrer is not null;

drop function if exists public.record_page_view(uuid, uuid, text, text, text);
drop function if exists public.record_page_view(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.record_page_view(
  target_vehicle_id uuid default null,
  target_review_id uuid default null,
  view_session_id text default '',
  view_ip_hash text default null,
  view_user_agent text default null,
  view_device_type text default 'unknown',
  view_browser text default 'etc',
  view_os text default 'etc',
  view_referrer text default null,
  view_path text default null,
  view_event_type text default 'page_view'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_session_id text := nullif(trim(view_session_id), '');
  resolved_vehicle_id uuid := target_vehicle_id;
  normalized_device_type text := coalesce(nullif(trim(view_device_type), ''), 'unknown');
  normalized_event_type text := coalesce(nullif(trim(view_event_type), ''), 'page_view');
  normalized_browser text := coalesce(nullif(trim(view_browser), ''), 'etc');
  normalized_os text := coalesce(nullif(trim(view_os), ''), 'etc');
  normalized_referrer text := nullif(left(trim(coalesce(view_referrer, '')), 500), '');
  normalized_path text := nullif(left(trim(coalesce(view_path, '')), 500), '');
begin
  if normalized_session_id is null then
    return false;
  end if;

  if normalized_device_type not in ('mobile', 'desktop', 'tablet', 'unknown') then
    normalized_device_type := 'unknown';
  end if;

  if normalized_event_type not in ('page_view', 'vehicle_view', 'review_view') then
    normalized_event_type := 'page_view';
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
    user_agent,
    device_type,
    browser,
    os,
    referrer,
    path,
    event_type
  )
  values (
    resolved_vehicle_id,
    target_review_id,
    auth.uid(),
    normalized_session_id,
    nullif(trim(view_ip_hash), ''),
    null,
    normalized_device_type,
    left(normalized_browser, 80),
    left(normalized_os, 80),
    normalized_referrer,
    normalized_path,
    normalized_event_type
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
  top_reviews jsonb,
  device_breakdown jsonb,
  browser_breakdown jsonb,
  os_breakdown jsonb,
  referrer_top jsonb,
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

revoke all on function public.record_page_view(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.admin_get_traffic_stats() from public;

grant execute on function public.record_page_view(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;
grant execute on function public.admin_get_traffic_stats() to authenticated;

