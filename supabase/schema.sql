create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  car_number text not null unique,
  manufacturer text not null,
  model text not null,
  generation text,
  year text not null,
  mileage text,
  fuel_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  author_nickname text default '익명 사용자',
  content text not null,
  tags text[] not null default '{}',
  images jsonb not null default '[]'::jsonb,
  vehicle_snapshot jsonb not null default '{}'::jsonb,
  report_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_master (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'carmanager',
  source_maker_no integer,
  source_model_no integer,
  source_model_detail_no integer,
  manufacturer text not null,
  model text not null,
  model_detail text not null,
  aliases text[] not null default '{}'::text[],
  search_text text not null,
  search_text_normalized text not null,
  country text,
  maker_code text,
  model_code text,
  model_detail_code text,
  kind_code text,
  kind_sub_code text,
  sort_order integer,
  active_car_count integer,
  source_created_at_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_master_source_detail_unique unique (source, source_model_detail_no),
  constraint vehicle_master_name_unique unique (manufacturer, model, model_detail)
);

create index if not exists vehicles_car_number_idx
  on public.vehicles (car_number);

create index if not exists reviews_vehicle_id_created_at_idx
  on public.reviews (vehicle_id, created_at desc);

create index if not exists review_reports_review_id_idx
  on public.review_reports (review_id);

create index if not exists vehicle_master_manufacturer_idx
  on public.vehicle_master (manufacturer);

create index if not exists vehicle_master_model_idx
  on public.vehicle_master (model);

create index if not exists vehicle_master_model_detail_idx
  on public.vehicle_master (model_detail);

create index if not exists vehicle_master_aliases_gin_idx
  on public.vehicle_master using gin (aliases);

create index if not exists vehicle_master_search_text_trgm_idx
  on public.vehicle_master using gin (search_text gin_trgm_ops);

create index if not exists vehicle_master_search_text_normalized_trgm_idx
  on public.vehicle_master using gin (search_text_normalized gin_trgm_ops);

alter table public.vehicles enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;
alter table public.vehicle_master enable row level security;

drop policy if exists "Public read vehicles" on public.vehicles;
create policy "Public read vehicles"
  on public.vehicles for select
  using (true);

drop policy if exists "Public insert vehicles" on public.vehicles;
create policy "Public insert vehicles"
  on public.vehicles for insert
  with check (true);

drop policy if exists "Public update vehicles" on public.vehicles;
create policy "Public update vehicles"
  on public.vehicles for update
  using (true)
  with check (true);

drop policy if exists "Public read reviews" on public.reviews;
create policy "Public read reviews"
  on public.reviews for select
  using (true);

drop policy if exists "Public insert reviews" on public.reviews;
create policy "Public insert reviews"
  on public.reviews for insert
  with check (true);

drop policy if exists "Public insert review reports" on public.review_reports;
create policy "Public insert review reports"
  on public.review_reports for insert
  with check (true);

drop policy if exists "Public read vehicle master" on public.vehicle_master;
create policy "Public read vehicle master"
  on public.vehicle_master for select
  using (true);

insert into storage.buckets (id, name, public)
values ('review-images', 'review-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read review images" on storage.objects;
create policy "Public read review images"
  on storage.objects for select
  using (bucket_id = 'review-images');

drop policy if exists "Public upload review images" on storage.objects;
create policy "Public upload review images"
  on storage.objects for insert
  with check (bucket_id = 'review-images');
