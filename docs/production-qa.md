# Production QA

## Current readiness note

- `supabase migration list --password ...` shows local and remote migration history are aligned through `20260522205437_harden_data_api_grants.sql`.
- `supabase db lint --linked --schema public,private --fail-on error` reports no schema errors.
- `npm run check:supabase` reports the repo migration, grant, RLS, and production docs checks pass.
- Plain `supabase migration list` can still fail on the CLI temp role; pass the current database password when checking remote migration history.

## Supabase sharing check

Date: 2026-05-17

Result: Passed production sharing and cloud board setup on the replacement Supabase project at the time of this check.

- Linked project: `xvfyljebjwfccfthbzcl`.
- Remote migration history now includes:
  `20260427120000`, `20260427195500`, `20260429120000`, `20260506120000`, `20260515161350`, and `20260522205437`.
- The Supabase probe created a `trips` row, read it back through the trip-share RPC, updated it with the correct local edit token, deleted it through the protected cleanup RPC, and verified the row was gone.
- Cloud board storage is migrated through `20260506120000_create_user_boards.sql`; the table has row-level security enabled and authenticated-only grants.
- The trip-share RPC hardening migration, `20260515161350_harden_trip_share_rpc.sql`, is applied and keeps privileged implementation functions in the private schema.
- The data API grant hardening migration, `20260522205437_harden_data_api_grants.sql`, is applied and keeps direct trip table access revoked from browser roles while preserving the public trip-share RPC wrappers.
- `supabase db lint --linked --schema public,private --fail-on error` reports no schema errors.

## Full QA run

Date: 2026-04-28

Target: https://irieverse.vercel.app

Command:

```bash
npm run qa:production
```

Result: 3 Playwright tests passed.

Coverage:

- Live app routes: `/`, `/?tab=map`
- PWA assets: `manifest.webmanifest`, favicons, install icons from 72px to 1024px, maskable icons, `apple-touch-icon.png`, `sw.js`
- Mobile screens: Home, Explore places, Explore experiences, Map, Saved import, Trips
- Desktop screens: Home hero navigation, Map
- User flows: save destination, auto-parse/import saved idea, add saved idea to trip, export ICS, share-link availability
- Supabase sharing: when a share link is created, the test verifies the row is readable, marks it as production QA data with the local edit token, deletes it through the protected cleanup RPC, and verifies the row is gone
- Flight proxy: `/api/flights` returns either AviationStack data or an explicit fallback meta state
- Map routing: `/api/road-route` returns OSRM road geometry, distance, duration, and maneuver steps
- Runtime checks: no page errors or same-origin request failures during the tested flows

Notes:

- The expected `hero.mp4` abort during tab navigation is ignored by the QA spec because the browser cancels the video request when leaving Home.
- The Map screen now opens with the selected-place sheet compact by default so road routes stay visible on mobile and desktop.
- If Supabase sharing is enabled, the share check creates a disposable test share row from the generated QA trip state and removes it with the local edit token before the test completes.

## Local regression QA

Run the local suite before production QA when changing Saved imports or Trips editing:

```bash
npm run qa:local
```

The local suite starts Vite automatically and checks:

- duplicate imported links update the existing saved idea instead of creating another card
- Google Maps imports keep their Jamaica map anchor
- trip day cards can change a day area, lock/unlock the day, refresh one add-on, and return to the automatic match
- the tested mobile view does not introduce horizontal overflow

Screenshots:

- `public/screenshots/mobile-home.png`
- `public/screenshots/mobile-explore-places.png`
- `public/screenshots/mobile-explore-experiences.png`
- `public/screenshots/mobile-map.png`
- `public/screenshots/mobile-saved-import.png`
- `public/screenshots/mobile-trips.png`
- `public/screenshots/desktop-home.png`
- `public/screenshots/desktop-map.png`
