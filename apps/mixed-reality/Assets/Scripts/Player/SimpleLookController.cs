using UnityEngine;

namespace RecallAR.Player
{
    /// <summary>
    /// Mouse-look + WASD movement standing in for headset head-tracking,
    /// purely so the demo is playable today without any XR hardware or SDK.
    /// This is exactly the piece a Meta XR SDK camera rig (OVRCameraRig / XR
    /// Origin) would replace later — everything else reads gaze off whatever
    /// Camera is assigned to <see cref="GazeRecognitionController"/>.
    /// </summary>
    public class SimpleLookController : MonoBehaviour
    {
        [SerializeField] private float lookSensitivity = 2f;
        [SerializeField] private float moveSpeed = 2.5f;
        [SerializeField] private bool lockCursor = true;

        private float yaw;
        private float pitch;

        private void Start()
        {
            var angles = transform.eulerAngles;
            yaw = angles.y;
            pitch = angles.x;
            if (lockCursor)
            {
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }

            yaw += Input.GetAxis("Mouse X") * lookSensitivity;
            pitch -= Input.GetAxis("Mouse Y") * lookSensitivity;
            pitch = Mathf.Clamp(pitch, -80f, 80f);
            transform.eulerAngles = new Vector3(pitch, yaw, 0f);

            var move = new Vector3(Input.GetAxis("Horizontal"), 0f, Input.GetAxis("Vertical"));
            transform.position += transform.TransformDirection(move) * (moveSpeed * Time.deltaTime);
        }
    }
}
