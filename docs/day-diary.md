# A diary of selected moments

The patient explicitly starts, pauses, resumes and ends each session. Thread never records an entire day invisibly. Browser sessions sample selected stills every 30, 60, 120 or 300 seconds while the camera is on and the page is visible. A small pixel comparison skips unchanged views for up to five minutes. **Remember this view** forces a capture. Changing scenes are not interpreted as completed activities.

## Stored organization

- `diary_sessions`: title, browser device source, consent/retention policy, status and heartbeat.
- `diary_events`: capture and receipt timestamps, source kind, status, title, description, category, tags, visible object locations/text, uncertainty, review status, revision and expiry. Raw stills are retained only if selected at session start.
- `diary_corrections`: previous wording and the reviewer's name/time. Corrections replace searchable text; old wording remains inspectable, not in search results.
- `diary_digests`: sourced AI recap, source fingerprint and generation time. A correction/deletion invalidates recaps; a concurrent edit rejects an in-progress recap.
- `trusted_people`: caregiver-labeled profiles and consented photos. A patient-confirmed encounter becomes a separate diary event.
- `voice_sessions`: provider conversation ID and connection lifecycle. Transcript text is opt-in; raw audio is never stored by Thread.

The indexed search uses PostgreSQL `tsvector`/GIN, stemming, ranking, timestamps, day/time-zone filters and categories. It is full-text retrieval, not a trained model or vector embedding system. The agent can reformulate queries using the `search_diary` tool. Sources remain visible with their recorded time. Unknown or unrecorded periods remain unknown.

## Useful flows

1. **Find an object:** observe keys on a tray → later ask where they were last seen → retrieve that description and timestamp → make clear this is a last-recorded location, not live tracking.
2. **Recover an activity:** pause a reviewed routine → resume the app → retrieve the saved intention and last unconfirmed step. A camera image cannot mark a step complete.
3. **Reconnect with family:** select a caregiver-labeled photo → patient confirms who is there → the encounter is recorded → the voice companion can recall this confirmed visit.
4. **Reflect together:** open the daily timeline → correct an uncertain observation → generate a recap → inspect the actual moment links.

## Boundaries

The service must run, the browser must remain visible, and the computer must stay awake. Navigation or a hidden tab stops media; missed heartbeats mark the session interrupted. Startup marks unfinished analyses failed, preserving an honest interruption record. This implementation does not provide OS-level background recording, a continuous video archive, reliable object tracking, automated face identification or emergency monitoring.

Retention is 1, 7 or 30 days per session; standalone written notes default to 30 days. Expired events are excluded from retrieval immediately and cleaned up by the service. A source quoted into another saved conversation or user note can remain there under that record's own retention. Deleting a person removes the profile/photo; confirmed historical encounters remain until separately deleted or expired.

There are at most two concurrent analyses, one per session, 2,000 diary records per day, 50 familiar profiles, 200 records per recap and a configurable durable OpenAI-call cap. A still is limited to 4 MB and camera output is resized to at most 1,280 pixels wide. These are bounds for one household, not a claim of unlimited all-day recording or horizontal scaling.
