# IrieVerse

IrieVerse is a Jamaica-first travel planning app for turning saved ideas, parish knowledge, road routes, events, budgets, flights, stays, and daily plans into one usable island itinerary.

It is built for a specific planning problem: Jamaica trips are rarely solved by a generic itinerary builder. Visitors and locals need real parish context, realistic drive pacing, entry notes, local events, saved social links, and a map that understands the island.

## Why It Stands Out

Most travel tools treat Jamaica as a list of attractions. IrieVerse treats it as an island you have to move through.

- **Jamaica-specific content:** parish cards, hero attractions, beaches, food stops, culture, music, nightlife, road pacing, airports, starting areas, and event context.
- **Saved idea intelligence:** paste Google Maps, TikTok, Instagram, YouTube, article, or normal web links and turn them into organized trip ideas.
- **Route-aware planning:** compare stops on a live map, inspect route legs, and avoid plans that look good on a list but break down on the road.
- **Entry clarity:** attractions and events can show whether a ticket, pass, cover, guide, parking fee, or local confirmation may be needed.
- **Live plus curated data:** flights, stays, events, place details, routes, and sharing all stay transparent about whether data is live, curated, limited, or unavailable.
- **Local and visitor use cases:** plan a vacation, a weekend, a food run, a beach day, a route for guests, or a multi-stop island trip.

## User Flow

1. **Explore**
   Browse parishes, destinations, and experiences. Filter by vibe and category, then save the ideas that fit.

2. **Save**
   Paste outside links into Saved. IrieVerse extracts the best available title, description, source, image, and place details, then keeps the idea ready for trip planning.

3. **Map**
   Compare Jamaica pins, imported ideas, route stops, and day tabs. The drawer shows the complete route and keeps every planned day visible across mobile and desktop.

4. **Build Trip**
   Pick a base, dates, days, budget, vibe, route stops, starting point, and notes. Use curated planning data immediately or connect live providers over time.

5. **Export Or Share**
   Download an ICS calendar file, open route handoff links, or enable Supabase sharing for view-only trip links.

## Live Data Model

IrieVerse is designed to launch without every provider key. Missing providers do not break the app; the UI labels what is live and what is curated.

| Area | Live source | If not configured |
| --- | --- | --- |
| Places | Google Places | Curated Jamaica notes |
| Flights | AviationStack | Saved flight examples |
| Stays | Amadeus | Curated Jamaica stays |
| Events | Supabase verified events, Eventbrite, and Ticketmaster | Built-in Jamaica event calendar |
| Routes | OSRM-compatible routing | Estimated route preview |
| Sharing | Supabase | Local planning plus calendar export |
| Saved imports | Metadata and Google Places enrichment | Local link parsing |

Amadeus is optional. If hotel pricing is not connected, IrieVerse intentionally shows curated Jamaica stay recommendations.

Only variables prefixed with `VITE_` are exposed to the browser. Keep provider credentials server-only.

## Tech Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- MapLibre via `react-map-gl`
- Vercel serverless API routes
- Supabase for optional auth, cloud boards, and trip sharing
- Playwright for local and production QA

## Run Locally

Requirements:

- Node `22.x`
- npm `>=10`

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

Optional environment setup:

```bash
cp .env.example .env.local
```

Fill only the providers you want to use. The app remains usable with no live keys.

Detailed provider setup lives in [docs/production-env.md](docs/production-env.md).

## Scripts

```bash
npm run dev             # Start Vite
npm run typecheck       # TypeScript checks
npm run test:api        # API handler regression tests
npm run build           # Service worker build plus production Vite build
npm run qa:local        # Playwright app-flow QA against local dev
npm run qa:production   # Playwright production QA against IRIEVERSE_APP_URL
npm run verify          # Standard pre-push verification
npm run verify:full     # Verification plus browser QA
npm run maintenance     # Production audit plus outdated package report
```

## Deployment

Recommended target: Vercel.

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- API routes: `api/*.ts`

Production priorities:

- Add `GOOGLE_PLACES_API_KEY` for live place details and better Google Maps imports.
- Add `EVENTBRITE_PRIVATE_TOKEN` and/or `TICKETMASTER_API_KEY` for automatic live event listings.
- Add `AVIATIONSTACK_API_KEY` for live flight snapshots.
- Keep Amadeus unset until hotel pricing credentials are ready.
- Add Supabase migrations before enabling cloud boards, shared trips, or the verified event calendar.
- Run `npm run verify:full` before major releases.
- Run `npm run qa:production` after deployment.

## Screenshots

| Home | Explore | Map |
| --- | --- | --- |
| ![Mobile home](public/screenshots/mobile-home.png) | ![Mobile explore places](public/screenshots/mobile-explore-places.png) | ![Mobile map](public/screenshots/mobile-map.png) |

| Experiences | Saved import | Trips |
| --- | --- | --- |
| ![Mobile explore experiences](public/screenshots/mobile-explore-experiences.png) | ![Mobile saved import](public/screenshots/mobile-saved-import.png) | ![Mobile trips](public/screenshots/mobile-trips.png) |

Desktop:

![Desktop home](public/screenshots/desktop-home.png)

![Desktop map](public/screenshots/desktop-map.png)

## Documentation

- [Production environment](docs/production-env.md)
- [Production QA](docs/production-qa.md)
- [Dependency maintenance](docs/dependency-maintenance.md)
- [Media attributions](docs/media-attributions.md)
- [Marketing strategy](docs/marketing-strategy.md)
- [Local mode plan](docs/local-mode-plan.md)
- [Press kit](public/press-kit.html)

## Maintenance Notes

- Dependabot checks npm packages and GitHub Actions weekly.
- Major dependency upgrades are reviewed manually because UI, build, and map behavior can shift.
- Dependency Review blocks high-severity vulnerable additions.
- `npm run verify` is the standard safety check.
- `npm run verify:full` adds browser coverage.
