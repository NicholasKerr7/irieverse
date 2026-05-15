# Production Environment

IrieVerse runs without production secrets by using local fallback data. Add these variables only when you want live integrations.

## Variables

| Name | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Optional | Enables email sign-in, cloud-saved boards, and shared trip links with Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Optional | Public anon key for the Supabase project. |
| `VITE_SUPABASE_DISABLED` | Optional | Set to `true` to keep online boards and shared trip links disabled even when Supabase env vars are present. |
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
| `ROUTING_API_TIMEOUT_MS` | Optional | Max server wait for one routing-provider request. Defaults to `4500` ms. |
| `ROUTING_PROVIDER_COOLDOWN_SECONDS` | Optional | Server-side pause after routing-provider failures before retrying live geometry. Defaults to `45` seconds. |
| `GOOGLE_PLACES_API_KEY` | Optional | Server-only Google Places key used by `api/place-details.js` for live place address, hours, phone, website, and map links. |

Only variables prefixed with `VITE_` are exposed to the browser. Keep AviationStack, Amadeus, Places, and routing credentials server-only.

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
vercel env add VITE_SUPABASE_DISABLED production
vercel env add AVIATIONSTACK_API_KEY production
vercel env add AVIATIONSTACK_CACHE_TTL_SECONDS production
vercel env add AVIATIONSTACK_COOLDOWN_SECONDS production
vercel env add VITE_FLIGHTS_API_URL production
vercel env add VITE_BOOKING_API_URL production
vercel env add AMADEUS_CLIENT_ID production
vercel env add AMADEUS_CLIENT_SECRET production
vercel env add AMADEUS_BASE_URL production
vercel env add ROUTING_API_BASE_URL production
vercel env add ROUTING_API_TIMEOUT_MS production
vercel env add ROUTING_PROVIDER_COOLDOWN_SECONDS production
vercel env add GOOGLE_PLACES_API_KEY production
```

For this Vercel app, `VITE_BOOKING_API_URL` should be:

```text
/api/bookings
```

## Supabase Boards And Sharing

Cloud-saved boards use Supabase Auth email sign-in plus an owner-scoped table named `user_boards`.

```text
id uuid primary key
user_id uuid references auth.users(id)
board_key text
data jsonb
created_at timestamptz
updated_at timestamptz
```

The migration in `supabase/migrations/20260506120000_create_user_boards.sql` creates this table, enables row-level security, and allows authenticated users to read/write only their own board rows.

Saved board data includes saved places, saved experiences, imported ideas, collection assignments, and map anchors. The app still keeps the local board active when the user is signed out or Supabase is not configured.

In the Supabase dashboard, keep Email Auth enabled and add the production app URL to the allowed redirect URLs so magic-link sign-in can return to `/?tab=saved`.

Trip sharing expects a Supabase table named `trips` with this shape:

```text
id uuid primary key
data jsonb
edit_token_hash text
updated_at timestamptz
```

The migration in `supabase/migrations/20260427120000_create_trips_sharing.sql` creates the original sharing table.
The migration in `supabase/migrations/20260429120000_secure_trip_sharing.sql` adds edit-token hashes and RPC functions for create/read/update/delete so public share links are view-only unless the browser has the local edit token.
The migration in `supabase/migrations/20260515161350_harden_trip_share_rpc.sql` moves the privileged trip-share implementation into a private schema, keeps public RPC wrapper names for the client, narrows function search paths, validates edit-token hashes, and caps shared trip payload size.
The app stores planner settings, saved places, saved experiences, imported ideas, and day-level experience picks in the `data` JSON payload.

To apply it with the Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

For manual setup, run `supabase/schema.sql` in the Supabase SQL editor. Keep it mirrored with the migration if the table shape changes.

If the app reports share setup incomplete, run `supabase/schema.sql` or push all migrations, wait for the schema cache to refresh, then retry Share. If `supabase db push` fails with a remote Postgres password error, re-run `supabase link --project-ref your-project-ref --password your-current-db-password` before pushing migrations.

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

Saved imports call `api/import-metadata.js` after a user pastes a URL. The endpoint fetches public Open Graph metadata for normal articles, uses YouTube oEmbed for YouTube links, and follows safe public redirects so shortened links can keep a cleaner final URL. Google Maps links use the server-only `GOOGLE_PLACES_API_KEY` when available to improve the saved title, address-style description, canonical Maps URL, and structured place facts such as address, coordinates, rating, type, phone, and website. TikTok and Instagram stay heuristic-first because those platforms commonly restrict metadata access.

```text
GET /api/import-metadata?url={encodedPublicUrl}
```

The endpoint accepts public `http`/`https` URLs only, blocks localhost/private-network targets, caches metadata in memory for 24 hours, and returns a low-confidence fallback object if metadata is unavailable. The client keeps the existing parser active either way and stores available preview title, description, image, site name, final URL, and Google place facts with the imported idea. When Google place coordinates are available, saved imports also appear as dedicated map pins in the Map screen and auto-anchor to the nearest Jamaica planning area for trip building.

## Road Routing

The map uses `api/road-route.js` to request real driving geometry for each route leg. By default, the endpoint calls the public OSRM demo server:

```text
https://router.project-osrm.org/route/v1/driving/{lon,lat};{lon,lat}?overview=full&geometries=geojson
```

That gives IrieVerse road-following GeoJSON lines plus normalized maneuver previews: instruction text, road names/refs, direction labels, distance, duration, roundabout exits, and destination/ref hints when OSRM returns them. The map uses green status indicators for road-following legs, amber indicators for estimated fallback legs, and per-leg fallback messaging when routing is still syncing or the provider fails.

For production scale, set `ROUTING_API_BASE_URL` to your own OSRM-compatible service or a paid routing provider proxy. `ROUTING_API_TIMEOUT_MS` keeps slow provider calls from holding the map open, while `ROUTING_PROVIDER_COOLDOWN_SECONDS` prevents repeated failing retries from hammering the same provider. If road routing fails, the map falls back to the local preview route instead of breaking and keeps the external Google Maps handoff available for full turn-by-turn navigation and traffic.

## Place Details API

The map detail sheet calls `api/place-details.js` when a user opens a destination or experience. The endpoint uses the server-only `GOOGLE_PLACES_API_KEY` with Google Places Text Search, then returns a normalized place object:

```text
GET /api/place-details?kind=destination&name=Negril&region=West%20Coast&latitude=18.2728&longitude=-78.3488&placeQuery=Seven%20Mile%20Beach%2C%20Negril%2C%20Jamaica&requiredTerms=seven,mile
```

When the key is configured and a trustworthy match is found, the sheet can show live address, open/closed state, hours, phone, website, Google Maps link, rating count, and place type. Built-in Jamaica stops pass curated `placeQuery` and `requiredTerms` hints so broad destinations like Montego Bay enrich from the intended landmark instead of an unrelated nearby business. When the key is missing or the match looks wrong, the endpoint returns no live data and the UI keeps showing curated Jamaica content without setup language.

Use a server-side key only:

```bash
vercel env add GOOGLE_PLACES_API_KEY production
```

## Integration Status

Trips includes a compact planning confidence panel for launch QA:

| Planning area | Live state | Curated/estimated state |
| --- | --- | --- |
| Share links | `Ready` when `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the trip-share RPC functions are reachable. | `Setup needed` and export still works. |
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

- Share trip creates and reloads a view-only `?trip=` URL; updates require the local edit token stored in the creating browser.
- `npm run qa:production` removes any Supabase share row it creates through the edit-token-protected cleanup RPC.
- Flights display live data or a clear empty/error state.
- Booking cards display from the configured endpoint.
- Map route lines follow roads or gracefully fall back when the routing service is unavailable.
- `manifest.webmanifest`, favicons, install icons, maskable icons, and `apple-touch-icon.png` return `200`.
- Manifest shortcuts, screenshots, maskable install icons, and the PWA share target are present.
- `?tab=saved&shared_url=...&shared_title=...&shared_text=...` opens Saved with the import form prefilled and auto-categorized, then removes the share params from the URL.
- `/?page=privacy` and `/?page=terms` load the public launch policy pages and link back to the app.
- App still works with any optional variable removed.
