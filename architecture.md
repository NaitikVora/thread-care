# Thread 0.4 — integrated day companion

The patient view uses a real browser camera and the official ElevenLabs voice client. Fastify owns persistent diary records, indexed retrieval, provider credentials and reviewed actions. OpenAI processes selected stills and agent requests. ElevenLabs streams audio and calls the same context/action boundaries through registered client tools.

## New data flow

1. Start a consented session → PostgreSQL-compatible session record and retention policy.
2. Capture a selected still → validate session/time/budget → OpenAI structured observation → unreviewed diary event, optionally retained source image.
3. Voice/question → indexed diary + household knowledge + current routine → source-aware reply or reviewed proposal.
4. Confirm a labeled person or review a moment → durable confirmed record with provenance. No automatic face identification.
5. Daily recap → source-bounded synthesis → validate references and source revisions → store recap.

`migrations/005_current_encounter.sql` links a confirmed person to the current session and optional camera observation. These short-lived presence records are independent of searchable historical visits and expire or clear when interrupted. `/api/v1/voice/context` and session context reads expose the same state.

`migrations/003_day_companion.sql` adds session, event, full-text GIN index, correction, digest, familiar-person, integration-secret and voice-lifecycle records. `004_household_access.sql` adds hashed, expiring household sessions. These are separate from the original authoritative domain state, so automatic camera observations cannot advance routine steps or silently overwrite caregiver facts.

## Device and provider boundaries

`BrowserCamera` implements the declared CameraAdapter. The browser client is an actual input source, not a Meta simulator. ElevenLabs signed URLs are generated server-side through the official SDK. Only temporary session credentials go to the browser; saved ElevenLabs keys are AES-GCM encrypted. The provider's conversational model calls four bounded client tools; mutations require on-screen review.

Full-text retrieval is PostgreSQL stemming/ranking with time/category filters, not embeddings or custom training. Stale source checks prevent recaps or reviewed actions from silently applying to changed records. Capture and voice sessions expose gaps instead of fabricating continuity.

## Scope and deployment

Caregiver/patient password roles are supported for one household, with server-side access checks. Production startup requires HTTPS and authentication. Containers and a PostgreSQL CI job are provided; no hosting or sharing settings were changed. Distributed jobs, multiple households, native Meta capture, production operations and clinical suitability require separate verification. See docs/deployment.md and docs/meta-integration.md.

## Core architecture

Thread is a single-household application. The browser is a client of an authoritative API; household knowledge, routines, and workflow status live on the server. The existing hosted v0.1 prototype is separate and is not changed by this local build.

## Modules

- apps/web: React + TypeScript + Vite; patient and caregiver areas, browser camera/audio, permission UI, reviewed actions.
- apps/api: Fastify; request validation, origin/host checks, durable records, reminders, file storage, model credential gateway.
- packages/domain: reusable state transitions and device adapter contracts. No dependency on React, OpenAI, or Meta. The original domain tests remain available; new integration tests exercise this shared implementation.
- packages/contracts: Zod inputs and TypeScript record types.
- packages/agent: bounded model/tool orchestration with an AIProvider boundary. OpenAI Responses is the initial provider.
- backend/api.mjs: retained, tested OpenAI connection and encrypted credential implementation from v0.2. The new API reuses it instead of discarding prior work.
- migrations: versioned SQL, applied transactionally at server startup.

## Persistence

PGlite provides a single-process filesystem-backed PostgreSQL engine under .local-data/postgres. A node-postgres Pool adapter is selected when DATABASE_URL is configured; the same parameterized SQL migrations and repository interface are used. The PostgreSQL adapter has passed migrations, indexed retrieval and concurrent command checks against PostgreSQL 17. The embedded configuration is not a multi-process or horizontally scalable deployment.

The current domain snapshot is versioned in app_state. Mutations lock it inside a database transaction, check the client revision, and record a request ID/fingerprint. Repeating the same command returns the original result; reusing an ID for different content is rejected. Knowledge, correction history, reminders, reviewed images, settings, and agent runs have separate tables. New knowledge invalidates pending agent suggestions by advancing the domain revision.

A maximum of 500 knowledge notes and 100 reviewed images keeps the local workspace bounded. Domain limits include 20 routines, 40 object notes, 40 help requests, 40 conversation turns, and 150 recent domain events. Export before deleting records needed for longer-term history.

Raw camera photos are ephemeral unless the user explicitly retains a reviewed photo example or enables source-frame retention for a diary session. Voice audio is not stored locally; transcript retention is a separate opt-in. Retained image bytes are outside the public web root; UUID metadata points to an ImageStorage implementation. LocalImageStorage can later be replaced with an S3-compatible adapter. Dataset ZIP export contains reviewed images and a versioned manifest; no training job runs.

## Agent execution

1. Validate the request and persist a running workflow.
2. Load authoritative domain state and retrieve matching household notes.
3. Use live OpenAI, if configured, with read-only tools for knowledge, current activity, and reminders.
4. Limit each run to three model turns and six requested tool calls, with 1,400 output tokens per turn, a 90-second run timeout, and a 30-second provider timeout. No automatic provider retry is performed: users can explicitly retry a failed request. Requests are rate-limited locally and no more than two agent runs may be active. An atomic daily budget reserves each provider call before dispatch; MAX_AI_CALLS_PER_DAY defaults to 100 and resets at midnight UTC. Failed provider attempts count. Successful agent runs record model calls, input/output tokens and elapsed milliseconds; actual monetary billing is not estimated.
5. Validate structured reply/actions. Unsupported actions are rejected in code. Writes remain proposals.
6. Append the conversation only if its source state remains current. Discard proposals if records changed.
7. Apply a confirmed proposal transactionally with revision and idempotency checks.

Clear explicit remember commands use a deterministic domain action and are recorded as basic-mode operations. Basic mode also quotes matching notes and recalls existing routines; it never masquerades as a language model. Live-provider errors are surfaced, not converted to canned answers. Source cards describe reference notes supplied to the response, not a fabricated claim that the model cited every note.

Cancellation aborts the upstream request. A restart marks in-flight workflows interrupted; completed suggestions can be reopened in Activity and are still subject to revision checks. Execution traces contain concise tool outcomes, not chain-of-thought. Feedback/corrections are evaluation records and do not silently change household facts.

## Camera and audio

Live companion keeps a visible camera preview during an explicitly started session and sends change-filtered selected stills at the chosen interval, or after a manual request. It stops media on pause, navigation or a hidden document. Camera observations have timestamps, uncertainty and unreviewed status; they do not prove that a task was completed.

The separate Look with me flow requests camera permission only after Start camera and stops after a still capture. Upload is an explicit fallback. Analyze photo sends that selected still to OpenAI. Neither flow continuously tracks or identifies people.

Live companion uses ElevenLabs streaming conversation with signed session URLs, visible microphone state, captions and context tools. Sessions are bounded to 15 minutes and require explicit restart. New observations can update the voice context; optional audible updates are patient-controlled.

In the separate Companion composer, with an AI key, push-to-talk records a bounded audio clip, sends it to the backend for OpenAI transcription, and places editable text in the composer. The user presses Send separately. Without a key, supported browsers can use their SpeechRecognition service. Speech synthesis is a labeled browser capability and is off by default. Audio is never persisted. Hardware permission, microphone capture, and audible playback need target-device checks.

## Reminder delivery

A 15-second server scheduler marks due rows; every reminder read also reconciles overdue rows. The browser polls every ten seconds and can issue Notifications after permission. Quiet hours silence banners and browser notifications, not the stored due state. A server shutdown stops scheduling until restart, when overdue rows become due. Closing the browser prevents browser notifications; there is no background push worker, email, SMS, or emergency dispatch.

## Security and local trust boundary

The listener defaults to 127.0.0.1. Host headers must identify localhost or the explicitly configured PUBLIC_ORIGIN; API requests reject cross-site origins and writes require JSON plus a custom header. The application defaults to a local shared-household workspace; optional password roles are now available as described above. Other authorized users/processes of this computer can access it. Network listening requires household authentication and an HTTPS PUBLIC_ORIGIN; see the private deployment instructions.

OpenAI keys are optional server environment secrets or sealed into one-hour AES-GCM encrypted HttpOnly, SameSite=Strict cookies. The encryption secret persists locally in a mode-0600 file; entered keys are not returned to JavaScript. The local HTTP cookie is not Secure; HTTPS deployment requires Secure cookies. API keys and raw audio/image input are not logged. Cloud requests use the fixed OpenAI and ElevenLabs service destinations. Camera-derived text and saved notes are untrusted model context, never permissions.

Before offering service to multiple households: add OIDC/passkey identity, household membership and scoped server authorization, CSRF/session review, tenant-scoped database queries, distributed quotas, storage encryption/retention policies, backups, and notification delivery workers. A new browser UI is not a substitute for these server controls.

## Scalable deployment path

Use a standard Node service and real PostgreSQL first. Serve Vite assets through a static host or the API, replace local file storage with object storage, and use a durable worker for push/reminder delivery. Add pgvector only if held-out retrieval evaluation justifies it; current retrieval is lexical and is intentionally transparent. Move from a snapshot domain row to normalized routine/workflow records when concurrent care-circle editing requires finer locking.

## Mobile and Meta

Future native clients use the same contracts and API. Camera, Audio, Notification, and Wearable adapter boundaries are declared under packages/domain. An iOS Device Access Toolkit adapter can be implemented after current official capability verification and developer registration. The browser implementation does not import a Meta SDK and is not a glasses integration. Standalone Display Web Apps are a separate target. No hardware compatibility has been asserted.
