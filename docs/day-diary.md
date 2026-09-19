# A diary of selected moments

The patient explicitly starts, pauses, resumes and ends each session. Thread never records an entire day invisibly. Browser sessions sample selected stills every 30, 60, 120 or 300 seconds while the camera is on and the page is visible. A small pixel comparison skips unchanged views for up to five minutes. **Remember this view** forces a capture. Changing scenes are not interpreted as completed activities.

For longer sessions, configure `OPENAI_API_KEY` on the server: the browser-entered OpenAI connection expires after one hour. The default budget is 100 OpenAI requests per UTC day, shared by camera observations and other AI requests. Adjust `MAX_AI_CALLS_PER_DAY` and the capture interval to suit the intended session length and billing budget; reaching the limit pauses new AI work with a visible error.

## Full-screen patient view

**Enter full screen** starts or resumes a diary session and starts the browser camera and ElevenLabs voice together. A new session first asks for its recording choices; an existing session without voice permission requires an explicit opt-in that preserves its retention settings. Configure ElevenLabs in Settings first. Browser device permission prompts still require Allow.

The patient view keeps captions, person confirmation, typed questions and large controls visible. **Exit & pause**, Escape, navigation or hiding the page stops media. Exiting while session creation or a device permission request is pending cancels device startup. If native full screen is unavailable, a full-window layout provides the same controls.

## Stored organization

- `diary_sessions`: title, browser device source, consent/retention policy, status and heartbeat.
- `diary_events`: capture and receipt timestamps, source kind, status, title, description, category, tags, visible object locations/text, uncertainty, review status, revision and expiry. Raw stills are retained only if selected at session start.
- `diary_corrections`: previous wording and the reviewer's name/time. Corrections replace searchable text; old wording remains inspectable, not in search results.
- `diary_digests`: sourced AI recap, source fingerprint and generation time. A correction/deletion invalidates recaps; a concurrent edit rejects an in-progress recap.
- `trusted_people`: caregiver-labeled profiles and consented photos. A patient-confirmed encounter becomes a separate diary event.
- `current_encounters`: the current confirmed person, linked to a diary session and optionally a recent camera observation. Voice context reads this explicitly, independently of keyword search.
- `voice_sessions`: provider conversation ID and connection lifecycle. Transcript text is opt-in; raw audio is never stored by Thread.

The indexed search uses PostgreSQL `tsvector`/GIN, stemming, ranking, timestamps, day/time-zone filters and categories. It is full-text retrieval, not a trained model or vector embedding system. The agent can reformulate queries using the `search_diary` tool. Sources remain visible with their recorded time. Unknown or unrecorded periods remain unknown.

## Useful flows

1. **Find an object:** observe keys on a tray → later ask where they were last seen → retrieve that description and timestamp → make clear this is a last-recorded location, not live tracking.
2. **Recover an activity:** pause a reviewed routine → resume the app → retrieve the saved intention and last unconfirmed step. A camera image cannot mark a step complete.
3. **Reconnect with family:** select a caregiver-labeled photo → patient confirms who is there → the encounter is recorded → the voice companion can recall this confirmed visit.
4. **Reflect together:** open the daily timeline → correct an uncertain observation → generate a recap → inspect the actual moment links.

## Connecting a person to the current view

A profile photo alone does not establish who appears in a camera frame. Ask the voice companion who is with you, or press **Who is with me?**. If nobody is confirmed, the saved profile choices open. Select a person and confirm. Thread stores an encounter, links a camera observation if it is recent, updates the current-person card and sends the confirmed context to the connected voice conversation. Voice can then use the person's name, relationship and profile details. It does not guess which visible face belongs to them.

**They’ve left / clear confirmation** removes current presence while preserving the diary visit. Confirmation expires after 15 minutes and clears on pause, end, restart, profile deletion or correction of the encounter record. An old visit is never automatically restored as current presence. Voice requests and current-session text questions receive the latest observation and confirmed encounter from the same database.

The backend rejects links to another session's image or a capture older than two minutes. Confirmation does not turn camera descriptions into verified facts. No face embeddings or automatic matching are generated from profile photos.

## Boundaries

The service must run, the browser must remain visible, and the computer must stay awake. Navigation or a hidden tab stops media; missed heartbeats mark the session interrupted. Startup marks unfinished analyses failed, preserving an honest interruption record. This implementation does not provide OS-level background recording, a continuous video archive, reliable object tracking, automated face identification or emergency monitoring.

Retention is 1, 7 or 30 days per session; standalone written notes default to 30 days. Expired events are excluded from retrieval immediately and cleaned up by the service. A source quoted into another saved conversation or user note can remain there under that record's own retention. Deleting a person removes the profile/photo; confirmed historical encounters remain until separately deleted or expired.

There are at most two concurrent analyses, one per session, 50 familiar profiles, 200 records per recap and a configurable durable OpenAI-call cap. Camera ingestion stops when there are 2,000 diary records in the past day. A still is limited to 4 MB and camera output is resized to at most 1,280 pixels wide. These are bounds for one household, not a claim of unlimited all-day recording or horizontal scaling.

## Familiar-person recognition tracker

The Day diary includes a recognition tracker and seven-day chart ending on the selected day. Log a familiar person, outcome (without a cue, after a cue, or introduction), patient/caregiver source and observation time. The latest retained observation per person per local day counts once; days without observations show a gap. This is human-reported recognition, not automatic face matching or a clinical score. Existing encounters do not count. Logs remain diary entries for 30 days from observation, follow export/deletion, and can be corrected by deleting the mistaken entry and logging a replacement. Diary search filters do not change the tracker.

### Monthly demo view

The recognition tracker opens in **30-day demo** mode until the browser preference is changed. This presentation-only dataset covers the 30 days ending on the selected diary date, with four fictional people per day, gradual gains and daily variation. Weekly average independent recognitions rise from 0.7 to 1.3 to 1.7, then 2.4 across the final nine days. A persistent synthetic-data notice distinguishes this illustrative scenario from actual patient health. **Real diary data** restores the live seven-day tracker and logging controls. No demo values enter the database, diary export, retrieval or voice context.
