# Production Environment

IrieVerse runs without production secrets by using local fallback data. Add these variables only when you want live integrations.

## Variables

| Name | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Optional | Enables shared trip links with Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Optional | Public anon key for the Supabase project. |
| `VITE_AVIATIONSTACK_API_KEY` | Optional | Enables live flight snapshots through AviationStack. |
| `VITE_BOOKING_API_URL` | Optional | Enables live booking recommendations from your own booking endpoint. |

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
```

For Netlify:

```bash
netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co" --context production
netlify env:set VITE_SUPABASE_ANON_KEY "your-anon-key" --context production
netlify env:set VITE_AVIATIONSTACK_API_KEY "your-aviationstack-key" --context production
netlify env:set VITE_BOOKING_API_URL "https://your-api.example.com/bookings" --context production
```

## Supabase Sharing

Trip sharing expects a Supabase table named `trips` with this shape:

```text
id uuid primary key
data jsonb
updated_at timestamptz
```

The migration in `supabase/migrations/20260427120000_create_trips_sharing.sql` creates the MVP sharing table and public anon policies. The app stores planner settings, saved places, saved experiences, and imported ideas in the `data` JSON payload.

To apply it with the Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

For manual setup, run `supabase/schema.sql` in the Supabase SQL editor. Keep it mirrored with the migration if the table shape changes.

## Booking API Contract

When `VITE_BOOKING_API_URL` is set, IrieVerse calls:

```text
GET {VITE_BOOKING_API_URL}?destination={airportCode}&origin={airportCode}
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

If the variable is missing, the app uses `public/data/bookings.json`.

## Flight API

When `VITE_AVIATIONSTACK_API_KEY` is set, IrieVerse calls AviationStack for scheduled flights using the selected origin and destination airport codes. If the variable is missing, the app uses `public/data/flights-sample.json`.

## Verification

After setting production variables, run:

```bash
npm run build
```

Then test:

- Share trip creates and reloads a `?trip=` URL.
- Flights display live data or a clear empty/error state.
- Booking cards display from the configured endpoint.
- App still works with any optional variable removed.
