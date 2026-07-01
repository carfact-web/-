begin;

alter table public.page_views
  add column if not exists referrer_channel text not null default 'Direct',
  add column if not exists referrer_keyword text not null default 'not provided',
  add column if not exists landing_page text;

create index if not exists page_views_referrer_channel_created_at_idx
  on public.page_views (referrer_channel, created_at desc);

create index if not exists page_views_referrer_keyword_created_at_idx
  on public.page_views (referrer_keyword, created_at desc);

create index if not exists page_views_landing_page_created_at_idx
  on public.page_views (landing_page, created_at desc)
  where landing_page is not null;

create table if not exists public.external_acquisition_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_date date not null,
  provider text not null default 'manual',
  channel text not null default 'External',
  keyword text not null default 'not provided',
  landing_page text not null default '/',
  model_name text,
  symptom_keyword text,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  ctr numeric,
  average_position numeric,
  geo_score numeric,
  clarity_sessions bigint not null default 0,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_acquisition_metrics_provider_check
    check (provider in (
      'manual',
      'google_search_console',
      'google_analytics',
      'microsoft_clarity',
      'bing_webmaster',
      'naver_search_advisor',
      'daum_search',
      'geo'
    )),
  constraint external_acquisition_metrics_non_negative_check
    check (
      impressions >= 0
      and clicks >= 0
      and clarity_sessions >= 0
    )
);

create unique index if not exists external_acquisition_metrics_unique_idx
  on public.external_acquisition_metrics (
    provider,
    metric_date,
    channel,
    keyword,
    landing_page,
    coalesce(model_name, ''),
    coalesce(symptom_keyword, '')
  );

create index if not exists external_acquisition_metrics_date_idx
  on public.external_acquisition_metrics (metric_date desc);

create index if not exists external_acquisition_metrics_keyword_idx
  on public.external_acquisition_metrics (keyword, metric_date desc);

alter table public.external_acquisition_metrics enable row level security;

create or replace function public.url_decode_query_component(source_text text)
returns text
language plpgsql
immutable
as $$
declare
  normalized_text text := replace(coalesce(source_text, ''), '+', ' ');
  output_bytes bytea := decode('', 'hex');
  cursor_pos integer := 1;
  current_char text;
  hex_value text;
begin
  while cursor_pos <= length(normalized_text) loop
    current_char := substr(normalized_text, cursor_pos, 1);
    hex_value := substr(normalized_text, cursor_pos + 1, 2);

    if current_char = '%'
      and length(hex_value) = 2
      and hex_value ~ '^[0-9A-Fa-f]{2}$' then
      output_bytes := output_bytes || decode(hex_value, 'hex');
      cursor_pos := cursor_pos + 3;
    else
      output_bytes := output_bytes || convert_to(current_char, 'UTF8');
      cursor_pos := cursor_pos + 1;
    end if;
  end loop;

  return convert_from(output_bytes, 'UTF8');
exception
  when others then
    return normalized_text;
end;
$$;

create or replace function public.get_query_param_value(
  source_text text,
  param_names text[]
)
returns text
language plpgsql
immutable
as $$
declare
  matched text[];
  param_pattern text;
  raw_value text;
begin
  if nullif(trim(coalesce(source_text, '')), '') is null then
    return null;
  end if;

  param_pattern := '(^|[?&])(' || array_to_string(param_names, '|') || ')=([^&#]+)';
  matched := regexp_match(source_text, param_pattern, 'i');

  if matched is null then
    return null;
  end if;

  raw_value := matched[3];

  return nullif(trim(public.url_decode_query_component(raw_value)), '');
end;
$$;

create or replace function public.normalize_referrer_channel(
  referrer text,
  path text
)
returns text
language plpgsql
immutable
as $$
declare
  utm_source text := lower(coalesce(
    public.get_query_param_value(path, array['utm_source', 'source']),
    public.get_query_param_value(referrer, array['utm_source', 'source']),
    ''
  ));
  normalized_referrer text := lower(coalesce(referrer, ''));
  channel_source text;
begin
  channel_source := utm_source || ' ' || normalized_referrer;

  if nullif(trim(utm_source), '') is null
    and nullif(trim(normalized_referrer), '') is null then
    return 'Direct';
  end if;

  if normalized_referrer like '%carfact.kr%'
    or normalized_referrer like '%www.carfact.kr%'
    or normalized_referrer like '%carfact.co.kr%'
    or normalized_referrer like '%carfact-web.vercel.app%' then
    return 'Internal';
  end if;

  if channel_source like '%google%' then
    return 'Google';
  end if;

  if channel_source like '%naver%' then
    return 'Naver';
  end if;

  if channel_source like '%daum%' then
    return 'Daum';
  end if;

  if channel_source like '%bing%' then
    return 'Bing';
  end if;

  if channel_source like '%facebook%'
    or channel_source like '%instagram%'
    or channel_source like '%threads%'
    or channel_source like '%twitter%'
    or channel_source like '%x.com%'
    or channel_source like '%t.co%'
    or channel_source like '%kakao%'
    or channel_source like '%youtube%'
    or channel_source like '%linkedin%' then
    return 'SNS';
  end if;

  return 'External';
end;
$$;

create or replace function public.extract_referrer_keyword(
  referrer text,
  path text
)
returns text
language plpgsql
immutable
as $$
declare
  keyword_params text[] := array[
    'utm_term',
    'utm_keyword',
    'utm_content',
    'keyword',
    'query',
    'q',
    'search',
    'n_query',
    'p'
  ];
  extracted_keyword text;
begin
  extracted_keyword := coalesce(
    public.get_query_param_value(path, keyword_params),
    public.get_query_param_value(referrer, keyword_params)
  );

  return coalesce(nullif(lower(trim(extracted_keyword)), ''), 'not provided');
end;
$$;

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

  if normalized_event_type not in ('page_view', 'vehicle_view', 'review_view') then
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

update public.page_views
set
  referrer_channel = public.normalize_referrer_channel(referrer, path),
  referrer_keyword = public.extract_referrer_keyword(referrer, path),
  landing_page = coalesce(nullif(path, ''), '/')
where referrer_channel = 'Direct'
  or referrer_keyword = 'not provided'
  or landing_page is null;

drop function if exists public.admin_get_operator_dashboard_data();

create or replace function public.admin_get_operator_dashboard_data()
returns table (
  total_views bigint,
  traffic_rows jsonb,
  view_rankings jsonb,
  keyword_rows jsonb,
  acquisition_rows jsonb,
  search_console_summary jsonb,
  internal_keyword_rows jsonb,
  ai_candidates jsonb
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
  with traffic_days as (
    select days.day::date as day
    from generate_series(
      timezone('Asia/Seoul', now())::date - interval '6 days',
      timezone('Asia/Seoul', now())::date,
      interval '1 day'
    ) as days(day)
  ),
  traffic_rows_source as (
    select
      to_char(day_source.day, 'YYYY-MM-DD') as label,
      coalesce(count(distinct view.session_id), 0) as visitors,
      coalesce(count(view.id), 0) as views,
      coalesce(
        (
          select coalesce(nullif(inner_view.referrer_channel, ''), 'Direct')
          from public.page_views as inner_view
          where timezone('Asia/Seoul', inner_view.created_at)::date = day_source.day
          group by coalesce(nullif(inner_view.referrer_channel, ''), 'Direct')
          order by count(distinct inner_view.session_id) desc,
            coalesce(nullif(inner_view.referrer_channel, ''), 'Direct')
          limit 1
        ),
        'Direct'
      ) as top_referrer,
      count(distinct view.session_id) filter (where view.device_type = 'desktop') as pc_visitors,
      count(distinct view.session_id) filter (where view.device_type = 'mobile') as mobile_visitors,
      coalesce(
        (
          select string_agg(summary.label, ', ' order by summary.visitors desc, summary.label)
          from (
            select
              concat(coalesce(nullif(inner_view.browser, ''), 'etc'), '/', coalesce(nullif(inner_view.os, ''), 'etc')) as label,
              count(distinct inner_view.session_id) as visitors
            from public.page_views as inner_view
            where timezone('Asia/Seoul', inner_view.created_at)::date = day_source.day
            group by concat(coalesce(nullif(inner_view.browser, ''), 'etc'), '/', coalesce(nullif(inner_view.os, ''), 'etc'))
            order by count(distinct inner_view.session_id) desc
            limit 2
          ) as summary
        ),
        '기록 없음'
      ) as browser_os_summary
    from traffic_days as day_source
    left join public.page_views as view
      on timezone('Asia/Seoul', view.created_at)::date = day_source.day
    group by day_source.day
    order by day_source.day desc
  ),
  vehicle_rankings as (
    select
      'vehicle'::text as ranking_type,
      row_number() over (order by count(view.id) desc, max(view.created_at) desc, vehicle.id)::integer as rank,
      vehicle.id::text as target_id,
      coalesce(nullif(vehicle.car_number, ''), '차량번호 없음') as title,
      coalesce(nullif(master.model_detail, ''), nullif(vehicle.generation, ''), nullif(vehicle.model, ''), '차종 정보 없음') as model_name,
      count(view.id)::bigint as view_count,
      max(view.created_at) as recent_viewed_at,
      case
        when nullif(vehicle.car_number, '') is null then null
        else '/car/' || vehicle.car_number
      end as href
    from public.page_views as view
    join public.vehicles as vehicle on vehicle.id = view.vehicle_id
    left join lateral (
      select vehicle_master.model_detail
      from public.vehicle_master
      where vehicle_master.manufacturer = vehicle.manufacturer
        and (
          vehicle_master.model_detail = vehicle.generation
          or vehicle_master.model = vehicle.model
        )
      order by
        case when vehicle_master.model_detail = vehicle.generation then 0 else 1 end,
        vehicle_master.id
      limit 1
    ) as master on true
    where view.vehicle_id is not null
      and view.review_id is null
    group by vehicle.id, vehicle.car_number, vehicle.generation, vehicle.model, master.model_detail
    order by count(view.id) desc, max(view.created_at) desc, vehicle.id
    limit 10
  ),
  model_rankings as (
    select
      'model'::text as ranking_type,
      row_number() over (order by count(id) desc, max(created_at) desc, model_label)::integer as rank,
      model_label as target_id,
      model_label as title,
      model_label as model_name,
      count(id)::bigint as view_count,
      max(created_at) as recent_viewed_at,
      null::text as href
    from (
      select
        view.id,
        view.created_at,
        coalesce(nullif(master.model_detail, ''), nullif(vehicle.generation, ''), nullif(vehicle.model, ''), '모델 정보 없음') as model_label
      from public.page_views as view
      join public.vehicles as vehicle on vehicle.id = view.vehicle_id
      left join lateral (
        select vehicle_master.model_detail
        from public.vehicle_master
        where vehicle_master.manufacturer = vehicle.manufacturer
          and (
            vehicle_master.model_detail = vehicle.generation
            or vehicle_master.model = vehicle.model
          )
        order by
          case when vehicle_master.model_detail = vehicle.generation then 0 else 1 end,
          vehicle_master.id
        limit 1
      ) as master on true
      where view.vehicle_id is not null
        and view.review_id is null
    ) as model_views
    group by model_label
    order by count(id) desc, max(created_at) desc, model_label
    limit 10
  ),
  review_rankings as (
    select
      'review'::text as ranking_type,
      row_number() over (order by count(view.id) desc, max(view.created_at) desc, review.id)::integer as rank,
      review.id::text as target_id,
      coalesce(left(regexp_replace(review.content, '\\s+', ' ', 'g'), 40), '후기') as title,
      coalesce(
        nullif(review.vehicle_snapshot ->> 'model', ''),
        nullif(review.vehicle_snapshot ->> 'generation', ''),
        '차종 정보 없음'
      ) as model_name,
      count(view.id)::bigint as view_count,
      max(view.created_at) as recent_viewed_at,
      case
        when nullif(review.vehicle_snapshot ->> 'plateNumber', '') is null then null
        else '/car/' || (review.vehicle_snapshot ->> 'plateNumber')
      end as href
    from public.page_views as view
    join public.reviews as review on review.id = view.review_id
    where view.review_id is not null
    group by review.id
    order by count(view.id) desc, max(view.created_at) desc, review.id
    limit 10
  ),
  external_keyword_rows_source as (
    select
      coalesce(nullif(view.referrer_keyword, ''), 'not provided') as keyword,
      coalesce(nullif(view.referrer_channel, ''), 'Direct') as channel,
      coalesce(nullif(view.landing_page, ''), nullif(view.path, ''), '/') as landing_page,
      count(*)::bigint as visit_count,
      max(view.created_at) as recent_occurred_at
    from public.page_views as view
    where coalesce(nullif(view.referrer_channel, ''), 'Direct') <> 'Internal'
    group by
      coalesce(nullif(view.referrer_keyword, ''), 'not provided'),
      coalesce(nullif(view.referrer_channel, ''), 'Direct'),
      coalesce(nullif(view.landing_page, ''), nullif(view.path, ''), '/')
    order by count(*) desc, max(view.created_at) desc, keyword
    limit 50
  ),
  page_acquisition_rows_source as (
    select
      timezone('Asia/Seoul', view.created_at)::date as day,
      coalesce(nullif(view.referrer_keyword, ''), 'not provided') as keyword,
      coalesce(nullif(view.referrer_channel, ''), 'Direct') as channel,
      coalesce(nullif(view.landing_page, ''), nullif(view.path, ''), '/') as landing_page,
      coalesce(
        nullif(master.model_detail, ''),
        nullif(vehicle.generation, ''),
        nullif(vehicle.model, ''),
        '차종 확인 불가'
      ) as model_name,
      case
        when lower(coalesce(view.referrer_keyword, '')) ~ '(누유|오일)' then '누유'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(누수|물샘)' then '누수'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(dpf)' then 'DPF'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(스커핑|scuffing)' then '스커핑'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(엔진)' then '엔진'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(미션|변속)' then '미션'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(냉각|냉각계통|라디에이터)' then '냉각계통'
        else null
      end as symptom_keyword,
      count(*)::bigint as visits,
      0::bigint as impressions,
      0::bigint as clicks,
      null::numeric as ctr,
      null::numeric as geo_score
    from public.page_views as view
    left join public.vehicles as vehicle on vehicle.id = view.vehicle_id
    left join lateral (
      select vehicle_master.model_detail
      from public.vehicle_master
      where vehicle_master.manufacturer = vehicle.manufacturer
        and (
          vehicle_master.model_detail = vehicle.generation
          or vehicle_master.model = vehicle.model
        )
      order by
        case when vehicle_master.model_detail = vehicle.generation then 0 else 1 end,
        vehicle_master.id
      limit 1
    ) as master on true
    where coalesce(nullif(view.referrer_channel, ''), 'Direct') <> 'Internal'
    group by
      timezone('Asia/Seoul', view.created_at)::date,
      coalesce(nullif(view.referrer_keyword, ''), 'not provided'),
      coalesce(nullif(view.referrer_channel, ''), 'Direct'),
      coalesce(nullif(view.landing_page, ''), nullif(view.path, ''), '/'),
      coalesce(
        nullif(master.model_detail, ''),
        nullif(vehicle.generation, ''),
        nullif(vehicle.model, ''),
        '차종 확인 불가'
      ),
      case
        when lower(coalesce(view.referrer_keyword, '')) ~ '(누유|오일)' then '누유'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(누수|물샘)' then '누수'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(dpf)' then 'DPF'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(스커핑|scuffing)' then '스커핑'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(엔진)' then '엔진'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(미션|변속)' then '미션'
        when lower(coalesce(view.referrer_keyword, '')) ~ '(냉각|냉각계통|라디에이터)' then '냉각계통'
        else null
      end
  ),
  metric_acquisition_rows_source as (
    select
      metric.metric_date as day,
      coalesce(nullif(metric.keyword, ''), 'not provided') as keyword,
      coalesce(nullif(metric.channel, ''), 'External') as channel,
      coalesce(nullif(metric.landing_page, ''), '/') as landing_page,
      coalesce(nullif(metric.model_name, ''), '차종 확인 불가') as model_name,
      nullif(metric.symptom_keyword, '') as symptom_keyword,
      0::bigint as visits,
      sum(metric.impressions)::bigint as impressions,
      sum(metric.clicks)::bigint as clicks,
      case
        when sum(metric.impressions) > 0 then round((sum(metric.clicks)::numeric / sum(metric.impressions)::numeric) * 100, 2)
        else null
      end as ctr,
      avg(metric.geo_score) as geo_score
    from public.external_acquisition_metrics as metric
    group by
      metric.metric_date,
      coalesce(nullif(metric.keyword, ''), 'not provided'),
      coalesce(nullif(metric.channel, ''), 'External'),
      coalesce(nullif(metric.landing_page, ''), '/'),
      coalesce(nullif(metric.model_name, ''), '차종 확인 불가'),
      nullif(metric.symptom_keyword, '')
  ),
  acquisition_rows_source as (
    select * from page_acquisition_rows_source
    union all
    select * from metric_acquisition_rows_source
  ),
  search_console_summary_source as (
    select
      coalesce(sum(metric.impressions), 0)::bigint as impressions,
      coalesce(sum(metric.clicks), 0)::bigint as clicks,
      case
        when coalesce(sum(metric.impressions), 0) > 0 then round((sum(metric.clicks)::numeric / sum(metric.impressions)::numeric) * 100, 2)
        else null
      end as ctr,
      avg(metric.geo_score) as geo_score,
      max(metric.updated_at) as updated_at
    from public.external_acquisition_metrics as metric
  ),
  review_keyword_source as (
    select
      lower(trim(keyword)) as keyword,
      coalesce(
        nullif(review.vehicle_snapshot ->> 'model', ''),
        nullif(review.vehicle_snapshot ->> 'generation', ''),
        nullif(review.vehicle_snapshot ->> 'brand', ''),
        '차종 정보 없음'
      ) as related_model,
      review.created_at as occurred_at
    from public.reviews as review
    cross join lateral unnest(review.tags) as keyword
    where nullif(trim(keyword), '') is not null
  ),
  internal_keyword_rows_source as (
    select
      keyword,
      count(*)::bigint as mention_count,
      array_remove(array_agg(distinct related_model), null) as related_models,
      max(occurred_at) as recent_occurred_at
    from review_keyword_source
    where length(keyword) >= 2
    group by keyword
    having count(*) >= 10
    order by count(*) desc, max(occurred_at) desc, keyword
    limit 30
  ),
  ai_keyword_candidates as (
    select
      'keyword:' || keyword as candidate_key,
      keyword as keyword,
      mention_count,
      related_models,
      '후기 태그에서 반복 확인되어 차종별 고질병 DB 후보로 볼 수 있습니다.' as reason,
      'keyword'::text as source
    from internal_keyword_rows_source
  ),
  ai_traffic_candidates as (
    select
      'traffic:' || model_name as candidate_key,
      model_name as keyword,
      view_count as mention_count,
      array[model_name] as related_models,
      '조회수가 높은 모델입니다. 출고 전 확인 항목과 카팩트 한줄평 우선 보강 후보입니다.' as reason,
      'traffic'::text as source
    from model_rankings
    where view_count >= 10
    limit 10
  ),
  ai_candidates_source as (
    select * from ai_keyword_candidates
    union all
    select * from ai_traffic_candidates
  )
  select
    (
      select count(*)
      from public.page_views
    ) as total_views,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date', traffic_rows_source.label,
            'visitors', traffic_rows_source.visitors,
            'views', traffic_rows_source.views,
            'top_referrer', traffic_rows_source.top_referrer,
            'pc_visitors', traffic_rows_source.pc_visitors,
            'mobile_visitors', traffic_rows_source.mobile_visitors,
            'browser_os_summary', traffic_rows_source.browser_os_summary
          )
          order by traffic_rows_source.label desc
        )
        from traffic_rows_source
      ),
      '[]'::jsonb
    ) as traffic_rows,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'type', rankings.ranking_type,
            'rank', rankings.rank,
            'target_id', rankings.target_id,
            'title', rankings.title,
            'model_name', rankings.model_name,
            'view_count', rankings.view_count,
            'recent_viewed_at', rankings.recent_viewed_at,
            'href', rankings.href
          )
          order by rankings.ranking_type, rankings.rank
        )
        from (
          select * from vehicle_rankings
          union all
          select * from model_rankings
          union all
          select * from review_rankings
        ) as rankings
      ),
      '[]'::jsonb
    ) as view_rankings,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'keyword', external_keyword_rows_source.keyword,
            'channel', external_keyword_rows_source.channel,
            'visit_count', external_keyword_rows_source.visit_count,
            'landing_page', external_keyword_rows_source.landing_page,
            'recent_occurred_at', external_keyword_rows_source.recent_occurred_at
          )
          order by external_keyword_rows_source.visit_count desc,
            external_keyword_rows_source.recent_occurred_at desc,
            external_keyword_rows_source.keyword
        )
        from external_keyword_rows_source
      ),
      '[]'::jsonb
    ) as keyword_rows,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'day', acquisition.day,
            'keyword', acquisition.keyword,
            'channel', acquisition.channel,
            'landing_page', acquisition.landing_page,
            'model_name', acquisition.model_name,
            'symptom_keyword', acquisition.symptom_keyword,
            'visits', acquisition.visits,
            'impressions', acquisition.impressions,
            'clicks', acquisition.clicks,
            'ctr', acquisition.ctr,
            'geo_score', acquisition.geo_score
          )
          order by acquisition.day desc, acquisition.visits desc, acquisition.keyword
        )
        from acquisition_rows_source as acquisition
      ),
      '[]'::jsonb
    ) as acquisition_rows,
    (
      select jsonb_build_object(
        'impressions', search_console_summary_source.impressions,
        'clicks', search_console_summary_source.clicks,
        'ctr', search_console_summary_source.ctr,
        'geo_score', search_console_summary_source.geo_score,
        'updated_at', search_console_summary_source.updated_at
      )
      from search_console_summary_source
    ) as search_console_summary,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'keyword', internal_keyword_rows_source.keyword,
            'mention_count', internal_keyword_rows_source.mention_count,
            'related_models', internal_keyword_rows_source.related_models,
            'recent_occurred_at', internal_keyword_rows_source.recent_occurred_at,
            'ai_status', coalesce(status_row.status, 'pending')
          )
          order by internal_keyword_rows_source.mention_count desc,
            internal_keyword_rows_source.recent_occurred_at desc,
            internal_keyword_rows_source.keyword
        )
        from internal_keyword_rows_source
        left join public.ai_data_candidate_statuses as status_row
          on status_row.candidate_key = 'keyword:' || internal_keyword_rows_source.keyword
      ),
      '[]'::jsonb
    ) as internal_keyword_rows,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'candidate_key', candidate.candidate_key,
            'keyword', candidate.keyword,
            'mention_count', candidate.mention_count,
            'related_models', candidate.related_models,
            'reason', candidate.reason,
            'source', candidate.source,
            'status', coalesce(status_row.status, 'pending')
          )
          order by candidate.mention_count desc, candidate.keyword
        )
        from ai_candidates_source as candidate
        left join public.ai_data_candidate_statuses as status_row
          on status_row.candidate_key = candidate.candidate_key
      ),
      '[]'::jsonb
    ) as ai_candidates;
end;
$$;

revoke all on function public.url_decode_query_component(text) from public;
revoke all on function public.get_query_param_value(text, text[]) from public;
revoke all on function public.normalize_referrer_channel(text, text) from public;
revoke all on function public.extract_referrer_keyword(text, text) from public;
revoke all on function public.admin_get_operator_dashboard_data() from public;
revoke all on table public.external_acquisition_metrics from public;

grant execute on function public.admin_get_operator_dashboard_data()
  to authenticated;

notify pgrst, 'reload schema';

commit;
