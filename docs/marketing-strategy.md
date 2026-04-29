# IrieVerse Marketing Strategy

IrieVerse is far enough along to market as a focused product, not just a concept. The screenshots, PWA manifest assets, production QA flow, and live Vercel build already create the foundation for a launch kit.

## Positioning

**Primary position:** Jamaica-first Travel OS.

**Short pitch:** IrieVerse helps travelers discover Jamaica by vibe, map real road routes, save trip ideas, and build shareable itineraries with budget, flights, events, bookings, and calendar export in one mobile-first app.

**What makes it different:**

- It is Jamaica-specific instead of a generic travel planner.
- It keeps Jamaica's road time, weather shifts, and local food/music/beach/culture context at the center of planning.
- It combines discovery, saved ideas, route planning, budget planning, and itinerary export.
- The map is not decorative; it supports real road-route planning.
- The Saved flow supports pasted travel ideas, PWA share-target imports, and automatic link parsing for source, place, and category.
- The app stays usable with curated travel examples, so demos do not depend on every live provider being configured.

## Audience

| Audience | Need | IrieVerse angle |
| --- | --- | --- |
| First-time Jamaica travelers | They want confidence choosing regions, activities, and routes. | Plan Jamaica by vibe, route, and budget. |
| Couples and friend groups | They need a shared plan that feels exciting and practical. | Save ideas, build trips, export calendar plans, share trips. |
| Diaspora travelers | They may know the island culturally but still need modern planning tools. | Jamaica-first discovery with culture, food, nightlife, and route awareness. |
| Jamaica locals | They want easier weekend, food, beach, river, nightlife, and hosting plans. | Local mode can turn saved ideas into realistic day trips and group plans. |
| Travel creators | They save ideas from social platforms and need a place to organize them. | Paste links into Saved, auto-categorize them, and add them to a trip. |
| Boutique travel planners | They need a quick visual way to explain routes and day plans. | Map routes, daily plans, budget, events, bookings, and shareable links. |

## Feature Pillars

### 1. Discover Jamaica By Vibe

Use the Explore screenshots to show destination and experience browsing. Lead with mobile cards, filters, ratings, regions, vibe chips, and add-to-trip actions.

Screenshot:

![Explore places](../public/screenshots/mobile-explore-places.png)

### 2. See The Route Before You Go

Use the Map screenshots to show the road-following route geometry, day chips, selected place sheet, and desktop command view.

Screenshots:

![Mobile map](../public/screenshots/mobile-map.png)

![Desktop map](../public/screenshots/desktop-map.png)

### 3. Save Ideas From Anywhere

Use the Saved import screenshot to explain the first version of the Roamy-style import flow: paste a Google Maps, TikTok, Instagram, YouTube, or article link; let IrieVerse infer the source, title, place, category, and Jamaica region; save to a collection; and later add it to a trip.

Screenshot:

![Saved import](../public/screenshots/mobile-saved-import.png)

### 4. Build A Real Trip

Use the Trips screenshot to show that IrieVerse is not only inspiration. It supports dates, route pacing, budget planning, flights, events, booking recommendations, ICS export, and Supabase sharing when configured.

Screenshot:

![Trips](../public/screenshots/mobile-trips.png)

### 5. Start With A Premium Jamaica Home

Use the Home screenshot as the opening visual for landing pages, social posts, pitch decks, and install prompts.

Screenshots:

![Home](../public/screenshots/mobile-home.png)

![Desktop home](../public/screenshots/desktop-home.png)

## Messaging Architecture

**Headline options:**

- Plan Jamaica by vibe, route, budget, and real island experiences.
- Your Jamaica trip, mapped before you land.
- Save the idea. Map the route. Build the trip.
- The Jamaica-first Travel OS for travelers who want more than a list.

**Subheadline options:**

- Discover places and experiences, save outside ideas, map real road routes, and build a shareable Jamaica itinerary.
- IrieVerse brings Explore, Map, Saved, and Trips into one mobile-first planning flow for Jamaica.
- From beach days to Kingston culture nights, IrieVerse helps turn scattered ideas into a route-aware trip plan.

**Product bullets:**

- Browse places and experiences by vibe.
- Save Jamaica ideas, links, places, and experiences.
- Map real road routes across the island.
- Build daily plans with drive estimates and route pacing.
- Review budget, flights, events, and booking recommendations.
- Export calendar files and share trips when Supabase is configured.
- Use curated examples when live providers are not configured.

## Screenshot Story

Use this order for website sections, pitch decks, and social carousels:

| Step | Screenshot | Message |
| --- | --- | --- |
| 1 | `mobile-home.png` | Start with a cinematic Jamaica planning experience. |
| 2 | `mobile-explore-places.png` | Browse destinations by vibe, region, rating, and cost. |
| 3 | `mobile-explore-experiences.png` | Find food, music, culture, nightlife, and adventure. |
| 4 | `mobile-map.png` | Preview road routes and selected stops before the trip. |
| 5 | `mobile-saved-import.png` | Save ideas from links and organize them into boards. |
| 6 | `mobile-trips.png` | Turn saved ideas into a practical itinerary. |
| 7 | `desktop-home.png` | Show the improved desktop hero navigation and premium landing state. |
| 8 | `desktop-map.png` | Show the product also works as a serious desktop planning tool. |

## Channel Strategy

### Website / Press Kit

Use `public/press-kit.html` as a lightweight launch page for sharing product positioning and screenshots. It is static, so it can be viewed locally and served by Vercel at:

```text
https://irieverse.vercel.app/press-kit.html
```

Future local-user expansion is captured in `docs/local-mode-plan.md`.

### Social Launch

Best channels:

- TikTok and Instagram Reels for route-planning demos.
- Instagram carousel for screenshot story.
- X / Threads for build-in-public updates.
- LinkedIn for product/technical launch story.
- Jamaica travel Facebook groups only after the app has clearer feedback collection.

### Creator Outreach

Target:

- Jamaica travel vloggers.
- Diaspora creators.
- Food and nightlife creators.
- Small trip planners and boutique Jamaica travel advisors.

Outreach angle:

```text
I am building IrieVerse, a Jamaica-first Travel OS that lets travelers discover places, save ideas, map road routes, and build shareable itineraries. I would value feedback from people who know Jamaica travel deeply.
```

## Social Copy

### Instagram Carousel Caption

```text
Planning Jamaica should not feel like juggling screenshots, Google Maps tabs, flight notes, budgets, and random saved links.

IrieVerse brings it into one flow:

Discover places and experiences.
Save ideas.
Map the route.
Build the trip.
Export or share the plan.

Built Jamaica-first.
```

### TikTok / Reels Script

```text
POV: You are planning Jamaica and your ideas are everywhere.

One screenshot says Negril.
One TikTok says Kingston.
Your group chat says Montego Bay.
Google Maps says everything is far.

IrieVerse turns that into a route-aware trip.

Explore by vibe.
Save places and links.
See the road route.
Build the itinerary.
Check budget, flights, events, and bookings.

This is a Jamaica-first Travel OS.
```

### Product Hunt Style Copy

```text
IrieVerse is a Jamaica-first Travel OS for discovering places and experiences, saving trip ideas, mapping road routes, and building shareable itineraries with budget, flights, events, booking recommendations, and calendar export.
```

### LinkedIn Launch Post

```text
I have been building IrieVerse, a mobile-first Jamaica travel planning app.

The goal is simple: make Jamaica trip planning feel less scattered.

The app now supports:
- places and experiences discovery
- saved boards and pasted travel ideas
- an interactive Jamaica map with road-following route overlays
- region-aware trip planning
- budget, flights, events, and booking recommendation panels
- ICS export and optional Supabase sharing
- curated examples when live providers are not configured

It is still early, but it is now a real product surface that can be tested.
```

## Launch Sequence

### Week 1: Soft Launch

- Share the Vercel link privately with 10-20 people.
- Ask each tester to plan one Jamaica trip and report where they hesitate.
- Track comments around Explore, Map, Saved, and Trips separately.
- Confirm mobile responsiveness on iPhone, Android, tablet, and desktop.

### Week 2: Creator Feedback

- Send the press kit to 10 Jamaica travel creators.
- Ask for feedback, not promotion.
- Prioritize comments about missing places, wrong vibe categories, or confusing routing.

### Week 3: Public Build-In-Public Launch

- Post the screenshot carousel.
- Post a short map-route demo.
- Share the technical story on LinkedIn.
- Add a simple feedback form or email link before sending broader traffic.

### Week 4: Focused Campaign

- Pick one angle and push it repeatedly:
  - "Plan Jamaica by vibe"
  - "Map your Jamaica route"
  - "Save Jamaica ideas from anywhere"
- Avoid trying to market every feature at once.

## Asset Checklist

Already available:

- `public/screenshots/mobile-home.png`
- `public/screenshots/mobile-explore-places.png`
- `public/screenshots/mobile-explore-experiences.png`
- `public/screenshots/mobile-map.png`
- `public/screenshots/mobile-saved-import.png`
- `public/screenshots/mobile-trips.png`
- `public/screenshots/desktop-home.png`
- `public/screenshots/desktop-map.png`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/icon-1024.png`
- `public/apple-touch-icon.png`
- `public/press-kit.html`

Recommended next assets:

- 15-second route demo video.
- 30-second full app walkthrough.
- 3-phone mockup image for social headers.
- Founder/product story page.
- Simple feedback form.

## Metrics

Track these before a broader launch:

| Metric | Why it matters |
| --- | --- |
| Home to Explore clicks | Tests whether the promise is clear. |
| Explore saves | Tests discovery quality. |
| View on Map clicks | Tests whether users care about route context. |
| Add to Trip clicks | Tests planning intent. |
| Import saves | Tests the Roamy-style external idea workflow. |
| ICS exports | Tests practical trip-building value. |
| Share link attempts | Tests collaboration demand. |

## Best Next Move

Ship the press kit and strategy now, then run a soft launch with real testers. The app is not waiting on more marketing structure. It needs feedback from people trying to plan actual Jamaica trips.

Before public promotion, add one lightweight feedback capture method so early traffic can teach you what to improve next.
