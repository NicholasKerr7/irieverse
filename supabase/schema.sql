create extension if not exists "pgcrypto";

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter default privileges for role postgres in schema public
revoke execute on functions from public;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  edit_token_hash text,
  updated_at timestamptz not null default now()
);

alter table public.trips
add column if not exists edit_token_hash text;

create or replace function public.set_trips_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_trips_updated_at() from public, anon, authenticated;

drop trigger if exists set_trips_updated_at on public.trips;

create trigger set_trips_updated_at
before update on public.trips
for each row
execute function public.set_trips_updated_at();

alter table public.trips enable row level security;

drop policy if exists "Public trips are readable by share id" on public.trips;
drop policy if exists "Public trips can be created" on public.trips;
drop policy if exists "Public trips can be updated by share id" on public.trips;
drop policy if exists "Production QA trips can be deleted" on public.trips;

revoke all on public.trips from anon, authenticated;

create or replace function private.is_valid_trip_edit_token_hash(p_edit_token_hash text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_edit_token_hash ~ '^[a-f0-9]{64}$', false);
$$;

create or replace function private.assert_trip_share_payload(p_trip_data jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_trip_data is null or jsonb_typeof(p_trip_data) <> 'object' then
    raise exception 'Trip data must be a JSON object.' using errcode = '22023';
  end if;

  if octet_length(p_trip_data::text) > 200000 then
    raise exception 'Trip data is too large.' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.create_trip_share(
  p_trip_data jsonb,
  p_edit_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
begin
  if not private.is_valid_trip_edit_token_hash(p_edit_token_hash) then
    raise exception 'Edit token hash is required.' using errcode = '42501';
  end if;

  perform private.assert_trip_share_payload(p_trip_data);

  insert into public.trips (data, edit_token_hash)
  values (p_trip_data, p_edit_token_hash)
  returning id into v_trip_id;

  return v_trip_id;
end;
$$;

create or replace function private.read_trip_share(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_data jsonb;
begin
  select data into v_trip_data
  from public.trips
  where id = p_trip_id;

  if v_trip_data is null then
    raise exception 'Shared trip was not found.' using errcode = 'P0002';
  end if;

  return v_trip_data;
end;
$$;

create or replace function private.update_trip_share(
  p_trip_id uuid,
  p_trip_data jsonb,
  p_edit_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_data jsonb;
begin
  if not private.is_valid_trip_edit_token_hash(p_edit_token_hash) then
    raise exception 'This browser cannot update that share link.' using errcode = '42501';
  end if;

  perform private.assert_trip_share_payload(p_trip_data);

  update public.trips
  set data = p_trip_data
  where id = p_trip_id
    and edit_token_hash = p_edit_token_hash
    and edit_token_hash is not null
  returning data into v_trip_data;

  if v_trip_data is null then
    raise exception 'This browser cannot update that share link.' using errcode = '42501';
  end if;

  return v_trip_data;
end;
$$;

create or replace function private.delete_trip_share(
  p_trip_id uuid,
  p_edit_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
begin
  if not private.is_valid_trip_edit_token_hash(p_edit_token_hash) then
    raise exception 'This browser cannot delete that share link.' using errcode = '42501';
  end if;

  delete from public.trips
  where id = p_trip_id
    and edit_token_hash = p_edit_token_hash
    and edit_token_hash is not null;

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 0 then
    raise exception 'This browser cannot delete that share link.' using errcode = '42501';
  end if;

  return true;
end;
$$;

create or replace function public.create_trip_share(
  p_trip_data jsonb,
  p_edit_token_hash text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_trip_share($1, $2);
$$;

create or replace function public.read_trip_share(p_trip_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.read_trip_share($1);
$$;

create or replace function public.update_trip_share(
  p_trip_id uuid,
  p_trip_data jsonb,
  p_edit_token_hash text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_trip_share($1, $2, $3);
$$;

create or replace function public.delete_trip_share(
  p_trip_id uuid,
  p_edit_token_hash text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.delete_trip_share($1, $2);
$$;

revoke all on function private.is_valid_trip_edit_token_hash(text) from public, anon, authenticated;
revoke all on function private.assert_trip_share_payload(jsonb) from public, anon, authenticated;
revoke all on function private.create_trip_share(jsonb, text) from public, anon, authenticated;
revoke all on function private.read_trip_share(uuid) from public, anon, authenticated;
revoke all on function private.update_trip_share(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function private.delete_trip_share(uuid, text) from public, anon, authenticated;

grant execute on function private.create_trip_share(jsonb, text) to anon, authenticated;
grant execute on function private.read_trip_share(uuid) to anon, authenticated;
grant execute on function private.update_trip_share(uuid, jsonb, text) to anon, authenticated;
grant execute on function private.delete_trip_share(uuid, text) to anon, authenticated;

revoke all on function public.create_trip_share(jsonb, text) from public, anon, authenticated;
revoke all on function public.read_trip_share(uuid) from public, anon, authenticated;
revoke all on function public.update_trip_share(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.delete_trip_share(uuid, text) from public, anon, authenticated;

grant execute on function public.create_trip_share(jsonb, text) to anon, authenticated;
grant execute on function public.read_trip_share(uuid) to anon, authenticated;
grant execute on function public.update_trip_share(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.delete_trip_share(uuid, text) to anon, authenticated;

grant usage on schema public to anon, authenticated;
revoke all on public.trips from anon, authenticated;

create index if not exists trips_updated_at_idx
on public.trips (updated_at);

create index if not exists trips_qa_source_idx
on public.trips ((data -> 'qa' ->> 'source'))
where data ? 'qa';

create table if not exists public.user_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  board_key text not null default 'default',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, board_key)
);

create or replace function public.set_user_boards_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_user_boards_updated_at() from public, anon, authenticated;

drop trigger if exists set_user_boards_updated_at on public.user_boards;

create trigger set_user_boards_updated_at
before update on public.user_boards
for each row
execute function public.set_user_boards_updated_at();

alter table public.user_boards enable row level security;

drop policy if exists "Users can read their own boards" on public.user_boards;
drop policy if exists "Users can create their own boards" on public.user_boards;
drop policy if exists "Users can update their own boards" on public.user_boards;
drop policy if exists "Users can delete their own boards" on public.user_boards;

create policy "Users can read their own boards"
on public.user_boards
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own boards"
on public.user_boards
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own boards"
on public.user_boards
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own boards"
on public.user_boards
for delete
to authenticated
using (auth.uid() = user_id);

revoke all on public.user_boards from anon;
grant select, insert, update, delete on public.user_boards to authenticated;

create index if not exists user_boards_user_id_idx
on public.user_boards (user_id);

create table if not exists public.verified_events (
  id text primary key,
  title text not null,
  city text not null,
  region text not null,
  parish text,
  venue text not null,
  start_date timestamptz not null,
  date_label text,
  vibes text[] not null default '{}'::text[],
  price text,
  ticket_requirement text,
  official_url text,
  description text not null,
  source_label text not null default 'IrieVerse verified',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_events_title_not_empty check (length(btrim(title)) > 0),
  constraint verified_events_city_not_empty check (length(btrim(city)) > 0),
  constraint verified_events_region_not_empty check (length(btrim(region)) > 0),
  constraint verified_events_venue_not_empty check (length(btrim(venue)) > 0),
  constraint verified_events_description_not_empty check (length(btrim(description)) > 0)
);

create or replace function public.set_verified_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_verified_events_updated_at() from public, anon, authenticated;

drop trigger if exists set_verified_events_updated_at on public.verified_events;

create trigger set_verified_events_updated_at
before update on public.verified_events
for each row
execute function public.set_verified_events_updated_at();

alter table public.verified_events enable row level security;

drop policy if exists "Published verified events are readable" on public.verified_events;

create policy "Published verified events are readable"
on public.verified_events
for select
to anon, authenticated
using (is_published = true);

revoke all on public.verified_events from anon, authenticated;
grant select on public.verified_events to anon, authenticated;
grant select, insert, update, delete on public.verified_events to service_role;

create index if not exists verified_events_published_start_idx
on public.verified_events (is_published, start_date);

create index if not exists verified_events_region_parish_idx
on public.verified_events (lower(region), lower(coalesce(parish, '')));

insert into public.verified_events (
  id,
  title,
  city,
  region,
  parish,
  venue,
  start_date,
  date_label,
  vibes,
  price,
  ticket_requirement,
  official_url,
  description,
  source_label,
  is_published
) values
  (
    'reggae-sumfest-st-ann-2026',
    'Reggae Sumfest',
    'Priory',
    'North Coast',
    'St. Ann',
    'Plantation Cove',
    '2026-07-18T19:00:00-05:00',
    'July 18, 2026',
    array['music', 'nightlife'],
    'Ticket/pass required',
    'Festival ticket or pass required for the 2026 one-night staging.',
    'https://reggaesumfest.com/',
    'Official 2026 staging listed for Plantation Cove in St. Ann while Montego Bay rebuilds.',
    'Verified island calendar',
    true
  ),
  (
    'jamaica-food-drink-kingston',
    'Jamaica Food and Drink Festival',
    'Kingston',
    'South-East',
    'St. Andrew',
    'Kingston event venues',
    '2026-10-01T18:00:00-05:00',
    'Annual September/October',
    array['food', 'culture'],
    'Ticket/pass required',
    'Most festival events are ticketed.',
    'https://www.visitjamaica.com/experiences/events/signature-events/',
    'Culinary festival built around chef events, tastings, cocktails, and Kingston nightlife.',
    'Verified island calendar',
    true
  ),
  (
    'grand-gala-kingston',
    'Emancipendence Grand Gala',
    'Kingston',
    'Kingston',
    'Kingston',
    'National Stadium',
    '2026-08-06T17:00:00-05:00',
    'August 6 - Independence Day',
    array['culture', 'family'],
    'Confirm access',
    'Public access and ticketing can vary by year.',
    'https://www.visitjamaica.com/experiences/events/signature-events/',
    'National celebration with music, dance, pageantry, and cultural performances.',
    'Verified island calendar',
    true
  ),
  (
    'denbigh-agricultural-show',
    'Denbigh Agricultural Show',
    'May Pen',
    'South Coast',
    'Clarendon',
    'Denbigh showground',
    '2026-08-01T09:00:00-05:00',
    'Annual Emancipendence season',
    array['food', 'family'],
    'Ticket required',
    'Show entry is ticketed during event days.',
    'https://www.jas.gov.jm/denbigh.html',
    'Agricultural showcase with livestock, food, vendors, families, and parish pride.',
    'Verified island calendar',
    true
  ),
  (
    'reggae-marathon-kingston',
    'Reggae Marathon',
    'Kingston',
    'Kingston',
    'Kingston',
    'Kingston Waterfront',
    '2026-12-06T05:45:00-05:00',
    'December 6, 2026',
    array['sport', 'music'],
    'Registration required',
    'Runner registration is required; spectator access varies by location.',
    'https://www.reggaemarathon.com/',
    'Official race listing for the Kingston Waterfront with reggae energy and early morning race starts.',
    'Verified island calendar',
    true
  )
on conflict (id) do update set
  title = excluded.title,
  city = excluded.city,
  region = excluded.region,
  parish = excluded.parish,
  venue = excluded.venue,
  start_date = excluded.start_date,
  date_label = excluded.date_label,
  vibes = excluded.vibes,
  price = excluded.price,
  ticket_requirement = excluded.ticket_requirement,
  official_url = excluded.official_url,
  description = excluded.description,
  source_label = excluded.source_label,
  is_published = excluded.is_published,
  updated_at = now();
