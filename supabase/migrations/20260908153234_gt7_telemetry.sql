create table public.gt7_live (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) < 16384)
);
create table public.gt7_sessions (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) < 262144)
);
create index gt7_sessions_owner on public.gt7_sessions(owner_id);
create table public.gt7_profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) < 32768)
);
alter table public.gt7_live enable row level security;
alter table public.gt7_sessions enable row level security;
alter table public.gt7_profiles enable row level security;
revoke all on public.gt7_live, public.gt7_sessions, public.gt7_profiles from anon;
grant select, insert, update, delete on public.gt7_live, public.gt7_sessions, public.gt7_profiles to authenticated;
create policy own_live on public.gt7_live for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_sessions on public.gt7_sessions for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_profile on public.gt7_profiles for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
