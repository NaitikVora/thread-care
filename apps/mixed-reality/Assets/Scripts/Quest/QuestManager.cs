using System;
using RecallAR.Data;
using RecallAR.Recognition;
using UnityEngine;

namespace RecallAR.Quest
{
    [Serializable]
    public class ObjectQuest
    {
        public string questId = "coffee_mug_quest";

        [TextArea]
        public string instruction = "Let's find your coffee mug.";

        public RecallARObject targetObject;
    }

    /// <summary>
    /// Owns the current object quest, listens for the target object being
    /// recognized, and tracks hints used. Hints are never penalized — see
    /// spec section 6/12 — <see cref="HintsUsed"/> is purely descriptive.
    /// </summary>
    public class QuestManager : MonoBehaviour
    {
        [SerializeField] private SimulatedObjectRecognitionProvider objectRecognition;
        [SerializeField] private ObjectQuest[] quests;

        public event Action<ObjectQuest> QuestStarted;
        public event Action<ObjectQuest> QuestCompleted;
        public event Action<string> HintRequested;

        public ObjectQuest ActiveQuest { get; private set; }
        public int HintsUsed { get; private set; }

        private void Awake()
        {
            if (objectRecognition == null)
                objectRecognition = FindFirstObjectByType<SimulatedObjectRecognitionProvider>();
        }

        private void OnEnable()
        {
            if (objectRecognition != null) objectRecognition.ObjectRecognized += HandleObjectRecognized;
        }

        private void OnDisable()
        {
            if (objectRecognition != null) objectRecognition.ObjectRecognized -= HandleObjectRecognized;
        }

        public void StartQuest(int index)
        {
            if (quests == null || index < 0 || index >= quests.Length) return;
            ActiveQuest = quests[index];
            HintsUsed = 0;
            QuestStarted?.Invoke(ActiveQuest);
        }

        public void RequestHint()
        {
            if (ActiveQuest?.targetObject == null) return;
            HintsUsed++;
            HintRequested?.Invoke(ActiveQuest.targetObject.hintText);
        }

        private void HandleObjectRecognized(RecallARObject recognized)
        {
            if (ActiveQuest == null || recognized != ActiveQuest.targetObject) return;
            var completed = ActiveQuest;
            ActiveQuest = null;
            QuestCompleted?.Invoke(completed);
        }
    }
}
