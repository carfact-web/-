-- Additive only. Apply to production only after backup and explicit approval.
begin;
create table public.webtoon_works (
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 120),
 description text not null default '' check(length(description)<=5000), cover_asset_id uuid,
 published boolean not null default false, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.webtoon_episodes (
 id uuid primary key default gen_random_uuid(), work_id uuid not null references public.webtoon_works(id) on delete restrict,
 title text not null check(length(btrim(title)) between 1 and 120), number integer not null check(number between 1 and 99999),
 published boolean not null default false, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(work_id,number)
);
create table public.webtoon_assets (
 id uuid primary key, work_id uuid not null references public.webtoon_works(id) on delete restrict,
 object_key text not null unique, mime text not null check(mime='image/webp'),
 width integer not null check(width between 1 and 4096), height integer not null check(height between 1 and 30000),
 bytes integer not null check(bytes between 1 and 10485760), state text not null default 'uploading' check(state in ('uploading','ready','deleting')),
 created_at timestamptz not null default now()
);
alter table public.webtoon_works add constraint webtoon_work_cover_fk foreign key(cover_asset_id) references public.webtoon_assets(id) on delete restrict;
create table public.webtoon_episode_pages (
 episode_id uuid not null references public.webtoon_episodes(id) on delete cascade,
 asset_id uuid not null references public.webtoon_assets(id) on delete restrict,
 position integer not null check(position between 0 and 99), primary key(episode_id,asset_id), unique(episode_id,position)
);
create index on public.webtoon_episodes(work_id,number);
create index on public.webtoon_assets(work_id,created_at);
create index on public.webtoon_episode_pages(asset_id);
create or replace function public.webtoon_is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles where id=auth.uid() and role in ('admin','super_admin') and not coalesce(is_suspended,false));
$$;
revoke all on function public.webtoon_is_admin() from public;
grant execute on function public.webtoon_is_admin() to anon,authenticated,service_role;
alter table public.webtoon_works enable row level security;
alter table public.webtoon_episodes enable row level security;
alter table public.webtoon_assets enable row level security;
alter table public.webtoon_episode_pages enable row level security;
create policy "Published webtoon works" on public.webtoon_works for select using(published or public.webtoon_is_admin());
create policy "Published webtoon episodes" on public.webtoon_episodes for select using(public.webtoon_is_admin() or (published and exists(select 1 from public.webtoon_works w where w.id=work_id and w.published)));
create policy "Published webtoon pages" on public.webtoon_episode_pages for select using(public.webtoon_is_admin() or exists(select 1 from public.webtoon_episodes e join public.webtoon_works w on w.id=e.work_id where e.id=episode_id and e.published and w.published));
create policy "Published webtoon assets" on public.webtoon_assets for select using(public.webtoon_is_admin() or (state='ready' and (
 exists(select 1 from public.webtoon_works w where w.cover_asset_id=webtoon_assets.id and w.published)
 or exists(select 1 from public.webtoon_episode_pages p join public.webtoon_episodes e on e.id=p.episode_id join public.webtoon_works w on w.id=e.work_id where p.asset_id=webtoon_assets.id and e.published and w.published))));
-- No client mutation policies: all mutations go through authenticated admin server routes.
revoke all on public.webtoon_works,public.webtoon_episodes,public.webtoon_assets,public.webtoon_episode_pages from anon,authenticated;
grant select on public.webtoon_works,public.webtoon_episodes,public.webtoon_assets,public.webtoon_episode_pages to anon,authenticated;
grant all on public.webtoon_works,public.webtoon_episodes,public.webtoon_assets,public.webtoon_episode_pages to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('webtoon-private','webtoon-private',false,10485760,array['image/webp']);
-- Explicit RESTRICTIVE denial also defeats broader permissive policies in this bucket.
create policy "Webtoon objects server only" on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'webtoon-private') with check(bucket_id<>'webtoon-private');

create function public.webtoon_save_work(p_id uuid,p_version integer,p_title text,p_description text,p_cover uuid,p_published boolean)
returns public.webtoon_works language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.webtoon_works;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,928341));
 select * into result from webtoon_works where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if result.version<>p_version then raise exception 'edit_conflict'; end if;
 if p_cover is not null then
  perform 1 from webtoon_assets where id=p_cover and work_id=p_id and state='ready' for update;
  if not found then raise exception 'invalid_asset'; end if;
 end if;
 if p_published and p_cover is null then raise exception 'cover_required'; end if;
 update webtoon_works set title=btrim(p_title),description=p_description,cover_asset_id=p_cover,published=p_published,version=version+1,updated_at=now() where id=p_id returning * into result;
 return result;
end;$$;

create function public.webtoon_save_episode(p_id uuid,p_version integer,p_title text,p_number integer,p_published boolean,p_assets uuid[])
returns public.webtoon_episodes language plpgsql security definer set search_path=public,pg_temp as $$
declare result public.webtoon_episodes; n integer; owning_work uuid;
begin
 select work_id into owning_work from webtoon_episodes where id=p_id;
 if not found then raise exception 'not_found'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owning_work::text,928341));
 select * into result from webtoon_episodes where id=p_id for update;
 if not found then raise exception 'not_found'; end if;
 if result.version<>p_version then raise exception 'edit_conflict'; end if;
 if p_assets is null or cardinality(p_assets)>100 or (p_published and cardinality(p_assets)=0) then raise exception 'invalid_pages'; end if;
 if cardinality(p_assets)<>(select count(distinct x) from unnest(p_assets) x) then raise exception 'duplicate_pages'; end if;
 perform 1 from webtoon_assets where id=any(p_assets) order by id for update;
 select count(*) into n from webtoon_assets where id=any(p_assets) and work_id=result.work_id and state='ready';
 if n<>cardinality(p_assets) then raise exception 'invalid_asset'; end if;
 delete from webtoon_episode_pages where episode_id=p_id;
 insert into webtoon_episode_pages(episode_id,asset_id,position) select p_id,x,(ord-1)::integer from unnest(p_assets) with ordinality as t(x,ord);
 update webtoon_episodes set title=btrim(p_title),number=p_number,published=p_published,version=version+1,updated_at=now() where id=p_id returning * into result;
 return result;
end;$$;

create function public.webtoon_claim_orphans(p_work uuid) returns setof public.webtoon_assets language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_work::text,928341));
 return query update webtoon_assets a set state='deleting' where a.id in (
  select x.id from webtoon_assets x where x.work_id=p_work and x.created_at<now()-interval '24 hours'
  and not exists(select 1 from webtoon_works w where w.cover_asset_id=x.id)
  and not exists(select 1 from webtoon_episode_pages p where p.asset_id=x.id)
  order by x.id for update skip locked
 ) returning a.*;
end;$$;
revoke all on function public.webtoon_save_work(uuid,integer,text,text,uuid,boolean),public.webtoon_save_episode(uuid,integer,text,integer,boolean,uuid[]),public.webtoon_claim_orphans(uuid) from public,anon,authenticated;
grant execute on function public.webtoon_save_work(uuid,integer,text,text,uuid,boolean),public.webtoon_save_episode(uuid,integer,text,integer,boolean,uuid[]),public.webtoon_claim_orphans(uuid) to service_role;
commit;
