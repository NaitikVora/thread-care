import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  History,
  LoaderCircle,
  MessageCircle,
  ThumbsUp,
  X,
} from "lucide-react";
import type { Result } from "./types";
import type { AgentAction } from "../../../packages/agent/src/index";
import { api, stamp } from "./api";
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">
        <MessageCircle size={24} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Busy({ cancel }: { cancel: () => void }) {
  return (
    <div className="thinking" role="status">
      <LoaderCircle className="spin" size={18} />
      <span>Thread is working…</span>
      <button className="text-button" onClick={cancel}>
        Cancel
      </button>
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="section-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ResultCard({
  result,
  onApply,
  notify,
}: {
  result: Result | null;
  onApply: (index: number, edited?: AgentAction) => Promise<boolean>;
  notify: (text: string) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null),
    [title, setTitle] = useState(""),
    [steps, setSteps] = useState(""),
    [feedback, setFeedback] = useState(false),
    [correction, setCorrection] = useState(""),
    [rated, setRated] = useState("");
  if (!result) return null;
  async function rate(rating: string) {
    try {
      await api("/api/v1/agent/" + result!.id + "/feedback", {
        rating,
        correction,
      });
      setRated(rating);
      setFeedback(false);
      notify("Feedback saved for review. No model training was started.");
    } catch (e: any) {
      notify(e.message);
    }
  }
  function describe(a: AgentAction) {
    switch (a.type) {
      case "intention":
        return "Remember: " + a.text;
      case "object":
        return a.name + " — " + a.location;
      case "routine-create":
        return a.title + " · " + a.steps.length + " steps";
      case "reminder-create":
        return a.title + " · " + stamp(a.dueAt);
      case "next":
        return "Confirm that the current step is complete";
      case "help":
        return "Create a request in the local care circle";
      default:
        return a.type.replaceAll("-", " ") + " routine";
    }
  }
  return (
    <section className="answer-card" aria-label="Thread answer">
      <div className="answer-label">
        <span className="orb small">t</span>
        <strong>
          {result.mode === "live"
            ? "Thread’s answer"
            : "From your saved records"}
        </strong>
        <span className="tag">
          {result.mode === "live" ? "Live AI" : "Basic mode"}
        </span>
      </div>
      <p className="answer-text">{result.reply}</p>
      {result.stale && (
        <p className="notice">
          Your records changed while Thread was replying. Ask again for an
          up-to-date suggestion.
        </p>
      )}
      {result.sources.length > 0 && (
        <details className="sources">
          <summary>
            {result.sources.length} reference{" "}
            {result.sources.length === 1 ? "note" : "notes"} supplied to the
            answer
          </summary>
          {result.sources.map((s) => (
            <article key={s.id}>
              <strong>{s.title}</strong>
              {s.content && <p>{s.content}</p>}
              <small>
                {s.author} · recorded/reviewed{" "}
                {s.updatedAt ? stamp(s.updatedAt) : "previously"} · version{" "}
                {s.revision}
              </small>
            </article>
          ))}
        </details>
      )}
      {!!result.actions.length && (
        <div className="proposals">
          <span className="eyebrow">FOR YOUR REVIEW</span>
          {result.actions.map((a, i) => (
            <div className="proposal" key={i}>
              <p>{describe(a)}</p>
              {result.applied?.includes(i) ? (
                <span className="success">
                  <Check size={16} />
                  Applied
                </span>
              ) : (
                <button
                  className="primary compact"
                  onClick={() => {
                    if (a.type === "routine-create") {
                      setEditing(i);
                      setTitle(a.title);
                      setSteps(a.steps.join("\n"));
                    } else onApply(i);
                  }}
                >
                  {a.type === "routine-create"
                    ? "Review steps"
                    : a.type === "next"
                      ? "I have done this"
                      : "Confirm"}
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <details className="trace">
        <summary>
          <History size={14} />
          What Thread did
        </summary>
        {result.trace.map((t, i) => (
          <p key={i}>
            <span className="trace-dot" />
            {t.detail}
          </p>
        ))}
      </details>
      <div className="answer-feedback">
        <button className="text-button" onClick={() => rate("helpful")}>
          <ThumbsUp size={14} />
          {rated === "helpful" ? "Saved as helpful" : "Helpful"}
        </button>
        <button className="text-button" onClick={() => setFeedback(!feedback)}>
          Suggest a correction
        </button>
      </div>
      {feedback && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            rate("needs-correction");
          }}
        >
          <label>
            What should Thread have said?
            <textarea
              required
              maxLength={2000}
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
            />
          </label>
          <button className="secondary" type="submit">
            Save for evaluation
          </button>
          <p className="fine">
            This records feedback. Correct the original household note in Teach
            Thread if needed.
          </p>
        </form>
      )}
      {editing !== null && (
        <Modal
          title="Make this routine familiar"
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await onApply(editing, {
                  type: "routine-create",
                  title,
                  steps: steps
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              )
                setEditing(null);
            }}
          >
            <label>
              Routine title
              <input
                required
                maxLength={60}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              One step per line
              <textarea
                required
                rows={8}
                maxLength={2200}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
              />
            </label>
            <p className="fine">Up to 12 steps, 180 characters each.</p>
            <button className="primary" type="submit">
              Save reviewed routine
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
