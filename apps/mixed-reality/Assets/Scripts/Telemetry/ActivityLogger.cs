using System;
using RecallAR.Data;
using RecallAR.Game;
using RecallAR.Quest;
using RecallAR.Recognition;
using RecallAR.Reward;
using RecallAR.UI;
using UnityEngine;

namespace RecallAR.Telemetry
{
    /// <summary>
    /// Records what the patient does — one `sessions` row per run of the
    /// guided sequence and an `activity_events` row for each step — so a
    /// caregiver's dashboard can show it. Everything logged is descriptive
    /// (what happened, when, how long, how many hints); nothing here judges
    /// or scores the person. If no Supabase config file is present the
    /// logger stays idle and the app behaves exactly as before.
    ///
    /// Schema: supabase/migrations/*_recallar_activity.sql (repo root).
    /// </summary>
    public class ActivityLogger : MonoBehaviour
    {
        [SerializeField] private DemoSceneManager demo;
        [SerializeField] private QuestManager questManager;
        [SerializeField] private MemoryGameController memoryGame;
        [SerializeField] private MemoryCardController memoryCard;
        [SerializeField] private SimulatedPersonRecognitionProvider personRecognition;
        [SerializeField] private RewardController rewards;
        [SerializeField] private MemoryGardenController memoryGarden;
        [Tooltip("Which build this is: phone-ar, living-room, meta-xr.")]
        [SerializeField] private string appVariant = "unknown";

        private SupabaseClient client;
        private SupabaseConfig config;

        private string sessionId;
        private float sessionStart;
        private int activitiesCompleted;
        private int hintsThisSession;
        private int pointsAtSessionStart;
        private int flowersAtSessionStart;

        private float questStart;
        private float gameStart;
        private int pointsAtGameStart;

        public bool IsLogging => client != null && client.IsConfigured && sessionId != null;

        private void Awake()
        {
            config = SupabaseConfig.Load();
            if (config == null) return;
            client = gameObject.AddComponent<SupabaseClient>();
            client.Configure(config);
            Debug.Log($"ActivityLogger: logging to {config.url} as patient {config.patientId} ({config.device}, {appVariant}).");
        }

        private void OnEnable()
        {
            if (demo != null) { demo.SequenceStarted += HandleSequenceStarted; demo.SequenceFinished += HandleSequenceFinished; }
            if (questManager != null)
            {
                questManager.QuestStarted += HandleQuestStarted;
                questManager.QuestCompleted += HandleQuestCompleted;
                questManager.HintRequested += HandleHintRequested;
            }
            if (memoryCard != null) memoryCard.Shown += HandleMemoryShown;
            if (personRecognition != null) personRecognition.PersonRecognized += HandlePersonRecognized;
            if (memoryGame != null)
            {
                memoryGame.Started += HandleGameStarted;
                memoryGame.Answered += HandleGameAnswered;
                memoryGame.Finished += HandleGameFinished;
            }
        }

        private void OnDisable()
        {
            if (demo != null) { demo.SequenceStarted -= HandleSequenceStarted; demo.SequenceFinished -= HandleSequenceFinished; }
            if (questManager != null)
            {
                questManager.QuestStarted -= HandleQuestStarted;
                questManager.QuestCompleted -= HandleQuestCompleted;
                questManager.HintRequested -= HandleHintRequested;
            }
            if (memoryCard != null) memoryCard.Shown -= HandleMemoryShown;
            if (personRecognition != null) personRecognition.PersonRecognized -= HandlePersonRecognized;
            if (memoryGame != null)
            {
                memoryGame.Started -= HandleGameStarted;
                memoryGame.Answered -= HandleGameAnswered;
                memoryGame.Finished -= HandleGameFinished;
            }
        }

        // ------------------------------------------------------------------
        // Session
        // ------------------------------------------------------------------

        private void HandleSequenceStarted()
        {
            if (client == null) return;
            if (sessionId != null) CloseSession(); // replay: close the previous run first

            sessionId = Guid.NewGuid().ToString();
            sessionStart = Time.time;
            activitiesCompleted = 0;
            hintsThisSession = 0;
            pointsAtSessionStart = rewards != null ? rewards.TotalPoints : 0;
            flowersAtSessionStart = memoryGarden != null ? memoryGarden.FlowerCount : 0;

            client.Insert("sessions", new SupabaseClient.Json()
                .Str("id", sessionId)
                .Str("patient_id", config.patientId)
                .Str("device", config.device)
                .Str("app_variant", appVariant)
                .Str("started_at", Now())
                .ToString());

            Log("session_started");
        }

        private void HandleSequenceFinished()
        {
            if (!IsLogging) return;
            Log("session_finished", details: new SupabaseClient.Json()
                .Num("activities_completed", activitiesCompleted)
                .Num("flowers_grown", FlowersThisSession)
                .ToString());
            CloseSession();
        }

        private void CloseSession()
        {
            if (!IsLogging) return;
            client.Update("sessions", "id=eq." + sessionId, new SupabaseClient.Json()
                .Str("ended_at", Now())
                .Num("duration_seconds", Time.time - sessionStart)
                .Num("activities_completed", activitiesCompleted)
                .Num("hints_used", hintsThisSession)
                .Num("points_earned", PointsThisSession)
                .Num("flowers_grown", FlowersThisSession)
                .ToString());
            sessionId = null;
        }

        // Best effort when the app is backgrounded/closed mid-session: the
        // request may or may not get out before iOS suspends us.
        private void OnApplicationPause(bool paused) { if (paused) UpdateSessionCounters(); }
        private void OnApplicationQuit() { UpdateSessionCounters(); }

        private void UpdateSessionCounters()
        {
            if (!IsLogging) return;
            client.Update("sessions", "id=eq." + sessionId, new SupabaseClient.Json()
                .Str("ended_at", Now())
                .Num("duration_seconds", Time.time - sessionStart)
                .Num("activities_completed", activitiesCompleted)
                .Num("hints_used", hintsThisSession)
                .Num("points_earned", PointsThisSession)
                .Num("flowers_grown", FlowersThisSession)
                .ToString());
        }

        private int PointsThisSession => rewards != null ? rewards.TotalPoints - pointsAtSessionStart : 0;
        private int FlowersThisSession => memoryGarden != null ? memoryGarden.FlowerCount - flowersAtSessionStart : 0;

        // ------------------------------------------------------------------
        // Quests
        // ------------------------------------------------------------------

        private void HandleQuestStarted(QuestDefinition quest)
        {
            questStart = Time.time;
            Log("quest_started", quest.questId, KindOf(quest), TargetId(quest), quest.TargetDisplayName,
                details: new SupabaseClient.Json().Str("instruction", quest.instruction).ToString());
        }

        private void HandleHintRequested(string hint)
        {
            hintsThisSession++;
            var quest = questManager.ActiveQuest;
            Log("hint_requested", quest?.questId, quest != null ? KindOf(quest) : null, quest != null ? TargetId(quest) : null,
                quest?.TargetDisplayName, hintsUsed: questManager.HintsUsed,
                details: new SupabaseClient.Json().Str("hint", hint).ToString());
        }

        private void HandleQuestCompleted(QuestDefinition quest)
        {
            activitiesCompleted++;
            Log("quest_completed", quest.questId, KindOf(quest), TargetId(quest), quest.TargetDisplayName,
                duration: Time.time - questStart, hintsUsed: questManager.HintsUsed, points: quest.rewardPoints);
        }

        // ------------------------------------------------------------------
        // Memories & recognition
        // ------------------------------------------------------------------

        private void HandleMemoryShown(string title, string body)
        {
            var quest = questManager != null ? questManager.ActiveQuest : null;
            Log("memory_viewed", quest?.questId, null, null, title,
                details: new SupabaseClient.Json().Str("title", title).Str("memory", body).ToString());
        }

        private void HandlePersonRecognized(RecognizablePerson person)
        {
            // During the memory game a look is an answer, logged separately.
            if (memoryGame != null && memoryGame.IsRunning) return;
            var quest = questManager != null ? questManager.ActiveQuest : null;
            Log("person_recognized", quest?.questId, "find_person", person.personId, person.displayName,
                details: new SupabaseClient.Json().Str("relationship", person.relationship).ToString());
        }

        // ------------------------------------------------------------------
        // Memory game
        // ------------------------------------------------------------------

        private void HandleGameStarted()
        {
            gameStart = Time.time;
            pointsAtGameStart = rewards != null ? rewards.TotalPoints : 0;
            Log("memory_game_started", "memory_game", "memory_game");
        }

        private void HandleGameAnswered(RecognizablePerson asked, RecognizablePerson chosen, bool matched, int round)
        {
            Log("memory_game_answer", "memory_game", "memory_game", asked.personId, asked.displayName,
                details: new SupabaseClient.Json()
                    .Num("round", round + 1)
                    .Str("asked_person_id", asked.personId)
                    .Str("asked_name", asked.displayName)
                    .Str("chosen_person_id", chosen.personId)
                    .Str("chosen_name", chosen.displayName)
                    .Bool("matched", matched)
                    .Num("seconds_into_game", Time.time - gameStart)
                    .ToString());
        }

        private void HandleGameFinished(float seconds)
        {
            activitiesCompleted++;
            var points = rewards != null ? rewards.TotalPoints - pointsAtGameStart : 0;
            Log("memory_game_completed", "memory_game", "memory_game", duration: seconds, points: points);
        }

        // ------------------------------------------------------------------

        private void Log(string eventType, string activityId = null, string activityKind = null, string targetId = null,
            string targetName = null, float? duration = null, int? hintsUsed = null, int? points = null, string details = null)
        {
            if (!IsLogging) return;
            var row = new SupabaseClient.Json()
                .Str("session_id", sessionId)
                .Str("patient_id", config.patientId)
                .Str("occurred_at", Now())
                .Num("session_seconds", Time.time - sessionStart)
                .Str("event_type", eventType)
                .Str("activity_id", activityId)
                .Str("activity_kind", activityKind)
                .Str("target_id", targetId)
                .Str("target_name", targetName);
            if (duration.HasValue) row.Num("duration_seconds", duration.Value); else row.Null("duration_seconds");
            if (hintsUsed.HasValue) row.Num("hints_used", hintsUsed.Value); else row.Null("hints_used");
            if (points.HasValue) row.Num("points", points.Value); else row.Null("points");
            row.Raw("details", details);
            client.Insert("activity_events", row.ToString());
        }

        private static string KindOf(QuestDefinition quest) => quest.kind == QuestTargetKind.Person ? "find_person" : "find_object";

        private static string TargetId(QuestDefinition quest) => quest.kind == QuestTargetKind.Person
            ? quest.targetPerson != null ? quest.targetPerson.personId : null
            : quest.targetObject != null ? quest.targetObject.objectId : null;

        private static string Now() => DateTime.UtcNow.ToString("o");
    }
}
