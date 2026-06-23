begin;

create table if not exists public.ai_data_candidate_statuses (
  candidate_key text primary key,
  candidate_keyword text not null,
  source text not null default 'mixed'
    check (source in ('traffic', 'review', 'keyword', 'mixed')),
  related_models text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'reviewing', 'applied', 'excluded')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.ai_data_candidate_statuses enable row level security;

create index if not exists ai_data_candidate_statuses_status_updated_at_idx
  on public.ai_data_candidate_statuses (status, updated_at desc);

create or replace function public.admin_set_ai_candidate_status(
  candidate_key text,
  candidate_keyword text,
  candidate_source text,
  related_models text[] default '{}',
  next_status text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_key text := nullif(trim(candidate_key), '');
  normalized_keyword text := nullif(trim(candidate_keyword), '');
  normalized_source text := coalesce(nullif(trim(candidate_source), ''), 'mixed');
  normalized_status text := coalesce(nullif(trim(next_status), ''), 'pending');
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if normalized_key is null or normalized_keyword is null then
    raise exception '후보 키워드 정보가 필요합니다.';
  end if;

  if normalized_source not in ('traffic', 'review', 'keyword', 'mixed') then
    normalized_source := 'mixed';
  end if;

  if normalized_status not in ('pending', 'reviewing', 'applied', 'excluded') then
    raise exception '지원하지 않는 상태값입니다.';
  end if;

  insert into public.ai_data_candidate_statuses (
    candidate_key,
    candidate_keyword,
    source,
    related_models,
    status,
    updated_by,
    updated_at
  )
  values (
    normalized_key,
    normalized_keyword,
    normalized_source,
    coalesce(related_models, '{}'),
    normalized_status,
    auth.uid(),
    now()
  )
  on conflict (candidate_key) do update
  set
    candidate_keyword = excluded.candidate_keyword,
    source = excluded.source,
    related_models = excluded.related_models,
    status = excluded.status,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  return (
    select jsonb_build_object(
      'candidate_key', status_row.candidate_key,
      'candidate_keyword', status_row.candidate_keyword,
      'source', status_row.source,
      'related_models', status_row.related_models,
      'status', status_row.status,
      'updated_at', status_row.updated_at
    )
    from public.ai_data_candidate_statuses as status_row
    where status_row.candidate_key = normalized_key
  );
end;
$$;

create or replace function public.admin_get_operator_dashboard_data()
returns table (
  total_views bigint,
  traffic_rows jsonb,
  view_rankings jsonb,
  keyword_rows jsonb,
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
          select coalesce(nullif(inner_view.referrer, ''), 'direct')
          from public.page_views as inner_view
          where timezone('Asia/Seoul', inner_view.created_at)::date = day_source.day
          group by coalesce(nullif(inner_view.referrer, ''), 'direct')
          order by count(distinct inner_view.session_id) desc,
            coalesce(nullif(inner_view.referrer, ''), 'direct')
          limit 1
        ),
        'direct'
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
  review_keyword_source as (
    select
      lower(trim(keyword)) as keyword,
      coalesce(
        nullif(review.vehicle_snapshot ->> 'model', ''),
        nullif(review.vehicle_snapshot ->> 'generation', ''),
        nullif(review.vehicle_snapshot ->> 'brand', ''),
        '차종 정보 없음'
      ) as related_model,
      review.created_at as occurred_at,
      'review'::text as source
    from public.reviews as review
    cross join lateral unnest(review.tags) as keyword
    where nullif(trim(keyword), '') is not null
  ),
  traffic_keyword_source as (
    select
      lower(trim(replace(match.matches[3], '+', ' '))) as keyword,
      coalesce(nullif(vehicle.model, ''), nullif(vehicle.generation, ''), '차종 정보 없음') as related_model,
      view.created_at as occurred_at,
      'keyword'::text as source
    from public.page_views as view
    left join public.vehicles as vehicle on vehicle.id = view.vehicle_id
    cross join lateral regexp_match(
      coalesce(view.path, '') || '&' || coalesce(view.referrer, ''),
      '(^|[?&])(q|query|keyword|search)=([^&]+)'
    ) as match(matches)
    where nullif(trim(match.matches[3]), '') is not null
  ),
  keyword_source as (
    select * from review_keyword_source
    union all
    select * from traffic_keyword_source
  ),
  keyword_rows_source as (
    select
      keyword,
      count(*)::bigint as mention_count,
      array_remove(array_agg(distinct related_model), null) as related_models,
      max(occurred_at) as recent_occurred_at,
      bool_or(source = 'keyword') as has_search_signal,
      bool_or(source = 'review') as has_review_signal
    from keyword_source
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
      case
        when has_search_signal and has_review_signal then '검색 유입과 후기에서 함께 반복 언급되어 한줄평/출고 전 확인 항목 개선 후보입니다.'
        when has_search_signal then '검색 유입에서 반복 확인되어 사용자가 실제로 찾는 정비/증상 키워드입니다.'
        else '후기 태그에서 반복 확인되어 차종별 고질병 DB 후보로 볼 수 있습니다.'
      end as reason,
      'keyword'::text as source
    from keyword_rows_source
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
            'keyword', keyword_rows_source.keyword,
            'mention_count', keyword_rows_source.mention_count,
            'related_models', keyword_rows_source.related_models,
            'recent_occurred_at', keyword_rows_source.recent_occurred_at,
            'ai_status', coalesce(status_row.status, 'pending')
          )
          order by keyword_rows_source.mention_count desc,
            keyword_rows_source.recent_occurred_at desc,
            keyword_rows_source.keyword
        )
        from keyword_rows_source
        left join public.ai_data_candidate_statuses as status_row
          on status_row.candidate_key = 'keyword:' || keyword_rows_source.keyword
      ),
      '[]'::jsonb
    ) as keyword_rows,
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

revoke all on function public.admin_set_ai_candidate_status(text, text, text, text[], text)
  from public;
revoke all on function public.admin_get_operator_dashboard_data()
  from public;

grant execute on function public.admin_set_ai_candidate_status(text, text, text, text[], text)
  to authenticated;
grant execute on function public.admin_get_operator_dashboard_data()
  to authenticated;

commit;
