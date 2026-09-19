using System;
using RecallAR.Data;
using UnityEngine;

namespace RecallAR.Recognition
{
    /// <summary>
    /// Determines which <see cref="RecallARObject"/> the gaze is on via
    /// raycast-and-hold. Mirrors <see cref="SimulatedPersonRecognitionProvider"/>
    /// for objects instead of people.
    /// </summary>
    [RequireComponent(typeof(GazeRecognitionController))]
    public class SimulatedObjectRecognitionProvider : MonoBehaviour, IObjectRecognitionProvider
    {
        [SerializeField] private GazeRecognitionController gaze;

        public event Action<RecallARObject> ObjectRecognized;

        private RecallARObject currentTarget;
        private RecallARObject lastRecognized;
        private float dwellTime;

        public RecallARObject CurrentTarget => currentTarget;

        public float GazeProgress01 =>
            currentTarget == null ? 0f : Mathf.Clamp01(dwellTime / Mathf.Max(0.01f, currentTarget.recognitionDelay));

        private void Awake()
        {
            if (gaze == null) gaze = GetComponent<GazeRecognitionController>();
        }

        private void Update()
        {
            RecallARObject hitObject = null;
            if (gaze.TryGetCurrentHit(out var hit))
                hitObject = hit.collider.GetComponentInParent<RecallARObject>();

            if (hitObject != currentTarget)
            {
                currentTarget = hitObject;
                dwellTime = 0f;
                if (hitObject == null) lastRecognized = null;
            }

            if (currentTarget == null) return;

            dwellTime += Time.deltaTime;
            if (dwellTime >= currentTarget.recognitionDelay && lastRecognized != currentTarget)
            {
                lastRecognized = currentTarget;
                ObjectRecognized?.Invoke(currentTarget);
            }
        }
    }
}
