# RecallAR caregiver web dashboard — plan

## Goal
A caregiver web dashboard, extended in place from an earlier hardware-free prototype
(kept as the vanilla-JS foundation rather than rewritten in a framework). Sarah opens
it to see what John did on his RecallAR mobile app today, and — in later phases — to
personalize his people, memories, objects, and routines.

## Scope for this pass
- [x] Sidebar nav: Overview, People, Memories, Objects, Activity, Settings.
- [x] Overview: descriptive daily stats (activities completed, memory activities, AR
      quests, hints used) and a Recent Activity timeline, built from seeded demo data.
      Never a diagnostic claim about the person (spec section 20).
- [x] People / Memories / Objects: read-only cards from seed data.
- [x] Activity: the full timeline.
- [x] Settings: placeholder only.
- [x] Seeded demo data for patient John Miller and caregiver Sarah Miller, mirroring
      `packages/shared`.
- [x] Pure, unit-tested data functions (`computeDailySummary`, `buildActivityFeed`),
      independent of the DOM — same separation of concerns as the original prototype.

## Not yet in scope (see repo root README for phasing)
- Add/edit forms for people, memories, and objects (spec sections 21-24).
- The AI activity generator (spec section 23) — currently all activities are seeded,
  not generated.
- Routine builder (spec section 25).
- Any real backend/persistence — everything here is static seed data.

## Product boundaries
Same ethical rule as the rest of RecallAR (spec section 20 and 40): never say the
patient's condition is "getting worse," never diagnose, never invent a fact not present
in the seed data. Overview and Activity report only what happened, not what it means.

## Later iterations
Wire this dashboard to a real backend (Supabase, per the top-level spec) once the
mobile app needs to write activity logs somewhere real; add the AI activity generator;
add caregiver auth. Until then this app intentionally has no server-side state.
