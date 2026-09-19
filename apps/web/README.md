# Thread Care

A working browser prototype of a daily continuity companion. No Meta glasses, API key, paid service, installation step, or database is needed.

## Run locally

Requires Node.js 20 or later.

    npm start

Open http://127.0.0.1:4173. The port can be changed with the PORT environment variable. The server binds to loopback only.

    npm test
    npm run check

## Try the application

1. Start **Get ready for a walk**.
2. Confirm the first instruction with **I’ve done this**, then press **Pause**.
3. Ask **What was I doing?** The next unconfirmed step is retained.
4. Press **I’m ready** to resume.
5. Type **I put my keys on the hall table**, followed by **Where are my keys?**
6. Press **I need help**, then open **Care circle** to acknowledge and resolve the request.
7. Edit the next visit and a reassurance message in Care circle; ask **When is my next visit?** or **I feel worried**.
8. Reload the page to check device-local persistence.

**Remember something** provides forms for intentions and object locations, so speech is never required. **Activity** shows source-labeled notes and confirmed steps. **Reset demo** requires confirmation.

## Voice

The microphone uses feature-detected browser SpeechRecognition, which is not supported in every browser. Speech services may require connectivity and may process audio remotely. Recording starts only after pressing the microphone and granting browser permission. Recognized words appear in the input for review; press Send to submit. Typing remains available when permission is denied or recognition fails.

Spoken replies use browser speechSynthesis and are off by default. Turn them on using the sound control. Browser and operating-system voice availability varies.

## What is real, and what is simulated?

- Real: routine state transitions, typed command handling, bookmarks, timestamped object notes, local caregiver request lifecycle, editable care details, browser speech integration, and persistent local data.
- Simulated: the glasses display, wearable inputs, and caregiver delivery. Requests are visible only in the same browser profile on the same origin, including other open tabs.
- Assistant: a deterministic local intent engine, **not a connected language model**. It supports the documented commands and discloses when it cannot answer. It never infers completion of an activity.
- No camera, face recognition, clinical assessment, medication guidance, emergency dispatch, authentication, or shared server database is implemented.
- This is a product prototype with fictional sample data. Wearable comfort, real microphone behavior, and usefulness for people living with dementia still need validation.

## Data

The application stores demo state under thread-care:v1 in localStorage. Nothing in the app sends that state to a server. The browser's speech service is a separate optional data path, and Google Fonts is requested for typography with system-font fallbacks. Use fictional information while evaluating. Different origins (localhost and the hosted preview) have separate data.

Cross-tab updates are supported through the storage event. This is a single-device demonstration, not concurrent multi-user collaboration. Simultaneous writes can overwrite each other. Storage failure is surfaced and the app continues in memory.

## Structure

    plan.md                 Scope, user flows, and future phases
    dist/index.html         Semantic interface and dialogs
    dist/styles.css         Responsive companion and caregiver layouts
    dist/app.js             Shared interface icons
    dist/controller.js      UI, speech, persistence, optional WebMCP read tool
    dist/domain.js          Pure state transitions and guided assistant
    server.mjs              Local static server
    tests/domain.test.mjs   Core workflow and failure-case tests
    scripts/check.mjs       Syntax and local asset verification
    .openai/hosting.json    Private Sites identity and static configuration

## Future integration

Keep the domain module independent of device transport. A later Meta Device Access Toolkit adapter can supply supported camera and audio inputs through a native mobile app. A Display Web App is a separate interface target; this responsive simulator is not yet a validated 600 × 600 on-glasses build. Add server-side model credentials only when a live voice/vision model is introduced, together with consent, authentication, reviewed memory writes, and shared caregiver storage.

Official platform references: [Meta Wearables FAQ](https://developers.meta.com/wearables/faq/) and [Meta Web App toolkit](https://github.com/facebook/meta-wearables-webapp).
