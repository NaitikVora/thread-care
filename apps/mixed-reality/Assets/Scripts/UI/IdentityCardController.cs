using RecallAR.Data;
using RecallAR.Recognition;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.UI
{
    /// <summary>
    /// Shows a floating identity card ("Sarah — Your daughter — ...") when a
    /// person is recognized, with a "Remember [name]" action (button, R, or
    /// Space) that hands off to <see cref="MemoryCardController"/>.
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
        [SerializeField] private SimulatedPersonRecognitionProvider personRecognition;

        private RecognizablePerson currentPerson;

        /// <summary>While true (e.g. during the memory game, where looking at a
        /// person is an answer, not a request for help) recognition does not
        /// pop the card.</summary>
        public bool Suppressed { get; set; }

        private void Awake()
        {
            if (rememberButton != null) rememberButton.onClick.AddListener(Remember);
            if (personRecognition == null) personRecognition = FindFirstObjectByType<SimulatedPersonRecognitionProvider>();
            Hide();
        }

        // Subscribed at runtime: an event hooked up by the scene-builder script
        // in the Editor is not serialized into the scene and would be lost.
        private void OnEnable()
        {
            if (personRecognition != null) personRecognition.PersonRecognized += HandlePersonRecognized;
        }

        private void OnDisable()
        {
            if (personRecognition != null) personRecognition.PersonRecognized -= HandlePersonRecognized;
        }

        // The gaze camera locks the cursor for mouse-look, so keys back up
        // the button (Escape frees the cursor for anyone who wants to click).
        private void Update()
        {
            if (currentPerson != null && (Input.GetKeyDown(KeyCode.R) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return)))
                Remember();
        }

        private void HandlePersonRecognized(RecognizablePerson person)
        {
            if (Suppressed || (memoryCard != null && memoryCard.IsVisible)) return;
            currentPerson = person;
            nameText.text = person.displayName;
            relationshipText.text = person.relationship;
            descriptionText.text = person.shortDescription;
            if (rememberButtonLabel != null) rememberButtonLabel.text = "Remember " + person.displayName + "  (R)";
            panel.SetActive(true);
        }

        private void Remember()
        {
            if (currentPerson == null) return;
            var person = currentPerson;
            Hide();
            memoryCard.Show(person.displayName, person.associatedMemory);
        }

        public void Hide()
        {
            currentPerson = null;
            if (panel != null) panel.SetActive(false);
        }
    }
}
