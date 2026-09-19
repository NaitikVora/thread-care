using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace RecallAR.EditorTools
{
    /// <summary>
    /// Produces the Xcode project for a phone scene:
    ///   Unity -batchmode -nographics -quit -buildTarget iOS
    ///     -executeMethod RecallAR.EditorTools.IOSBuilder.BuildFromCommandLine      (virtual room, touch controls)
    ///     -executeMethod RecallAR.EditorTools.IOSBuilder.BuildARFromCommandLine    (AR in the real room)
    /// Signing and the device install happen in Xcode afterwards.
    /// </summary>
    public static class IOSBuilder
    {
        private const string PhoneScene = "Assets/Scenes/RecallAR_Demo_LivingRoom_Phone.unity";
        private const string ArScene = "Assets/Scenes/RecallAR_Demo_AR.unity";

        [MenuItem("RecallAR/Build iOS (Xcode project) - Phone room")]
        public static void BuildFromMenu() => Build(PhoneScene, "Builds/iOS");

        [MenuItem("RecallAR/Build iOS (Xcode project) - Phone AR")]
        public static void BuildArFromMenu() => Build(ArScene, "Builds/iOS-AR");

        public static void BuildFromCommandLine() => BuildFromMenu();
        public static void BuildARFromCommandLine() => BuildArFromMenu();

        /// <summary>
        /// ARKit's build processor decides whether to ship libUnityARKit.a from a
        /// static flag that, in batch mode, is only refreshed by a define it adds
        /// during the build — too late for that same build, so the first
        /// headless build silently omits the native plugin and ARKit never
        /// starts on the phone. Set the flag directly (and persist the define
        /// for later Editor sessions) so every build includes the plugin.
        /// </summary>
        private static void ForceArKitPluginsIntoBuild()
        {
            const string define = "UNITY_XR_ARKIT_LOADER_ENABLED";

            System.Type processor = null;
            foreach (var asm in System.AppDomain.CurrentDomain.GetAssemblies())
            {
                if (!asm.GetName().Name.StartsWith("Unity.XR.ARKit")) continue;
                processor = asm.GetType("UnityEditor.XR.ARKit.ARKitBuildProcessor", false);
                if (processor != null) break;
            }
            if (processor == null)
            {
                Debug.Log("IOSBuilder: ARKit package not present; skipping ARKit plugin forcing.");
                return;
            }

            var field = processor.GetField("loaderEnabled",
                System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
            if (field != null)
            {
                field.SetValue(null, true);
                Debug.Log("IOSBuilder: ARKitBuildProcessor.loaderEnabled forced to true for this build.");
            }
            else Debug.LogWarning("IOSBuilder: could not find ARKitBuildProcessor.loaderEnabled; ARKit plugin may be omitted.");

            PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.iOS, out var defines);
            if (System.Array.IndexOf(defines, define) < 0)
            {
                var list = new System.Collections.Generic.List<string>(defines) { define };
                PlayerSettings.SetScriptingDefineSymbols(NamedBuildTarget.iOS, list.ToArray());
            }
        }

        private static void Build(string scene, string outputDir)
        {
            if (!File.Exists(scene))
            {
                Debug.LogError($"IOSBuilder: scene missing ({scene}) — build it from the RecallAR menu first.");
                return;
            }

            ForceArKitPluginsIntoBuild();

            PlayerSettings.productName = "RecallAR";
            PlayerSettings.companyName = "RecallAR";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, "com.recallar.demo");
            PlayerSettings.iOS.targetOSVersionString = "15.0";
            PlayerSettings.iOS.appleEnableAutomaticSigning = true;
            // Personal team used for device testing; change for another Apple ID.
            PlayerSettings.iOS.appleDeveloperTeamID = "HS3A356T4G";
            PlayerSettings.iOS.cameraUsageDescription = "RecallAR shows memory activities in your own room using the camera.";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.iOS.requiresFullScreen = true;
            PlayerSettings.iOS.hideHomeButton = false;
            PlayerSettings.SetGraphicsAPIs(BuildTarget.iOS, new[] { UnityEngine.Rendering.GraphicsDeviceType.Metal });

            var options = new BuildPlayerOptions
            {
                scenes = new[] { scene },
                locationPathName = outputDir,
                target = BuildTarget.iOS,
                options = BuildOptions.None,
            };

            var report = BuildPipeline.BuildPlayer(options);
            var summary = report.summary;
            if (summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
                Debug.Log($"IOSBuilder: Xcode project written to {outputDir} ({summary.totalSize / (1024 * 1024)} MB).");
            else
                Debug.LogError($"IOSBuilder: build {summary.result} with {summary.totalErrors} error(s).");
        }
    }
}
