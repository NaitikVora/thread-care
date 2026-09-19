using System.Collections.Generic;
using RecallAR.Game;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;

namespace RecallAR.AR
{
    /// <summary>
    /// Waits for ARKit to find the floor, then arranges the demo content
    /// around the person — a little kitchen table ahead, Sarah to one side,
    /// the Memory Corner behind, the nightstand with the phone to the other
    /// side, the garden nearby — anchored to the real floor. Then hands over
    /// to <see cref="DemoSceneManager"/>. Recognition stays gaze-based on
    /// these virtual objects; nothing here looks at the camera image.
    /// </summary>
    public class ARDemoPlacer : MonoBehaviour
    {
        [System.Serializable]
        public class Placement
        {
            public Transform group;
            [Tooltip("Degrees clockwise from where the person is facing when the room is scanned.")]
            public float angle;
            public float distance = 2f;
        }

        [SerializeField] private ARPlaneManager planeManager;
        [SerializeField] private Transform arCamera;
        [SerializeField] private Placement[] placements;
        [SerializeField] private GuidePathController guidePath;
        [SerializeField] private DemoSceneManager demo;
        [SerializeField] private GameObject instructionPanel;
        [SerializeField] private Text instructionText;
        [SerializeField] private Text progressText;
        [SerializeField] private float minFloorArea = 0.8f;
        [SerializeField] private float minCameraHeight = 0.7f;

        public bool Placed { get; private set; }

        private void Start()
        {
            foreach (var p in placements) if (p.group != null) p.group.gameObject.SetActive(false);
            if (instructionPanel != null) instructionPanel.SetActive(true);
            if (instructionText != null) instructionText.text = "Point your phone at the floor and move it slowly.";
            if (progressText != null) progressText.text = "Looking for the floor…";
        }

        private void Update()
        {
            if (Placed || planeManager == null || arCamera == null) return;

            ARPlane floor = null;
            var best = float.MaxValue;
            var count = 0;
            foreach (var plane in planeManager.trackables)
            {
                count++;
                if (plane.alignment != PlaneAlignment.HorizontalUp) continue;
                if (plane.size.x * plane.size.y < minFloorArea) continue;
                var height = arCamera.position.y - plane.center.y;
                if (height < minCameraHeight) continue; // a table, not the floor
                if (plane.center.y < best) { best = plane.center.y; floor = plane; }
            }

            if (progressText != null && count > 0 && floor == null)
                progressText.text = "Keep moving slowly — a bit more floor please.";

            if (floor != null) Place(floor.center.y);
        }

        private void Place(float floorY)
        {
            Placed = true;

            var forward = arCamera.forward;
            forward.y = 0f;
            if (forward.sqrMagnitude < 0.001f) forward = Vector3.forward;
            var yaw = Quaternion.LookRotation(forward.normalized, Vector3.up).eulerAngles.y;
            var origin = new Vector3(arCamera.position.x, floorY, arCamera.position.z);

            foreach (var p in placements)
            {
                if (p.group == null) continue;
                var dir = Quaternion.Euler(0f, yaw + p.angle, 0f) * Vector3.forward;
                p.group.position = origin + dir * p.distance;
                p.group.rotation = Quaternion.LookRotation(dir, Vector3.up); // +Z points away from the person
                p.group.gameObject.SetActive(true);
            }

            if (guidePath != null) guidePath.SetFloorY(floorY);

            // Stop scanning; the layout is fixed to the real floor now.
            planeManager.requestedDetectionMode = PlaneDetectionMode.None;
            planeManager.enabled = false;

            if (progressText != null) progressText.text = "";
            if (demo != null) demo.Begin();
        }
    }
}
