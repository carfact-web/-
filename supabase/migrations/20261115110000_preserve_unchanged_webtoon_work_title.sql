-- Preserve legacy work titles on unchanged episode-title saves.
begin;
create or replace function public.webtoon_commit_edit(p_id uuid,p_owner uuid,p_version integer,p_title text,p_published boolean,p_popup boolean,p_message text,p_start timestamptz,p_end timestamptz)
returns public.webtoon_upload_drafts language plpgsql security definer set search_path=public,pg_temp as $$
declare d webtoon_upload_drafts; e webtoon_episodes; w webtoon_works; promo webtoon_promotion; oldpromo jsonb; pages uuid[]; pdf uuid; cover uuid; change_popup boolean; single_post boolean;
begin
 select * into d from webtoon_upload_drafts where id=p_id and owner_id=p_owner and mode='edit' for update;
 if not found then raise exception 'not_found'; end if;
 if d.status='published' then return d; end if;
 if d.status<>'editing' or d.version<>p_version then raise exception 'edit_conflict'; end if;
 if length(btrim(p_title)) not between 1 and 120 then raise exception 'invalid_title'; end if;
 if coalesce((d.data->>'ready')::boolean,false)<>true and not (not p_published and jsonb_array_length(coalesce(d.data->'jobs','[]'))=0 and nullif(d.data->>'pdfAssetId','') is null and jsonb_array_length(coalesce(d.data->'pageIds','[]'))=0) then raise exception 'invalid_pages'; end if;
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
 if cover is not null then
  perform 1 from webtoon_assets where id=cover and work_id=w.id and state='ready' and mime='image/webp' for update;
  if not found then raise exception 'cover_required'; end if;
 elsif p_published then raise exception 'cover_required'; end if;
 select count(*)=1 into single_post from webtoon_episodes where work_id=w.id;
 if p_published and not w.published and not single_post then raise exception 'series_private'; end if;
 perform webtoon_save_episode(e.id,e.version,btrim(p_title),e.number,p_published,case when pdf is null then pages else '{}'::uuid[] end,case when pdf is null then 'images' else 'pdf' end,pdf);
 update webtoon_episodes set cover_asset_id=cover where id=e.id;
 if single_post then perform webtoon_save_work(w.id,w.version,case when btrim(p_title) is distinct from e.title then btrim(p_title) else w.title end,w.description,cover,p_published); end if;
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
commit;
