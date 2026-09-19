# Thread 0.4 — patient day companion

Product: patient-controlled camera sessions, real ElevenLabs voice, a retrievable daily diary, and caregiver-labeled familiar people.

## Current implementation
- [x] Persistent time-stamped diary with PostgreSQL full-text indexing, source/review labels, correction history and retention.
- [x] Visible browser camera with manual capture, change-filtered periodic capture, pause/end and interruption recovery.
- [x] Real OpenAI structured image descriptions, diary retrieval tools and sourced daily recaps.
- [x] Official ElevenLabs browser and server SDKs, private agent provisioning, encrypted server key, signed conversation URLs, live audio/captions, interruption and tools.
- [x] Familiar-person portal: consented labeled photo profiles and patient-confirmed encounters. No automated face matching.
- [x] Patient HUD, diary timeline, source inspection, notes, recap and caregiver portal.
- [x] Optional caregiver/patient authentication with server-enforced permissions; mandatory authentication and HTTPS configuration before network hosting.
- [x] 61 application tests, real PostgreSQL integration, production build, authenticated container startup, and diary browser verification. Existing OpenAI connection tested live.
- [ ] Verify live ElevenLabs audio after the user connects their account; complete target camera/microphone checks.
- [x] Push reviewed source changes to the existing private GitHub repository (main).

## Connected-encounter fix
- [x] Explicit current-encounter database record linked to the session, person and recent camera observation.
- [x] Shared current context for voice tools, camera updates and patient text requests.
- [x] Voice-triggered photo choices, confirmed-person card, clear/end behavior and bounded expiry.
- [x] Upgrade existing ElevenLabs agent instructions through the official SDK; preserve voice/model/tools.
- [x] Regression tests for stale/cross-session identities, restart, correction/deletion, failed upgrades and interrupted answers.
- [ ] Automatic face matching remains off under the patient's original confirmation preference.

## Full-screen patient view
- [x] One action requests full screen and starts camera and ElevenLabs voice after session consent.
- [x] Full-window fallback, visible device state, large controls, and explicit voice opt-in for existing sessions.
- [x] Exit/Escape pauses both devices; pending session/device startup is cancelled.
- [x] Regression checks cover activation timing, consent, independent device failure and cancellation.

## Acceptance flow
1. Connect OpenAI and ElevenLabs under Settings. Create a private Thread voice agent with its client tools.
2. Add a consented familiar-person profile and labeled photo.
3. Patient starts a diary session and explicitly chooses cloud processing, voice and retention.
4. Turn on camera → capture a view → store an unreviewed, time-stamped observation → retrieve it later by topic.
5. Talk with Thread → read saved context or inspect a fresh view → hear a real ElevenLabs response and see captions.
6. Patient selects and confirms a familiar profile → encounter enters the diary without an identity guess.
7. Review/correct a moment → create a recap → follow sources → pause/end → reload and recover records.
8. Confirm any agent-proposed change before it is applied.

## Deployment boundaries
The browser is the working camera device. Native Meta camera integration requires the official iOS/Android Device Access Toolkit, developer access and physical hardware checks. Standalone Meta Display Web Apps have a different capability set. No mock hardware or simulated provider response is used by the app. Tests alone use injected synthetic responses.

No public deployment or sharing change is authorized. Code pushes are authorized. A single-household password deployment is not a multi-tenant care service, and clinical suitability has not been evaluated.

## Preserved v0.3 implementation

### Thread 0.3 — local web implementation

Product: a personal care companion supporting independence, dignity, and human connection.

## Scope
Local web first. Preserve the original browser prototype, reuse its domain and encrypted AI connection, and keep the existing hosted site unchanged. Household knowledge precedes custom model training. Real mobile/Meta integration is deferred.

## Milestones
- [x] React/TypeScript + Vite frontend and Fastify API in a modular workspace.
- [x] PostgreSQL-compatible migrations, local PGlite storage, PostgreSQL adapter.
- [x] Household knowledge CRUD, correction history, source-aware lexical retrieval, and Test Thread.
- [x] Agentic read tools, reviewed actions, cancellation, limits, state checks, and durable run history.
- [x] Browser camera preview/capture/retake/stop/upload and explicit still-image AI questions.
- [x] Care profiles, routines, interruption recovery, local help lifecycle, message drafts, summaries.
- [x] Durable reminder scheduling, snooze/acknowledge, quiet hours and optional in-browser notifications.
- [x] Provider audio transcription, optional browser fallback, browser spoken replies.
- [x] Reviewed photo collection, grouped dataset splits, editing/deletion/export, evaluation feedback.
- [x] Local export/deletion, retention controls, secure key configuration, old-browser-state import.
- [x] Complete automated integration and browser verification; record exact evidence and remaining hardware/live-provider checks in feature-status.md.
- [x] Finish local handoff and run instructions.

## Acceptance flows
1. Teach a fictional fact → persist → ask → retrieve → inspect source → reopen after restart.
2. Start routine → confirm one step → pause → restart → recover same unconfirmed step.
3. Capture/upload → explicitly ask about photo → review result → optionally retain labeled example → export/delete.
4. AI proposal → unrelated state change → reject stale apply; duplicate apply must not repeat a change.
5. Reminder → due → snooze → acknowledge; missed reminders reconcile when the server returns.
6. Denied camera/microphone, missing key, provider failure, cancellation, and invalid model output remain explicit.

## Later, after this local MVP
Multi-household care circles, external notification delivery, held-out model evaluations and optional approved training, native mobile, and official Meta SDK adapters with physical-device tests. Streaming voice and PostgreSQL verification are included in 0.4, with live voice account/device validation still pending.

Earlier scope and verification are preserved in docs/legacy-plan.md.

## Recognition tracker
- [x] Human-reported recognition logging with saved familiar profiles and patient/caregiver source.
- [x] Daily unique-person count and seven-day trend, with cue/introduction breakdown and no-data gaps.
- [x] Persistent diary entries, 30-day retention, idempotent writes, time-zone handling and deletion regression checks.
