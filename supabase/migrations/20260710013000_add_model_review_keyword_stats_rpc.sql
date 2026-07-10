create or replace function public.normalize_model_review_key_text(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    regexp_replace(lower(coalesce(value, '')), '\s+', '', 'g'),
    '[^0-9a-zㄱ-ㅎ가-힣]+',
    '',
    'g'
  );
$$;

create or replace function public.normalize_model_review_keyword_text(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
    lower(coalesce(value, '')),
    '[^0-9a-z가-힣]+',
    '',
    'g'
  );
$$;

create or replace function public.public_get_model_review_keyword_stats(
  p_manufacturer text,
  p_model text,
  p_generation text default '',
  p_fuel_type text default '',
  p_keyword_definitions jsonb default '[]'::jsonb,
  p_limit integer default 5
)
returns table (
  keyword_label text,
  mention_count integer,
  model_review_count integer,
  percentage integer
)
language sql
security definer
set search_path = public
as $$
  with input_vehicle as (
    select
      public.normalize_model_review_key_text(p_manufacturer) as manufacturer_key,
      public.normalize_model_review_key_text(p_model) as model_key,
      public.normalize_model_review_key_text(p_generation) as generation_key,
      public.normalize_model_review_keyword_text(p_fuel_type) as fuel_key,
      (
        public.normalize_model_review_keyword_text(p_fuel_type) like '%디젤%' or
        public.normalize_model_review_keyword_text(p_fuel_type) like '%경유%' or
        public.normalize_model_review_keyword_text(p_fuel_type) like '%diesel%'
      ) as is_diesel
  ),
  matched_vehicles as (
    select vehicle.id
    from public.vehicles as vehicle
    cross join input_vehicle as input
    where public.normalize_model_review_key_text(vehicle.manufacturer) = input.manufacturer_key
      and public.normalize_model_review_key_text(vehicle.model) = input.model_key
      and public.normalize_model_review_key_text(coalesce(vehicle.generation, '')) = input.generation_key
  ),
  model_reviews as (
    select
      review.id,
      public.normalize_model_review_keyword_text(review.content) as normalized_content
    from public.reviews as review
    join matched_vehicles as vehicle on vehicle.id = review.vehicle_id
    where coalesce(review.is_hidden, false) = false
  ),
  total_reviews as (
    select count(*)::integer as review_count
    from model_reviews
  ),
  raw_definitions as (
    select
      coalesce(definition.sort_order, 2147483647) as sort_order,
      trim(coalesce(definition.label, '')) as label,
      case
        when coalesce(array_length(definition.aliases, 1), 0) = 0
          then array[trim(coalesce(definition.label, ''))]
        else definition.aliases
      end as aliases,
      coalesce(definition.exclude_aliases, '{}'::text[]) as exclude_aliases,
      trim(coalesce(definition.fuel_type, '')) as fuel_type,
      trim(coalesce(definition.target_model, '')) as target_model
    from jsonb_to_recordset(coalesce(p_keyword_definitions, '[]'::jsonb))
      as definition(
        label text,
        aliases text[],
        exclude_aliases text[],
        fuel_type text,
        target_model text,
        sort_order integer
      )
    where trim(coalesce(definition.label, '')) <> ''
  ),
  eligible_definitions as (
    select definition.*
    from raw_definitions as definition
    cross join input_vehicle as input
    where (
        public.normalize_model_review_keyword_text(definition.fuel_type) = '' or
        input.fuel_key like '%' || public.normalize_model_review_keyword_text(definition.fuel_type) || '%'
      )
      and (
        public.normalize_model_review_key_text(definition.target_model) = '' or
        (input.model_key || input.generation_key) like '%' || public.normalize_model_review_key_text(definition.target_model) || '%'
      )
      and (
        input.is_diesel or
        definition.label not in ('DPF', 'SCR', '고압펌프', 'EGR', '매연', '촉매')
      )
  ),
  matched_review_keywords as (
    select distinct
      review.id as review_id,
      definition.label,
      definition.sort_order
    from model_reviews as review
    join eligible_definitions as definition
      on exists (
        select 1
        from unnest(definition.aliases) as alias(value)
        where public.normalize_model_review_keyword_text(alias.value) <> ''
          and review.normalized_content like '%' || public.normalize_model_review_keyword_text(alias.value) || '%'
      )
    where not exists (
      select 1
      from unnest(definition.exclude_aliases) as excluded_alias(value)
      where public.normalize_model_review_keyword_text(excluded_alias.value) <> ''
        and review.normalized_content like '%' || public.normalize_model_review_keyword_text(excluded_alias.value) || '%'
    )
  ),
  grouped_keywords as (
    select
      matched.label,
      min(matched.sort_order) as sort_order,
      count(distinct matched.review_id)::integer as mention_count
    from matched_review_keywords as matched
    group by matched.label
  ),
  ranked_keywords as (
    select
      grouped.label,
      grouped.mention_count,
      case
        when total.review_count = 0 then 0
        else round((grouped.mention_count::numeric / total.review_count::numeric) * 100)::integer
      end as percentage,
      total.review_count,
      grouped.sort_order
    from grouped_keywords as grouped
    cross join total_reviews as total
    order by grouped.mention_count desc, grouped.sort_order asc, grouped.label asc
    limit greatest(coalesce(p_limit, 5), 0)
  )
  select
    result.keyword_label,
    result.mention_count,
    result.model_review_count,
    result.percentage
  from (
    select
      ranked.label as keyword_label,
      ranked.mention_count,
      ranked.review_count as model_review_count,
      ranked.percentage
    from ranked_keywords as ranked
    union all
    select
      null::text as keyword_label,
      0::integer as mention_count,
      total.review_count as model_review_count,
      0::integer as percentage
    from total_reviews as total
    where not exists (select 1 from ranked_keywords)
  ) as result
  order by result.keyword_label is null, result.mention_count desc, result.keyword_label asc;
$$;

revoke all on function public.public_get_model_review_keyword_stats(
  text,
  text,
  text,
  text,
  jsonb,
  integer
) from public;
grant execute on function public.public_get_model_review_keyword_stats(
  text,
  text,
  text,
  text,
  jsonb,
  integer
) to anon;
grant execute on function public.public_get_model_review_keyword_stats(
  text,
  text,
  text,
  text,
  jsonb,
  integer
) to authenticated;
