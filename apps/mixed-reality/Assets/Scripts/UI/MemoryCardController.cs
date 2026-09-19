using System;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.UI
{
    /// <summary>
    /// A single reusable "here's a memory" card — shown after a quest completes
    /// or when "Remember [name]" is pressed. Dismissed with Space/Enter (or
    /// the Continue button), which fires <see cref="Dismissed"/> so the demo
    /// sequence can move on. Text always comes from seeded data.
    /// </summary>
    public class MemoryCardController : MonoBehaviour
    {
        [SerializeField] private GameObject panel;
        [SerializeField] private Text titleText;
        [SerializeField] private Text bodyText;
        [SerializeField] private Text continueHintText;
        [SerializeField] private Button continueButton;
        [SerializeField] private string defaultContinueHint = "Press Space to continue";

        public event Action Dismissed;
        public bool IsVisible => panel != null && panel.activeSelf;

        private int shownFrame = -1;

        private void Awake()
        {
            if (continueButton != null) continueButton.onClick.AddListener(Dismiss);
            Hide();
        }

        private void Update()
        {
            // Same-frame guard: the identity card may have opened this card on
            // this very Space press, and must not also close it.
            if (IsVisible && Time.frameCount > shownFrame &&
                (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return))) Dismiss();
        }

        public void Show(string title, string body, string continueHint = null)
        {
            titleText.text = title;
            bodyText.text = body;
            if (continueHintText != null) continueHintText.text = continueHint ?? defaultContinueHint;
            shownFrame = Time.frameCount;
            panel.SetActive(true);
        }

        public void Hide()
        {
            if (panel != null) panel.SetActive(false);
        }

        private void Dismiss()
        {
            if (!IsVisible) return;
            Hide();
            Dismissed?.Invoke();
        }
    }
}
