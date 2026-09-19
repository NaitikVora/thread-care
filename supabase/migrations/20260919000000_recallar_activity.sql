-- RecallAR — patient activity schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
--
-- What writes here:  the RecallAR phone/headset app (ActivityLogger in apps/mixed-reality)
-- What reads here:   the caregiver web dashboard
--
-- Design notes
--   * Everything is DESCRIPTIVE: what the patient did, when, how long it took, how many
--     hints they asked for. Nothing here scores, grades or diagnoses (product rule: never
--     say "failed" / "incorrect" / "getting worse"). Hints are counted only so a caregiver
--     can see them; they are never a penalty.
--   * One `sessions` row per app run, many `activity_events` rows per session.
--   * `activity_events.details` is JSONB so new event kinds can be added by the app
--     without a migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
create table if not exists public.patients (
  id              uuid primary key default gen_random_uuid(),
  display_name    text not null,
  preferred_name  text not null,
  created_at      timestamptz not null default now()
);

comment on table public.patients is 'People living with memory loss who use the RecallAR app.';

-- ---------------------------------------------------------------------------
-- sessions — one row per time the app is opened and the guided sequence runs
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id                     uuid primary key default gen_random_uuid(),
  patient_id             uuid not null references public.patients(id) on delete cascade,
  device                 text not null default 'unknown',   -- 'iphone-ar' | 'desktop' | 'quest' | ...
  app_variant            text not null default 'unknown',   -- 'phone-ar' | 'living-room' | 'meta-xr' | ...
  started_at             timestamptz not null default now(),
  ended_at               timestamptz,
  -- Roll-up counters, updated by the app when the sequence finishes (or the app closes).
  activities_completed   integer not null default 0,
  hints_used             integer not null default 0,
  points_earned          integer not null default 0,
  flowers_grown          integer not null default 0,
  duration_seconds       numeric(10,1),
  created_at             timestamptz not null default now()
);

create index if not exists sessions_patient_started_idx on public.sessions (patient_id, started_at desc);

comment on table public.sessions is 'One row per app run. Counters are roll-ups of activity_events for quick dashboard cards.';

-- ---------------------------------------------------------------------------
-- activity_events — the detailed timeline
-- ---------------------------------------------------------------------------
create table if not exists public.activity_events (
  id                bigint generated always as identity primary key,
  session_id        uuid not null references public.sessions(id) on delete cascade,
  patient_id        uuid not null references public.patients(id) on delete cascade,
  occurred_at       timestamptz not null default now(),
  -- Seconds since the session started, from the device clock (independent of network delay).
  session_seconds   numeric(10,1) not null default 0,

  event_type        text not null check (event_type in (
                      'session_started',
                      'quest_started',
                      'hint_requested',
                      'quest_completed',
                      'memory_viewed',
                      'person_recognized',
                      'memory_game_started',
                      'memory_game_answer',
                      'memory_game_completed',
                      'session_finished'
                    )),

  -- Which activity this belongs to (quest id such as 'coffee_mug_quest', or 'memory_game').
  activity_id       text,
  activity_kind     text check (activity_kind in ('find_object', 'find_person', 'memory_game')),
  -- The thing the activity is about: an object id / person id and its display name.
  target_id         text,
  target_name       text,

  -- Descriptive measurements (null when not applicable to the event).
  duration_seconds  numeric(10,1),     -- quest_completed / memory_game_completed: time taken
  hints_used        integer,           -- quest_completed: hints asked for during that quest
  points            integer,           -- points awarded by this event (never negative)

  -- Anything else, e.g. memory_game_answer: {"round":1,"asked_person_id":"jack_01",
  -- "asked_name":"Jack","chosen_person_id":"michael_01","chosen_name":"Michael","matched":false}
  details           jsonb not null default '{}'::jsonb
);

create index if not exists activity_events_session_idx on public.activity_events (session_id, occurred_at);
create index if not exists activity_events_patient_time_idx on public.activity_events (patient_id, occurred_at desc);

comment on table public.activity_events is 'Timeline of what the patient did in the app. Descriptive only.';

-- ---------------------------------------------------------------------------
-- Views for the dashboard
-- ---------------------------------------------------------------------------

-- One line per session with counts derived from the events (works even if the app
-- closed before it could update the session roll-up counters).
create or replace view public.session_overview as
select
  s.id                                   as session_id,
  s.patient_id,
  p.preferred_name,
  s.device,
  s.app_variant,
  s.started_at,
  s.ended_at,
  coalesce(s.duration_seconds,
           extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)))::numeric(10,1)
                                         as duration_seconds,
  count(*) filter (where e.event_type = 'quest_completed')          as quests_completed,
  count(*) filter (where e.event_type = 'memory_game_completed')    as memory_games_completed,
  count(*) filter (where e.event_type = 'hint_requested')           as hints_used,
  count(*) filter (where e.event_type = 'memory_viewed')            as memories_viewed,
  count(*) filter (where e.event_type = 'person_recognized')        as people_recognized,
  coalesce(sum(e.points), 0)::integer                               as points_earned,
  count(*) filter (where e.event_type = 'memory_game_answer'
                     and (e.details->>'matched')::boolean)          as memory_game_matches,
  count(*) filter (where e.event_type = 'memory_game_answer')       as memory_game_answers
from public.sessions s
join public.patients p on p.id = s.patient_id
left join public.activity_events e on e.session_id = s.id
group by s.id, p.preferred_name;

-- Per patient per calendar day — the numbers for the dashboard's daily summary card.
create or replace view public.caregiver_daily_summary as
select
  s.patient_id,
  p.preferred_name,
  (s.started_at at time zone 'utc')::date                           as day,
  count(distinct s.id)                                              as sessions,
  count(*) filter (where e.event_type = 'quest_completed')          as quests_completed,
  count(*) filter (where e.event_type = 'memory_game_completed')    as memory_games_completed,
  count(*) filter (where e.event_type = 'hint_requested')           as hints_used,
  coalesce(sum(e.points), 0)::integer                               as points_earned,
  round(avg(e.duration_seconds) filter (where e.event_type = 'quest_completed'), 1)
                                                                    as avg_seconds_per_quest,
  count(*) filter (where e.event_type = 'memory_game_answer'
                     and (e.details->>'matched')::boolean)          as memory_game_matches,
  count(*) filter (where e.event_type = 'memory_game_answer')       as memory_game_answers
from public.sessions s
join public.patients p on p.id = s.patient_id
left join public.activity_events e on e.session_id = s.id
group by s.patient_id, p.preferred_name, (s.started_at at time zone 'utc')::date;

-- Per activity over time: "how long does finding the mug take, day by day?"
create or replace view public.activity_history as
select
  e.patient_id,
  e.activity_id,
  e.activity_kind,
  e.target_name,
  e.occurred_at,
  e.session_id,
  e.duration_seconds,
  e.hints_used,
  e.points
from public.activity_events e
where e.event_type in ('quest_completed', 'memory_game_completed')
order by e.occurred_at desc;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Hackathon setting: the public "anon" key may insert events (the phone) and read
-- everything (the dashboard). Tighten before real patient data: per-device auth,
-- caregiver accounts, and no anon SELECT.
-- ---------------------------------------------------------------------------
alter table public.patients        enable row level security;
alter table public.sessions        enable row level security;
alter table public.activity_events enable row level security;

drop policy if exists "anon read patients"        on public.patients;
drop policy if exists "anon read sessions"        on public.sessions;
drop policy if exists "anon insert sessions"      on public.sessions;
drop policy if exists "anon update sessions"      on public.sessions;
drop policy if exists "anon read events"          on public.activity_events;
drop policy if exists "anon insert events"        on public.activity_events;

create policy "anon read patients"   on public.patients        for select to anon, authenticated using (true);
create policy "anon read sessions"   on public.sessions        for select to anon, authenticated using (true);
create policy "anon insert sessions" on public.sessions        for insert to anon, authenticated with check (true);
create policy "anon update sessions" on public.sessions        for update to anon, authenticated using (true) with check (true);
create policy "anon read events"     on public.activity_events for select to anon, authenticated using (true);
create policy "anon insert events"   on public.activity_events for insert to anon, authenticated with check (true);

-- The views run with the querying role's permissions (security invoker), so the
-- policies above also cover them.
alter view public.session_overview        set (security_invoker = true);
alter view public.caregiver_daily_summary set (security_invoker = true);
alter view public.activity_history        set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- Seed: the demo patient. The app's config file references this id.
-- ---------------------------------------------------------------------------
insert into public.patients (id, display_name, preferred_name)
values ('11111111-1111-4111-8111-111111111111', 'John Miller', 'John')
on conflict (id) do nothing;
