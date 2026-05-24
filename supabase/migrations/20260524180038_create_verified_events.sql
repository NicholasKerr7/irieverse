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

grant usage on schema public to anon, authenticated;
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
