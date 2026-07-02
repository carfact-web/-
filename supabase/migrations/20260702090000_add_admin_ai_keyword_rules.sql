create table if not exists public.admin_ai_keyword_rules (
  id text primary key,
  label text not null,
  include_keywords text[] not null default '{}',
  exclude_keywords text[] not null default '{}',
  category text not null default '',
  fuel_type text not null default '',
  target_model text not null default '',
  is_default_maintenance boolean not null default false,
  is_visible boolean not null default true,
  memo text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_ai_keyword_rules enable row level security;

create index if not exists admin_ai_keyword_rules_visible_created_at_idx
  on public.admin_ai_keyword_rules (is_visible, created_at desc);

create or replace function public.set_admin_ai_keyword_rules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_admin_ai_keyword_rules_updated_at_trigger
  on public.admin_ai_keyword_rules;

create trigger set_admin_ai_keyword_rules_updated_at_trigger
before update on public.admin_ai_keyword_rules
for each row
execute function public.set_admin_ai_keyword_rules_updated_at();

insert into public.admin_ai_keyword_rules (
  id,
  label,
  include_keywords,
  category,
  is_default_maintenance,
  memo
)
values (
  'code-keyword-sunting',
  '썬팅',
  array['썬팅', '선팅', '틴팅', '썬팅 재시공', '선팅 재시공', '틴팅 재시공'],
  '썬팅 상태',
  false,
  '기본 AI 키워드 룰'
)
on conflict (id) do update
set
  label = excluded.label,
  include_keywords = excluded.include_keywords,
  category = excluded.category,
  memo = excluded.memo,
  updated_at = now();

create or replace function public.public_list_ai_keyword_rules()
returns table (
  id text,
  label text,
  include_keywords text[],
  exclude_keywords text[],
  category text,
  fuel_type text,
  target_model text,
  is_default_maintenance boolean,
  is_visible boolean,
  memo text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    rule.id,
    rule.label,
    rule.include_keywords,
    rule.exclude_keywords,
    rule.category,
    rule.fuel_type,
    rule.target_model,
    rule.is_default_maintenance,
    rule.is_visible,
    rule.memo,
    rule.created_at,
    rule.updated_at
  from public.admin_ai_keyword_rules as rule
  where rule.is_visible = true
  order by rule.created_at asc, rule.label asc;
$$;

revoke all on function public.public_list_ai_keyword_rules() from public;
grant execute on function public.public_list_ai_keyword_rules() to anon;
grant execute on function public.public_list_ai_keyword_rules() to authenticated;

create or replace function public.admin_list_ai_keyword_rules()
returns table (
  id text,
  label text,
  include_keywords text[],
  exclude_keywords text[],
  category text,
  fuel_type text,
  target_model text,
  is_default_maintenance boolean,
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
    rule.label,
    rule.include_keywords,
    rule.exclude_keywords,
    rule.category,
    rule.fuel_type,
    rule.target_model,
    rule.is_default_maintenance,
    rule.is_visible,
    rule.memo,
    rule.created_by,
    rule.updated_by,
    rule.created_at,
    rule.updated_at
  from public.admin_ai_keyword_rules as rule
  order by rule.created_at asc, rule.label asc;
end;
$$;

revoke all on function public.admin_list_ai_keyword_rules() from public;
grant execute on function public.admin_list_ai_keyword_rules() to authenticated;

create or replace function public.admin_upsert_ai_keyword_rule(
  target_rule_id text default null,
  next_label text default '',
  next_include_keywords text[] default '{}',
  next_exclude_keywords text[] default '{}',
  next_category text default '',
  next_fuel_type text default '',
  next_target_model text default '',
  next_is_default_maintenance boolean default false,
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
    'custom-keyword-' || floor(extract(epoch from clock_timestamp()) * 1000)::text
  );
  normalized_label text := nullif(trim(next_label), '');
  normalized_include_keywords text[] := (
    select coalesce(array_agg(distinct keyword), '{}')
    from (
      select nullif(trim(keyword), '') as keyword
      from unnest(coalesce(next_include_keywords, '{}')) as keyword
    ) as keywords
    where keyword is not null
  );
  normalized_exclude_keywords text[] := (
    select coalesce(array_agg(distinct keyword), '{}')
    from (
      select nullif(trim(keyword), '') as keyword
      from unnest(coalesce(next_exclude_keywords, '{}')) as keyword
    ) as keywords
    where keyword is not null
  );
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if normalized_label is null then
    raise exception '대표 키워드가 필요합니다.';
  end if;

  if not (normalized_label = any(normalized_include_keywords)) then
    normalized_include_keywords := array_prepend(
      normalized_label,
      normalized_include_keywords
    );
  end if;

  insert into public.admin_ai_keyword_rules (
    id,
    label,
    include_keywords,
    exclude_keywords,
    category,
    fuel_type,
    target_model,
    is_default_maintenance,
    is_visible,
    memo,
    created_by,
    updated_by
  )
  values (
    normalized_id,
    normalized_label,
    normalized_include_keywords,
    normalized_exclude_keywords,
    coalesce(next_category, ''),
    coalesce(next_fuel_type, ''),
    coalesce(next_target_model, ''),
    coalesce(next_is_default_maintenance, false),
    coalesce(next_is_visible, true),
    coalesce(next_memo, ''),
    auth.uid(),
    auth.uid()
  )
  on conflict (id) do update
  set
    label = excluded.label,
    include_keywords = excluded.include_keywords,
    exclude_keywords = excluded.exclude_keywords,
    category = excluded.category,
    fuel_type = excluded.fuel_type,
    target_model = excluded.target_model,
    is_default_maintenance = excluded.is_default_maintenance,
    is_visible = excluded.is_visible,
    memo = excluded.memo,
    updated_by = auth.uid(),
    updated_at = now();

  return normalized_id;
end;
$$;

revoke all on function public.admin_upsert_ai_keyword_rule(
  text,
  text,
  text[],
  text[],
  text,
  text,
  text,
  boolean,
  boolean,
  text
) from public;
grant execute on function public.admin_upsert_ai_keyword_rule(
  text,
  text,
  text[],
  text[],
  text,
  text,
  text,
  boolean,
  boolean,
  text
) to authenticated;

create or replace function public.admin_delete_ai_keyword_rule(
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

  delete from public.admin_ai_keyword_rules
  where id = target_rule_id;

  return found;
end;
$$;

revoke all on function public.admin_delete_ai_keyword_rule(text) from public;
grant execute on function public.admin_delete_ai_keyword_rule(text) to authenticated;
