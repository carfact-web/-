-- Local-only policies and synthetic vehicle; never apply to a hosted project.
alter table public.vehicles enable row level security; alter table public.reviews enable row level security; alter table public.review_reports enable row level security; alter table public.user_profiles enable row level security; alter table public.vehicle_master enable row level security;
 drop policy if exists "Public read vehicles" on public.vehicles; create policy "Public read vehicles" on public.vehicles for select using(true);
 drop policy if exists "Authenticated insert reviews" on public.reviews; create policy "Authenticated insert reviews" on public.reviews for insert to authenticated with check(auth.uid()=author_id);
 drop policy if exists "Users read own profile" on public.user_profiles; create policy "Users read own profile" on public.user_profiles for select to authenticated using(auth.uid()=id);
 drop policy if exists "Users insert own profile" on public.user_profiles; create policy "Users insert own profile" on public.user_profiles for insert to authenticated with check(auth.uid()=id);
 drop policy if exists "Users update own profile" on public.user_profiles; create policy "Users update own profile" on public.user_profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);
 drop policy if exists "Public read vehicle master" on public.vehicle_master; create policy "Public read vehicle master" on public.vehicle_master for select using(true);
 insert into storage.buckets(id,name,public) values('review-images','review-images',true) on conflict(id) do nothing;
 drop policy if exists "Local read review images" on storage.objects; create policy "Local read review images" on storage.objects for select using(bucket_id='review-images');
 drop policy if exists "Local upload review images" on storage.objects; create policy "Local upload review images" on storage.objects for insert to authenticated with check(bucket_id='review-images');
 drop policy if exists "Local delete own review images" on storage.objects; create policy "Local delete own review images" on storage.objects for delete to authenticated using(bucket_id='review-images' and owner_id=auth.uid()::text);
 insert into public.vehicles(id,car_number,manufacturer,model,generation,year,mileage,fuel_type) values('11111111-1111-4111-8111-111111111111','123가4567','테스트','테스트 세단','테스트 세대','2020','10000','가솔린') on conflict(car_number) do nothing;
