# Production QA

Date: 2026-04-27

Target: https://irieverse.vercel.app

Command:

```bash
npm run qa:production
```

Result: 2 Playwright tests passed.

Coverage:

- Live app routes: `/`, `/?tab=map`
- PWA assets: `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `sw.js`
- Mobile screens: Home, Explore places, Explore experiences, Map, Saved import, Trips
- Desktop screen: Map
- User flows: save destination, import saved idea, add saved idea to trip, export ICS, share-link availability
- Map routing: `/api/road-route` returns OSRM road geometry with more than 100 coordinates
- Runtime checks: no page errors or same-origin request failures during the tested flows

Notes:

- The expected `hero.mp4` abort during tab navigation is ignored by the QA spec because the browser cancels the video request when leaving Home.
- The Map screen now opens with the selected-place sheet compact by default so road routes stay visible on mobile and desktop.
- If Supabase sharing is enabled, the share check can create a disposable test share row from the generated QA trip state.

Screenshots:

- `public/screenshots/mobile-home.png`
- `public/screenshots/mobile-explore-places.png`
- `public/screenshots/mobile-explore-experiences.png`
- `public/screenshots/mobile-map.png`
- `public/screenshots/mobile-saved-import.png`
- `public/screenshots/mobile-trips.png`
- `public/screenshots/desktop-map.png`
