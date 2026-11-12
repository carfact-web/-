-- Additive promotion settings. Production application requires final approval.
begin;
alter table public.webtoon_episodes add column published_at timestamptz;
-- Historical publication times were not stored; updated_at is the documented fallback.
update public.webtoon_episodes set published_at=updated_at where published;
create index webtoon_published_date on public.webtoon_episodes(published_at desc,id) where published;
create function public.webtoon_stamp_publication() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.published and (tg_op='INSERT' or not old.published) then new.published_at=statement_timestamp();
 elsif tg_op='UPDATE' then new.published_at=old.published_at;
 end if;
 return new;
end;$$;
create trigger webtoon_publication before insert or update on public.webtoon_episodes for each row execute function public.webtoon_stamp_publication();
create table public.webtoon_promotion (
 id integer primary key default 1 check(id=1), episode_id uuid references public.webtoon_episodes(id) on delete set null,
 message text not null default '' check(length(message)<=280), starts_at timestamptz, ends_at timestamptz,
 enabled boolean not null default false, version integer not null default 1,
 updated_at timestamptz not null default now(), check(ends_at is null or starts_at is null or ends_at>starts_at),
 check(not enabled or (starts_at is not null and ends_at is not null))
);
insert into public.webtoon_promotion(id) values(1);
alter table public.webtoon_promotion enable row level security;
revoke all on public.webtoon_promotion from public,anon,authenticated;
grant all on public.webtoon_promotion to service_role;
create function public.webtoon_promotion_card(p_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('episodeId',e.id,'workId',w.id,'workTitle',w.title,'episodeTitle',e.title,'description',left(w.description,180),'publishedAt',e.published_at,'contentType',e.content_type,'coverUrl','/api/webtoons/promotion/cover/'||e.id,'href','/webtoons/'||w.id||'/episodes/'||e.id)
 from webtoon_episodes e join webtoon_works w on w.id=e.work_id
 join webtoon_assets cover on cover.id=w.cover_asset_id and cover.work_id=w.id and cover.mime='image/webp' and cover.state='ready'
 where e.id=p_id and e.published and w.published and e.published_at is not null
 and ((e.content_type='images' and exists(select 1 from webtoon_episode_pages p join webtoon_assets a on a.id=p.asset_id where p.episode_id=e.id and a.state='ready' and a.mime='image/webp'))
 or (e.content_type='pdf' and exists(select 1 from webtoon_assets a where a.id=e.pdf_asset_id and a.work_id=w.id and a.state='ready' and a.mime='application/pdf')));
$$;
revoke all on function public.webtoon_promotion_card(uuid) from public,anon,authenticated;
grant execute on function public.webtoon_promotion_card(uuid) to service_role;
create function public.webtoon_promotion_payload() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
 'serverNow',statement_timestamp(),
 'latest',(select card from (select webtoon_promotion_card(e.id) card from webtoon_episodes e join webtoon_works w on w.id=e.work_id where e.published and w.published and e.published_at is not null order by e.published_at desc,e.id desc) c where card is not null limit 1),
 'popup',(select jsonb_build_object('version',p.version,'message',p.message,'startsAt',p.starts_at,'endsAt',p.ends_at,'card',webtoon_promotion_card(p.episode_id)) from webtoon_promotion p where p.id=1 and p.enabled and p.starts_at<=statement_timestamp() and p.ends_at>statement_timestamp() and webtoon_promotion_card(p.episode_id) is not null)
 );
$$;
revoke all on function public.webtoon_promotion_payload() from public;
grant execute on function public.webtoon_promotion_payload() to anon,authenticated,service_role;
create function public.webtoon_stop_promotion() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' or (old.published and not new.published) then
  if tg_table_name='webtoon_episodes' then
   update webtoon_promotion set enabled=false,version=version+1,updated_at=statement_timestamp() where episode_id=old.id;
  else
   update webtoon_promotion set enabled=false,version=version+1,updated_at=statement_timestamp() where episode_id in(select id from webtoon_episodes where work_id=old.id);
  end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end;$$;
revoke all on function public.webtoon_stamp_publication(),public.webtoon_stop_promotion() from public,anon,authenticated;
create trigger webtoon_episode_promo_stop before update of published or delete on public.webtoon_episodes for each row execute function public.webtoon_stop_promotion();
create trigger webtoon_work_promo_stop before update of published or delete on public.webtoon_works for each row execute function public.webtoon_stop_promotion();
commit;
