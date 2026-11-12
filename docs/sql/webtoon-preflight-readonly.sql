-- Operator-only preflight on the approved production connection.
-- Reads catalog/target bucket metadata only; no member rows, DDL or DML.
-- Do not pass credentials in command-line arguments or commit connection files.
begin read only;
select to_regclass('supabase_migrations.schema_migrations') as migration_history;
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'webtoon_%' and c.relkind='r' order by c.relname;
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public' and table_name like 'webtoon_%' order by table_name,ordinal_position;
select c.relname,k.conname,pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'webtoon_%' order by c.relname,k.conname;
select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename like 'webtoon_%';
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies
where (schemaname='public' and tablename like 'webtoon_%') or (schemaname='storage' and policyname='Webtoon objects server only');
select p.oid::regprocedure as signature,p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'webtoon_%';
select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition from pg_trigger t
join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname='public' and c.relname like 'webtoon_%';
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name like 'webtoon_%';
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='webtoon-private';
commit;
-- If migration_history exists and this connection may SELECT it, run separately:
-- begin read only;
-- select version,name from supabase_migrations.schema_migrations
-- where version in ('20261112090000','20261112100000','20261112110000') order by version;
-- commit;
