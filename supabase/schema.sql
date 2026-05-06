create extension if not exists "pgcrypto";

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
drop policy if exists "Production QA trips can be deleted" on public.trips;

revoke all on public.trips from anon, authenticated;

create or replace function public.create_trip_share(
  p_trip_data jsonb,
  p_edit_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_id uuid;
begin
  if p_edit_token_hash is null or length(p_edit_token_hash) < 32 then
    raise exception 'Edit token hash is required.' using errcode = '42501';
  end if;

  insert into public.trips (data, edit_token_hash)
  values (p_trip_data, p_edit_token_hash)
  returning id into v_trip_id;

  return v_trip_id;
end;
$$;

create or replace function public.read_trip_share(p_trip_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
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

create or replace function public.update_trip_share(
  p_trip_id uuid,
  p_trip_data jsonb,
  p_edit_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip_data jsonb;
begin
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

create or replace function public.delete_trip_share(
  p_trip_id uuid,
  p_edit_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer;
begin
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

revoke all on function public.create_trip_share(jsonb, text) from public;
revoke all on function public.read_trip_share(uuid) from public;
revoke all on function public.update_trip_share(uuid, jsonb, text) from public;
revoke all on function public.delete_trip_share(uuid, text) from public;

grant execute on function public.create_trip_share(jsonb, text) to anon, authenticated;
grant execute on function public.read_trip_share(uuid) to anon, authenticated;
grant execute on function public.update_trip_share(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.delete_trip_share(uuid, text) to anon, authenticated;

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
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

grant select, insert, update, delete on public.user_boards to authenticated;

create index if not exists user_boards_user_id_idx
on public.user_boards (user_id);
