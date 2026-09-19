import { useEffect, useState } from "react";
import { Heart, Plus, Pencil, Trash2 } from "lucide-react";
import { api, stamp } from "./api";
import { readPhoto } from "./browser-camera";
import { Modal } from "./components";
import type { TrustedPerson } from "../../../packages/contracts/src/diary";
export function People({ notify }: { notify: (s: string) => void }) {
  const [people, setPeople] = useState<TrustedPerson[]>([]),
    [edit, setEdit] = useState<TrustedPerson | null>(null),
    [open, setOpen] = useState(false),
    [photo, setPhoto] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    setPeople(await api("/api/v1/people"));
  }
  useEffect(() => {
    load().catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <div className="page-intro intro-row">
        <div>
          <span className="eyebrow">THE PEOPLE WHO MAKE A DAY</span>
          <h2>Familiar people.</h2>
          <p>
            Photos, names, and a few warm details. Connection begins with
            something familiar.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEdit(null);
            setPhoto(null);
            setOpen(true);
          }}
        >
          <Plus size={18} />
          Add someone
        </button>
      </div>
      <div className="notice family-notice">
        <Heart size={21} />
        <p>
          These profiles are labeled by your care circle. In the patient view,
          the person using Thread chooses a photo and confirms who is there. No
          automated face matching runs.
        </p>
      </div>
      <div className="people-grid">
        {people.map((p) => (
          <article className="card person-card" key={p.id}>
            {p.hasPhoto ? (
              <img
                className="person-photo"
                src={"/api/v1/people/" + p.id + "/photo"}
                alt={"Labeled photo of " + p.name}
              />
            ) : (
              <div className="person-placeholder">{p.name[0]}</div>
            )}
            <span className="eyebrow">{p.relationship}</span>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <small>
              Labeled by {p.author} · {stamp(p.updatedAt)}
            </small>
            <div className="button-row">
              <button
                className="text-button"
                onClick={() => {
                  setEdit(p);
                  setPhoto(null);
                  setOpen(true);
                }}
              >
                <Pencil size={14} />
                Edit details
              </button>
              <button
                className="text-button"
                onClick={async () => {
                  if (
                    !confirm(
                      "Remove " +
                        p.name +
                        " and their stored photo? Past confirmed encounters remain in the diary until deleted or expired.",
                    )
                  )
                    return;
                  try {
                    await api("/api/v1/people/" + p.id + "/delete", {});
                    await load();
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      {!people.length && (
        <div className="card empty">
          <Heart size={38} />
          <h3>Start with someone familiar.</h3>
          <p>
            Add a family member or friend, their relationship, and a photo they
            agree to share.
          </p>
        </div>
      )}
      {open && (
        <Modal
          title={edit ? "A few familiar details" : "Add a familiar person"}
          onClose={() => setOpen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api(
                  edit
                    ? "/api/v1/people/" + edit.id + "/update"
                    : "/api/v1/people",
                  {
                    name: f.get("name"),
                    relationship: f.get("relationship"),
                    description: f.get("description"),
                    author: f.get("author"),
                    consent: true,
                    ...(edit
                      ? { revision: edit.revision }
                      : photo
                        ? { photo }
                        : {}),
                  },
                );
                setOpen(false);
                await load();
                notify("Familiar profile saved.");
              } catch (err: any) {
                notify(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Name
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={edit?.name}
              />
            </label>
            <label>
              Relationship
              <input
                name="relationship"
                required
                maxLength={80}
                placeholder="Daughter, friend, neighbor…"
                defaultValue={edit?.relationship}
              />
            </label>
            <label>
              What feels familiar?
              <textarea
                name="description"
                maxLength={1000}
                placeholder="Maya enjoys gardening with you. You often have tea together on Sundays."
                defaultValue={edit?.description}
              />
            </label>
            <label>
              Added or reviewed by
              <input
                name="author"
                required
                maxLength={80}
                defaultValue={edit?.author}
              />
            </label>
            {!edit && (
              <label>
                Optional labeled photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    try {
                      const f = e.target.files?.[0];
                      if (f) setPhoto(await readPhoto(f));
                    } catch (err: any) {
                      notify(err.message);
                    }
                  }}
                />
              </label>
            )}
            {photo && (
              <img
                className="person-confirm-photo"
                src={photo}
                alt="Photo selected for this profile"
              />
            )}
            <label className="checkbox">
              <input type="checkbox" required />
              This person agrees to their labeled profile and photo being stored
              for this household. Their text details may be shared with the AI
              companion during a consented session.
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save familiar person"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
