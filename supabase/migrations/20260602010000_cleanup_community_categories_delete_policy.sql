update public.community_posts
set
  category = case
    when category = 'question' then 'free'
    when category = 'shop_review' then 'partner'
    else category
  end,
  updated_at = now()
where category in ('question', 'shop_review');

alter table public.community_posts
  drop constraint if exists community_posts_category_check;

alter table public.community_posts
  add constraint community_posts_category_check
  check (
    category in (
      'free',
      'news',
      'maintenance',
      'electric',
      'imported',
      'domestic',
      'partner'
    )
  );

create index if not exists community_posts_hidden_category_created_idx
  on public.community_posts (is_hidden, category, created_at desc);

create index if not exists community_posts_search_idx
  on public.community_posts using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
  );

alter table public.community_posts enable row level security;

drop policy if exists "Users can update own community posts" on public.community_posts;
drop policy if exists "Users can delete own community posts" on public.community_posts;

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
