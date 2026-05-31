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

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider text := new.raw_app_meta_data->>'provider';
  display_label text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'nickname',
    new.email,
    '로그인 사용자'
  );
begin
  insert into public.user_profiles (
    user_id,
    email,
    display_name,
    nickname,
    nickname_changed,
    auth_provider,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    display_label,
    public.generate_random_profile_nickname(),
    false,
    provider,
    now(),
    now()
  )
  on conflict (user_id) do nothing;

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
