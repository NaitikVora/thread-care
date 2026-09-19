import test from "node:test";
import assert from "node:assert/strict";
import {
  requestPatientFullscreen,
  startPatientDevices,
} from "../apps/web/src/patient-view";
import type { DiarySession } from "../packages/contracts/src/diary";
const session: DiarySession = {
  id: "test-session",
  title: "Test",
  status: "active",
  source: "browser-camera",
  policy: {
    cloudConsent: true,
    voiceConsent: true,
    retainFrames: false,
    retainTranscript: false,
    retentionDays: 7,
    intervalSeconds: 120,
  },
  startedAt: new Date().toISOString(),
  heartbeatAt: new Date().toISOString(),
  endedAt: null,
};
test("fullscreen is requested synchronously before network work and has a truthful fallback", async () => {
  let requested = false;
  const result = requestPatientFullscreen({
    requestFullscreen: () => {
      requested = true;
      return Promise.resolve();
    },
  } as HTMLElement);
  assert.equal(requested, true);
  assert.equal(await result, true);
  assert.equal(await requestPatientFullscreen(null), false);
  assert.equal(
    await requestPatientFullscreen({
      requestFullscreen: async () => {
        throw new Error("Blocked");
      },
    } as unknown as HTMLElement),
    false,
  );
});
test("exiting while session creation is pending pauses the created session without starting devices", async () => {
  let resolve!: (s: DiarySession) => void,
    cancelled = false,
    paused = false;
  const running = startPatientDevices({
    prepare: () =>
      new Promise((r) => {
        resolve = r;
      }),
    cancelled: () => cancelled,
    ready: () => assert.fail("Late session must not be activated"),
    pause: async (s) => {
      assert.equal(s.id, session.id);
      paused = true;
    },
    camera: async () => assert.fail("Camera must not start"),
    voice: async () => assert.fail("Voice must not start"),
  });
  cancelled = true;
  resolve(session);
  await running;
  assert.equal(paused, true);
});
test("camera failure does not block voice startup and both see the active session", async () => {
  let ready = false,
    voiceStarted = false;
  const outcomes = await startPatientDevices({
    prepare: async () => session,
    cancelled: () => false,
    ready: () => {
      ready = true;
    },
    pause: async () => assert.fail("Should not pause"),
    camera: async () => {
      assert.equal(ready, true);
      throw new Error("Permission denied");
    },
    voice: async () => {
      assert.equal(ready, true);
      voiceStarted = true;
    },
  });
  assert.equal(voiceStarted, true);
  assert.equal(outcomes?.[0].status, "rejected");
  assert.equal(outcomes?.[1].status, "fulfilled");
});
test("a session without voice consent cannot auto-start either device", async () => {
  await assert.rejects(
    () =>
      startPatientDevices({
        prepare: async () => ({
          ...session,
          policy: { ...session.policy, voiceConsent: false },
        }),
        cancelled: () => false,
        ready: () => assert.fail("No ready state"),
        pause: async () => {},
        camera: async () => assert.fail("No camera"),
        voice: async () => assert.fail("No voice"),
      }),
    /voice enabled/,
  );
});
