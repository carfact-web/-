alter table public.user_profiles
  add column if not exists nickname text;

alter table public.user_profiles
  add column if not exists nickname_changed boolean not null default false;

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
