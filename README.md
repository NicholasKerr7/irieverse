# IrieVerse Travel OS
An interactive Jamaica trip planner built with React + Vite. Explore destinations and experiences, view maps, live events, flight snapshots, budgeting, and export/share itineraries.

## Features
- Destination + experience explorer with vibe filters and search
- Interactive map powered by MapLibre with road-following route overlays
- Saved boards for places, experiences, pasted links, and manual Jamaica ideas
- Region-aware trip planner with editable route order, route pacing, drive estimates, budget, dates, and ICS export
- Flight snapshot (live via AviationStack, sample data fallback)
- Live events feed and booking recommendations (sample data fallback)
- Optional Supabase-backed trip sharing
- PWA manifest, install icons, app shortcuts, and same-origin offline cache for fallback data/assets

## Quick start
1) Install Node 18+  
2) Install deps: `npm install`  
3) Run dev server: `npm run dev`  
4) Build for prod: `npm run build`

## Environment (optional)
Copy `.env.example` to `.env.local` and fill any of the following:

```
VITE_SUPABASE_URL=your_supabase_url           # enables trip sharing
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key # enables trip sharing
VITE_AVIATIONSTACK_API_KEY=your_key           # live flights; otherwise uses public/data/flights-sample.json
VITE_BOOKING_API_URL=/api/bookings            # live bookings through the Vercel Amadeus proxy
AMADEUS_CLIENT_ID=your_amadeus_api_key        # server-only; do not prefix with VITE_
AMADEUS_CLIENT_SECRET=your_amadeus_api_secret # server-only; do not prefix with VITE_
ROUTING_API_BASE_URL=https://router.project-osrm.org # server-only road routing proxy
```

If env vars are absent, the app falls back to local sample data in `public/data`.
See `docs/production-env.md` for production platform setup, booking API response shape, and Supabase migration details.

## Deployment
- Vercel: Import the repo, Framework = Vite, Build Command = `npm run build`, Output = `dist`, add env vars as needed.
- The booking integration uses the Vercel serverless route at `/api/bookings`.
- The map driving overlay uses the Vercel serverless route at `/api/road-route`.
- PWA shortcuts open app tabs directly with `?tab=explore`, `?tab=map`, and `?tab=trips`.
- Plain static hosting: run `npm run build` and serve the `dist` folder (e.g., `npx serve dist`).

## Launch checks
- `npx tsc --noEmit`
- `npm run build`
- `npm run qa:production`
- `npm audit --omit=dev --audit-level=high`

Current audit note: npm reports a moderate MapLibre transitive advisory through `pbf`/`protocol-buffers-schema` with no available fix. High-severity production audit currently passes.

## Screenshots
Capture a few key views and drop them into the repo (e.g., `public/screenshots`), then embed them here:
- Hero/search and Explore (places view)
- Experiences view with filters
- Map view
- Trip planner + flight snapshot + bookings
- Live events feed

## Tech stack
React 18, Vite, TypeScript, Tailwind CSS, MapLibre via `react-map-gl`, Supabase (optional for collab).
