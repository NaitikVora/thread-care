import type { DiarySession } from "../../../packages/contracts/src/diary";

// Invoke directly from the click/submit handler, before awaiting network work.
export async function requestPatientFullscreen(element: HTMLElement | null) {
  if (!element?.requestFullscreen) return false;
  try {
    await element.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function startPatientDevices(options: {
  prepare: () => Promise<DiarySession>;
  cancelled: () => boolean;
  ready: (session: DiarySession) => void;
  pause: (session: DiarySession) => Promise<void>;
  camera: () => Promise<unknown>;
  voice: () => Promise<unknown>;
}) {
  const session = await options.prepare();
  if (options.cancelled()) {
    await options.pause(session);
    return;
  }
  if (session.status !== "active" || !session.policy.voiceConsent)
    throw new Error("Choose an active session with voice enabled first.");
  options.ready(session);
  // A blocked camera must not prevent a useful voice connection (or vice versa).
  return Promise.allSettled([options.camera(), options.voice()]);
}
