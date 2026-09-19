import type {
  CameraAdapter,
  CapturedPhoto,
} from "../../../packages/domain/src/adapters";
export class BrowserCamera implements CameraAdapter {
  private stream: MediaStream | null = null;
  private epoch = 0;
  constructor(
    private video: HTMLVideoElement,
    private onEnded: () => void = () => {},
  ) {}
  async start(deviceId?: string) {
    this.stop();
    const epoch = this.epoch;
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error(
        "Use localhost or HTTPS in a browser with camera support.",
      );
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
    });
    if (epoch !== this.epoch) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("Camera start was cancelled.");
    }
    this.stream = stream;
    this.video.srcObject = stream;
    stream
      .getVideoTracks()
      .forEach((t) =>
        t.addEventListener("ended", () => this.onEnded(), { once: true }),
      );
    try {
      await this.video.play();
    } catch (error) {
      if (epoch === this.epoch) this.stop();
      else stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
    if (epoch !== this.epoch) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("Camera start was cancelled.");
    }
  }
  async capture(): Promise<CapturedPhoto> {
    if (
      !this.stream?.getVideoTracks().some((t) => t.readyState === "live") ||
      !this.video.videoWidth
    )
      throw new Error("Wait for a visible camera preview before capturing.");
    const c = document.createElement("canvas"),
      scale = Math.min(1, 1280 / this.video.videoWidth);
    c.width = Math.round(this.video.videoWidth * scale);
    c.height = Math.round(this.video.videoHeight * scale);
    c.getContext("2d")!.drawImage(this.video, 0, 0, c.width, c.height);
    return {
      data: c.toDataURL("image/jpeg", 0.75),
      capturedAt: new Date().toISOString(),
      source: "browser-camera",
    };
  }
  signature() {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 24;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(this.video, 0, 0, 32, 24);
    return ctx.getImageData(0, 0, 32, 24).data;
  }
  stop() {
    this.epoch++;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
export function sceneChanged(
  before: Uint8ClampedArray | null,
  after: Uint8ClampedArray,
) {
  if (!before) return true;
  let difference = 0;
  for (let i = 0; i < after.length; i += 4)
    difference +=
      (Math.abs(after[i] - before[i]) +
        Math.abs(after[i + 1] - before[i + 1]) +
        Math.abs(after[i + 2] - before[i + 2])) /
      3;
  return difference / ((after.length / 4) * 255) > 0.035;
}
export async function readPhoto(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  )
    throw new Error("Choose a JPG, PNG or WebP photo under 4 MB.");
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("The photo could not be opened."));
    r.readAsDataURL(file);
  });
}
