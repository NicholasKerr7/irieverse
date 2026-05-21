# IrieVerse Travel OS

IrieVerse is a Jamaica-focused travel planning app for building a real trip from scattered ideas. It combines a 14-parish Jamaica guide, saved link imports, road-aware route planning, flight and stay snapshots, budget cues, local events, sharing, optional exact GPS starting points, and calendar export in one interactive workspace.

The app is built for people who want to plan Jamaica without bouncing between maps, notes, social posts, flight tabs, hotel tabs, and generic itinerary tools that do not understand the island.

## What It Solves

- Turns saved links, Google Maps places, TikToks, Instagram posts, YouTube links, and articles into usable trip ideas.
- Helps travelers understand which Jamaica parish, region, hero attraction, event, and starting point fit their vibe, dates, budget, and pace.
- Shows whether major attractions, beaches, tours, events, and experiences are free, ticketed, pass-based, or variable before users build the day around them.
- Replaces straight-line map guesses with road-following route previews and fallback messaging when route data is limited.
- Keeps planning useful when live providers are missing, rate-limited, or temporarily unavailable.
- Separates live data from curated Jamaica content so users know what is current and what is an editorial planning aid.
- Gives visitors and locals one place to compare stops, build day plans, choose a starting area or exact GPS start, save ideas, export calendars, and share trips.

## What Makes It Stand Out

- **Parish-by-parish guide**: all 14 parishes are represented with a hero attraction or place, hero image, parish context, entry guidance, local tips, and visitor tips.
- **Jamaica-first planning**: destinations, experiences, route pacing, parish labels, airport and local starting points, events, and trip language are specific to Jamaica.
- **Road-aware map planning**: MapLibre renders Jamaica pins and route geometry, while the route drawer keeps estimated lines available if detailed routing is unavailable.
- **Saved idea intelligence**: imported URLs can extract titles, descriptions, images, place facts, coordinates, and map anchors when metadata is available.
- **Live plus curated coverage**: flights, stays, place details, road routes, events, and sharing all label whether they are live, curated, limited, or paused.
- **Graceful provider handling**: the app still works without Amadeus. Stays show curated Jamaica recommendations until live hotel pricing is connected.
- **Trip-building workspace**: route order, day assignments, locked stops, notes, saved places, imported ideas, budgets, dates, and exports live together.
- **Flexible starting points**: users can start from major airports, Jamaica towns, local meetup areas, or an optional exact browser GPS point.
- **Dark-first interface**: the app boots in dark mode on every fresh load, regardless of saved or system preference, then lets users toggle after startup.
- **PWA-ready experience**: app shortcuts, install icons, share target support, offline cached data, and production QA checks are included.

## Questions IrieVerse Can Answer

- Where should I start my Jamaica trip based on my vibe?
- Which stops fit a food, beach, music, culture, nightlife, or family-friendly trip?
- How many days do I need for this route?
- What is the drive time between the places I picked?
- Is this route road-aware or only an estimated preview right now?
- Which saved places and imported ideas are already mapped?
- Which saved ideas still need Jamaica map anchors?
- Does this stop require a ticket, pass, registration, cover charge, parking fee, guide, or local confirmation?
- Which attraction is the hero stop for each parish?
- Which flights are live and which are saved examples?
- Are stays live-priced, curated, or limited by provider availability?
- What can I do near my selected base?
- Which day should a saved place or imported idea belong to?
- Can I export this itinerary to a calendar?
- Can I share this trip as a view-only link?
- What still needs setup before a production launch?

## How To Use The App

1. **Explore Jamaica**
   - Browse all 14 parish guide cards, each with a renowned hero attraction/place and hero image.
   - Filter destinations and experiences by vibe, parish, region, attraction, and category.
   - Check entry notes before adding a stop: free public access, ticket required, pass recommended, or confirm locally.
   - Save places or experiences that fit the trip.

2. **Open The Map**
   - Compare destinations, imported pins, and route stops.
   - Use route tabs to inspect each travel leg.
   - Open place details to see live place info when available or curated notes when not.

3. **Import Saved Ideas**
   - Paste a Google Maps, TikTok, Instagram, YouTube, article, or normal web URL into Saved.
   - IrieVerse extracts the best available preview and links the idea to a Jamaica planning area when possible.
   - Place imported ideas on the map if they need manual cleanup.

4. **Build A Trip**
   - Choose visitor or local mode.
   - Select a starting base, dates, trip length, vibe, budget, and starting point.
   - Pick a major origin airport, Jamaica starting area, or tap **Use exact GPS** to set a browser-provided starting coordinate.
   - Edit route order, lock important stops, add day notes, and assign saved ideas to days.

5. **Check Travel Support**
   - Trips shows a compact live/curated status panel for sharing, stays, flights, road planning, and events.
   - Current sources are labeled separately from curated or limited sources.

6. **Export Or Share**
   - Export the itinerary as an ICS calendar file.
   - If Supabase sharing is enabled, create a view-only share link with local edit-token updates from the creating browser.

## Main Features

- Destination and experience explorer with vibe filters and search
- 14-parish Jamaica guide with hero attractions, hero images, local tips, visitor tips, and ticket/pass notes
- Interactive MapLibre map with road-following route overlays
- Jamaica-specific road pacing, weather cues, local content, and trip language
- Saved boards with link import parsing and metadata enrichment
- Google Maps import enrichment when `GOOGLE_PLACES_API_KEY` is configured
- Optional email sign-in for cloud-saved Jamaica boards
- PWA share target for sending external travel links into the Saved import flow
- Region-aware trip planner with editable route order, route locks, pacing, budget, dates, and notes
- Expanded origin picker with US/Canada airports, Jamaica starting areas, and optional exact GPS start
- Trip planning support panel for share links, stays, flights, road routes, and events
- Flight snapshots through AviationStack or saved examples
- Stay recommendations through Amadeus when available or curated Jamaica picks when not
- Place detail enrichment through Google Places or curated Jamaica notes
- Optional Supabase-backed cloud boards and view-only trip sharing
- Production QA that validates routes, APIs, PWA assets, and cleanup behavior
- PWA manifest, install icons, shortcuts, share target, and same-origin offline cache

## Live Integrations And Curated Mode

IrieVerse does not require every provider key to be present. It is designed to stay honest and usable:

| Area | Live when configured | When missing or limited |
| --- | --- | --- |
| Flights | AviationStack through `/api/flights` | Saved flight examples |
| Stays | Amadeus through `/api/bookings` | Curated Jamaica stays |
| Place details | Google Places through `/api/place-details` | Curated Jamaica notes |
| Saved imports | Metadata and Google Places enrichment through `/api/import-metadata` | Local link parsing |
| Road routes | OSRM-compatible route provider through `/api/road-route` | Estimated route preview |
| Sharing | Supabase Auth and trip RPCs | Local planning and calendar export |
| Events | Built-in Jamaica calendar today | Curated regional calendar |

No Amadeus key is required to launch the app. If Amadeus is not connected, stays intentionally show curated Jamaica recommendations.

Exact GPS is optional. The app does not prompt for location on load; it asks only when a user taps **Use exact GPS** in the trip builder.

## Quick Start

1. Install Node 22.x. The `.nvmrc` file is set to the Node 22 LTS line.
2. Install dependencies:

```bash
npm install
```

3. Start local development:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Environment

Copy the template and fill only the integrations you are ready to use:

```bash
cp .env.example .env.local
```

Common optional variables:

```text
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_DISABLED=false

AVIATIONSTACK_API_KEY=your_aviationstack_key
AVIATIONSTACK_DISABLED=false
AVIATIONSTACK_CACHE_TTL_SECONDS=900
AVIATIONSTACK_COOLDOWN_SECONDS=1800
VITE_FLIGHTS_API_URL=/api/flights

VITE_BOOKING_API_URL=/api/bookings
AMADEUS_CLIENT_ID=your_amadeus_api_key
AMADEUS_CLIENT_SECRET=your_amadeus_api_secret
AMADEUS_BASE_URL=https://test.api.amadeus.com

GOOGLE_PLACES_API_KEY=your_google_places_key

ROUTING_API_BASE_URL=https://router.project-osrm.org
ROUTING_API_TIMEOUT_MS=4500
ROUTING_PROVIDER_COOLDOWN_SECONDS=45

IRIEVERSE_ALLOWED_ORIGINS=https://irieverse.vercel.app
IRIEVERSE_API_RATE_LIMIT_WINDOW_SECONDS=60
```

Only variables prefixed with `VITE_` are exposed to the browser. Keep AviationStack, Amadeus, Google Places, and routing credentials server-only.

See [docs/production-env.md](docs/production-env.md) for provider setup, production environment commands, API contracts, and Supabase migration details.

## Development Scripts

```bash
npm run dev             # Start Vite
npm run typecheck       # TypeScript checks
npm run test:api        # API handler regression tests
npm run build           # Service worker build plus production Vite build
npm run qa:local        # Playwright app-flow QA against a local dev server
npm run qa:production   # Playwright production QA against IRIEVERSE_APP_URL
npm run verify          # Typecheck, API tests, maintenance checks, audit, build
npm run verify:full     # Full verify plus local browser QA
npm run maintenance     # Production audit plus outdated package report
```

## Deployment

Recommended deployment target: Vercel.

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Serverless API routes: `api/*.ts`

Production checklist:

- Add `GOOGLE_PLACES_API_KEY` for live place details and richer Google Maps imports.
- Add `AVIATIONSTACK_API_KEY` for live flight snapshots.
- Leave Amadeus unset until you have credentials. Curated stays will remain active.
- Add `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, and `AMADEUS_BASE_URL` when hotel pricing is ready.
- Add `IRIEVERSE_ALLOWED_ORIGINS` for any custom domain beyond the default production domain.
- Push Supabase migrations before enabling cloud boards or shared trips.
- Run `npm run verify:full` before shipping a major UI or integration change.
- Run `npm run qa:production` after deployment.

## Screenshots

Generated by the Playwright QA flow against the current app build.

| Home | Explore | Map |
| --- | --- | --- |
| ![Mobile home](public/screenshots/mobile-home.png) | ![Mobile explore places](public/screenshots/mobile-explore-places.png) | ![Mobile map](public/screenshots/mobile-map.png) |

| Experiences | Saved import | Trips |
| --- | --- | --- |
| ![Mobile explore experiences](public/screenshots/mobile-explore-experiences.png) | ![Mobile saved import](public/screenshots/mobile-saved-import.png) | ![Mobile trips](public/screenshots/mobile-trips.png) |

Desktop home:

![Desktop home](public/screenshots/desktop-home.png)

Desktop map:

![Desktop map](public/screenshots/desktop-map.png)

## Marketing Kit

- Strategy: [docs/marketing-strategy.md](docs/marketing-strategy.md)
- Local mode plan: [docs/local-mode-plan.md](docs/local-mode-plan.md)
- Static press kit page: [public/press-kit.html](public/press-kit.html)
- Production press kit URL after deploy: `https://irieverse.vercel.app/press-kit.html`

The marketing kit uses QA-generated screenshots, so launch visuals stay aligned with the app.

## Tech Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- MapLibre through `react-map-gl`
- Supabase for optional auth, cloud boards, and trip sharing
- Vercel serverless functions for provider-safe API proxies
- Playwright for local and production QA

## Maintenance

- Dependabot checks npm packages and GitHub Actions weekly.
- Major dependency upgrades are handled manually because React, Vite, Tailwind, MapLibre, and TypeScript major bumps can affect UI and build behavior.
- Dependency Review blocks high-severity vulnerable additions.
- `npm run verify` runs the standard pre-push safety checks.
- `npm run verify:full` adds the browser QA suite.
- `npm run audit:all` runs the deeper moderate-severity audit.

See [docs/dependency-maintenance.md](docs/dependency-maintenance.md) for the full dependency review runbook.
