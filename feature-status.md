# Feature and verification status

## Thread 0.4 integrated day companion

| Feature | Status | Evidence / limits |
|---|---|---|
| Patient live camera view | Implemented with real browser camera | Preview/capture adapter, change-filtered still capture, visible controls, pause/end and interruption guards; latest target-device media check still outstanding |
| Virtual day diary | Implemented | PostgreSQL-compatible records, full-text GIN retrieval, time/category filters, retention, source images, corrections and export covered by integration tests |
| Diary retrieval in patient view | Browser verified | Synthetic note saved through real UI, retrieved in Basic mode with timestamp/source; separate test database, no provider simulation |
| OpenAI image observations and recaps | Implemented | Structured Responses API with no runtime fallback/mock; provider contract and fabricated-source rejection tests pass |
| OpenAI account connection | Live-provider verified | Existing user session key passed the real connection test on September 19, 2026; full live model-quality evaluation not performed |
| ElevenLabs live voice | Implemented; live account/device check pending | Official browser/server SDK, private agent creation, signed URLs, interruption, captions, context tools; SDK request serialization tested with controlled transport |
| Voice context/action tools | Implemented | Read context, inspect current camera view, labeled profiles, reviewed proposals; direct-memory bypass prevented for voice proposals |
| Familiar-person portal | Implemented | Consent, photos, correction, deletion and patient-confirmed encounters tested; no automatic face matching |
| Patient / caregiver access | Implemented for one household | Expiring hashed sessions, rate-limited sign-in, role-based API checks; authentication/HTTPS required before network/production mode |
| PostgreSQL server adapter | Verified against PostgreSQL 17 | Real database migration, indexed diary retrieval and concurrent idempotency checks pass |
| Container / deployment configuration | Built and started locally | Node 24 container connected to PostgreSQL 17; health returned 200 and unauthenticated data access returned 401 |
| Meta native SDK | Not implemented or hardware verified | Browser adapter and documented native boundary; not presented as a working Meta integration |
| Public hosting | Not performed | Only local preview and authorized GitHub source pushes |

Current local verification: **61 application tests plus 1 real PostgreSQL test passing**, TypeScript check and production build passing. Test fixtures are confined to tests; no runtime AI or glasses response is mocked. The real app is at `http://127.0.0.1:4173`.

## Earlier core feature detail

Last implementation pass: September 19, 2026. This file distinguishes code implementation from live-provider/hardware verification. No Meta integration or model training has occurred.

| Feature | Implementation | Evidence / remaining verification |
|---|---|---|
| React/TypeScript web UI | Implemented | Production build and type checking pass; browser walkthrough performed |
| Local durable storage | Implemented | PGlite read/write, transaction, and restart tests pass |
| PostgreSQL deployment adapter | Verified | Same SQL/repository contract exercised against PostgreSQL 17 |
| Household teaching / correction history | Implemented | API tests and browser create/retrieve/source-inspection flow pass |
| Source-aware basic retrieval | Implemented | Deterministic matching/quotation verified; lexical retrieval, not embeddings |
| OpenAI connection and encrypted session | Implemented | Controlled provider contract tests pass; a real connection test also passed with the existing user session key |
| Bounded agent tool loop | Implemented | Read tools, schema/permission rejection, limit and cancellation tests pass |
| Reviewed AI actions | Implemented | No write before confirmation; stale and duplicate apply tests pass; browser stale-action rejection verified |
| AI routine drafting | Implemented | Controlled browser draft → edit → save → start → pause → reload flow verified |
| Explicit remember command | Implemented | No unnecessary model call; persistence/idempotency tests pass |
| Routines and interruption recovery | Implemented | Original domain tests, server restart test, and browser reload test pass |
| Camera start/stop/capture | Implemented | Real browser permission flow exercised; full capture/device matrix still requires target-device verification |
| Photo upload and still-image request | Implemented | Synthetic image upload and controlled AI response verified; live vision quality unverified |
| Retained labeled examples | Implemented | Consent, grouped split, bytes, ZIP export, deletion covered by API tests |
| Feedback and evaluation export | Implemented | Exports tested; no model-quality benchmark or fine-tuning job run |
| Provider speech transcription | Implemented | Requires live API key and microphone validation; browser fallback is explicitly labeled |
| Browser spoken replies | Implemented | Off by default; audible target-device verification outstanding |
| Care profile / visits / reassurance | Implemented | Durable domain paths; original profile tests retained |
| Help lifecycle | Implemented, local only | Local request → acknowledge → resolve; no external delivery |
| Caregiver handoff / message drafts | Implemented | Structured AI path; live output quality unverified |
| Persistent reminders / snooze / acknowledge | Implemented | Due reconciliation and state transition tests pass |
| Browser reminder notifications | Implemented | Requires permission, open browser and running local server; OS delivery not verified |
| Quiet hours / opt-in suggestions | Implemented | In-app preference controls; no background surveillance |
| Export and deletion | Implemented | API tests confirm records and retained image cleanup |
| Authentication / remote households | Single-household roles implemented | Multi-household accounts and distributed operation deferred |
| Mobile and Meta | Deferred | Interfaces and migration plan only; no SDK or hardware claim |

## Current verification count

27 retained domain/provider tests, 19 durable-application tests, 13 day-companion tests and 2 media-lifecycle tests pass (61 application tests). One additional real PostgreSQL integration test passes. Build and type checking pass. The production container builds and starts against PostgreSQL 17 with its authentication boundary enforced. Earlier core QA used an explicitly controlled fixture. The current diary UI walkthrough uses the real application with a separate local database and no cloud key. The real application on port 4173 does not load fixtures.

## Known product limits

- The local server must remain running. Browser notifications additionally require an open, permitted browser.
- Care-circle support is a local shared workspace, not external messaging or remote access.
- Input/output and tool counts bound work per request. A durable daily AI-call cap defaults to 100 attempts across model calls, connection tests and transcription; configure MAX_AI_CALLS_PER_DAY to change it. This is not an exact monetary cap. Successful runs record provider token counts and latency; actual charges remain in provider billing.
- Retrieval is lexical; source cards show records supplied to an answer, not guaranteed model attribution.
- Agent-run retention is independent of rolling conversation/domain history; deleting a note does not erase earlier quoted conversation text. Clear the workspace to remove all local records.
- This is a working MVP, not evidence of clinical effectiveness or suitability for unsupervised care.
