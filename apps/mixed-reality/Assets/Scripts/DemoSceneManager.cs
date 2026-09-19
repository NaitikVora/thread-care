using System;
using RecallAR.Game;
using RecallAR.Quest;
using RecallAR.Reward;
using RecallAR.UI;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR
{
    /// <summary>
    /// Conducts the guided demo: greeting → find the mug → find Sarah → the
    /// Memory Corner game → find the glasses → a warm wrap-up. Each step ends
    /// with a memory card the user dismisses (Space/Continue) to move on.
    /// Owns only the instruction/progress line; every other panel is its own
    /// controller.
    /// </summary>
    public class DemoSceneManager : MonoBehaviour
    {
        [SerializeField] private QuestManager questManager;
        [SerializeField] private MemoryGameController memoryGame;
        [SerializeField] private MemoryCardController memoryCard;
        [SerializeField] private MemoryGardenController memoryGarden;
        [SerializeField] private GameObject instructionPanel;
        [SerializeField] private Text instructionText;
        [SerializeField] private Text progressText;
        [SerializeField] private string greeting = "Good morning, John.";
        [SerializeField] private float greetingDuration = 3f;
        [SerializeField] private float foundPauseBeforeMemory = 1.6f;
        [Tooltip("The memory game runs after this quest (index) is completed and its memory dismissed.")]
        [SerializeField] private int gameAfterQuestIndex = 1;

        private int questIndex = -1;
        private QuestDefinition pendingMemoryFor;
        private bool pendingGameSummary;
        private bool finished;

        private int TotalActivities => questManager.QuestCount + (memoryGame != null ? 1 : 0);
        private int ActivityNumber => questIndex + 1 + (memoryGame != null && questIndex > gameAfterQuestIndex ? 1 : 0);

        private void Awake()
        {
            questManager.QuestStarted += HandleQuestStarted;
            questManager.QuestCompleted += HandleQuestCompleted;
            memoryCard.Dismissed += HandleMemoryDismissed;
            if (memoryGame != null)
            {
                memoryGame.Message += ShowInstruction;
                memoryGame.Finished += HandleGameFinished;
            }
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
            SetProgress($"Activity {ActivityNumber} of {TotalActivities}   •   H for a hint");
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
            if (pendingGameSummary)
            {
                pendingGameSummary = false;
                StartNextQuest();
                return;
            }

            if (pendingMemoryFor == null) return;
            pendingMemoryFor = null;

            if (memoryGame != null && questIndex == gameAfterQuestIndex)
            {
                memoryGame.MakeAvailable();
                ShowInstruction("Let's play a little memory game. Walk over to the mat in the corner, by the three friends.");
                SetProgress($"Activity {questIndex + 2} of {TotalActivities}   •   Step on the blue mat");
                return;
            }

            StartNextQuest();
        }

        private void HandleGameFinished(float seconds)
        {
            var t = TimeSpan.FromSeconds(seconds);
            memoryGarden.GrowOne();
            pendingGameSummary = true;
            memoryCard.Show("Memory Game", $"You remembered everyone in {t.Minutes}:{t.Seconds:00}. Wonderful!");
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
            pendingGameSummary = false;
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
