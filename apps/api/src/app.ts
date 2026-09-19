import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { randomUUID, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zipSync, strToU8 } from "fflate";
import {
  Action,
  KnowledgeInput,
  ReminderInput,
  Preferences,
} from "../../../packages/contracts/src/index";
import {
  createState,
  restoreState,
  transition,
  replyTo,
  recall,
} from "../../../packages/domain/src/index.js";
import {
  runAgent,
  OpenAIProvider,
  AgentAction,
} from "../../../packages/agent/src/index";
import { credentials, handleApi, ApiError } from "../../../backend/api.mjs";
import { Repository, HttpError, iso } from "./repository";
import type { Database } from "./db";
import { decodeImage, type ImageStorage } from "./storage";
import { DiaryRepository } from "./diary";
import { registerAccess } from "./access";
import { registerDiary } from "./diary-routes";
import { registerVoice, type VoiceGateway } from "./elevenlabs";
const mutation = z.object({
  revision: z.number().int().nonnegative(),
  requestId: z.uuid(),
});
const exampleInput = z.object({
  label: z.string().trim().min(1).max(100),
  note: z.string().max(1000).default(""),
  group: z.string().trim().min(1).max(100),
  task: z.enum([
    "object-description",
    "text-reading",
    "scene-description",
    "reminiscence",
  ]),
  consent: z.literal(true),
  image: z.string(),
});
const exampleView = (r: any) => ({
  id: r.id,
  label: r.label,
  note: r.note,
  group: r.group_key,
  split: r.split,
  task: r.task,
  createdAt: iso(r.created_at),
});
export async function createApp(options: {
  db: Database;
  storage: ImageStorage;
  env: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  staticDir?: string;
  scheduler?: boolean;
  voiceGateway?: (key: string) => VoiceGateway;
}) {
  const repo = new Repository(options.db);
  await repo.init();
  const db = options.db,
    env = options.env,
    storage = options.storage;
  const app = Fastify({ logger: false, bodyLimit: 6 * 1024 * 1024 });
  const dailyLimit =
    Number.isFinite(Number(env.MAX_AI_CALLS_PER_DAY)) &&
    Number(env.MAX_AI_CALLS_PER_DAY) > 0
      ? Math.floor(Number(env.MAX_AI_CALLS_PER_DAY))
      : 100;
  const providerFetch: typeof fetch = async (url, init) => {
    const day = new Date().toISOString().slice(0, 10);
    const reserved = await db.query(
      "INSERT INTO ai_budget(day,calls) VALUES($1,1) ON CONFLICT(day) DO UPDATE SET calls=ai_budget.calls+1 WHERE ai_budget.calls < $2 RETURNING calls",
      [day, dailyLimit],
    );
    if (!reserved.rows.length)
      throw new ApiError(
        429,
        "local_budget",
        "The local daily AI-call budget is reached. It resets at midnight UTC.",
      );
    return (options.fetcher || fetch)(url, init);
  };
  const diary = new DiaryRepository(db, storage);
  const controllers = new Map<string, AbortController>();
  let recent: number[] = [];
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin");
    const host = req.headers.host || "";
    if (
      !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) &&
      host !== (env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN).host : "")
    )
      throw new HttpError(
        403,
        "This local app only accepts localhost requests.",
      );
    const origin = req.headers.origin;
    if (origin && origin !== "http://" + host && origin !== env.PUBLIC_ORIGIN)
      throw new HttpError(
        403,
        "This request must come from the local Thread app.",
      );
    if (req.headers["sec-fetch-site"] === "cross-site")
      throw new HttpError(403, "Cross-site requests are not allowed.");
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.url.startsWith("/api/") &&
      (req.headers["x-thread-request"] !== "1" ||
        !req.headers["content-type"]?.startsWith("application/json"))
    )
      throw new HttpError(403, "Use the Thread app to make this change.");
  });
  app.setErrorHandler((error: any, _req, reply) => {
    const validation = error instanceof z.ZodError;
    const status = validation ? 400 : error.statusCode || error.status || 500;
    reply.code(status).send({
      error: {
        message: validation
          ? "Check the form fields: " +
            error.issues
              .map((x: any) => x.path.join(".") + " " + x.message)
              .slice(0, 3)
              .join("; ")
          : status === 500
            ? "The local server could not complete this request. Please try again."
            : error.message,
      },
    });
  });
  function providerRequest(req: any) {
    return new Request(
      (env.PUBLIC_ORIGIN?.startsWith("https://") ? "https://" : "http://") +
        req.headers.host +
        req.url,
      {
        method: req.method,
        headers: req.headers as HeadersInit,
        ...(req.method !== "GET"
          ? { body: JSON.stringify(req.body || {}) }
          : {}),
      },
    );
  }
  for (const route of ["status", "connect", "disconnect", "test"])
    app.route({
      url: "/api/" + route,
      method: route === "status" ? "GET" : "POST",
      handler: async (req, reply) => {
        const result = await handleApi(providerRequest(req), env, {
          fetcher: providerFetch,
        });
        reply.code(result.status);
        result.headers.forEach((v, k) => reply.header(k, v));
        return reply.send(await result.text());
      },
    });
  const access = await registerAccess(app, db, env);
  const diaryRoutes = await registerDiary(app, {
    db,
    storage,
    diary,
    env,
    provider: async (req) => {
      const auth = await credentials(providerRequest(req), env);
      if (!auth)
        throw new HttpError(
          401,
          "Connect OpenAI in Settings before analyzing camera moments.",
        );
      return new OpenAIProvider(auth, providerFetch);
    },
  });
  await registerVoice(app, {
    db,
    env,
    repo,
    diary,
    gateway: options.voiceGateway,
  });
  app.post("/api/v1/transcribe", async (req) => {
    const auth = await credentials(providerRequest(req), env);
    if (!auth)
      throw new HttpError(
        401,
        "Connect an OpenAI key before using AI voice input.",
      );
    recent = recent.filter((t) => t > Date.now() - 60000);
    if (recent.length >= 12)
      throw new HttpError(
        429,
        "Please wait a minute before another voice request.",
      );
    recent.push(Date.now());
    const b = z.object({ audio: z.string().max(5600000) }).parse(req.body),
      match = b.audio.match(
        /^data:(audio\/(?:webm|mp4|wav|mpeg))(?:;codecs=[^;,]+)?;base64,([A-Za-z0-9+/]+=*)$/,
      );
    if (!match)
      throw new HttpError(
        400,
        "This audio format is not supported. Use text input instead.",
      );
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 4 * 1024 * 1024 || bytes.length < 32)
      throw new HttpError(400, "Use a shorter voice message.");
    const form = new FormData();
    form.set("model", env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    form.set(
      "file",
      new Blob([bytes], { type: match[1] }),
      "voice." + match[1].split("/")[1],
    );
    let response: Response;
    try {
      response = await providerFetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { authorization: "Bearer " + auth.apiKey },
          body: form,
          signal: AbortSignal.timeout(30000),
        },
      );
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new HttpError(
        502,
        "Voice transcription could not connect. You can type instead.",
      );
    }
    if (!response.ok)
      throw new HttpError(
        response.status === 401 ? 401 : 502,
        response.status === 401
          ? "The AI key was rejected. Check Settings."
          : "Voice transcription failed. Check API access and billing, or type instead.",
      );
    const result = (await response.json()) as { text?: unknown };
    if (typeof result.text !== "string")
      throw new HttpError(502, "No transcript was returned.");
    return { text: result.text.slice(0, 2000) };
  });
  app.get("/api/v1/bootstrap", async (req) => ({
    identity: await access.identity(req),
    snapshot: await repo.snapshot(),
    knowledge: await repo.knowledge(),
    reminders: await repo.reminders(),
    preferences: await repo.settings(),
    storage: db.kind,
    budget: {
      limit: dailyLimit,
      used:
        (
          await db.query("SELECT calls FROM ai_budget WHERE day=$1", [
            new Date().toISOString().slice(0, 10),
          ])
        ).rows[0]?.calls || 0,
    },
    examples: (
      await db.query("SELECT * FROM examples ORDER BY created_at DESC")
    ).rows.map(exampleView),
  }));
  app.get("/api/v1/state", () => repo.snapshot());
  app.post("/api/v1/action", async (req) => {
    const body = mutation.extend({ action: Action }).parse(req.body);
    return repo.action(body.revision, body.requestId, body.action);
  });
  app.post("/api/v1/import", async (req) => {
    const b = mutation.extend({ state: z.unknown() }).parse(req.body);
    if (b.revision !== 0)
      throw new HttpError(
        409,
        "Import is available only before this workspace has been changed.",
      );
    let state;
    try {
      state = restoreState(JSON.stringify(b.state));
    } catch {
      throw new HttpError(400, "This is not a supported Thread backup.");
    }
    return repo.change(
      b.revision,
      b.requestId,
      { import: state },
      async () => ({
        state,
        reply: "Your earlier browser records were imported.",
      }),
    );
  });
  app.get("/api/v1/knowledge", async (req: any) => {
    const q = z.string().max(300).optional().parse(req.query.q);
    return q ? repo.search(q) : repo.knowledge();
  });
  app.post("/api/v1/knowledge", async (req) => {
    const b = mutation
      .extend({
        note: KnowledgeInput,
        id: z.uuid().optional(),
        noteRevision: z.number().int().optional(),
      })
      .parse(req.body);
    return repo.saveKnowledge(
      b.note,
      b.revision,
      b.requestId,
      b.id,
      b.noteRevision,
    );
  });
  app.post("/api/v1/knowledge/:id/delete", async (req: any) => {
    const b = mutation.parse(req.body);
    return repo.removeKnowledge(
      z.uuid().parse(req.params.id),
      b.revision,
      b.requestId,
    );
  });
  app.get("/api/v1/knowledge/:id/history", async (req: any) => {
    const id = z.uuid().parse(req.params.id);
    return (
      await db.query(
        "SELECT data,changed_at FROM knowledge_history WHERE id=$1 ORDER BY revision DESC",
        [id],
      )
    ).rows.map((r) => ({ note: r.data, changedAt: iso(r.changed_at) }));
  });
  app.post("/api/v1/reminders", async (req) => {
    const b = mutation.extend({ reminder: ReminderInput }).parse(req.body);
    if (Date.parse(b.reminder.dueAt) < Date.now() - 1000)
      throw new HttpError(400, "Choose a future reminder time.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: b.reminder.timezone });
    } catch {
      throw new HttpError(400, "Choose a valid time zone.");
    }
    return repo.change(
      b.revision,
      b.requestId,
      b.reminder,
      async (state, tx) => {
        await tx.query(
          "INSERT INTO reminders(id,title,due_at,timezone) VALUES($1,$2,$3,$4)",
          [
            randomUUID(),
            b.reminder.title,
            b.reminder.dueAt,
            b.reminder.timezone,
          ],
        );
        return { state, reply: "Reminder scheduled." };
      },
    );
  });
  app.get("/api/v1/reminders", () => repo.reminders());
  app.post("/api/v1/reminders/:id", async (req: any) => {
    const b = mutation
        .extend({ operation: z.enum(["acknowledge", "snooze", "delete"]) })
        .parse(req.body),
      id = z.uuid().parse(req.params.id);
    return repo.change(
      b.revision,
      b.requestId,
      { id, op: b.operation },
      async (state, tx) => {
        if (b.operation === "delete")
          await tx.query("DELETE FROM reminders WHERE id=$1", [id]);
        else if (b.operation === "snooze")
          await tx.query(
            "UPDATE reminders SET due_at=now()+interval '10 minutes',status='scheduled' WHERE id=$1",
            [id],
          );
        else
          await tx.query(
            "UPDATE reminders SET status='acknowledged' WHERE id=$1",
            [id],
          );
        return {
          state,
          reply:
            b.operation === "snooze"
              ? "Snoozed for 10 minutes."
              : "Reminder updated.",
        };
      },
    );
  });
  app.post("/api/v1/preferences", async (req) => {
    const b = mutation.extend({ preferences: Preferences }).parse(req.body);
    return repo.change(
      b.revision,
      b.requestId,
      b.preferences,
      async (state, tx) => {
        await tx.query("UPDATE settings SET data=$1 WHERE id=1", [
          JSON.stringify(b.preferences),
        ]);
        return { state, reply: "Preferences saved." };
      },
    );
  });
  app.post("/api/v1/agent", async (req) => {
    const b = z
      .object({
        id: z.uuid(),
        message: z.string().trim().min(1).max(2000),
        purpose: z
          .enum(["chat", "routine", "summary", "test", "message"])
          .default("chat"),
        image: z.string().optional(),
        requireReview: z.boolean().default(false),
        timezone: z.string().max(80).default("UTC"),
      })
      .parse(req.body);
    if (b.image) decodeImage(b.image);
    const existing = (
      await db.query("SELECT * FROM agent_runs WHERE id=$1", [b.id])
    ).rows[0];
    if (existing)
      throw new HttpError(
        409,
        "This request was already submitted. Check Activity before trying again.",
      );
    if (controllers.size >= 2)
      throw new HttpError(
        429,
        "Two requests are already running. Please wait or cancel one.",
      );
    recent = recent.filter((t) => t > Date.now() - 60000);
    if (recent.length >= 12)
      throw new HttpError(
        429,
        "Please wait a minute before sending more AI requests.",
      );
    recent.push(Date.now());
    const snapshot = await repo.snapshot(),
      ctrl = new AbortController();
    controllers.set(b.id, ctrl);
    const timer = setTimeout(() => ctrl.abort(), 90000);
    let trace: any[] = [];
    const began = Date.now(),
      usage = { inputTokens: 0, outputTokens: 0, modelCalls: 0 };
    try {
      await db.query(
        "INSERT INTO agent_runs(id,status,question,revision) VALUES($1,'running',$2,$3)",
        [b.id, b.message, snapshot.revision],
      );
    } catch (error) {
      clearTimeout(timer);
      controllers.delete(b.id);
      throw error;
    }
    const appendTrace = async (event: any) => {
      trace.push(event);
      await db.query(
        "UPDATE agent_runs SET trace=$2,updated_at=now() WHERE id=$1",
        [b.id, JSON.stringify(trace)],
      );
    };
    try {
      const auth = await credentials(providerRequest(req), env);
      const explicit =
        !b.requireReview &&
        b.purpose === "chat" &&
        !b.image &&
        /^(remember (?:to|that) |i (?:put|left|placed) )/i.test(b.message);
      let result: any,
        mode = "basic";
      if (explicit) {
        const command = replyTo(snapshot.state, b.message);
        const saved = await repo.change(
          snapshot.revision,
          b.id,
          { command: b.message },
          async () => command,
        );
        trace = [
          { tool: "save_memory", status: "completed", detail: command.reply },
        ];
        result = {
          reply: command.reply,
          actions: [],
          sources: [],
          revision: saved.revision,
        };
      } else if (auth) {
        mode = "live";
        result = await runAgent(
          new OpenAIProvider(auth, providerFetch, (u) => {
            usage.modelCalls++;
            usage.inputTokens += Number(u?.input_tokens || 0);
            usage.outputTokens += Number(u?.output_tokens || 0);
          }),
          b.message,
          b.image,
          {
            state: snapshot.state,
            search: (q) => repo.search(q),
            diary: (q) => diary.context(q),
            people: () => diary.people(),
            reminders: () => repo.reminders(),
            trace: appendTrace,
            signal: ctrl.signal,
            purpose: b.purpose,
            timezone: b.timezone,
          },
        );
      } else {
        if (b.image || ["routine", "summary", "message"].includes(b.purpose))
          throw new HttpError(
            401,
            "Connect an OpenAI key in Settings to use this AI feature.",
          );
        const sources = [
          ...(await repo.search(b.message)),
          ...(await diary.context(b.message)),
        ];
        result = {
          reply: sources.length
            ? "From your saved records:\n\n" +
              sources
                .map((k) => k.title + ": " + k.content + " — " + k.author)
                .join("\n\n")
            : replyTo(snapshot.state, b.message).reply,
          actions: [],
          sources,
        };
        trace = [
          {
            tool: "search_knowledge",
            status: "completed",
            detail: sources.length
              ? "Quoted matching notes. Basic mode; no AI request was made."
              : "Basic mode: checked saved routines and notes.",
          },
        ];
        if (!sources.length) {
          const command = replyTo(snapshot.state, b.message);
          if (
            JSON.stringify(command.state.active) !==
              JSON.stringify(snapshot.state.active) ||
            JSON.stringify(command.state.requests) !==
              JSON.stringify(snapshot.state.requests)
          )
            result.reply =
              "Use the routine controls or Ask for help button to confirm this change. " +
              recall(snapshot.state);
        }
      }
      ctrl.signal.throwIfAborted();
      let revision = result.revision,
        stale = false;
      if (revision === undefined) {
        try {
          const saved = await repo.change(
            snapshot.revision,
            b.id,
            { conversation: b.message, reply: result.reply },
            async (state) => {
              state.messages.push(
                { role: "user", text: b.message },
                { role: "assistant", text: result.reply },
              );
              state.messages = state.messages.slice(-40);
              return { state };
            },
          );
          revision = saved.revision;
        } catch (e) {
          if (!(e instanceof HttpError) || e.statusCode !== 409) throw e;
          stale = true;
          result.actions = [];
          revision = (await repo.snapshot()).revision;
          trace.push({
            tool: "check_revision",
            status: "stale",
            detail:
              "Records changed during the reply. Suggestions were discarded.",
          });
        }
      }
      await db.query(
        "UPDATE agent_runs SET status='completed',reply=$2,actions=$3,sources=$4,trace=$5,revision=$6,mode=$7,model=$8,updated_at=now() WHERE id=$1",
        [
          b.id,
          result.reply,
          JSON.stringify(result.actions),
          JSON.stringify(
            result.sources.map((k: any) => ({
              id: k.id,
              title: k.title,
              revision: k.revision,
              author: k.author,
              updatedAt: k.updatedAt,
            })),
          ),
          JSON.stringify(trace),
          revision,
          mode,
          auth?.model || null,
        ],
      );
      await db.query("UPDATE agent_runs SET metrics=$2 WHERE id=$1", [
        b.id,
        JSON.stringify({ ...usage, durationMs: Date.now() - began }),
      ]);
      return {
        id: b.id,
        ...result,
        revision,
        trace,
        mode,
        model: auth?.model,
        stale,
      };
    } catch (error: any) {
      const cancelled = ctrl.signal.aborted;
      await db.query(
        "UPDATE agent_runs SET status=$2,reply=$3,trace=$4,updated_at=now() WHERE id=$1",
        [
          b.id,
          cancelled ? "cancelled" : "failed",
          cancelled
            ? "Request cancelled."
            : error.status || error.statusCode
              ? error.message
              : "The AI request failed. Please try again.",
          JSON.stringify(trace),
        ],
      );
      if (cancelled) throw new HttpError(408, "Request cancelled.");
      if (error.status || error.statusCode) throw error;
      throw new HttpError(
        502,
        error instanceof z.ZodError
          ? "The AI returned an invalid action. Nothing was applied."
          : error.message || "The AI request failed.",
      );
    } finally {
      clearTimeout(timer);
      controllers.delete(b.id);
    }
  });
  app.post("/api/v1/agent/:id/cancel", async (req: any) => {
    controllers.get(z.uuid().parse(req.params.id))?.abort();
    return { cancelled: true };
  });
  app.post("/api/v1/agent/:id/apply", async (req: any) => {
    const id = z.uuid().parse(req.params.id),
      b = mutation
        .extend({
          index: z.number().int().min(0).max(2),
          edited: AgentAction.optional(),
        })
        .parse(req.body);
    return repo.change(
      b.revision,
      b.requestId,
      { runId: id, index: b.index, edited: b.edited },
      async (state, tx) => {
        const run = (
          await tx.query("SELECT * FROM agent_runs WHERE id=$1", [id])
        ).rows[0];
        if (!run || run.status !== "completed" || run.revision !== b.revision)
          throw new HttpError(
            409,
            "This suggestion is out of date. Ask Thread again.",
          );
        if (run.applied.includes(b.index))
          throw new HttpError(409, "This suggestion has already been applied.");
        const original = AgentAction.parse(run.actions[b.index]);
        let action = original;
        if (b.edited) {
          if (
            original.type !== "routine-create" ||
            b.edited.type !== "routine-create"
          )
            throw new HttpError(
              400,
              "Only a routine draft can be edited here.",
            );
          action = b.edited;
        }
        let result;
        if (action.type === "reminder-create") {
          if (Date.parse(action.dueAt) <= Date.now())
            throw new HttpError(400, "This reminder time has passed.");
          try {
            new Intl.DateTimeFormat("en", { timeZone: action.timezone });
          } catch {
            throw new HttpError(400, "This reminder has an invalid time zone.");
          }
          await tx.query(
            "INSERT INTO reminders(id,title,due_at,timezone) VALUES($1,$2,$3,$4)",
            [randomUUID(), action.title, action.dueAt, action.timezone],
          );
          result = { state, reply: "Reminder scheduled." };
        } else result = transition(state, action);
        result.state.messages.push({ role: "assistant", text: result.reply });
        result.state.messages = result.state.messages.slice(-40);
        const applied = [...run.applied, b.index];
        await tx.query(
          "UPDATE agent_runs SET applied=$2,revision=$3,trace=$4,updated_at=now() WHERE id=$1",
          [
            id,
            JSON.stringify(applied),
            b.revision + 1,
            JSON.stringify([
              ...run.trace,
              { tool: action.type, status: "completed", detail: result.reply },
            ]),
          ],
        );
        return result;
      },
    );
  });
  app.get(
    "/api/v1/runs",
    async () =>
      (
        await db.query(
          "SELECT id,status,question,reply,trace,actions,applied,revision,mode,model,sources,feedback,correction,metrics,created_at FROM agent_runs ORDER BY created_at DESC LIMIT 40",
        )
      ).rows,
  );
  app.post("/api/v1/agent/:id/feedback", async (req: any) => {
    const id = z.uuid().parse(req.params.id),
      b = z
        .object({
          rating: z.enum(["helpful", "needs-correction"]),
          correction: z.string().max(2000).default(""),
        })
        .parse(req.body);
    await db.query(
      "UPDATE agent_runs SET feedback=$2,correction=$3 WHERE id=$1",
      [id, b.rating, b.correction],
    );
    return { saved: true };
  });
  app.post("/api/v1/examples", async (req) => {
    const b = exampleInput.parse(req.body);
    if (
      Number(
        (await db.query("SELECT count(*) AS n FROM examples")).rows[0].n,
      ) >= 100
    )
      throw new HttpError(
        400,
        "Export or remove examples before adding more than 100.",
      );
    const blob = await storage.put(b.image),
      id = randomUUID();
    const split =
      createHash("sha256").update(b.group.toLowerCase().trim()).digest()[0] %
        5 ===
      0
        ? "validation"
        : "train";
    try {
      await db.query(
        "INSERT INTO examples(id,label,note,group_key,split,task,blob_key,mime) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          b.label,
          b.note,
          b.group.trim().toLowerCase(),
          split,
          b.task,
          blob.key,
          blob.mime,
        ],
      );
    } catch (e) {
      await storage.remove(blob.key);
      throw e;
    }
    return { id, split, saved: true };
  });
  app.get("/api/v1/examples/:id/image", async (req: any, reply) => {
    const r = (
      await db.query("SELECT * FROM examples WHERE id=$1", [
        z.uuid().parse(req.params.id),
      ])
    ).rows[0];
    if (!r) throw new HttpError(404, "Image not found.");
    return reply.type(r.mime).send(await storage.read(r.blob_key));
  });
  app.post("/api/v1/examples/:id", async (req: any) => {
    const id = z.uuid().parse(req.params.id),
      b = exampleInput.omit({ image: true, consent: true }).parse(req.body);
    const group = b.group.trim().toLowerCase(),
      split =
        createHash("sha256").update(group).digest()[0] % 5 === 0
          ? "validation"
          : "train";
    await db.query(
      "UPDATE examples SET label=$2,note=$3,group_key=$4,split=$5,task=$6 WHERE id=$1",
      [id, b.label, b.note, group, split, b.task],
    );
    return { saved: true };
  });
  app.post("/api/v1/examples/:id/delete", async (req: any) => {
    const id = z.uuid().parse(req.params.id),
      r = (
        await db.query("DELETE FROM examples WHERE id=$1 RETURNING blob_key", [
          id,
        ])
      ).rows[0];
    if (r) await storage.remove(r.blob_key);
    return { deleted: true };
  });
  app.get("/api/v1/dataset/export", async (_req, reply) => {
    const examples = (
        await db.query("SELECT * FROM examples ORDER BY created_at")
      ).rows,
      files: Record<string, Uint8Array> = {},
      manifest: any[] = [];
    for (const e of examples) {
      const file =
        "images/" +
        e.id +
        "." +
        (e.mime === "image/jpeg" ? "jpg" : e.mime.split("/")[1]);
      files[file] = await storage.read(e.blob_key);
      manifest.push({
        ...exampleView(e),
        image: file,
        source: "Explicitly reviewed and retained by user",
      });
    }
    files["manifest.json"] = strToU8(
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          modelTrained: false,
          examples: manifest,
        },
        null,
        2,
      ),
    );
    files["README.txt"] = strToU8(
      "Reviewed local examples. No model has been trained. Groups share a split to reduce leakage. Inspect labels, consent and held-out coverage before any future training. No upload or training job has been started.",
    );
    return reply
      .type("application/zip")
      .header(
        "Content-Disposition",
        'attachment; filename="thread-reviewed-examples.zip"',
      )
      .send(Buffer.from(zipSync(files, { level: 0 })));
  });
  app.get("/api/v1/export", async (_req, reply) =>
    reply
      .header(
        "Content-Disposition",
        'attachment; filename="thread-records.json"',
      )
      .send({
        format: "thread-local-v1",
        exportedAt: new Date().toISOString(),
        snapshot: await repo.snapshot(),
        knowledge: await repo.knowledge(),
        history: (await db.query("SELECT * FROM knowledge_history")).rows,
        reminders: await repo.reminders(),
        preferences: await repo.settings(),
        evaluations: (
          await db.query(
            "SELECT question,reply,feedback,correction,sources,mode,model,metrics FROM agent_runs WHERE feedback IS NOT NULL",
          )
        ).rows,
        examples: (await db.query("SELECT * FROM examples")).rows.map(
          exampleView,
        ),
        diary: {
          sessions: await diary.sessions(),
          events: (
            await db.query(
              "SELECT id,session_id,kind,status,review,title,summary,category,tags,details,captured_at,expires_at FROM diary_events WHERE expires_at>now() ORDER BY captured_at",
            )
          ).rows,
          corrections: (await db.query("SELECT * FROM diary_corrections")).rows,
        },
        people: await diary.people(),
      }),
  );
  app.post("/api/v1/privacy/clear", async () => {
    if (controllers.size || diaryRoutes.busy())
      throw new HttpError(
        409,
        "Cancel or finish active AI requests before clearing records.",
      );
    if ((await diary.sessions()).some((s) => s.status === "active"))
      throw new HttpError(409, "End the live session before clearing records.");
    const images = (
      await db.query(
        "SELECT blob_key FROM examples UNION ALL SELECT blob_key FROM diary_events WHERE blob_key IS NOT NULL UNION ALL SELECT blob_key FROM trusted_people WHERE blob_key IS NOT NULL",
      )
    ).rows;
    await db.transaction(async (tx) => {
      for (const table of [
        "diary_corrections",
        "diary_digests",
        "diary_events",
        "voice_sessions",
        "diary_sessions",
        "trusted_people",
        "knowledge_history",
        "knowledge",
        "reminders",
        "examples",
        "agent_runs",
        "commands",
      ])
        await tx.query("DELETE FROM " + table);
      await tx.query(
        "UPDATE app_state SET data=$1,revision=revision+1 WHERE id=1",
        [JSON.stringify(createState())],
      );
    });
    for (const image of images) await storage.remove(image.blob_key);
    return { cleared: true };
  });
  let scheduler: NodeJS.Timeout | undefined;
  if (options.scheduler !== false) {
    await repo.cleanup();
    await diary.cleanup();
    scheduler = setInterval(() => {
      repo.reminders().catch(() => {});
      repo.cleanup().catch(() => {});
      diary.cleanup().catch(() => {});
    }, 15000);
    scheduler.unref();
  }
  app.addHook("onClose", async () => {
    if (scheduler) clearInterval(scheduler);
    controllers.forEach((c) => c.abort());
  });
  if (options.staticDir && existsSync(options.staticDir)) {
    await app.register(fastifyStatic, { root: options.staticDir });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: { message: "Endpoint not found." } })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
