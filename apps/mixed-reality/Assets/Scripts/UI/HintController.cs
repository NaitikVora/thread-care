using RecallAR.Quest;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.UI
{
    /// <summary>
    /// Shows the active quest's hint on request (H key or button). Hints are
    /// always available and never penalized; <see cref="QuestManager"/> only
    /// counts them. The hint hides itself after a while so it never nags.
    /// </summary>
    public class HintController : MonoBehaviour
    {
        [SerializeField] private GameObject panel;
        [SerializeField] private Text hintText;
        [SerializeField] private Button hintButton;
        [SerializeField] private QuestManager questManager;
        [SerializeField] private KeyCode hintKey = KeyCode.H;
        [SerializeField] private float showDuration = 6f;

        private float hideAt = -1f;

        private void Awake()
        {
            if (hintButton != null) hintButton.onClick.AddListener(RequestHint);
            questManager.HintRequested += ShowHint;
            questManager.QuestStarted += _ => Hide();
            questManager.QuestCompleted += _ => Hide();
            Hide();
        }

        private void Update()
        {
            if (Input.GetKeyDown(hintKey) && questManager.ActiveQuest != null) RequestHint();
            if (hideAt >= 0f && Time.time >= hideAt) Hide();
        }

        private void RequestHint() => questManager.RequestHint();

        private void ShowHint(string text)
        {
            hintText.text = text;
            panel.SetActive(true);
            hideAt = Time.time + showDuration;
        }

        private void Hide()
        {
            hideAt = -1f;
            if (panel != null) panel.SetActive(false);
        }
    }
}
