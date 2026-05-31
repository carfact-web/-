alter table public.community_posts
  add column if not exists images jsonb not null default '[]'::jsonb;

alter table public.reviews
  add column if not exists author_id uuid references auth.users(id) on delete set null;

alter table public.reviews
  add column if not exists helpful_count integer not null default 0;

create index if not exists community_posts_author_id_created_at_idx
  on public.community_posts (author_id, created_at desc);

create index if not exists reviews_author_id_created_at_idx
  on public.reviews (author_id, created_at desc);

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

drop policy if exists "Authenticated insert reviews" on public.reviews;
create policy "Authenticated insert reviews"
  on public.reviews for insert
  with check (
    auth.role() = 'authenticated'
    and (author_id is null or auth.uid() = author_id)
  );

drop policy if exists "Users read own authored reviews" on public.reviews;
create policy "Users read own authored reviews"
  on public.reviews for select
  using (auth.uid() = author_id);

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
