alter table public.community_posts
  add column if not exists author_nickname text;

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_nickname text default '카팩트 사용자',
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.community_comments
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists author_nickname text default '카팩트 사용자';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'community_comments'
      and column_name = 'author_id'
  ) then
    update public.community_comments
      set user_id = author_id
      where user_id is null;
  end if;
end $$;

alter table public.community_comments
  alter column user_id set not null;

create table if not exists public.community_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

delete from public.community_reports
  where user_id is null;

alter table public.community_reports
  alter column user_id set not null;

create unique index if not exists community_likes_post_user_unique_idx
  on public.community_likes (post_id, user_id);

create unique index if not exists community_reports_post_user_unique_idx
  on public.community_reports (post_id, user_id);

create index if not exists community_comments_post_id_created_at_idx
  on public.community_comments (post_id, created_at);

create index if not exists community_likes_post_id_idx
  on public.community_likes (post_id);

create index if not exists community_reports_post_id_idx
  on public.community_reports (post_id);

update public.community_posts as post
  set author_nickname = profile.nickname
  from public.user_profiles as profile
  where post.user_id = profile.id
    and nullif(post.author_nickname, '') is null
    and nullif(profile.nickname, '') is not null;

alter table public.community_comments enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_reports enable row level security;

drop policy if exists "Public read community comments"
  on public.community_comments;
create policy "Public read community comments"
  on public.community_comments
  for select
  using (true);

drop policy if exists "Authenticated insert community comments"
  on public.community_comments;
create policy "Authenticated insert community comments"
  on public.community_comments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Public read community likes"
  on public.community_likes;
create policy "Public read community likes"
  on public.community_likes
  for select
  using (true);

drop policy if exists "Users insert own community likes"
  on public.community_likes;
create policy "Users insert own community likes"
  on public.community_likes
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own community likes"
  on public.community_likes;
create policy "Users delete own community likes"
  on public.community_likes
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Public read community reports"
  on public.community_reports;
create policy "Public read community reports"
  on public.community_reports
  for select
  using (true);

drop policy if exists "Authenticated insert community reports"
  on public.community_reports;
create policy "Authenticated insert community reports"
  on public.community_reports
  for insert
  to authenticated
  with check (auth.uid() = user_id);
