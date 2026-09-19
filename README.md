# RecallAR

A personalized AR memory companion for people living with Alzheimer's and their
caregivers. RecallAR turns a person's own people, routines, surroundings, and memories
into gentle, gamified activities — not a generic brain-training game, and never a
diagnostic tool.

Two experiences, one shared data model:

- **Patient mobile app** (`apps/mobile`) — a warm, extremely simple React Native/Expo
  app for the person living with Alzheimer's. Large buttons, minimal text, one primary
  action per screen, no failure states.
- **Caregiver web dashboard** (`apps/web`) — lets a caregiver see what their person did
  today, and (in later phases) personalize people, memories, objects, and routines.
  Built by extending an earlier dependency-free vanilla-JS prototype in place, rather
  than rewriting it in a framework.

## Repo layout

    apps/
      mobile/   Patient experience — Expo (React Native + TypeScript)
      web/      Caregiver dashboard — vanilla HTML/CSS/JS, no build step
    packages/
      shared/   Shared TypeScript types + seeded demo data (source of truth for mobile;
                apps/web hand-mirrors the same shapes/values since it has no bundler)

## Run it

    npm install          # once, from the repo root (npm workspaces)
    npm run web           # caregiver dashboard at http://127.0.0.1:4173
    npm run mobile         # Expo dev server for the patient app (press w/i/a)

Or `cd apps/web && npm start` / `cd apps/mobile && npm start` directly.

## Demo data

Both apps are seeded with the same hackathon demo story: patient **John Miller** (74)
and his daughter/caregiver **Sarah Miller**. See
[`packages/shared/src/seed-data.ts`](packages/shared/src/seed-data.ts) for the source
of truth, and [`apps/web/dist/data.js`](apps/web/dist/data.js) for the web app's
hand-mirrored copy.

## Build order

This is a hackathon MVP, built iteratively rather than all at once. Roughly:

1. ~~Monorepo scaffold, shared types, seeded demo data.~~
2. ~~Patient home screen (mock data).~~
3. ~~Caregiver Overview + read-only People/Memories/Objects/Activity (mock data).~~
4. Patient AR Memory Quest flow (camera → find object → reward → memory question).
5. Memory Garden reward system.
6. Caregiver add/edit forms for people, memories, objects.
7. AI: activity generation from caregiver-entered memories, and "Help Me Remember"
   (personalized RAG over the person's own data — never invented facts).
8. Voice (text-to-speech is already wired into the mobile home screen via
   `expo-speech`; speech-to-text and "Help Me Remember" voice input come later).

## Product ground rules

- Never diagnose, and never say the person's condition is "getting worse." Caregiver
  views report only observable, descriptive facts ("completed 4 activities," "used 2
  hints") — never a clinical conclusion.
- The patient experience never shows failure, never loses points, and always offers a
  hint instead of a correction.
- AI features must only ever draw on caregiver-verified facts already in the person's
  own data — never invent a memory, a relationship, or a fact.

See each app's own README for details: [`apps/mobile/README.md`](apps/mobile/README.md)
and [`apps/web/README.md`](apps/web/README.md).
