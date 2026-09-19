// Mock caregiver-dashboard data for the RecallAR hackathon MVP.
// This mirrors the shape and values in packages/shared/src/seed-data.ts —
// duplicated by hand because this app is dependency-free vanilla JS with no
// bundler, so it can't import the TypeScript package directly. Keep field
// names identical to packages/shared/src/types.ts if you touch this file.

export const patient = {
  id: 'patient-john',
  name: 'John Miller',
  preferredName: 'John',
  age: 74,
};

export const caregiver = {
  id: 'caregiver-sarah',
  name: 'Sarah Miller',
  relationship: 'Daughter',
};

export const people = [
  { id: 'person-sarah', name: 'Sarah Miller', relationship: 'Daughter', description: 'Lives in Boston and visits John frequently. Loves hiking with John.' },
  { id: 'person-michael', name: 'Michael Miller', relationship: 'Son', description: 'Lives in New York and calls every Sunday.' },
  { id: 'person-susan', name: 'Susan Miller', relationship: 'Wife', description: 'Married to John since 1978. Loves gardening.' },
];

export const memories = [
  { id: 'memory-boston-trip', title: 'Boston Trip', date: '2019-07-14', location: 'Boston, Massachusetts', description: 'John and Sarah spent a weekend in Boston together, where John bought his favorite blue coffee mug.' },
  { id: 'memory-sarah-wedding', title: 'Sarah’s Wedding', date: '2018-06-16', location: 'Vermont', description: 'Sarah married Michael at a small ceremony in Vermont.' },
  { id: 'memory-family-christmas', title: 'Family Christmas', date: '2023-12-25', location: 'John’s house', description: 'The whole family gathered at John and Susan’s house for Christmas dinner.' },
];

export const objects = [
  { id: 'object-mug', name: 'Blue Coffee Mug', location: 'Kitchen', description: 'John’s blue coffee mug, his favorite for morning coffee.' },
  { id: 'object-glasses', name: 'Reading Glasses', location: 'Bedroom nightstand', description: 'John’s reading glasses, usually left on the nightstand.' },
  { id: 'object-wedding-photo', name: 'Wedding Photograph', location: 'Living room', description: 'A framed photo from Sarah’s wedding.' },
];

// type: 'ar_quest' | 'memory_question' — used to tally the day's stats.
export const activities = [
  { id: 'activity-mug-quest', type: 'ar_quest', prompt: 'Let’s find your coffee mug.' },
  { id: 'activity-sarah-recognition', type: 'memory_question', prompt: 'Do you remember who this is?' },
  { id: 'activity-wedding-location', type: 'memory_question', prompt: 'Let’s remember Sarah’s wedding.' },
  { id: 'activity-glasses-quest', type: 'ar_quest', prompt: 'Let’s find your reading glasses.' },
  { id: 'activity-christmas-people', type: 'memory_question', prompt: 'Let’s remember Family Christmas.' },
];

export const activityLogs = [
  { id: 'log-1', activityId: 'activity-mug-quest', timestamp: '2026-09-18T09:15:00-04:00', completed: true, hintsUsed: 0 },
  { id: 'log-2', activityId: 'activity-wedding-location', timestamp: '2026-09-18T09:22:00-04:00', completed: true, hintsUsed: 1 },
  { id: 'log-3', activityId: 'activity-sarah-recognition', timestamp: '2026-09-18T09:30:00-04:00', completed: true, hintsUsed: 0 },
  { id: 'log-4', activityId: 'activity-glasses-quest', timestamp: '2026-09-18T10:00:00-04:00', completed: true, hintsUsed: 1 },
];

export const assistantQueries = [
  { id: 'query-1', timestamp: '2026-09-18T10:05:00-04:00', question: 'Who is visiting today?', answer: 'Sarah is visiting for lunch at 1 PM today.' },
];

const activityById = Object.fromEntries(activities.map(a => [a.id, a]));

/**
 * Descriptive-only counts for a day (spec section 20: never a diagnostic
 * conclusion, just what happened).
 */
export function computeDailySummary(logs = activityLogs, allActivities = activities) {
  const byId = Object.fromEntries(allActivities.map(a => [a.id, a]));
  const completedLogs = logs.filter(l => l.completed);
  return {
    activitiesCompleted: completedLogs.length,
    activitiesTotal: allActivities.length,
    memoryActivitiesCompleted: completedLogs.filter(l => byId[l.activityId]?.type === 'memory_question').length,
    arQuestsCompleted: completedLogs.filter(l => byId[l.activityId]?.type === 'ar_quest').length,
    hintsUsed: logs.reduce((sum, l) => sum + (l.hintsUsed || 0), 0),
  };
}

/** Merge activity completions and assistant questions into one time-ordered feed. */
export function buildActivityFeed(logs = activityLogs, queries = assistantQueries) {
  const fromLogs = logs.map(l => ({
    id: l.id,
    timestamp: l.timestamp,
    kind: 'activity',
    title: activityById[l.activityId]?.prompt || 'Activity',
    detail: l.hintsUsed ? `Completed · ${l.hintsUsed} hint${l.hintsUsed > 1 ? 's' : ''} used` : 'Completed',
  }));
  const fromQueries = queries.map(q => ({
    id: q.id,
    timestamp: q.timestamp,
    kind: 'query',
    title: `Asked “${q.question}”`,
    detail: q.answer,
  }));
  return [...fromLogs, ...fromQueries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}
