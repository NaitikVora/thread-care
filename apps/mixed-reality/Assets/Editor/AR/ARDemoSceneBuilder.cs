using RecallAR.AR;
using Unity.XR.CoreUtils;
using UnityEditor;
using UnityEngine;
using UnityEngine.SpatialTracking;
using UnityEngine.XR.ARFoundation;

namespace RecallAR.EditorTools.AR
{
    /// <summary>
    /// Builds the phone AR variant: ARKit camera passthrough, floor detection,
    /// and the demo content placed around the person in their real room.
    /// Only compiles when AR Foundation is installed (see the asmdef).
    ///
    /// Headless: -executeMethod RecallAR.EditorTools.AR.ARDemoSceneBuilder.BuildAndSaveFromCommandLine
    /// </summary>
    public static class ARDemoSceneBuilder
    {
        public const string ScenePath = "Assets/Scenes/RecallAR_Demo_AR.unity";

        [MenuItem("RecallAR/Build Demo Scene (Phone AR)")]
        public static void BuildFromMenu()
        {
            DemoSceneBuilder.BuildAndSave(ScenePath, CreateArRig, worldSpaceHud: false, hudShader: null,
                legend: "Walk around  •  Hold your gaze on things to recognize them  •  Tap the buttons",
                continueHint: "Tap Continue", arMode: true, onBuilt: WirePlacer);
        }

        public static void BuildAndSaveFromCommandLine() => BuildFromMenu();

        private static ARSession session;
        private static ARPlaneManager planeManager;

        private static DemoSceneBuilder.PlayerRig CreateArRig(Vector3 spawn)
        {
            var sessionGo = new GameObject("AR Session", typeof(ARSession), typeof(ARInputManager));
            session = sessionGo.GetComponent<ARSession>();

            var originGo = new GameObject("XR Origin");
            originGo.layer = 2;
            var origin = originGo.AddComponent<XROrigin>();
            planeManager = originGo.AddComponent<ARPlaneManager>();
            planeManager.requestedDetectionMode = UnityEngine.XR.ARSubsystems.PlaneDetectionMode.Horizontal;
            originGo.AddComponent<ARRaycastManager>();

            var offset = new GameObject("Camera Offset");
            offset.transform.SetParent(originGo.transform, false);

            var camGo = new GameObject("AR Camera");
            camGo.tag = "MainCamera";
            camGo.layer = 2;
            camGo.transform.SetParent(offset.transform, false);
            var camera = camGo.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Color.black;
            camera.nearClipPlane = 0.05f;
            camera.farClipPlane = 40f;
            camGo.AddComponent<AudioListener>();
            camGo.AddComponent<ARCameraManager>();
            camGo.AddComponent<ARCameraBackground>();

            // Legacy Tracked Pose Driver: drives the camera from ARKit's device
            // pose and works with the project's legacy Input handling.
            var pose = camGo.AddComponent<TrackedPoseDriver>();
            pose.SetPoseSource(TrackedPoseDriver.DeviceType.GenericXRDevice, TrackedPoseDriver.TrackedPose.ColorCamera);
            pose.trackingType = TrackedPoseDriver.TrackingType.RotationAndPosition;
            pose.updateType = TrackedPoseDriver.UpdateType.UpdateAndBeforeRender;

            origin.Camera = camera;
            origin.CameraFloorOffsetObject = offset;
            origin.RequestedTrackingOriginMode = XROrigin.TrackingOriginMode.Device;

            return new DemoSceneBuilder.PlayerRig { root = originGo, camera = camera, hudParent = camGo.transform };
        }

        private static void WirePlacer(DemoSceneBuilder.BuildResult result)
        {
            var placer = result.rig.root.AddComponent<ARDemoPlacer>();
            DemoSceneBuilder.SetField(placer, "planeManager", planeManager);
            DemoSceneBuilder.SetField(placer, "arCamera", result.rig.camera.transform);
            DemoSceneBuilder.SetField(placer, "guidePath", result.guidePath);
            DemoSceneBuilder.SetField(placer, "demo", result.demoManager);
            DemoSceneBuilder.SetField(placer, "instructionPanel", result.instructionPanel);
            DemoSceneBuilder.SetField(placer, "instructionText", result.instructionText);
            DemoSceneBuilder.SetField(placer, "progressText", result.progressText);

            // Where each group goes relative to where the person faces at scan
            // time: kitchen ahead, Sarah right, Memory Corner behind, the
            // nightstand left, the garden ahead-left. Distances in metres.
            var groups = result.contentGroups; // kitchen, sarah, corner, phone, garden
            var angles = new[] { 0f, 75f, 180f, -80f, -35f };
            var distances = new[] { 2.0f, 2.6f, 3.0f, 2.6f, 3.2f };

            var so = new SerializedObject(placer);
            var list = so.FindProperty("placements");
            list.arraySize = groups.Length;
            for (var i = 0; i < groups.Length; i++)
            {
                var e = list.GetArrayElementAtIndex(i);
                e.FindPropertyRelative("group").objectReferenceValue = groups[i];
                e.FindPropertyRelative("angle").floatValue = angles[i];
                e.FindPropertyRelative("distance").floatValue = distances[i];
            }
            so.ApplyModifiedPropertiesWithoutUndo();
        }
    }
}
