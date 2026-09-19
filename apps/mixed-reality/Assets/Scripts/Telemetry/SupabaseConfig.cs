using System;
using System.IO;
using UnityEngine;

namespace RecallAR.Telemetry
{
    /// <summary>
    /// Connection details for the caregiver database, read at startup from
    /// StreamingAssets/recallar-supabase.json (kept out of git — copy the
    /// .example file and fill it in). When the file is missing or invalid the
    /// app runs exactly as before and simply doesn't log.
    /// </summary>
    [Serializable]
    public class SupabaseConfig
    {
        public const string FileName = "recallar-supabase.json";

        /// <summary>Project URL, e.g. https://abcdefghijkl.supabase.co</summary>
        public string url;
        /// <summary>The project's public "anon" key (Settings → API).</summary>
        public string anonKey;
        /// <summary>UUID of the patient row this device belongs to.</summary>
        public string patientId;
        /// <summary>Free text shown on the dashboard, e.g. "iphone-ar".</summary>
        public string device = "unknown";

        public bool IsValid =>
            !string.IsNullOrWhiteSpace(url) && !string.IsNullOrWhiteSpace(anonKey) && !string.IsNullOrWhiteSpace(patientId);

        public string RestBase => url.TrimEnd('/') + "/rest/v1/";

        /// <summary>
        /// Loads the config synchronously. On iOS/desktop StreamingAssets is a
        /// plain folder; on Android it lives inside the APK (not supported by
        /// this synchronous loader — returns null there).
        /// </summary>
        public static SupabaseConfig Load()
        {
            var path = Path.Combine(Application.streamingAssetsPath, FileName);
            try
            {
                if (Application.platform == RuntimePlatform.Android)
                {
                    Debug.LogWarning("SupabaseConfig: Android StreamingAssets not supported by the synchronous loader; logging disabled.");
                    return null;
                }
                if (!File.Exists(path))
                {
                    Debug.Log($"SupabaseConfig: no {FileName} in StreamingAssets — activity logging is off.");
                    return null;
                }
                var config = JsonUtility.FromJson<SupabaseConfig>(File.ReadAllText(path));
                if (config == null || !config.IsValid)
                {
                    Debug.LogWarning($"SupabaseConfig: {FileName} is missing url, anonKey or patientId — activity logging is off.");
                    return null;
                }
                return config;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"SupabaseConfig: could not read {path}: {e.Message}");
                return null;
            }
        }
    }
}
