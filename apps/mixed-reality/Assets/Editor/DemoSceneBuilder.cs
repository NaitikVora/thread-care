using System;
using RecallAR;
using RecallAR.Data;
using RecallAR.Game;
using RecallAR.Player;
using RecallAR.Quest;
using RecallAR.Recognition;
using RecallAR.Reward;
using RecallAR.UI;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace RecallAR.EditorTools
{
    /// <summary>
    /// Builds the RecallAR demo living-room scene entirely from code, so it
    /// can be regenerated from the menu or verified headlessly:
    ///   Unity -batchmode -nographics -quit
    ///     -executeMethod RecallAR.EditorTools.DemoSceneBuilder.BuildAndSaveFromCommandLine
    ///
    /// The room, quests, memory game and rewards are shared between the
    /// desktop scene (mouse-look player, screen-overlay HUD) and the Meta XR
    /// scene (OVRCameraRig, head-locked world-space HUD); the variant is
    /// chosen by the <see cref="PlayerRigFactory"/> passed to
    /// <see cref="BuildAndSave"/>. See MetaXRDemoSceneBuilder for the XR one.
    ///
    /// Placement is measurement-based, not guessed: every Kenney model is
    /// positioned by its actual renderer bounds (see ModelMeasurer), scaled
    /// so 10 kit units ≈ 2.2 m (a table comes out 0.72 m tall, walls 2.84 m).
    /// The kit's models face −Z at rotation 0 (backrests/handles sit on +Z /
    /// −Z respectively, verified from the FBX vertex data).
    /// </summary>
    public static class DemoSceneBuilder
    {
        public const string ScenePath = "Assets/Scenes/RecallAR_Demo_LivingRoom.unity";
        private const string ModelsRoot = "Assets/Art/Kenney";

        /// <summary>What a player-rig factory hands back: the root to attach
        /// gaze providers to, the camera gaze is cast from, and where a
        /// head-locked HUD should be parented.</summary>
        public sealed class PlayerRig
        {
            public GameObject root;
            public Camera camera;
            public Transform hudParent;
        }

        public delegate PlayerRig PlayerRigFactory(Vector3 spawnPosition);

        /// <summary>What a build hands back to variant-specific builders (e.g. AR)
        /// so they can wire extra components without re-finding objects.</summary>
        public sealed class BuildResult
        {
            public PlayerRig rig;
            public DemoSceneManager demoManager;
            public GuidePathController guidePath;
            public GameObject instructionPanel;
            public Text instructionText;
            public Text progressText;
            /// <summary>AR mode only: movable content groups (kitchen, sarah, corner, phone, garden).</summary>
            public Transform[] contentGroups;
        }

        // Kenney furniture kit → metres.
        private const float S = 0.22f;
        // Blocky Characters kit is 2.7 units tall; this makes people ~1.62 m.
        private const float CharacterScale = 0.6f;

        // Room: 4 × 3 floor tiles of 2.2 m.
        private const float RoomHalfX = 4.4f;
        private const float RoomHalfZ = 3.3f;
        private const float WallThickness = 0.11f;
        private const float WallHeight = 12.895f * S;
        private static float InnerX => RoomHalfX - WallThickness * 0.5f;
        private static float InnerZ => RoomHalfZ - WallThickness * 0.5f;
        private static readonly Vector3 Spawn = new Vector3(0f, 0.05f, -2.4f);

        private const string DesktopLegend = "Mouse to look  •  W A S D to walk  •  H for a hint  •  Esc frees the cursor";
        private static string currentContinueHint = "Press Space to continue";

        /// <summary>Phone variant: touch rig, tap-friendly HUD.</summary>
        [MenuItem("RecallAR/Build Demo Living Room Scene (Phone)")]
        public static void BuildPhoneFromMenu()
        {
            BuildAndSave("Assets/Scenes/RecallAR_Demo_LivingRoom_Phone.unity", CreateTouchRig, worldSpaceHud: false, hudShader: null,
                legend: "Left thumb: walk  •  Right thumb: look  •  Hold your gaze on things to recognize them",
                continueHint: "Tap Continue");
        }

        public static void BuildPhoneAndSaveFromCommandLine() => BuildPhoneFromMenu();

        [MenuItem("RecallAR/Build Demo Living Room Scene")]
        public static void BuildFromMenu()
        {
            BuildAndSave(ScenePath, CreateDesktopRig, worldSpaceHud: false, hudShader: null, legend: DesktopLegend);
        }

        public static void BuildAndSaveFromCommandLine() => BuildFromMenu();

        /// <summary>Builds the whole demo scene around the given player rig and saves it.
        /// In <paramref name="arMode"/> no room is built: the content is laid out in
        /// movable groups (activated and positioned at runtime by ARDemoPlacer).</summary>
        public static void BuildAndSave(string scenePath, PlayerRigFactory rigFactory, bool worldSpaceHud, Shader hudShader, string legend,
            string continueHint = "Press Space to continue", bool arMode = false, System.Action<BuildResult> onBuilt = null)
        {
            currentContinueHint = continueHint;
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            RecallARObject mug, phone;
            RecognizablePerson sarah;
            (Transform zone, GameObject sign, RecognizablePerson[] people) corner;
            Transform gardenArea;
            Transform[] groups = null;

            if (arMode)
            {
                BuildArLighting();
                BuildArContent(out mug, out phone, out sarah, out corner, out gardenArea, out groups);
            }
            else
            {
                BuildLighting();
                BuildRoomShell();
                BuildKitchen(out mug);
                BuildDining();
                BuildLiving();
                BuildBedroomCorner(out phone);
                sarah = BuildSarah();
                corner = BuildMemoryCorner();
                gardenArea = BuildGardenArea();
            }

            var rig = rigFactory(Spawn);
            if (rig == null || rig.root == null || rig.camera == null)
            {
                Debug.LogError("DemoSceneBuilder: player rig factory returned nothing usable; aborting build.");
                return;
            }
            AttachGaze(rig, out var personProvider, out var objectProvider);
            var result = BuildHud(rig, worldSpaceHud, hudShader, legend, mug, phone, sarah, corner, gardenArea, objectProvider, personProvider, arMode);
            result.contentGroups = groups;
            onBuilt?.Invoke(result);

            EditorSceneManager.MarkSceneDirty(scene);

            if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
                AssetDatabase.CreateFolder("Assets", "Scenes");

            var saved = EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), scenePath);
            if (saved) Debug.Log("RecallAR demo scene built and saved to " + scenePath);
            else Debug.LogError("RecallAR demo scene build FAILED to save to " + scenePath);
        }

        // ------------------------------------------------------------------
        // Lighting

        private static void BuildLighting()
        {
            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.95f, 0.85f);
            sun.intensity = 0.9f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.6f;
            sun.transform.rotation = Quaternion.Euler(40f, 200f, 0f);

            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.62f, 0.66f, 0.74f);
            RenderSettings.ambientEquatorColor = new Color(0.6f, 0.55f, 0.5f);
            RenderSettings.ambientGroundColor = new Color(0.32f, 0.28f, 0.24f);
            RenderSettings.skybox = AssetDatabase.GetBuiltinExtraResource<Material>("Default-Skybox.mat");

            AddPointLight("Ceiling Lamp Light", new Vector3(0f, WallHeight - 0.65f, 0.3f), new Color(1f, 0.93f, 0.8f), 1.1f, 9f);
            AddPointLight("Floor Lamp Light", new Vector3(3.6f, 1.75f, 1.9f), new Color(1f, 0.8f, 0.55f), 1.0f, 4.5f);
            AddPointLight("Window Light", new Vector3(3.6f, 2.0f, -0.2f), new Color(0.85f, 0.9f, 1f), 0.6f, 5f);
            AddPointLight("Kitchen Light", new Vector3(-2.2f, 2.3f, 2.3f), new Color(1f, 0.95f, 0.88f), 0.7f, 5f);
        }

        /// <summary>AR: the real room provides the light; just a soft key light so the
        /// virtual objects aren't flat, and neutral ambient.</summary>
        private static void BuildArLighting()
        {
            var sun = new GameObject("Key Light").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.97f, 0.92f);
            sun.intensity = 1.0f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.5f;
            sun.transform.rotation = Quaternion.Euler(55f, 30f, 0f);
            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.55f, 0.55f, 0.58f);
        }

        // ------------------------------------------------------------------
        // AR content: the same props as the room, grouped so ARDemoPlacer can
        // put each group on the real floor around the person. Each group is
        // built around its own origin with +Z pointing away from the person.

        private static void BuildArContent(out RecallARObject mug, out RecallARObject phone, out RecognizablePerson sarah,
            out (Transform zone, GameObject sign, RecognizablePerson[] people) corner, out Transform gardenArea, out Transform[] groups)
        {
            var toUser = Quaternion.Euler(0f, 180f, 0f);

            // Kitchen: a small table with the coffee machine, toaster and the mug.
            var kitchen = new GameObject("AR Kitchen").transform;
            var table = Place(kitchen, "table", 0f, 0.3f, 0f, S);
            var top = table.bounds.max.y;
            Place(kitchen, "kitchenCoffeeMachine", 0.3f, 0.45f, 180f, 0.16f, floorY: top);
            Place(kitchen, "toaster", -0.55f, 0.4f, 0f, S, floorY: top, addCollider: false);
            mug = BuildMug(new Vector3(-0.15f, top, 0.05f));
            mug.transform.SetParent(kitchen, true);
            mug.hintText = "Try looking at the little table with the coffee machine.";

            // Sarah, facing the person.
            var sarahGroup = new GameObject("AR Sarah").transform;
            var placed = Place(sarahGroup, "character-e", 0f, 0f, 180f, CharacterScale);
            placed.go.name = "Sarah (avatar placeholder)";
            sarah = placed.go.AddComponent<RecognizablePerson>();
            sarah.personId = "sarah_01";
            sarah.displayName = "Sarah";
            sarah.relationship = "Your daughter";
            sarah.shortDescription = "Sarah lives in Boston and loves hiking with you.";
            sarah.associatedMemory = "You and Sarah visited Boston together. That's where you found your blue mug.";
            sarah.identifyingHint = "Sarah is wearing a purple top.";
            sarah.recognitionDelay = 1.5f;

            // Memory Corner: a mat for the person, and three portraits on a photo stand.
            var cornerGroup = new GameObject("AR Memory Corner").transform;
            var mat = CreateBlock(cornerGroup, "Memory Game Mat", PrimitiveType.Cube,
                new Vector3(0f, 0.01f, -1.5f), new Vector3(1.2f, 0.02f, 0.9f), new Color(0.5f, 0.62f, 0.8f));
            UnityEngine.Object.DestroyImmediate(mat.GetComponent<Collider>());
            var panel = CreateBlock(cornerGroup, "Photo Stand", PrimitiveType.Cube,
                new Vector3(0f, 1.1f, 0.3f), new Vector3(2.6f, 2.2f, 0.06f), new Color(0.93f, 0.9f, 0.85f));
            var sign = MakeSign(cornerGroup, "Memory Corner\nstand on the mat, then look at a picture", new Vector3(0f, 2.0f, 0.25f), Quaternion.identity);
            var people = new[]
            {
                MakePortrait(cornerGroup, "character-n", new Vector3(-0.95f, 1.45f, 0.22f), toUser, "susan_01", "Susan", "Your wife",
                    "Susan has dark hair and wears a green dress.", "Susan and you have been married since 1978.",
                    "You and Susan still make Sunday breakfast together."),
                MakePortrait(cornerGroup, "character-c", new Vector3(0f, 1.45f, 0.22f), toUser, "jack_01", "Jack", "Your brother",
                    "Jack is wearing a green shirt.", "Jack is your brother.",
                    "You and Jack grew up together."),
                MakePortrait(cornerGroup, "character-k", new Vector3(0.95f, 1.45f, 0.22f), toUser, "michael_01", "Michael", "Your son",
                    "Michael is wearing a red shirt.", "Michael lives in New York.",
                    "Michael calls you every Sunday afternoon."),
            };
            corner = (mat.transform, sign, people);

            // Nightstand with the lamp and the phone.
            var phoneGroup = new GameObject("AR Nightstand").transform;
            var nightstand = Place(phoneGroup, "cabinetBedDrawerTable", 0f, 0f, 0f, S);
            var nsTop = nightstand.bounds.max.y;
            Place(phoneGroup, "lampRoundTable", -0.17f, -0.03f, 0f, S, floorY: nsTop, addCollider: false);
            phone = BuildPhone(new Vector3(0.16f, nsTop, 0f));
            phone.transform.SetParent(phoneGroup, true);
            phone.hintText = "Follow the little arrows on the floor — they lead to the nightstand with the lamp.";

            // Memory Garden.
            var gardenGroup = new GameObject("AR Memory Garden").transform;
            var bed = CreateBlock(gardenGroup, "Memory Garden Bed", PrimitiveType.Cube,
                new Vector3(0f, 0.02f, 0f), new Vector3(1.1f, 0.04f, 1.0f), new Color(0.36f, 0.27f, 0.2f));
            UnityEngine.Object.DestroyImmediate(bed.GetComponent<Collider>());
            gardenArea = new GameObject("Memory Garden Area").transform;
            gardenArea.SetParent(gardenGroup, false);
            gardenArea.localPosition = new Vector3(-0.4f, 0.04f, -0.3f);

            groups = new[] { kitchen, sarahGroup, cornerGroup, phoneGroup, gardenGroup };
        }

        private static GameObject MakeSign(Transform parent, string message, Vector3 position, Quaternion rotation)
        {
            var sign = new GameObject("Sign");
            sign.transform.SetParent(parent, false);
            sign.transform.position = position;
            sign.transform.rotation = rotation;
            var text = sign.AddComponent<TextMesh>();
            text.text = message;
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = 64;
            text.characterSize = 0.04f;
            text.anchor = TextAnchor.MiddleCenter;
            text.alignment = TextAlignment.Center;
            text.color = new Color(0.3f, 0.5f, 0.42f);
            sign.GetComponent<MeshRenderer>().material = text.font.material;
            return sign;
        }

        private static void AddPointLight(string name, Vector3 position, Color color, float intensity, float range)
        {
            var light = new GameObject(name).AddComponent<Light>();
            light.type = LightType.Point;
            light.color = color;
            light.intensity = intensity;
            light.range = range;
            light.transform.position = position;
        }

        // ------------------------------------------------------------------
        // Room shell: floor tiles, walls (one with a window per side), ceiling

        private static void BuildRoomShell()
        {
            var shell = new GameObject("Room").transform;

            // Floor: tile tops sit at y = 0.
            for (var ix = 0; ix < 4; ix++)
            for (var iz = 0; iz < 3; iz++)
                Place(shell, "floorFull", -3.3f + ix * 2.2f, -2.2f + iz * 2.2f, 0f, S, floorY: -0.5f * S);

            // Back wall (z = +): 4 segments, window on the right half.
            for (var i = 0; i < 4; i++)
                Place(shell, i == 2 ? "wallWindow" : "wall", -3.3f + i * 2.2f, RoomHalfZ, 0f, S);
            // Front wall (z = −): faces inward, so rotate 180.
            for (var i = 0; i < 4; i++)
                Place(shell, "wall", -3.3f + i * 2.2f, -RoomHalfZ, 180f, S);
            // Left wall (x = −), 3 segments.
            for (var i = 0; i < 3; i++)
                Place(shell, "wall", -RoomHalfX, -2.2f + i * 2.2f, -90f, S);
            // Right wall (x = +), window in the middle by the sofa.
            for (var i = 0; i < 3; i++)
                Place(shell, i == 1 ? "wallWindow" : "wall", RoomHalfX, -2.2f + i * 2.2f, 90f, S);

            var ceiling = CreateBlock(shell, "Ceiling", PrimitiveType.Cube,
                new Vector3(0f, WallHeight + 0.05f, 0f), new Vector3(RoomHalfX * 2f + 0.3f, 0.1f, RoomHalfZ * 2f + 0.3f),
                new Color(0.96f, 0.95f, 0.92f));
            UnityEngine.Object.DestroyImmediate(ceiling.GetComponent<Collider>());

            Place(shell, "lampSquareCeiling", 0f, 0.3f, 0f, S, floorY: WallHeight - 2.3f * S, addCollider: false);

            // Family photograph on the back wall, right of the window: a baked
            // group shot of Sarah, Michael and Susan.
            CreateBlock(shell, "Family Photograph Frame", PrimitiveType.Cube,
                new Vector3(2.75f, 1.55f, InnerZ - 0.02f), new Vector3(0.62f, 0.46f, 0.04f), new Color(0.35f, 0.24f, 0.16f));
            var photo = CreateBlock(shell, "Family Photograph", PrimitiveType.Cube,
                new Vector3(2.75f, 1.55f, InnerZ - 0.045f), new Vector3(0.52f, 0.36f, 0.02f), Color.white);
            var family = PortraitBaker.GetOrBakeGroup("family", new[]
            {
                new PortraitBaker.Subject { modelAssetPath = $"{ModelsRoot}/BlockyCharacters/character-k.fbx", xOffset = -0.95f, yRotation = 15f },
                new PortraitBaker.Subject { modelAssetPath = $"{ModelsRoot}/BlockyCharacters/character-e.fbx", xOffset = 0f, yRotation = 0f },
                new PortraitBaker.Subject { modelAssetPath = $"{ModelsRoot}/BlockyCharacters/character-n.fbx", xOffset = 0.95f, yRotation = -15f },
            }, CharacterScale, 0.95f, 4.6f, 34f, 768, 512);
            if (family != null)
            {
                var material = new Material(Shader.Find("Standard")) { name = "Family Photo", mainTexture = family };
                material.SetFloat("_Glossiness", 0.15f);
                photo.GetComponent<Renderer>().material = material;
            }
        }

        // ------------------------------------------------------------------
        // Kitchen along the back wall: fridge, counter run, uppers, appliances, the mug.

        private static void BuildKitchen(out RecallARObject mug)
        {
            var kitchen = new GameObject("Kitchen").transform;
            const float counterD = 4.5f * S;               // 0.99
            var counterZ = InnerZ - counterD * 0.5f;
            var xs = new[] { -3.87f, -2.93f, -1.98f, -1.04f, -0.09f };

            Place(kitchen, "kitchenFridge", xs[0], InnerZ - 2.62f * S * 0.5f, 0f, S);
            var cabinet = Place(kitchen, "kitchenCabinet", xs[1], counterZ, 0f, S);
            Place(kitchen, "kitchenSink", xs[2], counterZ, 0f, S);
            var drawer = Place(kitchen, "kitchenCabinetDrawer", xs[3], counterZ, 0f, S);
            Place(kitchen, "kitchenStove", xs[4], counterZ, 0f, S);

            var upperD = 2.2f * S;
            for (var i = 1; i < xs.Length; i++)
                Place(kitchen, "kitchenCabinetUpper", xs[i], InnerZ - upperD * 0.5f, 0f, S, floorY: 1.45f, addCollider: false);

            var counterTop = cabinet.bounds.max.y;
            Place(kitchen, "kitchenCoffeeMachine", xs[1] - 0.05f, counterZ + 0.05f, 0f, 0.16f, floorY: counterTop);
            Place(kitchen, "toaster", xs[3], counterZ, 0f, S, floorY: drawer.bounds.max.y, addCollider: false);
            Place(kitchen, "plantSmall1", xs[2] + 0.25f, counterZ + 0.3f, 0f, S, floorY: counterTop, addCollider: false);

            mug = BuildMug(new Vector3(xs[1] + 0.34f, counterTop, counterZ - 0.15f));
        }

        private static RecallARObject BuildMug(Vector3 basePosition)
        {
            var root = new GameObject("Coffee Mug");
            root.transform.position = basePosition;

            var body = CreateBlock(root.transform, "Body", PrimitiveType.Cylinder,
                basePosition + new Vector3(0f, 0.05f, 0f), new Vector3(0.09f, 0.05f, 0.09f), new Color(0.25f, 0.42f, 0.65f));
            UnityEngine.Object.DestroyImmediate(body.GetComponent<Collider>());
            var handle = CreateBlock(root.transform, "Handle", PrimitiveType.Cube,
                basePosition + new Vector3(0.06f, 0.05f, 0f), new Vector3(0.025f, 0.06f, 0.02f), new Color(0.25f, 0.42f, 0.65f));
            UnityEngine.Object.DestroyImmediate(handle.GetComponent<Collider>());

            var collider = root.AddComponent<BoxCollider>();
            collider.center = new Vector3(0.02f, 0.05f, 0f);
            collider.size = new Vector3(0.16f, 0.11f, 0.11f);

            var mug = root.AddComponent<RecallARObject>();
            mug.objectId = "coffee_mug_01";
            mug.displayName = "Coffee Mug";
            mug.category = "Kitchen";
            mug.associatedMemory = "You bought this mug during your trip to Boston with Sarah.";
            mug.hintText = "Try looking near the coffee machine, on the kitchen counter.";
            mug.rewardPoints = 10;
            mug.recognitionDelay = 1.5f;
            return mug;
        }

        // ------------------------------------------------------------------
        // Dining table with two chairs.

        private static void BuildDining()
        {
            var dining = new GameObject("Dining").transform;
            var table = Place(dining, "table", -1.5f, 0.4f, 0f, S);
            Place(dining, "chair", -1.5f, -0.4f, 180f, S);
            Place(dining, "chair", -1.5f, 1.2f, 0f, S);
            Place(dining, "books", -2.0f, 0.5f, 20f, S, floorY: table.bounds.max.y, addCollider: false);
        }

        // ------------------------------------------------------------------
        // Living area along the right wall (window there): sofa, rug, coffee table, lamp, TV, bookcase.

        private static void BuildLiving()
        {
            var living = new GameObject("Living Room").transform;

            // Sofa against the right wall, facing the room (−X).
            Place(living, "loungeSofa", InnerX - 4.1f * S * 0.5f, 0.3f, 90f, S);
            Place(living, "lampRoundFloor", 3.7f, 1.9f, 0f, S, addCollider: false);
            Place(living, "rugRectangle", 2.3f, 0.3f, 90f, S, addCollider: false);
            var coffeeTable = Place(living, "tableCoffee", 2.4f, 0.3f, 90f, S);
            Place(living, "bear", 2.4f, 0.5f, 30f, 0.1f, floorY: coffeeTable.bounds.max.y, addCollider: false);
            Place(living, "loungeChairRelax", -2.6f, -1.5f, 90f, S);
            Place(living, "pottedPlant", 3.9f, -1.5f, 0f, S, addCollider: false);

            // TV on its cabinet against the left wall, facing the room (+X).
            var tvCabinet = Place(living, "cabinetTelevision", -InnerX + 2.5f * S * 0.5f, -1.6f, -90f, S);
            Place(living, "televisionModern", -InnerX + 2.5f * S * 0.5f, -1.6f, -90f, S, floorY: tvCabinet.bounds.max.y, addCollider: false);

            // Bookcase against the back wall, right of the photo.
            var bookcase = Place(living, "bookcaseOpen", 3.7f, InnerZ - 2.5f * S * 0.5f, 0f, S);
            Place(living, "radio", 3.7f, InnerZ - 2.5f * S * 0.5f, 0f, S, floorY: bookcase.bounds.max.y, addCollider: false);
        }

        // ------------------------------------------------------------------
        // A little bedside corner: nightstand with a lamp and John's phone.

        private static void BuildBedroomCorner(out RecallARObject phone)
        {
            var corner = new GameObject("Bedside Corner").transform;
            var nightstand = Place(corner, "cabinetBedDrawerTable", -3.6f, -InnerZ + 2.05f * S * 0.5f + 0.02f, 180f, S);
            var top = nightstand.bounds.max.y;
            Place(corner, "lampRoundTable", -3.78f, -2.95f, 0f, S, floorY: top, addCollider: false);
            phone = BuildPhone(new Vector3(-3.42f, top, -2.9f));
        }

        private static RecallARObject BuildPhone(Vector3 basePosition)
        {
            var root = new GameObject("Phone");
            root.transform.position = basePosition;
            root.transform.rotation = Quaternion.Euler(0f, -20f, 0f);

            var body = CreateBlock(root.transform, "Body", PrimitiveType.Cube,
                basePosition + new Vector3(0f, 0.005f, 0f), new Vector3(0.075f, 0.009f, 0.155f), new Color(0.1f, 0.1f, 0.12f));
            body.transform.localRotation = Quaternion.identity;
            UnityEngine.Object.DestroyImmediate(body.GetComponent<Collider>());
            var screen = CreateBlock(root.transform, "Screen", PrimitiveType.Cube,
                basePosition + new Vector3(0f, 0.0105f, 0f), new Vector3(0.066f, 0.002f, 0.14f), new Color(0.55f, 0.75f, 0.95f));
            screen.transform.localRotation = Quaternion.identity;
            UnityEngine.Object.DestroyImmediate(screen.GetComponent<Collider>());

            var collider = root.AddComponent<BoxCollider>();
            collider.center = new Vector3(0f, 0.02f, 0f);
            collider.size = new Vector3(0.14f, 0.08f, 0.2f);

            var phone = root.AddComponent<RecallARObject>();
            phone.objectId = "phone_01";
            phone.displayName = "Phone";
            phone.category = "Bedroom";
            phone.associatedMemory = "You usually keep your phone on the nightstand, next to the little lamp, so you can call Sarah.";
            phone.hintText = "Follow the little arrows on the floor — they lead to the lamp in the corner.";
            phone.rewardPoints = 10;
            phone.recognitionDelay = 1.5f;
            return phone;
        }

        // ------------------------------------------------------------------
        // Sarah: a stylized character standing by the rug, facing the door.

        private static RecognizablePerson BuildSarah()
        {
            var placed = Place(null, "character-e", 1.2f, 1.3f, 205f, CharacterScale);
            placed.go.name = "Sarah (avatar placeholder)";

            var sarah = placed.go.AddComponent<RecognizablePerson>();
            sarah.personId = "sarah_01";
            sarah.displayName = "Sarah";
            sarah.relationship = "Your daughter";
            sarah.shortDescription = "Sarah lives in Boston and loves hiking with you.";
            sarah.associatedMemory = "You and Sarah visited Boston together. That's where you found your blue mug.";
            sarah.identifyingHint = "Sarah is wearing a purple top.";
            sarah.recognitionDelay = 1.5f;
            return sarah;
        }

        // ------------------------------------------------------------------
        // Memory Corner: a mat by the front-right wall where three familiar
        // people stand for the "which one is…?" game. They start disabled and
        // appear when the flow reaches the game.

        private static (Transform zone, GameObject sign, RecognizablePerson[] people) BuildMemoryCorner()
        {
            var corner = new GameObject("Memory Corner").transform;

            var mat = CreateBlock(corner, "Memory Game Mat", PrimitiveType.Cube,
                new Vector3(2.2f, 0.015f, -1.55f), new Vector3(1.4f, 0.03f, 1.0f), new Color(0.5f, 0.62f, 0.8f));
            UnityEngine.Object.DestroyImmediate(mat.GetComponent<Collider>());

            var sign = MakeSign(corner, "Memory Corner\nstep on the mat, then look at a picture",
                new Vector3(2.2f, 2.15f, -InnerZ + 0.06f), Quaternion.Euler(0f, 180f, 0f));

            // Framed portraits on the wall (rendered from the same stylized
            // characters), not people standing in the room.
            var wallZ = -InnerZ + 0.03f;
            var people = new[]
            {
                MakePortrait(corner, "character-n", new Vector3(1.25f, 1.45f, wallZ), Quaternion.identity, "susan_01", "Susan", "Your wife",
                    "Susan has dark hair and wears a green dress.", "Susan and you have been married since 1978.",
                    "You and Susan still make Sunday breakfast together."),
                MakePortrait(corner, "character-c", new Vector3(2.2f, 1.45f, wallZ), Quaternion.identity, "jack_01", "Jack", "Your brother",
                    "Jack is wearing a green shirt.", "Jack is your brother.",
                    "You and Jack grew up together."),
                MakePortrait(corner, "character-k", new Vector3(3.15f, 1.45f, wallZ), Quaternion.identity, "michael_01", "Michael", "Your son",
                    "Michael is wearing a red shirt.", "Michael lives in New York.",
                    "Michael calls you every Sunday afternoon."),
            };
            return (mat.transform, sign, people);
        }

        /// <summary>A framed portrait; the picture face sits on the frame's local +Z side.</summary>
        private static RecognizablePerson MakePortrait(Transform parent, string model, Vector3 framePosition, Quaternion rotation,
            string id, string name, string relationship, string hint, string description, string memory)
        {
            var portrait = PortraitBaker.GetOrBake(model, $"{ModelsRoot}/BlockyCharacters/{model}.fbx", CharacterScale, 1.15f);

            var frame = CreateBlock(parent, name + " (portrait)", PrimitiveType.Cube,
                framePosition, new Vector3(0.52f, 0.62f, 0.035f), new Color(0.35f, 0.24f, 0.16f));
            frame.transform.rotation = rotation;

            var picture = CreateBlock(frame.transform, "Picture", PrimitiveType.Cube,
                framePosition + rotation * new Vector3(0f, 0f, 0.025f), new Vector3(0.44f, 0.54f, 0.012f), Color.white);
            picture.transform.rotation = rotation;
            UnityEngine.Object.DestroyImmediate(picture.GetComponent<Collider>());
            if (portrait != null)
            {
                var material = new Material(Shader.Find("Standard")) { name = name + " Portrait", mainTexture = portrait };
                material.SetFloat("_Glossiness", 0.15f);
                picture.GetComponent<Renderer>().material = material;
            }

            var p = frame.AddComponent<RecognizablePerson>();
            p.personId = id;
            p.displayName = name;
            p.relationship = relationship;
            p.identifyingHint = hint;
            p.shortDescription = description;
            p.associatedMemory = memory;
            p.recognitionDelay = 1.2f;
            return p;
        }

        // ------------------------------------------------------------------
        // Memory Garden by the window, where flowers appear.

        private static Transform BuildGardenArea()
        {
            var bed = CreateBlock(null, "Memory Garden Bed", PrimitiveType.Cube,
                new Vector3(2.3f, 0.02f, 2.55f), new Vector3(1.1f, 0.04f, 1.0f), new Color(0.36f, 0.27f, 0.2f));
            UnityEngine.Object.DestroyImmediate(bed.GetComponent<Collider>());

            var anchor = new GameObject("Memory Garden Area").transform;
            anchor.position = new Vector3(1.9f, 0.04f, 2.25f);
            return anchor;
        }

        // ------------------------------------------------------------------
        // Player rigs

        /// <summary>Desktop stand-in: grounded first-person controller with an eye-height camera.</summary>
        private static PlayerRig CreateDesktopRig(Vector3 spawn)
        {
            var player = new GameObject("Player");
            player.layer = 2; // Ignore Raycast, so the gaze cast never hits the player's own capsule.
            player.transform.position = spawn;

            var controller = player.AddComponent<CharacterController>();
            controller.height = 1.75f;
            controller.radius = 0.3f;
            controller.center = new Vector3(0f, 0.875f, 0f);
            controller.stepOffset = 0.25f;
            controller.skinWidth = 0.05f;

            var pivot = new GameObject("Camera Pivot").transform;
            pivot.SetParent(player.transform, false);
            pivot.localPosition = new Vector3(0f, 1.6f, 0f);

            var camGo = new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            camGo.transform.SetParent(pivot, false);
            var camera = camGo.AddComponent<Camera>();
            camera.nearClipPlane = 0.05f;
            camera.fieldOfView = 65f;
            camera.clearFlags = CameraClearFlags.Skybox;
            camGo.AddComponent<AudioListener>();

            var fps = player.AddComponent<FirstPersonController>();
            SetField(fps, "cameraPivot", pivot);

            return new PlayerRig { root = player, camera = camera, hudParent = camGo.transform };
        }

        /// <summary>Phone stand-in: same grounded controller, driven by touch drags.</summary>
        private static PlayerRig CreateTouchRig(Vector3 spawn)
        {
            var rig = CreateDesktopRig(spawn);
            var fps = rig.root.GetComponent<FirstPersonController>();
            var pivot = rig.camera.transform.parent;
            UnityEngine.Object.DestroyImmediate(fps);
            var touch = rig.root.AddComponent<TouchLookController>();
            SetField(touch, "cameraPivot", pivot);
            return rig;
        }

        private static void AttachGaze(PlayerRig rig,
            out SimulatedPersonRecognitionProvider personProvider, out SimulatedObjectRecognitionProvider objectProvider)
        {
            var gaze = rig.root.AddComponent<GazeRecognitionController>();
            SetField(gaze, "gazeCamera", rig.camera);
            personProvider = rig.root.AddComponent<SimulatedPersonRecognitionProvider>();
            objectProvider = rig.root.AddComponent<SimulatedObjectRecognitionProvider>();
        }

        // ------------------------------------------------------------------
        // HUD + managers

        private static BuildResult BuildHud(PlayerRig rig, bool worldSpaceHud, Shader hudShader, string legend,
            RecallARObject mug, RecallARObject phone, RecognizablePerson sarah,
            (Transform zone, GameObject sign, RecognizablePerson[] people) corner, Transform gardenArea,
            SimulatedObjectRecognitionProvider objectProvider, SimulatedPersonRecognitionProvider personProvider, bool arMode = false)
        {
            new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));

            var canvasGo = new GameObject("HUD Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = canvasGo.GetComponent<Canvas>();
            var canvasRect = canvasGo.GetComponent<RectTransform>();
            if (worldSpaceHud)
            {
                // Head-locked panel in front of the eyes (headset builds can't
                // show screen-space UI). Drawn with a depth-ignoring shader so
                // walls never cut through it.
                canvas.renderMode = RenderMode.WorldSpace;
                canvas.worldCamera = rig.camera;
                canvas.sortingOrder = 10;
                canvasRect.sizeDelta = new Vector2(1000, 600);
                canvasGo.transform.SetParent(rig.hudParent, false);
                canvasGo.transform.localPosition = new Vector3(0f, -0.05f, 1.3f);
                canvasGo.transform.localRotation = Quaternion.identity;
                canvasGo.transform.localScale = Vector3.one * 0.0012f;
            }
            else
            {
                // Screen-space overlay: can't be cut off by walls the way a
                // panel floating in front of the camera can.
                canvas.renderMode = RenderMode.ScreenSpaceOverlay;
                canvas.sortingOrder = 10;
                var scaler = canvasGo.GetComponent<CanvasScaler>();
                scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
                scaler.referenceResolution = new Vector2(1000, 600);
                scaler.matchWidthOrHeight = 0.5f;
            }

            var reticle = worldSpaceHud
                ? BuildReticle(canvasRect, 100, objectProvider, personProvider)
                : BuildOverlayReticle(objectProvider, personProvider);

            // Memory game timer (top-left), hidden until the game runs.
            var timerPanel = CreatePanel(canvasRect, "Timer Panel", Anchor.TopLeft, new Vector2(20, -20), new Vector2(230, 50));
            var timerText = CreateText(timerPanel, "Timer Text", "Game time 0:00", 20, TextAnchor.MiddleCenter, Anchor.MiddleCenter, Vector2.zero, new Vector2(210, 40), Color.white);

            CreateText(canvasRect, "Controls Legend", legend,
                16, TextAnchor.LowerCenter, Anchor.BottomCenter, new Vector2(0, 16), new Vector2(900, 30), new Color(0.55f, 0.55f, 0.55f));

            // Instruction (top) with a small progress line under it.
            var instructionPanel = CreatePanel(canvasRect, "Instruction Panel", Anchor.TopCenter, new Vector2(0, -20), new Vector2(820, 120));
            var instructionText = CreateText(instructionPanel, "Instruction Text", "Good morning, John.",
                34, TextAnchor.MiddleCenter, Anchor.TopCenter, new Vector2(0, -10), new Vector2(780, 70), Color.white);
            var progressText = CreateText(instructionPanel, "Progress Text", "",
                18, TextAnchor.MiddleCenter, Anchor.BottomCenter, new Vector2(0, 10), new Vector2(780, 30), new Color(0.8f, 0.8f, 0.8f));

            // Reward (+N) top-right, and a quiet running total under it.
            var rewardPanel = CreatePanel(canvasRect, "Reward Panel", Anchor.TopRight, new Vector2(-20, -20), new Vector2(160, 80));
            var pointsText = CreateText(rewardPanel, "Points Text", "+10", 34, TextAnchor.MiddleCenter, Anchor.MiddleCenter, Vector2.zero, new Vector2(140, 70), new Color(0.55f, 0.9f, 0.6f));
            var totalText = CreateText(canvasRect, "Total Points Text", "0 points", 18, TextAnchor.MiddleRight, Anchor.TopRight, new Vector2(-24, -108), new Vector2(200, 30), new Color(0.75f, 0.75f, 0.75f));

            // Identity card (center).
            var identityPanel = CreatePanel(canvasRect, "Identity Card Panel", Anchor.MiddleCenter, new Vector2(0, 30), new Vector2(620, 280));
            var nameText = CreateText(identityPanel, "Name Text", "Sarah", 42, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -18), new Vector2(580, 60), Color.white);
            var relationshipText = CreateText(identityPanel, "Relationship Text", "Your daughter", 24, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -84), new Vector2(580, 40), new Color(0.85f, 0.85f, 0.85f));
            var descriptionText = CreateText(identityPanel, "Description Text", "Sarah lives in Boston and loves hiking with you.", 22, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -130), new Vector2(580, 70), Color.white);
            var rememberButton = CreateButton(identityPanel, "Remember Button", "Remember Sarah  (R)", Anchor.BottomCenter, new Vector2(0, 20), new Vector2(300, 56));

            // Memory card (center), with a Continue affordance.
            var memoryPanel = CreatePanel(canvasRect, "Memory Card Panel", Anchor.MiddleCenter, new Vector2(0, 30), new Vector2(620, 280));
            var memoryTitleText = CreateText(memoryPanel, "Memory Title Text", "Boston Trip", 34, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -18), new Vector2(580, 60), Color.white);
            var memoryBodyText = CreateText(memoryPanel, "Memory Body Text", "You and Sarah visited Boston together.", 24, TextAnchor.UpperCenter, Anchor.TopCenter, new Vector2(0, -84), new Vector2(580, 120), new Color(0.92f, 0.92f, 0.92f));
            var continueButton = CreateButton(memoryPanel, "Continue Button", "Continue", Anchor.BottomCenter, new Vector2(0, 20), new Vector2(220, 52));
            var continueHint = CreateText(memoryPanel, "Continue Hint", "Press Space to continue", 16, TextAnchor.MiddleCenter, Anchor.BottomCenter, new Vector2(0, 80), new Vector2(580, 24), new Color(0.7f, 0.7f, 0.7f));

            // Hint (bottom) plus an always-available "Need a hint?" button
            // (bottom-right) for touch, where there is no H key.
            var hintPanel = CreatePanel(canvasRect, "Hint Panel", Anchor.BottomCenter, new Vector2(0, 150), new Vector2(760, 70));
            var hintText = CreateText(hintPanel, "Hint Text", "", 24, TextAnchor.MiddleCenter, Anchor.MiddleCenter, Vector2.zero, new Vector2(720, 60), Color.white);
            var hintButton = CreateButton(canvasRect, "Hint Button", "Need a hint?", Anchor.BottomRight, new Vector2(-20, 60), new Vector2(200, 56));

            // Garden message (bottom-left).
            var gardenMsgPanel = CreatePanel(canvasRect, "Garden Message Panel", Anchor.BottomLeft, new Vector2(20, 150), new Vector2(360, 70));
            var gardenMsgText = CreateText(gardenMsgPanel, "Garden Message Text", "You grew a new flower today.", 20, TextAnchor.MiddleCenter, Anchor.MiddleCenter, Vector2.zero, new Vector2(340, 60), new Color(0.6f, 0.9f, 0.6f));

            if (worldSpaceHud && hudShader != null)
            {
                var material = new Material(hudShader) { name = "HUD Overlay" };
                foreach (var graphic in canvasRect.GetComponentsInChildren<Graphic>(true)) graphic.material = material;
            }

            // --- Managers ---
            var managers = new GameObject("Managers");

            var questManager = managers.AddComponent<QuestManager>();
            SetField(questManager, "objectRecognition", objectProvider);
            SetField(questManager, "personRecognition", personProvider);
            SetQuests(questManager, new[]
            {
                new QuestDefinition { questId = "coffee_mug_quest", kind = QuestTargetKind.Object, targetObject = mug, rewardPoints = 10,
                    instruction = "Let's find your coffee mug.", hintText = mug.hintText, foundText = "You found it!" },
                new QuestDefinition { questId = "find_sarah", kind = QuestTargetKind.Person, targetPerson = sarah, rewardPoints = 5,
                    instruction = "Sarah is visiting today. Can you find her?", hintText = "Try looking near the sofa, by the window.", foundText = "That's Sarah!" },
                new QuestDefinition { questId = "phone_quest", kind = QuestTargetKind.Object, targetObject = phone, rewardPoints = 10,
                    instruction = "Let's find your phone. Follow the arrows on the floor.", hintText = phone.hintText, foundText = "You found it!" },
            });

            var memoryCard = managers.AddComponent<MemoryCardController>();
            SetField(memoryCard, "panel", memoryPanel.gameObject);
            SetField(memoryCard, "titleText", memoryTitleText);
            SetField(memoryCard, "bodyText", memoryBodyText);
            SetField(memoryCard, "continueHintText", continueHint);
            SetField(memoryCard, "continueButton", continueButton);
            SetStringField(memoryCard, "defaultContinueHint", currentContinueHint);

            var identityCard = managers.AddComponent<IdentityCardController>();
            SetField(identityCard, "panel", identityPanel.gameObject);
            SetField(identityCard, "nameText", nameText);
            SetField(identityCard, "relationshipText", relationshipText);
            SetField(identityCard, "descriptionText", descriptionText);
            SetField(identityCard, "rememberButton", rememberButton);
            SetField(identityCard, "rememberButtonLabel", rememberButton.GetComponentInChildren<Text>());
            SetField(identityCard, "memoryCard", memoryCard);
            SetField(identityCard, "personRecognition", personProvider);

            var hintController = managers.AddComponent<HintController>();
            SetField(hintController, "panel", hintPanel.gameObject);
            SetField(hintController, "hintText", hintText);
            SetField(hintController, "hintButton", hintButton);
            SetField(hintController, "questManager", questManager);

            var highlight = managers.AddComponent<ObjectHighlightController>();
            SetField(highlight, "objectRecognition", objectProvider);
            SetField(highlight, "personRecognition", personProvider);

            var memoryGarden = managers.AddComponent<MemoryGardenController>();
            SetField(memoryGarden, "gardenArea", gardenArea);
            SetField(memoryGarden, "messagePanel", gardenMsgPanel.gameObject);
            SetField(memoryGarden, "messageText", gardenMsgText);

            var rewardController = managers.AddComponent<RewardController>();
            SetField(rewardController, "questManager", questManager);
            SetField(rewardController, "memoryGarden", memoryGarden);
            SetField(rewardController, "pointsPanel", rewardPanel.gameObject);
            SetField(rewardController, "pointsText", pointsText);
            SetField(rewardController, "totalText", totalText);

            var memoryGame = managers.AddComponent<MemoryGameController>();
            SetField(memoryGame, "player", rig.camera.transform);
            SetField(memoryGame, "zoneCenter", corner.zone);
            SetObjectArray(memoryGame, "people", corner.people);
            SetField(memoryGame, "personRecognition", personProvider);
            SetField(memoryGame, "identityCard", identityCard);
            SetField(memoryGame, "rewards", rewardController);
            SetField(memoryGame, "timerText", timerText);
            SetField(memoryGame, "timerPanel", timerPanel.gameObject);
            SetField(memoryGame, "cornerSign", corner.sign);

            // Floor pathway for the final activity: routed around the furniture
            // in the room; a straight line in AR (real rooms aren't known).
            var guidePath = managers.AddComponent<GuidePathController>();
            SetField(guidePath, "player", rig.camera.transform);
            if (!arMode)
                SetVector3Array(guidePath, "waypoints", new[] { new Vector3(0f, 0f, -2.6f), new Vector3(-2.9f, 0f, -2.8f) });

            var demoManager = managers.AddComponent<DemoSceneManager>();
            SetField(demoManager, "questManager", questManager);
            SetField(demoManager, "memoryGame", memoryGame);
            SetField(demoManager, "guidePath", guidePath);
            SetField(demoManager, "memoryCard", memoryCard);
            SetField(demoManager, "memoryGarden", memoryGarden);
            SetField(demoManager, "instructionPanel", instructionPanel.gameObject);
            SetField(demoManager, "instructionText", instructionText);
            SetField(demoManager, "progressText", progressText);
            if (arMode) SetBoolField(demoManager, "autoStart", false);

            // Caregiver activity log (idle unless StreamingAssets/recallar-supabase.json exists).
            var logger = managers.AddComponent<RecallAR.Telemetry.ActivityLogger>();
            SetField(logger, "demo", demoManager);
            SetField(logger, "questManager", questManager);
            SetField(logger, "memoryGame", memoryGame);
            SetField(logger, "memoryCard", memoryCard);
            SetField(logger, "personRecognition", personProvider);
            SetField(logger, "rewards", rewardController);
            SetField(logger, "memoryGarden", memoryGarden);
            SetStringField(logger, "appVariant", arMode ? "phone-ar" : worldSpaceHud ? "meta-xr" : "living-room");

            return new BuildResult
            {
                rig = rig,
                demoManager = demoManager,
                guidePath = guidePath,
                instructionPanel = instructionPanel.gameObject,
                instructionText = instructionText,
                progressText = progressText,
            };
        }

        /// <summary>Reticle on a separate always-on-top overlay canvas (desktop).</summary>
        private static ReticleController BuildOverlayReticle(SimulatedObjectRecognitionProvider objectProvider, SimulatedPersonRecognitionProvider personProvider)
        {
            var overlayGo = new GameObject("Reticle Canvas", typeof(Canvas), typeof(CanvasScaler));
            var overlayCanvas = overlayGo.GetComponent<Canvas>();
            overlayCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            overlayCanvas.sortingOrder = 100;
            return BuildReticle(overlayGo.GetComponent<RectTransform>(), 0, objectProvider, personProvider);
        }

        /// <summary>Reticle dot centred in the given canvas (used directly on the head-locked HUD in XR).</summary>
        private static ReticleController BuildReticle(RectTransform parent, int unused,
            SimulatedObjectRecognitionProvider objectProvider, SimulatedPersonRecognitionProvider personProvider)
        {
            var dotGo = new GameObject("Reticle", typeof(Image));
            dotGo.transform.SetParent(parent, false);
            var dotRect = dotGo.GetComponent<RectTransform>();
            dotRect.anchorMin = dotRect.anchorMax = new Vector2(0.5f, 0.5f);
            dotRect.pivot = new Vector2(0.5f, 0.5f);
            dotRect.anchoredPosition = Vector2.zero;
            dotRect.sizeDelta = new Vector2(14, 14);
            var dotImage = dotGo.GetComponent<Image>();
            dotImage.color = new Color(1f, 1f, 1f, 0.7f);
            dotImage.raycastTarget = false;

            var reticle = parent.gameObject.AddComponent<ReticleController>();
            SetField(reticle, "reticleRect", dotRect);
            SetField(reticle, "reticleImage", dotImage);
            SetField(reticle, "objectRecognition", objectProvider);
            SetField(reticle, "personRecognition", personProvider);
            return reticle;
        }

        // ------------------------------------------------------------------
        // Model placement, measured

        private readonly struct Placed
        {
            public readonly GameObject go;
            public readonly Bounds bounds;
            public Placed(GameObject go, Bounds bounds) { this.go = go; this.bounds = bounds; }
        }

        /// <summary>
        /// Instantiates a Kenney model and positions it so its world bounds are
        /// centred on (centerX, centerZ) with its lowest point at floorY —
        /// independent of where the model's own pivot happens to be.
        /// </summary>
        private static Placed Place(Transform parent, string modelName, float centerX, float centerZ, float yRotation, float scale,
            float floorY = 0f, bool addCollider = true)
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>($"{ModelsRoot}/FurnitureKit/{modelName}.fbx")
                        ?? AssetDatabase.LoadAssetAtPath<GameObject>($"{ModelsRoot}/BlockyCharacters/{modelName}.fbx");
            if (asset == null)
            {
                Debug.LogError($"DemoSceneBuilder: model asset not found for '{modelName}'");
                return new Placed(null, new Bounds());
            }

            var go = (GameObject)UnityEngine.Object.Instantiate(asset);
            go.name = modelName;
            if (parent != null) go.transform.SetParent(parent, false);
            go.transform.position = Vector3.zero;
            go.transform.rotation = Quaternion.Euler(0f, yRotation, 0f);
            go.transform.localScale = Vector3.one * scale;

            var bounds = WorldBounds(go);
            var delta = new Vector3(centerX - bounds.center.x, floorY - bounds.min.y, centerZ - bounds.center.z);
            go.transform.position += delta;
            bounds.center += delta;

            if (addCollider) EnsureCollider(go);
            return new Placed(go, bounds);
        }

        private static Bounds WorldBounds(GameObject root)
        {
            var renderers = root.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return new Bounds(root.transform.position, Vector3.zero);
            var b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            return b;
        }

        private static void EnsureCollider(GameObject root)
        {
            if (root.GetComponentInChildren<Collider>() != null) return;
            var bounds = WorldBounds(root);
            if (bounds.size == Vector3.zero) return;

            var box = root.AddComponent<BoxCollider>();
            var scale = root.transform.lossyScale;
            // Model rotations are multiples of 90°, so an axis-aligned world
            // box maps back to a local box by swapping x/z when needed.
            var local = Quaternion.Inverse(root.transform.rotation) * bounds.size;
            box.center = root.transform.InverseTransformPoint(bounds.center);
            box.size = new Vector3(
                Mathf.Abs(local.x) / Mathf.Max(Mathf.Abs(scale.x), 0.0001f),
                Mathf.Abs(local.y) / Mathf.Max(Mathf.Abs(scale.y), 0.0001f),
                Mathf.Abs(local.z) / Mathf.Max(Mathf.Abs(scale.z), 0.0001f));
        }

        // ------------------------------------------------------------------
        // Small building-block helpers

        private enum Anchor { TopLeft, TopCenter, TopRight, MiddleLeft, MiddleCenter, MiddleRight, BottomLeft, BottomCenter, BottomRight }

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
            go.GetComponent<Image>().color = new Color(0.08f, 0.08f, 0.1f, 0.74f);
            go.SetActive(false);
            return rect;
        }

        private static Text CreateText(RectTransform parent, string name, string content, int fontSize, TextAnchor alignment,
            Anchor anchor, Vector2 anchoredPos, Vector2 size, Color color)
        {
            var go = new GameObject(name, typeof(Text));
            go.transform.SetParent(parent, false);
            ApplyAnchor(go.GetComponent<RectTransform>(), anchor, anchoredPos, size);

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
            go.GetComponent<Image>().color = new Color(0.3f, 0.55f, 0.45f);
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

        /// <summary>Assigns a private [SerializeField] via SerializedObject, since this
        /// script wires everything at build time rather than in the inspector.</summary>
        public static void SetField(UnityEngine.Object target, string fieldName, UnityEngine.Object value)
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

        public static void SetObjectArray(UnityEngine.Object target, string fieldName, UnityEngine.Object[] values)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"DemoSceneBuilder: no array field '{fieldName}' on {target.GetType().Name}");
                return;
            }
            prop.arraySize = values.Length;
            for (var i = 0; i < values.Length; i++)
                prop.GetArrayElementAtIndex(i).objectReferenceValue = values[i];
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        public static void SetBoolField(UnityEngine.Object target, string fieldName, bool value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"DemoSceneBuilder: no field '{fieldName}' on {target.GetType().Name}");
                return;
            }
            prop.boolValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        public static void SetStringField(UnityEngine.Object target, string fieldName, string value)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"DemoSceneBuilder: no field '{fieldName}' on {target.GetType().Name}");
                return;
            }
            prop.stringValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        public static void SetVector3Array(UnityEngine.Object target, string fieldName, Vector3[] values)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty(fieldName);
            if (prop == null)
            {
                Debug.LogError($"DemoSceneBuilder: no array field '{fieldName}' on {target.GetType().Name}");
                return;
            }
            prop.arraySize = values.Length;
            for (var i = 0; i < values.Length; i++)
                prop.GetArrayElementAtIndex(i).vector3Value = values[i];
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void SetQuests(QuestManager target, QuestDefinition[] quests)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty("quests");
            if (prop == null)
            {
                Debug.LogError("DemoSceneBuilder: no 'quests' field on QuestManager");
                return;
            }

            prop.arraySize = quests.Length;
            for (var i = 0; i < quests.Length; i++)
            {
                var e = prop.GetArrayElementAtIndex(i);
                e.FindPropertyRelative("questId").stringValue = quests[i].questId;
                e.FindPropertyRelative("kind").enumValueIndex = (int)quests[i].kind;
                e.FindPropertyRelative("instruction").stringValue = quests[i].instruction;
                e.FindPropertyRelative("hintText").stringValue = quests[i].hintText;
                e.FindPropertyRelative("foundText").stringValue = quests[i].foundText;
                e.FindPropertyRelative("targetObject").objectReferenceValue = quests[i].targetObject;
                e.FindPropertyRelative("targetPerson").objectReferenceValue = quests[i].targetPerson;
                e.FindPropertyRelative("rewardPoints").intValue = quests[i].rewardPoints;
            }
            so.ApplyModifiedPropertiesWithoutUndo();
        }
    }
}
