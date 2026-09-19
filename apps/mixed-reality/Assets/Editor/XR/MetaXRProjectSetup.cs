using Meta.XR;
using UnityEditor;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEditor.XR.OpenXR.Features;
using UnityEngine;
using UnityEngine.XR.Management;
using UnityEngine.XR.OpenXR;

namespace RecallAR.EditorTools.XR
{
    /// <summary>
    /// Configures XR Plug-in Management for Standalone (macOS/Windows Editor)
    /// to use the OpenXR loader with Meta's OpenXR feature enabled — the
    /// project-settings half of "Meta XR in the Editor", scripted so it's
    /// reproducible and verifiable headlessly. Only compiles when the Meta
    /// XR Core SDK and Unity OpenXR packages are present (see the asmdef).
    /// </summary>
    public static class MetaXRProjectSetup
    {
        private const string SettingsFolder = "Assets/XR";
        private const string SettingsAsset = SettingsFolder + "/XRGeneralSettings.asset";

        [MenuItem("RecallAR/Meta XR/Configure Project (OpenXR + Meta feature)")]
        public static void Configure()
        {
            var group = BuildTargetGroup.Standalone;

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
                settings.name = "Standalone Settings";
                var manager = ScriptableObject.CreateInstance<XRManagerSettings>();
                manager.name = "Standalone Providers";
                settings.AssignedSettings = manager;
                AssetDatabase.AddObjectToAsset(settings, perTarget);
                AssetDatabase.AddObjectToAsset(manager, perTarget);
                perTarget.SetSettingsForBuildTarget(group, settings);
            }
            settings.InitManagerOnStart = true;

            var assigned = XRPackageMetadataStore.AssignLoader(settings.AssignedSettings, "UnityEngine.XR.OpenXR.OpenXRLoader", group);
            if (!assigned) Debug.LogWarning("MetaXRProjectSetup: could not assign the OpenXR loader (is com.unity.xr.openxr installed?)");

            FeatureHelpers.RefreshFeatures(group);
            var openXr = OpenXRSettings.GetSettingsForBuildTargetGroup(group);
            var meta = openXr != null ? openXr.GetFeature<MetaXRFeature>() : null;
            if (meta != null)
            {
                meta.enabled = true;
                EditorUtility.SetDirty(meta);
            }
            else Debug.LogWarning("MetaXRProjectSetup: Meta XR Feature not found in OpenXR features for Standalone.");

            EditorUtility.SetDirty(perTarget);
            EditorUtility.SetDirty(settings);
            EditorUtility.SetDirty(settings.AssignedSettings);
            if (openXr != null) EditorUtility.SetDirty(openXr);
            AssetDatabase.SaveAssets();
            Debug.Log("MetaXRProjectSetup: Standalone XR = OpenXR loader + Meta XR Feature, init on start.");
        }
    }
}
