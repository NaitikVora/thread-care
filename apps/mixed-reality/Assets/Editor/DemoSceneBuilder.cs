using RecallAR;
using RecallAR.Data;
using RecallAR.Player;
using RecallAR.Quest;
using RecallAR.Recognition;
using RecallAR.Reward;
using RecallAR.UI;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace RecallAR.EditorTools
{
    /// <summary>
    /// Builds the RecallAR_Demo_LivingRoom scene entirely from code — no
    /// external art/prefab dependencies — so the whole demo can be
    /// regenerated or verified headlessly (Unity -batchmode -executeMethod
    /// RecallAR.EditorTools.DemoSceneBuilder.BuildAndSaveFromCommandLine
    /// -quit), not only from the Editor menu.
    /// </summary>
    public static class DemoSceneBuilder
    {
        private const string ScenePath = "Assets/Scenes/RecallAR_Demo_LivingRoom.unity";
        private const string ModelsRoot = "Assets/Art/Kenney";

        [MenuItem("RecallAR/Build Demo Living Room Scene")]
        public static void BuildFromMenu()
        {
            Build();

            if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
                AssetDatabase.CreateFolder("Assets", "Scenes");

            var saved = EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), ScenePath);
            if (saved)
                Debug.Log("RecallAR demo scene built and saved to " + ScenePath);
            else
                Debug.LogError("RecallAR demo scene build FAILED to save to " + ScenePath);
        }

        // Entry point for headless verification: Unity -batchmode -nographics
        // -quit -executeMethod RecallAR.EditorTools.DemoSceneBuilder.BuildAndSaveFromCommandLine
        public static void BuildAndSaveFromCommandLine()
        {
            BuildFromMenu();
        }

        private static void Build()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            BuildLighting();
            BuildEnvironment();
            var mug = BuildMug();
            BuildGlasses();
            var sarah = BuildSarah();
            var gardenArea = BuildGardenArea();
            var player = BuildPlayer(out var gazeCam, out var gazeController, out var personProvider, out var objectProvider);
            BuildHud(gazeCam, mug, sarah, gardenArea, objectProvider, personProvider);

            EditorSceneManager.MarkSceneDirty(scene);
        }

        private static void BuildLighting()
        {
            var lightGo = new GameObject("Directional Light");
            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.1f;
            lightGo.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.55f, 0.55f, 0.6f);
        }

        private static void BuildEnvironment()
        {
            var room = new GameObject("Environment").transform;

            CreateBlock(room, "Floor", PrimitiveType.Plane, new Vector3(0, 0, 0), new Vector3(3, 1, 3), new Color(0.86f, 0.78f, 0.64f));
            CreateBlock(room, "Back Wall", PrimitiveType.Cube, new Vector3(0, 2, 8), new Vector3(16, 4, 0.1f), new Color(0.93f, 0.9f, 0.85f));
            CreateBlock(room, "Left Wall", PrimitiveType.Cube, new Vector3(-8, 2, 0), new Vector3(0.1f, 4, 16), new Color(0.93f, 0.9f, 0.85f));

            // The mug/table/coffee-machine and glasses/nightstand clusters stay
            // as plain primitives (not real models) on purpose: their exact,
            // known heights are what makes the mug sit correctly on the table
            // and the glasses sit correctly on the nightstand. Swapping those
            // for imported models with unknown pivot/height would risk them
            // floating or clipping, right at the two spots most likely to be
            // stared at. Everything below is real Kenney furniture instead of
            // primitives — purely decorative, so imprecise placement there is
            // harmless.
            CreateBlock(room, "Table", PrimitiveType.Cube, new Vector3(1.5f, 0.25f, 2.5f), new Vector3(1.2f, 0.5f, 0.7f), new Color(0.45f, 0.32f, 0.22f));
            CreateBlock(room, "Coffee Machine", PrimitiveType.Cube, new Vector3(1.8f, 0.65f, 2.4f), new Vector3(0.25f, 0.3f, 0.25f), new Color(0.2f, 0.2f, 0.22f));
            CreateBlock(room, "Nightstand", PrimitiveType.Cube, new Vector3(-3, 0.3f, -3), new Vector3(0.5f, 0.6f, 0.5f), new Color(0.45f, 0.32f, 0.22f));
            CreateBlock(room, "Family Photograph Frame", PrimitiveType.Cube, new Vector3(0, 1.5f, 7.5f), new Vector3(0.65f, 0.45f, 0.04f), new Color(0.35f, 0.24f, 0.16f));
            CreateBlock(room, "Family Photograph", PrimitiveType.Cube, new Vector3(0, 1.5f, 7.47f), new Vector3(0.55f, 0.35f, 0.02f), new Color(0.9f, 0.82f, 0.6f));

            SpawnModel(room, "loungeSofaLong", new Vector3(-4.5f, 0, 3.5f), 200f);
            SpawnModel(room, "rugRounded", new Vector3(-3.2f, 0.01f, 3.2f), 0f, new Vector3(1.6f, 1f, 1.6f));
            SpawnModel(room, "tableCoffee", new Vector3(-3.2f, 0, 3.2f), 15f);
            SpawnModel(room, "sideTableDrawers", new Vector3(-5.6f, 0, 4.8f), -20f);
            SpawnModel(room, "lampRoundFloor", new Vector3(-6, 0, 0.5f), 0f);
            SpawnModel(room, "bookcaseOpen", new Vector3(-7.5f, 0, -1.5f), 90f);
            SpawnModel(room, "pottedPlant", new Vector3(-7.3f, 0, 5.5f), 0f);
            SpawnModel(room, "cabinetTelevision", new Vector3(0, 0, -6.7f), 180f);
        }

        private static RecallARObject BuildMug()
        {
            var mugGo = CreateBlock(null, "Coffee Mug", PrimitiveType.Cylinder,
                new Vector3(1.35f, 0.58f, 2.6f), new Vector3(0.14f, 0.09f, 0.14f), new Color(0.25f, 0.4f, 0.6f));

            var mug = mugGo.AddComponent<RecallARObject>();
            mug.objectId = "coffee_mug_01";
            mug.displayName = "Coffee Mug";
            mug.category = "Kitchen";
            mug.associatedMemory = "You bought this mug during your trip to Boston with Sarah.";
            mug.hintText = "Try looking near the coffee machine.";
            mug.rewardPoints = 10;
            mug.recognitionDelay = 1.5f;
            return mug;
        }

        private static RecallARObject BuildGlasses()
        {
            var glassesGo = CreateBlock(null, "Reading Glasses", PrimitiveType.Cube,
                new Vector3(-3, 0.63f, -3), new Vector3(0.2f, 0.03f, 0.08f), new Color(0.15f, 0.15f, 0.15f));

            var glasses = glassesGo.AddComponent<RecallARObject>();
            glasses.objectId = "reading_glasses_01";
            glasses.displayName = "Reading Glasses";
            glasses.category = "Bedroom";
            glasses.associatedMemory = "You usually keep these on your bedroom nightstand.";
            glasses.hintText = "Try looking near the nightstand.";
            glasses.rewardPoints = 10;
            glasses.recognitionDelay = 1.5f;
            return glasses;
        }

        private static RecognizablePerson BuildSarah()
        {
            var sarahGo = SpawnModel(null, "character-e", new Vector3(1, 0, 1), -150f);
            sarahGo.name = "Sarah (avatar placeholder)";

            var sarah = sarahGo.AddComponent<RecognizablePerson>();
            sarah.personId = "sarah_01";
            sarah.displayName = "Sarah";
            sarah.relationship = "Your daughter";
            sarah.shortDescription = "Sarah lives in Boston and loves hiking with you.";
            sarah.associatedMemory = "You and Sarah visited Boston together.";
            sarah.recognitionDelay = 1.5f;
            return sarah;
        }

        private static Transform BuildGardenArea()
        {
            var gardenGo = CreateBlock(null, "Memory Garden Bed", PrimitiveType.Plane,
                new Vector3(4, 0.01f, -3), new Vector3(0.5f, 1, 0.5f), new Color(0.35f, 0.26f, 0.2f));
            Object.DestroyImmediate(gardenGo.GetComponent<Collider>());

            var anchor = new GameObject("Memory Garden Area").transform;
            anchor.position = new Vector3(3.5f, 0.02f, -3.5f);
            return anchor;
        }

        private static GameObject BuildPlayer(out Camera camera, out GazeRecognitionController gaze,
            out SimulatedPersonRecognitionProvider personProvider, out SimulatedObjectRecognitionProvider objectProvider)
        {
            var player = new GameObject("Player");
            player.transform.position = new Vector3(0, 1.6f, 0);

            camera = player.AddComponent<Camera>();
            camera.tag = "MainCamera";
            camera.nearClipPlane = 0.05f;
            player.AddComponent<AudioListener>();

            player.AddComponent<SimpleLookController>();
            gaze = player.AddComponent<GazeRecognitionController>();
            SetField(gaze, "gazeCamera", camera);

            personProvider = player.AddComponent<SimulatedPersonRecognitionProvider>();
            objectProvider = player.AddComponent<SimulatedObjectRecognitionProvider>();

            return player;
        }

        private static void BuildHud(Camera camera, RecallARObject mug, RecognizablePerson sarah, Transform gardenArea,
            SimulatedObjectRecognitionProvider objectProvider, SimulatedPersonRecognitionProvider personProvider)
        {
            // EventSystem so UI buttons work if the player frees the cursor
            // (Escape) to click instead of using the keyboard shortcuts.
            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));

            BuildReticle(objectProvider, personProvider);

            var canvasGo = new GameObject("HUD Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            canvas.worldCamera = camera;
            var canvasRect = canvasGo.GetComponent<RectTransform>();
            canvasRect.sizeDelta = new Vector2(1000, 600);
            canvasGo.transform.SetParent(camera.transform, false);
            canvasGo.transform.localPosition = new Vector3(0, 0, 1.6f);
            canvasGo.transform.localRotation = Quaternion.identity;
            canvasGo.transform.localScale = Vector3.one * 0.0016f;

            // Persistent legend, always visible.
            CreateText(canvasRect, "Controls Legend", "Press H for a hint  •  Press R to remember someone you're looking at",
                18, TextAnchor.LowerCenter, Anchor.BottomCenter, new Vector2(0, 20), new Vector2(700, 40), new Color(0.4f, 0.4f, 0.4f));

            // Instruction panel (top).
            var instructionPanel = CreatePanel(canvasRect, "Instruction Panel", Anchor.TopCenter, new Vector2(0, -20), new Vector2(800, 100));
            var instructionText = CreateText(instructionPanel, "Instruction Text", "Good morning, John.",
                34, TextAnchor.MiddleCenter, Anchor.MiddleCenter, Vector2.zero, new Vector2(760, 90), Color.white);

            // Reward panel (top-right).
            var rewardPanel = CreatePanel(canvasRect, "Reward Panel", Anchor.TopRight, new Vector2(-20, -20), new Vector2(160, 80));
            var pointsText = CreateText(rewardPanel, "Points Text", "+10", 32, TextAnchor.MiddleCenter, Anchor.MiddleCenter, Vector2.zero, new Vector2(140, 70), new Color(0.2f, 0.55f, 0.3f));

            // Identity card panel (center).
            var identityPanel = CreatePanel(canvasRect, "Identity Card Panel", Anchor.MiddleCenter, new Vector2(0, 40), new Vector2(600, 260));
            var nameText = CreateText(identityPanel, "Name Text", "Sarah", 40, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -20), new Vector2(560, 60), Color.white);
            var relationshipText = CreateText(identityPanel, "Relationship Text", "Your daughter", 24, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -90), new Vector2(560, 40), new Color(0.85f, 0.85f, 0.85f));
            var descriptionText = CreateText(identityPanel, "Description Text", "Sarah lives in Boston and loves hiking with you.", 22, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -140), new Vector2(560, 70), Color.white);
            var rememberButton = CreateButton(identityPanel, "Remember Button", "Remember Sarah", Anchor.BottomCenter, new Vector2(0, 20), new Vector2(260, 60));

            // Memory card panel (center, same spot — identity card hides itself first).
            var memoryPanel = CreatePanel(canvasRect, "Memory Card Panel", Anchor.MiddleCenter, new Vector2(0, 40), new Vector2(600, 260));
            var memoryTitleText = CreateText(memoryPanel, "Memory Title Text", "Boston Trip", 32, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -20), new Vector2(560, 60), Color.white);
            var memoryBodyText = CreateText(memoryPanel, "Memory Body Text", "You and Sarah visited Boston together.", 24, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -90), new Vector2(560, 140), new Color(0.9f, 0.9f, 0.9f));

            // Hint panel (bottom, above the legend).
            var hintPanel = CreatePanel(canvasRect, "Hint Panel", Anchor.BottomCenter, new Vector2(0, 180), new Vector2(760, 90));
            var hintText = CreateText(hintPanel, "Hint Text", "Try looking near the coffee machine.", 24, TextAnchor.MiddleCenter, Anchor.MiddleCenter, new Vector2(0, 10), new Vector2(700, 50), Color.white);
            var hintButton = CreateButton(hintPanel, "Hint Button", "Need a Hint?", Anchor.BottomCenter, new Vector2(0, 5), new Vector2(220, 45));

            // Garden growth message (bottom-left).
            var gardenMsgPanel = CreatePanel(canvasRect, "Garden Message Panel", Anchor.BottomLeft, new Vector2(20, 180), new Vector2(360, 80));
            var gardenMsgText = CreateText(gardenMsgPanel, "Garden Message Text", "You grew a new flower today.", 20, TextAnchor.MiddleCenter, Anchor.MiddleCenter, Vector2.zero, new Vector2(340, 70), new Color(0.5f, 0.8f, 0.5f));

            // --- Managers, wired to the UI built above ---

            var managers = new GameObject("Managers");

            var questManager = managers.AddComponent<QuestManager>();
            SetField(questManager, "objectRecognition", objectProvider);
            SetField(questManager, "quests", new[]
            {
                new ObjectQuest { questId = "coffee_mug_quest", instruction = "Let's find your coffee mug.", targetObject = mug },
            });

            var memoryCard = managers.AddComponent<MemoryCardController>();
            SetField(memoryCard, "panel", memoryPanel.gameObject);
            SetField(memoryCard, "titleText", memoryTitleText);
            SetField(memoryCard, "bodyText", memoryBodyText);

            var identityCard = managers.AddComponent<IdentityCardController>();
            SetField(identityCard, "panel", identityPanel.gameObject);
            SetField(identityCard, "nameText", nameText);
            SetField(identityCard, "relationshipText", relationshipText);
            SetField(identityCard, "descriptionText", descriptionText);
            SetField(identityCard, "rememberButton", rememberButton);
            SetField(identityCard, "rememberButtonLabel", rememberButton.GetComponentInChildren<Text>());
            SetField(identityCard, "memoryCard", memoryCard);
            identityCard.Bind(personProvider);

            var hintController = managers.AddComponent<HintController>();
            SetField(hintController, "panel", hintPanel.gameObject);
            SetField(hintController, "hintText", hintText);
            SetField(hintController, "hintButton", hintButton);
            SetField(hintController, "questManager", questManager);

            var highlight = managers.AddComponent<ObjectHighlightController>();
            SetField(highlight, "objectRecognition", objectProvider);

            var memoryGarden = managers.AddComponent<MemoryGardenController>();
            SetField(memoryGarden, "gardenArea", gardenArea);
            SetField(memoryGarden, "messagePanel", gardenMsgPanel.gameObject);
            SetField(memoryGarden, "messageText", gardenMsgText);

            var rewardController = managers.AddComponent<RewardController>();
            SetField(rewardController, "questManager", questManager);
            SetField(rewardController, "memoryGarden", memoryGarden);
            SetField(rewardController, "pointsPanel", rewardPanel.gameObject);
            SetField(rewardController, "pointsText", pointsText);

            var demoManager = managers.AddComponent<DemoSceneManager>();
            SetField(demoManager, "questManager", questManager);
            SetField(demoManager, "memoryCard", memoryCard);
            SetField(demoManager, "instructionPanel", instructionPanel.gameObject);
            SetField(demoManager, "instructionText", instructionText);
        }

        private static void BuildReticle(SimulatedObjectRecognitionProvider objectProvider, SimulatedPersonRecognitionProvider personProvider)
        {
            var overlayGo = new GameObject("Reticle Canvas", typeof(Canvas), typeof(CanvasScaler));
            var overlayCanvas = overlayGo.GetComponent<Canvas>();
            overlayCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            overlayCanvas.sortingOrder = 100;

            var dotGo = new GameObject("Reticle", typeof(Image));
            dotGo.transform.SetParent(overlayGo.transform, false);
            var dotRect = dotGo.GetComponent<RectTransform>();
            dotRect.anchorMin = dotRect.anchorMax = new Vector2(0.5f, 0.5f);
            dotRect.pivot = new Vector2(0.5f, 0.5f);
            dotRect.anchoredPosition = Vector2.zero;
            dotRect.sizeDelta = new Vector2(14, 14);
            var dotImage = dotGo.GetComponent<Image>();
            dotImage.color = new Color(1f, 1f, 1f, 0.7f);

            var reticle = overlayGo.AddComponent<ReticleController>();
            SetField(reticle, "reticleRect", dotRect);
            SetField(reticle, "reticleImage", dotImage);
            SetField(reticle, "objectRecognition", objectProvider);
            SetField(reticle, "personRecognition", personProvider);
        }

        // --- Small building-block helpers ---

        private enum Anchor { TopLeft, TopCenter, TopRight, MiddleLeft, MiddleCenter, MiddleRight, BottomLeft, BottomCenter, BottomRight }

        /// <summary>
        /// Instantiates a Kenney FBX model (CC0, see Assets/Art/Kenney) by
        /// name, looking in both the furniture and character folders. Adds a
        /// bounding-box collider since imported models don't come with one,
        /// unlike GameObject.CreatePrimitive.
        /// </summary>
        private static GameObject SpawnModel(Transform parent, string modelName, Vector3 position, float yRotationDegrees, Vector3? scaleOverride = null)
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>($"{ModelsRoot}/FurnitureKit/{modelName}.fbx")
                        ?? AssetDatabase.LoadAssetAtPath<GameObject>($"{ModelsRoot}/BlockyCharacters/{modelName}.fbx");
            if (asset == null)
            {
                Debug.LogError($"DemoSceneBuilder: model asset not found for '{modelName}'");
                return null;
            }

            var instance = (GameObject)Object.Instantiate(asset);
            instance.name = modelName;
            if (parent != null) instance.transform.SetParent(parent, false);
            instance.transform.position = position;
            instance.transform.rotation = Quaternion.Euler(0f, yRotationDegrees, 0f);
            if (scaleOverride.HasValue) instance.transform.localScale = scaleOverride.Value;

            EnsureCollider(instance);
            return instance;
        }

        private static void EnsureCollider(GameObject root)
        {
            if (root.GetComponentInChildren<Collider>() != null) return;

            var renderers = root.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return;

            var bounds = renderers[0].bounds;
            foreach (var r in renderers) bounds.Encapsulate(r.bounds);

            var scale = root.transform.lossyScale;
            var box = root.AddComponent<BoxCollider>();
            box.center = root.transform.InverseTransformPoint(bounds.center);
            box.size = new Vector3(
                bounds.size.x / Mathf.Max(Mathf.Abs(scale.x), 0.0001f),
                bounds.size.y / Mathf.Max(Mathf.Abs(scale.y), 0.0001f),
                bounds.size.z / Mathf.Max(Mathf.Abs(scale.z), 0.0001f));
        }

        private static GameObject CreateBlock(Transform parent, string name, PrimitiveType type, Vector3 position, Vector3 scale, Color color)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            if (parent != null) go.transform.SetParent(parent, false);
            go.transform.position = position;
            go.transform.localScale = scale;
            var renderer = go.GetComponent<Renderer>();
            if (renderer != null) renderer.material.color = color;
            return go;
        }

        private static RectTransform CreatePanel(RectTransform parent, string name, Anchor anchor, Vector2 anchoredPos, Vector2 size)
        {
            var go = new GameObject(name, typeof(Image));
            go.transform.SetParent(parent, false);
            var rect = go.GetComponent<RectTransform>();
            ApplyAnchor(rect, anchor, anchoredPos, size);
            var image = go.GetComponent<Image>();
            image.color = new Color(0.08f, 0.08f, 0.1f, 0.72f);
            go.SetActive(false);
            return rect;
        }

        private static Text CreateText(RectTransform parent, string name, string content, int fontSize, TextAnchor alignment,
            Anchor anchor, Vector2 anchoredPos, Vector2 size, Color color)
        {
            var go = new GameObject(name, typeof(Text));
            go.transform.SetParent(parent, false);
            var rect = go.GetComponent<RectTransform>();
            ApplyAnchor(rect, anchor, anchoredPos, size);

            var text = go.GetComponent<Text>();
            text.text = content;
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = fontSize;
            text.alignment = alignment;
            text.color = color;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }

        private static Button CreateButton(RectTransform parent, string name, string label, Anchor anchor, Vector2 anchoredPos, Vector2 size)
        {
            var go = new GameObject(name, typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            var rect = go.GetComponent<RectTransform>();
            ApplyAnchor(rect, anchor, anchoredPos, size);

            var image = go.GetComponent<Image>();
            image.color = new Color(0.3f, 0.55f, 0.45f);

            CreateText(rect, "Label", label, 22, TextAnchor.MiddleCenter, Anchor.MiddleCenter, Vector2.zero, size, Color.white);

            return go.GetComponent<Button>();
        }

        private static void ApplyAnchor(RectTransform rect, Anchor anchor, Vector2 anchoredPos, Vector2 size)
        {
            var (min, max, pivot) = anchor switch
            {
                Anchor.TopLeft => (new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1)),
                Anchor.TopCenter => (new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1)),
                Anchor.TopRight => (new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1)),
                Anchor.MiddleLeft => (new Vector2(0, 0.5f), new Vector2(0, 0.5f), new Vector2(0, 0.5f)),
                Anchor.MiddleCenter => (new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f)),
                Anchor.MiddleRight => (new Vector2(1, 0.5f), new Vector2(1, 0.5f), new Vector2(1, 0.5f)),
                Anchor.BottomLeft => (new Vector2(0, 0), new Vector2(0, 0), new Vector2(0, 0)),
                Anchor.BottomCenter => (new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0)),
                Anchor.BottomRight => (new Vector2(1, 0), new Vector2(1, 0), new Vector2(1, 0)),
                _ => (new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f)),
            };

            rect.anchorMin = min;
            rect.anchorMax = max;
            rect.pivot = pivot;
            rect.sizeDelta = size;
            rect.anchoredPosition = anchoredPos;
        }

        /// <summary>Assigns a private [SerializeField] via SerializedObject — used
        /// throughout since this script wires everything at build time rather
        /// than via inspector-dragged references.</summary>
        private static void SetField(Object target, string fieldName, Object value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"DemoSceneBuilder: no field '{fieldName}' on {target.GetType().Name}");
                return;
            }
            prop.objectReferenceValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void SetField(Object target, string fieldName, object arrayValue)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null || !(arrayValue is ObjectQuest[] quests))
            {
                Debug.LogError($"DemoSceneBuilder: no array field '{fieldName}' on {target.GetType().Name}");
                return;
            }

            prop.arraySize = quests.Length;
            for (var i = 0; i < quests.Length; i++)
            {
                var element = prop.GetArrayElementAtIndex(i);
                element.FindPropertyRelative("questId").stringValue = quests[i].questId;
                element.FindPropertyRelative("instruction").stringValue = quests[i].instruction;
                element.FindPropertyRelative("targetObject").objectReferenceValue = quests[i].targetObject;
            }
            so.ApplyModifiedPropertiesWithoutUndo();
        }
    }
}
