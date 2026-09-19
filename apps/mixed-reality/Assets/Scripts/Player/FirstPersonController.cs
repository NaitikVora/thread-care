using UnityEngine;

namespace RecallAR.Player
{
    /// <summary>
    /// Grounded first-person movement standing in for a headset: mouse-look
    /// (yaw on the body, pitch on the camera), WASD walking on the floor with
    /// gravity, and collision against furniture via a CharacterController.
    /// The camera child sits at eye height. A Meta XR camera rig replaces
    /// this whole component later; gaze logic only cares about the Camera.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class FirstPersonController : MonoBehaviour
    {
        [SerializeField] private Transform cameraPivot;
        [SerializeField] private float lookSensitivity = 2f;
        [SerializeField] private float walkSpeed = 1.8f;
        [SerializeField] private float gravity = -9.81f;
        [SerializeField] private bool lockCursor = true;

        private CharacterController controller;
        private float yaw;
        private float pitch;
        private float verticalVelocity;

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
            yaw = transform.eulerAngles.y;
        }

        private void Start()
        {
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
            else if (Input.GetMouseButtonDown(0) && Cursor.lockState != CursorLockMode.Locked && lockCursor)
            {
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }

            if (Cursor.lockState == CursorLockMode.Locked)
            {
                yaw += Input.GetAxis("Mouse X") * lookSensitivity;
                pitch -= Input.GetAxis("Mouse Y") * lookSensitivity;
                pitch = Mathf.Clamp(pitch, -75f, 75f);
            }

            transform.rotation = Quaternion.Euler(0f, yaw, 0f);
            if (cameraPivot != null) cameraPivot.localRotation = Quaternion.Euler(pitch, 0f, 0f);

            var input = new Vector3(Input.GetAxis("Horizontal"), 0f, Input.GetAxis("Vertical"));
            input = Vector3.ClampMagnitude(input, 1f);
            var move = transform.TransformDirection(input) * walkSpeed;

            if (controller.isGrounded && verticalVelocity < 0f) verticalVelocity = -1f;
            verticalVelocity += gravity * Time.deltaTime;
            move.y = verticalVelocity;

            controller.Move(move * Time.deltaTime);
        }
    }
}
