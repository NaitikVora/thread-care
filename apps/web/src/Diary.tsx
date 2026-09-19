import { useEffect, useState } from "react";
import {
  BookOpen,
  Search,
  Sun,
  Check,
  Camera,
  Mic,
  Heart,
  Plus,
  Download,
  Sparkles,
  Pencil,
  Trash2,
} from "lucide-react";
import { api, stamp, timezone } from "./api";
import { Modal } from "./components";
import type {
  DiaryEvent,
  DiarySession,
} from "../../../packages/contracts/src/diary";
const today = () => {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};
export function Diary({ notify }: { notify: (s: string) => void }) {
  const [day, setDay] = useState(today()),
    [query, setQuery] = useState(""),
    [events, setEvents] = useState<DiaryEvent[]>([]),
    [sessions, setSessions] = useState<DiarySession[]>([]),
    [category, setCategory] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState<DiaryEvent | null>(null),
    [note, setNote] = useState(false),
    [summary, setSummary] = useState<any>(null),
    [summaryBusy, setSummaryBusy] = useState(false),
    [history, setHistory] = useState<any[] | null>(null);
  async function load(q = query) {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        day,
        timezone: timezone(),
        q,
        limit: "200",
        ...(category ? { category } : {}),
      });
      const data = await api("/api/v1/diary?" + params);
      setEvents(data.events);
      setSessions(data.sessions);
      setSummary(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [day, category]);
  const confirmed = events.filter((e) => e.review !== "unreviewed"),
    objects = events.filter((e) => e.category === "objects"),
    connection = events.filter((e) => e.category === "connection");
  async function recap() {
    setSummaryBusy(true);
    setError("");
    try {
      setSummary(
        await api("/api/v1/diary/summary", { day, timezone: timezone() }),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSummaryBusy(false);
    }
  }
  return (
    <>
      <div className="page-intro intro-row">
        <div>
          <span className="eyebrow">THE LITTLE THINGS, REMEMBERED</span>
          <h2>Your day has a story.</h2>
          <p>
            A diary of moments you chose to keep. Search, correct, and return to
            them.
          </p>
        </div>
        <button className="primary" onClick={() => setNote(true)}>
          <Plus size={18} />
          Add a moment
        </button>
      </div>
      <form
        className="diary-toolbar card"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <label>
          Day
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            required
          />
        </label>
        <label className="diary-search">
          Search this day
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keys, garden, tea, Maya…"
            maxLength={300}
          />
        </label>
        <label>
          Show
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All moments</option>
            <option value="objects">Objects</option>
            <option value="reading">Reading</option>
            <option value="activity">Activity</option>
            <option value="connection">Connection</option>
            <option value="place">Places</option>
            <option value="moment">Notes & moments</option>
            <option value="conversation">What you said</option>
          </select>
        </label>
        <button className="secondary" disabled={busy}>
          <Search size={18} />
          Search
        </button>
      </form>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <div className="diary-stats">
        <article>
          <span className="stat-icon">
            <BookOpen />
          </span>
          <strong>{events.length}</strong>
          <span>recorded moments</span>
        </article>
        <article>
          <span className="stat-icon">
            <Check />
          </span>
          <strong>{confirmed.length}</strong>
          <span>reviewed by a person</span>
        </article>
        <article>
          <span className="stat-icon">
            <Camera />
          </span>
          <strong>{objects.length}</strong>
          <span>object observations</span>
        </article>
        <article>
          <span className="stat-icon">
            <Heart />
          </span>
          <strong>{connection.length}</strong>
          <span>connection moments</span>
        </article>
      </div>
      <div className="diary-layout">
        <section className="card timeline-card">
          <div className="section-head">
            <h3>Moments from {day === today() ? "today" : day}</h3>
            <a className="text-button" href="/api/v1/export" download>
              <Download size={15} />
              Export diary
            </a>
          </div>
          <p className="fine">
            {timezone()} · Unconfirmed camera observations are descriptions, not
            proof that you completed an activity.
          </p>
          {busy && <p>Opening your diary…</p>}
          {!busy && !events.length && (
            <div className="empty">
              <Sun size={38} />
              <h3>A little room for today.</h3>
              <p>
                {query
                  ? "No matching records. Try a different word or day."
                  : "Start a live session or add a note. No moments are invented to fill the gaps."}
              </p>
            </div>
          )}
          {events.map((e) => (
            <article className="diary-moment" key={e.id} id={"moment-" + e.id}>
              <div className="timeline-marker">
                {e.kind === "camera" ? (
                  <Camera size={18} />
                ) : e.kind === "person" ? (
                  <Heart size={18} />
                ) : e.kind === "conversation" ? (
                  <Mic size={18} />
                ) : (
                  <BookOpen size={18} />
                )}
              </div>
              <div className="moment-body">
                <div className="section-head">
                  <time>
                    {new Date(e.capturedAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  <span
                    className={
                      "tag " + (e.review !== "unreviewed" ? "live" : "")
                    }
                  >
                    {e.review === "unreviewed"
                      ? "Unconfirmed observation"
                      : e.review === "corrected"
                        ? "Corrected"
                        : "Confirmed"}
                  </span>
                </div>
                <h3>{e.title}</h3>
                {e.hasImage && (
                  <img
                    className="moment-photo"
                    loading="lazy"
                    src={"/api/v1/diary/" + e.id + "/image"}
                    alt={"Retained source for " + e.title}
                  />
                )}
                <p>{e.summary}</p>
                {e.details.uncertainty && (
                  <p className="fine">Uncertainty: {e.details.uncertainty}</p>
                )}
                {e.details.visibleText && (
                  <details>
                    <summary>Text seen in the image</summary>
                    <p>{e.details.visibleText}</p>
                  </details>
                )}
                <div className="moment-tags">
                  {e.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <small>
                  {e.kind === "camera"
                    ? "OpenAI camera observation"
                    : e.kind === "person"
                      ? "Patient-confirmed labeled profile"
                      : e.kind === "conversation"
                        ? "Voice transcript"
                        : "User note"}{" "}
                  · retained until {stamp(e.expiresAt)}
                </small>
                <div className="button-row">
                  <button
                    className="text-button"
                    onClick={() => {
                      setReview(e);
                      setHistory(null);
                    }}
                  >
                    <Pencil size={14} />
                    Review or correct
                  </button>
                  <button
                    className="text-button"
                    onClick={async () => {
                      if (
                        !confirm(
                          "Delete this moment and any retained source image?",
                        )
                      )
                        return;
                      try {
                        await api("/api/v1/diary/" + e.id + "/delete", {});
                        await load();
                      } catch (err: any) {
                        notify(err.message);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
        <aside className="diary-side">
          <section className="recap-card">
            <span className="eyebrow">PICK UP THE THREAD</span>
            <h3>A gentle look back.</h3>
            <p>Create a short recap with links to the moments it used.</p>
            <button
              className="primary"
              disabled={summaryBusy || !events.length}
              onClick={recap}
            >
              <Sparkles size={18} />
              {summaryBusy ? "Reading your moments…" : "Create today’s recap"}
            </button>
            {summary && (
              <div className="day-recap">
                <p>{summary.summary}</p>
                {summary.highlights.map((h: any, i: number) => (
                  <article key={i}>
                    <strong>{h.title}</strong>
                    <p>{h.description}</p>
                    <div className="button-row">
                      {h.sourceIds.map((id: string, j: number) => (
                        <a
                          key={id}
                          className="text-button"
                          href={"#moment-" + id}
                          onClick={() => {
                            if (!events.some((e) => e.id === id)) {
                              setQuery("");
                              setCategory("");
                              void load("");
                            }
                          }}
                        >
                          Moment {j + 1} ↗
                        </a>
                      ))}
                    </div>
                  </article>
                ))}
                <small>
                  Based on {summary.recordCount} recorded moments · AI-generated
                  {summary.limited ? " · limited to the latest 200" : ""}
                </small>
              </div>
            )}
          </section>
          <section className="card">
            <h3>What this diary can help with</h3>
            <ul className="use-case-list">
              <li>
                <strong>“Where did I leave it?”</strong>
                <span>
                  Find the last recorded view of an object, with its time.
                </span>
              </li>
              <li>
                <strong>“What was I doing?”</strong>
                <span>
                  Recall your saved intention and the next unconfirmed routine
                  step.
                </span>
              </li>
              <li>
                <strong>“Who spent time with me?”</strong>
                <span>
                  Look back at people you confirmed from familiar profiles.
                </span>
              </li>
              <li>
                <strong>“Tell me about my day.”</strong>
                <span>
                  Revisit recorded moments and reviewed activities together.
                </span>
              </li>
            </ul>
          </section>
          <section className="card">
            <h3>Recording sessions</h3>
            {sessions.slice(0, 8).map((s) => (
              <div className="diary-session" key={s.id}>
                <strong>{s.title}</strong>
                <small>
                  {stamp(s.startedAt)} · {s.status}
                </small>
                <p>
                  {s.status === "interrupted"
                    ? "Recording stopped or the connection was lost. This gap is not filled in."
                    : s.status === "paused"
                      ? "Paused by you or because the page became hidden."
                      : s.status === "active"
                        ? "Session open. Camera and voice indicators show what is actually active."
                        : "Session ended."}
                </p>
              </div>
            ))}
            <p className="fine">
              An open session does not imply that camera or microphone capture
              was continuous.
            </p>
          </section>
        </aside>
      </div>
      {note && (
        <Modal
          title="Keep a moment in your own words"
          onClose={() => setNote(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("/api/v1/diary/note", {
                  id: crypto.randomUUID(),
                  title: f.get("title"),
                  text: f.get("text"),
                });
                setNote(false);
                setDay(today());
                await load();
                notify("Your moment was saved.");
              } catch (err: any) {
                notify(err.message);
              }
            }}
          >
            <label>
              Title
              <input
                name="title"
                required
                maxLength={120}
                placeholder="Tea in the garden"
              />
            </label>
            <label>
              Your words
              <textarea name="text" required maxLength={2000} />
            </label>
            <p className="fine">
              Saved as your confirmed note for 30 days. No AI is needed.
            </p>
            <button className="primary">Save moment</button>
          </form>
        </Modal>
      )}
      {review && (
        <Modal
          title="Make this memory accurate"
          onClose={() => setReview(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("/api/v1/diary/" + review.id + "/review", {
                  revision: review.revision,
                  title: f.get("title"),
                  summary: f.get("summary"),
                  author: f.get("author"),
                });
                setReview(null);
                await load();
                notify(
                  "Review saved. Earlier wording stays in the correction history.",
                );
              } catch (err: any) {
                notify(err.message);
              }
            }}
          >
            <label>
              Title
              <input
                name="title"
                required
                maxLength={120}
                defaultValue={review.title}
              />
            </label>
            <label>
              What actually happened?
              <textarea
                name="summary"
                required
                maxLength={2000}
                defaultValue={review.summary}
              />
            </label>
            <label>
              Reviewed by
              <input
                name="author"
                required
                maxLength={80}
                placeholder="Your name"
              />
            </label>
            <button className="primary">Confirm reviewed moment</button>
          </form>
          <button
            className="text-button"
            onClick={async () =>
              setHistory(await api("/api/v1/diary/" + review.id + "/history"))
            }
          >
            Show correction history
          </button>
          {history && (
            <div>
              {history.length ? (
                history.map((h) => (
                  <article key={h.revision}>
                    <strong>Version {h.revision}</strong>
                    <p>{h.previous.summary}</p>
                    <small>
                      Changed by {h.author} · {stamp(h.changed_at)}
                    </small>
                  </article>
                ))
              ) : (
                <p>No earlier corrections.</p>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
