using RecallAR.Quest;
using RecallAR.Reward;
using RecallAR.UI;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR
{
    /// <summary>
    /// Conducts the guided demo sequence: greeting, then each quest in turn
    /// (find the mug → find Sarah → find the glasses), each followed by a
    /// memory card that the user dismisses to move on, ending on a warm
    /// wrap-up. Owns only the instruction/progress line; every other panel
    /// is its own controller.
    /// </summary>
    public class DemoSceneManager : MonoBehaviour
    {
        [SerializeField] private QuestManager questManager;
        [SerializeField] private MemoryCardController memoryCard;
        [SerializeField] private MemoryGardenController memoryGarden;
        [SerializeField] private GameObject instructionPanel;
        [SerializeField] private Text instructionText;
        [SerializeField] private Text progressText;
        [SerializeField] private string greeting = "Good morning, John.";
        [SerializeField] private float greetingDuration = 3f;
        [SerializeField] private float foundPauseBeforeMemory = 1.6f;

        private int questIndex = -1;
        private QuestDefinition pendingMemoryFor;
        private bool finished;

        private void Awake()
        {
            questManager.QuestStarted += HandleQuestStarted;
            questManager.QuestCompleted += HandleQuestCompleted;
            memoryCard.Dismissed += HandleMemoryDismissed;
        }

        private void Start()
        {
            ShowInstruction(greeting);
            SetProgress("");
            Invoke(nameof(StartNextQuest), greetingDuration);
        }

        private void Update()
        {
            if (finished && (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return))) Restart();
        }

        private void StartNextQuest()
        {
            questIndex++;
            if (!questManager.StartQuest(questIndex)) Finish();
        }

        private void HandleQuestStarted(QuestDefinition quest)
        {
            ShowInstruction(quest.instruction);
            SetProgress($"Activity {questIndex + 1} of {questManager.QuestCount}   •   H for a hint");
        }

        private void HandleQuestCompleted(QuestDefinition quest)
        {
            ShowInstruction(string.IsNullOrEmpty(quest.foundText) ? "You found it!" : quest.foundText);
            pendingMemoryFor = quest;

            // For a person, the identity card (with its own Remember step)
            // leads into the memory card; for an object, show the memory
            // after a short beat so "You found it!" lands first.
            if (quest.kind == QuestTargetKind.Object) Invoke(nameof(ShowPendingObjectMemory), foundPauseBeforeMemory);
        }

        private void ShowPendingObjectMemory()
        {
            if (pendingMemoryFor == null) return;
            memoryCard.Show(pendingMemoryFor.TargetDisplayName, pendingMemoryFor.AssociatedMemory);
        }

        private void HandleMemoryDismissed()
        {
            if (pendingMemoryFor == null) return;
            pendingMemoryFor = null;
            StartNextQuest();
        }

        private void Finish()
        {
            finished = true;
            ShowInstruction("That's everything for today. Wonderful, John!");
            var flowers = memoryGarden != null ? memoryGarden.FlowerCount : 0;
            SetProgress(flowers == 1
                ? "You grew 1 flower in your Memory Garden today.   •   Space to play again"
                : $"You grew {flowers} flowers in your Memory Garden today.   •   Space to play again");
        }

        private void Restart()
        {
            finished = false;
            questIndex = -1;
            pendingMemoryFor = null;
            ShowInstruction(greeting);
            SetProgress("");
            Invoke(nameof(StartNextQuest), 1.5f);
        }

        private void ShowInstruction(string text)
        {
            instructionText.text = text;
            instructionPanel.SetActive(true);
        }

        private void SetProgress(string text)
        {
            if (progressText != null) progressText.text = text;
        }
    }
}
