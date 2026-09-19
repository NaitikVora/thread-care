using System;
using System.Collections.Generic;
using RecallAR.Data;
using RecallAR.Recognition;
using RecallAR.Reward;
using RecallAR.UI;
using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.Game
{
    /// <summary>
    /// The "Memory Corner": step onto the mat and three familiar people stand
    /// in front of you. Each round asks for one of them ("Which one is Jack,
    /// your brother?"); you answer by looking at your choice. A right answer
    /// earns points; a wrong one gets "That's okay" and a gentle, factual hint
    /// — never "incorrect", never a penalty, no countdown. A calm elapsed-time
    /// readout is shown because the caregiver asked for it, but nothing ever
    /// depends on it.
    /// </summary>
    public class MemoryGameController : MonoBehaviour
    {
        [SerializeField] private Transform player;
        [SerializeField] private Transform zoneCenter;
        [SerializeField] private float zoneRadius = 0.9f;
        [SerializeField] private RecognizablePerson[] people;
        [SerializeField] private SimulatedPersonRecognitionProvider personRecognition;
        [SerializeField] private IdentityCardController identityCard;
        [SerializeField] private RewardController rewards;
        [SerializeField] private Text timerText;
        [SerializeField] private GameObject timerPanel;
        [SerializeField] private GameObject cornerSign;
        [SerializeField] private int pointsPerAnswer = 5;
        [SerializeField] private float feedbackSeconds = 2.2f;

        /// <summary>Message for the instruction line (routed by DemoSceneManager).</summary>
        public event Action<string> Message;
        /// <summary>Fired once all rounds are answered; elapsed seconds.</summary>
        public event Action<float> Finished;

        public bool IsAvailable { get; private set; }
        public bool IsRunning { get; private set; }

        private readonly List<RecognizablePerson> order = new List<RecognizablePerson>();
        private int round;
        private float startTime;
        private float lockedUntil;

        private void Awake()
        {
            SetPeopleActive(false);
            if (timerPanel != null) timerPanel.SetActive(false);
            if (cornerSign != null) cornerSign.SetActive(false);
        }

        /// <summary>Called by the demo flow when it's time: shows the people and
        /// sign, and waits for the player to walk onto the mat.</summary>
        public void MakeAvailable()
        {
            IsAvailable = true;
            SetPeopleActive(true);
            if (cornerSign != null) cornerSign.SetActive(true);
        }

        private void Update()
        {
            if (!IsAvailable) return;

            if (!IsRunning)
            {
                if (player != null && zoneCenter != null &&
                    Vector3.Distance(Flat(player.position), Flat(zoneCenter.position)) <= zoneRadius)
                    Begin();
                return;
            }

            if (timerText != null)
            {
                var t = TimeSpan.FromSeconds(Time.time - startTime);
                timerText.text = $"Game time {t.Minutes}:{t.Seconds:00}";
            }
        }

        private static Vector3 Flat(Vector3 v) => new Vector3(v.x, 0f, v.z);

        private void Begin()
        {
            IsRunning = true;
            startTime = Time.time;
            round = 0;
            order.Clear();
            order.AddRange(people);
            Shuffle(order);

            identityCard.Suppressed = true;
            if (timerPanel != null) timerPanel.SetActive(true);
            if (cornerSign != null) cornerSign.SetActive(false);
            personRecognition.PersonRecognized += HandleAnswer;
            AskCurrent();
        }

        private void AskCurrent()
        {
            var target = order[round];
            Message?.Invoke($"Which one is {target.displayName}, {target.relationship.ToLowerInvariant()}? Look at them.");
        }

        private void HandleAnswer(RecognizablePerson chosen)
        {
            if (!IsRunning || Time.time < lockedUntil) return;
            if (Array.IndexOf(people, chosen) < 0) return;

            var target = order[round];
            if (chosen == target)
            {
                rewards.AddPoints(pointsPerAnswer);
                Message?.Invoke($"Wonderful! That's {target.displayName}.");
                round++;
                lockedUntil = Time.time + feedbackSeconds;
                Invoke(round < order.Count ? nameof(AskCurrent) : nameof(Finish), feedbackSeconds);
            }
            else
            {
                var hint = string.IsNullOrEmpty(target.identifyingHint) ? "Take your time and look again." : target.identifyingHint;
                Message?.Invoke($"That's okay. Here's a hint: {hint}");
                lockedUntil = Time.time + feedbackSeconds * 0.6f;
            }
        }

        private void Finish()
        {
            IsRunning = false;
            IsAvailable = false;
            personRecognition.PersonRecognized -= HandleAnswer;
            identityCard.Suppressed = false;
            if (timerPanel != null) timerPanel.SetActive(false);
            Finished?.Invoke(Time.time - startTime);
        }

        private void SetPeopleActive(bool active)
        {
            if (people == null) return;
            foreach (var p in people) if (p != null) p.gameObject.SetActive(active);
        }

        private static void Shuffle<T>(IList<T> list)
        {
            for (var i = list.Count - 1; i > 0; i--)
            {
                var j = UnityEngine.Random.Range(0, i + 1);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }
    }
}
