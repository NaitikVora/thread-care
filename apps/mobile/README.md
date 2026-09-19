# RecallAR — Patient Mobile App

The patient-facing half of RecallAR: a warm, extremely simple app for someone living
with Alzheimer's. Expo (React Native + TypeScript), SDK 57.

Design rules (see the top-level spec): very large buttons, minimal text, one primary
action per screen, no nested menus, no failure states, always offer a hint, voice
where possible.

## Run locally

    npm install   # from the repo root, once
    npm start      # then press w for web, i for iOS simulator, a for Android

## What's here

- **Home screen** (`src/screens/HomeScreen.tsx`) — orientation ("Good morning, John. Today
  is Friday, September 18. You have lunch with Sarah at 1 PM.") with an optional
  read-aloud button (`expo-speech`), plus the three primary actions: Start Memory
  Quest, My Memories, Help Me Remember.
- Everything those buttons lead to is currently a "Coming soon" placeholder
  (`src/screens/ComingSoonScreen.tsx`) — the AR quest, memory feed, and assistant flows
  come in later passes (see the repo root README's build order).

## Data

Seeded demo data (patient John Miller, caregiver Sarah Miller, people/memories/objects)
comes from the `@recallar/shared` workspace package — see
[`packages/shared/src/seed-data.ts`](../../packages/shared/src/seed-data.ts). The
caregiver web dashboard mirrors the same data by hand, since it has no bundler to
import TypeScript directly.

## Structure

    App.tsx                        Renders the navigator
    src/navigation/RootNavigator.tsx  Stack: Home + ComingSoon
    src/screens/                    HomeScreen, ComingSoonScreen
    src/components/BigActionButton.tsx  The one large, consistent action button style
    src/theme/                      Colors, spacing, typography (warm/calm, section 34)
    src/utils/format.ts             Greeting/date/time formatting helpers
    metro.config.js                 Monorepo-aware Metro config (resolves @recallar/shared)

## Note for whoever (or whatever) touches this next

Expo's own template flags this: **Expo changes fast.** Check
https://docs.expo.dev/versions/v57.0.0/ against the installed SDK version in
`package.json` before assuming an API from memory still applies.
