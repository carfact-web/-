create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (
    category in (
      'free',
      'maintenance',
      'question',
      'news',
      'shop_review',
      'electric',
      'imported',
      'domestic'
    )
  ),
  title text not null,
  content text not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text default '카팩트 사용자',
  images jsonb not null default '[]'::jsonb,
  report_count integer not null default 0,
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

create index if not exists community_posts_category_created_at_idx
  on public.community_posts (category, created_at desc);

create index if not exists community_comments_post_id_created_at_idx
  on public.community_comments (post_id, created_at);

create index if not exists community_likes_post_id_idx
  on public.community_likes (post_id);

create index if not exists community_reports_post_id_idx
  on public.community_reports (post_id);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_reports enable row level security;

drop policy if exists "Public read community posts" on public.community_posts;
create policy "Public read community posts"
  on public.community_posts for select
  using (true);

drop policy if exists "Authenticated insert community posts" on public.community_posts;
create policy "Authenticated insert community posts"
  on public.community_posts for insert
  with check (auth.role() = 'authenticated' and auth.uid() = author_id);

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
