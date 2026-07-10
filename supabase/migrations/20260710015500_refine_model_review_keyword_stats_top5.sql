drop function if exists public.public_get_model_review_keyword_stats(
  text,
  text,
  text,
  text,
  jsonb,
  integer
);

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
  percentage integer,
  priority integer,
  recent_mentioned_at timestamptz
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
      review.created_at,
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
      trim(coalesce(definition.label, '')) as label,
      public.normalize_model_review_keyword_text(trim(coalesce(definition.label, ''))) as normalized_label,
      case
        when coalesce(array_length(definition.aliases, 1), 0) = 0
          then array[trim(coalesce(definition.label, ''))]
        else definition.aliases
      end as aliases,
      coalesce(definition.exclude_aliases, '{}'::text[]) as exclude_aliases,
      trim(coalesce(definition.fuel_type, '')) as fuel_type,
      trim(coalesce(definition.target_model, '')) as target_model,
      coalesce(definition.priority, 0) as priority
    from jsonb_to_recordset(coalesce(p_keyword_definitions, '[]'::jsonb))
      as definition(
        label text,
        aliases text[],
        exclude_aliases text[],
        fuel_type text,
        target_model text,
        priority integer
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
  definition_aliases as (
    select
      definition.label,
      definition.normalized_label,
      definition.exclude_aliases,
      definition.priority,
      public.normalize_model_review_keyword_text(alias.value) as normalized_alias,
      nullif(
        replace(
          public.normalize_model_review_keyword_text(alias.value),
          definition.normalized_label,
          ''
        ),
        ''
      ) as specific_label
    from eligible_definitions as definition
    cross join unnest(definition.aliases) as alias(value)
    where public.normalize_model_review_keyword_text(alias.value) <> ''
  ),
  excluded_review_labels as (
    select distinct
      review.id as review_id,
      definition.label
    from model_reviews as review
    join eligible_definitions as definition
      on exists (
        select 1
        from unnest(definition.exclude_aliases) as excluded_alias(value)
        where public.normalize_model_review_keyword_text(excluded_alias.value) <> ''
          and review.normalized_content like '%' || public.normalize_model_review_keyword_text(excluded_alias.value) || '%'
      )
  ),
  representative_matches as (
    select distinct
      review.id as review_id,
      review.created_at,
      alias.label as keyword_label,
      alias.priority
    from model_reviews as review
    join definition_aliases as alias
      on review.normalized_content like '%' || alias.normalized_alias || '%'
    left join excluded_review_labels as excluded
      on excluded.review_id = review.id
      and excluded.label = alias.label
    where excluded.review_id is null
  ),
  specific_matches as (
    select distinct
      review.id as review_id,
      review.created_at,
      alias.specific_label as keyword_label,
      alias.priority
    from model_reviews as review
    join definition_aliases as alias
      on alias.specific_label is not null
      and alias.label in ('누수', '누유', '외관')
      and alias.specific_label not in ('미세')
      and (
        review.normalized_content like '%' || alias.normalized_alias || '%' or
        (
          review.normalized_content like '%' || alias.specific_label || '%' and
          review.normalized_content like '%' || alias.normalized_label || '%'
        )
      )
    left join excluded_review_labels as excluded
      on excluded.review_id = review.id
      and excluded.label = alias.label
    where excluded.review_id is null
  ),
  matched_review_keywords as (
    select * from representative_matches
    union
    select * from specific_matches
  ),
  grouped_keywords as (
    select
      matched.keyword_label,
      count(distinct matched.review_id)::integer as mention_count,
      max(matched.priority)::integer as priority,
      max(matched.created_at) as recent_mentioned_at
    from matched_review_keywords as matched
    group by matched.keyword_label
  ),
  ranked_keywords as (
    select
      grouped.keyword_label,
      grouped.mention_count,
      case
        when total.review_count = 0 then 0
        else round((grouped.mention_count::numeric / total.review_count::numeric) * 100)::integer
      end as percentage,
      total.review_count,
      grouped.priority,
      grouped.recent_mentioned_at
    from grouped_keywords as grouped
    cross join total_reviews as total
    order by
      grouped.mention_count desc,
      grouped.priority desc,
      grouped.recent_mentioned_at desc,
      grouped.keyword_label asc
    limit greatest(coalesce(p_limit, 5), 0)
  )
  select
    result.keyword_label,
    result.mention_count,
    result.model_review_count,
    result.percentage,
    result.priority,
    result.recent_mentioned_at
  from (
    select
      ranked.keyword_label,
      ranked.mention_count,
      ranked.review_count as model_review_count,
      ranked.percentage,
      ranked.priority,
      ranked.recent_mentioned_at
    from ranked_keywords as ranked
    union all
    select
      null::text as keyword_label,
      0::integer as mention_count,
      total.review_count as model_review_count,
      0::integer as percentage,
      0::integer as priority,
      null::timestamptz as recent_mentioned_at
    from total_reviews as total
    where not exists (select 1 from ranked_keywords)
  ) as result
  order by
    result.keyword_label is null,
    result.mention_count desc,
    result.priority desc,
    result.recent_mentioned_at desc,
    result.keyword_label asc;
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
