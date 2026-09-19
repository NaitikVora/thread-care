using RecallAR.Recognition;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.UI
{
    /// <summary>
    /// A screen-center reticle showing where the gaze raycast points, and
    /// gently brightening/growing as dwell time builds toward recognition —
    /// without this, there is no visual way to know where "gaze" is aimed,
    /// which makes a small target like the mug feel impossible to find.
    /// </summary>
    public class ReticleController : MonoBehaviour
    {
        [SerializeField] private RectTransform reticleRect;
        [SerializeField] private Image reticleImage;
        [SerializeField] private SimulatedObjectRecognitionProvider objectRecognition;
        [SerializeField] private SimulatedPersonRecognitionProvider personRecognition;
        [SerializeField] private Color idleColor = new Color(1f, 1f, 1f, 0.7f);
        [SerializeField] private Color activeColor = new Color(1f, 0.85f, 0.4f, 1f);
        [SerializeField] private float idleSize = 14f;
        [SerializeField] private float activeSize = 24f;

        private void Update()
        {
            var hasObjectTarget = objectRecognition != null && objectRecognition.CurrentTarget != null;
            var hasPersonTarget = personRecognition != null && personRecognition.CurrentTarget != null;
            var progress = Mathf.Max(
                hasObjectTarget ? objectRecognition.GazeProgress01 : 0f,
                hasPersonTarget ? personRecognition.GazeProgress01 : 0f);

            reticleImage.color = Color.Lerp(idleColor, activeColor, progress);
            var size = Mathf.Lerp(idleSize, activeSize, progress);
            reticleRect.sizeDelta = new Vector2(size, size);
        }
    }
}
