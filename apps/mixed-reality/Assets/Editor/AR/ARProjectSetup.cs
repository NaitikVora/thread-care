using UnityEditor;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEngine;
using UnityEngine.XR.Management;

namespace RecallAR.EditorTools.AR
{
    /// <summary>
    /// Enables the ARKit loader for iOS in XR Plug-in Management, scripted so
    /// it's reproducible (the Standalone/Meta XR settings are untouched).
    /// </summary>
    public static class ARProjectSetup
    {
        private const string SettingsFolder = "Assets/XR";
        private const string SettingsAsset = SettingsFolder + "/XRGeneralSettings.asset";

        [MenuItem("RecallAR/Phone AR/Configure Project (ARKit loader)")]
        public static void Configure()
        {
            var group = BuildTargetGroup.iOS;

            EditorBuildSettings.TryGetConfigObject(XRGeneralSettings.k_SettingsKey, out XRGeneralSettingsPerBuildTarget perTarget);
            if (perTarget == null)
            {
                if (!AssetDatabase.IsValidFolder(SettingsFolder)) AssetDatabase.CreateFolder("Assets", "XR");
                perTarget = ScriptableObject.CreateInstance<XRGeneralSettingsPerBuildTarget>();
                AssetDatabase.CreateAsset(perTarget, SettingsAsset);
                EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, perTarget, true);
            }

            var settings = perTarget.SettingsForBuildTarget(group);
            if (settings == null)
            {
                settings = ScriptableObject.CreateInstance<XRGeneralSettings>();
                settings.name = "iOS Settings";
                var manager = ScriptableObject.CreateInstance<XRManagerSettings>();
                manager.name = "iOS Providers";
                settings.AssignedSettings = manager;
                AssetDatabase.AddObjectToAsset(settings, perTarget);
                AssetDatabase.AddObjectToAsset(manager, perTarget);
                perTarget.SetSettingsForBuildTarget(group, settings);
            }
            settings.InitManagerOnStart = true;

            var assigned = XRPackageMetadataStore.AssignLoader(settings.AssignedSettings, "UnityEngine.XR.ARKit.ARKitLoader", group);
            if (!assigned) Debug.LogWarning("ARProjectSetup: could not assign the ARKit loader (is com.unity.xr.arkit installed?)");

            EditorUtility.SetDirty(perTarget);
            EditorUtility.SetDirty(settings);
            EditorUtility.SetDirty(settings.AssignedSettings);
            AssetDatabase.SaveAssets();
            Debug.Log("ARProjectSetup: iOS XR = ARKit loader, init on start.");
        }
    }
}
