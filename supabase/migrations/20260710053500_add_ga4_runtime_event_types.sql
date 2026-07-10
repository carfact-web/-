begin;

alter table public.page_views
  drop constraint if exists page_views_event_type_check;

alter table public.page_views
  add constraint page_views_event_type_check
    check (
      event_type in (
        'ai_analysis_complete',
        'login',
        'page_view',
        'post_view',
        'vehicle_view',
        'review_view',
        'vehicle_search',
        'review_create',
        'sign_up'
      )
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

notify pgrst, 'reload schema';

commit;
