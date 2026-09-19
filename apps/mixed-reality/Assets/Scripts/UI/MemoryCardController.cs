using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.UI
{
    /// <summary>
    /// A single reusable "here's a memory" card — used both after an object
    /// quest completes and when the caregiver's "Remember [name]" button is
    /// pressed. Calm and factual only; text always comes from seeded data,
    /// never generated here.
    /// </summary>
    public class MemoryCardController : MonoBehaviour
    {
        [SerializeField] private GameObject panel;
        [SerializeField] private Text titleText;
        [SerializeField] private Text bodyText;

        private void Awake() => Hide();

        public void Show(string title, string body)
        {
            titleText.text = title;
            bodyText.text = body;
            panel.SetActive(true);
        }

        public void Hide()
        {
            if (panel != null) panel.SetActive(false);
        }
    }
}
