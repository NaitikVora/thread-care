import { useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  Database,
  Download,
  CheckCircle2,
} from "lucide-react";
import type { AIStatus, Preferences, Mutate } from "./types";
import { api } from "./api";
import { VoiceSettings } from "./VoiceSettings";
export function Settings({
  status,
  preferences,
  mutate,
  refresh,
  notify,
  storage,
  revision,
  budget,
}: {
  status: AIStatus;
  preferences: Preferences;
  mutate: Mutate;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
  storage: string;
  revision: number;
  budget: { used: number; limit: number };
}) {
  const [busy, setBusy] = useState(false),
    [verified, setVerified] = useState(false),
    [error, setError] = useState("");
  async function connect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form),
      apiKey = String(f.get("key"));
    (form.elements.namedItem("key") as HTMLInputElement).value = "";
    setBusy(true);
    setError("");
    try {
      await api("/api/connect", { apiKey, model: f.get("model") });
      setVerified(true);
      await refresh();
      notify("OpenAI connection tested successfully.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">YOUR COMPANION, YOUR CHOICES</span>
        <h2>A little more personal.</h2>
        <p>Choose how Thread listens, responds, and remembers.</p>
      </div>
      <div className="settings-grid">
        <section className="card">
          <div className="section-head">
            <h3>
              <KeyRound size={20} /> AI connection
            </h3>
            <span className={"tag " + (status.configured ? "live" : "")}>
              {status.configured ? "Key configured" : "Not connected"}
            </span>
          </div>
          <p className="fine">
            Daily AI calls: {budget.used} / {budget.limit}. Resets at midnight
            UTC. Each question uses at most three model turns; this is a call
            cap, not a dollar estimate.
          </p>
          <p>
            Connect your OpenAI key for natural conversation, photo questions,
            and reviewed routine drafts.
          </p>
          {verified && (
            <p className="success">
              <CheckCircle2 size={17} />
              Connection tested successfully
            </p>
          )}
          <form onSubmit={connect}>
            <label>
              OpenAI API key
              <input
                type="password"
                name="key"
                required
                autoComplete="off"
                placeholder="sk-…"
                maxLength={512}
              />
            </label>
            <label>
              Model
              <input
                name="model"
                required
                defaultValue={status.model}
                maxLength={100}
              />
            </label>
            <p className="fine">
              Choose a model supporting Responses, tool calling, structured
              output, and images. Tests and requests use your API billing.
            </p>
            <button className="primary" disabled={busy}>
              {busy ? "Testing connection…" : "Connect & test"}
            </button>
          </form>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="button-row">
            {status.configured && (
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await api("/api/test", {});
                    setVerified(true);
                    notify("OpenAI responded successfully.");
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Test connection
              </button>
            )}
            {status.source === "session" && (
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  try {
                    await api("/api/disconnect", {});
                    setVerified(false);
                    await refresh();
                    notify(
                      "Session key removed. A server environment key, if configured, remains available.",
                    );
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              >
                Disconnect session key
              </button>
            )}
          </div>
          <p className="fine">
            Keys entered here are encrypted in a one-hour HttpOnly session
            cookie. They are never saved in browser storage. A server
            environment key can also be configured.
          </p>
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-button"
          >
            Manage OpenAI API keys ↗
          </a>
        </section>
        <VoiceSettings notify={notify} />
        <section className="card">
          <div className="section-head">
            <h3>
              <ShieldCheck size={20} />
              Gentle support
            </h3>
          </div>
          <form
            key={JSON.stringify(preferences)}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              mutate(
                "/api/v1/preferences",
                {
                  preferences: {
                    proactive: f.get("proactive") === "on",
                    quietStart: Number(f.get("quietStart")),
                    quietEnd: Number(f.get("quietEnd")),
                    speechRate: Number(f.get("speechRate")),
                    retentionDays: Number(f.get("retentionDays")),
                  },
                },
                "Your preferences were saved.",
              );
            }}
          >
            <label className="checkbox">
              <input
                type="checkbox"
                name="proactive"
                defaultChecked={preferences.proactive}
              />
              Offer gentle suggestions when a routine is paused or a visit is
              approaching
            </label>
            <div className="two-columns">
              <label>
                Quiet hours begin
                <select name="quietStart" defaultValue={preferences.quietStart}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quiet hours end
                <select name="quietEnd" defaultValue={preferences.quietEnd}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Speech pace
              <select name="speechRate" defaultValue={preferences.speechRate}>
                <option value="0.7">Slower</option>
                <option value="0.88">Gentle</option>
                <option value="1">Standard</option>
                <option value="1.15">Faster</option>
              </select>
            </label>
            <label>
              Keep AI requests and evaluation feedback for
              <select
                name="retentionDays"
                defaultValue={preferences.retentionDays}
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">365 days</option>
              </select>
            </label>
            <p className="fine">
              Knowledge and reviewed photos stay until you delete them. Raw
              microphone audio and video are not retained by Thread. Diary image
              and transcript retention are chosen separately when starting a
              live session. Quiet hours silence proactive banners and browser
              notifications; reminders remain visible in Care circle.
            </p>
            <button className="primary">Save preferences</button>
          </form>
          <button
            className="text-button"
            onClick={async () => {
              if (!("Notification" in window)) {
                notify(
                  "Browser notifications are not supported. Reminders still appear in the app.",
                );
                return;
              }
              const p = await Notification.requestPermission();
              notify(
                p === "granted"
                  ? "Browser notifications enabled while the app is open."
                  : "Notifications were not enabled. In-app reminders remain available.",
              );
            }}
          >
            Enable browser reminder notifications
          </button>
        </section>
        <section className="card full-row">
          <div className="section-head">
            <h3>
              <Database size={21} />
              Your local workspace
            </h3>
            <span className="tag">{storage}</span>
          </div>
          <p>
            Records live on this computer’s local server. This is one household
            workspace, without remote accounts. The current hosted prototype is
            separate.
          </p>
          <p className="fine">
            When you ask AI, your question, relevant notes, recent conversation,
            and any selected photo are sent to OpenAI. Local hosting does not
            make cloud AI processing local. Live sessions also share microphone
            audio and retrieved text context with ElevenLabs when enabled. No
            Meta glasses are connected.
          </p>
          <div className="button-row">
            <a className="secondary" href="/api/v1/export" download>
              <Download size={17} />
              Export records & evaluations
            </a>
            <a className="secondary" href="/api/v1/dataset/export" download>
              Export reviewed photos
            </a>
            {revision === 0 && (
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    const raw = localStorage.getItem("thread-care:v1");
                    if (!raw) {
                      notify(
                        "No earlier Thread records were found in this browser origin.",
                      );
                      return;
                    }
                    if (
                      confirm(
                        "Import your earlier browser prototype records into this local workspace?",
                      )
                    )
                      await mutate(
                        "/api/v1/import",
                        { state: JSON.parse(raw) },
                        "Earlier records imported.",
                      );
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                Import earlier browser records
              </button>
            )}
          </div>
          <div className="privacy-delete">
            <div>
              <strong>Clear this workspace</strong>
              <p>
                Delete notes, images, reminders, conversations, and evaluation
                history. Restore the fictional sample profile.
              </p>
            </div>
            <button
              className="danger-button"
              onClick={async () => {
                if (
                  !confirm(
                    "Permanently delete all records and retained photos in this local workspace? Export first if you need a copy.",
                  )
                )
                  return;
                try {
                  await api("/api/v1/privacy/clear", {});
                  localStorage.removeItem("thread-care:v1");
                  await refresh();
                  notify(
                    "Local records cleared. The sample profile is restored.",
                  );
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              Delete local records
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
