create table if not exists public.kotsa_vehicle_history_cache (
  vehicle_number_hash text primary key,
  vehicle_number_masked text,
  data jsonb not null,
  response_code text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kotsa_vehicle_history_cache_expires_at_idx
  on public.kotsa_vehicle_history_cache (expires_at);

alter table public.kotsa_vehicle_history_cache enable row level security;

drop policy if exists "Admins read kotsa vehicle history cache"
  on public.kotsa_vehicle_history_cache;

create policy "Admins read kotsa vehicle history cache"
  on public.kotsa_vehicle_history_cache for select
  to authenticated
  using (public.current_user_has_admin_role());

drop policy if exists "Service role manages kotsa vehicle history cache"
  on public.kotsa_vehicle_history_cache;

create policy "Service role manages kotsa vehicle history cache"
  on public.kotsa_vehicle_history_cache for all
  to service_role
  using (true)
  with check (true);
