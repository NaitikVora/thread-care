import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../apps/api/src/db";
import { createApp } from "../apps/api/src/app";
import { LocalImageStorage } from "../apps/api/src/storage";
import { DiaryRepository } from "../apps/api/src/diary";
import {
  ElevenGateway,
  SecretVault,
  type VoiceGateway,
} from "../apps/api/src/elevenlabs";
const secret = "test-only-long-stable-encryption-secret-no-real-access";
const key = "sk-test-only-never-used-for-network-123456789";
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5eQAAAAASUVORK5CYII=";
const observation = {
  title: "Keys on a blue tray",
  summary: "A set of keys is visible on a blue tray beside a cup.",
  category: "objects",
  tags: ["keys", "tray", "cup"],
  objects: [{ name: "keys", location: "on a blue tray" }],
  visibleText: "",
  uncertainty:
    "This still does not establish who left the keys or whether they remain there.",
};
const response = (value: any) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(value) }],
        },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
    }),
  );
const voice: VoiceGateway = {
  verify: async () => ({
    auth: true,
    tools: [
      "search_context",
      "inspect_current_view",
      "get_familiar_people",
      "prepare_action",
    ],
    recordVoice: false,
    retentionDays: 1,
  }),
  create: async () => "agent_test_fixture",
  syncInstructions: async () => {},
  sign: async () =>
    "wss://api.elevenlabs.io/v1/convai/conversation?fixture=not-real",
};
async function setup(
  t: any,
  options: {
    fetcher?: typeof fetch;
    noKey?: boolean;
    env?: Record<string, string>;
    voiceGateway?: () => VoiceGateway;
  } = {},
) {
  const dir = await mkdtemp(path.join(tmpdir(), "thread-day-test-")),
    db = await openDatabase("memory://"),
    storage = new LocalImageStorage(path.join(dir, "images"));
  const app = await createApp({
    db,
    storage,
    env: {
      SESSION_SECRET: secret,
      ...(!options.noKey ? { OPENAI_API_KEY: key } : {}),
      ...options.env,
    },
    scheduler: false,
    fetcher: options.fetcher || (async () => response(observation)),
    voiceGateway: options.voiceGateway || (() => voice),
  });
  t.after(async () => {
    await app.close();
    await db.close();
    await rm(dir, { recursive: true, force: true });
  });
  const send = (url: string, body?: any, cookie?: string) =>
    app.inject({
      url,
      method: body === undefined ? "GET" : "POST",
      headers: {
        host: "localhost",
        ...(body !== undefined
          ? { "content-type": "application/json", "x-thread-request": "1" }
          : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { payload: body }),
    });
  const start = async (policy: any = {}) => {
    const r = await send("/api/v1/diary/sessions", {
      id: randomUUID(),
      title: "Test day",
      policy: { cloudConsent: true, voiceConsent: true, ...policy },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  return { app, db, storage, send, start };
}
test("diary sessions require consent and have durable start, pause, resume and end states", async (t) => {
  const f = await setup(t),
    id = randomUUID(),
    body = { id, title: "My day", policy: { cloudConsent: true } };
  assert.equal(
    (
      await f.send("/api/v1/diary/sessions", {
        ...body,
        policy: { cloudConsent: false },
      })
    ).statusCode,
    400,
  );
  assert.equal((await f.send("/api/v1/diary/sessions", body)).statusCode, 200);
  assert.equal((await f.send("/api/v1/diary/sessions", body)).statusCode, 200);
  assert.equal(
    (await f.send("/api/v1/diary/sessions", { ...body, id: randomUUID() }))
      .statusCode,
    409,
  );
  assert.equal(
    (
      await f.send("/api/v1/diary/sessions/" + id, { operation: "pause" })
    ).json().status,
    "paused",
  );
  assert.equal(
    (
      await f.send("/api/v1/diary/sessions/" + id, { operation: "resume" })
    ).json().status,
    "active",
  );
  assert.equal(
    (await f.send("/api/v1/diary/sessions/" + id, { operation: "end" })).json()
      .status,
    "ended",
  );
  assert.equal(
    (await f.send("/api/v1/diary/sessions/" + id, { operation: "resume" }))
      .statusCode,
    409,
  );
});
test("camera uses real provider contract, stores unreviewed evidence, and deduplicates capture IDs", async (t) => {
  let calls = 0;
  const f = await setup(t, {
      fetcher: async (_url, init) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        assert.equal(body.store, false);
        assert.equal(body.text.format.name, "diary_observation");
        assert.equal(body.input[0].content[1].image_url, png);
        assert.match(body.instructions, /Do not identify people/);
        return response(observation);
      },
    }),
    s = await f.start(),
    b = {
      id: randomUUID(),
      sessionId: s.id,
      capturedAt: new Date().toISOString(),
      image: png,
    };
  const r = await f.send("/api/v1/diary/capture", b);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().review, "unreviewed");
  assert.equal(r.json().hasImage, false);
  assert.equal((await f.send("/api/v1/diary/capture", b)).statusCode, 200);
  assert.equal(calls, 1);
  assert.equal(
    (
      await f.send("/api/v1/diary/capture", {
        ...b,
        capturedAt: new Date(Date.now() + 500).toISOString(),
      })
    ).statusCode,
    409,
  );
  const search = await f.send("/api/v1/diary?q=keys");
  assert.equal(search.json().events[0].id, b.id);
  assert.equal(
    (await f.send("/api/v1/diary/" + b.id + "/image")).statusCode,
    404,
  );
});
test("no-key, paused and stale-heartbeat sessions cannot send camera frames", async (t) => {
  const f = await setup(t, {
      noKey: true,
      fetcher: async () => {
        throw new Error("Unexpected provider call");
      },
    }),
    s = await f.start(),
    body = {
      id: randomUUID(),
      sessionId: s.id,
      capturedAt: new Date().toISOString(),
      image: png,
    };
  assert.equal((await f.send("/api/v1/diary/capture", body)).statusCode, 401);
  await f.send("/api/v1/diary/sessions/" + s.id, { operation: "pause" });
  assert.equal((await f.send("/api/v1/diary/capture", body)).statusCode, 409);
  await f.send("/api/v1/diary/sessions/" + s.id, { operation: "resume" });
  await f.db.query(
    "UPDATE diary_sessions SET heartbeat_at=now()-interval '2 minutes'",
  );
  assert.equal((await f.send("/api/v1/diary/capture", body)).statusCode, 409);
  assert.equal(
    (await f.send("/api/v1/diary/sessions")).json()[0].status,
    "interrupted",
  );
});
test("retained source images, corrections, expiry and deletion are enforced", async (t) => {
  const f = await setup(t),
    s = await f.start({ retainFrames: true, retentionDays: 1 }),
    id = randomUUID();
  const r = await f.send("/api/v1/diary/capture", {
    id,
    sessionId: s.id,
    capturedAt: new Date().toISOString(),
    image: png,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await f.send("/api/v1/diary/" + id + "/image")).headers["content-type"],
    "image/png",
  );
  const edit = await f.send("/api/v1/diary/" + id + "/review", {
    revision: 1,
    title: "Spare keys",
    summary: "I placed my spare keys in the green drawer.",
    author: "Patient",
  });
  assert.equal(edit.statusCode, 200, edit.body);
  assert.equal(edit.json().review, "corrected");
  assert.equal(
    (await f.send("/api/v1/diary/" + id + "/history")).json()[0].previous
      .summary,
    observation.summary,
  );
  assert.equal(
    (
      await f.send("/api/v1/diary/" + id + "/review", {
        revision: 1,
        title: "Bad",
        summary: "Stale change",
        author: "Patient",
      })
    ).statusCode,
    409,
  );
  const found = (await f.send("/api/v1/diary?q=drawer")).json().events;
  assert.equal(found[0].id, id);
  await f.db.query(
    "UPDATE diary_events SET expires_at=now()-interval '1 second'",
  );
  await new DiaryRepository(f.db, f.storage).cleanup();
  assert.equal(
    (await f.send("/api/v1/diary/" + id + "/image")).statusCode,
    404,
  );
  assert.deepEqual((await f.send("/api/v1/diary?q=drawer")).json().events, []);
});
test("pause cancels an in-flight provider call without accepting its observation", async (t) => {
  let ready!: () => void;
  const began = new Promise<void>((r) => (ready = r));
  const f = await setup(t, {
      fetcher: async (_url, init) =>
        new Promise((_resolve, reject) => {
          ready();
          init!.signal!.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    }),
    s = await f.start(),
    id = randomUUID();
  const pending = f.send("/api/v1/diary/capture", {
    id,
    sessionId: s.id,
    capturedAt: new Date().toISOString(),
    image: png,
  });
  await began;
  await f.send("/api/v1/diary/sessions/" + s.id, { operation: "pause" });
  assert.equal((await pending).statusCode, 408);
  assert.equal(
    (await f.send("/api/v1/diary/session/" + s.id + "/events")).json()[0]
      .status,
    "failed",
  );
  assert.equal((await f.send("/api/v1/diary?q=keys")).json().events.length, 0);
});
test("trusted people are labeled profiles; encounters require patient confirmation", async (t) => {
  const f = await setup(t),
    s = await f.start(),
    b = {
      name: "Maya Fixture",
      relationship: "daughter",
      description: "Enjoys gardening",
      author: "QA",
      consent: true,
      photo: png,
    };
  assert.equal(
    (await f.send("/api/v1/people", { ...b, consent: false })).statusCode,
    400,
  );
  const p = (await f.send("/api/v1/people", b)).json();
  assert(p.hasPhoto);
  assert.equal(
    (await f.send("/api/v1/people/" + p.id + "/photo")).statusCode,
    200,
  );
  const encounter = {
    id: randomUUID(),
    sessionId: s.id,
    personId: p.id,
    confirmed: true,
  };
  assert.equal(
    (await f.send("/api/v1/diary/person", { ...encounter, confirmed: false }))
      .statusCode,
    400,
  );
  const r = await f.send("/api/v1/diary/person", encounter);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().review, "confirmed");
  assert.match(r.json().details.confirmation, /no face recognition/);
  await f.send("/api/v1/people/" + p.id + "/delete", {});
  assert.equal(
    (await f.send("/api/v1/people/" + p.id + "/photo")).statusCode,
    404,
  );
  assert.equal((await f.send("/api/v1/diary?q=Maya")).json().events.length, 1);
});
test("voice credentials are encrypted, signed URL issuance requires consent, and context reads real records", async (t) => {
  const f = await setup(t),
    s = await f.start({ voiceConsent: false });
  const connected = await f.send("/api/v1/voice/connect", {
    apiKey: "eleven-test-secret-key-not-real",
    createAgent: true,
  });
  assert.equal(connected.statusCode, 200, connected.body);
  const stored = (await f.db.query("SELECT sealed FROM integration_secrets"))
    .rows[0].sealed;
  assert(!stored.includes("eleven-test"));
  assert.equal(
    (await f.send("/api/v1/voice/status")).body.includes("eleven-test-secret"),
    false,
  );
  assert.equal(
    (await f.send("/api/v1/voice/session", { sessionId: s.id })).statusCode,
    403,
  );
  await f.send("/api/v1/diary/sessions/" + s.id, { operation: "end" });
  const next = await f.start();
  await f.send("/api/v1/diary/note", {
    id: randomUUID(),
    sessionId: next.id,
    title: "Garden",
    text: "I planted a sunflower.",
  });
  const context = await f.send("/api/v1/voice/context", {
    sessionId: next.id,
    query: "sunflower",
  });
  assert.equal(context.statusCode, 200, context.body);
  assert.match(context.body, /sunflower/);
  assert.equal(
    (await f.send("/api/v1/voice/session", { sessionId: next.id }))
      .json()
      .signedUrl.startsWith("wss://api.elevenlabs.io/"),
    true,
  );
  const backup = await f.send("/api/v1/export");
  assert.equal(backup.body.includes("eleven-test-secret"), false);
  assert.equal(backup.body.includes(stored), false);
  const wrong = new SecretVault(
    f.db,
    "a-different-long-test-secret-with-no-real-access",
  );
  await assert.rejects(() => wrong.get("elevenlabs"));
});
test("voice transcript retention is opt-in and assistant replies never become retrieval evidence", async (t) => {
  const f = await setup(t),
    s = await f.start();
  const transcript = {
    id: randomUUID(),
    sessionId: s.id,
    role: "user",
    text: "My umbrella is in the garage.",
  };
  assert.equal(
    (await f.send("/api/v1/voice/transcript", transcript)).json().saved,
    false,
  );
  await f.send("/api/v1/diary/sessions/" + s.id, { operation: "end" });
  const next = await f.start({ retainTranscript: true });
  assert.equal(
    (
      await f.send("/api/v1/voice/transcript", {
        ...transcript,
        sessionId: next.id,
      })
    ).json().saved,
    true,
  );
  await f.send("/api/v1/voice/transcript", {
    id: randomUUID(),
    sessionId: next.id,
    role: "agent",
    text: "A hallucinated golden elephant is in the garage.",
  });
  assert.equal(
    (await f.send("/api/v1/diary?q=elephant")).json().events.length,
    0,
  );
  assert.equal(
    (await f.send("/api/v1/diary?q=umbrella")).json().events.length,
    1,
  );
});
test("natural-language agent can search the diary and voice proposals cannot bypass confirmation", async (t) => {
  let calls = 0;
  const f = await setup(t, {
    fetcher: async (_url, init) => {
      calls++;
      const p = JSON.parse(String(init?.body));
      if (calls === 1)
        return new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "function_call",
                name: "search_diary",
                call_id: "d1",
                arguments: '{"query":"umbrella"}',
              },
            ],
          }),
        );
      assert(
        p.input.some(
          (i: any) =>
            i.type === "function_call_output" && i.output.includes("garage"),
        ),
      );
      return response({
        reply:
          "The diary says your umbrella was in the garage. I can prepare that memory for review.",
        actions: [{ type: "object", name: "umbrella", location: "garage" }],
      });
    },
  });
  await f.send("/api/v1/diary/note", {
    id: randomUUID(),
    title: "Umbrella",
    text: "My umbrella is in the garage.",
  });
  const r = await f.send("/api/v1/agent", {
    id: randomUUID(),
    message: "Remember that the umbrella is in the garage",
    requireReview: true,
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(calls, 2);
  assert.equal(r.json().actions.length, 1);
  assert.equal((await f.send("/api/v1/state")).json().state.objects.length, 0);
  assert(r.json().sources.some((s: any) => s.title === "Umbrella"));
});
test("recap validates source IDs and does not silently accept fabricated citations", async (t) => {
  const f = await setup(t, {
    fetcher: async () =>
      response({
        summary: "A day recap.",
        highlights: [
          {
            title: "Invented",
            description: "Not a real record",
            sourceIds: [randomUUID()],
          },
        ],
      }),
  });
  await f.send("/api/v1/diary/note", {
    id: randomUUID(),
    title: "Garden",
    text: "I watered a plant.",
  });
  const r = await f.send("/api/v1/diary/summary", {
    day: new Date().toISOString().slice(0, 10),
    timezone: "UTC",
  });
  assert.equal(r.statusCode, 502, r.body);
  assert.equal(
    (await f.db.query("SELECT * FROM diary_digests")).rows.length,
    0,
  );
});
test("private household sessions and patient role block caregiver mutations", async (t) => {
  const f = await setup(t, {
    env: {
      THREAD_CAREGIVER_PASSWORD: "caregiver-test-password-123",
      THREAD_PATIENT_PASSWORD: "patient-test-password-456",
    },
  });
  assert.equal((await f.send("/api/v1/bootstrap")).statusCode, 401);
  assert.equal(
    (await f.send("/api/auth/login", { role: "patient", password: "wrong" }))
      .statusCode,
    401,
  );
  const login = await f.send("/api/auth/login", {
      role: "patient",
      password: "patient-test-password-456",
    }),
    cookie = String(login.headers["set-cookie"]).split(";")[0];
  assert.equal(login.statusCode, 200, login.body);
  assert.equal(
    (await f.send("/api/v1/bootstrap", undefined, cookie)).json().identity.role,
    "patient",
  );
  assert.equal(
    (
      await f.send(
        "/api/v1/voice/connect",
        { apiKey: "test-key-no-access", createAgent: true },
        cookie,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await f.send("/api/v1/action", { action: { type: "profile" } }, cookie))
      .statusCode,
    403,
  );
  assert.equal((await f.send("/api/v1/people", {}, cookie)).statusCode, 403);
  assert.equal(
    (await f.send("/api/v1/voice/sync", {}, cookie)).statusCode,
    403,
  );
  await f.send("/api/auth/logout", {}, cookie);
  assert.equal(
    (await f.send("/api/v1/people", undefined, cookie)).statusCode,
    401,
  );
});
test("ElevenLabs official SDK serializes a private agent and signed-url request correctly", async () => {
  const original = globalThis.fetch;
  let created: any;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.match(url, /^https:\/\/api\.elevenlabs\.io\//);
    if (url.includes("/agents/create")) {
      created = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ agent_id: "agent_sdk_contract" }));
    }
    assert.match(url, /get-signed-url/);
    assert.match(url, /agent_id=agent_sdk_contract/);
    return new Response(
      JSON.stringify({
        signed_url:
          "wss://api.elevenlabs.io/v1/convai/conversation?contract=only",
      }),
    );
  };
  try {
    const sdk = new ElevenGateway("test-sdk-only-no-real-secret");
    const id = await sdk.create();
    assert.equal(id, "agent_sdk_contract");
    assert.equal(created.platform_settings.auth.enable_auth, true);
    assert.equal(created.platform_settings.privacy.record_voice, false);
    assert.equal(created.conversation_config.agent.prompt.tools.length, 4);
    assert(
      created.conversation_config.agent.prompt.tools.every(
        (t: any) => t.expects_response,
      ),
    );
    assert.equal(
      created.conversation_config.conversation.max_duration_seconds,
      900,
    );
    assert.match(await sdk.sign(id), /^wss:/);
  } finally {
    globalThis.fetch = original;
  }
});

test("a failed run insert releases the agent concurrency slot", async (t) => {
  const f = await setup(t, {
    fetcher: async () => response({ reply: "Ready to help.", actions: [] }),
  });
  const original = f.db.query.bind(f.db);
  f.db.query = async (sql, params) => {
    if (sql.startsWith("INSERT INTO agent_runs"))
      throw new Error("Controlled insert failure");
    return original(sql, params);
  };
  for (let i = 0; i < 3; i++) {
    const result = await f.send("/api/v1/agent", {
      id: randomUUID(),
      message: "Test request",
    });
    assert.equal(result.statusCode, 500);
  }
  f.db.query = original;
  assert.equal(
    (
      await f.send("/api/v1/agent", {
        id: randomUUID(),
        message: "Try after recovery",
      })
    ).statusCode,
    200,
  );
});

test("camera, confirmed person and voice share current context independent of search wording", async (t) => {
  let agentContext: any;
  const f = await setup(t, {
    fetcher: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      if (body.text?.format?.name === "thread_agent_reply") {
        agentContext = JSON.parse(
          body.input.find((i: any) => i.role === "developer").content,
        );
        return response({
          reply: "You confirmed that Maya is with you.",
          actions: [],
        });
      }
      return response(observation);
    },
  });
  const s = await f.start();
  const person = (
    await f.send("/api/v1/people", {
      name: "Maya Fixture",
      relationship: "daughter",
      description: "Calls each evening",
      author: "QA",
      consent: true,
    })
  ).json();
  await f.send("/api/v1/people", {
    name: "Sam Fixture",
    relationship: "son",
    author: "QA",
    consent: true,
  });
  const view = (
    await f.send("/api/v1/diary/capture", {
      id: randomUUID(),
      sessionId: s.id,
      capturedAt: new Date().toISOString(),
      image: png,
    })
  ).json();
  let context = (
    await f.send("/api/v1/voice/context", {
      sessionId: s.id,
      query: "Who is it?",
    })
  ).json();
  assert.equal(context.live.currentEncounter, null);
  assert.equal(context.people.length, 2);
  assert.equal(context.live.latestObservation.id, view.id);
  const confirmation = {
    id: randomUUID(),
    sessionId: s.id,
    personId: person.id,
    observationId: view.id,
    confirmed: true,
  };
  const saved = await f.send("/api/v1/diary/person", confirmation);
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(
    (await f.send("/api/v1/diary/person", confirmation)).json().id,
    saved.json().id,
  );
  context = (
    await f.send("/api/v1/voice/context", {
      sessionId: s.id,
      query: "Who is it?",
    })
  ).json();
  assert.equal(context.live.currentEncounter.person.name, "Maya Fixture");
  assert.equal(
    context.live.currentEncounter.person.description,
    "Calls each evening",
  );
  assert.equal(context.live.currentEncounter.observationId, view.id);
  assert.equal(context.live.latestObservation.review, "unreviewed");
  const answer = await f.send("/api/v1/agent", {
    id: randomUUID(),
    sessionId: s.id,
    message: "Who is with me?",
    requireReview: true,
  });
  assert.equal(answer.statusCode, 200, answer.body);
  assert.equal(agentContext.live.currentEncounter.person.id, person.id);
  assert.equal(agentContext.live.latestObservation.id, view.id);
  await f.send("/api/v1/diary/sessions/" + s.id, { operation: "pause" });
  await f.send("/api/v1/diary/sessions/" + s.id, { operation: "resume" });
  assert.equal(
    (await f.send("/api/v1/diary/session/" + s.id + "/context")).json()
      .currentEncounter,
    null,
  );
  assert.equal((await f.send("/api/v1/diary?q=Maya")).json().events.length, 1);
});

test("encounter replacement, expiry, review and deletion cannot leave a stale current identity", async (t) => {
  const f = await setup(t),
    s = await f.start();
  const person = (
    await f.send("/api/v1/people", {
      name: "Maya Fixture",
      relationship: "daughter",
      author: "QA",
      consent: true,
    })
  ).json();
  const confirm = async () => {
    const b = {
      id: randomUUID(),
      sessionId: s.id,
      personId: person.id,
      confirmed: true,
    };
    const r = await f.send("/api/v1/diary/person", b);
    assert.equal(r.statusCode, 200, r.body);
    return { b, event: r.json() };
  };
  const context = async () =>
    (await f.send("/api/v1/diary/session/" + s.id + "/context")).json();
  const a = await confirm(),
    b = await confirm();
  await f.send("/api/v1/diary/session/" + s.id + "/encounter/end", {
    encounterId: a.event.id,
  });
  assert.equal((await context()).currentEncounter.id, b.event.id);
  await f.send("/api/v1/diary/session/" + s.id + "/encounter/end", {
    encounterId: b.event.id,
  });
  await f.send("/api/v1/diary/person", b.b);
  assert.equal(
    (await context()).currentEncounter,
    null,
    "idempotent retry must not reactivate an ended encounter",
  );
  const c = await confirm();
  await f.db.query(
    "UPDATE current_encounters SET valid_until=now()-interval '1 second' WHERE id=$1",
    [c.event.id],
  );
  assert.equal((await context()).currentEncounter, null);
  const d = await confirm();
  await f.send("/api/v1/diary/" + d.event.id + "/review", {
    revision: 1,
    title: "Correction",
    summary: "I was mistaken about who visited.",
    author: "QA",
  });
  assert.equal((await context()).currentEncounter, null);
  const e = await confirm();
  await f.send("/api/v1/diary/" + e.event.id + "/delete", {});
  assert.equal((await context()).currentEncounter, null);
  await confirm();
  await f.send("/api/v1/people/" + person.id + "/delete", {});
  assert.equal((await context()).currentEncounter, null);
});

test("confirmation rejects another session's or stale camera view and survives restart only as history", async (t) => {
  const f = await setup(t),
    first = await f.start();
  const person = (
    await f.send("/api/v1/people", {
      name: "Maya Fixture",
      relationship: "daughter",
      author: "QA",
      consent: true,
    })
  ).json();
  const old = (
    await f.send("/api/v1/diary/capture", {
      id: randomUUID(),
      sessionId: first.id,
      capturedAt: new Date().toISOString(),
      image: png,
    })
  ).json();
  await f.send("/api/v1/diary/sessions/" + first.id, { operation: "end" });
  const next = await f.start();
  const b = {
    id: randomUUID(),
    sessionId: next.id,
    personId: person.id,
    observationId: old.id,
    confirmed: true,
  };
  assert.equal((await f.send("/api/v1/diary/person", b)).statusCode, 409);
  const view = (
    await f.send("/api/v1/diary/capture", {
      id: randomUUID(),
      sessionId: next.id,
      capturedAt: new Date().toISOString(),
      image: png,
    })
  ).json();
  await f.db.query(
    "UPDATE diary_events SET captured_at=now()-interval '3 minutes' WHERE id=$1",
    [view.id],
  );
  assert.equal(
    (await f.send("/api/v1/diary/person", { ...b, observationId: view.id }))
      .statusCode,
    409,
  );
  assert.equal(
    (await f.send("/api/v1/diary/person", { ...b, observationId: null }))
      .statusCode,
    200,
  );
  await new DiaryRepository(f.db, f.storage).init();
  await f.send("/api/v1/diary/sessions/" + next.id, { operation: "resume" });
  assert.equal(
    (await f.send("/api/v1/diary/session/" + next.id + "/context")).json()
      .currentEncounter,
    null,
  );
  assert.equal((await f.send("/api/v1/diary?q=Maya")).json().events.length, 1);
});

test("existing ElevenLabs agent instructions upgrade once without replacing voice or model", async () => {
  const original = globalThis.fetch;
  let updates = 0;
  const remote = {
    agent_id: "agent_contract",
    name: "Thread fixture",
    metadata: { created_at_unix_secs: 1, updated_at_unix_secs: 1 },
    conversation_config: {
      tts: { voice_id: "original_voice" },
      agent: {
        prompt: { prompt: "Existing custom instruction.", llm: "gpt-4.1-mini" },
      },
    },
  };
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "PATCH") {
      updates++;
      const body = JSON.parse(String(init.body));
      assert.deepEqual(Object.keys(body.conversation_config), ["agent"]);
      assert.deepEqual(Object.keys(body.conversation_config.agent.prompt), [
        "prompt",
      ]);
      assert.match(
        body.conversation_config.agent.prompt.prompt,
        /Existing custom instruction/,
      );
      assert.match(
        body.conversation_config.agent.prompt.prompt,
        /currentEncounter/,
      );
      remote.conversation_config.agent.prompt.prompt =
        body.conversation_config.agent.prompt.prompt;
    }
    return new Response(JSON.stringify(remote));
  };
  try {
    const sdk = new ElevenGateway("test-only-never-real-key");
    await sdk.syncInstructions("agent_contract");
    await sdk.syncInstructions("agent_contract");
    assert.equal(updates, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("voice instruction upgrade failures cannot silently start the outdated agent", async (t) => {
  let signed = 0,
    syncs = 0;
  const f = await setup(t, {
    voiceGateway: () => ({
      ...voice,
      syncInstructions: async () => {
        syncs++;
        if (syncs === 1) throw new Error("Controlled provider failure");
      },
      sign: async () => {
        signed++;
        return voice.sign("fixture");
      },
    }),
  });
  const s = await f.start();
  await f.send("/api/v1/voice/connect", {
    apiKey: "test-only-eleven-key",
    createAgent: true,
  });
  assert.equal(
    (await f.send("/api/v1/voice/session", { sessionId: s.id })).statusCode,
    502,
  );
  assert.equal(signed, 0);
  assert.equal(
    (await f.send("/api/v1/voice/session", { sessionId: s.id })).statusCode,
    200,
  );
  assert.equal(
    (await f.send("/api/v1/voice/session", { sessionId: s.id })).statusCode,
    200,
  );
  assert.equal(syncs, 2);
});

test("an answer about a current person is rejected if the encounter ends during generation", async (t) => {
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const held = new Promise<void>((r) => {
    release = r;
  });
  const f = await setup(t, {
    fetcher: async () => {
      entered();
      await held;
      return response({ reply: "Maya is with you.", actions: [] });
    },
  });
  const s = await f.start();
  const person = (
    await f.send("/api/v1/people", {
      name: "Maya Fixture",
      relationship: "daughter",
      author: "QA",
      consent: true,
    })
  ).json();
  const encounter = (
    await f.send("/api/v1/diary/person", {
      id: randomUUID(),
      sessionId: s.id,
      personId: person.id,
      confirmed: true,
    })
  ).json();
  const pending = f.send("/api/v1/agent", {
    id: randomUUID(),
    sessionId: s.id,
    message: "Who is with me?",
    requireReview: true,
  });
  // Start the inject request before awaiting the provider rendezvous.
  const request = Promise.resolve(pending);
  await started;
  await f.send("/api/v1/diary/session/" + s.id + "/encounter/end", {
    encounterId: encounter.id,
  });
  release();
  const result = await request;
  assert.equal(result.statusCode, 409, result.body);
  assert.match(result.body, /Who is with you changed/);
});

test("fullscreen voice opt-in preserves session retention and requires explicit consent", async (t) => {
  const f = await setup(t),
    s = await f.start({
      voiceConsent: false,
      retainFrames: true,
      retentionDays: 1,
    });
  const path = "/api/v1/diary/sessions/" + s.id + "/voice-consent";
  assert.equal((await f.send(path, { consent: false })).statusCode, 400);
  const granted = await f.send(path, { consent: true });
  assert.equal(granted.statusCode, 200, granted.body);
  assert.equal(granted.json().policy.voiceConsent, true);
  assert.equal(granted.json().policy.retainFrames, true);
  assert.equal(granted.json().policy.retentionDays, 1);
  await f.send("/api/v1/diary/sessions/" + s.id, { operation: "end" });
  assert.equal((await f.send(path, { consent: true })).statusCode, 409);
});
