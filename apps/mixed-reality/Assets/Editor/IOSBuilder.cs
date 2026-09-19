using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace RecallAR.EditorTools
{
    /// <summary>
    /// Produces the Xcode project for the phone scene:
    ///   Unity -batchmode -nographics -quit -buildTarget iOS
    ///     -executeMethod RecallAR.EditorTools.IOSBuilder.BuildFromCommandLine
    /// Signing and the device install happen in Xcode/xcodebuild afterwards.
    /// </summary>
    public static class IOSBuilder
    {
        private const string PhoneScene = "Assets/Scenes/RecallAR_Demo_LivingRoom_Phone.unity";
        private const string OutputDir = "Builds/iOS";

        [MenuItem("RecallAR/Build iOS (Xcode project)")]
        public static void BuildFromMenu()
        {
            if (!File.Exists(PhoneScene))
            {
                Debug.LogError("IOSBuilder: phone scene missing — run RecallAR > Build Demo Living Room Scene (Phone) first.");
                return;
            }

            PlayerSettings.productName = "RecallAR";
            PlayerSettings.companyName = "RecallAR";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, "com.recallar.demo");
            PlayerSettings.iOS.targetOSVersionString = "15.0";
            PlayerSettings.iOS.appleEnableAutomaticSigning = true;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.iOS.requiresFullScreen = true;
            PlayerSettings.iOS.hideHomeButton = false;
            PlayerSettings.SetGraphicsAPIs(BuildTarget.iOS, new[] { UnityEngine.Rendering.GraphicsDeviceType.Metal });

            var options = new BuildPlayerOptions
            {
                scenes = new[] { PhoneScene },
                locationPathName = OutputDir,
                target = BuildTarget.iOS,
                options = BuildOptions.None,
            };

            var report = BuildPipeline.BuildPlayer(options);
            var summary = report.summary;
            if (summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded)
                Debug.Log($"IOSBuilder: Xcode project written to {OutputDir} ({summary.totalSize / (1024 * 1024)} MB).");
            else
                Debug.LogError($"IOSBuilder: build {summary.result} with {summary.totalErrors} error(s).");
        }

        public static void BuildFromCommandLine() => BuildFromMenu();
    }
}
