create table public.paddock_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('cars','tasks','stints','radio','weekend')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16384),
  created_at timestamptz not null default now(),
  constraint valid_car check (kind <> 'cars' or (
    coalesce(payload->>'number','') ~ '^[0-9]{1,3}$'
    and coalesce(payload->>'status','') in ('Ready','Attention','In garage')
    and coalesce(payload->>'model','') <> ''
    and coalesce(payload->>'driver','') <> ''
  )),
  constraint valid_fuel check (kind not in ('cars','stints') or (
    jsonb_typeof(payload->'fuel') = 'number' and (payload->>'fuel')::numeric between 0 and 200
    and payload ? 'fuel'
  )),
  constraint valid_task check (kind <> 'tasks' or (
    coalesce(payload->>'title','') <> '' and coalesce(payload->>'owner','') <> ''
    and jsonb_typeof(payload->'done') = 'boolean' and payload ? 'done'
    and coalesce(payload->>'priority','') in ('High','Normal')
  )),
  constraint valid_stint check (kind <> 'stints' or (
    coalesce(payload->>'session','') in ('Practice 1','Practice 2','Qualifying','Race')
    and coalesce(payload->>'car','') ~ '^[0-9]{1,3}$'
    and coalesce(payload->>'driver','') <> ''
    and coalesce(payload->>'target','') ~ '^[0-9]{1,2}:[0-5][0-9]\.[0-9]{3}$'
    and coalesce(payload->>'laps','') ~ '^[0-9]+$'
    and (payload->>'laps')::numeric between 1 and 200
  )),
  constraint valid_radio check (kind <> 'radio' or (coalesce(payload->>'message','') <> '' and coalesce(payload->>'source','') <> '')),
  constraint valid_weekend check (kind <> 'weekend' or (coalesce(payload->>'name','') <> '' and coalesce(payload->>'team','') <> '' and coalesce(payload->>'date','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
);
create index paddock_records_owner_kind_idx on public.paddock_records(owner_id, kind);
create unique index paddock_unique_car on public.paddock_records(owner_id, (payload->>'number')) where kind = 'cars';
create unique index paddock_single_weekend on public.paddock_records(owner_id) where kind = 'weekend';
alter table public.paddock_records enable row level security;
revoke all on public.paddock_records from anon;
grant select, insert, update, delete on public.paddock_records to authenticated;
create policy "Read own records" on public.paddock_records for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Create own records" on public.paddock_records for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own records" on public.paddock_records for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Delete own records" on public.paddock_records for delete to authenticated using ((select auth.uid()) = owner_id);
