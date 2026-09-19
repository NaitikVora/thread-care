import { useEffect, useState } from "react";
import { Heart, Plus } from "lucide-react";
import { api, timezone } from "./api";
import { Modal } from "./components";
import type { TrustedPerson } from "../../../packages/contracts/src/diary";
type Day = {
  day: string;
  observations: number;
  independent: number;
  cued: number;
  introduction: number;
};
const localTime = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function RecognitionTracker({
  day,
  version,
  onSaved,
}: {
  day: string;
  version: number;
  onSaved: () => Promise<void>;
}) {
  const [days, setDays] = useState<Day[]>([]),
    [people, setPeople] = useState<TrustedPerson[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setDays([]);
    setError("");
    Promise.all([
      api<{ days: Day[] }>(
        "/api/v1/diary/recognition?" +
          new URLSearchParams({ day, timezone: timezone() }),
      ),
      api<TrustedPerson[]>("/api/v1/people"),
    ])
      .then(([data, profiles]) => {
        if (!cancelled) {
          setDays(data.days);
          setPeople(profiles);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [day, version]);
  const current = days.at(-1),
    maximum = Math.max(1, ...days.map((d) => d.observations));
  return (
    <section
      className="card recognition-card"
      aria-label="Familiar-person recognition tracker"
    >
      <div className="section-head">
        <div>
          <span className="eyebrow">DAILY CONNECTIONS</span>
          <h3>Familiar faces, meaningful moments</h3>
        </div>
        <button
          className="secondary"
          onClick={() => setOpen(true)}
          disabled={!people.length}
        >
          <Plus size={17} /> Log recognition
        </button>
      </div>
      <p className="fine">
        Human-reported observations · {day} · {timezone()}. This is not a health
        or memory test score.
      </p>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <div className="recognition-summary">
        <div className="recognition-total">
          <Heart size={26} />
          <strong>
            {current?.observations ? current.independent + current.cued : "—"}
          </strong>
          <span>familiar people recognized</span>
        </div>
        <div>
          <strong>{current?.observations ? current.independent : "—"}</strong>
          <span>Without a cue</span>
        </div>
        <div>
          <strong>{current?.observations ? current.cued : "—"}</strong>
          <span>After a cue</span>
        </div>
        <div>
          <strong>{current?.observations ? current.introduction : "—"}</strong>
          <span>Needed an introduction</span>
        </div>
      </div>
      <p className="recognition-encouragement" role="status">
        {current?.observations
          ? "Every moment of connection matters. Support is part of the day, too."
          : "No observations recorded for this day. There is no target to meet."}
      </p>
      <div className="section-head">
        <h4>Seven days of connection</h4>
        <span className="fine">Latest observation per person, each day</span>
      </div>
      <div
        className="recognition-chart"
        role="list"
        aria-label="Seven-day recognition history"
      >
        {days.map((d) => (
          <div
            key={d.day}
            role="listitem"
            aria-label={`${d.day}: ${d.observations ? `${d.independent} without a cue, ${d.cued} after a cue, ${d.introduction} needed an introduction` : "no observations"}`}
          >
            <span className="recognition-chart-value">
              {d.observations ? d.independent + d.cued : "—"}
            </span>
            <div className="recognition-bar" aria-hidden="true">
              {d.observations ? (
                <div style={{ height: `${(d.observations / maximum) * 100}%` }}>
                  {d.introduction > 0 && (
                    <span
                      className="recognition-introduction"
                      style={{ flex: d.introduction }}
                    />
                  )}
                  {d.cued > 0 && (
                    <span
                      className="recognition-cued"
                      style={{ flex: d.cued }}
                    />
                  )}
                  {d.independent > 0 && (
                    <span
                      className="recognition-independent"
                      style={{ flex: d.independent }}
                    />
                  )}
                </div>
              ) : (
                <span className="recognition-gap">·</span>
              )}
            </div>
            <small>
              {new Date(d.day + "T12:00:00").toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </small>
          </div>
        ))}
      </div>
      <div className="recognition-legend">
        <span>
          <i className="recognition-independent" />
          Without a cue
        </span>
        <span>
          <i className="recognition-cued" />
          After a cue
        </span>
        <span>
          <i className="recognition-introduction" />
          Introduction
        </span>
        <span>— No observations</span>
      </div>
      <p className="fine">
        Numbers above bars count recognized people. Bar height includes
        introductions. Repeated logs count each person once per day, using their
        latest observation. Existing encounter confirmations do not count. Logs
        are kept for 30 days. Delete an incorrect diary entry and log a
        replacement to correct it.
      </p>
      {!people.length && (
        <p className="fine">
          Add a person in Familiar people to start logging.
        </p>
      )}
      {open && (
        <Modal
          title="Log a recognition moment"
          onClose={() => {
            if (!saving) setOpen(false);
          }}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              const form = new FormData(e.currentTarget);
              setSaving(true);
              setError("");
              try {
                await api("/api/v1/diary/recognition", {
                  id: crypto.randomUUID(),
                  personId: form.get("personId"),
                  outcome: form.get("outcome"),
                  observedBy: form.get("observedBy"),
                  capturedAt: new Date(
                    String(form.get("capturedAt")),
                  ).toISOString(),
                });
                setOpen(false);
                await onSaved();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <p>
              Record a natural interaction. Selecting a labeled photo alone does
              not demonstrate independent recognition.
            </p>
            <label>
              Familiar person
              <select name="personId" required>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.relationship}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What happened?
              <select name="outcome" required defaultValue="">
                <option value="" disabled>
                  Choose an observation
                </option>
                <option value="independent">Recognized without a cue</option>
                <option value="cued">
                  Recognized after a name, photo or voice cue
                </option>
                <option value="introduction">Needed an introduction</option>
              </select>
            </label>
            <label>
              Reported by
              <select name="observedBy" required defaultValue="">
                <option value="" disabled>
                  Choose the source
                </option>
                <option value="caregiver">Caregiver observation</option>
                <option value="patient">Patient report</option>
              </select>
            </label>
            <label>
              When?
              <input
                name="capturedAt"
                type="datetime-local"
                required
                defaultValue={localTime()}
                max={localTime()}
              />
            </label>
            <p className="fine">
              Saved in the diary for 30 days. To correct a classification, log a
              newer observation or delete the mistaken diary entry.
            </p>
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={saving}>
              {saving ? "Saving…" : "Save recognition moment"}
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
