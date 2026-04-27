# Production Environment

IrieVerse runs without production secrets by using local fallback data. Add these variables only when you want live integrations.

## Variables

| Name | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Optional | Enables shared trip links with Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Optional | Public anon key for the Supabase project. |
| `VITE_AVIATIONSTACK_API_KEY` | Optional | Enables live flight snapshots through AviationStack. |
| `VITE_BOOKING_API_URL` | Optional | Enables live booking recommendations from the server booking endpoint. |
| `AMADEUS_CLIENT_ID` | Optional | Server-only Amadeus API key used by `api/bookings.js`. |
| `AMADEUS_CLIENT_SECRET` | Optional | Server-only Amadeus API secret used by `api/bookings.js`. |
| `AMADEUS_BASE_URL` | Optional | Amadeus base URL. Defaults to `https://test.api.amadeus.com`; use `https://api.amadeus.com` for production credentials. |
| `ROUTING_API_BASE_URL` | Optional | Server-only OSRM-compatible routing base URL used by `api/road-route.js`. Defaults to `https://router.project-osrm.org`. |

Only variables prefixed with `VITE_` are exposed to the browser. Keep Amadeus credentials server-only.

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
vercel env add VITE_AVIATIONSTACK_API_KEY production
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

When `VITE_AVIATIONSTACK_API_KEY` is set, IrieVerse calls AviationStack for scheduled flights using the selected origin and destination airport codes. If the variable is missing, the app uses `public/data/flights-sample.json`.

## Road Routing

The map uses `api/road-route.js` to request real driving geometry for each route leg. By default, the endpoint calls the public OSRM demo server:

```text
https://router.project-osrm.org/route/v1/driving/{lon,lat};{lon,lat}?overview=full&geometries=geojson
```

That gives IrieVerse road-following GeoJSON lines while keeping the browser code provider-neutral. For production scale, set `ROUTING_API_BASE_URL` to your own OSRM-compatible service or a paid routing provider proxy. If road routing fails, the map falls back to the local preview route instead of breaking.

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
- `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, and `apple-touch-icon.png` return `200`.
- App still works with any optional variable removed.
