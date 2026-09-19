import { patient, caregiver, people, memories, objects, activityLogs, computeDailySummary, buildActivityFeed } from './data.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// app.js renders [data-icon] elements once at load from its own path table;
// icons injected into dynamic innerHTML need their own copy of those paths.
const paths = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  image: 'M3 5h18v14H3zM3 16l5-5 4 4 4-4 4 4M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  box: 'M21 8 12 3 3 8m18 0-9 5m9-5v9l-9 5M3 8l9 5m-9-5v9l9 5',
  clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 1-.1 1.3l2 1.6-2 3.4-2.4-1c-.66.55-1.4 1-2.2 1.3l-.4 2.4H9.7l-.4-2.4a7.6 7.6 0 0 1-2.2-1.3l-2.4 1-2-3.4 2-1.6a7.4 7.4 0 0 1 0-2.6l-2-1.6 2-3.4 2.4 1a7.6 7.6 0 0 1 2.2-1.3l.4-2.4h4.6l.4 2.4c.8.3 1.54.75 2.2 1.3l2.4-1 2 3.4-2 1.6c.07.43.1.86.1 1.3Z',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (paths[name] || paths.bookmark) + '"/></svg>';

const VIEWS = ['overview', 'people', 'memories', 'objects', 'activity', 'settings'];
const TITLES = { overview: 'Overview', people: 'People', memories: 'Memories', objects: 'Objects', activity: 'Activity', settings: 'Settings' };

let view = 'overview';

function switchView(next) {
  if (!VIEWS.includes(next)) return;
  view = next;
  document.querySelectorAll('.view').forEach(el => { el.hidden = el.id !== 'view-' + next; });
  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === next);
    if (el.dataset.view === next) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  $('page-title').textContent = TITLES[next];
  render();
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderOverview() {
  const summary = computeDailySummary();
  $('view-overview').innerHTML =
    '<div class="stat-grid">' +
      statCard(summary.activitiesCompleted + ' / ' + summary.activitiesTotal, 'Activities completed') +
      statCard(String(summary.memoryActivitiesCompleted), 'Memory activities') +
      statCard(String(summary.arQuestsCompleted), 'AR quests') +
      statCard(String(summary.hintsUsed), 'Hints used') +
    '</div>' +
    '<div class="section-heading"><h2>Recent Activity</h2><span>Today</span></div>' +
    '<section class="card timeline">' +
      buildActivityFeed(activityLogs).map(item =>
        '<article class="timeline-item"><span class="timeline-icon">' + icon(item.kind === 'query' ? 'bookmark' : 'clock') + '</span><div><h3>' + escape(item.title) + '</h3><p>' + escape(item.detail) + '</p></div><time datetime="' + escape(item.timestamp) + '">' + timeLabel(item.timestamp) + '</time></article>'
      ).join('') +
    '</section>';
}

function statCard(value, label) {
  return '<div class="stat-card"><div class="stat-value">' + escape(value) + '</div><div class="stat-label">' + escape(label) + '</div></div>';
}

function renderPeople() {
  $('view-people').innerHTML =
    '<div class="section-heading"><h2>People</h2><span>' + people.length + ' added</span></div>' +
    '<div class="memory-list">' + people.map(p =>
      '<article class="memory-card"><span class="source-tag">' + escape(p.relationship) + '</span><strong>' + escape(p.name) + '</strong><p>' + escape(p.description) + '</p></article>'
    ).join('') + '</div>';
}

function renderMemories() {
  $('view-memories').innerHTML =
    '<div class="section-heading"><h2>Memories</h2><span>' + memories.length + ' added</span></div>' +
    '<div class="memory-list">' + memories.map(m =>
      '<article class="memory-card"><span class="source-tag">' + escape(m.location || '') + '</span><strong>' + escape(m.title) + '</strong><p>' + escape(m.description) + '</p></article>'
    ).join('') + '</div>';
}

function renderObjects() {
  $('view-objects').innerHTML =
    '<div class="section-heading"><h2>Objects</h2><span>' + objects.length + ' added</span></div>' +
    '<div class="memory-list">' + objects.map(o =>
      '<article class="memory-card"><span class="source-tag">' + escape(o.location) + '</span><strong>' + escape(o.name) + '</strong><p>' + escape(o.description) + '</p></article>'
    ).join('') + '</div>';
}

function renderActivityLog() {
  $('view-activity').innerHTML =
    '<div class="section-heading"><h2>Full Activity Log</h2><span>All time</span></div>' +
    '<section class="card timeline">' +
      buildActivityFeed(activityLogs).slice().reverse().map(item =>
        '<article class="timeline-item"><span class="timeline-icon">' + icon(item.kind === 'query' ? 'bookmark' : 'clock') + '</span><div><h3>' + escape(item.title) + '</h3><p>' + escape(item.detail) + '</p></div><time datetime="' + escape(item.timestamp) + '">' + timeLabel(item.timestamp) + '</time></article>'
      ).join('') +
    '</section>';
}

function renderSettings() {
  $('view-settings').innerHTML =
    '<div class="empty-state">' + icon('gear') + '<p>Managing ' + escape(patient.name) + '&rsquo;s profile and ' + escape(caregiver.name) + '&rsquo;s account settings is coming soon.</p></div>';
}

const RENDERERS = { overview: renderOverview, people: renderPeople, memories: renderMemories, objects: renderObjects, activity: renderActivityLog, settings: renderSettings };

function render() {
  RENDERERS[view]?.();
}

$('date-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => switchView(el.dataset.view)));
document.querySelectorAll('[data-close-dialog]').forEach(el => el.addEventListener('click', () => el.closest('dialog').close()));
$('about-button').addEventListener('click', () => $('about-dialog').showModal());

render();
