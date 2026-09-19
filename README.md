# Thread

A local personal care companion for independence, dignity, and connection. Thread 0.4 has a React/TypeScript interface, a Fastify API, durable household knowledge and routines, reviewed agent actions, camera/photo workflows, reminders, and evaluation examples.

## Start with the patient experience

Open **Live companion** for camera sessions, a patient view with visual feedback, and real ElevenLabs voice. **Day diary** organizes recorded moments and supports search, correction and sourced recaps. **Familiar people** stores consented family profiles; the patient confirms a labeled person rather than the app guessing identities.

Connect OpenAI and ElevenLabs in **Settings**. Choose **Connect & create voice agent** to provision a private agent with Thread's tools in your ElevenLabs account. Then start a patient-controlled diary session, choose retention, turn on the camera, and press **Talk with Thread**. OpenAI analyzes selected stills; ElevenLabs streams voice and retrieves context from the same database. No real-time integration is replaced with a mock response.

When asked who is with the patient, Thread opens saved profile choices if no encounter is confirmed. A confirmation links the person to the session and recent camera observation, updates the voice context, and stays available for follow-up questions. Clear the encounter when the person leaves; confirmation also expires or clears on pause. This does not perform automatic face matching. Existing ElevenLabs agents receive the updated instructions at the next voice connection.

See [the complete demo flow](docs/day-diary.md), [ElevenLabs setup](docs/voice-agent.md), [deployment instructions](docs/deployment.md), and [the actual Meta integration boundary](docs/meta-integration.md).

## Start

Requires Node.js 22.12+ (tested on Node 26) and npm.

    npm install
    npm run build
    npm start

Open **http://127.0.0.1:4173**. The default local server binds to loopback only. Keep the terminal process running. Stop it with Ctrl+C. Records remain under `.local-data/` after restart; this directory and `.env` are excluded from Git.

For development with automatic updates:

    npm run dev

This starts the API on 4175 and Vite on 4173. Do not run `npm start` at the same time. The prior browser-only prototype is retained under `dist/` and can be started separately with `npm run legacy` when the main server is stopped.

## Connect real AI

Open **Settings → AI connection**, enter your OpenAI API key, and choose **Connect & test**. The default text/vision model is `gpt-4.1-mini`. Connection tests and requests use your API project billing. The key is sealed in an encrypted, one-hour HttpOnly cookie, not localStorage. A test must succeed before a session key is created.

Alternatively, copy `.env.example` to `.env` and set `OPENAI_API_KEY`. A session key overrides an environment key. Disconnect removes the session key; an environment key remains configured until removed from `.env` and the server restarted. A stable local encryption secret is generated automatically in `.local-data/session-secret` with restricted file permissions unless `SESSION_SECRET` is provided.

A durable local cap defaults to 100 provider calls per UTC day (including connection tests and transcription). Set MAX_AI_CALLS_PER_DAY to change it. Agent requests allow at most three model turns, and Activity records latency and provider token usage. This is a request budget, not a dollar guarantee.

The existing OpenAI browser connection passed a real provider connection test on September 19, 2026. Automated integration tests use explicit synthetic provider transports; these do not establish model quality or microphone performance. ElevenLabs live audio still needs a configured user account/key and device validation. The real app never loads a provider fixture.

## First useful walkthrough

1. Open **Teach Thread → Teach something**. Save a fictional note titled “Spare keys,” with “In the blue bowl beside the front door.”
2. Ask “Where are the spare keys?” in **Test Thread**. Without a key, Thread quotes the retrieved note in explicitly labeled Basic mode. With a valid key it asks the live agent; expand the reference notes and action trace.
3. Correct the note and inspect its version history. Reload or restart the server; the correction remains.
4. In **Companion**, start a routine, confirm one step, and pause. Reload. The next unconfirmed step is preserved. “Remember to get my cardigan” saves an explicit intention directly.
5. In **Look with me**, start the camera or upload a supported image. Preview/capture stays local. Press **Ask about this photo** to send the selected still to OpenAI. Unsaved photos are not retained server-side.
6. Choose **Review & save an example** only when you want local retention. Label it, assign an object/session group, and confirm consent. Export a ZIP from the collection. This does not train a model.
7. In **Care circle**, author or AI-draft a routine, review its steps, add a reminder, or acknowledge a local help request.
8. In **Activity**, inspect completed/failed/cancelled agent requests, reopen pending suggestions, and review confirmed progress. An outdated suggestion is rejected if its source state has changed.

## What works, and what is limited

- **Persistent local functions:** household knowledge, correction history, source-aware retrieval, routines and recovery, intention/object notes, care profiles, local help lifecycle, reminders, settings, reviewed photos, export/deletion, and feedback.
- **AI functions:** real ElevenLabs streaming voice and client tools, camera observations, diary retrieval and recaps, model connection test, a bounded read-tool loop, natural conversation, still-image analysis, routine/reminder proposals, caregiver summary/message drafts, and audio transcription. A real API key is required; errors stay explicit.
- **Voice:** Live companion uses the official ElevenLabs SDK for streaming conversation, audible replies, captions, interruption and context tools. The separate Companion page also retains optional OpenAI push-to-talk transcription and explicitly labeled browser speech features. Permission, hardware and browser support vary. Use a browser that supports camera and microphone permissions.
- **Reminders:** durable in-app scheduling and optional browser Notifications. The server must run; overdue reminders reconcile after restart. The browser must be open for browser notifications. Quiet hours silence banners/notifications; reminders remain in Care circle.
- **Help:** local care-circle records only. No SMS, email, push-service delivery, calls, emergency dispatch, or multi-household account service is implemented.
- **Learning:** knowledge retrieval and reviewed dataset/evaluation collection are implemented. No fine-tuning, clinical validation, face identification, continuous visual tracking, or disease prediction is performed.
- **Meta/mobile:** adapter contracts and migration documentation exist; native apps and official Meta SDK integration remain future work.

See [feature-status.md](feature-status.md) for verification evidence and [architecture.md](architecture.md) for boundaries, limits and the hosted migration path.

## Data and local access

By default this is one local household workspace. Optional caregiver/patient passwords add server-enforced roles and expiring sessions; production mode requires authentication and an HTTPS origin. It is not a multi-tenant service. See deployment instructions before any network hosting.

Local hosting does not mean AI processing stays local. Explicit AI requests send selected context and media to OpenAI. Raw voice clips and unsaved images are not written to storage. Diary sessions separately choose whether to retain source stills and transcript text. Reviewed images stay in `.local-data/images`, outside the public web directory. No provider key, raw audio, or image data is included in application logs.

Retention applies to agent-run records and evaluation feedback. The separate rolling conversation (up to 40 messages), domain events (up to 150), knowledge, and retained photos remain until changed/deleted. Deleting a note removes its knowledge record and correction history, not text already quoted in an earlier conversation. **Settings → Delete local records** clears workspace records and restores the fictional sample profile. Export first if you need a copy.

## Database and scaling

The default is filesystem-backed PGlite, a single-process PostgreSQL engine. Set `DATABASE_URL` to use the node-postgres adapter and a PostgreSQL server with the same migrations. Do not open the same PGlite directory from multiple server processes.

The local workspace is intentionally bounded. A hosted deployment needs real identity/household authorization, PostgreSQL verification, object storage, backups, quotas, and a delivery worker. See [architecture.md](architecture.md). The existing private Sites preview was not updated for this local iteration.

## Verification

    npm test
    npm run check
    npm run build

Tests cover the original domain/API plus the new durable API, database restart recovery, optimistic concurrency, idempotency, action validation, read-tool execution, cancellation, origin protection, reminders, retained images, export/deletion, and feedback. Integration tests use temporary databases and controlled provider responses.

    npm run test:browser

This starts a disposable **controlled QA server at http://localhost:4174** (use that hostname to keep QA cookies separate from the real app). It does not contact OpenAI. Any fake key/response is confined to `tests/`. Do not use this QA URL as the real application.

## References

- [Vite](https://vite.dev/guide/), [Fastify](https://fastify.dev/docs/latest/Reference/TypeScript/), [PGlite](https://pglite.dev/docs/filesystems)
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [speech transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [Meta Wearables platform](https://developers.meta.com/wearables/faq/)
