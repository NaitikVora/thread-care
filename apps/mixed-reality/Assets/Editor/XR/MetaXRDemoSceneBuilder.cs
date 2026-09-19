using UnityEditor;
using UnityEngine;

namespace RecallAR.EditorTools.XR
{
    /// <summary>
    /// Builds the Meta XR variant of the demo scene: the same room, quests,
    /// game and rewards, but the player is Meta's OVRCameraRig (head-tracked
    /// by the Meta XR Simulator or a Quest) instead of the mouse-look
    /// controller, and the HUD is a head-locked world-space canvas drawn on
    /// top of everything. Only compiles when the Meta XR Core SDK + OpenXR
    /// packages are installed (see RecallAR.Editor.XR.asmdef).
    ///
    /// Headless: -executeMethod RecallAR.EditorTools.XR.MetaXRDemoSceneBuilder.BuildAndSaveFromCommandLine
    /// </summary>
    public static class MetaXRDemoSceneBuilder
    {
        public const string ScenePath = "Assets/Scenes/RecallAR_Demo_LivingRoom_XR.unity";
        private const string RigPrefabPath = "Packages/com.meta.xr.sdk.core/Prefabs/OVRCameraRig.prefab";

        [MenuItem("RecallAR/Build Demo Living Room Scene (Meta XR)")]
        public static void BuildFromMenu()
        {
            var shader = Shader.Find("RecallAR/UI Overlay");
            if (shader == null) Debug.LogWarning("RecallAR/UI Overlay shader not found; HUD may clip into walls.");

            DemoSceneBuilder.BuildAndSave(ScenePath, CreateRig, worldSpaceHud: true, hudShader: shader,
                legend: "Look at things to recognize them  •  H hint  •  R remember  •  Space continue   (click the Game view first)");
        }

        public static void BuildAndSaveFromCommandLine() => BuildFromMenu();

        private static DemoSceneBuilder.PlayerRig CreateRig(Vector3 spawn)
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(RigPrefabPath);
            if (prefab == null)
            {
                Debug.LogError("OVRCameraRig prefab not found at " + RigPrefabPath);
                return null;
            }

            var rig = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            rig.name = "Player (OVRCameraRig)";
            rig.transform.position = new Vector3(spawn.x, 0f, spawn.z);

            var manager = rig.GetComponent<OVRManager>();
            if (manager == null) manager = rig.AddComponent<OVRManager>();
            manager.trackingOriginType = OVRManager.TrackingOrigin.FloorLevel;

            var centerEye = rig.transform.Find("TrackingSpace/CenterEyeAnchor");
            if (centerEye == null)
            {
                Debug.LogError("OVRCameraRig prefab has no TrackingSpace/CenterEyeAnchor");
                return null;
            }
            var camera = centerEye.GetComponent<Camera>();
            if (camera == null) camera = centerEye.gameObject.AddComponent<Camera>();
            camera.nearClipPlane = 0.05f;
            camera.clearFlags = CameraClearFlags.Skybox;
            if (centerEye.GetComponent<AudioListener>() == null) centerEye.gameObject.AddComponent<AudioListener>();

            SetLayerRecursively(rig, 2); // Ignore Raycast: the gaze cast must not hit the rig itself.

            return new DemoSceneBuilder.PlayerRig { root = rig, camera = camera, hudParent = centerEye };
        }

        private static void SetLayerRecursively(GameObject go, int layer)
        {
            go.layer = layer;
            foreach (Transform child in go.transform) SetLayerRecursively(child.gameObject, layer);
        }
    }
}
