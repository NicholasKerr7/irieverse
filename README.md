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

## Tech stack
React 18, Vite, TypeScript, Tailwind CSS, MapLibre via `react-map-gl`, Supabase (optional for collab).
