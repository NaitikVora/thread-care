# Camera now, Meta hardware later

Capability check: September 19, 2026, using Meta's official documentation.

Thread's running patient view uses a real browser camera, a real database, OpenAI image/context APIs and ElevenLabs voice. It does not import a Meta SDK, impersonate a paired device, or claim a successful hardware integration.

## Two different Meta targets

Meta describes the **Wearables Device Access Toolkit** as a native iOS/Android integration for the glasses' camera and other device capabilities. Microphone/speaker access can involve the phone's Bluetooth audio route. The exact display and device capabilities vary by hardware and SDK version.

**Standalone Display Web Apps** are a different target, running on Meta Ray-Ban Display. Meta's current FAQ lists motion/orientation, phone GPS, neural-band/captouch input and local storage at launch. It does not establish that the web camera APIs used by this browser application can capture the glasses camera. A web page running on a Display device must not be advertised as a working camera integration without that capability being verified.

## Native integration boundary

`packages/domain/src/adapters.ts` defines `CameraAdapter`, `CapturedPhoto`, `AudioAdapter`, `NotificationAdapter` and `WearableAdapter`. `apps/web/src/browser-camera.ts` implements the browser camera adapter. The diary API and database do not depend on DOM video elements or a simulated glasses SDK.

A native companion should:

1. Register the integration in Meta's developer environment and pin the supported official SDK version.
2. Pair the actual device through the supported Meta flow and request real camera permissions.
3. Implement the camera adapter using SDK frames/photo capture. Preserve capture time, device provenance, interruption signals and connection state. Extend the server's source allowlist only when this transport exists.
4. Reuse `/api/v1/diary/sessions`, `/api/v1/diary/capture`, `/api/v1/voice/context` and the reviewed action APIs behind authenticated HTTPS.
5. Route live microphone/output through the phone and selected glasses Bluetooth device using the supported native audio APIs and ElevenLabs native client. Verify audio routing and interruptions on hardware.
6. For supported Display hardware, render the current instruction/caption through the documented native display capability. Keep capture, microphone and pause indicators available and independently test display controls.
7. Test disconnects, lock/background behavior, battery/thermal limits, capture gaps and re-pairing. Browser timing is not evidence that all-day capture works on glasses.

No mock device is connected in this implementation. Native code is intentionally not invented around unverified SDK methods. A hardware integration remains separate, concrete work requiring the target phone, glasses and developer access.

References: [Meta FAQ](https://developers.meta.com/wearables/faq/), [official Web Apps repository](https://github.com/facebook/meta-wearables-webapp), [Meta wearable developer platform](https://developers.meta.com/wearables/).
