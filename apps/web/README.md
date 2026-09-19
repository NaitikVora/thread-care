# RecallAR — Caregiver Web Dashboard

The caregiver-facing half of RecallAR, a personalized AR memory companion for people
living with Alzheimer's and their caregivers. This dashboard lets a caregiver (Sarah)
see what her person (John) did on his RecallAR mobile app today, and will grow into
where she personalizes his people, memories, objects, and routines.

Dependency-free vanilla HTML/CSS/JS, in the spirit of the original prototype this app
was built from — no build step, no framework, no database required for the demo.

## Run locally

Requires Node.js 20 or later.

    npm start

Open http://127.0.0.1:4173. The port can be changed with the `PORT` environment variable.
The server binds to loopback only.

    npm test
    npm run check

## What's here

- **Overview** — "John's Day": activities completed, memory activities, AR quests, hints
  used, and a Recent Activity timeline. Counts are always descriptive ("completed 4
  activities"), never a diagnostic judgment about the person — see spec section 20.
- **People / Memories / Objects** — read-only cards from the seeded demo data.
- **Activity** — the full activity log (Overview's Recent Activity, unabbreviated).
- **Settings** — placeholder; not yet built.

## Data

All content is mock/seeded demo data in [`dist/data.js`](dist/data.js) for patient John
Miller and caregiver Sarah Miller — no live backend, no persistence. Its shape mirrors
[`packages/shared/src/types.ts`](../../packages/shared/src/types.ts) and
[`seed-data.ts`](../../packages/shared/src/seed-data.ts), the same seed data the
`@recallar/mobile` app uses; the two are hand-kept in sync rather than shared code,
since this app has no bundler to import TypeScript. `dist/data.js` also exports the
pure functions (`computeDailySummary`, `buildActivityFeed`) that turn raw logs into the
Overview stats and timeline — see [`tests/data.test.mjs`](tests/data.test.mjs).

## Structure

    dist/index.html         Sidebar nav (Overview/People/Memories/Objects/Activity/Settings) + views
    dist/styles.css         Shared layout, cards, nav, and dashboard-specific styles
    dist/app.js             Icon renderer for [data-icon] elements
    dist/data.js            Seed data + pure derived-data functions (unit-testable)
    dist/controller.js      Nav switching and view rendering (DOM only, no state transitions yet)
    server.mjs              Local static server
    tests/data.test.mjs     Tests for the pure data functions
    scripts/check.mjs       Syntax and local asset verification
    .openai/hosting.json    Private Sites identity and static configuration

## Not yet built

Person/Memory/Object *creation* forms (caregiver section 21-24 of the spec), the AI
activity generator, and Settings are intentionally left as read-only or "coming soon"
for this pass — see the repo root README for the overall build order.
