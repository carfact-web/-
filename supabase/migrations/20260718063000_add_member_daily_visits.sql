begin;

alter table public.page_views
  add column if not exists visitor_id text;

create index if not exists page_views_visitor_created_at_idx
  on public.page_views (visitor_id, created_at desc)
  where visitor_id is not null;

create table if not exists public.member_daily_visit_settings (
  id boolean primary key default true,
  exclude_super_admin boolean not null default true,
  exclude_admin boolean not null default true,
  exclude_test_accounts boolean not null default true,
  exclude_bots boolean not null default true,
  exclude_health_checks boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint member_daily_visit_settings_singleton_check check (id = true)
);

insert into public.member_daily_visit_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.member_daily_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  visit_date date not null,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  visit_count integer not null default 1,
  created_at timestamptz not null default now(),
  constraint member_daily_visits_user_date_unique unique (user_id, visit_date),
  constraint member_daily_visits_count_positive check (visit_count > 0)
);

create index if not exists member_daily_visits_user_id_idx
  on public.member_daily_visits (user_id);

create index if not exists member_daily_visits_visit_date_idx
  on public.member_daily_visits (visit_date);

create index if not exists member_daily_visits_user_id_visit_date_idx
  on public.member_daily_visits (user_id, visit_date);

alter table public.member_daily_visits enable row level security;
alter table public.member_daily_visit_settings enable row level security;

drop policy if exists "Users insert own member daily visits" on public.member_daily_visits;
create policy "Users insert own member daily visits"
  on public.member_daily_visits for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Admins read member daily visits" on public.member_daily_visits;
create policy "Admins read member daily visits"
  on public.member_daily_visits for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Admins read member daily visit settings" on public.member_daily_visit_settings;
create policy "Admins read member daily visit settings"
  on public.member_daily_visit_settings for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Admins update member daily visit settings" on public.member_daily_visit_settings;
create policy "Admins update member daily visit settings"
  on public.member_daily_visit_settings for update
  to authenticated
  using (public.current_user_has_admin_role())
  with check (public.current_user_has_admin_role());

create or replace function public.is_member_daily_visit_excluded(
  profile_role text,
  profile_nickname text,
  profile_email text,
  profile_provider_user_id text,
  exclude_super_admin boolean,
  exclude_admin boolean,
  exclude_test_accounts boolean,
  exclude_bots boolean,
  exclude_health_checks boolean
)
returns boolean
language sql
immutable
as $$
  select
    (exclude_super_admin and coalesce(profile_role, '') = 'super_admin')
    or (exclude_admin and coalesce(profile_role, '') = 'admin')
    or (
      exclude_test_accounts
      and (
        coalesce(profile_email, '') ilike '%test%'
        or coalesce(profile_email, '') ilike '%@example.%'
        or coalesce(profile_nickname, '') ilike '%test%'
        or coalesce(profile_nickname, '') ilike '%테스트%'
        or coalesce(profile_provider_user_id, '') ilike '%test%'
      )
    )
    or (
      exclude_bots
      and (
        coalesce(profile_email, '') ilike '%bot%'
        or coalesce(profile_nickname, '') ilike '%bot%'
        or coalesce(profile_provider_user_id, '') ilike '%bot%'
      )
    )
    or (
      exclude_health_checks
      and (
        coalesce(profile_email, '') ilike '%health%'
        or coalesce(profile_nickname, '') ilike '%health%'
        or coalesce(profile_provider_user_id, '') ilike '%health%'
      )
    );
$$;

create or replace function public.record_member_daily_visit(
  throttle_minutes integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  today_kst date := timezone('Asia/Seoul', now())::date;
  minimum_interval interval := make_interval(mins => greatest(coalesce(throttle_minutes, 30), 0));
  should_exclude boolean := false;
  did_record boolean := false;
begin
  if current_user_id is null then
    return false;
  end if;

  select public.is_member_daily_visit_excluded(
    profile.role,
    profile.nickname,
    coalesce(profile.email, auth_user.email),
    profile.provider_user_id,
    settings.exclude_super_admin,
    settings.exclude_admin,
    settings.exclude_test_accounts,
    settings.exclude_bots,
    settings.exclude_health_checks
  )
    into should_exclude
  from public.user_profiles as profile
  left join auth.users as auth_user on auth_user.id = profile.id
  cross join public.member_daily_visit_settings as settings
  where profile.id = current_user_id
  limit 1;

  if coalesce(should_exclude, false) then
    return false;
  end if;

  with upserted as (
    insert into public.member_daily_visits (
      user_id,
      visit_date,
      first_visited_at,
      last_visited_at,
      visit_count
    )
    values (
      current_user_id,
      today_kst,
      now(),
      now(),
      1
    )
    on conflict (user_id, visit_date) do update
      set
        last_visited_at = excluded.last_visited_at,
        visit_count = public.member_daily_visits.visit_count + 1
      where public.member_daily_visits.last_visited_at <= now() - minimum_interval
    returning true
  )
  select exists(select 1 from upserted) into did_record;

  return did_record;
end;
$$;

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
  text,
  text
);

create or replace function public.record_page_view(
  target_vehicle_id uuid default null,
  target_review_id uuid default null,
  view_session_id text default '',
  view_visitor_id text default '',
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
  normalized_visitor_id text := nullif(trim(view_visitor_id), '');
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

  if normalized_visitor_id is null then
    normalized_visitor_id := normalized_session_id;
  end if;

  if normalized_device_type not in ('mobile', 'desktop', 'tablet', 'unknown') then
    normalized_device_type := 'unknown';
  end if;

  if normalized_event_type not in (
    'ai_analysis_complete',
    'login',
    'page_view',
    'post_view',
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
    visitor_id,
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
    normalized_visitor_id,
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

drop function if exists public.admin_list_user_profiles(text);

create or replace function public.admin_list_user_profiles(search_text text default '')
returns table (
  id uuid,
  nickname text,
  nickname_changed boolean,
  nickname_change_available integer,
  role text,
  is_suspended boolean,
  is_verified_dealer boolean,
  login_provider text,
  email text,
  provider_profile_name text,
  login_profile_name text,
  provider_avatar_url text,
  provider_user_id text,
  last_sign_in_at timestamptz,
  first_visit_date date,
  recent_visit_date date,
  total_visit_days integer,
  recent_7_day_visits integer,
  recent_30_day_visits integer,
  total_visit_count integer,
  review_count integer,
  post_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  with today_source as (
    select timezone('Asia/Seoul', now())::date as today
  ),
  profile_rows as (
    select
      profile.id,
      profile.nickname,
      profile.nickname_changed,
      profile.nickname_change_available,
      profile.role,
      profile.is_suspended,
      profile.is_verified_dealer,
      coalesce(profile.login_provider, auth_user.raw_app_meta_data ->> 'provider', 'email') as login_provider,
      coalesce(profile.email, auth_user.email) as email,
      profile.provider_profile_name,
      coalesce(
        public.get_auth_user_login_profile_name(
          auth_user.raw_user_meta_data,
          coalesce(profile.login_provider, auth_user.raw_app_meta_data ->> 'provider', 'email')
        ),
        profile.provider_profile_name,
        '정보 없음'
      ) as login_profile_name,
      profile.provider_avatar_url,
      profile.provider_user_id,
      coalesce(profile.last_sign_in_at, auth_user.last_sign_in_at) as last_sign_in_at,
      visit_stats.first_visit_date,
      visit_stats.recent_visit_date,
      coalesce(visit_stats.total_visit_days, 0)::integer as total_visit_days,
      coalesce(visit_stats.recent_7_day_visits, 0)::integer as recent_7_day_visits,
      coalesce(visit_stats.recent_30_day_visits, 0)::integer as recent_30_day_visits,
      coalesce(visit_stats.total_visit_count, 0)::integer as total_visit_count,
      coalesce(review_counts.review_count, 0)::integer as review_count,
      coalesce(post_counts.post_count, 0)::integer as post_count,
      profile.created_at,
      profile.updated_at
    from public.user_profiles as profile
    left join auth.users as auth_user on auth_user.id = profile.id
    left join (
      select
        visit.user_id,
        min(visit.visit_date) as first_visit_date,
        max(visit.visit_date) as recent_visit_date,
        count(*)::integer as total_visit_days,
        count(*) filter (
          where visit.visit_date >= today_source.today - 6
        )::integer as recent_7_day_visits,
        count(*) filter (
          where visit.visit_date >= today_source.today - 29
        )::integer as recent_30_day_visits,
        coalesce(sum(visit.visit_count), 0)::integer as total_visit_count
      from public.member_daily_visits as visit
      cross join today_source
      group by visit.user_id
    ) as visit_stats on visit_stats.user_id = profile.id
    left join (
      select review.author_id as user_id, count(*)::integer as review_count
      from public.reviews as review
      where coalesce(review.is_hidden, false) = false
      group by review.author_id
    ) as review_counts on review_counts.user_id = profile.id
    left join (
      select post.user_id, count(*)::integer as post_count
      from public.community_posts as post
      where coalesce(post.is_hidden, false) = false
      group by post.user_id
    ) as post_counts on post_counts.user_id = profile.id
  )
  select
    profile.id,
    profile.nickname,
    profile.nickname_changed,
    profile.nickname_change_available,
    profile.role,
    profile.is_suspended,
    profile.is_verified_dealer,
    profile.login_provider,
    profile.email,
    profile.provider_profile_name,
    profile.login_profile_name,
    profile.provider_avatar_url,
    profile.provider_user_id,
    profile.last_sign_in_at,
    profile.first_visit_date,
    profile.recent_visit_date,
    profile.total_visit_days,
    profile.recent_7_day_visits,
    profile.recent_30_day_visits,
    profile.total_visit_count,
    profile.review_count,
    profile.post_count,
    profile.created_at,
    profile.updated_at
  from profile_rows as profile
  where coalesce(search_text, '') = ''
    or coalesce(profile.nickname, '') ilike '%' || search_text || '%'
    or coalesce(profile.login_profile_name, '') ilike '%' || search_text || '%'
    or coalesce(profile.email, '') ilike '%' || search_text || '%'
    or profile.id::text ilike '%' || search_text || '%'
    or coalesce(profile.login_provider, '') ilike '%' || search_text || '%'
    or coalesce(profile.provider_user_id, '') ilike '%' || search_text || '%'
    or profile.role ilike '%' || search_text || '%'
    or (
      profile.is_verified_dealer = true
      and '인증딜러' ilike '%' || search_text || '%'
    )
  order by profile.created_at desc
  limit 300;
end;
$$;

create or replace function public.admin_update_member_visit_exclusion_settings(
  next_exclude_super_admin boolean default null,
  next_exclude_admin boolean default null,
  next_exclude_test_accounts boolean default null,
  next_exclude_bots boolean default null,
  next_exclude_health_checks boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_settings public.member_daily_visit_settings%rowtype;
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  insert into public.member_daily_visit_settings (id)
  values (true)
  on conflict (id) do nothing;

  update public.member_daily_visit_settings
     set exclude_super_admin = coalesce(next_exclude_super_admin, exclude_super_admin),
         exclude_admin = coalesce(next_exclude_admin, exclude_admin),
         exclude_test_accounts = coalesce(next_exclude_test_accounts, exclude_test_accounts),
         exclude_bots = coalesce(next_exclude_bots, exclude_bots),
         exclude_health_checks = coalesce(next_exclude_health_checks, exclude_health_checks),
         updated_at = now()
   where id = true
   returning * into updated_settings;

  return jsonb_build_object(
    'exclude_super_admin', updated_settings.exclude_super_admin,
    'exclude_admin', updated_settings.exclude_admin,
    'exclude_test_accounts', updated_settings.exclude_test_accounts,
    'exclude_bots', updated_settings.exclude_bots,
    'exclude_health_checks', updated_settings.exclude_health_checks,
    'updated_at', updated_settings.updated_at
  );
end;
$$;

create or replace function public.admin_get_analytics_dashboard_data()
returns table (
  analytics_summary jsonb,
  popular_page_rows jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  with today_source as (
    select timezone('Asia/Seoul', now())::date as today
  ),
  member_visit_settings as (
    select *
    from public.member_daily_visit_settings
    where id = true
  ),
  eligible_profiles as (
    select profile.id, profile.last_sign_in_at, auth_user.last_sign_in_at as auth_last_sign_in_at
    from public.user_profiles as profile
    left join auth.users as auth_user on auth_user.id = profile.id
    cross join member_visit_settings as settings
    where not public.is_member_daily_visit_excluded(
      profile.role,
      profile.nickname,
      coalesce(profile.email, auth_user.email),
      profile.provider_user_id,
      settings.exclude_super_admin,
      settings.exclude_admin,
      settings.exclude_test_accounts,
      settings.exclude_bots,
      settings.exclude_health_checks
    )
  ),
  member_visit_rollup as (
    select
      visit.user_id,
      count(*)::integer as total_visit_days
    from public.member_daily_visits as visit
    join eligible_profiles as profile on profile.id = visit.user_id
    group by visit.user_id
  ),
  member_visit_summary as (
    select
      (
        select count(*)::bigint
        from eligible_profiles as profile
        join today_source
          on timezone('Asia/Seoul', coalesce(profile.last_sign_in_at, profile.auth_last_sign_in_at))::date = today_source.today
      ) as today_login_members,
      (
        select count(*)::bigint
        from public.member_daily_visits as visit
        join today_source on visit.visit_date = today_source.today
        join member_visit_rollup as rollup
          on rollup.user_id = visit.user_id
        where rollup.total_visit_days = 1
      ) as today_new_member_visits,
      (
        select count(*)::bigint
        from public.member_daily_visits as visit
        join today_source on visit.visit_date = today_source.today
        join member_visit_rollup as rollup
          on rollup.user_id = visit.user_id
        where rollup.total_visit_days >= 2
      ) as today_returning_members,
      (
        select count(distinct visit.user_id)::bigint
        from public.member_daily_visits as visit
        join today_source on visit.visit_date >= today_source.today - 6
        join member_visit_rollup as rollup
          on rollup.user_id = visit.user_id
        where rollup.total_visit_days >= 2
      ) as seven_day_returning_members,
      (
        select count(*)::bigint
        from public.member_daily_visits as visit
        join today_source on visit.visit_date = today_source.today
        join eligible_profiles as profile on profile.id = visit.user_id
      ) as today_visit_members
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
        'today_login_members',
          coalesce(member_visit_summary.today_login_members, 0),
        'today_new_member_visits',
          coalesce(member_visit_summary.today_new_member_visits, 0),
        'today_returning_members',
          coalesce(member_visit_summary.today_returning_members, 0),
        'today_member_return_rate',
          case
            when coalesce(member_visit_summary.today_visit_members, 0) = 0 then 0
            else round(
              (member_visit_summary.today_returning_members::numeric
                / member_visit_summary.today_visit_members::numeric) * 100,
              1
            )
          end,
        'seven_day_returning_members',
          coalesce(member_visit_summary.seven_day_returning_members, 0),
        'member_visit_exclusion',
          jsonb_build_object(
            'exclude_super_admin', member_visit_settings.exclude_super_admin,
            'exclude_admin', member_visit_settings.exclude_admin,
            'exclude_test_accounts', member_visit_settings.exclude_test_accounts,
            'exclude_bots', member_visit_settings.exclude_bots,
            'exclude_health_checks', member_visit_settings.exclude_health_checks,
            'updated_at', member_visit_settings.updated_at
          ),
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
      from external_today, internal_today, connection_status, member_visit_summary, member_visit_settings
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

revoke all on table public.member_daily_visits from public;
revoke all on table public.member_daily_visit_settings from public;
revoke all on function public.is_member_daily_visit_excluded(
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) from public;
revoke all on function public.record_member_daily_visit(integer) from public;
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
  text,
  text
) from public;
revoke all on function public.admin_list_user_profiles(text) from public;
revoke all on function public.admin_update_member_visit_exclusion_settings(
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) from public;
revoke all on function public.admin_get_analytics_dashboard_data() from public;

grant execute on function public.record_member_daily_visit(integer) to authenticated;
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
  text,
  text
) to anon, authenticated;
grant execute on function public.admin_list_user_profiles(text) to authenticated;
grant execute on function public.admin_update_member_visit_exclusion_settings(
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) to authenticated;
grant execute on function public.admin_get_analytics_dashboard_data()
  to authenticated;

notify pgrst, 'reload schema';

commit;
