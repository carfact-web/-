begin;

alter table public.page_views
  add column if not exists referrer_channel text not null default 'Direct',
  add column if not exists referrer_keyword text not null default 'not provided',
  add column if not exists landing_page text;

create index if not exists page_views_referrer_channel_created_at_idx
  on public.page_views (referrer_channel, created_at desc);

create index if not exists page_views_referrer_keyword_created_at_idx
  on public.page_views (referrer_keyword, created_at desc);

create index if not exists page_views_landing_page_created_at_idx
  on public.page_views (landing_page, created_at desc)
  where landing_page is not null;

create or replace function public.url_decode_query_component(source_text text)
returns text
language plpgsql
immutable
as $$
declare
  normalized_text text := replace(coalesce(source_text, ''), '+', ' ');
  output_bytes bytea := decode('', 'hex');
  cursor_pos integer := 1;
  current_char text;
  hex_value text;
begin
  while cursor_pos <= length(normalized_text) loop
    current_char := substr(normalized_text, cursor_pos, 1);
    hex_value := substr(normalized_text, cursor_pos + 1, 2);

    if current_char = '%'
      and length(hex_value) = 2
      and hex_value ~ '^[0-9A-Fa-f]{2}$' then
      output_bytes := output_bytes || decode(hex_value, 'hex');
      cursor_pos := cursor_pos + 3;
    else
      output_bytes := output_bytes || convert_to(current_char, 'UTF8');
      cursor_pos := cursor_pos + 1;
    end if;
  end loop;

  return convert_from(output_bytes, 'UTF8');
exception
  when others then
    return normalized_text;
end;
$$;

create or replace function public.get_query_param_value(
  source_text text,
  param_names text[]
)
returns text
language plpgsql
immutable
as $$
declare
  matched text[];
  param_pattern text;
  raw_value text;
begin
  if nullif(trim(coalesce(source_text, '')), '') is null then
    return null;
  end if;

  param_pattern := '(^|[?&])(' || array_to_string(param_names, '|') || ')=([^&#]+)';
  matched := regexp_match(source_text, param_pattern, 'i');

  if matched is null then
    return null;
  end if;

  raw_value := matched[3];

  return nullif(trim(public.url_decode_query_component(raw_value)), '');
end;
$$;

create or replace function public.normalize_referrer_channel(
  referrer text,
  path text
)
returns text
language plpgsql
immutable
as $$
declare
  utm_source text := lower(coalesce(
    public.get_query_param_value(path, array['utm_source', 'source']),
    public.get_query_param_value(referrer, array['utm_source', 'source']),
    ''
  ));
  normalized_referrer text := lower(coalesce(referrer, ''));
  channel_source text;
begin
  channel_source := utm_source || ' ' || normalized_referrer;

  if nullif(trim(utm_source), '') is null
    and nullif(trim(normalized_referrer), '') is null then
    return 'Direct';
  end if;

  if normalized_referrer like '%carfact.kr%'
    or normalized_referrer like '%www.carfact.kr%'
    or normalized_referrer like '%carfact.co.kr%'
    or normalized_referrer like '%carfact-web.vercel.app%' then
    return 'Internal';
  end if;

  if channel_source like '%google%' then
    return 'Google';
  end if;

  if channel_source like '%naver%' then
    return 'Naver';
  end if;

  if channel_source like '%daum%' then
    return 'Daum';
  end if;

  if channel_source like '%bing%' then
    return 'Bing';
  end if;

  if channel_source like '%facebook%'
    or channel_source like '%instagram%'
    or channel_source like '%threads%'
    or channel_source like '%twitter%'
    or channel_source like '%x.com%'
    or channel_source like '%t.co%'
    or channel_source like '%kakao%'
    or channel_source like '%youtube%'
    or channel_source like '%linkedin%' then
    return 'SNS';
  end if;

  return 'External';
end;
$$;

create or replace function public.extract_referrer_keyword(
  referrer text,
  path text
)
returns text
language plpgsql
immutable
as $$
declare
  keyword_params text[] := array[
    'utm_term',
    'utm_keyword',
    'utm_content',
    'keyword',
    'query',
    'q',
    'search',
    'n_query',
    'p'
  ];
  extracted_keyword text;
begin
  extracted_keyword := coalesce(
    public.get_query_param_value(path, keyword_params),
    public.get_query_param_value(referrer, keyword_params)
  );

  return coalesce(nullif(lower(trim(extracted_keyword)), ''), 'not provided');
end;
$$;

update public.page_views
set
  referrer_channel = public.normalize_referrer_channel(referrer, path),
  referrer_keyword = public.extract_referrer_keyword(referrer, path),
  landing_page = coalesce(nullif(path, ''), '/')
where referrer_channel = 'Direct'
  and referrer_keyword = 'not provided'
  and landing_page is null;

revoke all on function public.url_decode_query_component(text) from public;
revoke all on function public.get_query_param_value(text, text[]) from public;
revoke all on function public.normalize_referrer_channel(text, text) from public;
revoke all on function public.extract_referrer_keyword(text, text) from public;

notify pgrst, 'reload schema';

commit;
