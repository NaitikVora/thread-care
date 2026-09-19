using System;
using RecallAR.Data;
using UnityEngine;

namespace RecallAR.Recognition
{
    /// <summary>
    /// Determines which <see cref="RecognizablePerson"/> the gaze is on via
    /// raycast-and-hold. Do not read this as face recognition — it only ever
    /// looks up identity metadata already attached to a known GameObject.
    /// </summary>
    [RequireComponent(typeof(GazeRecognitionController))]
    public class SimulatedPersonRecognitionProvider : MonoBehaviour, IPersonRecognitionProvider
    {
        [SerializeField] private GazeRecognitionController gaze;

        public event Action<RecognizablePerson> PersonRecognized;

        private RecognizablePerson currentTarget;
        private RecognizablePerson lastRecognized;
        private float dwellTime;

        public RecognizablePerson CurrentTarget => currentTarget;

        public float GazeProgress01 =>
            currentTarget == null ? 0f : Mathf.Clamp01(dwellTime / Mathf.Max(0.01f, currentTarget.recognitionDelay));

        private void Awake()
        {
            if (gaze == null) gaze = GetComponent<GazeRecognitionController>();
        }

        private void Update()
        {
            RecognizablePerson hitPerson = null;
            if (gaze.TryGetCurrentHit(out var hit))
                hitPerson = hit.collider.GetComponentInParent<RecognizablePerson>();

            if (hitPerson != currentTarget)
            {
                currentTarget = hitPerson;
                dwellTime = 0f;
                if (hitPerson == null) lastRecognized = null;
            }

            if (currentTarget == null) return;

            dwellTime += Time.deltaTime;
            if (dwellTime >= currentTarget.recognitionDelay && lastRecognized != currentTarget)
            {
                lastRecognized = currentTarget;
                PersonRecognized?.Invoke(currentTarget);
            }
        }
    }
}
