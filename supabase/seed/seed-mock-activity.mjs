#!/usr/bin/env node
// Seeds two weeks of realistic-looking RecallAR activity for the demo patient,
// through the same REST endpoints the phone app uses (anon key, RLS on).
//
//   node supabase/seed/seed-mock-activity.mjs            # uses the Unity config file
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node supabase/seed/seed-mock-activity.mjs
//
// Re-running adds another two weeks of sessions (ids are fresh each time).

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(here, '../../apps/mixed-reality/Assets/StreamingAssets/recallar-supabase.json');

let url = process.env.SUPABASE_URL;
let key = process.env.SUPABASE_ANON_KEY;
let patientId = process.env.PATIENT_ID ?? '11111111-1111-4111-8111-111111111111';
if (!url || !key) {
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
  url ??= cfg.url;
  key ??= cfg.anonKey;
  patientId = cfg.patientId ?? patientId;
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function post(table, rows) {
  const res = await fetch(`${url}/rest/v1/${table}`, { method: 'POST', headers, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
}
async function patch(table, filter, row) {
  const res = await fetch(`${url}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers, body: JSON.stringify(row) });
  if (!res.ok) throw new Error(`${table} patch: ${res.status} ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Deterministic pseudo-random so re-runs look similar but not identical.
let seed = Date.now() % 100000;
const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
const between = (a, b) => a + rnd() * (b - a);
const chance = (p) => rnd() < p;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const quests = [
  { id: 'coffee_mug_quest', kind: 'find_object', targetId: 'coffee_mug_01', name: 'Coffee Mug', points: 10,
    instruction: "Let's find your coffee mug.", hint: 'Try looking near the coffee machine.',
    memory: 'Boston Trip', memoryText: 'You bought this mug on the Boston trip with Susan in 2019.', typical: [15, 45] },
  { id: 'find_sarah', kind: 'find_person', targetId: 'sarah_01', name: 'Sarah', points: 5,
    instruction: 'Sarah is visiting today. Can you find her?', hint: 'Try looking near the sofa, by the window.',
    memory: "Sarah's Wedding", memoryText: "Sarah is your daughter. You walked her down the aisle at her wedding in 2016.", typical: [10, 40] },
  { id: 'phone_quest', kind: 'find_object', targetId: 'phone_01', name: 'Phone', points: 10,
    instruction: "Let's find your phone. Follow the arrows on the floor.", hint: 'Follow the arrows to the little lamp.',
    memory: 'Family Christmas', memoryText: 'Michael gave you this phone last Christmas so you could video-call the grandchildren.', typical: [20, 60] },
];
const people = [
  { id: 'jack_01', name: 'Jack', relationship: 'Your brother' },
  { id: 'michael_01', name: 'Michael', relationship: 'Your son' },
  { id: 'susan_01', name: 'Susan', relationship: 'Your wife' },
];

function shuffled(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------------------------------------------------------------------
async function seedSession(startedAt, device, appVariant) {
  const sessionId = randomUUID();
  let t = 0;                      // seconds into the session
  const events = [];
  let points = 0, hints = 0, activities = 0, flowers = 0;
  const at = () => new Date(startedAt.getTime() + t * 1000).toISOString();
  const ev = (event_type, extra = {}) => events.push({
    session_id: sessionId, patient_id: patientId, occurred_at: at(), session_seconds: +t.toFixed(1),
    event_type, activity_id: null, activity_kind: null, target_id: null, target_name: null,
    duration_seconds: null, hints_used: null, points: null, details: {}, ...extra,
  });

  await post('sessions', [{ id: sessionId, patient_id: patientId, device, app_variant: appVariant, started_at: startedAt.toISOString() }]);

  ev('session_started');
  t += 3;

  const finishedEarly = chance(0.1); // sometimes the app was closed mid-way

  for (let qi = 0; qi < quests.length; qi++) {
    const q = quests[qi];
    const base = { activity_id: q.id, activity_kind: q.kind, target_id: q.targetId, target_name: q.name };
    ev('quest_started', { ...base, details: { instruction: q.instruction } });

    const questStart = t;
    const duration = between(q.typical[0], q.typical[1]) * (chance(0.2) ? 1.8 : 1);
    const hintCount = chance(0.45) ? (chance(0.3) ? 2 : 1) : 0;
    for (let h = 1; h <= hintCount; h++) {
      t = questStart + duration * (h / (hintCount + 1));
      hints++;
      ev('hint_requested', { ...base, hints_used: h, details: { hint: q.hint } });
    }
    t = questStart + duration;

    if (finishedEarly && qi === 2) break;

    activities++; points += q.points; flowers++;
    ev('quest_completed', { ...base, duration_seconds: +duration.toFixed(1), hints_used: hintCount, points: q.points });

    if (q.kind === 'find_person') {
      ev('person_recognized', { ...base, details: { relationship: 'Your daughter' } });
      t += between(2, 6);
    } else t += 1.6;

    ev('memory_viewed', { activity_id: q.id, target_name: q.name, details: { title: q.name, memory: q.memoryText } });
    t += between(6, 20);

    // The memory game runs after Sarah.
    if (qi === 1) {
      t += between(8, 25); // walking to the mat
      const gameStart = t;
      const pointsBefore = points;
      ev('memory_game_started', { activity_id: 'memory_game', activity_kind: 'memory_game' });
      const order = shuffled(people);
      for (let round = 0; round < order.length; round++) {
        const asked = order[round];
        let matched = false;
        let looks = 0;
        while (!matched) {
          looks++;
          t += between(3, 9);
          matched = looks >= 3 || chance(0.72);
          const chosen = matched ? asked : pick(people.filter((p) => p.id !== asked.id));
          ev('memory_game_answer', {
            activity_id: 'memory_game', activity_kind: 'memory_game', target_id: asked.id, target_name: asked.name,
            details: { round: round + 1, asked_person_id: asked.id, asked_name: asked.name,
              chosen_person_id: chosen.id, chosen_name: chosen.name, matched, seconds_into_game: +(t - gameStart).toFixed(1) },
          });
          t += 2.2;
        }
        points += 5;
      }
      activities++; flowers++;
      ev('memory_game_completed', { activity_id: 'memory_game', activity_kind: 'memory_game',
        duration_seconds: +(t - gameStart).toFixed(1), points: points - pointsBefore });
      t += between(5, 15);
      ev('memory_viewed', { activity_id: 'memory_game', target_name: 'Memory Game',
        details: { title: 'Memory Game', memory: 'You remembered everyone. Wonderful!' } });
      t += between(4, 10);
    }
  }

  if (!finishedEarly) {
    ev('session_finished', { details: { activities_completed: activities, flowers_grown: flowers } });
  }

  // Post in chunks (PostgREST accepts arrays).
  for (let i = 0; i < events.length; i += 50) await post('activity_events', events.slice(i, i + 50));

  await patch('sessions', `id=eq.${sessionId}`, {
    ended_at: at(), duration_seconds: +t.toFixed(1), activities_completed: activities,
    hints_used: hints, points_earned: points, flowers_grown: flowers,
  });
  return { sessionId, events: events.length, activities, hints, points, finishedEarly };
}

// ---------------------------------------------------------------------------
const days = Number(process.env.DAYS ?? 14);
const now = new Date();
let total = 0;
console.log(`Seeding ~${days} days of activity for patient ${patientId} at ${url}`);
for (let d = days; d >= 1; d--) {
  if (chance(0.15)) continue; // a day off now and then
  const runs = chance(0.25) ? 2 : 1;
  for (let r = 0; r < runs; r++) {
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - d);
    start.setUTCHours(r === 0 ? 9 + Math.floor(between(0, 3)) : 15 + Math.floor(between(0, 3)), Math.floor(between(0, 59)), 0, 0);
    const variant = chance(0.85) ? ['iphone-ar', 'phone-ar'] : ['desktop', 'living-room'];
    const s = await seedSession(start, variant[0], variant[1]);
    total++;
    console.log(`  ${start.toISOString().slice(0, 16)}  ${variant[1].padEnd(11)} ${s.events} events, ${s.activities} activities, ${s.hints} hints, ${s.points} pts${s.finishedEarly ? ' (closed early)' : ''}`);
  }
}
console.log(`Done: ${total} sessions.`);
