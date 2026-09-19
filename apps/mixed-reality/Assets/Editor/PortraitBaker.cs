using System.IO;
using UnityEditor;
using UnityEngine;

namespace RecallAR.EditorTools
{
    /// <summary>
    /// Renders character models to PNGs — a head-and-shoulders portrait, or a
    /// group "family photo" — so frames in the room show real pictures. Bakes
    /// only when the PNG is missing (rendering needs a GPU, so -nographics
    /// builds just reuse the committed images).
    /// </summary>
    public static class PortraitBaker
    {
        private const string PortraitsFolder = "Assets/Art/Portraits";

        public struct Subject
        {
            public string modelAssetPath;
            public float xOffset;
            public float yRotation;
        }

        public static Texture2D GetOrBake(string modelName, string modelAssetPath, float scale, float headHeight)
        {
            return GetOrBakeGroup(modelName,
                new[] { new Subject { modelAssetPath = modelAssetPath, xOffset = 0f, yRotation = 0f } },
                scale, headHeight, 2.4f, 30f, 512, 512);
        }

        public static Texture2D GetOrBakeGroup(string outputName, Subject[] subjects, float scale, float cameraHeight,
            float cameraDistance, float fieldOfView, int width, int height)
        {
            var pngPath = $"{PortraitsFolder}/{outputName}.png";
            var existing = AssetDatabase.LoadAssetAtPath<Texture2D>(pngPath);
            if (existing != null) return existing;

            var origin = new Vector3(500f, 0f, 500f);
            var instances = new GameObject[subjects.Length];
            for (var i = 0; i < subjects.Length; i++)
            {
                var asset = AssetDatabase.LoadAssetAtPath<GameObject>(subjects[i].modelAssetPath);
                if (asset == null)
                {
                    Debug.LogError("PortraitBaker: model not found at " + subjects[i].modelAssetPath);
                    continue;
                }
                var go = (GameObject)Object.Instantiate(asset);
                go.transform.position = origin + new Vector3(subjects[i].xOffset, 0f, 0f);
                go.transform.rotation = Quaternion.Euler(0f, subjects[i].yRotation, 0f); // front = +Z
                go.transform.localScale = Vector3.one * scale;
                instances[i] = go;
            }

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

            var camGo = new GameObject("Portrait Camera");
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.94f, 0.9f, 0.82f);
            cam.fieldOfView = fieldOfView;
            cam.aspect = (float)width / height;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 20f;
            camGo.transform.position = origin + new Vector3(0f, cameraHeight, cameraDistance);
            camGo.transform.rotation = Quaternion.Euler(0f, 180f, 0f);

            var rt = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
            cam.targetTexture = rt;
            cam.Render();

            for (var i = 0; i < sceneLights.Length; i++) if (sceneLights[i] != null) sceneLights[i].enabled = wereEnabled[i];
            RenderSettings.ambientMode = savedAmbient;
            RenderSettings.ambientLight = savedAmbientColor;

            var previous = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(width, height, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            tex.Apply();
            RenderTexture.active = previous;

            var pixels = tex.GetPixels32();
            var sum = 0L;
            foreach (var p in pixels) sum += p.r + p.g + p.b;
            Debug.Log($"PortraitBaker: {outputName} average brightness {(sum / (3.0 * pixels.Length)):F0}/255");

            if (!AssetDatabase.IsValidFolder(PortraitsFolder)) AssetDatabase.CreateFolder("Assets/Art", "Portraits");
            File.WriteAllBytes(pngPath, tex.EncodeToPNG());

            cam.targetTexture = null;
            Object.DestroyImmediate(rt);
            Object.DestroyImmediate(tex);
            Object.DestroyImmediate(camGo);
            Object.DestroyImmediate(lightGo);
            foreach (var go in instances) if (go != null) Object.DestroyImmediate(go);

            AssetDatabase.ImportAsset(pngPath, ImportAssetOptions.ForceSynchronousImport);
            return AssetDatabase.LoadAssetAtPath<Texture2D>(pngPath);
        }
    }
}
