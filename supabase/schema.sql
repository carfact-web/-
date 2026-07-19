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
  author_id uuid references auth.users(id) on delete set null,
  author_nickname text default '익명 사용자',
  title text default '차량 후기',
  content text not null,
  tags text[] not null default '{}',
  images jsonb not null default '[]'::jsonb,
  vehicle_snapshot jsonb not null default '{}'::jsonb,
  helpful_count integer not null default 0,
  report_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  nickname_changed boolean not null default false,
  role text not null default 'user' check (role in ('user', 'admin', 'super_admin')),
  is_verified_dealer boolean not null default false,
  login_provider text,
  email text,
  provider_profile_name text,
  provider_avatar_url text,
  provider_user_id text,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in (
      'developer_note',
      'free',
      'news',
      'maintenance',
      'electric',
      'imported',
      'domestic',
      'partner'
    )
  ),
  title text not null,
  content text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  images jsonb not null default '[]'::jsonb,
  is_hidden boolean not null default false,
  is_notice boolean not null default false,
  is_pinned boolean not null default false,
  report_count integer not null default 0,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text default '카팩트 사용자',
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint community_likes_post_user_unique unique (post_id, user_id)
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists nickname text;

alter table public.user_profiles
  add column if not exists nickname_changed boolean not null default false;

alter table public.user_profiles
  add column if not exists role text not null default 'user';

alter table public.user_profiles
  add column if not exists is_verified_dealer boolean not null default false;

alter table public.user_profiles
  add column if not exists login_provider text;

alter table public.user_profiles
  add column if not exists email text;

alter table public.user_profiles
  add column if not exists provider_profile_name text;

alter table public.user_profiles
  add column if not exists provider_avatar_url text;

alter table public.user_profiles
  add column if not exists provider_user_id text;

alter table public.user_profiles
  add column if not exists last_sign_in_at timestamptz;

alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('user', 'admin', 'super_admin'));

alter table public.reviews
  add column if not exists author_id uuid references auth.users(id) on delete set null;

alter table public.reviews
  add column if not exists helpful_count integer not null default 0;

alter table public.reviews
  add column if not exists title text default '차량 후기';

alter table public.community_posts
  add column if not exists images jsonb not null default '[]'::jsonb;

alter table public.community_posts
  add column if not exists is_notice boolean not null default false;

alter table public.community_posts
  add column if not exists is_pinned boolean not null default false;

create or replace function public.generate_random_profile_nickname()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  adjectives text[] := array[
    '슬퍼하는',
    '달리는',
    '조용한',
    '빛나는',
    '빠른',
    '수상한',
    '차분한',
    '웃는',
    '푸른',
    '든든한',
    '느긋한',
    '반짝이는'
  ];
  nouns text[] := array[
    '자몽',
    '고라니',
    '엔진',
    '핸들',
    '부엉이',
    '타이어',
    '라디에이터',
    '브레이크',
    '계기판',
    '스포일러',
    '라이트',
    '범퍼'
  ];
  base_nickname text;
  candidate text;
  attempt_count integer := 0;
begin
  loop
    base_nickname :=
      adjectives[1 + floor(random() * array_length(adjectives, 1))::integer] ||
      nouns[1 + floor(random() * array_length(nouns, 1))::integer];
    candidate := base_nickname;

    if attempt_count > 0 or random() < 0.2 then
      candidate := base_nickname || (floor(random() * 900) + 100)::integer::text;
    end if;

    exit when
      not exists (
        select 1 from public.user_profiles
        where nickname = candidate
      )
      or attempt_count >= 5;

    attempt_count := attempt_count + 1;
  end loop;

  return candidate;
end;
$$;

create or replace function public.get_auth_user_profile_name(metadata jsonb)
returns text
language sql
immutable
as $$
  select nullif(
    coalesce(
      metadata ->> 'nickname',
      metadata ->> 'name',
      metadata ->> 'full_name',
      metadata ->> 'preferred_username',
      metadata ->> 'user_name'
    ),
    ''
  );
$$;

create or replace function public.get_auth_user_avatar_url(metadata jsonb)
returns text
language sql
immutable
as $$
  select nullif(
    coalesce(
      metadata ->> 'avatar_url',
      metadata ->> 'picture',
      metadata ->> 'profile_image',
      metadata ->> 'profile_image_url'
    ),
    ''
  );
$$;

create or replace function public.sync_user_profile_auth_metadata(target_user_id uuid)
returns public.user_profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  auth_user auth.users%rowtype;
  auth_identity auth.identities%rowtype;
  synced_profile public.user_profiles%rowtype;
begin
  select *
    into auth_user
  from auth.users
  where id = target_user_id;

  if auth_user.id is null then
    raise exception '대상 회원을 찾지 못했습니다.';
  end if;

  select *
    into auth_identity
  from auth.identities
  where user_id = target_user_id
  order by
    case when provider = coalesce(auth_user.raw_app_meta_data ->> 'provider', '') then 0 else 1 end,
    updated_at desc nulls last,
    created_at desc nulls last
  limit 1;

  perform set_config('app.syncing_auth_profile', 'true', true);

  update public.user_profiles as profile
  set
    login_provider = coalesce(
      nullif(auth_user.raw_app_meta_data ->> 'provider', ''),
      nullif(auth_identity.provider, ''),
      'email'
    ),
    email = nullif(auth_user.email, ''),
    provider_profile_name = public.get_auth_user_profile_name(auth_user.raw_user_meta_data),
    provider_avatar_url = public.get_auth_user_avatar_url(auth_user.raw_user_meta_data),
    provider_user_id = nullif(
      coalesce(
        auth_identity.identity_data ->> 'provider_id',
        auth_identity.identity_data ->> 'sub',
        auth_identity.id::text
      ),
      ''
    ),
    last_sign_in_at = auth_user.last_sign_in_at,
    updated_at = now()
  where profile.id = target_user_id
  returning *
    into synced_profile;

  return synced_profile;
end;
$$;

create or replace function public.sync_current_user_auth_profile()
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception '로그인이 필요합니다.';
  end if;

  return public.sync_user_profile_auth_metadata(current_user_id);
end;
$$;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_profile public.user_profiles%rowtype;
begin
  insert into public.user_profiles (
    id,
    nickname,
    nickname_changed,
    role,
    login_provider,
    email,
    provider_profile_name,
    provider_avatar_url,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    public.generate_random_profile_nickname(),
    false,
    'user',
    coalesce(nullif(new.raw_app_meta_data ->> 'provider', ''), 'email'),
    nullif(new.email, ''),
    public.get_auth_user_profile_name(new.raw_user_meta_data),
    public.get_auth_user_avatar_url(new.raw_user_meta_data),
    new.last_sign_in_at,
    now(),
    now()
  )
  on conflict (id) do nothing
  returning *
    into new_profile;

  if new_profile.id is not null then
    perform public.sync_user_profile_auth_metadata(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile
  on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user_profile();

create or replace function public.prevent_user_profile_nickname_rechange()
returns trigger
language plpgsql
as $$
begin
  if old.nickname_changed = true and (
    new.nickname is distinct from old.nickname or
    new.nickname_changed is distinct from old.nickname_changed
  ) then
    raise exception 'nickname can only be changed once';
  end if;

  if old.nickname_changed = false and new.nickname is distinct from old.nickname then
    if old.nickname is null and new.nickname is not null and new.nickname_changed = false then
      return new;
    end if;

    new.nickname_changed := true;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_user_profile_nickname_rechange_trigger
  on public.user_profiles;
create trigger prevent_user_profile_nickname_rechange_trigger
  before update on public.user_profiles
  for each row
  execute function public.prevent_user_profile_nickname_rechange();

create or replace function public.prevent_user_profile_role_self_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_has_admin_role() then
    return new;
  end if;

  if current_setting('app.syncing_auth_profile', true) = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' and auth.uid() is not null and (
    new.role <> 'user'
    or new.is_verified_dealer <> false
    or new.login_provider is not null
    or new.email is not null
    or new.provider_profile_name is not null
    or new.provider_avatar_url is not null
    or new.provider_user_id is not null
    or new.last_sign_in_at is not null
  ) then
    raise exception 'profile privileged fields cannot be set by client';
  end if;

  if tg_op = 'UPDATE'
    and auth.uid() is not null
    and (
      new.role is distinct from old.role
      or new.is_verified_dealer is distinct from old.is_verified_dealer
      or new.login_provider is distinct from old.login_provider
      or new.email is distinct from old.email
      or new.provider_profile_name is distinct from old.provider_profile_name
      or new.provider_avatar_url is distinct from old.provider_avatar_url
      or new.provider_user_id is distinct from old.provider_user_id
      or new.last_sign_in_at is distinct from old.last_sign_in_at
    ) then
    raise exception 'profile privileged fields cannot be changed by client';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_user_profile_role_self_change_trigger
  on public.user_profiles;
create trigger prevent_user_profile_role_self_change_trigger
  before insert or update on public.user_profiles
  for each row
  execute function public.prevent_user_profile_role_self_change();

create or replace function public.current_user_has_admin_role()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

revoke all on function public.current_user_has_admin_role() from public;
grant execute on function public.current_user_has_admin_role() to authenticated;

revoke all on function public.get_auth_user_profile_name(jsonb) from public;
revoke all on function public.get_auth_user_avatar_url(jsonb) from public;
revoke all on function public.sync_user_profile_auth_metadata(uuid) from public;
revoke all on function public.sync_current_user_auth_profile() from public;
grant execute on function public.sync_current_user_auth_profile() to authenticated;

create or replace function public.list_verified_dealer_profiles(target_user_ids uuid[])
returns table (
  id uuid,
  is_verified_dealer boolean
)
language sql
security definer
set search_path = public
as $$
  select
    profile.id,
    profile.is_verified_dealer
  from public.user_profiles as profile
  where profile.id = any(target_user_ids)
    and profile.is_verified_dealer = true;
$$;

revoke all on function public.list_verified_dealer_profiles(uuid[]) from public;
grant execute on function public.list_verified_dealer_profiles(uuid[]) to anon;
grant execute on function public.list_verified_dealer_profiles(uuid[]) to authenticated;

create or replace function public.enforce_community_notice_permissions()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT'
    and (new.is_notice = true or new.is_pinned = true)
    and not public.current_user_has_admin_role() then
    raise exception 'only admin can create notice or pinned community posts';
  end if;

  if tg_op = 'UPDATE'
    and (
      new.is_notice is distinct from old.is_notice or
      new.is_pinned is distinct from old.is_pinned
    )
    and not public.current_user_has_admin_role() then
    raise exception 'only admin can update notice or pinned community posts';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_community_notice_permissions_trigger
  on public.community_posts;
create trigger enforce_community_notice_permissions_trigger
  before insert or update on public.community_posts
  for each row
  execute function public.enforce_community_notice_permissions();

create or replace function public.hide_own_community_post(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.community_posts
  set
    is_hidden = true,
    updated_at = now()
  where id = target_post_id
    and is_hidden = false
    and (
      user_id = auth.uid()
      or public.current_user_has_admin_role()
    );

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.hide_own_community_post(uuid) from public;
grant execute on function public.hide_own_community_post(uuid) to authenticated;

create or replace function public.set_review_helpful_count(
  p_review_id uuid,
  p_helpful_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reviews
  set helpful_count = greatest(coalesce(p_helpful_count, 0), 0)
  where id = p_review_id;
end;
$$;

grant execute on function public.set_review_helpful_count(uuid, integer)
  to anon, authenticated;

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

create index if not exists reviews_author_id_created_at_idx
  on public.reviews (author_id, created_at desc);

create index if not exists review_reports_review_id_idx
  on public.review_reports (review_id);

create index if not exists community_posts_category_created_at_idx
  on public.community_posts (category, created_at desc);

create index if not exists community_posts_pinned_created_idx
  on public.community_posts (is_hidden, is_pinned desc, created_at desc);

create index if not exists community_posts_author_id_created_at_idx
  on public.community_posts (author_id, created_at desc);

create index if not exists community_comments_post_id_created_at_idx
  on public.community_comments (post_id, created_at);

create index if not exists community_likes_post_id_idx
  on public.community_likes (post_id);

create index if not exists community_reports_post_id_idx
  on public.community_reports (post_id);

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
alter table public.user_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_reports enable row level security;
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
create policy "Authenticated insert reviews"
  on public.reviews for insert
  with check (
    auth.role() = 'authenticated'
    and (author_id is null or auth.uid() = author_id)
  );

drop policy if exists "Public insert review reports" on public.review_reports;
create policy "Public insert review reports"
  on public.review_reports for insert
  with check (true);

drop policy if exists "Users read own profile" on public.user_profiles;
create policy "Users read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.user_profiles;
create policy "Users insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.user_profiles;
create policy "Users update own profile"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Public read community posts" on public.community_posts;
drop policy if exists "Authenticated insert community posts" on public.community_posts;
drop policy if exists "Anyone can read community posts" on public.community_posts;
drop policy if exists "Authenticated users can create community posts" on public.community_posts;
drop policy if exists "Users can update own community posts" on public.community_posts;
drop policy if exists "Users can delete own community posts" on public.community_posts;

create policy "Anyone can read community posts"
  on public.community_posts for select
  using (is_hidden = false);

create policy "Authenticated users can create community posts"
  on public.community_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own community posts"
  on public.community_posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own community posts"
  on public.community_posts for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Public read community comments" on public.community_comments;
create policy "Public read community comments"
  on public.community_comments for select
  using (true);

drop policy if exists "Authenticated insert community comments" on public.community_comments;
create policy "Authenticated insert community comments"
  on public.community_comments for insert
  with check (auth.role() = 'authenticated' and auth.uid() = author_id);

drop policy if exists "Public read community likes" on public.community_likes;
create policy "Public read community likes"
  on public.community_likes for select
  using (true);

drop policy if exists "Users insert own community likes" on public.community_likes;
create policy "Users insert own community likes"
  on public.community_likes for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "Users delete own community likes" on public.community_likes;
create policy "Users delete own community likes"
  on public.community_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "Public read community reports" on public.community_reports;
create policy "Public read community reports"
  on public.community_reports for select
  using (true);

drop policy if exists "Authenticated insert community reports" on public.community_reports;
create policy "Authenticated insert community reports"
  on public.community_reports for insert
  with check (
    auth.role() = 'authenticated'
    and (user_id is null or auth.uid() = user_id)
  );

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

insert into storage.buckets (id, name, public)
values ('community-images', 'community-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read community images" on storage.objects;
create policy "Public read community images"
  on storage.objects for select
  using (bucket_id = 'community-images');

drop policy if exists "Authenticated upload community images" on storage.objects;
create policy "Authenticated upload community images"
  on storage.objects for insert
  with check (
    bucket_id = 'community-images'
    and auth.role() = 'authenticated'
  );
