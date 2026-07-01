begin;

create table if not exists public.knowledge_terms (
  id uuid primary key default gen_random_uuid(),
  category text not null
    check (
      category in (
        '증상',
        '부품',
        '시스템',
        '정비용어',
        '경고등',
        '보험',
        '성능기록부',
        '일반'
      )
  ),
  representative_name text not null,
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  main_causes text[] not null default '{}',
  main_symptoms text[] not null default '{}',
  maintenance_tips text[] not null default '{}',
  expected_repair_cost text not null default '',
  related_keywords text[] not null default '{}',
  related_models text[] not null default '{}',
  priority integer not null default 0 check (priority >= 0),
  view_count integer not null default 0 check (view_count >= 0),
  is_visible boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_terms enable row level security;

create index if not exists knowledge_terms_category_updated_at_idx
  on public.knowledge_terms (category, updated_at desc);

create index if not exists knowledge_terms_visible_updated_at_idx
  on public.knowledge_terms (is_visible, updated_at desc);

create index if not exists knowledge_terms_priority_updated_at_idx
  on public.knowledge_terms (priority desc, updated_at desc);

create index if not exists knowledge_terms_representative_name_idx
  on public.knowledge_terms (lower(representative_name));

create index if not exists knowledge_terms_slug_idx
  on public.knowledge_terms (slug);

create index if not exists knowledge_terms_related_keywords_idx
  on public.knowledge_terms using gin (related_keywords);

create index if not exists knowledge_terms_related_models_idx
  on public.knowledge_terms using gin (related_models);

create or replace function public.set_knowledge_terms_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_knowledge_terms_updated_at_trigger on public.knowledge_terms;

create trigger set_knowledge_terms_updated_at_trigger
before update on public.knowledge_terms
for each row
execute function public.set_knowledge_terms_updated_at();

create or replace function public.admin_list_knowledge_terms(
  search_text text default '',
  sort_key text default 'updated_desc'
)
returns table (
  id uuid,
  category text,
  representative_name text,
  slug text,
  description text,
  main_causes text[],
  main_symptoms text[],
  maintenance_tips text[],
  expected_repair_cost text,
  related_keywords text[],
  related_models text[],
  priority integer,
  view_count integer,
  is_visible boolean,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_search text := lower(trim(coalesce(search_text, '')));
  normalized_sort text := coalesce(nullif(trim(sort_key), ''), 'updated_desc');
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  return query
  select
    term.id,
    term.category,
    term.representative_name,
    term.slug,
    term.description,
    term.main_causes,
    term.main_symptoms,
    term.maintenance_tips,
    term.expected_repair_cost,
    term.related_keywords,
    term.related_models,
    term.priority,
    term.view_count,
    term.is_visible,
    term.created_by,
    term.updated_by,
    term.created_at,
    term.updated_at
  from public.knowledge_terms as term
  where normalized_search = ''
    or lower(term.category) like '%' || normalized_search || '%'
    or lower(term.representative_name) like '%' || normalized_search || '%'
    or lower(term.slug) like '%' || normalized_search || '%'
    or lower(term.description) like '%' || normalized_search || '%'
    or lower(term.expected_repair_cost) like '%' || normalized_search || '%'
    or term.priority::text like '%' || normalized_search || '%'
    or term.view_count::text like '%' || normalized_search || '%'
    or lower(array_to_string(term.main_causes, ' ')) like '%' || normalized_search || '%'
    or lower(array_to_string(term.main_symptoms, ' ')) like '%' || normalized_search || '%'
    or lower(array_to_string(term.maintenance_tips, ' ')) like '%' || normalized_search || '%'
    or lower(array_to_string(term.related_keywords, ' ')) like '%' || normalized_search || '%'
    or lower(array_to_string(term.related_models, ' ')) like '%' || normalized_search || '%'
  order by
    case when normalized_sort = 'name_asc' then term.representative_name end asc,
    case when normalized_sort = 'category_asc' then term.category end asc,
    case when normalized_sort = 'visible_first' then term.is_visible end desc,
    case when normalized_sort = 'updated_asc' then term.updated_at end asc,
    term.updated_at desc,
    term.representative_name asc
  limit 500;
end;
$$;

create or replace function public.admin_upsert_knowledge_term(
  target_term_id uuid default null,
  next_category text default '일반',
  next_representative_name text default '',
  next_slug text default '',
  next_description text default '',
  next_main_causes text[] default '{}',
  next_main_symptoms text[] default '{}',
  next_maintenance_tips text[] default '{}',
  next_expected_repair_cost text default '',
  next_related_keywords text[] default '{}',
  next_related_models text[] default '{}',
  next_priority integer default 0,
  next_is_visible boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_id uuid := target_term_id;
  normalized_category text := coalesce(nullif(trim(next_category), ''), '일반');
  normalized_name text := nullif(trim(next_representative_name), '');
  normalized_slug text := nullif(lower(trim(next_slug)), '');
  normalized_priority integer := greatest(coalesce(next_priority, 0), 0);
  saved_id uuid;
begin
  if not public.current_user_has_admin_role() then
    raise exception '관리자 권한이 필요합니다.';
  end if;

  if normalized_category not in (
    '증상',
    '부품',
    '시스템',
    '정비용어',
    '경고등',
    '보험',
    '성능기록부',
    '일반'
  ) then
    raise exception '지원하지 않는 Knowledge 분류입니다.';
  end if;

  if normalized_name is null then
    raise exception '대표명이 필요합니다.';
  end if;

  if normalized_slug is null then
    raise exception 'slug가 필요합니다.';
  end if;

  if normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'slug는 소문자 영문, 숫자, 하이픈만 사용할 수 있습니다.';
  end if;

  if normalized_id is null then
    insert into public.knowledge_terms (
      category,
      representative_name,
      slug,
      description,
      main_causes,
      main_symptoms,
      maintenance_tips,
      expected_repair_cost,
      related_keywords,
      related_models,
      priority,
      is_visible,
      created_by,
      updated_by
    )
    values (
      normalized_category,
      normalized_name,
      normalized_slug,
      coalesce(next_description, ''),
      coalesce(next_main_causes, '{}'),
      coalesce(next_main_symptoms, '{}'),
      coalesce(next_maintenance_tips, '{}'),
      coalesce(next_expected_repair_cost, ''),
      coalesce(next_related_keywords, '{}'),
      coalesce(next_related_models, '{}'),
      normalized_priority,
      coalesce(next_is_visible, true),
      auth.uid(),
      auth.uid()
    )
    returning id into saved_id;

    return saved_id;
  end if;

  update public.knowledge_terms
  set
    category = normalized_category,
    representative_name = normalized_name,
    slug = normalized_slug,
    description = coalesce(next_description, ''),
    main_causes = coalesce(next_main_causes, '{}'),
    main_symptoms = coalesce(next_main_symptoms, '{}'),
    maintenance_tips = coalesce(next_maintenance_tips, '{}'),
    expected_repair_cost = coalesce(next_expected_repair_cost, ''),
    related_keywords = coalesce(next_related_keywords, '{}'),
    related_models = coalesce(next_related_models, '{}'),
    priority = normalized_priority,
    is_visible = coalesce(next_is_visible, true),
    updated_by = auth.uid()
  where id = normalized_id
  returning id into saved_id;

  if saved_id is null then
    raise exception '대상 Knowledge 항목을 찾지 못했습니다.';
  end if;

  return saved_id;
end;
$$;

create or replace function public.admin_delete_knowledge_term(
  target_term_id uuid
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

  delete from public.knowledge_terms
  where id = target_term_id;

  return found;
end;
$$;

revoke all on function public.admin_list_knowledge_terms(text, text) from public;
revoke all on function public.admin_upsert_knowledge_term(
  uuid,
  text,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text,
  text[],
  text[],
  integer,
  boolean
) from public;
revoke all on function public.admin_delete_knowledge_term(uuid) from public;

grant execute on function public.admin_list_knowledge_terms(text, text) to authenticated;
grant execute on function public.admin_upsert_knowledge_term(
  uuid,
  text,
  text,
  text,
  text,
  text[],
  text[],
  text[],
  text,
  text[],
  text[],
  integer,
  boolean
) to authenticated;
grant execute on function public.admin_delete_knowledge_term(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
