alter table public.community_posts enable row level security;

drop policy if exists "Anyone can read community posts" on public.community_posts;
drop policy if exists "Authenticated users can create community posts" on public.community_posts;
drop policy if exists "Users can update own community posts" on public.community_posts;
drop policy if exists "Users can delete own community posts" on public.community_posts;
drop policy if exists "Public read community posts" on public.community_posts;
drop policy if exists "Authenticated insert community posts" on public.community_posts;

create policy "Anyone can read community posts"
on public.community_posts
for select
using (is_hidden = false);

create policy "Authenticated users can create community posts"
on public.community_posts
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own community posts"
on public.community_posts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own community posts"
on public.community_posts
for delete
to authenticated
using (auth.uid() = user_id);
