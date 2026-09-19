// UI/device transports depend on these boundaries, never the other way around.
export interface CapturedPhoto {
  data: string;
  capturedAt: string;
  source: "browser-camera" | "upload" | "mobile-camera" | "meta-camera";
}
export interface CameraAdapter {
  start(deviceId?: string): Promise<void>;
  capture(): Promise<CapturedPhoto>;
  stop(): void;
}
export interface AudioAdapter {
  start(): Promise<void>;
  stop(): Promise<Blob | undefined>;
  cancel(): void;
}
export interface NotificationAdapter {
  permission(): Promise<"granted" | "denied" | "unavailable">;
  notify(
    title: string,
    body: string,
  ): Promise<{ status: "displayed" | "unavailable" | "failed" }>;
}
export interface WearableAdapter {
  capabilities(): Promise<{
    camera: boolean;
    audio: boolean;
    display: boolean;
  }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
// No production Meta adapter exists yet; capability discovery must use the real SDK.
