# Production QA

## Supabase sharing check

Date: 2026-04-28

Result: Passed live table probe.

- Linked project: `divgxhxckrthasurbdqz` (`irieverse`).
- `supabase migration list` confirms local and remote migration history match:
  `20260427120000` and `20260427195500`.
- Live Supabase REST probe created a `trips` row, read it back through the anon API, updated it, deleted it through the QA-only policy, and verified the row was gone.
- `supabase db lint --linked` and `supabase db push --dry-run` still need a valid direct Postgres CLI login; the linked CLI login currently returns password authentication failure for `cli_login_postgres`.

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
- PWA assets: `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `sw.js`
- Mobile screens: Home, Explore places, Explore experiences, Map, Saved import, Trips
- Desktop screens: Home hero navigation, Map
- User flows: save destination, auto-parse/import saved idea, add saved idea to trip, export ICS, share-link availability
- Supabase sharing: when a share link is created, the test verifies the row is readable, marks it as production QA data, deletes it through the QA-only delete policy, and verifies the row is gone
- Flight proxy: `/api/flights` returns either AviationStack data or an explicit fallback meta state
- Map routing: `/api/road-route` returns OSRM road geometry, distance, duration, and maneuver steps
- Runtime checks: no page errors or same-origin request failures during the tested flows

Notes:

- The expected `hero.mp4` abort during tab navigation is ignored by the QA spec because the browser cancels the video request when leaving Home.
- The Map screen now opens with the selected-place sheet compact by default so road routes stay visible on mobile and desktop.
- If Supabase sharing is enabled, the share check creates a disposable test share row from the generated QA trip state and removes it before the test completes.

Screenshots:

- `public/screenshots/mobile-home.png`
- `public/screenshots/mobile-explore-places.png`
- `public/screenshots/mobile-explore-experiences.png`
- `public/screenshots/mobile-map.png`
- `public/screenshots/mobile-saved-import.png`
- `public/screenshots/mobile-trips.png`
- `public/screenshots/desktop-home.png`
- `public/screenshots/desktop-map.png`
