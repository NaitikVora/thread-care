using RecallAR.Recognition;
using UnityEngine;

namespace RecallAR.UI
{
    /// <summary>
    /// Brightens the object currently being gazed at, proportional to how
    /// long the gaze has been held — a gentle progress cue rather than a
    /// jarring on/off highlight.
    /// </summary>
    public class ObjectHighlightController : MonoBehaviour
    {
        [SerializeField] private SimulatedObjectRecognitionProvider objectRecognition;
        [SerializeField] private Color highlightColor = new Color(1f, 0.92f, 0.55f);

        private Renderer highlightedRenderer;
        private Color originalColor;

        private void Awake()
        {
            if (objectRecognition == null)
                objectRecognition = FindFirstObjectByType<SimulatedObjectRecognitionProvider>();
        }

        private void Update()
        {
            var target = objectRecognition.CurrentTarget;
            var targetRenderer = target != null ? target.GetComponentInChildren<Renderer>() : null;

            if (targetRenderer != highlightedRenderer)
            {
                RestoreOriginal();
                highlightedRenderer = targetRenderer;
                if (highlightedRenderer != null) originalColor = highlightedRenderer.material.color;
            }

            if (highlightedRenderer != null)
                highlightedRenderer.material.color = Color.Lerp(originalColor, highlightColor, objectRecognition.GazeProgress01);
        }

        private void RestoreOriginal()
        {
            if (highlightedRenderer != null) highlightedRenderer.material.color = originalColor;
        }

        private void OnDisable() => RestoreOriginal();
    }
}
