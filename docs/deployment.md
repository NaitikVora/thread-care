# Run and deploy one household

## Local demo

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4173`. No API responses are simulated by the application. Connect OpenAI and ElevenLabs under Settings. Caregiver notes, manually written diary moments and routines work without an AI key; live vision and voice report missing credentials explicitly.

## Private server preparation

The included container/Compose configuration provides a single Node service, PostgreSQL 17 and durable storage. It is a deployment artifact, not a deployed service. The app port is bound to the host's loopback; put an HTTPS reverse proxy in front when you are ready to host it.

Copy `.env.example` to `.env` and configure:

- `PUBLIC_ORIGIN`: exact HTTPS origin exposed by your proxy.
- `THREAD_CAREGIVER_PASSWORD`: a unique strong password of at least 16 characters.
- `THREAD_PATIENT_PASSWORD`: a different strong password of at least 16 characters for patient access.
- `SESSION_SECRET`: a stable random secret of at least 32 characters, preserved across restarts and kept out of Git.
- `POSTGRES_PASSWORD`: a strong URL-safe password for the database. If using punctuation that has URI meaning, set a correctly percent-encoded connection URI instead of interpolating it unescaped.
- `OPENAI_API_KEY`: configure server-side for a patient on a separate browser. A caregiver's one-hour OpenAI browser session key is not shared with another browser.
- ElevenLabs can be configured through the caregiver portal; the saved server connection is encrypted and shared with authorized household sessions.
- `MAX_AI_CALLS_PER_DAY`: choose your OpenAI request budget. Defaults to 100; selected camera moments consume calls. This is not a monetary spending cap.

```sh
docker compose up --build -d
```

Production mode refuses to start without authentication and an HTTPS origin. Non-loopback listening also refuses unconfigured access. The proxy must preserve the original Host header. The app verifies Host and Origin and uses HttpOnly, SameSite cookies; production cookies are Secure. Do not put a plaintext HTTP tunnel in front or share a local unauthenticated workspace.

## Identity boundary

There is one household, with caregiver and patient roles. Passwords are verified server-side, not stored by the browser. Session tokens are random, stored as hashes, expire after 12 hours and can be revoked by signing out. Sign-in attempts are rate-limited. Patient requests are blocked from caregiver configuration, key management, profile enrollment, bulk export and workspace deletion. Patient-facing reads and reviewed everyday actions still work.

This is not multi-tenant identity. Add real account recovery, per-person membership, OIDC/passkeys, household-scoped row ownership and audited administration before offering the service to unrelated households. The current single-process controller maps and rate limits must become distributed coordination before multiple API replicas handle capture/agent workflows.

## Operations

- Back up PostgreSQL, image storage and `SESSION_SECRET` together. Exercise a restore before relying on the backups.
- Keep camera/microphone indicators, consent, retention and deletion available to the patient. Browser capture cannot continue while the page is hidden or the device is asleep.
- `/api/health` tests database reachability without returning personal records.
- The GitHub workflow runs the application tests, build and a real PostgreSQL integration check. No live cloud key is required for CI; provider transport tests use explicit synthetic test doubles.
- `npm run test:postgres` requires `POSTGRES_TEST_URL` pointing at a disposable test database. Never point it at household data.
- A live release still needs target browser/microphone/audio checks, real provider account tests, native Meta hardware validation, security review, operational monitoring, and evidence appropriate to its intended care use. Passing software tests does not establish clinical effectiveness.

No public deployment was performed as part of this implementation.
