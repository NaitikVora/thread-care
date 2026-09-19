import { useEffect, useRef, useState } from "react";
import {
  Camera as CameraIcon,
  ImagePlus,
  ScanText,
  Eye,
  StopCircle,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import type { Ask, Example, Result } from "./types";
import { api, stamp } from "./api";
import { ResultCard, Modal } from "./components";
import type { AgentAction } from "../../../packages/agent/src/index";
export function Camera({
  ask,
  result,
  onApply,
  notify,
  examples,
  refresh,
  busy,
}: {
  ask: Ask;
  result: Result | null;
  onApply: (i: number, a?: AgentAction) => Promise<boolean>;
  notify: (s: string) => void;
  examples: Example[];
  refresh: () => Promise<void>;
  busy: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    file = useRef<HTMLInputElement>(null),
    epoch = useRef(0);
  const [live, setLive] = useState(false),
    [starting, setStarting] = useState(false),
    [photo, setPhoto] = useState<string | null>(null),
    [error, setError] = useState(""),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [question, setQuestion] = useState("What can you see in this photo?"),
    [save, setSave] = useState(false),
    [edit, setEdit] = useState<Example | null>(null);
  function stop() {
    epoch.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setLive(false);
    setStarting(false);
  }
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      epoch.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  async function start(id = device) {
    stop();
    setError("");
    setStarting(true);
    const token = epoch.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera access requires localhost or HTTPS and a supported browser. You can upload a photo instead.",
      );
      setStarting(false);
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: id
          ? { deviceId: { exact: id } }
          : { facingMode: "environment", width: { ideal: 1280 } },
      });
      if (token !== epoch.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
      if (token !== epoch.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      setPhoto(null);
      setLive(true);
      const list = await navigator.mediaDevices.enumerateDevices();
      if (token === epoch.current)
        setDevices(list.filter((d) => d.kind === "videoinput"));
    } catch (e: any) {
      setError(
        e.name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in your browser settings, or upload a photo."
          : e.name === "NotFoundError"
            ? "No camera was found. You can upload a photo instead."
            : "The camera could not start. It may be in use by another app. Try again or upload a photo.",
      );
    } finally {
      setStarting(false);
    }
  }
  function capture() {
    const v = video.current;
    if (!v?.videoWidth) {
      notify("Wait for the camera preview to appear.");
      return;
    }
    const c = document.createElement("canvas"),
      scale = Math.min(1, 1536 / v.videoWidth);
    c.width = v.videoWidth * scale;
    c.height = v.videoHeight * scale;
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    setPhoto(c.toDataURL("image/jpeg", 0.82));
    stop();
  }
  async function upload(f: File | undefined) {
    if (!f) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      f.size > 4 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG, or WebP image under 4 MB.");
      return;
    }
    stop();
    setError("");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      setPhoto(data);
    } catch {
      setError("The photo could not be opened.");
    }
  }
  async function saveExample(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const body = {
        label: f.get("label"),
        note: f.get("note"),
        group: f.get("group"),
        task: f.get("task"),
      };
      await api(
        edit ? "/api/v1/examples/" + edit.id : "/api/v1/examples",
        edit ? body : { ...body, image: photo, consent: true },
      );
      setSave(false);
      setEdit(null);
      await refresh();
      notify("Reviewed example saved locally. No model has been trained.");
    } catch (e: any) {
      notify(e.message);
    }
  }
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">A FRESH PAIR OF EYES</span>
        <h2>Let’s look together.</h2>
        <p>Take a photo, ask a question, and choose what to remember.</p>
      </div>
      <div className="camera-grid">
        <section className="card camera-card">
          <div className="section-head">
            <h3>Your camera</h3>
            <span className={"tag " + (live ? "live" : "")}>
              {live
                ? "Camera on · local preview"
                : photo
                  ? "Photo ready"
                  : "Camera off"}
            </span>
          </div>
          <div className={"viewfinder " + (photo ? "has-photo" : "")}>
            <video ref={video} autoPlay muted playsInline hidden={!live} />
            {photo && <img src={photo} alt="Photo selected for review" />}
            {!live && !photo && (
              <div className="camera-empty">
                <CameraIcon size={46} strokeWidth={1.2} />
                <h3>A moment, when you choose.</h3>
                <p>Your camera stays off until you start it.</p>
              </div>
            )}
            {live && (
              <span className="recording-indicator">
                LIVE PREVIEW · NOT RECORDING
              </span>
            )}
          </div>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <div className="camera-controls">
            {live ? (
              <>
                <button className="primary" onClick={capture}>
                  <CameraIcon size={18} />
                  Take photo
                </button>
                <button className="secondary" onClick={stop}>
                  <StopCircle size={18} />
                  Stop camera
                </button>
              </>
            ) : (
              <button
                className="primary"
                onClick={() => start()}
                disabled={starting}
              >
                <CameraIcon size={18} />
                {starting
                  ? "Starting…"
                  : photo
                    ? "Retake photo"
                    : "Start camera"}
              </button>
            )}
            {starting && (
              <button className="secondary" onClick={stop}>
                Cancel camera start
              </button>
            )}
            <button
              className="secondary"
              onClick={() => {
                stop();
                file.current?.click();
              }}
            >
              <ImagePlus size={18} />
              Upload photo
            </button>
            {photo && (
              <button
                className="text-button"
                onClick={() => {
                  setPhoto(null);
                  setSave(false);
                }}
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => upload(e.target.files?.[0])}
          />
          {devices.length > 1 && (
            <label>
              Camera
              <select
                value={device}
                onChange={(e) => {
                  setDevice(e.target.value);
                  if (live) start(e.target.value);
                }}
              >
                <option value="">Default camera</option>
                {devices.map((d) => (
                  <option value={d.deviceId} key={d.deviceId}>
                    {d.label || "Camera"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="fine">
            Preview stays on this device. Only the selected photo is sent to
            OpenAI when you ask. It is not saved unless you explicitly retain an
            example.
          </p>
        </section>
        <section className="card photo-question">
          <span className="eyebrow">LOOK WITH ME</span>
          <h3>What would help?</h3>
          <div className="photo-prompts">
            <button
              onClick={() =>
                setQuestion(
                  "Describe the ordinary objects visible in this photo.",
                )
              }
            >
              <Eye size={18} />
              Describe this scene
            </button>
            <button
              onClick={() =>
                setQuestion(
                  "Read the ordinary text visible in this photo. Say if any text is unclear.",
                )
              }
            >
              <ScanText size={18} />
              Read this for me
            </button>
            <button
              onClick={() =>
                setQuestion(
                  "Help me find the object I describe in this photo. Ask which object first if I have not specified one.",
                )
              }
            >
              <CameraIcon size={18} />
              Find an object
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (photo) ask(question, "chat", photo);
            }}
          >
            <label>
              Your question
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={2000}
                required
              />
            </label>
            <button className="primary full" disabled={!photo || busy}>
              Ask about this photo
            </button>
          </form>
          <div className="soft-panel">
            <BookOpen size={22} />
            <h3>Teach from a familiar moment</h3>
            <p>
              Keep a reviewed photo and label for future evaluation, or a family
              photo for reminiscence.
            </p>
            <button
              className="secondary"
              disabled={!photo}
              onClick={() => setSave(true)}
            >
              Review & save an example
            </button>
          </div>
        </section>
      </div>
      <ResultCard result={result} onApply={onApply} notify={notify} />
      <section className="card examples">
        <div className="section-head">
          <div>
            <span className="eyebrow">YOUR REVIEWED COLLECTION</span>
            <h3>Familiar objects & moments</h3>
          </div>
          <a className="secondary" href="/api/v1/dataset/export" download>
            Export dataset
          </a>
        </div>
        <p className="fine">
          {examples.length} saved examples · dataset v1 · no custom model
          trained. Examples from the same group share a train/validation split.
        </p>
        <div className="example-grid">
          {examples.map((e) => (
            <article key={e.id}>
              <img src={"/api/v1/examples/" + e.id + "/image"} alt={e.label} />
              <div>
                <strong>{e.label}</strong>
                <p>{e.note}</p>
                <small>
                  {e.group} · {e.split} · {stamp(e.createdAt)}
                </small>
                <div className="button-row">
                  <button className="text-button" onClick={() => setEdit(e)}>
                    Edit label
                  </button>
                  <button
                    className="text-button"
                    onClick={async () => {
                      if (!confirm("Delete this saved photo and its label?"))
                        return;
                      try {
                        await api("/api/v1/examples/" + e.id + "/delete", {});
                        await refresh();
                      } catch (err: any) {
                        notify(err.message);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!examples.length && (
          <p className="collection-empty">
            Your reviewed examples will appear here. Saving photos is optional.
          </p>
        )}
      </section>
      {(save || edit) && (
        <Modal
          title={edit ? "Review this example" : "Retain a reviewed example"}
          onClose={() => {
            setSave(false);
            setEdit(null);
          }}
        >
          <form onSubmit={saveExample}>
            <label>
              Label
              <input
                name="label"
                required
                maxLength={100}
                defaultValue={edit?.label}
                placeholder="Blue cardigan on the hall hook"
              />
            </label>
            <label>
              Description
              <textarea
                name="note"
                maxLength={1000}
                defaultValue={edit?.note}
              />
            </label>
            <label>
              Object or session group
              <input
                name="group"
                required
                maxLength={100}
                defaultValue={edit?.group}
                placeholder="blue-cardigan"
              />
            </label>
            <label>
              Intended task
              <select
                name="task"
                defaultValue={edit?.task || "object-description"}
              >
                <option value="object-description">Object description</option>
                <option value="text-reading">Text reading</option>
                <option value="scene-description">Scene description</option>
                <option value="reminiscence">Family reminiscence</option>
              </select>
            </label>
            {!edit && (
              <label className="checkbox">
                <input type="checkbox" required />I reviewed this photo and
                label and want to retain them locally. I can delete them later.
              </label>
            )}
            <p className="fine">
              This saves a labeled example. It does not start training or upload
              a dataset.
            </p>
            <button className="primary" type="submit">
              Save reviewed example
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
