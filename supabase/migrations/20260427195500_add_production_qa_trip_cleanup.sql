drop policy if exists "Production QA trips can be deleted" on public.trips;

create policy "Production QA trips can be deleted"
on public.trips
for delete
to anon
using (
  data -> 'qa' ->> 'source' = 'production-qa'
);

create index if not exists trips_updated_at_idx
on public.trips (updated_at);

create index if not exists trips_qa_source_idx
on public.trips ((data -> 'qa' ->> 'source'))
where data ? 'qa';
