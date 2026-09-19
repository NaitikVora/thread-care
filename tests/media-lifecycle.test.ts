import test from "node:test";
import assert from "node:assert/strict";
import { BrowserCamera } from "../apps/web/src/browser-camera";
function media() {
  let stopped = 0;
  const track = {
    readyState: "live",
    stop() {
      stopped++;
      this.readyState = "ended";
    },
    addEventListener() {},
  };
  return {
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream,
    stops: () => stopped,
  };
}
function navigatorFor(t: any, getUserMedia: () => Promise<MediaStream>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia } },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "navigator", previous);
    else Reflect.deleteProperty(globalThis, "navigator");
  });
}
test("camera releases acquired tracks if preview playback fails", async (t) => {
  const m = media();
  navigatorFor(t, async () => m.stream);
  const video = {
    srcObject: null,
    play: async () => {
      throw new Error("Playback blocked");
    },
  } as unknown as HTMLVideoElement;
  const camera = new BrowserCamera(video);
  await assert.rejects(() => camera.start(), /Playback blocked/);
  assert.equal(m.stops(), 1);
  assert.equal(video.srcObject, null);
});
test("cancelled camera permission request cannot leave late tracks running", async (t) => {
  const m = media();
  let resolve!: (s: MediaStream) => void;
  navigatorFor(t, () => new Promise((r) => (resolve = r)));
  const video = {
    srcObject: null,
    play: async () => {},
  } as unknown as HTMLVideoElement;
  const camera = new BrowserCamera(video),
    pending = camera.start();
  camera.stop();
  resolve(m.stream);
  await assert.rejects(() => pending, /cancelled/);
  assert.equal(m.stops(), 1);
  assert.equal(video.srcObject, null);
});
