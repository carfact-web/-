-- PDF extension; production application requires explicit approval.
begin;
alter table public.webtoon_episodes add column content_type text not null default 'images' check(content_type in ('images','pdf'));
alter table public.webtoon_episodes add column pdf_asset_id uuid references public.webtoon_assets(id) on delete restrict;
alter table public.webtoon_episodes add constraint webtoon_pdf_publication check((content_type='images' and pdf_asset_id is null) or (content_type='pdf' and (not published or pdf_asset_id is not null)));
create index on public.webtoon_episodes(pdf_asset_id);
alter table public.webtoon_assets alter column width drop not null;
alter table public.webtoon_assets alter column height drop not null;
alter table public.webtoon_assets add column page_count integer;
alter table public.webtoon_assets add column page_sizes jsonb;
alter table public.webtoon_assets drop constraint webtoon_assets_mime_check;
alter table public.webtoon_assets drop constraint webtoon_assets_bytes_check;
alter table public.webtoon_assets add constraint webtoon_asset_content check(bytes>0 and (
 (mime='image/webp' and bytes<=10485760 and width is not null and height is not null and page_count is null and page_sizes is null)
 or (mime='application/pdf' and bytes<=52428800 and width is null and height is null and page_count is not null and page_count between 1 and 200 and page_sizes is not null and jsonb_typeof(page_sizes)='array' and jsonb_array_length(page_sizes)=page_count)));
update storage.buckets set file_size_limit=52428800,allowed_mime_types=array['image/webp','application/pdf'] where id='webtoon-private';
drop policy "Published webtoon assets" on public.webtoon_assets;
create policy "Published webtoon assets" on public.webtoon_assets for select using(public.webtoon_is_admin() or (state='ready' and (
 exists(select 1 from public.webtoon_works w where w.cover_asset_id=webtoon_assets.id and w.published)
 or exists(select 1 from public.webtoon_episode_pages p join public.webtoon_episodes e on e.id=p.episode_id join public.webtoon_works w on w.id=e.work_id where p.asset_id=webtoon_assets.id and e.content_type='images' and e.published and w.published)
 or exists(select 1 from public.webtoon_episodes e join public.webtoon_works w on w.id=e.work_id where e.pdf_asset_id=webtoon_assets.id and e.content_type='pdf' and e.published and w.published))));
drop function public.webtoon_save_episode(uuid,integer,text,integer,boolean,uuid[]);
create function public.webtoon_save_episode(p_id uuid,p_version integer,p_title text,p_number integer,p_published boolean,p_assets uuid[],p_type text default 'images',p_pdf uuid default null)
returns public.webtoon_episodes language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.webtoon_episodes; n integer; owning_work uuid;
begin
 select work_id into owning_work from webtoon_episodes where id=p_id;
 if not found then raise exception 'not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owning_work::text,928341));
 select * into result from webtoon_episodes where id=p_id for update;
 if result.version<>p_version then raise exception 'edit_conflict'; end if;
 if p_type not in ('images','pdf') or p_assets is null then raise exception 'invalid_pages'; end if;
 if p_type='pdf' then
  if cardinality(p_assets)<>0 or (p_published and p_pdf is null) then raise exception 'invalid_pdf'; end if;
  if p_pdf is not null then
   perform 1 from webtoon_assets where id=p_pdf and work_id=result.work_id and state='ready' and mime='application/pdf' for update;
   if not found then raise exception 'invalid_asset'; end if;
  end if;
 else
  if p_pdf is not null or cardinality(p_assets)>100 or (p_published and cardinality(p_assets)=0) then raise exception 'invalid_pages'; end if;
  if cardinality(p_assets)<>(select count(distinct x) from unnest(p_assets) x) then raise exception 'duplicate_pages'; end if;
  perform 1 from webtoon_assets where id=any(p_assets) order by id for update;
  select count(*) into n from webtoon_assets where id=any(p_assets) and work_id=result.work_id and state='ready' and mime='image/webp';
  if n<>cardinality(p_assets) then raise exception 'invalid_asset'; end if;
 end if;
 delete from webtoon_episode_pages where episode_id=p_id;
 if p_type='images' then insert into webtoon_episode_pages(episode_id,asset_id,position) select p_id,x,(ord-1)::integer from unnest(p_assets) with ordinality as t(x,ord); end if;
 update webtoon_episodes set title=btrim(p_title),number=p_number,published=p_published,content_type=p_type,pdf_asset_id=p_pdf,version=version+1,updated_at=now() where id=p_id returning * into result;
 return result;
end;$$;
revoke all on function public.webtoon_save_episode(uuid,integer,text,integer,boolean,uuid[],text,uuid) from public,anon,authenticated;
grant execute on function public.webtoon_save_episode(uuid,integer,text,integer,boolean,uuid[],text,uuid) to service_role;
create or replace function public.webtoon_save_work(p_id uuid,p_version integer,p_title text,p_description text,p_cover uuid,p_published boolean)
returns public.webtoon_works language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.webtoon_works;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,928341));
 select * into result from webtoon_works where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if result.version<>p_version then raise exception 'edit_conflict'; end if;
 if p_cover is not null then
  perform 1 from webtoon_assets where id=p_cover and work_id=p_id and state='ready' and mime='image/webp' for update;
  if not found then raise exception 'invalid_asset'; end if;
 end if;
 if p_published and p_cover is null then raise exception 'cover_required'; end if;
 update webtoon_works set title=btrim(p_title),description=p_description,cover_asset_id=p_cover,published=p_published,version=version+1,updated_at=now() where id=p_id returning * into result;
 return result;
end;$$;

create or replace function public.webtoon_claim_orphans(p_work uuid) returns setof public.webtoon_assets language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_work::text,928341));
 return query update webtoon_assets a set state='deleting' where a.id in (
  select x.id from webtoon_assets x where x.work_id=p_work and x.created_at<now()-interval '24 hours'
  and not exists(select 1 from webtoon_works w where w.cover_asset_id=x.id)
  and not exists(select 1 from webtoon_episode_pages p where p.asset_id=x.id)
  and not exists(select 1 from webtoon_episodes e where e.pdf_asset_id=x.id)
  order by x.id for update skip locked
 ) returning a.*;
end;$$;
commit;
