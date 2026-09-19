import { useEffect, useState } from "react";
import { Mic, CheckCircle2, ExternalLink } from "lucide-react";
import { api } from "./api";
export function VoiceSettings({ notify }: { notify: (s: string) => void }) {
  const [status, setStatus] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [create, setCreate] = useState(true),
    [verified, setVerified] = useState(false);
  async function load() {
    setStatus(await api("/api/v1/voice/status"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <section className="card voice-settings">
      <div className="section-head">
        <h3>
          <Mic size={20} />
          ElevenLabs live voice
        </h3>
        <span className={"tag " + (status?.configured ? "live" : "")}>
          {status?.configured ? "Configured" : "Needs setup"}
        </span>
      </div>
      <p>
        A real-time voice conversation with interruption, camera context, and
        diary retrieval. Audio streams directly to ElevenLabs through its
        official SDK.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {verified && (
        <p className="success">
          <CheckCircle2 size={17} />
          ElevenLabs agent verified
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form),
            key = String(f.get("key") || "");
          (form.elements.namedItem("key") as HTMLInputElement).value = "";
          setBusy(true);
          setError("");
          try {
            const result = await api("/api/v1/voice/connect", {
              ...(key ? { apiKey: key } : {}),
              agentId: f.get("agentId") || undefined,
              voiceId: f.get("voiceId") || undefined,
              createAgent: create,
            });
            setVerified(true);
            await load();
            notify(
              result.created
                ? "A private Thread voice agent was created in your ElevenLabs account."
                : "ElevenLabs agent connected.",
            );
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          ElevenLabs API key
          <input
            type="password"
            name="key"
            autoComplete="off"
            maxLength={512}
            placeholder="Enter your key, or use the server environment"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={create}
            onChange={(e) => setCreate(e.target.checked)}
          />
          Create a private Thread voice agent with the required tools
        </label>
        {create ? (
          <label>
            Voice ID (optional)
            <input
              name="voiceId"
              maxLength={150}
              placeholder="Leave blank for the account default voice"
            />
          </label>
        ) : (
          <label>
            Existing Thread agent ID
            <input
              name="agentId"
              required
              maxLength={150}
              placeholder="agent_…"
            />
          </label>
        )}
        <p className="fine">
          Creating an agent adds a configuration to your ElevenLabs account.
          Conversations use ElevenLabs billing. Your key stays encrypted on this
          server; the browser receives a temporary signed URL.
        </p>
        <button className="primary" disabled={busy}>
          {busy
            ? "Connecting…"
            : create
              ? "Connect & create voice agent"
              : "Connect existing agent"}
        </button>
      </form>
      {status?.configured && (
        <div className="voice-connected">
          <small>
            Agent {status.agentId} · {status.source}
          </small>
          <div className="button-row">
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api("/api/v1/voice/sync", {});
                  notify(
                    "Thread instructions are up to date. Stop and restart voice to use them.",
                  );
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Update Thread instructions
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await api("/api/v1/voice/test", {});
                  setVerified(result.verified);
                  notify(
                    "Agent configuration was read successfully. Start Talk in the patient view to test live audio.",
                  );
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Test connection
            </button>
            <button
              className="text-button"
              onClick={async () => {
                await api("/api/v1/voice/disconnect", {});
                setVerified(false);
                await load();
                notify(
                  "Saved server connection removed. Environment configuration, if present, remains. The remote agent was not deleted.",
                );
              }}
            >
              Disconnect saved key
            </button>
          </div>
        </div>
      )}
      <p className="fine">
        Thread-created agents require signed sessions, allow interruption,
        disable stored audio, and request one-day provider transcript retention.
        Each voice conversation is limited to 15 minutes, with 20 starts per
        day. Local diary retention is a separate choice. Thread updates its
        encounter instructions on the next voice connection while preserving
        your agent’s voice and model settings.
      </p>
      <a
        className="text-button"
        href="https://elevenlabs.io/app/agents"
        target="_blank"
        rel="noreferrer"
      >
        Open ElevenLabs agents <ExternalLink size={14} />
      </a>
    </section>
  );
}
