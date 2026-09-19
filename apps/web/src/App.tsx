import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Camera,
  BookOpen,
  Heart,
  History,
  Settings as SettingsIcon,
  ArrowUp,
  ArrowRight,
  Sun,
  Leaf,
  Coffee,
  Bookmark,
  Pause,
  Check,
  Volume2,
  VolumeX,
  Mic,
  Square,
  Plus,
  Menu,
  X,
  RefreshCw,
  Clock,
  Glasses,
  Users,
} from "lucide-react";
import { api, APIError, stamp, timezone } from "./api";
import type { Bootstrap, AIStatus, Result, Mutate, Ask } from "./types";
import type { DomainAction } from "../../../packages/contracts/src/index";
import type { AgentAction } from "../../../packages/agent/src/index";
import { routineContext, recall } from "../../../packages/domain/src/index.js";
import { ResultCard, Modal, Busy } from "./components";
import { Camera as CameraPage } from "./Camera";
import { Knowledge } from "./Knowledge";
import { Care } from "./Care";
import { Settings } from "./Settings";
import { useVoice } from "./voice";
import { LiveCompanion } from "./LiveCompanion";
import { Diary } from "./Diary";
import { People } from "./People";
import { SignIn } from "./SignIn";
import "./day-companion.css";
const nav = [
  ["live", "Live companion", Glasses],
  ["diary", "Day diary", BookOpen],
  ["people", "Familiar people", Users],
  ["companion", "Companion", Sparkles],
  ["camera", "Look with me", Camera],
  ["knowledge", "Teach Thread", BookOpen],
  ["care", "Care circle", Heart],
  ["activity", "Activity", History],
  ["settings", "Settings", SettingsIcon],
] as const;
export default function App() {
  const [locked, setLocked] = useState(false);
  const [data, setData] = useState<Bootstrap | null>(null),
    [status, setStatus] = useState<AIStatus>({
      configured: false,
      source: null,
      model: "gpt-4.1-mini",
      sessionStorageAvailable: false,
    }),
    [view, setView] = useState("live"),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [run, setRun] = useState<Result | null>(null),
    [runView, setRunView] = useState("companion"),
    [memory, setMemory] = useState(false),
    [memoryKind, setMemoryKind] = useState("intention"),
    [runs, setRuns] = useState<any[]>([]),
    [menu, setMenu] = useState(false),
    [snoozed, setSnoozed] = useState(false);
  const dataRef = useRef(data),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    request = useRef<{ id: string; controller: AbortController } | null>(null),
    messages = useRef<HTMLDivElement>(null),
    notified = useRef(new Set<string>());
  dataRef.current = data;
  function notify(message: string) {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 7000);
  }
  async function refresh() {
    const auth = await api("/api/auth/status");
    if (auth.enabled && !auth.identity) {
      setLocked(true);
      setData(null);
      return;
    }
    setLocked(false);
    const [next, ai] = await Promise.all([
      api<Bootstrap>("/api/v1/bootstrap"),
      api<AIStatus>("/api/status"),
    ]);
    dataRef.current = next;
    setData(next);
    setStatus(ai);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    return () => {
      clearTimeout(timer.current);
      request.current?.controller.abort();
    };
  }, []);
  useEffect(() => {
    messages.current?.scrollTo({
      top: messages.current.scrollHeight,
      behavior: "smooth",
    });
  }, [data?.snapshot.state.messages.length]);
  useEffect(() => {
    if (view === "activity")
      api("/api/v1/runs")
        .then(setRuns)
        .catch((e) => notify(e.message));
  }, [view, data?.snapshot.revision]);
  function quiet(p: Bootstrap["preferences"]) {
    const h = new Date().getHours();
    return p.quietStart === p.quietEnd
      ? false
      : p.quietStart < p.quietEnd
        ? h >= p.quietStart && h < p.quietEnd
        : h >= p.quietStart || h < p.quietEnd;
  }
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const reminders = await api("/api/v1/reminders");
        setData((d) => (d ? { ...d, reminders } : d));
        const current = dataRef.current;
        if (current && !quiet(current.preferences))
          for (const r of reminders) {
            const key = r.id + ":" + r.dueAt;
            if (r.status === "due" && !notified.current.has(key)) {
              notified.current.add(key);
              if (
                "Notification" in window &&
                Notification.permission === "granted"
              )
                new Notification("Thread reminder", {
                  body: r.title,
                  tag: r.id,
                });
            }
          }
        const remote = await api("/api/v1/state");
        if (current && remote.revision !== current.snapshot.revision)
          await refresh();
      } catch {}
    }, 10000);
    return () => clearInterval(id);
  }, []);
  function speak(message: string) {
    if (
      !dataRef.current?.snapshot.state.sound ||
      !("speechSynthesis" in window)
    )
      return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(message);
    u.rate = dataRef.current.preferences.speechRate;
    u.onerror = () => {};
    window.speechSynthesis.speak(u);
  }
  const voice = useVoice(status.configured, setText, notify);
  const mutate: Mutate = async (route, body, success) => {
    if (!dataRef.current) return false;
    try {
      await api(route, {
        revision: dataRef.current.snapshot.revision,
        requestId: crypto.randomUUID(),
        ...body,
      });
      await refresh();
      if (success) notify(success);
      return true;
    } catch (e: any) {
      if (e instanceof APIError && e.status === 409)
        await refresh().catch(() => {});
      notify(e.message);
      return false;
    }
  };
  async function action(a: DomainAction) {
    const ok = await mutate("/api/v1/action", { action: a });
    if (ok && a.type !== "sound") {
      const s = dataRef.current?.snapshot.state;
      const last = s?.messages.at(-1);
      if (last) speak(last.text);
    }
  }
  const ask: Ask = async (message, purpose = "chat", image) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setRun(null);
    setRunView(view);
    const id = crypto.randomUUID(),
      controller = new AbortController();
    request.current = { id, controller };
    try {
      const result = await api<Result>(
        "/api/v1/agent",
        { id, message, purpose, image, timezone: timezone() },
        controller.signal,
      );
      setRun(result);
      await refresh();
      speak(result.reply);
    } catch (e: any) {
      setError(e.message);
      await refresh().catch(() => {});
    } finally {
      request.current = null;
      setBusy(false);
    }
  };
  async function cancel() {
    const r = request.current;
    if (r) {
      try {
        await api("/api/v1/agent/" + r.id + "/cancel", {});
      } catch {}
      r.controller.abort();
    }
  }
  async function apply(index: number, edited?: AgentAction) {
    if (!run) return false;
    const ok = await mutate(
      "/api/v1/agent/" + run.id + "/apply",
      { index, edited },
      "Confirmed and saved.",
    );
    if (ok)
      setRun((r) =>
        r
          ? {
              ...r,
              applied: [...(r.applied || []), index],
              revision: dataRef.current!.snapshot.revision,
            }
          : null,
      );
    return ok;
  }
  function navigate(next: string) {
    if (
      dataRef.current?.identity?.role === "patient" &&
      !["live", "diary", "companion", "camera"].includes(next)
    ) {
      notify("Ask your caregiver to open the portal for these settings.");
      return;
    }
    setView(next);
    setMenu(false);
    window.speechSynthesis?.cancel();
    voice.stop();
  }
  if (locked) return <SignIn onSuccess={() => void refresh()} />;
  if (!data)
    return (
      <main className="loading-screen">
        <span className="brand standalone">
          thread<span>.</span>
        </span>
        <h1>
          {error ? "Let’s reconnect." : "A little support is on its way."}
        </h1>
        <p>{error || "Opening your local workspace…"}</p>
        {error && (
          <button
            className="primary"
            onClick={() =>
              refresh()
                .then(() => setError(""))
                .catch((e) => setError(e.message))
            }
          >
            <RefreshCw size={18} />
            Try again
          </button>
        )}
      </main>
    );
  const s = data.snapshot.state,
    c = routineContext(s),
    due = data.reminders.filter((r) => r.status === "due"),
    result = runView === view ? run : null;
  const suggestion =
    data.preferences.proactive &&
    !quiet(data.preferences) &&
    !snoozed &&
    (s.active?.status === "paused"
      ? "Your routine is paused. Would you like to pick up where you left off?"
      : s.profile.visitAt &&
          Date.parse(s.profile.visitAt) > Date.now() &&
          Date.parse(s.profile.visitAt) < Date.now() + 86400000
        ? "A familiar visit is coming up. Your care circle has the details."
        : null);
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className={"sidebar " + (menu ? "expanded" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("companion");
          }}
        >
          <span className="brand-symbol">t</span>thread
          <span className="brand-dot">.</span>
        </a>
        <span className="workspace-label">A LITTLE SUPPORT, EVERY DAY</span>
        <nav aria-label="Main navigation">
          {nav
            .filter(
              (n) =>
                data.identity?.role !== "patient" ||
                ["live", "diary", "companion", "camera"].includes(n[0]),
            )
            .map(([id, label, Icon]) => (
              <button
                key={id}
                aria-current={view === id ? "page" : undefined}
                className={"nav-item " + (view === id ? "active" : "")}
                onClick={() => navigate(id)}
              >
                <Icon size={20} />
                {label}
                {id === "care" &&
                  s.requests.some((r) => r.status === "open") && (
                    <span className="nav-count">
                      {s.requests.filter((r) => r.status === "open").length}
                    </span>
                  )}
              </button>
            ))}
        </nav>
        <div className="sidebar-note">
          <span className="plant-mark">✳</span>
          <p>
            More of the day,
            <br />
            on your terms.
          </p>
          <small>One local household workspace</small>
        </div>
        <div className="profile">
          <span className="avatar">{s.profile.name.charAt(0)}</span>
          <div>
            <strong>{s.profile.name}</strong>
            <small>Your companion space</small>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>
          <span className="breadcrumb">
            YOUR DAY /{" "}
            <strong>{nav.find((n) => n[0] === view)?.[1].toUpperCase()}</strong>
          </span>
          <div className="header-actions">
            {data.identity?.mode === "password" && (
              <button
                className="text-button"
                onClick={async () => {
                  await api("/api/auth/logout", {});
                  setLocked(true);
                  setData(null);
                }}
              >
                Sign out
              </button>
            )}
            <button
              className={
                "connection-pill " + (status.configured ? "connected" : "")
              }
              onClick={() => navigate("settings")}
            >
              <span />
              {status.configured ? "AI key connected" : "Connect AI"}
            </button>
            <button
              className="icon-button"
              aria-label={
                s.sound ? "Turn spoken replies off" : "Turn spoken replies on"
              }
              onClick={() => {
                action({ type: "sound", enabled: !s.sound });
                if (s.sound) window.speechSynthesis?.cancel();
              }}
            >
              {s.sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          </div>
        </header>
        <main id="main">
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {busy && <Busy cancel={cancel} />}
          {view === "companion" && (
            <>
              <div className="page-intro intro-row">
                <div>
                  <span className="eyebrow">
                    {new Date()
                      .toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                      .toUpperCase()}
                  </span>
                  <h1>
                    Hello, {s.profile.name.split(" ")[0]}
                    <span className="hello-dot">.</span>
                  </h1>
                  <p>A little support, so more of the day stays yours.</p>
                </div>
                <span className="day-illustration" aria-hidden="true">
                  <Sun size={50} strokeWidth={1} />
                </span>
              </div>
              {suggestion && (
                <div className="suggestion">
                  <Sparkles size={19} />
                  <p>{suggestion}</p>
                  <button
                    className="text-button"
                    onClick={() =>
                      s.active?.status === "paused"
                        ? action({ type: "resume" })
                        : navigate("care")
                    }
                  >
                    Take a look
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Dismiss suggestion for this session"
                    onClick={() => setSnoozed(true)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {due.length > 0 && !quiet(data.preferences) && (
                <div className="due-banner">
                  <Clock size={19} />
                  <span>
                    {due[0].title}
                    {due.length > 1
                      ? " · " + due.length + " reminders waiting"
                      : ""}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => navigate("care")}
                  >
                    View reminders
                  </button>
                </div>
              )}
              <div className="companion-grid">
                <div className="daily-column">
                  <section className="routine-hero">
                    <div className="hero-top">
                      <span className="eyebrow">
                        {c
                          ? c.routine.title.toUpperCase()
                          : "ONE STEP AT A TIME"}
                      </span>
                      <span className="hero-status">
                        <span />
                        {c?.status === "paused"
                          ? "Place saved"
                          : c?.status === "completed"
                            ? "Complete"
                            : "Here with you"}
                      </span>
                    </div>
                    <div className="hero-art">
                      <Sun size={48} strokeWidth={1} />
                      <span />
                      <span />
                    </div>
                    <h2>
                      {!c
                        ? "A familiar rhythm."
                        : c.status === "completed"
                          ? "A little progress. All yours."
                          : c.status === "paused"
                            ? "Take your time."
                            : c.step}
                    </h2>
                    <p>
                      {!c
                        ? "Choose something you’d like to do. We’ll take it one small step at a time."
                        : c.status === "paused"
                          ? "Your place is saved. We can pick up whenever you’re ready."
                          : c.status === "completed"
                            ? "You confirmed every step. Take a moment for yourself."
                            : "Step " +
                              (s.active!.step + 1) +
                              " of " +
                              c.routine.steps.length +
                              " · You set the pace."}
                    </p>
                    {c && (
                      <div
                        className="step-track"
                        aria-label={s.active!.step + " steps confirmed"}
                      >
                        {c.routine.steps.map((_, i) => (
                          <span
                            key={i}
                            className={
                              c.status === "completed" || i < s.active!.step
                                ? "done"
                                : ""
                            }
                          />
                        ))}
                      </div>
                    )}
                    <div className="hero-buttons">
                      {!c ? (
                        <button
                          className="primary light"
                          onClick={() =>
                            action({ type: "start", id: s.routines[0].id })
                          }
                        >
                          Start a familiar routine
                          <ArrowRight size={18} />
                        </button>
                      ) : c.status === "paused" ? (
                        <button
                          className="primary light"
                          onClick={() => action({ type: "resume" })}
                        >
                          I’m ready
                          <ArrowRight size={18} />
                        </button>
                      ) : c.status === "completed" ? (
                        <button
                          className="primary light"
                          onClick={() =>
                            action({ type: "start", id: c.routine.id })
                          }
                        >
                          Start again
                        </button>
                      ) : (
                        <>
                          <button
                            className="secondary on-dark"
                            onClick={() => action({ type: "pause" })}
                          >
                            <Pause size={16} />
                            Pause
                          </button>
                          <button
                            className="primary light"
                            onClick={() => action({ type: "next" })}
                          >
                            I’ve done this
                            <Check size={17} />
                          </button>
                        </>
                      )}
                    </div>
                  </section>
                  <section className="thought-card">
                    <Bookmark size={23} />
                    <div>
                      <span className="eyebrow">YOUR CURRENT THOUGHT</span>
                      <p>
                        {s.intention?.text ||
                          "What would you like to keep in mind?"}
                      </p>
                      {s.intention && (
                        <small>You told Thread · {stamp(s.intention.at)}</small>
                      )}
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Save a thought or object location"
                      onClick={() => setMemory(true)}
                    >
                      <Plus size={22} />
                    </button>
                  </section>
                  <div className="section-head routines-heading">
                    <h3>Something familiar</h3>
                    <button
                      className="text-button"
                      onClick={() => navigate("care")}
                    >
                      Make it yours →
                    </button>
                  </div>
                  <div className="routine-list">
                    {s.routines.map((r) => (
                      <button
                        className="routine-card"
                        key={r.id}
                        onClick={() => action({ type: "start", id: r.id })}
                      >
                        <span className="routine-icon">
                          {r.icon === "leaf" ? (
                            <Leaf />
                          ) : r.icon === "cup" ? (
                            <Coffee />
                          ) : (
                            <Sun />
                          )}
                        </span>
                        <span>
                          <strong>{r.title}</strong>
                          <small>{r.steps.length} small steps</small>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="conversation-column">
                  <section className="card conversation">
                    <div className="section-head">
                      <div className="companion-name">
                        <span className="orb">t</span>
                        <div>
                          <h3>Your companion</h3>
                          <small>
                            {status.configured
                              ? "Ready to listen"
                              : "Saved records & simple commands"}
                          </small>
                        </div>
                      </div>
                      <span className="tiny-dot" />
                    </div>
                    <div
                      className="conversation-messages"
                      ref={messages}
                      aria-live="polite"
                    >
                      {s.messages.map((m, i) => (
                        <div className={"message " + m.role} key={i}>
                          {m.role === "assistant" && (
                            <span className="message-marker">THREAD</span>
                          )}
                          <p>{m.text}</p>
                        </div>
                      ))}
                    </div>
                    <div className="quick-prompts">
                      {["What was I doing?", "Where are my keys?"].map((q) => (
                        <button key={q} disabled={busy} onClick={() => ask(q)}>
                          {q}
                        </button>
                      ))}
                    </div>
                    <form
                      className="chat-composer"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (text.trim() && !busy) {
                          ask(text);
                          setText("");
                        }
                      }}
                    >
                      <textarea
                        aria-label="Message Thread"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={2000}
                        rows={2}
                        placeholder="Ask, or tell me something…"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                          }
                        }}
                      />
                      <div>
                        <button
                          type="button"
                          className={
                            "icon-button " +
                            (voice.recording ? "recording" : "")
                          }
                          disabled={voice.processing}
                          aria-label={
                            voice.recording
                              ? "Stop voice input"
                              : "Start voice input"
                          }
                          onClick={voice.toggle}
                        >
                          {voice.recording ? (
                            <Square size={18} />
                          ) : (
                            <Mic size={19} />
                          )}
                        </button>
                        <span>
                          {voice.processing
                            ? "Transcribing…"
                            : voice.recording
                              ? "Listening · press stop"
                              : status.configured
                                ? "Voice or text, your choice"
                                : "Basic mode · connect AI for more"}
                        </span>
                        <button
                          className="send-button"
                          type="submit"
                          aria-label="Send message"
                          disabled={busy || !text.trim()}
                        >
                          <ArrowUp size={21} />
                        </button>
                      </div>
                    </form>
                    <p className="voice-note">
                      {voice.note} · spoken replies use your browser’s voice.
                    </p>
                  </section>
                  <ResultCard result={result} onApply={apply} notify={notify} />
                  <button
                    className="help-button"
                    onClick={() => action({ type: "help" })}
                  >
                    <Heart size={19} />
                    <span>
                      Ask for a little help
                      <small>Add a request in your local care circle</small>
                    </span>
                    <ArrowRight size={19} />
                  </button>
                </div>
              </div>
            </>
          )}
          {view === "live" && (
            <LiveCompanion
              status={status}
              data={data}
              refresh={refresh}
              notify={notify}
              navigate={navigate}
            />
          )}
          {view === "diary" && <Diary notify={notify} />}
          {view === "people" && <People notify={notify} />}
          {view === "camera" && (
            <CameraPage
              ask={ask}
              result={result}
              onApply={apply}
              notify={notify}
              examples={data.examples}
              refresh={refresh}
              busy={busy}
            />
          )}
          {view === "knowledge" && (
            <Knowledge
              notes={data.knowledge}
              mutate={mutate}
              ask={ask}
              result={result}
              onApply={apply}
              notify={notify}
              busy={busy}
            />
          )}
          {view === "care" && (
            <Care
              state={s}
              reminders={data.reminders}
              mutate={mutate}
              ask={ask}
              result={result}
              onApply={apply}
              notify={notify}
              busy={busy}
            />
          )}
          {view === "settings" && (
            <Settings
              status={status}
              preferences={data.preferences}
              mutate={mutate}
              refresh={refresh}
              notify={notify}
              storage={data.storage}
              revision={data.snapshot.revision}
              budget={data.budget}
            />
          )}
          {view === "activity" && (
            <>
              <div className="page-intro">
                <span className="eyebrow">LITTLE MOMENTS, REMEMBERED</span>
                <h2>Your day has a thread.</h2>
                <p>
                  Saved notes, confirmed progress, and an honest record of what
                  the assistant did.
                </p>
              </div>
              <div className="activity-grid">
                <section className="card">
                  <h3>Memories & confirmed steps</h3>
                  {s.intention && (
                    <article className="activity-item">
                      <Bookmark size={18} />
                      <div>
                        <strong>Current thought</strong>
                        <p>{s.intention.text}</p>
                        <button
                          className="text-button"
                          onClick={() => action({ type: "forget-intention" })}
                        >
                          Clear thought
                        </button>
                      </div>
                    </article>
                  )}
                  {s.objects.map((o, i) => (
                    <article className="activity-item" key={i}>
                      <BookOpen size={18} />
                      <div>
                        <strong>{o.name}</strong>
                        <p>{o.location}</p>
                        <small>Last reported · {stamp(o.at)}</small>
                        <button
                          className="text-button"
                          onClick={() => {
                            if (
                              confirm(
                                "Delete the saved location for " + o.name + "?",
                              )
                            )
                              action({ type: "forget-object", name: o.name });
                          }}
                        >
                          Delete object note
                        </button>
                      </div>
                    </article>
                  ))}
                  {s.events.map((e) => (
                    <article className="activity-item" key={e.id}>
                      <Check size={18} />
                      <div>
                        <strong>{e.title}</strong>
                        <p>{e.detail}</p>
                        <small>
                          {e.source} · {stamp(e.at)}
                        </small>
                      </div>
                    </article>
                  ))}
                  {!s.events.length && (
                    <p className="fine">Confirmed actions will appear here.</p>
                  )}
                </section>
                <section className="card">
                  <h3>Agent activity</h3>
                  {runs.map((r) => (
                    <article className="run-item" key={r.id}>
                      <div className="section-head">
                        <strong>{r.question}</strong>
                        <span className="tag">{r.status}</span>
                      </div>
                      <small>
                        {r.mode === "live" ? "Live AI" : "Basic mode"} ·{" "}
                        {stamp(r.created_at)}
                      </small>
                      <p>{r.reply}</p>
                      {r.metrics?.durationMs !== undefined && (
                        <small>
                          {(r.metrics.durationMs / 1000).toFixed(1)}s ·{" "}
                          {r.metrics.modelCalls} model calls ·{" "}
                          {r.metrics.inputTokens} input /{" "}
                          {r.metrics.outputTokens} output tokens
                        </small>
                      )}
                      <details>
                        <summary>Action history</summary>
                        {r.trace.map((t: any, i: number) => (
                          <p key={i}>{t.detail}</p>
                        ))}
                      </details>
                      {r.status === "completed" &&
                        r.actions?.some(
                          (_: any, i: number) => !r.applied.includes(i),
                        ) && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setRun({
                                ...r,
                                sources: r.sources || [],
                                applied: r.applied,
                              });
                              setRunView("companion");
                              navigate("companion");
                            }}
                          >
                            Review pending suggestions
                          </button>
                        )}
                      {r.feedback && (
                        <small>
                          Feedback: {r.feedback}
                          {r.correction ? " · " + r.correction : ""}
                        </small>
                      )}
                    </article>
                  ))}
                  {!runs.length && (
                    <p className="fine">
                      Ask a question to see the tools and outcomes recorded
                      here.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
          <footer className="main-footer">
            <span>Independence. Dignity. Connection.</span>
            <span>Saved on your local server · {data.storage}</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {memory && (
        <Modal title="Keep a little thought" onClose={() => setMemory(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                a: DomainAction =
                  memoryKind === "intention"
                    ? { type: "intention", text: String(f.get("text")) }
                    : {
                        type: "object",
                        name: String(f.get("name")),
                        location: String(f.get("location")),
                      };
              if (
                await mutate(
                  "/api/v1/action",
                  { action: a },
                  "Saved with your words and the time.",
                )
              )
                setMemory(false);
            }}
          >
            <label>
              What would you like to remember?
              <select
                value={memoryKind}
                onChange={(e) => setMemoryKind(e.target.value)}
              >
                <option value="intention">A thought or intention</option>
                <option value="object">Where I put something</option>
              </select>
            </label>
            {memoryKind === "intention" ? (
              <label>
                Your thought
                <textarea
                  name="text"
                  required
                  maxLength={240}
                  placeholder="Get my blue cardigan before Maya arrives."
                />
              </label>
            ) : (
              <>
                <label>
                  Object
                  <input
                    name="name"
                    required
                    maxLength={80}
                    placeholder="My keys"
                  />
                </label>
                <label>
                  Last known location
                  <input
                    name="location"
                    required
                    maxLength={180}
                    placeholder="On the hall table"
                  />
                </label>
              </>
            )}
            <button className="primary">Save memory</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
