using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace RecallAR.EditorTools
{
    /// <summary>
    /// Points the OpenXR loader at the Meta XR Simulator runtime by setting
    /// XR_RUNTIME_JSON for this Editor process — the same thing Meta's own
    /// simulator package does on "Activate", minus that package's Unity-glue
    /// code (which no longer compiles against Core SDK v2xx).
    ///
    /// The simulator itself is a separate download from Meta (Meta developer
    /// account): https://developers.meta.com/horizon/downloads/package/meta-xr-simulator-mac-arm
    /// Unzip it under ~/Library/MetaXR/MetaXrSimulator/&lt;version&gt;/ (the
    /// folder Meta's package would use) or anywhere, then use the menu below.
    /// </summary>
    [InitializeOnLoad]
    public static class MetaXRSimulatorActivator
    {
        private const string PathKey = "RecallAR.MetaXRSimulator.RuntimeJson";
        private const string ActiveKey = "RecallAR.MetaXRSimulator.Active";
        private const string Menu = "RecallAR/Meta XR Simulator/";

        static MetaXRSimulatorActivator()
        {
            if (EditorPrefs.GetBool(ActiveKey, false))
            {
                var path = EditorPrefs.GetString(PathKey, "");
                if (File.Exists(path)) Apply(path);
            }
        }

        [MenuItem(Menu + "Activate", false, 0)]
        public static void Activate()
        {
            var path = EditorPrefs.GetString(PathKey, "");
            if (!File.Exists(path)) path = FindDefault();
            if (!File.Exists(path))
            {
                path = EditorUtility.OpenFilePanel("Locate meta_openxr_simulator.json (inside the unzipped Meta XR Simulator)",
                    DefaultRoot, "json");
            }
            if (!File.Exists(path))
            {
                Debug.LogWarning("Meta XR Simulator not found. Download it from " +
                                 "https://developers.meta.com/horizon/downloads/package/meta-xr-simulator-mac-arm and unzip it, " +
                                 "then run RecallAR > Meta XR Simulator > Activate again and pick meta_openxr_simulator.json.");
                return;
            }

            EditorPrefs.SetString(PathKey, path);
            EditorPrefs.SetBool(ActiveKey, true);
            Apply(path);
            Debug.Log("Meta XR Simulator activated for this Editor: " + path + "\nPress Play on the XR scene.");
        }

        [MenuItem(Menu + "Activate", true)]
        private static bool ValidateActivate()
        {
            UnityEditor.Menu.SetChecked(Menu + "Activate", EditorPrefs.GetBool(ActiveKey, false));
            return true;
        }

        [MenuItem(Menu + "Deactivate", false, 1)]
        public static void Deactivate()
        {
            EditorPrefs.SetBool(ActiveKey, false);
            Environment.SetEnvironmentVariable("XR_RUNTIME_JSON", null);
            Environment.SetEnvironmentVariable("XR_SELECTED_RUNTIME_JSON", null);
            Debug.Log("Meta XR Simulator deactivated (system default OpenXR runtime restored for this Editor).");
        }

        [MenuItem(Menu + "Choose runtime file...", false, 20)]
        public static void Choose()
        {
            var path = EditorUtility.OpenFilePanel("Locate meta_openxr_simulator.json", DefaultRoot, "json");
            if (!File.Exists(path)) return;
            EditorPrefs.SetString(PathKey, path);
            Activate();
        }

        private static string DefaultRoot =>
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Library", "MetaXR", "MetaXrSimulator");

        private static string FindDefault()
        {
            if (!Directory.Exists(DefaultRoot)) return null;
            return Directory.GetFiles(DefaultRoot, "meta_openxr_simulator.json", SearchOption.AllDirectories)
                .OrderByDescending(p => p)
                .FirstOrDefault();
        }

        private static void Apply(string path)
        {
            Environment.SetEnvironmentVariable("XR_RUNTIME_JSON", path);
            Environment.SetEnvironmentVariable("XR_SELECTED_RUNTIME_JSON", path);
        }
    }
}
