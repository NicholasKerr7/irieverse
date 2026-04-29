alter table public.trips
add column if not exists edit_token_hash text;

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
