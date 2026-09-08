create table public.driver_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  psn_id text check (psn_id is null or psn_id ~ '^[A-Za-z0-9_-]{3,16}$'),
  gt7_profile_url text check (gt7_profile_url is null or gt7_profile_url ~ '^https://www[.]gran-turismo[.]com/[a-z]{2}/gt7/user/mymenu/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/profile/$'),
  visibility text not null default 'private' check (visibility = 'private'),
  created_at timestamptz not null default now()
);
alter table public.driver_profiles enable row level security;
revoke all on public.driver_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.driver_profiles to authenticated;
create policy own_driver_profile on public.driver_profiles for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
