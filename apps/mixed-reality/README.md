# RecallAR — Mixed Reality Concept Prototype

A Unity concept prototype demonstrating what RecallAR's AR Memory Quest could feel like
in a real mixed-reality headset — built to run today with **zero XR hardware and no
Meta developer account**, using plain mouse-look as a stand-in for headset gaze.

Unity **6000.6.2f1**.

## What this is (and isn't)

This is a **simulator**, not real computer vision. Recognizing the coffee mug or Sarah
happens because `RecallARObject`/`RecognizablePerson` components are already attached to
known GameObjects in the scene — the "recognition" is really just "have you looked at
this known thing for ~1.5 seconds." That mirrors the product spec's own instruction: *do
not implement real facial recognition or real object detection yet; demonstrate the
future product behavior.*

Nothing here does real face identification, and nothing claims to. See
[Assets/Scripts/Data/RecognizablePerson.cs](Assets/Scripts/Data/RecognizablePerson.cs)'s
doc comment for the same disclosure in code.

## Open it

1. Open in Unity Hub → Add project → select this folder (`apps/mixed-reality`).
2. Open `Assets/Scenes/RecallAR_Demo_LivingRoom.unity`.
3. Press Play.

If the scene is ever missing or you want to regenerate it from scratch, use the menu
**RecallAR → Build Demo Living Room Scene** — the entire scene (environment, mug,
glasses, Sarah avatar, player, HUD, and all manager wiring) is built from code by
[`Assets/Editor/DemoSceneBuilder.cs`](Assets/Editor/DemoSceneBuilder.cs), not hand-placed,
so it's reproducible and has zero imported-asset dependencies.

## Play it

You start by the front wall of a furnished apartment room (kitchen along the back wall,
dining table, sofa and TV area, a bedside corner). **Mouse** to look, **WASD** to walk —
you're grounded with gravity and collide with furniture, like a person, not a drone.
**Esc** frees the cursor; click to lock it again.

The demo is a guided sequence of three activities, each followed by a memory card you
dismiss with **Space** (or the Continue button) to move on:

1. **"Let's find your coffee mug."** — it's on the kitchen counter next to the coffee
   machine. Hold your gaze on it ~1.5 s (the centre reticle brightens as you hold) →
   "You found it!" → Boston Trip memory → +10 → a flower grows in the Memory Garden.
2. **"Sarah is visiting today. Can you find her?"** — she's standing by the rug near the
   sofa. Gaze → "That's Sarah!" and her identity card → **R** (or Space) to remember →
   memory card → +5 → another flower.
3. **"Let's find your reading glasses."** — on the nightstand by the little lamp in the
   front-left corner → memory → +10 → flower.

Then: *"That's everything for today. Wonderful, John!"* with a flower count. Space
plays again (the garden keeps its flowers).

**H** shows a hint for the current activity at any time — hints are never penalized,
just counted. Looking at Sarah outside her activity still shows her card; that's by
design (recognition help is always on).

## Architecture

This is built to the same separation the product spec asks for, so a real device
implementation can drop in later without touching the rest of the app:

- `RecallAR.Data` — plain identity/quest data (`RecognizablePerson`, `RecallARObject`),
  no behavior.
- `RecallAR.Recognition` — `IPersonRecognitionProvider` / `IObjectRecognitionProvider`
  interfaces, and `Simulated*RecognitionProvider` implementations that do
  raycast-and-hold against a shared `GazeRecognitionController`. **This is the piece a
  real implementation replaces** — a future `RealPersonRecognitionProvider` using Quest
  passthrough camera + an enrolled-profile match would implement the same interface;
  nothing in `QuestManager` or the UI controllers would need to change.
- `RecallAR.Quest` — `QuestManager` owns the active quest and hint count.
- `RecallAR.UI` — one controller per panel (`IdentityCardController`,
  `MemoryCardController`, `HintController`, `ObjectHighlightController`), each doing one
  thing.
- `RecallAR.Reward` — `RewardController` (points) and `MemoryGardenController` (the
  flower-growing visual reward — see spec sections 8-9: no leaderboards, no losing
  points, no streaks).
- `RecallAR.Player.SimpleLookController` — mouse-look + WASD. **This is the other piece
  that gets replaced** for a real headset: swap the `Camera` this drives for a Meta XR
  SDK camera rig's (OVRCameraRig / XR Origin), and reassign it to
  `GazeRecognitionController`'s `gazeCamera` field — everything downstream (raycasting,
  recognition, quests, UI, rewards) already reads gaze from whatever camera is assigned
  there.

## Path to real Meta XR SDK / Simulator

Not done in this pass — see the chat history for why: it needs a Meta developer account
and the Meta XR SDK's Unity package (from
https://developers.meta.com/horizon/documentation/unity/), which requires an interactive
sign-in inside the Editor that can't be scripted here. Once you've added it yourself:

1. Follow Meta's Building Blocks / OVRCameraRig setup to add an XR Origin to the scene.
2. Reassign `GazeRecognitionController.gazeCamera` (and disable/remove
   `SimpleLookController`) to point at the XR rig's camera instead of the plain FPS one.
3. Everything else — recognition, quests, cards, hints, rewards, garden — is already
   camera-agnostic and should work unchanged.

## Notes on this setup

- `com.unity.ugui` (Text/Button/Image — legacy uGUI) had to be added by hand to
  [`Packages/manifest.json`](Packages/manifest.json); a bare project created via Unity's
  `-createProject` CLI flag doesn't include it by default the way the Editor's own "3D"
  template does.
- No Meta XR SDK, no TextMeshPro. The Memory Garden's flowers, and the mug/table/coffee
  machine/glasses/nightstand, are still built from plain Unity primitives (see the
  comment in `DemoSceneBuilder.BuildEnvironment` for why those specific props stay
  primitives rather than models). Everything else in the room — sofa, rug, coffee table,
  bookcase, floor lamp, potted plant, TV cabinet, and the Sarah avatar — is a real free
  model from [Kenney](https://kenney.nl) (CC0, no login or attribution required) under
  [`Assets/Art/Kenney`](Assets/Art/Kenney); see
  [`Assets/Art/Kenney/CREDITS.md`](Assets/Art/Kenney/CREDITS.md) for exactly which packs.
