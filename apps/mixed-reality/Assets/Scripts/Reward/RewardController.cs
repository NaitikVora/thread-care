using RecallAR.Quest;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.Reward
{
    /// <summary>
    /// Shows the "+N points" feedback when a quest completes and grows the
    /// Memory Garden. No leaderboards, no losing points, no streaks — see
    /// spec section 8.
    /// </summary>
    public class RewardController : MonoBehaviour
    {
        [SerializeField] private QuestManager questManager;
        [SerializeField] private MemoryGardenController memoryGarden;
        [SerializeField] private GameObject pointsPanel;
        [SerializeField] private Text pointsText;
        [SerializeField] private float pointsPanelDuration = 2.5f;

        private float hideAt = -1f;

        private void Awake()
        {
            questManager.QuestCompleted += HandleQuestCompleted;
            if (pointsPanel != null) pointsPanel.SetActive(false);
        }

        private void Update()
        {
            if (hideAt >= 0f && Time.time >= hideAt)
            {
                pointsPanel.SetActive(false);
                hideAt = -1f;
            }
        }

        private void HandleQuestCompleted(ObjectQuest quest)
        {
            var points = quest.targetObject.rewardPoints;
            pointsText.text = "+" + points;
            pointsPanel.SetActive(true);
            hideAt = Time.time + pointsPanelDuration;

            memoryGarden.GrowOne();
        }
    }
}
