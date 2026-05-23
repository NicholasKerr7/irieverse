grant usage on schema public to anon, authenticated;

revoke all on public.trips from anon, authenticated;
revoke all on public.user_boards from anon;
grant select, insert, update, delete on public.user_boards to authenticated;

revoke all on function public.create_trip_share(jsonb, text) from public, anon, authenticated;
revoke all on function public.read_trip_share(uuid) from public, anon, authenticated;
revoke all on function public.update_trip_share(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.delete_trip_share(uuid, text) from public, anon, authenticated;

grant execute on function public.create_trip_share(jsonb, text) to anon, authenticated;
grant execute on function public.read_trip_share(uuid) to anon, authenticated;
grant execute on function public.update_trip_share(uuid, jsonb, text) to anon, authenticated;
grant execute on function public.delete_trip_share(uuid, text) to anon, authenticated;
