# RecallAR ↔ Supabase — patient activity database

The RecallAR app (phone AR / desktop / headset) records what the patient did — one
**session** per run, and an **activity event** for every step — into a Supabase
(Postgres) project. The caregiver web app reads it from there.

```
iPhone (RecallAR app)  ──HTTPS POST──▶  Supabase REST  ──▶  Postgres
                                                              ▲
caregiver web app  ◀──supabase-js / fetch──────────────────────┘
```

Everything stored is **descriptive** (what, when, how long, how many hints). The schema
has no "score", "fail" or "wrong" column on purpose — the product never grades or
diagnoses the patient, and a dashboard built on this data shouldn't either. Hints are
counted so a caregiver can see them; they are never a penalty.

---

## Part 1 — One-time setup (Kunal)

1. **Create the project** — https://supabase.com → *New project* (free tier). Pick any
   name (e.g. `recallar`), a database password (you won't need it for this), region near
   you. Wait ~1 minute for it to provision.

2. **Create the tables** — left sidebar → **SQL Editor** → *New query* → paste the whole
   contents of [`migrations/20260919000000_recallar_activity.sql`](migrations/20260919000000_recallar_activity.sql)
   → **Run**. You should see "Success. No rows returned". This creates:
   - tables `patients`, `sessions`, `activity_events`
   - views `session_overview`, `caregiver_daily_summary`, `activity_history`
   - Row Level Security policies (anon key may insert events and read everything)
   - the demo patient **John Miller** with id `11111111-1111-4111-8111-111111111111`

   (Safe to re-run: every statement is `if not exists` / `or replace`.)

3. **Get the keys** — sidebar → **Project Settings → API**:
   - *Project URL* — looks like `https://abcdefghijkl.supabase.co`
   - *anon public* key — a long `eyJ…` string. This key is meant to be shipped in
     apps; the RLS policies are what limit what it can do.

4. **Tell the app** — in the Unity project copy the example config and fill it in:

   ```bash
   cp apps/mixed-reality/Assets/StreamingAssets/recallar-supabase.example.json apps/mixed-reality/Assets/StreamingAssets/recallar-supabase.json
   ```

   then edit `recallar-supabase.json`:

   ```json
   {
     "url": "https://abcdefghijkl.supabase.co",
     "anonKey": "eyJ...",
     "patientId": "11111111-1111-4111-8111-111111111111",
     "device": "iphone-ar"
   }
   ```

   The real file is git-ignored; only the `.example` is committed. Without the file the
   app runs normally and just doesn't log.

5. **Rebuild & run on the phone** — Unity menu **RecallAR → Build iOS (Xcode project) -
   Phone AR**, then ▶ Run in Xcode as before. Play through the sequence once.

6. **Check it landed** — Supabase sidebar → **Table Editor → activity_events**. You
   should see `session_started`, `quest_started`, `quest_completed`, … rows appear
   within a second or two of each step on the phone (there is no batching).

### Mock data for dashboard development

[`seed/seed-mock-activity.mjs`](seed/seed-mock-activity.mjs) posts ~two weeks of
plausible sessions (varied times of day, hints, durations, memory-game looks, an
occasional run closed early) through the same REST calls as the phone:

```bash
node supabase/seed/seed-mock-activity.mjs
```

It reads the URL/key from the Unity config file, or from `SUPABASE_URL` /
`SUPABASE_ANON_KEY`. Each run adds a fresh batch. To clear mock data, delete the
rows in the Table Editor (the anon key deliberately cannot delete).

---

## Part 2 — Reading the data (web-app teammate)

Install `@supabase/supabase-js` and create a client with the same URL + anon key:

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PATIENT = '11111111-1111-4111-8111-111111111111';
```

### Dashboard cards — today's summary
```js
const { data } = await supabase
  .from('caregiver_daily_summary')
  .select('*')
  .eq('patient_id', PATIENT)
  .order('day', { ascending: false })
  .limit(14);              // last two weeks, one row per day
```
Columns: `day, sessions, quests_completed, memory_games_completed, hints_used,
points_earned, avg_seconds_per_quest, memory_game_matches, memory_game_answers`.

### Session list
```js
const { data } = await supabase
  .from('session_overview')
  .select('*')
  .eq('patient_id', PATIENT)
  .order('started_at', { ascending: false });
```
Columns: `session_id, device, app_variant, started_at, ended_at, duration_seconds,
quests_completed, memory_games_completed, hints_used, memories_viewed,
people_recognized, points_earned, memory_game_matches, memory_game_answers`.

### Timeline of one session (for a detail page / AI analysis)
```js
const { data } = await supabase
  .from('activity_events')
  .select('*')
  .eq('session_id', sessionId)
  .order('occurred_at');
```

### Trend of one activity over time ("how long does finding the mug take?")
```js
const { data } = await supabase
  .from('activity_history')
  .select('occurred_at, duration_seconds, hints_used')
  .eq('patient_id', PATIENT)
  .eq('activity_id', 'coffee_mug_quest');
```

### Live updates (optional)
Enable Realtime for `activity_events` (Database → Replication) and subscribe:
```js
supabase.channel('events')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events' }, (p) => render(p.new))
  .subscribe();
```

### Plain REST (no SDK), e.g. from curl or any backend
```bash
curl "$SUPABASE_URL/rest/v1/session_overview?patient_id=eq.$PATIENT&order=started_at.desc" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

---

## Data model

### `sessions` — one per app run
| column | meaning |
|---|---|
| `id` uuid | generated by the app |
| `patient_id` uuid | → `patients.id` |
| `device` | from the app config, e.g. `iphone-ar` |
| `app_variant` | `phone-ar`, `living-room` (virtual room), `meta-xr` |
| `started_at`, `ended_at` | UTC |
| `activities_completed`, `hints_used`, `points_earned`, `flowers_grown`, `duration_seconds` | roll-ups written by the app when the run finishes (the views recompute them from events, so they're also correct if the app was closed early) |

### `activity_events` — the timeline
| column | meaning |
|---|---|
| `event_type` | see list below |
| `session_seconds` | seconds since the session started, by the device clock |
| `activity_id` | `coffee_mug_quest`, `find_sarah`, `phone_quest`, `memory_game` |
| `activity_kind` | `find_object`, `find_person`, `memory_game` |
| `target_id`, `target_name` | the object/person the step is about (`coffee_mug_01` / "Coffee Mug", `sarah_01` / "Sarah", …) |
| `duration_seconds` | on `quest_completed` / `memory_game_completed` |
| `hints_used` | on `quest_completed`: hints asked during that quest |
| `points` | points awarded by this event |
| `details` jsonb | event-specific extras (below) |

| `event_type` | when | `details` |
|---|---|---|
| `session_started` | greeting shown | — |
| `quest_started` | "Let's find your coffee mug." | `instruction` |
| `hint_requested` | H key / "Need a hint?" | `hint` (the text shown) |
| `quest_completed` | target recognized | — (`duration_seconds`, `hints_used`, `points` filled) |
| `memory_viewed` | a memory card opened | `title`, `memory` |
| `person_recognized` | a person's identity card shown (outside the game) | `relationship` |
| `memory_game_started` | patient steps on the mat | — |
| `memory_game_answer` | every look-answer in the game | `round`, `asked_person_id`, `asked_name`, `chosen_person_id`, `chosen_name`, `matched` (bool), `seconds_into_game` |
| `memory_game_completed` | all rounds done | — (`duration_seconds`, `points`) |
| `session_finished` | wrap-up shown | `activities_completed`, `flowers_grown` |

Wording guidance for the dashboard: say *"asked for 2 hints"*, *"took 20 s"*,
*"matched Jack on the second look"* — not "failed", "wrong" or "declining".

---

## Security note (before real patient data)

The current policies let anyone with the anon key read all rows and insert events —
fine for a hackathon demo with fictional data, not for real patients. Before that:
give each device/caregiver a Supabase Auth login, replace the `using (true)` policies
with `patient_id in (select … where caregiver = auth.uid())`, and remove anon SELECT.

## Verified

The migration and the exact inserts/updates the app performs were run against a local
Postgres 16 as the `anon` role (RLS on) and all three views returned the expected
numbers; see the session that created this file for the transcript.
