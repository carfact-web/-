-- Staged edits preserve live assets until a validated atomic commit.
begin;
alter table public.webtoon_upload_drafts drop constraint webtoon_upload_drafts_episode_id_key;
create index webtoon_drafts_episode on public.webtoon_upload_drafts(episode_id);
alter table public.webtoon_upload_drafts add column mode text not null default 'create' check(mode in ('create','edit'));
alter table public.webtoon_upload_drafts add column baseline jsonb not null default '{}';
alter table public.webtoon_episodes add column cover_asset_id uuid references public.webtoon_assets(id) on delete restrict;
create index webtoon_episode_cover on public.webtoon_episodes(cover_asset_id);
create function public.webtoon_start_edit(p_id uuid,p_owner uuid,p_episode uuid)
returns public.webtoon_upload_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d webtoon_upload_drafts; e webtoon_episodes; w webtoon_works; p webtoon_promotion; jobs jsonb; pages uuid[]; cover uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,713503));
 select * into d from webtoon_upload_drafts where id=p_id;
 if found then
  if d.owner_id<>p_owner or d.mode<>'edit' or d.episode_id<>p_episode then raise exception 'not_found'; end if;
  return d;
 end if;
 select * into e from webtoon_episodes where id=p_episode;
 if not found then raise exception 'not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(e.work_id::text,928341));
 select * into e from webtoon_episodes where id=p_episode for update;
 select * into w from webtoon_works where id=e.work_id for update;
 select * into p from webtoon_promotion where id=1;
 cover:=coalesce(e.cover_asset_id,w.cover_asset_id);
 select coalesce(array_agg(asset_id order by position),'{}'::uuid[]) into pages from webtoon_episode_pages where episode_id=e.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',case when a.mime='application/pdf' then '현재 PDF' else '현재 이미지 '||t.ord end,'size',a.bytes,'sha256','existing:'||a.id,'type',a.mime,'asset',to_jsonb(a)) order by t.ord),'[]') into jobs
 from unnest(case when e.content_type='pdf' and e.pdf_asset_id is not null then array[e.pdf_asset_id] else pages end) with ordinality t(id,ord) join webtoon_assets a on a.id=t.id;
 insert into webtoon_upload_drafts(id,owner_id,work_id,episode_id,owns_work,mode,baseline,data)
 values(p_id,p_owner,e.work_id,e.id,false,'edit',jsonb_build_object('episodeVersion',e.version,'workVersion',w.version,'promotion',to_jsonb(p),'assetIds',to_jsonb(pages||array_remove(array[e.pdf_asset_id,cover],null))),
 jsonb_build_object('jobs',jobs,'pageIds',to_jsonb(pages),'pdfAssetId',e.pdf_asset_id,'coverAssetId',cover,'coverUploadId',gen_random_uuid(),'title',e.title,'published',e.published and w.published,'popup',p.enabled and p.episode_id=e.id,'message',case when p.episode_id=e.id then p.message else '' end,'startsAt',case when p.episode_id=e.id then p.starts_at::text else '' end,'endsAt',case when p.episode_id=e.id then p.ends_at::text else '' end,'ready',cover is not null and jsonb_array_length(jobs)>0)) returning * into d;
 return d;
end;$$;
revoke all on function public.webtoon_start_edit(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.webtoon_start_edit(uuid,uuid,uuid) to service_role;
create function public.webtoon_commit_edit(p_id uuid,p_owner uuid,p_version integer,p_title text,p_published boolean,p_popup boolean,p_message text,p_start timestamptz,p_end timestamptz)
returns public.webtoon_upload_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d webtoon_upload_drafts; e webtoon_episodes; w webtoon_works; promo webtoon_promotion; oldpromo jsonb; pages uuid[]; pdf uuid; cover uuid; change_popup boolean; single_post boolean;
begin
 select * into d from webtoon_upload_drafts where id=p_id and owner_id=p_owner and mode='edit' for update;
 if not found then raise exception 'not_found'; end if;
 if d.status='published' then return d; end if;
 if d.status<>'editing' or d.version<>p_version then raise exception 'edit_conflict'; end if;
 if length(btrim(p_title)) not between 1 and 120 then raise exception 'invalid_title'; end if;
 if coalesce((d.data->>'ready')::boolean,false)<>true then raise exception 'invalid_pages'; end if;
 perform pg_advisory_xact_lock(hashtextextended(d.work_id::text,928341));
 select * into e from webtoon_episodes where id=d.episode_id for update;
 select * into w from webtoon_works where id=d.work_id for update;
 if e.version<>(d.baseline->>'episodeVersion')::integer or w.version<>(d.baseline->>'workVersion')::integer then raise exception 'edit_conflict'; end if;
 oldpromo:=d.baseline->'promotion';
 change_popup:=p_popup<>coalesce((oldpromo->>'enabled')::boolean and (oldpromo->>'episode_id')::uuid=e.id,false)
 or (p_popup and (p_message is distinct from oldpromo->>'message' or p_start is distinct from (oldpromo->>'starts_at')::timestamptz or p_end is distinct from (oldpromo->>'ends_at')::timestamptz));
 if change_popup then
  select * into promo from webtoon_promotion where id=1 for update;
  if promo.version<>(oldpromo->>'version')::integer then raise exception 'edit_conflict'; end if;
 end if;
 if p_popup and not p_published then raise exception 'invalid_popup'; end if;
 if p_popup and change_popup and (p_start is null or p_end is null or p_end<=p_start or length(btrim(p_message)) not between 1 and 280) then raise exception 'invalid_popup'; end if;
 select coalesce(array_agg(x::uuid),'{}'::uuid[]) into pages from jsonb_array_elements_text(coalesce(d.data->'pageIds','[]')) x;
 pdf:=nullif(d.data->>'pdfAssetId','')::uuid;cover:=nullif(d.data->>'coverAssetId','')::uuid;
 perform 1 from webtoon_assets where id=cover and work_id=w.id and state='ready' and mime='image/webp' for update;
 if not found then raise exception 'cover_required'; end if;
 select count(*)=1 into single_post from webtoon_episodes where work_id=w.id;
 if p_published and not w.published and not single_post then raise exception 'series_private'; end if;
 perform webtoon_save_episode(e.id,e.version,btrim(p_title),e.number,p_published,case when pdf is null then pages else '{}'::uuid[] end,case when pdf is null then 'images' else 'pdf' end,pdf);
 update webtoon_episodes set cover_asset_id=cover where id=e.id;
 if single_post then perform webtoon_save_work(w.id,w.version,btrim(p_title),w.description,cover,p_published); end if;
 if change_popup then
  -- Metadata-only saves never touch popup version or schedule. Explicit changes do.
  if p_popup then
   update webtoon_promotion set enabled=true,episode_id=e.id,message=btrim(p_message),starts_at=p_start,ends_at=p_end,version=version+1,updated_at=now() where id=1;
  elsif promo.episode_id=e.id then
   update webtoon_promotion set enabled=false,version=version+1,updated_at=now() where id=1 and enabled;
  end if;
 end if;
 update webtoon_upload_drafts set status='published',version=version+1,updated_at=now() where id=d.id returning * into d;
 return d;
end;$$;
revoke all on function public.webtoon_commit_edit(uuid,uuid,integer,text,boolean,boolean,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.webtoon_commit_edit(uuid,uuid,integer,text,boolean,boolean,text,timestamptz,timestamptz) to service_role;
-- A publication date is set once. Editing/unpublishing/republishing preserves it.
create or replace function public.webtoon_stamp_publication() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if tg_op='UPDATE' and old.published_at is not null then new.published_at:=old.published_at;
 elsif new.published then new.published_at:=statement_timestamp(); end if;
 return new;
end;$$;
create or replace function public.webtoon_promotion_card(p_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('episodeId',e.id,'workId',w.id,'workTitle',w.title,'episodeTitle',e.title,'description',left(w.description,180),'publishedAt',e.published_at,'contentType',e.content_type,'coverUrl','/api/webtoons/promotion/cover/'||e.id,'href','/webtoons/'||w.id||'/episodes/'||e.id)
 from webtoon_episodes e join webtoon_works w on w.id=e.work_id
 join webtoon_assets cover on cover.id=coalesce(e.cover_asset_id,w.cover_asset_id) and cover.work_id=w.id and cover.mime='image/webp' and cover.state='ready'
 where e.id=p_id and e.published and w.published and e.published_at is not null
 and ((e.content_type='images' and exists(select 1 from webtoon_episode_pages p join webtoon_assets a on a.id=p.asset_id where p.episode_id=e.id and a.state='ready' and a.mime='image/webp'))
 or (e.content_type='pdf' and exists(select 1 from webtoon_assets a where a.id=e.pdf_asset_id and a.work_id=w.id and a.state='ready' and a.mime='application/pdf')));
$$;
drop policy "Published webtoon assets" on public.webtoon_assets;
create policy "Published webtoon assets" on public.webtoon_assets for select using(public.webtoon_is_admin() or (state='ready' and (
 exists(select 1 from public.webtoon_works w where w.cover_asset_id=webtoon_assets.id and w.published)
 or exists(select 1 from public.webtoon_episodes e join public.webtoon_works w on w.id=e.work_id where e.cover_asset_id=webtoon_assets.id and e.published and w.published)
 or exists(select 1 from public.webtoon_episode_pages p join public.webtoon_episodes e on e.id=p.episode_id join public.webtoon_works w on w.id=e.work_id where p.asset_id=webtoon_assets.id and e.content_type='images' and e.published and w.published)
 or exists(select 1 from public.webtoon_episodes e join public.webtoon_works w on w.id=e.work_id where e.pdf_asset_id=webtoon_assets.id and e.content_type='pdf' and e.published and w.published))));
create or replace function public.webtoon_claim_orphans(p_work uuid) returns setof public.webtoon_assets language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_work::text,928341));
 return query update webtoon_assets a set state='deleting' where a.id in (
  select x.id from webtoon_assets x where x.work_id=p_work and x.created_at<now()-interval '24 hours'
  and not exists(select 1 from webtoon_upload_drafts d where d.work_id=p_work and d.status='editing')
  and not exists(select 1 from webtoon_works w where w.cover_asset_id=x.id)
  and not exists(select 1 from webtoon_episode_pages p where p.asset_id=x.id)
  and not exists(select 1 from webtoon_episodes e where e.pdf_asset_id=x.id or e.cover_asset_id=x.id)
  order by x.id for update skip locked
 ) returning a.*;
end;$$;
create or replace function public.webtoon_cancel_upload(p_id uuid,p_owner uuid)
returns setof public.webtoon_assets language plpgsql security definer set search_path=public,pg_temp as $$
declare d webtoon_upload_drafts;
begin
 select * into d from webtoon_upload_drafts where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 if d.status='published' then raise exception 'edit_conflict'; end if;
 perform pg_advisory_xact_lock(hashtextextended(d.work_id::text,928341));
 update webtoon_upload_drafts set status='cancelled',version=version+1,updated_at=now() where id=d.id;
 return query update webtoon_assets a set state='deleting' where a.work_id=d.work_id
 and (a.id::text=d.data->>'coverAssetId' or a.id::text=d.data->>'coverUploadId' or exists(select 1 from jsonb_array_elements(coalesce(d.data->'jobs','[]')) j where j->>'id'=a.id::text))
 and not (coalesce(d.baseline->'assetIds','[]') ? a.id::text)
 and not exists(select 1 from webtoon_works w where w.cover_asset_id=a.id)
 and not exists(select 1 from webtoon_episode_pages p where p.asset_id=a.id)
 and not exists(select 1 from webtoon_episodes e where e.pdf_asset_id=a.id or e.cover_asset_id=a.id)
 returning a.*;
end;$$;
commit;
