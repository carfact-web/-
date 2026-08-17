drop policy if exists "Public insert vehicles" on public.vehicles;
create policy "Verified dealers insert vehicles"
  on public.vehicles for insert
  with check (
    exists (
      select 1
      from public.user_profiles as profile
      where profile.id = auth.uid()
        and profile.is_verified_dealer = true
    )
  );

drop policy if exists "Public update vehicles" on public.vehicles;
create policy "Verified dealers update vehicles"
  on public.vehicles for update
  using (
    exists (
      select 1
      from public.user_profiles as profile
      where profile.id = auth.uid()
        and profile.is_verified_dealer = true
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles as profile
      where profile.id = auth.uid()
        and profile.is_verified_dealer = true
    )
  );
