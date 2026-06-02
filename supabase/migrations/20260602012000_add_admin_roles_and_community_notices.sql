alter table public.user_profiles
  add column if not exists role text not null default 'user';

alter table public.user_profiles
  drop constraint if exists user_profiles_role_check;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('user', 'admin', 'super_admin'));

insert into public.user_profiles (
  id,
  nickname,
  nickname_changed,
  role,
  created_at,
  updated_at
)
select
  users.id,
  '카팩트 관리자',
  false,
  'super_admin',
  now(),
  now()
from auth.users as users
where users.id = '20e504fb-e25e-46f1-b2ed-de95c38f7194'::uuid
on conflict (id) do update
set
  role = 'super_admin',
  updated_at = now();

alter table public.community_posts
  add column if not exists is_notice boolean not null default false;

alter table public.community_posts
  add column if not exists is_pinned boolean not null default false;

create index if not exists community_posts_pinned_created_idx
  on public.community_posts (is_hidden, is_pinned desc, created_at desc);

create or replace function public.prevent_user_profile_role_self_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null and new.role <> 'user' then
    raise exception 'profile role cannot be set by client';
  end if;

  if tg_op = 'UPDATE'
    and auth.uid() is not null
    and new.role is distinct from old.role then
    raise exception 'profile role cannot be changed by client';
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
