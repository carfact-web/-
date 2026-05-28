create extension if not exists "pgcrypto";

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

create index if not exists vehicles_car_number_idx
  on public.vehicles (car_number);

create index if not exists reviews_vehicle_id_created_at_idx
  on public.reviews (vehicle_id, created_at desc);

create index if not exists review_reports_review_id_idx
  on public.review_reports (review_id);

alter table public.vehicles enable row level security;
alter table public.reviews enable row level security;
alter table public.review_reports enable row level security;

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
