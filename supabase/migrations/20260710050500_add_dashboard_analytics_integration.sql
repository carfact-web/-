begin;

alter table public.page_views
  drop constraint if exists page_views_event_type_check;

alter table public.page_views
  add constraint page_views_event_type_check
    check (
      event_type in (
        'page_view',
        'vehicle_view',
        'review_view',
        'vehicle_search',
        'review_create',
        'sign_up'
      )
    );

create table if not exists public.external_analytics_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  provider text not null default 'google_analytics',
  visitors bigint not null default 0,
  page_views bigint not null default 0,
  new_visitors bigint not null default 0,
  returning_visitors bigint not null default 0,
  average_engagement_seconds numeric,
  signups bigint not null default 0,
  reviews bigint not null default 0,
  vehicle_searches bigint not null default 0,
  realtime_active_users bigint,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_analytics_daily_metrics_provider_check
    check (provider in ('manual', 'google_analytics', 'google_search_console')),
  constraint external_analytics_daily_metrics_non_negative_check
    check (
      visitors >= 0
      and page_views >= 0
      and new_visitors >= 0
      and returning_visitors >= 0
      and signups >= 0
      and reviews >= 0
      and vehicle_searches >= 0
      and coalesce(realtime_active_users, 0) >= 0
    )
);

create unique index if not exists external_analytics_daily_metrics_unique_idx
  on public.external_analytics_daily_metrics (provider, metric_date);

create index if not exists external_analytics_daily_metrics_date_idx
  on public.external_analytics_daily_metrics (metric_date desc);

create table if not exists public.external_analytics_top_pages (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  provider text not null default 'google_analytics',
  page_path text not null,
  page_title text,
  visitors bigint not null default 0,
  page_views bigint not null default 0,
  average_engagement_seconds numeric,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_analytics_top_pages_provider_check
    check (provider in ('manual', 'google_analytics', 'google_search_console')),
  constraint external_analytics_top_pages_non_negative_check
    check (visitors >= 0 and page_views >= 0)
);

create unique index if not exists external_analytics_top_pages_unique_idx
  on public.external_analytics_top_pages (provider, metric_date, page_path);

create index if not exists external_analytics_top_pages_date_idx
  on public.external_analytics_top_pages (metric_date desc, page_views desc);

create table if not exists public.external_analytics_realtime_metrics (
  provider text primary key,
  active_users bigint not null default 0,
  top_pages jsonb not null default '[]'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_analytics_realtime_metrics_provider_check
    check (provider in ('manual', 'google_analytics')),
  constraint external_analytics_realtime_metrics_non_negative_check
    check (active_users >= 0)
);

alter table public.external_analytics_daily_metrics enable row level security;
alter table public.external_analytics_top_pages enable row level security;
alter table public.external_analytics_realtime_metrics enable row level security;

create index if not exists page_views_event_type_path_created_at_idx
  on public.page_views (event_type, path, created_at desc);

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
  normalized_channel text;
  normalized_keyword text;
  normalized_landing_page text;
begin
  if normalized_session_id is null then
    return false;
  end if;

  if normalized_device_type not in ('mobile', 'desktop', 'tablet', 'unknown') then
    normalized_device_type := 'unknown';
  end if;

  if normalized_event_type not in (
    'page_view',
    'vehicle_view',
    'review_view',
    'vehicle_search',
    'review_create',
    'sign_up'
  ) then
    normalized_event_type := 'page_view';
  end if;

  if target_review_id is not null and resolved_vehicle_id is null then
    select review.vehicle_id
      into resolved_vehicle_id
    from public.reviews as review
    where review.id = target_review_id;
  end if;

  if resolved_vehicle_id is null
    and target_review_id is null
    and normalized_path is null
    and normalized_referrer is null then
    return false;
  end if;

  normalized_channel := public.normalize_referrer_channel(normalized_referrer, normalized_path);
  normalized_keyword := public.extract_referrer_keyword(normalized_referrer, normalized_path);
  normalized_landing_page := coalesce(normalized_path, '/');

  if exists (
    select 1
    from public.page_views as view
    where view.session_id = normalized_session_id
      and view.created_at >= now() - interval '30 minutes'
      and view.vehicle_id is not distinct from resolved_vehicle_id
      and view.review_id is not distinct from target_review_id
      and view.event_type = normalized_event_type
      and view.path is not distinct from normalized_path
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
    event_type,
    referrer_channel,
    referrer_keyword,
    landing_page
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
    normalized_event_type,
    normalized_channel,
    normalized_keyword,
    normalized_landing_page
  );

  return true;
end;
$$;

create or replace function public.admin_get_analytics_dashboard_data()
returns table (
  analytics_summary jsonb,
  popular_page_rows jsonb
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
  with today_source as (
    select timezone('Asia/Seoul', now())::date as today
  ),
  external_today as (
    select
      coalesce(sum(metric.visitors), 0)::bigint as visitors,
      coalesce(sum(metric.page_views), 0)::bigint as page_views,
      coalesce(sum(metric.new_visitors), 0)::bigint as new_visitors,
      coalesce(sum(metric.returning_visitors), 0)::bigint as returning_visitors,
      avg(metric.average_engagement_seconds) filter (
        where metric.average_engagement_seconds is not null
      ) as average_engagement_seconds,
      coalesce(sum(metric.signups), 0)::bigint as signups,
      coalesce(sum(metric.reviews), 0)::bigint as reviews,
      coalesce(sum(metric.vehicle_searches), 0)::bigint as vehicle_searches,
      max(metric.realtime_active_users) as realtime_active_users,
      max(metric.updated_at) as updated_at
    from public.external_analytics_daily_metrics as metric
    join today_source on metric.metric_date = today_source.today
    where metric.provider in ('google_analytics', 'manual')
  ),
  internal_today as (
    select
      (
        select count(distinct view.session_id)
        from public.page_views as view
        join today_source
          on timezone('Asia/Seoul', view.created_at)::date = today_source.today
      )::bigint as visitors,
      (
        select count(*)
        from public.page_views as view
        join today_source
          on timezone('Asia/Seoul', view.created_at)::date = today_source.today
        where view.event_type = 'page_view'
      )::bigint as page_views,
      (
        select count(*)
        from public.user_profiles as profile
        join today_source
          on timezone('Asia/Seoul', profile.created_at)::date = today_source.today
      )::bigint as signups,
      (
        select count(*)
        from public.reviews as review
        join today_source
          on timezone('Asia/Seoul', review.created_at)::date = today_source.today
      )::bigint as reviews,
      (
        select count(*)
        from public.page_views as view
        join today_source
          on timezone('Asia/Seoul', view.created_at)::date = today_source.today
        where view.event_type in ('vehicle_view', 'vehicle_search')
      )::bigint as vehicle_searches
  ),
  realtime_source as (
    select
      metric.active_users,
      metric.updated_at
    from public.external_analytics_realtime_metrics as metric
    where metric.provider = 'google_analytics'
      and metric.updated_at >= now() - interval '10 minutes'
    order by metric.updated_at desc
    limit 1
  ),
  external_page_rows as (
    select
      coalesce(nullif(top_page.page_path, ''), '/') as page_path,
      nullif(top_page.page_title, '') as page_title,
      sum(top_page.visitors)::bigint as visitors,
      sum(top_page.page_views)::bigint as page_views,
      avg(top_page.average_engagement_seconds) filter (
        where top_page.average_engagement_seconds is not null
      ) as average_engagement_seconds,
      max(top_page.updated_at) as updated_at
    from public.external_analytics_top_pages as top_page
    join today_source on top_page.metric_date = today_source.today
    where top_page.provider in ('google_analytics', 'google_search_console', 'manual')
    group by coalesce(nullif(top_page.page_path, ''), '/'), nullif(top_page.page_title, '')
  ),
  internal_page_rows as (
    select
      coalesce(nullif(view.path, ''), '/') as page_path,
      null::text as page_title,
      count(distinct view.session_id)::bigint as visitors,
      count(*)::bigint as page_views,
      null::numeric as average_engagement_seconds,
      max(view.created_at) as updated_at
    from public.page_views as view
    join today_source
      on timezone('Asia/Seoul', view.created_at)::date = today_source.today
    where view.event_type = 'page_view'
    group by coalesce(nullif(view.path, ''), '/')
  ),
  selected_page_rows as (
    select
      'external'::text as source,
      page_path,
      page_title,
      visitors,
      page_views,
      average_engagement_seconds,
      updated_at
    from external_page_rows
    where exists (select 1 from external_page_rows)
    union all
    select
      'internal'::text as source,
      page_path,
      page_title,
      visitors,
      page_views,
      average_engagement_seconds,
      updated_at
    from internal_page_rows
    where not exists (select 1 from external_page_rows)
  ),
  connection_status as (
    select
      exists (
        select 1
        from public.external_analytics_daily_metrics
        where provider = 'google_analytics'
      ) or exists (
        select 1
        from public.external_analytics_realtime_metrics
        where provider = 'google_analytics'
      ) as is_ga4_connected,
      exists (
        select 1
        from public.external_acquisition_metrics
        where provider = 'google_search_console'
      ) or exists (
        select 1
        from public.external_analytics_top_pages
        where provider = 'google_search_console'
      ) as is_search_console_connected
  )
  select
    (
      select jsonb_build_object(
        'today_visitors',
          coalesce(nullif(external_today.visitors, 0), internal_today.visitors),
        'today_page_views',
          coalesce(nullif(external_today.page_views, 0), internal_today.page_views),
        'new_visitors',
          coalesce(external_today.new_visitors, 0),
        'returning_visitors',
          coalesce(external_today.returning_visitors, 0),
        'average_engagement_seconds',
          external_today.average_engagement_seconds,
        'today_signups',
          coalesce(nullif(external_today.signups, 0), internal_today.signups),
        'today_reviews',
          coalesce(nullif(external_today.reviews, 0), internal_today.reviews),
        'vehicle_searches',
          coalesce(nullif(external_today.vehicle_searches, 0), internal_today.vehicle_searches),
        'realtime_active_users',
          coalesce(
            (select realtime_source.active_users from realtime_source),
            external_today.realtime_active_users
          ),
        'is_ga4_connected',
          connection_status.is_ga4_connected,
        'is_search_console_connected',
          connection_status.is_search_console_connected,
        'updated_at',
          greatest(
            external_today.updated_at,
            (select realtime_source.updated_at from realtime_source)
          ),
        'source',
          case
            when connection_status.is_ga4_connected then 'google_analytics'
            else 'internal'
          end
      )
      from external_today, internal_today, connection_status
    ) as analytics_summary,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'rank', ranked.rank,
            'page_path', ranked.page_path,
            'page_title', ranked.page_title,
            'visitors', ranked.visitors,
            'page_views', ranked.page_views,
            'average_engagement_seconds', ranked.average_engagement_seconds,
            'updated_at', ranked.updated_at,
            'source', ranked.source
          )
          order by ranked.rank
        )
        from (
          select
            row_number() over (
              order by page_views desc, visitors desc, page_path
            )::integer as rank,
            *
          from selected_page_rows
          order by page_views desc, visitors desc, page_path
          limit 10
        ) as ranked
      ),
      '[]'::jsonb
    ) as popular_page_rows;
end;
$$;

revoke all on table public.external_analytics_daily_metrics from public;
revoke all on table public.external_analytics_top_pages from public;
revoke all on table public.external_analytics_realtime_metrics from public;
revoke all on function public.admin_get_analytics_dashboard_data() from public;

grant execute on function public.admin_get_analytics_dashboard_data()
  to authenticated;

notify pgrst, 'reload schema';

commit;
