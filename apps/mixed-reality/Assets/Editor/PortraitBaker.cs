using System.IO;
using UnityEditor;
using UnityEngine;

namespace RecallAR.EditorTools
{
    /// <summary>
    /// Renders a character model's head and shoulders to a PNG so the memory
    /// game can show framed portraits instead of standing figures. Bakes only
    /// when the PNG is missing (rendering needs a GPU, so -nographics builds
    /// just reuse the committed images).
    /// </summary>
    public static class PortraitBaker
    {
        private const string PortraitsFolder = "Assets/Art/Portraits";

        public static Texture2D GetOrBake(string modelName, string modelAssetPath, float scale, float headHeight)
        {
            var pngPath = $"{PortraitsFolder}/{modelName}.png";
            var existing = AssetDatabase.LoadAssetAtPath<Texture2D>(pngPath);
            if (existing != null) return existing;

            var asset = AssetDatabase.LoadAssetAtPath<GameObject>(modelAssetPath);
            if (asset == null)
            {
                Debug.LogError("PortraitBaker: model not found at " + modelAssetPath);
                return null;
            }

            const int size = 512;
            var origin = new Vector3(500f, 0f, 500f);

            var subject = (GameObject)Object.Instantiate(asset);
            subject.transform.position = origin;
            subject.transform.rotation = Quaternion.identity; // front = +Z
            subject.transform.localScale = Vector3.one * scale;

            // The scene's own lights are directional (global), so switch them
            // off for the bake or the subject gets lit twice and blows out.
            var sceneLights = Object.FindObjectsByType<Light>(FindObjectsSortMode.None);
            var wereEnabled = new bool[sceneLights.Length];
            for (var i = 0; i < sceneLights.Length; i++) { wereEnabled[i] = sceneLights[i].enabled; sceneLights[i].enabled = false; }
            var savedAmbient = RenderSettings.ambientMode;
            var savedAmbientColor = RenderSettings.ambientLight;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.45f, 0.45f, 0.5f);

            var lightGo = new GameObject("Portrait Light");
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 0.75f;
            light.color = new Color(1f, 0.96f, 0.9f);
            lightGo.transform.rotation = Quaternion.Euler(30f, 200f, 0f);

            // Head and shoulders: subject is ~1.6 m tall with a large blocky
            // head; from 2.4 m at 30° a 1.3 m tall window is visible.
            var camGo = new GameObject("Portrait Camera");
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.94f, 0.9f, 0.82f);
            cam.fieldOfView = 30f;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 10f;
            camGo.transform.position = origin + new Vector3(0f, headHeight, 2.4f);
            camGo.transform.rotation = Quaternion.Euler(0f, 180f, 0f);

            var rt = new RenderTexture(size, size, 24, RenderTextureFormat.ARGB32);
            cam.targetTexture = rt;
            cam.Render();

            for (var i = 0; i < sceneLights.Length; i++) if (sceneLights[i] != null) sceneLights[i].enabled = wereEnabled[i];
            RenderSettings.ambientMode = savedAmbient;
            RenderSettings.ambientLight = savedAmbientColor;

            var previous = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, size, size), 0, 0);
            tex.Apply();
            RenderTexture.active = previous;

            var pixels = tex.GetPixels32();
            var sum = 0L;
            foreach (var p in pixels) sum += p.r + p.g + p.b;
            Debug.Log($"PortraitBaker: {modelName} average brightness {(sum / (3.0 * pixels.Length)):F0}/255");

            if (!AssetDatabase.IsValidFolder(PortraitsFolder)) AssetDatabase.CreateFolder("Assets/Art", "Portraits");
            File.WriteAllBytes(pngPath, tex.EncodeToPNG());

            cam.targetTexture = null;
            Object.DestroyImmediate(rt);
            Object.DestroyImmediate(tex);
            Object.DestroyImmediate(camGo);
            Object.DestroyImmediate(lightGo);
            Object.DestroyImmediate(subject);

            AssetDatabase.ImportAsset(pngPath, ImportAssetOptions.ForceSynchronousImport);
            return AssetDatabase.LoadAssetAtPath<Texture2D>(pngPath);
        }
    }
}
