using RecallAR.Data;
using RecallAR.Recognition;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.UI
{
    /// <summary>
    /// Shows a floating identity card ("Sarah — Your daughter — ...") when a
    /// person is recognized, with a "Remember [name]" button that hands off
    /// to <see cref="MemoryCardController"/> for the associated memory.
    /// </summary>
    public class IdentityCardController : MonoBehaviour
    {
        [SerializeField] private GameObject panel;
        [SerializeField] private Text nameText;
        [SerializeField] private Text relationshipText;
        [SerializeField] private Text descriptionText;
        [SerializeField] private Button rememberButton;
        [SerializeField] private Text rememberButtonLabel;
        [SerializeField] private MemoryCardController memoryCard;
        [SerializeField] private KeyCode rememberKey = KeyCode.R;

        private RecognizablePerson currentPerson;

        public void Bind(IPersonRecognitionProvider provider)
        {
            provider.PersonRecognized += HandlePersonRecognized;
        }

        private void Awake()
        {
            if (rememberButton != null) rememberButton.onClick.AddListener(HandleRememberClicked);
            Hide();
        }

        // See HintController for why a key shortcut backs up the button: the
        // gaze camera locks the cursor by default.
        private void Update()
        {
            if (currentPerson != null && Input.GetKeyDown(rememberKey)) HandleRememberClicked();
        }

        private void HandlePersonRecognized(RecognizablePerson person)
        {
            currentPerson = person;
            nameText.text = person.displayName;
            relationshipText.text = person.relationship;
            descriptionText.text = person.shortDescription;
            if (rememberButtonLabel != null) rememberButtonLabel.text = "Remember " + person.displayName;
            panel.SetActive(true);
        }

        private void HandleRememberClicked()
        {
            if (currentPerson == null) return;
            memoryCard.Show(currentPerson.displayName, currentPerson.associatedMemory);
        }

        public void Hide()
        {
            currentPerson = null;
            if (panel != null) panel.SetActive(false);
        }
    }
}
