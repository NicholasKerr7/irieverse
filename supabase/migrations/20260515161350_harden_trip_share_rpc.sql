create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter default privileges for role postgres in schema public
revoke execute on functions from public;

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
