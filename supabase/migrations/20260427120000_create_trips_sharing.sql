create extension if not exists "pgcrypto";

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_trips_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_trips_updated_at on public.trips;

create trigger set_trips_updated_at
before update on public.trips
for each row
execute function public.set_trips_updated_at();

alter table public.trips enable row level security;

drop policy if exists "Public trips are readable by share id" on public.trips;
drop policy if exists "Public trips can be created" on public.trips;
drop policy if exists "Public trips can be updated by share id" on public.trips;

create policy "Public trips are readable by share id"
on public.trips
for select
to anon
using (true);

create policy "Public trips can be created"
on public.trips
for insert
to anon
with check (true);

create policy "Public trips can be updated by share id"
on public.trips
for update
to anon
using (true)
with check (true);
