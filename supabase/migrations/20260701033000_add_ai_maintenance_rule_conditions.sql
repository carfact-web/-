begin;

create table if not exists public.admin_ai_maintenance_rules (
  id text primary key,
  title text not null check (length(trim(title)) > 0),
  condition text not null default '',
  fuel_type text not null default '',
  items text[] not null default '{}',
  year_operator text
    check (year_operator is null or year_operator in ('>=', '<=', '=')),
  year_value integer
    check (year_value is null or year_value > 0),
  mileage_operator text
    check (mileage_operator is null or mileage_operator in ('>=', '<=', '=')),
  mileage_value integer
    check (mileage_value is null or mileage_value > 0),
  is_visible boolean not null default true,
  memo text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_ai_maintenance_rules enable row level security;

create index if not exists admin_ai_maintenance_rules_visible_created_at_idx
  on public.admin_ai_maintenance_rules (is_visible, created_at desc);

create index if not exists admin_ai_maintenance_rules_year_condition_idx
  on public.admin_ai_maintenance_rules (year_operator, year_value)
  where year_operator is not null;

create index if not exists admin_ai_maintenance_rules_mileage_condition_idx
  on public.admin_ai_maintenance_rules (mileage_operator, mileage_value)
  where mileage_operator is not null;

create or replace function public.set_admin_ai_maintenance_rules_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_admin_ai_maintenance_rules_updated_at_trigger
  on public.admin_ai_maintenance_rules;

create trigger set_admin_ai_maintenance_rules_updated_at_trigger
before update on public.admin_ai_maintenance_rules
for each row
execute function public.set_admin_ai_maintenance_rules_updated_at();

insert into public.admin_ai_maintenance_rules (
  id,
  title,
  condition,
  fuel_type,
  items,
  year_operator,
  year_value,
  mileage_operator,
  mileage_value,
  is_visible,
  memo
)
values
  (
    'diesel-default',
    '디젤 기본 참고 항목',
    '유종이 디젤인 차량',
    '디젤',
    array['DPF', '터보', '인젝터', '촉매'],
    null,
    null,
    null,
    null,
    true,
    '요소수/SCR은 명시 SCR 데이터가 있을 때만 별도 노출'
  ),
  (
    'gasoline-lpg-aged',
    '가솔린/LPG 연식·주행거리 기본 항목',
    '가솔린/LPG 차량',
    '가솔린/LPG',
    array['점화코일', '점화플러그'],
    '>=',
    5,
    '>=',
    50000,
    true,
    '디젤 차량에는 적용하지 않음'
  ),
  (
    'scr-confirmed',
    'SCR 확인 차량',
    'DB에서 hasScr=true 또는 scrType이 확인된 차량',
    '디젤',
    array['요소수/SCR'],
    null,
    null,
    null,
    null,
    true,
    '연식만으로 자동 노출 금지'
  )
on conflict (id) do nothing;

create or replace function public.admin_list_ai_maintenance_rules()
returns table (
  id text,
  title text,
  condition text,
  fuel_type text,
  items text[],
  year_operator text,
  year_value integer,
  mileage_operator text,
  mileage_value integer,
  is_visible boolean,
  memo text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  select
    rule.id,
    rule.title,
    rule.condition,
    rule.fuel_type,
    rule.items,
    rule.year_operator,
    rule.year_value,
    rule.mileage_operator,
    rule.mileage_value,
    rule.is_visible,
    rule.memo,
    rule.created_by,
    rule.updated_by,
    rule.created_at,
    rule.updated_at
  from public.admin_ai_maintenance_rules as rule
  order by rule.created_at asc, rule.title asc;
end;
$$;

create or replace function public.admin_upsert_ai_maintenance_rule(
  target_rule_id text default null,
  next_title text default '',
  next_condition text default '',
  next_fuel_type text default '',
  next_items text[] default '{}',
  next_year_operator text default null,
  next_year_value integer default null,
  next_mileage_operator text default null,
  next_mileage_value integer default null,
  next_is_visible boolean default true,
  next_memo text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_id text := coalesce(
    nullif(trim(target_rule_id), ''),
    'custom-maintenance-' || floor(extract(epoch from clock_timestamp()) * 1000)::text
  );
  normalized_title text := nullif(trim(next_title), '');
  normalized_year_operator text := nullif(trim(coalesce(next_year_operator, '')), '');
  normalized_mileage_operator text := nullif(trim(coalesce(next_mileage_operator, '')), '');
  normalized_year_value integer := case
    when nullif(trim(coalesce(next_year_operator, '')), '') is null then null
    else next_year_value
  end;
  normalized_mileage_value integer := case
    when nullif(trim(coalesce(next_mileage_operator, '')), '') is null then null
    else next_mileage_value
  end;
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if normalized_title is null then
    raise exception '룰명이 필요합니다.';
  end if;

  if normalized_year_operator is not null
    and normalized_year_operator not in ('>=', '<=', '=') then
    raise exception '지원하지 않는 연식 연산자입니다.';
  end if;

  if normalized_mileage_operator is not null
    and normalized_mileage_operator not in ('>=', '<=', '=') then
    raise exception '지원하지 않는 주행거리 연산자입니다.';
  end if;

  if normalized_year_operator is not null
    and (normalized_year_value is null or normalized_year_value <= 0) then
    raise exception '연식 조건 값이 필요합니다.';
  end if;

  if normalized_mileage_operator is not null
    and (normalized_mileage_value is null or normalized_mileage_value <= 0) then
    raise exception '주행거리 조건 값이 필요합니다.';
  end if;

  insert into public.admin_ai_maintenance_rules (
    id,
    title,
    condition,
    fuel_type,
    items,
    year_operator,
    year_value,
    mileage_operator,
    mileage_value,
    is_visible,
    memo,
    created_by,
    updated_by
  )
  values (
    normalized_id,
    normalized_title,
    coalesce(next_condition, ''),
    coalesce(next_fuel_type, ''),
    coalesce(next_items, '{}'),
    normalized_year_operator,
    normalized_year_value,
    normalized_mileage_operator,
    normalized_mileage_value,
    coalesce(next_is_visible, true),
    coalesce(next_memo, ''),
    auth.uid(),
    auth.uid()
  )
  on conflict (id) do update
  set
    title = excluded.title,
    condition = excluded.condition,
    fuel_type = excluded.fuel_type,
    items = excluded.items,
    year_operator = excluded.year_operator,
    year_value = excluded.year_value,
    mileage_operator = excluded.mileage_operator,
    mileage_value = excluded.mileage_value,
    is_visible = excluded.is_visible,
    memo = excluded.memo,
    updated_by = auth.uid();

  return normalized_id;
end;
$$;

create or replace function public.admin_delete_ai_maintenance_rule(
  target_rule_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  delete from public.admin_ai_maintenance_rules
  where id = target_rule_id;

  return found;
end;
$$;

revoke all on function public.admin_list_ai_maintenance_rules() from public;
revoke all on function public.admin_upsert_ai_maintenance_rule(
  text,
  text,
  text,
  text,
  text[],
  text,
  integer,
  text,
  integer,
  boolean,
  text
) from public;
revoke all on function public.admin_delete_ai_maintenance_rule(text) from public;

grant execute on function public.admin_list_ai_maintenance_rules() to authenticated;
grant execute on function public.admin_upsert_ai_maintenance_rule(
  text,
  text,
  text,
  text,
  text[],
  text,
  integer,
  text,
  integer,
  boolean,
  text
) to authenticated;
grant execute on function public.admin_delete_ai_maintenance_rule(text) to authenticated;

notify pgrst, 'reload schema';

commit;
