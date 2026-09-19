using UnityEngine;

namespace RecallAR.Player
{
    /// <summary>
    /// Phone controls for the desktop-style room: drag on the left half of
    /// the screen to walk, drag on the right half to look. Feeds the same
    /// grounded CharacterController movement as <see cref="FirstPersonController"/>,
    /// so gaze-and-hold recognition works unchanged. Large, forgiving zones —
    /// no taps, no gestures to learn (spec section 33).
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class TouchLookController : MonoBehaviour
    {
        [SerializeField] private Transform cameraPivot;
        [SerializeField] private float lookSensitivity = 0.18f;   // degrees per pixel
        [SerializeField] private float walkSpeed = 1.6f;
        [SerializeField] private float walkRadiusPixels = 120f;
        [SerializeField] private float gravity = -9.81f;

        private CharacterController controller;
        private float yaw;
        private float pitch;
        private float verticalVelocity;

        private int walkFingerId = -1;
        private int lookFingerId = -1;
        private Vector2 walkOrigin;
        private Vector2 lookLast;
        private Vector2 walkInput;

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
            yaw = transform.eulerAngles.y;
        }

        private void Update()
        {
            ReadTouches();

            transform.rotation = Quaternion.Euler(0f, yaw, 0f);
            if (cameraPivot != null) cameraPivot.localRotation = Quaternion.Euler(pitch, 0f, 0f);

            var move = transform.TransformDirection(new Vector3(walkInput.x, 0f, walkInput.y)) * walkSpeed;
            if (controller.isGrounded && verticalVelocity < 0f) verticalVelocity = -1f;
            verticalVelocity += gravity * Time.deltaTime;
            move.y = verticalVelocity;
            controller.Move(move * Time.deltaTime);
        }

        private void ReadTouches()
        {
            walkInput = Vector2.zero;
            var half = Screen.width * 0.5f;

            for (var i = 0; i < Input.touchCount; i++)
            {
                var t = Input.GetTouch(i);
                var isWalkSide = t.position.x < half;

                switch (t.phase)
                {
                    case TouchPhase.Began:
                        if (isWalkSide && walkFingerId < 0) { walkFingerId = t.fingerId; walkOrigin = t.position; }
                        else if (!isWalkSide && lookFingerId < 0) { lookFingerId = t.fingerId; lookLast = t.position; }
                        break;
                    case TouchPhase.Moved:
                    case TouchPhase.Stationary:
                        if (t.fingerId == walkFingerId)
                        {
                            var delta = t.position - walkOrigin;
                            walkInput = Vector2.ClampMagnitude(delta / walkRadiusPixels, 1f);
                        }
                        else if (t.fingerId == lookFingerId)
                        {
                            var delta = t.position - lookLast;
                            lookLast = t.position;
                            yaw += delta.x * lookSensitivity;
                            pitch = Mathf.Clamp(pitch - delta.y * lookSensitivity, -75f, 75f);
                        }
                        break;
                    case TouchPhase.Ended:
                    case TouchPhase.Canceled:
                        if (t.fingerId == walkFingerId) walkFingerId = -1;
                        if (t.fingerId == lookFingerId) lookFingerId = -1;
                        break;
                }
            }

            if (walkFingerId >= 0)
            {
                // Keep walking while the finger is held still (Stationary may
                // not report every frame on all devices).
                var stillDown = false;
                for (var i = 0; i < Input.touchCount; i++)
                    if (Input.GetTouch(i).fingerId == walkFingerId) { stillDown = true; walkInput = Vector2.ClampMagnitude((Input.GetTouch(i).position - walkOrigin) / walkRadiusPixels, 1f); }
                if (!stillDown) walkFingerId = -1;
            }
        }
    }
}
