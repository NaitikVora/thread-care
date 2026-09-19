using RecallAR.Quest;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.Reward
{
    /// <summary>
    /// "+N" feedback and a gently growing total when a quest completes, plus
    /// one new flower in the Memory Garden. Points only ever go up — no
    /// leaderboards, no streaks, no losing points (spec section 8).
    /// </summary>
    public class RewardController : MonoBehaviour
    {
        [SerializeField] private QuestManager questManager;
        [SerializeField] private MemoryGardenController memoryGarden;
        [SerializeField] private GameObject pointsPanel;
        [SerializeField] private Text pointsText;
        [SerializeField] private Text totalText;
        [SerializeField] private float pointsPanelDuration = 3f;

        public int TotalPoints { get; private set; }

        private float hideAt = -1f;

        private void Awake()
        {
            questManager.QuestCompleted += HandleQuestCompleted;
            if (pointsPanel != null) pointsPanel.SetActive(false);
            RefreshTotal();
        }

        private void Update()
        {
            if (hideAt >= 0f && Time.time >= hideAt)
            {
                pointsPanel.SetActive(false);
                hideAt = -1f;
            }
        }

        private void HandleQuestCompleted(QuestDefinition quest)
        {
            var points = quest.rewardPoints;
            TotalPoints += points;
            pointsText.text = "+" + points;
            pointsPanel.SetActive(true);
            hideAt = Time.time + pointsPanelDuration;
            RefreshTotal();

            memoryGarden.GrowOne();
        }

        private void RefreshTotal()
        {
            if (totalText != null) totalText.text = TotalPoints + " points";
        }
    }
}
