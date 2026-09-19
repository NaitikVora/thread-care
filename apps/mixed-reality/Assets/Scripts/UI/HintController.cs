using RecallAR.Quest;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.UI
{
    /// <summary>
    /// Shows the current quest's hint text on request. Hints are always
    /// available and never penalized (spec sections 6 and 12) — this
    /// controller only displays text; <see cref="QuestManager"/> is the one
    /// that (harmlessly) counts how many were used.
    /// </summary>
    public class HintController : MonoBehaviour
    {
        [SerializeField] private GameObject panel;
        [SerializeField] private Text hintText;
        [SerializeField] private Button hintButton;
        [SerializeField] private QuestManager questManager;
        [SerializeField] private KeyCode hintKey = KeyCode.H;

        private void Awake()
        {
            if (hintButton != null) hintButton.onClick.AddListener(RequestHint);
            questManager.HintRequested += ShowHint;
            questManager.QuestStarted += _ => Hide();
            questManager.QuestCompleted += _ => Hide();
            Hide();
        }

        // The gaze camera locks the cursor for mouse-look, so mouse clicks on
        // the "Need a Hint?" button aren't reachable by default (Escape frees
        // the cursor if someone wants to click it instead) — H always works.
        private void Update()
        {
            if (Input.GetKeyDown(hintKey) && questManager.ActiveQuest != null) RequestHint();
        }

        private void RequestHint() => questManager.RequestHint();

        private void ShowHint(string text)
        {
            hintText.text = text;
            panel.SetActive(true);
        }

        private void Hide()
        {
            if (panel != null) panel.SetActive(false);
        }
    }
}
