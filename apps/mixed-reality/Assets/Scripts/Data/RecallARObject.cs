using UnityEngine;

namespace RecallAR.Data
{
    /// <summary>
    /// Identity and quest metadata for a familiar household object. Object
    /// identity is known internally (this component); the simulator's job is
    /// only to decide when the user has looked at it long enough, not to
    /// actually detect what it is.
    /// </summary>
    public class RecallARObject : MonoBehaviour
    {
        public string objectId = "coffee_mug_01";
        public string displayName = "Coffee Mug";
        public string category = "Kitchen";

        [TextArea]
        public string associatedMemory = "You bought this mug during your trip to Boston with Sarah.";

        [TextArea]
        public string hintText = "Try looking near the coffee machine.";

        public int rewardPoints = 10;

        [Tooltip("Seconds of held gaze before this object is considered found.")]
        public float recognitionDelay = 1.5f;
    }
}
