-- File-first upload sessions. Apply to local sandbox only until deployment approval.
begin;
create table public.webtoon_upload_drafts (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 work_id uuid not null references public.webtoon_works(id),
 episode_id uuid not null unique references public.webtoon_episodes(id),
 owns_work boolean not null,
 status text not null default 'editing' check(status in ('editing','published','cancelled')),
 data jsonb not null default '{}' check(jsonb_typeof(data)='object'),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.webtoon_upload_drafts enable row level security;
revoke all on public.webtoon_upload_drafts from public,anon,authenticated;
grant all on public.webtoon_upload_drafts to service_role;
create function public.webtoon_start_upload(p_id uuid,p_owner uuid,p_work uuid default null,p_number integer default null)
returns public.webtoon_upload_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d webtoon_upload_drafts; w uuid; e uuid; n integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,713503));
 select * into d from webtoon_upload_drafts where id=p_id;
 if found then
  if d.owner_id<>p_owner then raise exception 'not_found'; end if;
  return d;
 end if;
 if p_work is null then
  insert into webtoon_works(title) values('업로드 준비 중') returning id into w;
 else
  w:=p_work;
  perform pg_advisory_xact_lock(hashtextextended(w::text,928341));
  perform 1 from webtoon_works where id=w and published and cover_asset_id is not null;
  if not found then raise exception 'not_found'; end if;
 end if;
 select coalesce(p_number,coalesce(max(number),0)+1) into n from webtoon_episodes where work_id=w;
 insert into webtoon_episodes(work_id,title,number) values(w,'업로드 준비 중',n) returning id into e;
 insert into webtoon_upload_drafts(id,owner_id,work_id,episode_id,owns_work) values(p_id,p_owner,w,e,p_work is null) returning * into d;
 return d;
end;$$;
revoke all on function public.webtoon_start_upload(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.webtoon_start_upload(uuid,uuid,uuid,integer) to service_role;
create function public.webtoon_publish_upload(p_id uuid,p_owner uuid,p_version integer,p_title text,p_popup boolean,p_message text,p_start timestamptz,p_end timestamptz,p_promotion_version integer)
returns public.webtoon_upload_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d webtoon_upload_drafts; w webtoon_works; e webtoon_episodes; pages uuid[]; pdf uuid; cover uuid;
begin
 select * into d from webtoon_upload_drafts where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'not_found'; end if;
 if d.status='published' then return d; end if;
 if d.status<>'editing' or d.version<>p_version then raise exception 'edit_conflict'; end if;
 if length(btrim(p_title)) not between 1 and 120 then raise exception 'invalid_title'; end if;
 if coalesce((d.data->>'ready')::boolean,false)<>true then raise exception 'invalid_pages'; end if;
 perform pg_advisory_xact_lock(hashtextextended(d.work_id::text,928341));
 select * into w from webtoon_works where id=d.work_id for update;
 select * into e from webtoon_episodes where id=d.episode_id for update;
 if e.published then raise exception 'edit_conflict'; end if;
 select coalesce(array_agg(x::uuid),'{}'::uuid[]) into pages from jsonb_array_elements_text(coalesce(d.data->'pageIds','[]')) x;
 pdf:=nullif(d.data->>'pdfAssetId','')::uuid;
 cover:=nullif(d.data->>'coverAssetId','')::uuid;
 perform webtoon_save_episode(e.id,e.version,btrim(p_title),e.number,true,case when pdf is null then pages else '{}'::uuid[] end,case when pdf is null then 'images' else 'pdf' end,pdf);
 if d.owns_work then
  perform webtoon_save_work(w.id,w.version,btrim(p_title),w.description,cover,true);
 elsif not w.published then raise exception 'edit_conflict'; end if;
 if p_popup then
  if p_start is null or p_end is null or p_end<=p_start or length(btrim(p_message)) not between 1 and 280 then raise exception 'invalid_popup'; end if;
  update webtoon_promotion set episode_id=e.id,message=btrim(p_message),starts_at=p_start,ends_at=p_end,enabled=true,version=version+1,updated_at=now() where id=1 and version=p_promotion_version;
  if not found then raise exception 'edit_conflict'; end if;
 end if;
 update webtoon_upload_drafts set status='published',version=version+1,updated_at=now() where id=d.id returning * into d;
 return d;
end;$$;
revoke all on function public.webtoon_publish_upload(uuid,uuid,integer,text,boolean,text,timestamptz,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.webtoon_publish_upload(uuid,uuid,integer,text,boolean,text,timestamptz,timestamptz,integer) to service_role;
-- Active uploads protect their work's temporary assets from the existing manual GC.
create or replace function public.webtoon_claim_orphans(p_work uuid) returns setof public.webtoon_assets language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_work::text,928341));
 return query update webtoon_assets a set state='deleting' where a.id in (
  select x.id from webtoon_assets x where x.work_id=p_work and x.created_at<now()-interval '24 hours'
  and not exists(select 1 from webtoon_upload_drafts d where d.work_id=p_work and d.status='editing')
  and not exists(select 1 from webtoon_works w where w.cover_asset_id=x.id)
  and not exists(select 1 from webtoon_episode_pages p where p.asset_id=x.id)
  and not exists(select 1 from webtoon_episodes e where e.pdf_asset_id=x.id)
  order by x.id for update skip locked
 ) returning a.*;
end;$$;
create function public.webtoon_cancel_upload(p_id uuid,p_owner uuid)
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
 and not exists(select 1 from webtoon_works w where w.cover_asset_id=a.id)
 and not exists(select 1 from webtoon_episode_pages p where p.asset_id=a.id)
 and not exists(select 1 from webtoon_episodes e where e.pdf_asset_id=a.id)
 returning a.*;
end;$$;
revoke all on function public.webtoon_cancel_upload(uuid,uuid) from public,anon,authenticated;
grant execute on function public.webtoon_cancel_upload(uuid,uuid) to service_role;
commit;
