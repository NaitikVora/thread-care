using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace RecallAR.EditorTools
{
    /// <summary>
    /// Logs the real world-space bounds of every imported model under
    /// Assets/Art/Kenney so scene placement is based on measured sizes and
    /// pivot offsets, not guesses. Run headlessly with
    /// -executeMethod RecallAR.EditorTools.ModelMeasurer.MeasureAll
    /// </summary>
    public static class ModelMeasurer
    {
        private const string Root = "Assets/Art/Kenney";

        [MenuItem("RecallAR/Measure Kenney Models")]
        public static void MeasureAll()
        {
            var sb = new StringBuilder();
            sb.AppendLine("MODEL_MEASUREMENTS_BEGIN");
            foreach (var path in Directory.GetFiles(Root, "*.fbx", SearchOption.AllDirectories))
            {
                var assetPath = path.Replace('\\', '/');
                var asset = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
                if (asset == null) { sb.AppendLine($"{assetPath}: LOAD FAILED"); continue; }

                var instance = (GameObject)Object.Instantiate(asset);
                instance.transform.position = Vector3.zero;
                instance.transform.rotation = Quaternion.identity;
                instance.transform.localScale = Vector3.one;

                var renderers = instance.GetComponentsInChildren<Renderer>();
                if (renderers.Length == 0)
                {
                    sb.AppendLine($"{Path.GetFileNameWithoutExtension(assetPath)}: NO RENDERERS");
                }
                else
                {
                    var b = renderers[0].bounds;
                    foreach (var r in renderers) b.Encapsulate(r.bounds);
                    sb.AppendLine(
                        $"{Path.GetFileNameWithoutExtension(assetPath)}: size=({b.size.x:F3},{b.size.y:F3},{b.size.z:F3}) " +
                        $"min=({b.min.x:F3},{b.min.y:F3},{b.min.z:F3}) max=({b.max.x:F3},{b.max.y:F3},{b.max.z:F3}) " +
                        $"rootScale={instance.transform.localScale.x:F3} children={instance.transform.childCount}");
                }
                Object.DestroyImmediate(instance);
            }
            sb.AppendLine("MODEL_MEASUREMENTS_END");
            Debug.Log(sb.ToString());
        }
    }
}
