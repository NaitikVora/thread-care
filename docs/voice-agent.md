# Real ElevenLabs voice

Thread uses the official `@elevenlabs/react` browser SDK (the exported `Conversation` client) and `@elevenlabs/elevenlabs-js` server SDK. There is no simulated voice response in the application.

## Setup

1. In Thread, open **Settings → ElevenLabs live voice**.
2. Enter an ElevenLabs API key with Agents read/write access. Choose **Create a private Thread voice agent**. Optionally choose a voice ID from your account; blank uses the provider default.
3. Choose **Connect & create voice agent**. This creates a real agent in your ElevenLabs account and saves its ID with an encrypted server-side key. Creation and subsequent conversations are not simulated.
4. In **Live companion**, start a diary session with **Enable live voice** checked. Start the camera if you want visual context. Choose **Talk with Thread** and allow microphone access. Alternatively, **Enter full screen** starts camera and voice together after the session consent choices.
5. Speak normally. Spoken replies and captions arrive through ElevenLabs. You can interrupt by speaking, mute the microphone, stop voice, or pause the entire session.

The key is encrypted using AES-256-GCM and the server's stable `SESSION_SECRET`; it is excluded from exports. Keep that secret with your backups or reconnect the provider after a secret rotation. Browser clients receive a temporary signed conversation URL, never the API key.

Alternatively set `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` on the server. An existing agent must have authentication enabled and the four client tools below. Creating an agent through Thread is the easiest way to obtain the complete prompt and tool configuration. A stored connection overrides environment values; disconnect only removes the stored connection, not the remote agent or environment configuration.

## Tools and actual behavior

| Client tool | Backend behavior |
|---|---|
| `search_context(query)` | Reads indexed diary records, caregiver notes, current routine, reminders and labeled profiles. Returns timestamps and review/source labels. |
| `inspect_current_view()` | Captures a real still (or awaits the in-flight capture), analyzes it through OpenAI, persists the observation, and returns it with current-session context. |
| `get_familiar_people()` | Reads the current confirmed encounter and labeled profiles. Opens the photo chooser when nobody is confirmed. It does not compare faces. |
| `prepare_action(request)` | Runs the bounded OpenAI agent with `requireReview: true`. Displays proposals. Never executes them on behalf of the patient. |

All client tools set `expects_response: true`. A camera observation can also be sent as a contextual update without interrupting the patient. The optional **Read new observations aloud** control explicitly requests a short spoken response after each new observation. Text-only Thread questions still work when voice is disconnected; they use OpenAI directly.

## Existing agents receive the fix too

At the next voice connection, Thread uses the official SDK to read the connected agent and append its versioned encounter instructions if missing. It patches only the prompt; existing instructions, voice, model and tool references are preserved. **Settings → Update Thread instructions** performs the same upgrade without starting a conversation. The API key needs agent read/write permissions. A failed upgrade is visible and prevents silently starting an outdated agent. Stop and restart an already-open voice conversation after an upgrade.

The current prompt asks the agent to read the current encounter for identity questions, use confirmed names rather than reciting the entire profile list, and open the on-screen choices if confirmation is missing. This is patient-confirmed context, not automatic face recognition.

## Limits and retention

- Each Thread-created voice agent requires signed URLs, allows one concurrent conversation, limits conversations to 15 minutes, and limits starts to 20 per day. The local service also caps signed-URL attempts at 20 per UTC day. ElevenLabs billing is separate from the OpenAI call budget.
- The agent is configured with audio recording off and one-day provider transcript retention, with audio/transcript deletion requested. Verify your account's actual contractual/data-retention settings before using personal care records. Existing agents keep their own privacy configuration, which **Test connection** reads back.
- Thread does not save raw microphone audio. Saving transcript text in the local diary is separately opt-in for each session. Assistant replies can be inspected in session captions/history, but are excluded from diary retrieval evidence and recaps.
- Stop/pause/navigation end the client conversation. Camera tracks stop when the page is hidden. The backend rejects tools for paused, expired or disconnected diary sessions.
- Provider/network/permission failures are shown. No browser voice or canned response silently replaces a failed ElevenLabs call.

## Verified and unverified

The automated SDK contract test exercises the real SDK serializer against a controlled transport: agent creation, authentication, client tools, privacy settings and signed URL shape. This is not a live-provider or microphone quality test. See `feature-status.md` for the current live check result.

Official references: [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react), [agent authentication](https://elevenlabs.io/docs/eleven-agents/customization/authentication), [create agent](https://elevenlabs.io/docs/api-reference/agents/create), [signed URLs](https://elevenlabs.io/docs/api-reference/conversations/get-signed-url).
