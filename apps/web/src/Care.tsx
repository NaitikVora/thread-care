import { useState } from "react";
import { CalendarDays, Plus, Heart, Clock, Check } from "lucide-react";
import type { State } from "../../../packages/contracts/src/index";
import type { Ask, Mutate, Reminder, Result } from "./types";
import type { AgentAction } from "../../../packages/agent/src/index";
import { Modal, ResultCard } from "./components";
import { stamp, timezone } from "./api";
const localDate = (s: string) =>
  s
    ? new Date(Date.parse(s) - new Date(s).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
export function Care({
  state,
  reminders,
  mutate,
  ask,
  result,
  onApply,
  notify,
  busy,
}: {
  state: State;
  reminders: Reminder[];
  mutate: Mutate;
  ask: Ask;
  result: Result | null;
  onApply: (i: number, a?: AgentAction) => Promise<boolean>;
  notify: (s: string) => void;
  busy: boolean;
}) {
  const [routine, setRoutine] = useState(false),
    [editRoutine, setEditRoutine] = useState<string | null>(null),
    [draft, setDraft] = useState(""),
    [reminder, setReminder] = useState(false),
    [message, setMessage] = useState("");
  const r = state.routines.find((x) => x.id === editRoutine);
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">SUPPORT THAT STAYS HUMAN</span>
        <h2>Your people. Your familiar rhythm.</h2>
        <p>Keep everyday plans and reassuring words close at hand.</p>
      </div>
      <div className="care-grid">
        <section className="card">
          <div className="section-head">
            <h3>A familiar face</h3>
            <Heart size={21} />
          </div>
          <form
            key={JSON.stringify(state.profile)}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              mutate(
                "/api/v1/action",
                {
                  action: {
                    type: "profile",
                    name: f.get("name"),
                    caregiver: f.get("caregiver"),
                    visitAt: f.get("visit")
                      ? new Date(String(f.get("visit"))).toISOString()
                      : "",
                    reassurance: f.get("reassurance"),
                  },
                },
                "Care details saved.",
              );
            }}
          >
            <div className="two-columns">
              <label>
                Companion’s name
                <input
                  name="name"
                  required
                  maxLength={60}
                  defaultValue={state.profile.name}
                />
              </label>
              <label>
                Caregiver’s name
                <input
                  name="caregiver"
                  required
                  maxLength={60}
                  defaultValue={state.profile.caregiver}
                />
              </label>
            </div>
            <label>
              Next planned visit
              <input
                type="datetime-local"
                name="visit"
                defaultValue={localDate(state.profile.visitAt)}
              />
            </label>
            <label>
              A reassuring message
              <textarea
                name="reassurance"
                defaultValue={state.profile.reassurance}
                maxLength={400}
                placeholder="A familiar message, in your own words."
              />
            </label>
            <button type="submit" className="primary">
              Save care details
            </button>
          </form>
        </section>
        <section className="card">
          <div className="section-head">
            <h3>A little help</h3>
            <span className="tag">Local care circle</span>
          </div>
          <p className="fine">
            Requests are saved on this local server. No external messages or
            calls are sent.
          </p>
          {state.requests.length ? (
            state.requests.map((r) => (
              <article className="request" key={r.id}>
                <div className="section-head">
                  <strong>
                    {r.status === "open"
                      ? "Needs attention"
                      : r.status === "acknowledged"
                        ? "Acknowledged"
                        : "Resolved"}
                  </strong>
                  <small>{stamp(r.at)}</small>
                </div>
                <p>{r.context}</p>
                {r.status !== "resolved" && (
                  <button
                    className="secondary compact"
                    onClick={() =>
                      mutate(
                        "/api/v1/action",
                        {
                          action: {
                            type: "request-status",
                            id: r.id,
                            status:
                              r.status === "open" ? "acknowledged" : "resolved",
                          },
                        },
                        "Request updated.",
                      )
                    }
                  >
                    {r.status === "open" ? "Acknowledge" : "Mark resolved"}
                  </button>
                )}
              </article>
            ))
          ) : (
            <div className="gentle-empty">
              <Heart size={30} />
              <p>No help requests right now.</p>
            </div>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              ask(
                "Summarize only recorded activities and unresolved local help requests. Identify any missing information.",
                "summary",
              )
            }
          >
            Prepare a caregiver handoff
          </button>
        </section>
        <section className="card full-row">
          <div className="section-head">
            <div>
              <span className="eyebrow">ONE THING AT A TIME</span>
              <h3>Make a routine familiar</h3>
            </div>
            <button className="secondary" onClick={() => setRoutine(true)}>
              <Plus size={17} />
              Create routine
            </button>
          </div>
          <div className="routine-edit-list">
            {state.routines.map((r) => (
              <button
                key={r.id}
                className="routine-row"
                onClick={() => setEditRoutine(r.id)}
              >
                <span>
                  <strong>{r.title}</strong>
                  <small>{r.steps.length} steps</small>
                </span>
                <span>Edit steps →</span>
              </button>
            ))}
          </div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft, "routine");
            }}
          >
            <label>
              Or describe a routine for Thread to draft
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                required
                maxLength={1000}
                placeholder="Get ready for a visit: cardigan, photo album, living room…"
              />
            </label>
            <button className="primary" disabled={busy}>
              Draft with AI
            </button>
          </form>
        </section>
        <section className="card">
          <div className="section-head">
            <h3>
              <Clock size={20} /> Gentle reminders
            </h3>
            <button
              className="secondary compact"
              onClick={() => setReminder(true)}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <p className="fine">
            Schedules survive restarts. Delivery requires the local server to be
            running; overdue reminders appear when it starts again.
          </p>
          {reminders.length ? (
            reminders.map((r) => (
              <article className="reminder" key={r.id}>
                <div>
                  <strong>{r.title}</strong>
                  <small>
                    {stamp(r.dueAt)} · {r.timezone}
                  </small>
                </div>
                <span className={"tag " + (r.status === "due" ? "due" : "")}>
                  {r.status}
                </span>
                <div className="button-row">
                  {r.status !== "acknowledged" && (
                    <>
                      <button
                        className="text-button"
                        onClick={() =>
                          mutate(
                            "/api/v1/reminders/" + r.id,
                            { operation: "acknowledge" },
                            "Reminder acknowledged.",
                          )
                        }
                      >
                        <Check size={14} />
                        Done
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          mutate(
                            "/api/v1/reminders/" + r.id,
                            { operation: "snooze" },
                            "Snoozed for 10 minutes.",
                          )
                        }
                      >
                        Snooze 10 min
                      </button>
                    </>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      if (confirm("Delete this reminder?"))
                        mutate("/api/v1/reminders/" + r.id, {
                          operation: "delete",
                        });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="gentle-empty">
              <CalendarDays size={28} />
              <p>No reminders scheduled.</p>
            </div>
          )}
        </section>
        <section className="card">
          <span className="eyebrow">A REASON TO REACH OUT</span>
          <h3>Find the words to connect.</h3>
          <p>
            Draft a message to someone you care about, then share it yourself.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(
                "Draft a short message for my caregiver or family about: " +
                  message +
                  ". Label it a draft; do not send it.",
                "message",
              );
            }}
          >
            <label>
              What would you like to say?
              <textarea
                required
                maxLength={1000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask Maya if we can look at the old holiday photos together."
              />
            </label>
            <button className="secondary" disabled={busy}>
              Help me draft a message
            </button>
          </form>
          <p className="fine">
            Family photos can be kept in Look with me as reviewed reminiscence
            examples.
          </p>
        </section>
      </div>
      <ResultCard result={result} onApply={onApply} notify={notify} />
      {(routine || editRoutine) && (
        <Modal
          title={r ? "Edit familiar steps" : "Create a routine"}
          onClose={() => {
            setRoutine(false);
            setEditRoutine(null);
          }}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                steps = String(f.get("steps"))
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
              if (
                await mutate(
                  "/api/v1/action",
                  {
                    action: r
                      ? { type: "routine-edit", id: r.id, steps }
                      : {
                          type: "routine-create",
                          title: f.get("title"),
                          steps,
                        },
                  },
                  "Routine saved.",
                )
              ) {
                setRoutine(false);
                setEditRoutine(null);
              }
            }}
          >
            {!r && (
              <label>
                Title
                <input name="title" required maxLength={60} />
              </label>
            )}
            <label>
              Steps · one per line
              <textarea
                name="steps"
                defaultValue={r?.steps.join("\n")}
                required
                rows={8}
                maxLength={2200}
              />
            </label>
            <p className="fine">
              1–12 steps, up to 180 characters each. Finish an active routine
              before editing its steps.
            </p>
            <button className="primary">Save routine</button>
          </form>
        </Modal>
      )}
      {reminder && (
        <Modal title="A gentle reminder" onClose={() => setReminder(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await mutate(
                  "/api/v1/reminders",
                  {
                    reminder: {
                      title: f.get("title"),
                      dueAt: new Date(String(f.get("dueAt"))).toISOString(),
                      timezone: timezone(),
                    },
                  },
                  "Reminder scheduled.",
                )
              )
                setReminder(false);
            }}
          >
            <label>
              Remind me to…
              <input name="title" required maxLength={140} />
            </label>
            <label>
              When
              <input type="datetime-local" name="dueAt" required />
            </label>
            <p className="fine">
              Time zone: {timezone()}. You can snooze this later.
            </p>
            <button className="primary">Schedule reminder</button>
          </form>
        </Modal>
      )}
    </>
  );
}
