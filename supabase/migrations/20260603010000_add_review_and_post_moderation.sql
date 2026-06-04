alter table public.reviews
  add column if not exists author_id uuid references auth.users(id) on delete set null;

alter table public.reviews
  add column if not exists is_hidden boolean not null default false;

alter table public.reviews
  add column if not exists updated_at timestamptz not null default now();

create index if not exists reviews_visible_vehicle_created_at_idx
  on public.reviews (vehicle_id, is_hidden, created_at desc);

create index if not exists reviews_author_id_created_at_idx
  on public.reviews (author_id, created_at desc);

create or replace function public.hide_review(target_review_id uuid)
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

  update public.reviews
  set
    is_hidden = true,
    updated_at = now()
  where id = target_review_id
    and is_hidden = false
    and (
      author_id = auth.uid()
      or public.current_user_has_admin_role()
    );

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.hide_review(uuid) from public;
grant execute on function public.hide_review(uuid) to authenticated;

create or replace function public.update_review(
  target_review_id uuid,
  next_content text,
  next_tags text[],
  next_images jsonb
)
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

  update public.reviews
  set
    content = next_content,
    tags = coalesce(next_tags, '{}'::text[]),
    images = coalesce(next_images, '[]'::jsonb),
    updated_at = now()
  where id = target_review_id
    and is_hidden = false
    and author_id = auth.uid();

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.update_review(uuid, text, text[], jsonb) from public;
grant execute on function public.update_review(uuid, text, text[], jsonb) to authenticated;

create or replace function public.update_community_post(
  target_post_id uuid,
  next_category text,
  next_title text,
  next_content text,
  next_images jsonb,
  next_is_notice boolean,
  next_is_pinned boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer;
  is_admin boolean;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if next_category not in (
    'free',
    'news',
    'maintenance',
    'electric',
    'imported',
    'domestic',
    'partner'
  ) then
    raise exception 'invalid community category';
  end if;

  is_admin := public.current_user_has_admin_role();

  update public.community_posts
  set
    category = next_category,
    title = next_title,
    content = next_content,
    images = coalesce(next_images, '[]'::jsonb),
    is_notice = case when is_admin then coalesce(next_is_notice, false) else is_notice end,
    is_pinned = case when is_admin then coalesce(next_is_pinned, false) else is_pinned end,
    updated_at = now()
  where id = target_post_id
    and is_hidden = false
    and (
      user_id = auth.uid()
      or is_admin
    );

  get diagnostics affected_count = row_count;

  return affected_count > 0;
end;
$$;

revoke all on function public.update_community_post(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  boolean
) from public;
grant execute on function public.update_community_post(
  uuid,
  text,
  text,
  text,
  jsonb,
  boolean,
  boolean
) to authenticated;

alter table public.community_posts
  add column if not exists author_nickname text;

alter table public.community_posts
  alter column images drop default;

alter table public.community_posts
  alter column images type jsonb
  using coalesce(to_jsonb(images), '[]'::jsonb);

alter table public.community_posts
  alter column images set default '[]'::jsonb;

alter table public.community_posts
  alter column images set not null;

drop policy if exists "Public read reviews" on public.reviews;
drop policy if exists "Anyone can read visible reviews" on public.reviews;
create policy "Anyone can read visible reviews"
  on public.reviews for select
  using (is_hidden = false);
