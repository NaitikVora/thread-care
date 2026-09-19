import assert from 'node:assert/strict';
import { test } from 'node:test';

import { activities, activityLogs, assistantQueries, buildActivityFeed, computeDailySummary } from '../dist/data.js';

test('daily summary counts completions, quest types, and hints without judging the person', () => {
  const summary = computeDailySummary(activityLogs, activities);
  assert.equal(summary.activitiesCompleted, 4);
  assert.equal(summary.activitiesTotal, activities.length);
  assert.equal(summary.memoryActivitiesCompleted, 2);
  assert.equal(summary.arQuestsCompleted, 2);
  assert.equal(summary.hintsUsed, 2);
});

test('daily summary never divides by an empty activity list', () => {
  const summary = computeDailySummary([], []);
  assert.equal(summary.activitiesCompleted, 0);
  assert.equal(summary.activitiesTotal, 0);
  assert.equal(summary.hintsUsed, 0);
});

test('activity feed merges completions and assistant questions in time order', () => {
  const feed = buildActivityFeed(activityLogs, assistantQueries);
  assert.equal(feed.length, activityLogs.length + assistantQueries.length);
  const timestamps = feed.map(item => new Date(item.timestamp).getTime());
  const sorted = [...timestamps].sort((a, b) => a - b);
  assert.deepEqual(timestamps, sorted);
  assert.ok(feed.some(item => item.kind === 'query'));
  assert.ok(feed.some(item => item.kind === 'activity'));
});
