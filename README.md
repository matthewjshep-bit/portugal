# Portugal — 18–27 September

An interactive, mapped itinerary for ten days in Portugal: Porto → Douro Valley →
Comporta → Lisbon → Sintra.

A single-page React app. No backend, no accounts, nothing to configure.

## What's in it

- **Day rail** across the top — ten days, colour-coded by region, with today highlighted.
- **Itinerary column** — each day broken into time blocks, with the places for that
  block attached. Tap a place to expand it: what it is, why it made the list (the
  rating or guide it came from), price, booking notes, and a Google Maps link.
- **Live map** (Leaflet + OpenStreetMap) that follows the itinerary. Scope it to the
  current day, the current region, or the whole trip — the whole-trip view draws the
  route as a dashed line.
- **Category filters** — eat, drink, do, beach, shop, stay, travel.
- **Booking checklist** with deadlines, and a saved shortlist. Both persist in
  `localStorage`, so they're per-browser and never leave the device.

## Running it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New… → Project**, pick this repo.
3. Vercel detects Vite automatically — framework preset **Vite**, build command
   `npm run build`, output directory `dist`. Don't change anything.
4. **Deploy.** You get a `*.vercel.app` URL straight away.

To use your own domain later: **Project → Settings → Domains → Add**, then point the
DNS records Vercel gives you. No code changes needed.

The app is a single route, so it needs no rewrite rules.

## Editing the trip

Everything lives in [`src/data/trip.js`](src/data/trip.js):

- `PLACES` — the 82 restaurants, bars, beaches, quintas and sights. Each has
  `coords`, a category, a description, and a `why` line citing where the
  recommendation came from.
- `DAYS` — the ten day plans. Each block references places by `id`.
- `BOOKINGS` — the reservation checklist, grouped by urgency.
- `LOGISTICS` — drives, tolls, ticket strategy, weather, packing.
- `SOURCES` — the guides and listings the picks were drawn from.

Add a place to `PLACES`, reference its `id` from a day block, and it appears in the
itinerary and on the map.

### A note on coordinates

Pins are hand-placed. They put you on the right stretch of street or sand, but small
beach clubs and quintas can sit a few hundred metres off — which is why every place
also carries a **Directions** link that searches Google Maps by name and lands exactly.

Opening hours, ticket rules and prices move. Confirm anything time-critical directly
before planning a day around it.
