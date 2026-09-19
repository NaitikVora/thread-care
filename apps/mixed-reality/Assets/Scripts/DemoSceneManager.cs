using RecallAR.Quest;
using RecallAR.Reward;
using RecallAR.UI;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR
{
    /// <summary>
    /// Orchestrates the one demo sequence described in the spec (section 10):
    /// greeting → quest instruction → found it → memory → points → garden →
    /// then the person-recognition moment when the user looks at Sarah. Owns
    /// only the top instruction line; every other panel is its own
    /// controller so this stays a thin conductor, not a god object.
    /// </summary>
    public class DemoSceneManager : MonoBehaviour
    {
        [SerializeField] private QuestManager questManager;
        [SerializeField] private MemoryCardController memoryCard;
        [SerializeField] private GameObject instructionPanel;
        [SerializeField] private Text instructionText;
        [SerializeField] private string greeting = "Good morning, John.";
        [SerializeField] private float greetingDuration = 3f;
        [SerializeField] private float foundItDisplayDuration = 2.5f;

        private void Awake()
        {
            questManager.QuestStarted += HandleQuestStarted;
            questManager.QuestCompleted += HandleQuestCompleted;
        }

        private void Start()
        {
            ShowInstruction(greeting);
            Invoke(nameof(BeginFirstQuest), greetingDuration);
        }

        private void BeginFirstQuest() => questManager.StartQuest(0);

        private void HandleQuestStarted(ObjectQuest quest) => ShowInstruction(quest.instruction);

        private void HandleQuestCompleted(ObjectQuest quest)
        {
            ShowInstruction("You found it!");
            memoryCard.Show(quest.targetObject.displayName, quest.targetObject.associatedMemory);
            Invoke(nameof(HideInstruction), foundItDisplayDuration);
        }

        private void ShowInstruction(string text)
        {
            instructionText.text = text;
            instructionPanel.SetActive(true);
        }

        private void HideInstruction() => instructionPanel.SetActive(false);
    }
}
