using RecallAR.Recognition;
using UnityEngine;

namespace RecallAR.UI
{
    /// <summary>
    /// Warms the tint of whatever object or person is currently being gazed
    /// at, proportional to how long the gaze has been held — a gentle
    /// progress cue rather than a jarring on/off highlight.
    /// </summary>
    public class ObjectHighlightController : MonoBehaviour
    {
        [SerializeField] private SimulatedObjectRecognitionProvider objectRecognition;
        [SerializeField] private SimulatedPersonRecognitionProvider personRecognition;
        [SerializeField] private Color highlightTint = new Color(1f, 0.85f, 0.45f);

        private Renderer[] highlighted = new Renderer[0];
        private Color[] originals = new Color[0];
        private GameObject highlightedRoot;

        private void Awake()
        {
            if (objectRecognition == null) objectRecognition = FindFirstObjectByType<SimulatedObjectRecognitionProvider>();
            if (personRecognition == null) personRecognition = FindFirstObjectByType<SimulatedPersonRecognitionProvider>();
        }

        private void Update()
        {
            GameObject root = null;
            var progress = 0f;

            if (objectRecognition != null && objectRecognition.CurrentTarget != null)
            {
                root = objectRecognition.CurrentTarget.gameObject;
                progress = objectRecognition.GazeProgress01;
            }
            else if (personRecognition != null && personRecognition.CurrentTarget != null)
            {
                root = personRecognition.CurrentTarget.gameObject;
                progress = personRecognition.GazeProgress01;
            }

            if (root != highlightedRoot)
            {
                Restore();
                highlightedRoot = root;
                highlighted = root != null ? root.GetComponentsInChildren<Renderer>() : new Renderer[0];
                originals = new Color[highlighted.Length];
                for (var i = 0; i < highlighted.Length; i++) originals[i] = highlighted[i].material.color;
            }

            for (var i = 0; i < highlighted.Length; i++)
                highlighted[i].material.color = Color.Lerp(originals[i], originals[i] * highlightTint * 1.35f, progress);
        }

        private void Restore()
        {
            for (var i = 0; i < highlighted.Length; i++)
                if (highlighted[i] != null) highlighted[i].material.color = originals[i];
        }

        private void OnDisable() => Restore();
    }
}
