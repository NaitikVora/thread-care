import { useState } from "react";
import { BookOpen, Plus, Search, ArrowUpRight, Pencil } from "lucide-react";
import type { Ask, Knowledge as Note, Mutate, Result } from "./types";
import type { AgentAction } from "../../../packages/agent/src/index";
import { stamp, api } from "./api";
import { Modal, Empty, ResultCard } from "./components";
export function Knowledge({
  notes,
  mutate,
  ask,
  result,
  onApply,
  notify,
  busy,
}: {
  notes: Note[];
  mutate: Mutate;
  ask: Ask;
  result: Result | null;
  onApply: (i: number, a?: AgentAction) => Promise<boolean>;
  notify: (s: string) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState<Note | null>(null),
    [adding, setAdding] = useState(false),
    [query, setQuery] = useState(""),
    [test, setTest] = useState(""),
    [history, setHistory] = useState<any[] | null>(null),
    [title, setTitle] = useState("");
  const filtered = notes.filter((n) =>
    (n.title + " " + n.content + " " + n.tags.join(" "))
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const conflicts = notes.filter(
    (n) =>
      n.id !== editing?.id &&
      n.title.trim().toLowerCase() === title.trim().toLowerCase(),
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const saved = await mutate(
      "/api/v1/knowledge",
      {
        note: {
          kind: f.get("kind"),
          title: f.get("title"),
          content: f.get("content"),
          author: f.get("author"),
          tags: String(f.get("tags"))
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
        ...(editing ? { id: editing.id, noteRevision: editing.revision } : {}),
      },
      "Knowledge saved. Thread can retrieve it now.",
    );
    if (saved) {
      setAdding(false);
      setEditing(null);
    }
  }
  return (
    <>
      <div className="page-intro intro-row">
        <div>
          <span className="eyebrow">FAMILIAR KNOWLEDGE, IN YOUR WORDS</span>
          <h2>Help Thread know your world.</h2>
          <p>
            Teach the details that make support feel personal. You can always
            correct them.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setAdding(true);
            setTitle("");
          }}
        >
          <Plus size={18} />
          Teach something
        </button>
      </div>
      <div className="knowledge-layout">
        <section>
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="Search knowledge"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a note, object, or preference…"
            />
          </div>
          <div className="knowledge-list">
            {filtered.map((n) => (
              <article className="card knowledge-card" key={n.id}>
                <div className="section-head">
                  <span className={"tag kind-" + n.kind}>{n.kind}</span>
                  <button
                    className="icon-button"
                    aria-label={"Edit " + n.title}
                    onClick={() => {
                      setEditing(n);
                      setTitle(n.title);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <h3>{n.title}</h3>
                <p className="preserve-lines">{n.content}</p>
                {notes.some(
                  (o) =>
                    o.id !== n.id &&
                    o.title.toLowerCase() === n.title.toLowerCase(),
                ) && (
                  <p className="conflict">
                    Another note has this title. Review both sources if they
                    disagree.
                  </p>
                )}
                <div className="note-tags">
                  {n.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <footer>
                  <span>
                    {n.author} · {stamp(n.updatedAt)}
                    <br />
                    Version {n.revision}
                  </span>
                  <div className="button-row">
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          setHistory(
                            await api("/api/v1/knowledge/" + n.id + "/history"),
                          );
                        } catch (e: any) {
                          notify(e.message);
                        }
                      }}
                    >
                      History
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (
                          confirm(
                            "Delete this note and its correction history?",
                          )
                        )
                          mutate(
                            "/api/v1/knowledge/" + n.id + "/delete",
                            {},
                            "Note deleted.",
                          );
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <Empty
              title={
                notes.length
                  ? "No matching notes"
                  : "Start with one familiar detail"
              }
            >
              Add where an object belongs, a preferred activity, or a comforting
              phrase. These notes become Thread’s reference material.
            </Empty>
          )}
        </section>
        <aside className="card teach-test">
          <span className="eyebrow">TEST THREAD</span>
          <h3>A little knowledge goes a long way.</h3>
          <p>Ask a question and inspect the notes supplied to the answer.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(test, "test");
            }}
          >
            <label>
              Try a question
              <textarea
                value={test}
                required
                maxLength={2000}
                onChange={(e) => setTest(e.target.value)}
                placeholder="Where do we keep the spare keys?"
              />
            </label>
            <button className="primary full" disabled={busy}>
              Ask Thread
              <ArrowUpRight size={18} />
            </button>
          </form>
          <div className="teaching-note">
            <BookOpen size={22} />
            <strong>Personalization starts here.</strong>
            <p>
              Saved knowledge is retrieved when relevant. It does not retrain
              the AI model. Corrections help you evaluate future answers.
            </p>
          </div>
          <ResultCard result={result} onApply={onApply} notify={notify} />
        </aside>
      </div>
      {(adding || editing) && (
        <Modal
          title={
            editing ? "Correct a familiar detail" : "Teach Thread something"
          }
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        >
          <form onSubmit={submit}>
            <label>
              Kind
              <select name="kind" defaultValue={editing?.kind || "fact"}>
                <option value="fact">Household fact</option>
                <option value="preference">Preference</option>
                <option value="object">Object / location</option>
                <option value="person">Familiar person</option>
              </select>
            </label>
            <label>
              Title
              <input
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                required
                placeholder="Where the spare keys belong"
              />
            </label>
            {!!conflicts.length && (
              <p className="conflict">
                A note with this title already exists. This will keep both
                notes; edit the existing one if this is a correction.
              </p>
            )}
            <label>
              What should Thread know?
              <textarea
                name="content"
                defaultValue={editing?.content}
                required
                maxLength={2000}
                rows={4}
                placeholder="The spare keys are in the blue bowl by the front door. This was checked today."
              />
            </label>
            <label>
              Source / author
              <input
                name="author"
                defaultValue={editing?.author || "Caregiver"}
                required
                maxLength={60}
              />
            </label>
            <label>
              Tags, separated by commas
              <input
                name="tags"
                defaultValue={editing?.tags.join(", ")}
                placeholder="keys, hallway"
                maxLength={400}
              />
            </label>
            <p className="fine">
              Relevant notes are shared with OpenAI when you ask an AI question.
              Use fictional details while evaluating.
            </p>
            <button className="primary" type="submit">
              {editing ? "Save correction" : "Save knowledge"}
            </button>
          </form>
        </Modal>
      )}
      {history && (
        <Modal title="Correction history" onClose={() => setHistory(null)}>
          {history.length ? (
            history.map((h) => (
              <article className="history-item" key={h.note.revision}>
                <strong>
                  Version {h.note.revision} · {h.note.author}
                </strong>
                <p>{h.note.content}</p>
                <small>Changed {stamp(h.changedAt)}</small>
              </article>
            ))
          ) : (
            <p>This note has no earlier versions.</p>
          )}
        </Modal>
      )}
    </>
  );
}
