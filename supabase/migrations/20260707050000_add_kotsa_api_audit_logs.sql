create table if not exists public.kotsa_api_audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  vehicle_number_masked text,
  vehicle_number_hash text,
  query_type text not null
    default 'KOTSA_BUSINESS_VEHICLE_HISTORY',
  endpoint text not null,
  request_ip text,
  user_agent text,
  user_tier text,
  status text not null,
  response_code text,
  response_time_ms integer,
  error_type text,
  counted_against_quota boolean not null default false,
  error_message text,
  created_at timestamptz not null default now()
);

create unique index if not exists kotsa_api_audit_logs_request_id_idx
  on public.kotsa_api_audit_logs (request_id);

create index if not exists kotsa_api_audit_logs_created_at_idx
  on public.kotsa_api_audit_logs (created_at desc);

create index if not exists kotsa_api_audit_logs_user_id_created_at_idx
  on public.kotsa_api_audit_logs (user_id, created_at desc);

create index if not exists kotsa_api_audit_logs_status_created_at_idx
  on public.kotsa_api_audit_logs (status, created_at desc);

create index if not exists kotsa_api_audit_logs_vehicle_hash_created_at_idx
  on public.kotsa_api_audit_logs (vehicle_number_hash, created_at desc);

alter table public.kotsa_api_audit_logs enable row level security;

drop policy if exists "Admins read kotsa api audit logs"
  on public.kotsa_api_audit_logs;

create policy "Admins read kotsa api audit logs"
  on public.kotsa_api_audit_logs for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Service role inserts kotsa api audit logs"
  on public.kotsa_api_audit_logs;

create policy "Service role inserts kotsa api audit logs"
  on public.kotsa_api_audit_logs for insert
  to service_role
  with check (true);

create or replace function public.admin_list_kotsa_api_audit_logs(
  search_text text default '',
  row_limit integer default 100
)
returns table (
  id uuid,
  request_id uuid,
  user_id uuid,
  vehicle_number_masked text,
  vehicle_number_hash text,
  query_type text,
  endpoint text,
  request_ip text,
  user_agent text,
  user_tier text,
  status text,
  response_code text,
  response_time_ms integer,
  error_type text,
  counted_against_quota boolean,
  error_message text,
  created_at timestamptz
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
    log.id,
    log.request_id,
    log.user_id,
    log.vehicle_number_masked,
    log.vehicle_number_hash,
    log.query_type,
    log.endpoint,
    log.request_ip,
    log.user_agent,
    log.user_tier,
    log.status,
    log.response_code,
    log.response_time_ms,
    log.error_type,
    log.counted_against_quota,
    log.error_message,
    log.created_at
  from public.kotsa_api_audit_logs as log
  where nullif(trim(search_text), '') is null
    or log.vehicle_number_masked ilike '%' || trim(search_text) || '%'
    or log.query_type ilike '%' || trim(search_text) || '%'
    or log.endpoint ilike '%' || trim(search_text) || '%'
    or log.status ilike '%' || trim(search_text) || '%'
    or log.response_code ilike '%' || trim(search_text) || '%'
    or log.request_id::text ilike '%' || trim(search_text) || '%'
    or log.error_message ilike '%' || trim(search_text) || '%'
  order by log.created_at desc
  limit least(greatest(row_limit, 1), 200);
end;
$$;

revoke all on function public.admin_list_kotsa_api_audit_logs(text, integer)
  from public;

grant execute on function public.admin_list_kotsa_api_audit_logs(text, integer)
  to authenticated;

create table if not exists public.kotsa_query_limit_policies (
  policy_key text primary key,
  label text not null,
  daily_limit integer,
  temporary_daily_limit integer,
  temporary_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.kotsa_query_limit_policies
  add column if not exists temporary_daily_limit integer;

alter table public.kotsa_query_limit_policies
  add column if not exists temporary_expires_at timestamptz;

insert into public.kotsa_query_limit_policies
  (policy_key, label, daily_limit)
values
  ('general', '일반 회원', 5),
  ('verified_dealer', '인증 딜러', 20),
  ('admin', '관리자', null),
  ('ip', 'IP 기준', 100)
on conflict (policy_key) do nothing;

alter table public.kotsa_query_limit_policies enable row level security;

drop policy if exists "Admins read kotsa query limit policies"
  on public.kotsa_query_limit_policies;

create policy "Admins read kotsa query limit policies"
  on public.kotsa_query_limit_policies for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Admins update kotsa query limit policies"
  on public.kotsa_query_limit_policies;

create policy "Admins update kotsa query limit policies"
  on public.kotsa_query_limit_policies for update
  to authenticated
  using (public.current_user_has_admin_role())
  with check (public.current_user_has_admin_role());

create table if not exists public.kotsa_operation_settings (
  setting_key text primary key,
  label text not null,
  numeric_value numeric(12, 2),
  text_value text,
  updated_at timestamptz not null default now()
);

alter table public.kotsa_operation_settings
  add column if not exists text_value text;

insert into public.kotsa_operation_settings
  (setting_key, label, numeric_value)
values
  ('api_unit_cost_krw', 'KOTSA API 1회 호출 단가', 0),
  ('kotsa_emergency_stop', 'KOTSA 비상정지', 0),
  ('supabase_backup_last_checked_at', 'Supabase 백업 마지막 확인일', null),
  ('supabase_pitr_enabled', 'Supabase PITR 활성화 여부', null),
  ('database_backup_last_at', 'DB 백업 마지막 확인일', null),
  ('storage_backup_last_at', 'Storage 백업 마지막 확인일', null),
  ('certificate_backup_last_at', '인증서 백업 마지막 확인일', null),
  ('backup_last_success', '백업 마지막 성공 여부', 0)
on conflict (setting_key) do nothing;

create table if not exists public.admin_known_ips (
  user_id uuid not null references auth.users(id) on delete cascade,
  ip text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, ip)
);

alter table public.admin_known_ips enable row level security;

drop policy if exists "Admins read admin known ips"
  on public.admin_known_ips;

create policy "Admins read admin known ips"
  on public.admin_known_ips for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Service role manages admin known ips"
  on public.admin_known_ips;

create policy "Service role manages admin known ips"
  on public.admin_known_ips for all
  to service_role
  using (true)
  with check (true);

alter table public.kotsa_operation_settings enable row level security;

drop policy if exists "Admins read kotsa operation settings"
  on public.kotsa_operation_settings;

create policy "Admins read kotsa operation settings"
  on public.kotsa_operation_settings for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Admins update kotsa operation settings"
  on public.kotsa_operation_settings;

create policy "Admins update kotsa operation settings"
  on public.kotsa_operation_settings for update
  to authenticated
  using (public.current_user_has_admin_role())
  with check (public.current_user_has_admin_role());

create table if not exists public.security_alert_logs (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  severity text not null default 'warning',
  endpoint text,
  request_ip text,
  user_id uuid references auth.users(id) on delete set null,
  request_id uuid,
  status_code integer,
  recent_failure_count integer not null default 0,
  blocked boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_alert_logs_created_at_idx
  on public.security_alert_logs (created_at desc);

create index if not exists security_alert_logs_type_created_at_idx
  on public.security_alert_logs (alert_type, created_at desc);

create index if not exists security_alert_logs_ip_created_at_idx
  on public.security_alert_logs (request_ip, created_at desc);

alter table public.security_alert_logs enable row level security;

drop policy if exists "Admins read security alert logs"
  on public.security_alert_logs;

create policy "Admins read security alert logs"
  on public.security_alert_logs for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Service role inserts security alert logs"
  on public.security_alert_logs;

create policy "Service role inserts security alert logs"
  on public.security_alert_logs for insert
  to service_role
  with check (true);

create table if not exists public.security_blocked_ips (
  ip text primary key,
  reason text,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_blocked_ips_active_idx
  on public.security_blocked_ips (is_active, expires_at);

alter table public.security_blocked_ips enable row level security;

drop policy if exists "Admins read security blocked ips"
  on public.security_blocked_ips;

create policy "Admins read security blocked ips"
  on public.security_blocked_ips for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Admins insert security blocked ips"
  on public.security_blocked_ips;

create policy "Admins insert security blocked ips"
  on public.security_blocked_ips for insert
  to authenticated
  with check (public.current_user_has_admin_role());

drop policy if exists "Admins update security blocked ips"
  on public.security_blocked_ips;

create policy "Admins update security blocked ips"
  on public.security_blocked_ips for update
  to authenticated
  using (public.current_user_has_admin_role())
  with check (public.current_user_has_admin_role());
