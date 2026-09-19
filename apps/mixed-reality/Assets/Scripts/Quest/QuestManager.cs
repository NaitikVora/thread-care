using System;
using RecallAR.Data;
using RecallAR.Recognition;
using UnityEngine;

namespace RecallAR.Quest
{
    public enum QuestTargetKind { Object, Person }

    [Serializable]
    public class QuestDefinition
    {
        public string questId = "coffee_mug_quest";
        public QuestTargetKind kind = QuestTargetKind.Object;

        [TextArea] public string instruction = "Let's find your coffee mug.";
        [TextArea] public string hintText = "Try looking near the coffee machine.";
        [TextArea] public string foundText = "You found it!";

        public RecallARObject targetObject;
        public RecognizablePerson targetPerson;
        public int rewardPoints = 10;

        public string TargetDisplayName => kind == QuestTargetKind.Person
            ? (targetPerson != null ? targetPerson.displayName : "")
            : (targetObject != null ? targetObject.displayName : "");

        public string AssociatedMemory => kind == QuestTargetKind.Person
            ? (targetPerson != null ? targetPerson.associatedMemory : "")
            : (targetObject != null ? targetObject.associatedMemory : "");
    }

    /// <summary>
    /// Owns the active quest (find an object, or find a familiar person),
    /// completes it when the matching target is recognized, and counts hints.
    /// Hints are never penalized — <see cref="HintsUsed"/> is descriptive only.
    /// </summary>
    public class QuestManager : MonoBehaviour
    {
        [SerializeField] private SimulatedObjectRecognitionProvider objectRecognition;
        [SerializeField] private SimulatedPersonRecognitionProvider personRecognition;
        [SerializeField] private QuestDefinition[] quests;

        public event Action<QuestDefinition> QuestStarted;
        public event Action<QuestDefinition> QuestCompleted;
        public event Action<string> HintRequested;

        public QuestDefinition ActiveQuest { get; private set; }
        public int HintsUsed { get; private set; }
        public int QuestCount => quests?.Length ?? 0;

        private void Awake()
        {
            if (objectRecognition == null) objectRecognition = FindFirstObjectByType<SimulatedObjectRecognitionProvider>();
            if (personRecognition == null) personRecognition = FindFirstObjectByType<SimulatedPersonRecognitionProvider>();
        }

        private void OnEnable()
        {
            if (objectRecognition != null) objectRecognition.ObjectRecognized += HandleObjectRecognized;
            if (personRecognition != null) personRecognition.PersonRecognized += HandlePersonRecognized;
        }

        private void OnDisable()
        {
            if (objectRecognition != null) objectRecognition.ObjectRecognized -= HandleObjectRecognized;
            if (personRecognition != null) personRecognition.PersonRecognized -= HandlePersonRecognized;
        }

        public bool StartQuest(int index)
        {
            if (quests == null || index < 0 || index >= quests.Length) return false;
            ActiveQuest = quests[index];
            HintsUsed = 0;
            QuestStarted?.Invoke(ActiveQuest);
            return true;
        }

        public void RequestHint()
        {
            if (ActiveQuest == null) return;
            HintsUsed++;
            var hint = string.IsNullOrEmpty(ActiveQuest.hintText) && ActiveQuest.targetObject != null
                ? ActiveQuest.targetObject.hintText
                : ActiveQuest.hintText;
            HintRequested?.Invoke(hint);
        }

        private void HandleObjectRecognized(RecallARObject recognized)
        {
            if (ActiveQuest == null || ActiveQuest.kind != QuestTargetKind.Object || recognized != ActiveQuest.targetObject) return;
            Complete();
        }

        private void HandlePersonRecognized(RecognizablePerson recognized)
        {
            if (ActiveQuest == null || ActiveQuest.kind != QuestTargetKind.Person || recognized != ActiveQuest.targetPerson) return;
            Complete();
        }

        private void Complete()
        {
            var completed = ActiveQuest;
            ActiveQuest = null;
            QuestCompleted?.Invoke(completed);
        }
    }
}
