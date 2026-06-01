insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read community images"
  on storage.objects;
create policy "Public read community images"
  on storage.objects
  for select
  using (bucket_id = 'community-images');

drop policy if exists "Authenticated upload community images"
  on storage.objects;
create policy "Authenticated upload community images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'community-images');

drop policy if exists "Users update own community images"
  on storage.objects;
create policy "Users update own community images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'community-images' and owner = auth.uid())
  with check (bucket_id = 'community-images' and owner = auth.uid());

drop policy if exists "Users delete own community images"
  on storage.objects;
create policy "Users delete own community images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'community-images' and owner = auth.uid());
