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

        private static void Build(string scene, string outputDir)
        {
            if (!File.Exists(scene))
            {
                Debug.LogError($"IOSBuilder: scene missing ({scene}) — build it from the RecallAR menu first.");
                return;
            }

            PlayerSettings.productName = "RecallAR";
            PlayerSettings.companyName = "RecallAR";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, "com.recallar.demo");
            PlayerSettings.iOS.targetOSVersionString = "15.0";
            PlayerSettings.iOS.appleEnableAutomaticSigning = true;
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
