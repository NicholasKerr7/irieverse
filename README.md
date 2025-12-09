# IrieVerse Travel OS
An interactive Jamaica trip planner built with React + Vite. Explore destinations and experiences, view maps, live events, flight snapshots, budgeting, and export/share itineraries.

## Features
- Destination + experience explorer with vibe filters and search
- Interactive map powered by MapLibre (no Mapbox token required)
- Trip planner with budget, dates, and ICS export
- Flight snapshot (live via AviationStack, sample data fallback)
- Live events feed and booking recommendations (sample data fallback)
- Optional Supabase-backed trip sharing

## Quick start
1) Install Node 18+  
2) Install deps: `npm install`  
3) Run dev server: `npm run dev`  
4) Build for prod: `npm run build`

## Environment (optional)
Create `.env.local` for any of the following:

```
VITE_SUPABASE_URL=your_supabase_url           # enables trip sharing
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key # enables trip sharing
VITE_AVIATIONSTACK_API_KEY=your_key           # live flights; otherwise uses public/data/flights-sample.json
VITE_BOOKING_API_URL=https://.../bookings     # live bookings; otherwise uses public/data/bookings.json
```

If env vars are absent, the app falls back to local sample data in `public/data`.

## Deployment
- Build output is static in `dist` (`npm run build`), so it works on Vercel, Netlify, or any static host.
- Vercel: Import the repo, Framework = Vite, Build Command = `npm run build`, Output = `dist`, add env vars as needed.
- Netlify: Build Command = `npm run build`, Publish directory = `dist`, set env vars. No functions required.
- Plain static hosting: run `npm run build` and serve the `dist` folder (e.g., `npx serve dist`).

## Screenshots
Capture a few key views and drop them into the repo (e.g., `public/screenshots`), then embed them here:
- Hero/search and Explore (places view)
- Experiences view with filters
- Map view
- Trip planner + flight snapshot + bookings
- Live events feed

## Tech stack
React 18, Vite, TypeScript, Tailwind CSS, MapLibre via `react-map-gl`, Supabase (optional for collab).
