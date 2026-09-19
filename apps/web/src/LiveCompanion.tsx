import { useEffect, useRef, useState } from "react";
import type { Conversation as VoiceConversation } from "@elevenlabs/react";
import {
  Camera,
  Mic,
  MicOff,
  Pause,
  Play,
  Square,
  Eye,
  BookOpen,
  Heart,
  VolumeX,
  ArrowUp,
  Glasses,
  Check,
  Radio,
  Settings,
  LoaderCircle,
} from "lucide-react";
import { api, stamp, timezone } from "./api";
import { BrowserCamera, sceneChanged } from "./browser-camera";
import { Modal, ResultCard } from "./components";
import type {
  DiarySession,
  DiaryEvent,
  TrustedPerson,
  SessionPolicy,
} from "../../../packages/contracts/src/diary";
import type { AIStatus, Bootstrap, Result } from "./types";
import type { AgentAction } from "../../../packages/agent/src/index";
type Props = {
  status: AIStatus;
  data: Bootstrap;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
  navigate: (v: string) => void;
};
export function LiveCompanion({
  status,
  data,
  refresh,
  notify,
  navigate,
}: Props) {
  const [session, setSession] = useState<DiarySession | null>(null),
    [sessions, setSessions] = useState<DiarySession[]>([]),
    [events, setEvents] = useState<DiaryEvent[]>([]),
    [people, setPeople] = useState<TrustedPerson[]>([]),
    [person, setPerson] = useState<TrustedPerson | null>(null),
    [setup, setSetup] = useState(false),
    [cameraOn, setCameraOn] = useState(false),
    [starting, setStarting] = useState(false),
    [capturing, setCapturing] = useState(false),
    [error, setError] = useState(""),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(""),
    [auto, setAuto] = useState(true),
    [readUpdates, setReadUpdates] = useState(false),
    [voiceStatus, setVoiceStatus] = useState("disconnected"),
    [voiceMode, setVoiceMode] = useState("listening"),
    [voiceReady, setVoiceReady] = useState(false),
    [muted, setMuted] = useState(false),
    [caption, setCaption] = useState("Your day, at your pace."),
    [turns, setTurns] = useState<{ role: string; text: string }[]>([]),
    [result, setResult] = useState<Result | null>(null),
    [question, setQuestion] = useState(""),
    [asking, setAsking] = useState(false),
    [sources, setSources] = useState<any[]>([]),
    [nextAt, setNextAt] = useState<number | null>(null);
  const video = useRef<HTMLVideoElement>(null),
    camera = useRef<BrowserCamera | null>(null),
    voice = useRef<VoiceConversation | null>(null),
    current = useRef(session),
    mounted = useRef(true),
    epoch = useRef(0),
    voiceEpoch = useRef(0),
    voiceId = useRef<string | null>(null),
    lastImage = useRef<Uint8ClampedArray | null>(null),
    lastCapture = useRef(0),
    inFlight = useRef(false),
    captureAbort = useRef<AbortController | null>(null),
    questionAbort = useRef<{ id: string; controller: AbortController } | null>(
      null,
    ),
    readUpdatesRef = useRef(readUpdates),
    seenMessages = useRef(new Set<string>()),
    voiceCalls = useRef<number[]>([]),
    captureRef = useRef<(force?: boolean) => Promise<DiaryEvent | null>>(
      async () => null,
    );
  current.current = session;
  readUpdatesRef.current = readUpdates;
  function updateSession(s: DiarySession | null) {
    current.current = s;
    setSession(s);
  }
  async function load() {
    const [ss, pp, v] = await Promise.all([
      api<DiarySession[]>("/api/v1/diary/sessions"),
      api<TrustedPerson[]>("/api/v1/people"),
      api("/api/v1/voice/status"),
    ]);
    setSessions(ss);
    setPeople(pp);
    setVoiceReady(v.configured);
  }
  function stopCamera() {
    epoch.current++;
    camera.current?.stop();
    setCameraOn(false);
    setStarting(false);
    setNextAt(null);
  }
  async function stopVoice() {
    voiceEpoch.current++;
    const call = voice.current;
    voice.current = null;
    setVoiceStatus("disconnected");
    setMuted(false);
    if (call) await call.endSession().catch(() => {});
    const id = voiceId.current;
    voiceId.current = null;
    if (id)
      await api("/api/v1/voice/session/" + id, { status: "ended" }).catch(
        () => {},
      );
  }
  async function pause(reason = "Paused. Your place is saved.") {
    stopCamera();
    captureAbort.current?.abort();
    await stopVoice();
    const s = current.current;
    if (s && s.status === "active")
      try {
        updateSession(
          await api("/api/v1/diary/sessions/" + s.id, { operation: "pause" }),
        );
      } catch (e: any) {
        setError(e.message);
      }
    setCaption(reason);
  }
  useEffect(() => {
    mounted.current = true;
    load().catch((e) => setError(e.message));
    const hidden = () => {
      if (document.hidden && current.current?.status === "active")
        void pause(
          "Paused because this page is no longer visible. Resume when you’re ready.",
        );
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      mounted.current = false;
      epoch.current++;
      voiceEpoch.current++;
      camera.current?.stop();
      captureAbort.current?.abort();
      questionAbort.current?.controller.abort();
      const active = voice.current;
      voice.current = null;
      void active?.endSession();
      if (current.current?.status === "active")
        void api("/api/v1/diary/sessions/" + current.current.id, {
          operation: "pause",
        }).catch(() => {});
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  useEffect(() => {
    if (session?.status !== "active") return;
    const id = setInterval(() => {
      api<DiarySession>("/api/v1/diary/sessions/" + session.id, {
        operation: "heartbeat",
      }).catch((e) => {
        setError(e.message);
        void pause("The session disconnected. Resume after reconnecting.");
      });
    }, 20000);
    return () => clearInterval(id);
  }, [session?.id, session?.status]);
  useEffect(() => {
    if (!session) return;
    api<DiaryEvent[]>("/api/v1/diary/session/" + session.id + "/events")
      .then(setEvents)
      .catch((e) => setError(e.message));
  }, [session?.id]);
  useEffect(() => {
    if (!cameraOn || !auto || session?.status !== "active") return;
    const interval = session.policy.intervalSeconds * 1000;
    setNextAt(Date.now() + interval);
    const timer = setInterval(() => {
      setNextAt(Date.now() + interval);
      void captureRef.current(false).catch(() => {});
    }, interval);
    return () => clearInterval(timer);
  }, [
    cameraOn,
    auto,
    session?.id,
    session?.status,
    session?.policy.intervalSeconds,
  ]);
  async function startCamera() {
    stopCamera();
    setStarting(true);
    setError("");
    const token = epoch.current;
    try {
      camera.current = new BrowserCamera(video.current!, () => {
        if (mounted.current) void pause("The camera disconnected.");
      });
      await camera.current.start(device || undefined);
      if (token !== epoch.current) return;
      setCameraOn(true);
      lastImage.current = null;
      const list = await navigator.mediaDevices.enumerateDevices();
      if (token === epoch.current)
        setDevices(list.filter((d) => d.kind === "videoinput"));
    } catch (e: any) {
      if (token === epoch.current)
        setError(
          e.name === "NotAllowedError"
            ? "Camera permission was denied. Allow it in browser settings, then try again."
            : e.message || "The camera could not start.",
        );
    } finally {
      if (token === epoch.current) setStarting(false);
    }
  }
  async function begin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    try {
      const policy: SessionPolicy = {
        cloudConsent: true,
        intervalSeconds: Number(
          f.get("interval"),
        ) as SessionPolicy["intervalSeconds"],
        retentionDays: Number(
          f.get("retention"),
        ) as SessionPolicy["retentionDays"],
        retainFrames: f.get("frames") === "on",
        retainTranscript: f.get("transcript") === "on",
        voiceConsent: f.get("voice") === "on",
      };
      const s = await api<DiarySession>("/api/v1/diary/sessions", {
        id: crypto.randomUUID(),
        title: f.get("title"),
        policy,
      });
      updateSession(s);
      setEvents([]);
      setSetup(false);
      setCaption(
        "Your session has started. Turn on the camera when you’re ready.",
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function resume(s: DiarySession) {
    try {
      updateSession(
        await api("/api/v1/diary/sessions/" + s.id, { operation: "resume" }),
      );
      setError("");
      setCaption(
        "Welcome back. You can turn on the camera or voice when ready.",
      );
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function end() {
    stopCamera();
    captureAbort.current?.abort();
    await stopVoice();
    if (!current.current) return;
    try {
      updateSession(
        await api("/api/v1/diary/sessions/" + current.current.id, {
          operation: "end",
        }),
      );
      await load();
      setCaption("Your recorded moments are saved in your diary.");
    } catch (e: any) {
      setError(e.message);
    }
  }
  function addEvent(event: DiaryEvent) {
    setEvents((v) =>
      [event, ...v.filter((e) => e.id !== event.id)].slice(0, 80),
    );
  }
  async function capture(force = true) {
    const s = current.current;
    if (!s || s.status !== "active" || !camera.current)
      throw new Error("Start an active camera session first.");
    if (inFlight.current) return null;
    inFlight.current = true;
    setCapturing(true);
    setError("");
    const token = epoch.current;
    try {
      const signature = camera.current.signature();
      if (
        !force &&
        !sceneChanged(lastImage.current, signature) &&
        Date.now() - lastCapture.current < 300000
      )
        return null;
      const photo = await camera.current.capture(),
        controller = new AbortController();
      captureAbort.current = controller;
      const event = await api<DiaryEvent>(
        "/api/v1/diary/capture",
        {
          id: crypto.randomUUID(),
          sessionId: s.id,
          capturedAt: photo.capturedAt,
          image: photo.data,
        },
        controller.signal,
      );
      if (token !== epoch.current) return null;
      if (event.status !== "ready")
        throw new Error(event.error || "Analysis did not finish.");
      lastImage.current = signature;
      lastCapture.current = Date.now();
      addEvent(event);
      setCaption(event.summary);
      voice.current?.sendContextualUpdate(
        JSON.stringify({
          source: "Unreviewed camera observation",
          time: event.capturedAt,
          id: event.id,
          summary: event.summary,
          uncertainty: event.details.uncertainty,
        }),
      );
      if (readUpdatesRef.current && voice.current)
        voice.current.sendUserMessage(
          "Please briefly read the latest camera observation, making clear it is an observation.",
        );
      void refresh();
      return event;
    } catch (e: any) {
      if (token === epoch.current) {
        setError(e.message);
        setAuto(false);
      }
      throw e;
    } finally {
      inFlight.current = false;
      captureAbort.current = null;
      if (mounted.current) setCapturing(false);
    }
  }
  captureRef.current = capture;
  async function ask(message: string) {
    if (asking) return null;
    setAsking(true);
    setError("");
    const id = crypto.randomUUID(),
      controller = new AbortController();
    questionAbort.current = { id, controller };
    try {
      const r = await api<Result>(
        "/api/v1/agent",
        {
          id,
          message,
          purpose: "chat",
          requireReview: true,
          timezone: timezone(),
        },
        controller.signal,
      );
      setResult(r);
      setCaption(r.reply);
      setSources(r.sources);
      await refresh();
      return r;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      questionAbort.current = null;
      setAsking(false);
    }
  }
  async function apply(index: number, edited?: AgentAction) {
    if (!result) return false;
    try {
      const saved = await api("/api/v1/agent/" + result.id + "/apply", {
        revision: result.revision,
        requestId: crypto.randomUUID(),
        index,
        edited,
      });
      setResult((r) =>
        r
          ? {
              ...r,
              revision: saved.revision,
              applied: [...(r.applied || []), index],
            }
          : r,
      );
      await refresh();
      voice.current?.sendContextualUpdate(
        "The patient confirmed an on-screen suggestion. Backend result: " +
          (saved.reply || "Saved."),
      );
      notify(saved.reply || "Saved.");
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    }
  }
  async function voiceTool(fn: () => Promise<unknown>) {
    voiceCalls.current = voiceCalls.current.filter(
      (t) => t > Date.now() - 60000,
    );
    if (voiceCalls.current.length >= 8)
      return "Tool limit reached. Ask the patient to use the on-screen controls.";
    voiceCalls.current.push(Date.now());
    try {
      if (current.current?.status !== "active")
        throw new Error("The session is paused.");
      return JSON.stringify(await fn());
    } catch {
      return "The tool could not complete this request. No action was confirmed. The app displays the error.";
    }
  }
  async function startVoice() {
    const s = current.current;
    if (!s || s.status !== "active") return;
    setError("");
    setVoiceStatus("connecting");
    const token = ++voiceEpoch.current;
    seenMessages.current.clear();
    try {
      const ticket = await api("/api/v1/voice/session", { sessionId: s.id });
      if (token !== voiceEpoch.current) return;
      voiceId.current = ticket.id;
      const { Conversation } = await import("@elevenlabs/react");
      if (token !== voiceEpoch.current) return;
      const c = await Conversation.startSession({
        signedUrl: ticket.signedUrl,
        connectionType: "websocket",
        textOnly: false,
        onConversationCreated: (c) => {
          if (token !== voiceEpoch.current) void c.endSession();
          else voice.current = c;
        },
        onStatusChange: ({ status }) => {
          if (mounted.current && token === voiceEpoch.current)
            setVoiceStatus(status);
        },
        onDisconnect: () => {
          if (!mounted.current || token !== voiceEpoch.current) return;
          voice.current = null;
          setVoiceStatus("disconnected");
          setMuted(false);
          const id = voiceId.current;
          voiceId.current = null;
          if (id)
            void api("/api/v1/voice/session/" + id, { status: "ended" }).catch(
              () => {},
            );
        },
        onModeChange: ({ mode }) => {
          if (mounted.current && token === voiceEpoch.current)
            setVoiceMode(mode);
        },
        onError: () => {
          if (mounted.current && token === voiceEpoch.current) {
            setError(
              "The ElevenLabs voice connection failed. Check microphone permission, the agent configuration, and billing.",
            );
            void stopVoice();
          }
        },
        onMessage: (m) => {
          if (!mounted.current || token !== voiceEpoch.current) return;
          const dedupe = m.role + ":" + (m.event_id ?? m.message);
          if (seenMessages.current.has(dedupe)) return;
          seenMessages.current.add(dedupe);
          setTurns((t) => [...t, { role: m.role, text: m.message }].slice(-16));
          if (m.role === "agent") setCaption(m.message);
          if (s.policy.retainTranscript)
            void api("/api/v1/voice/transcript", {
              id: crypto.randomUUID(),
              sessionId: s.id,
              role: m.role,
              text: m.message.slice(0, 4000),
              eventId: String(m.event_id ?? ""),
            }).catch((e) =>
              setError(
                "Voice continues, but the transcript was not saved: " +
                  e.message,
              ),
            );
        },
        clientTools: {
          search_context: ({ query }) =>
            voiceTool(async () => {
              const context = await api("/api/v1/voice/context", {
                sessionId: s.id,
                query: String(query || "").slice(0, 300),
              });
              setSources([...context.knowledge, ...context.moments]);
              return context;
            }),
          inspect_current_view: () =>
            voiceTool(async () => {
              const e = await captureRef.current(true);
              if (!e) throw new Error("Wait for the current analysis.");
              return e;
            }),
          get_familiar_people: () => voiceTool(() => api("/api/v1/people")),
          prepare_action: ({ request }) =>
            voiceTool(async () => {
              const r = await ask(String(request || "").slice(0, 2000));
              return {
                reply: r?.reply,
                proposals: r?.actions,
                permission:
                  "Pending on-screen confirmation. No change applied.",
              };
            }),
        },
      });
      if (token !== voiceEpoch.current || !mounted.current) {
        await c.endSession();
        return;
      }
      voice.current = c;
      setVoiceStatus("connected");
      await api("/api/v1/voice/session/" + ticket.id, {
        status: "connected",
        conversationId: c.getId(),
      });
      const context = await api("/api/v1/voice/context", {
        sessionId: s.id,
        query: "",
      });
      if (token === voiceEpoch.current)
        c.sendContextualUpdate(JSON.stringify(context));
    } catch (e: any) {
      if (token === voiceEpoch.current) {
        setError(e.message || "Voice could not connect.");
        await stopVoice();
      }
    }
  }
  async function confirmPerson() {
    if (!person || !current.current) return;
    try {
      const event = await api<DiaryEvent>("/api/v1/diary/person", {
        id: crypto.randomUUID(),
        sessionId: current.current.id,
        personId: person.id,
        confirmed: true,
      });
      addEvent(event);
      setCaption(person.name + " · " + person.relationship);
      voice.current?.sendContextualUpdate(
        JSON.stringify({
          source: "Patient confirmed a labeled family profile",
          person: {
            name: person.name,
            relationship: person.relationship,
            description: person.description,
          },
          at: event.capturedAt,
        }),
      );
      setPerson(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  const active = session?.status === "active",
    last = events.find((e) => e.status === "ready"),
    remaining = Math.max(0, data.budget.limit - data.budget.used);
  return (
    <div className="live-page">
      <div className="page-intro intro-row">
        <div>
          <span className="eyebrow">YOUR DAY, WITH A LITTLE SUPPORT</span>
          <h2>Here with you.</h2>
          <p>Look, talk, and pick up the thread of your day.</p>
        </div>
        <span className="tag device-badge">
          <Glasses size={17} />
          Browser camera · patient view
        </span>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      <div className="live-layout">
        <section className="patient-stage">
          <div className="patient-camera">
            <video
              ref={video}
              autoPlay
              playsInline
              muted
              className={cameraOn ? "" : "camera-hidden"}
            />
            {!cameraOn && (
              <div className="patient-idle">
                <div className="live-orbit">
                  <Eye size={40} strokeWidth={1} />
                </div>
                <h3>
                  {starting
                    ? "Waiting for camera permission…"
                    : active
                      ? "One thing at a time."
                      : "Your day stays yours."}
                </h3>
                <p>
                  {active
                    ? "Turn on your camera when you want Thread to see with you."
                    : "Start a session to choose what Thread can see, hear, and remember."}
                </p>
              </div>
            )}
            <div className="hud-top">
              <span className={"capture-dot " + (cameraOn ? "on" : "")}>
                {cameraOn
                  ? "CAMERA ON"
                  : active
                    ? "SESSION OPEN"
                    : "CAMERA OFF"}
              </span>
              <span>{session?.title || "Patient companion"}</span>
            </div>
            <div className="hud-caption" aria-live="polite">
              <span className="eyebrow">
                {voiceStatus === "connected"
                  ? voiceMode === "speaking"
                    ? "THREAD IS SPEAKING"
                    : "THREAD IS LISTENING"
                  : capturing
                    ? "LOOKING AT THIS MOMENT"
                    : "A LITTLE SUPPORT"}
              </span>
              <p>{caption}</p>
            </div>
          </div>
          <div className="patient-controls">
            {!session || session.status === "ended" ? (
              <button className="primary" onClick={() => setSetup(true)}>
                <Play size={19} />
                Start my day session
              </button>
            ) : !active ? (
              <button className="primary" onClick={() => resume(session)}>
                <Play size={19} />
                Resume session
              </button>
            ) : (
              <>
                {!cameraOn ? (
                  <button
                    className="primary"
                    disabled={starting}
                    onClick={startCamera}
                  >
                    <Camera size={19} />
                    {starting ? "Starting…" : "Turn on camera"}
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={capturing}
                    onClick={() => void capture(true).catch(() => {})}
                  >
                    {capturing ? (
                      <LoaderCircle className="spin" size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                    Remember this view
                  </button>
                )}
                {starting && (
                  <button className="secondary" onClick={stopCamera}>
                    Cancel camera start
                  </button>
                )}
                {voiceStatus === "connected" ? (
                  <>
                    <button
                      className="secondary"
                      onClick={() => {
                        voice.current?.setMicMuted(!muted);
                        setMuted(!muted);
                      }}
                    >
                      {muted ? <MicOff size={19} /> : <Mic size={19} />}{" "}
                      {muted ? "Unmute" : "Mute"}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => void stopVoice()}
                    >
                      <VolumeX size={19} />
                      Stop voice
                    </button>
                  </>
                ) : (
                  <button
                    className="secondary"
                    disabled={
                      !voiceReady ||
                      !session.policy.voiceConsent ||
                      voiceStatus === "connecting"
                    }
                    onClick={startVoice}
                  >
                    <Mic size={19} />
                    {voiceStatus === "connecting"
                      ? "Connecting…"
                      : "Talk with Thread"}
                  </button>
                )}
                {voiceStatus === "connecting" && (
                  <button
                    className="secondary"
                    onClick={() => void stopVoice()}
                  >
                    Cancel voice
                  </button>
                )}
                <button className="secondary" onClick={() => void pause()}>
                  <Pause size={19} />
                  Pause everything
                </button>
              </>
            )}
            {session && session.status !== "ended" && (
              <button className="text-button" onClick={() => void end()}>
                <Square size={16} />
                End session
              </button>
            )}
          </div>
          <div className="live-disclosure">
            <span>
              <Radio size={15} />
              {auto && cameraOn
                ? "Selected stills every " +
                  session?.policy.intervalSeconds +
                  "s when the scene changes"
                : "No automatic capture active"}
              {nextAt && cameraOn && auto
                ? " · next check " +
                  new Date(nextAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : ""}
            </span>
            <span>
              {voiceStatus === "connected"
                ? muted
                  ? "Microphone muted"
                  : "Microphone → ElevenLabs"
                : "Microphone off"}
            </span>
          </div>
          {active && (
            <div className="capture-options">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                />
                Save selected moments automatically
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={readUpdates}
                  onChange={(e) => setReadUpdates(e.target.checked)}
                />
                Read new observations aloud while voice is connected
              </label>
              {devices.length > 1 && (
                <label>
                  Camera
                  <select
                    value={device}
                    onChange={(e) => {
                      stopCamera();
                      setDevice(e.target.value);
                    }}
                  >
                    <option value="">Default camera</option>
                    {devices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || "Camera"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          <form
            className="patient-ask"
            onSubmit={(e) => {
              e.preventDefault();
              const q = question.trim();
              if (!q) return;
              if (voice.current) voice.current.sendUserMessage(q);
              else void ask(q).catch(() => {});
              setQuestion("");
            }}
          >
            <label className="sr-only" htmlFor="live-question">
              Ask Thread about your day
            </label>
            <input
              id="live-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={2000}
              placeholder="What was I doing? Where did I leave my keys?"
            />
            <button
              className="send-button"
              aria-label="Ask Thread"
              disabled={asking || !question.trim()}
            >
              <ArrowUp size={21} />
            </button>
          </form>
          {asking && (
            <button
              className="text-button"
              onClick={() => {
                const r = questionAbort.current;
                if (r) {
                  void api("/api/v1/agent/" + r.id + "/cancel", {});
                  r.controller.abort();
                }
              }}
            >
              Cancel reply
            </button>
          )}
          <div className="quick-prompts">
            {[
              "What was I doing?",
              "What do you remember from today?",
              "Where were my keys last seen?",
            ].map((q) => (
              <button
                key={q}
                disabled={asking}
                onClick={() =>
                  voice.current
                    ? voice.current.sendUserMessage(q)
                    : void ask(q).catch(() => {})
                }
              >
                {q}
              </button>
            ))}
          </div>
          <ResultCard result={result} onApply={apply} notify={notify} />
          {turns.length > 0 && (
            <details className="card live-transcript">
              <summary>
                Conversation captions ·{" "}
                {session?.policy.retainTranscript
                  ? "saved in diary"
                  : "not retained"}
              </summary>
              {turns.map((t, i) => (
                <p key={i}>
                  <strong>{t.role === "user" ? "You" : "Thread"}:</strong>{" "}
                  {t.text}
                </p>
              ))}
            </details>
          )}
        </section>
        <aside className="live-context">
          <section className="card context-health">
            <span className="eyebrow">CONNECTED SUPPORT</span>
            <h3>Ready when you are.</h3>
            <p>
              <span
                className={"status-dot " + (status.configured ? "ready" : "")}
              />
              {status.configured
                ? "OpenAI vision & context configured"
                : "OpenAI needs a key"}
            </p>
            <p>
              <span className={"status-dot " + (voiceReady ? "ready" : "")} />
              {voiceReady
                ? "ElevenLabs voice configured"
                : "ElevenLabs voice needs setup"}
            </p>
            <button
              className="text-button"
              onClick={() => navigate("settings")}
            >
              <Settings size={15} />
              Connection settings
            </button>
            <small>
              {remaining} OpenAI calls remain today. Camera observations use one
              call each. Voice has separate ElevenLabs billing.
            </small>
          </section>
          <section className="card familiar-panel">
            <div className="section-head">
              <h3>
                <Heart size={18} />
                Familiar faces
              </h3>
              <button
                className="text-button"
                onClick={() => navigate("people")}
              >
                Manage
              </button>
            </div>
            <p className="fine">
              Choose a familiar photo, then confirm who is with you.
            </p>
            {people.slice(0, 6).map((p) => (
              <button
                className="familiar-person"
                disabled={!active}
                key={p.id}
                onClick={() => setPerson(p)}
              >
                {p.hasPhoto ? (
                  <img
                    src={"/api/v1/people/" + p.id + "/photo"}
                    alt={"Labeled photo of " + p.name}
                  />
                ) : (
                  <span className="avatar">{p.name[0]}</span>
                )}
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.relationship}</small>
                </span>
              </button>
            ))}
            {!people.length && (
              <p className="fine">
                Add someone in Familiar people. Thread will not guess identities
                from the camera.
              </p>
            )}
          </section>
          <section className="card moment-panel">
            <div className="section-head">
              <h3>
                <BookOpen size={18} />
                Moments kept
              </h3>
              <button className="text-button" onClick={() => navigate("diary")}>
                Open diary
              </button>
            </div>
            {events.slice(0, 4).map((e) => (
              <article key={e.id}>
                <small>
                  {stamp(e.capturedAt)} ·{" "}
                  {e.review === "unreviewed"
                    ? "Unconfirmed observation"
                    : e.review}
                </small>
                <strong>{e.title}</strong>
                <p>{e.status === "failed" ? e.error : e.summary}</p>
              </article>
            ))}
            {!events.length && (
              <p className="fine">
                Your first recorded moment will appear here. No recording
                happens until you start.
              </p>
            )}
            {session && (
              <p className="fine">
                {session.policy.retainFrames
                  ? "Images and descriptions"
                  : "Descriptions only"}{" "}
                · kept {session.policy.retentionDays} days. The diary covers
                recorded moments, with gaps when paused or offline.
              </p>
            )}
          </section>
          {sources.length > 0 && (
            <details className="card">
              <summary>Context used for the last answer</summary>
              {sources.map((s) => (
                <article className="source-moment" key={s.id}>
                  <strong>{s.title}</strong>
                  <p>{s.content}</p>
                  <small>
                    {s.author} · {stamp(s.updatedAt || s.createdAt)}
                  </small>
                </article>
              ))}
            </details>
          )}
          {!active && sessions.some((s) => s.status !== "ended") && (
            <section className="card">
              <h3>Pick up a session</h3>
              {sessions
                .filter((s) => s.status !== "ended")
                .slice(0, 3)
                .map((s) => (
                  <button
                    className="session-resume"
                    key={s.id}
                    onClick={() => resume(s)}
                  >
                    <span>
                      {s.title}
                      <small>
                        {s.status} · {stamp(s.startedAt)}
                      </small>
                    </span>
                    <Play size={17} />
                  </button>
                ))}
            </section>
          )}
        </aside>
      </div>
      {setup && (
        <Modal
          title="Let’s begin on your terms"
          onClose={() => setSetup(false)}
        >
          <form onSubmit={begin}>
            <label>
              Session name
              <input
                name="title"
                required
                maxLength={120}
                defaultValue={
                  new Date().toLocaleDateString(undefined, {
                    weekday: "long",
                  }) + " with Thread"
                }
              />
            </label>
            <div className="two-columns">
              <label>
                Check the scene every
                <select name="interval" defaultValue="120">
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes</option>
                  <option value="300">5 minutes</option>
                </select>
              </label>
              <label>
                Keep diary moments for
                <select name="retention" defaultValue="7">
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </select>
              </label>
            </div>
            <p className="fine">
              Changed scenes are analyzed; unchanged views are skipped for up to
              five minutes. This is a diary of selected moments, not continuous
              video. The page must stay visible and your computer awake.
            </p>
            <label className="checkbox">
              <input type="checkbox" required />I choose to send selected camera
              stills to OpenAI and save their descriptions in my diary. I can
              pause or end at any time.
            </label>
            <label className="checkbox">
              <input name="frames" type="checkbox" />
              Also retain the selected images locally
            </label>
            <label className="checkbox">
              <input name="voice" type="checkbox" defaultChecked={voiceReady} />
              Enable live voice: send microphone audio and retrieved diary
              context to ElevenLabs when I press Talk
            </label>
            <label className="checkbox">
              <input name="transcript" type="checkbox" />
              Save voice conversation transcripts in my diary
            </label>
            <p className="fine">
              Raw audio and video are not stored by Thread. OpenAI and
              ElevenLabs process selected inputs in the cloud. Avoid recording
              private spaces or people who do not want to be recorded.
            </p>
            <button className="primary">
              <Check size={18} />
              Start session
            </button>
          </form>
        </Modal>
      )}
      {person && (
        <Modal
          title={"Is " + person.name + " with you?"}
          onClose={() => setPerson(null)}
        >
          {person.hasPhoto && (
            <img
              className="person-confirm-photo"
              src={"/api/v1/people/" + person.id + "/photo"}
              alt={"Caregiver-labeled photo: " + person.name}
            />
          )}
          <h3>
            {person.name} · {person.relationship}
          </h3>
          <p>{person.description}</p>
          <p className="fine">
            You are confirming this labeled person. Thread has not identified
            anyone from the camera.
          </p>
          <div className="button-row">
            <button className="primary" onClick={confirmPerson}>
              <Check size={18} />
              Yes, this is who is with me
            </button>
            <button className="secondary" onClick={() => setPerson(null)}>
              I’m not sure
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
