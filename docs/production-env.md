# Production Environment

IrieVerse runs without production secrets by using local fallback data. Add these variables only when you want live integrations.

## Variables

| Name | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Optional | Enables shared trip links with Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Optional | Public anon key for the Supabase project. |
| `AVIATIONSTACK_API_KEY` | Optional | Server-only AviationStack key used by `api/flights.js`. |
| `AVIATIONSTACK_DISABLED` | Optional | Set to `true` to force saved flight examples and avoid live AviationStack requests in an environment. |
| `AVIATIONSTACK_CACHE_TTL_SECONDS` | Optional | Server-side live flight cache TTL. Defaults to `900` seconds. |
| `AVIATIONSTACK_COOLDOWN_SECONDS` | Optional | Server-side cooldown after AviationStack rate limits. Defaults to `1800` seconds. |
| `VITE_FLIGHTS_API_URL` | Optional | Browser-visible flight proxy URL. Defaults to `/api/flights`. |
| `VITE_BOOKING_API_URL` | Optional | Enables live booking recommendations from the server booking endpoint. |
| `AMADEUS_CLIENT_ID` | Optional | Server-only Amadeus API key used by `api/bookings.js`. |
| `AMADEUS_CLIENT_SECRET` | Optional | Server-only Amadeus API secret used by `api/bookings.js`. |
| `AMADEUS_BASE_URL` | Optional | Amadeus base URL. Defaults to `https://test.api.amadeus.com`; use `https://api.amadeus.com` for production credentials. |
| `ROUTING_API_BASE_URL` | Optional | Server-only OSRM-compatible routing base URL used by `api/road-route.js`. Defaults to `https://router.project-osrm.org`. |

Only variables prefixed with `VITE_` are exposed to the browser. Keep AviationStack and Amadeus credentials server-only.

## Local Setup

Copy the template and fill only the integrations you are ready to use:

```bash
cp .env.example .env.local
```

Then run:

```bash
npm run dev
```

## Production Setup

Set the same variables in the deployment platform for the production environment. Do not commit real values.

For Vercel:

```bash
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel env add AVIATIONSTACK_API_KEY production
vercel env add AVIATIONSTACK_CACHE_TTL_SECONDS production
vercel env add AVIATIONSTACK_COOLDOWN_SECONDS production
vercel env add VITE_FLIGHTS_API_URL production
vercel env add VITE_BOOKING_API_URL production
vercel env add AMADEUS_CLIENT_ID production
vercel env add AMADEUS_CLIENT_SECRET production
vercel env add AMADEUS_BASE_URL production
vercel env add ROUTING_API_BASE_URL production
```

For this Vercel app, `VITE_BOOKING_API_URL` should be:

```text
/api/bookings
```

## Supabase Sharing

Trip sharing expects a Supabase table named `trips` with this shape:

```text
id uuid primary key
data jsonb
updated_at timestamptz
```

The migration in `supabase/migrations/20260427120000_create_trips_sharing.sql` creates the MVP sharing table and public anon policies. The app stores planner settings, saved places, saved experiences, and imported ideas in the `data` JSON payload.
The migration in `supabase/migrations/20260427195500_add_production_qa_trip_cleanup.sql` adds a QA-only delete policy and indexes so production QA share rows can be removed after automated verification.

To apply it with the Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

For manual setup, run `supabase/schema.sql` in the Supabase SQL editor. Keep it mirrored with the migration if the table shape changes.

If the app reports `Supabase trips table missing`, the public REST API cannot see `public.trips` yet. Run `supabase/schema.sql`, wait for the schema cache to refresh, then retry Share. If `supabase db push` fails with a remote Postgres password error, re-run `supabase link --project-ref your-project-ref --password your-current-db-password` before pushing migrations.

## Booking API Contract

This repo includes a Vercel serverless booking endpoint at `api/bookings.js`. It proxies Amadeus Hotels so Amadeus secrets never ship to the browser. When `VITE_BOOKING_API_URL` is set, IrieVerse calls:

```text
GET {VITE_BOOKING_API_URL}?destination={airportCode}&origin={airportCode}&checkInDate={YYYY-MM-DD}&checkOutDate={YYYY-MM-DD}&adults=2
```

The endpoint can return either:

```json
[
  {
    "id": "hotel-1",
    "title": "Hotel name",
    "provider": "Provider",
    "type": "hotel",
    "price": 240,
    "currency": "USD",
    "url": "https://example.com",
    "description": "Short booking description",
    "rating": 4.6,
    "perks": ["Breakfast", "Near beach"]
  }
]
```

or:

```json
{
  "data": []
}
```

The endpoint returns fallback booking data when Amadeus credentials are missing, Amadeus has no matching offers, or the provider request fails. If `VITE_BOOKING_API_URL` is missing entirely, the browser uses `public/data/bookings.json`.

The Trips screen shows the current stay source:

- `Live stays` when the Vercel endpoint returns Amadeus offers or another live stay feed.
- `Curated picks` when the endpoint is missing or live offers are unavailable.

## Amadeus Setup

Create an Amadeus for Developers account, create an app in the Self-Service workspace, and copy the API Key and API Secret into server-only Vercel variables:

```bash
vercel env add AMADEUS_CLIENT_ID production
vercel env add AMADEUS_CLIENT_SECRET production
vercel env add AMADEUS_BASE_URL production
```

Use `https://test.api.amadeus.com` while testing. Switch `AMADEUS_BASE_URL` to `https://api.amadeus.com` only after your Amadeus app is approved for production access.

The endpoint uses Amadeus OAuth client credentials, then looks up hotels by Jamaica city code and fetches Hotel Search v3 offers.

## Flight API

The browser calls `api/flights.js`, which proxies AviationStack with the server-only `AVIATIONSTACK_API_KEY`. For the Vercel app, `VITE_FLIGHTS_API_URL` can be omitted because it defaults to `/api/flights`.

```text
GET /api/flights?origin={airportCode}&destination={airportCode}
```

If `AVIATIONSTACK_API_KEY` is missing or AviationStack fails, the browser falls back to `public/data/flights-sample.json`. Do not use `VITE_AVIATIONSTACK_API_KEY` in production; it exposes the provider key to the client bundle.

The flight proxy also protects the AviationStack quota:

- Successful live lookups are cached in memory for `AVIATIONSTACK_CACHE_TTL_SECONDS` seconds.
- If AviationStack returns a rate-limit/quota error, the proxy returns fallback metadata and stops calling AviationStack for `AVIATIONSTACK_COOLDOWN_SECONDS` seconds.
- For local development, set `AVIATIONSTACK_DISABLED=true` in `.env.local` to force saved examples without using live quota.

## Import Metadata API

Saved imports call `api/import-metadata.js` after a user pastes a URL. The endpoint fetches public Open Graph metadata for normal articles and uses YouTube oEmbed for YouTube links. Google Maps, TikTok, and Instagram stay heuristic-first because those platforms commonly restrict metadata access.

```text
GET /api/import-metadata?url={encodedPublicUrl}
```

The endpoint accepts public `http`/`https` URLs only, blocks localhost/private-network targets, caches metadata in memory for 24 hours, and returns a low-confidence fallback object if metadata is unavailable. The client keeps the existing parser active either way.

## Road Routing

The map uses `api/road-route.js` to request real driving geometry for each route leg. By default, the endpoint calls the public OSRM demo server:

```text
https://router.project-osrm.org/route/v1/driving/{lon,lat};{lon,lat}?overview=full&geometries=geojson
```

That gives IrieVerse road-following GeoJSON lines plus normalized maneuver previews: instruction text, road names/refs, direction labels, distance, duration, roundabout exits, and destination/ref hints when OSRM returns them. The map uses green status indicators for road-following legs, amber indicators for estimated fallback legs, and per-leg fallback messaging when routing is still syncing or the provider fails.

For production scale, set `ROUTING_API_BASE_URL` to your own OSRM-compatible service or a paid routing provider proxy. If road routing fails, the map falls back to the local preview route instead of breaking and keeps the external Google Maps handoff available for full turn-by-turn navigation and traffic.

## Integration Status

Trips includes a compact planning confidence panel for launch QA:

| Planning area | Live state | Curated/estimated state |
| --- | --- | --- |
| Share links | `Ready` when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set and the trips table is reachable. | `Setup needed` and export still works. |
| Stays | `Live stays` when the configured booking source returns live data. | `Curated picks` with Jamaica stay ideas. |
| Flights | `Live schedule` when `/api/flights` returns AviationStack data. | `Saved examples` from `public/data/flights-sample.json`. |
| Road planning | `Road-aware` through `api/road-route.js`. | The map keeps preview route lines if the proxy fails. |
| Island events | Live provider if one is added later. | `Curated calendar` from `public/data/events.json`. |

Use this panel after each deploy to confirm the app is honest about which trip services are live, estimated, or curated.

## Verification

After setting production variables, run:

```bash
npm run build
```

Then test:

- Share trip creates and reloads a `?trip=` URL.
- `npm run qa:production` removes any Supabase share row it creates after marking it as production QA data.
- Flights display live data or a clear empty/error state.
- Booking cards display from the configured endpoint.
- Map route lines follow roads or gracefully fall back when the routing service is unavailable.
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `icon-1024.png`, and `apple-touch-icon.png` return `200`.
- Manifest shortcuts, screenshots, and the PWA share target are present.
- `?tab=saved&shared_url=...&shared_title=...&shared_text=...` opens Saved with the import form prefilled and auto-categorized, then removes the share params from the URL.
- App still works with any optional variable removed.
