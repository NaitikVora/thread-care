# Thread Care — browser prototype plan

## Goal
Build a working, hardware-free prototype of an assistive companion for familiar daily activities. A browser substitutes for the glasses display, microphone, and speakers. Start with three coherent capabilities: remember an intention, follow a reviewed routine, and request caregiver help.

## Scope for version 0.1
- [x] Responsive companion screen with a compact simulated glasses display.
- [x] Three editable, low-risk routines with one instruction at a time, completion, pause, and resume.
- [x] Intention bookmarks and object-location notes with timestamps and explicit sources.
- [x] Guided assistant with typed commands, optional browser speech recognition, and opt-in spoken replies. Clearly identify the local intent engine; do not imply a connected general-purpose language model.
- [x] Caregiver panel for display name, contact name, next visit, reassurance, and routine editing.
- [x] Help requests with activity context and caregiver acknowledgment. Requests stay in this browser and synchronize across same-origin tabs; no real messages or emergency dispatch.
- [x] Activity timeline and persistence on this device, with reset confirmation.
- [x] Graceful handling of unsupported voice APIs, denied microphone access, unavailable storage, and invalid input.
- [x] Git repository, runnable application, README, and meaningful automated and browser verification.
- Private hosted preview: publish the verified source after validation.

## Implementation
Use dependency-free HTML, CSS, and JavaScript modules in `dist/`. Keep the assistant and state transitions in a testable domain module, independent of UI and future Meta adapters. Use browser storage for explicitly device-local demo data. Use Node's built-in HTTP server for local development and built-in test runner for domain tests. No credentials are required to run the basic application.

## User flow
1. Select a routine, such as getting ready for a walk.
2. Receive one short instruction and confirm completion yourself.
3. Save an intention or pause when interrupted.
4. Ask “What was I doing?” to recall the last confirmed intention or current step.
5. Ask for caregiver help; review and acknowledge the local request in the Care circle panel.
6. Review the source-labeled activity timeline.

## Product boundaries
Use fictional sample data. Do not infer that a task was performed from a prompt or an image. Do not provide medication decisions, diagnoses, automatic face recognition, background recording, autonomous navigation, or emergency monitoring. No camera is necessary for this first slice. State clearly that glasses hardware, wearable comfort, and clinical usefulness remain unvalidated.

## Validation
Test interruption/resume, routine progression, object-memory uncertainty, visit answers, help request lifecycle, data restoration, and malformed storage. Exercise the main UI flow and responsive layout in a browser. Check all local asset references and JavaScript syntax. Publish only the verified committed source.

## Later iterations
Add a camera adapter with explicit capture and review; a server-side voice/model integration; authenticated shared caregiver accounts; a Meta Device Access Toolkit adapter; and supervised co-design sessions with people living with dementia and caregivers.

## Verification completed
- 13 domain tests pass, covering interruption recovery, explicit completion, source-aware object memory, help lifecycle, routine editing, persistence, and invalid input.
- Browser walkthrough verified routine controls, typed memory commands, caregiver acknowledgment/resolution, timeline, reload persistence, and cross-tab updates.
- Phone layout checked at 390 × 844 and desktop layout visually inspected.
- WebMCP read tool verified with valid and invalid inputs.
- Live microphone recognition and audible playback require testing on the target browser/device; no microphone permission was requested during automated QA.
