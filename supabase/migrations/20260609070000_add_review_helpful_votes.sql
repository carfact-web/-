create table if not exists public.review_helpful (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint review_helpful_review_user_unique unique (review_id, user_id)
);

create index if not exists review_helpful_review_id_idx
  on public.review_helpful (review_id);

create index if not exists review_helpful_user_id_idx
  on public.review_helpful (user_id);

alter table public.review_helpful enable row level security;

drop policy if exists "Public read review helpful" on public.review_helpful;
drop policy if exists "Users read own review helpful" on public.review_helpful;
create policy "Users read own review helpful"
  on public.review_helpful for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own review helpful" on public.review_helpful;
create policy "Users insert own review helpful"
  on public.review_helpful for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own review helpful" on public.review_helpful;
create policy "Users delete own review helpful"
  on public.review_helpful for delete
  using (auth.uid() = user_id);

create or replace function public.sync_review_helpful_count_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.reviews
    set helpful_count = helpful_count + 1,
        updated_at = now()
    where id = new.review_id;

    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.reviews
    set helpful_count = greatest(helpful_count - 1, 0),
        updated_at = now()
    where id = old.review_id;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists review_helpful_sync_count on public.review_helpful;
create trigger review_helpful_sync_count
  after insert or delete on public.review_helpful
  for each row execute function public.sync_review_helpful_count_delta();

create or replace function public.toggle_review_helpful(target_review_id uuid)
returns table (
  is_voted boolean,
  helpful_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1
    from public.review_helpful
    where review_id = target_review_id
      and user_id = current_user_id
  ) then
    delete from public.review_helpful
    where review_id = target_review_id
      and user_id = current_user_id;

    return query
      select false, coalesce(review.helpful_count, 0)
      from public.reviews as review
      where review.id = target_review_id;

    return;
  end if;

  insert into public.review_helpful (review_id, user_id)
  values (target_review_id, current_user_id)
  on conflict (review_id, user_id) do nothing;

  return query
    select true, coalesce(review.helpful_count, 0)
    from public.reviews as review
    where review.id = target_review_id;
end;
$$;

revoke all on function public.toggle_review_helpful(uuid) from public;
grant execute on function public.toggle_review_helpful(uuid) to authenticated;
