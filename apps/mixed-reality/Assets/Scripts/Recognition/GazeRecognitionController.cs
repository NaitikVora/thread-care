using UnityEngine;

namespace RecallAR.Recognition
{
    /// <summary>
    /// Casts a single ray each frame from the gaze camera and exposes the
    /// current hit so multiple recognition providers can share one raycast
    /// instead of each doing their own. The gaze camera is a plain
    /// mouse-look camera today (see <c>SimpleLookController</c>); swapping in
    /// a Meta XR headset camera later is just reassigning this field.
    /// </summary>
    public class GazeRecognitionController : MonoBehaviour
    {
        [SerializeField] private Camera gazeCamera;
        [SerializeField] private float maxDistance = 15f;

        public Camera GazeCamera => gazeCamera;

        private void Reset()
        {
            gazeCamera = Camera.main;
        }

        private void Awake()
        {
            if (gazeCamera == null) gazeCamera = Camera.main;
        }

        public bool TryGetCurrentHit(out RaycastHit hit)
        {
            if (gazeCamera == null)
            {
                hit = default;
                return false;
            }

            var ray = new Ray(gazeCamera.transform.position, gazeCamera.transform.forward);
            return Physics.Raycast(ray, out hit, maxDistance);
        }
    }
}
