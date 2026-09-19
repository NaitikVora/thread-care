using UnityEngine;

namespace RecallAR.Data
{
    /// <summary>
    /// Identity metadata for a familiar person in the demo scene. The Sarah
    /// avatar's identity is known because this component is attached to her
    /// GameObject — this is the simulator standing in for a future real
    /// identification step, never real facial recognition.
    /// </summary>
    public class RecognizablePerson : MonoBehaviour
    {
        public string personId = "sarah_01";
        public string displayName = "Sarah";
        public string relationship = "Your daughter";

        [TextArea]
        public string shortDescription = "Sarah lives in Boston and loves hiking with you.";

        [TextArea]
        public string associatedMemory = "You and Sarah visited Boston together.";

        public Sprite profileImage;

        [Tooltip("Seconds of held gaze before this person is considered recognized.")]
        public float recognitionDelay = 1.5f;
    }
}
