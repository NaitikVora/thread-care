using UnityEngine;
using UnityEngine.UI;

namespace RecallAR.Reward
{
    /// <summary>
    /// A small visual reward garden: each completed quest grows one more
    /// flower. Deliberately simple procedural geometry (no imported assets)
    /// so the demo scene has zero external art dependencies.
    /// </summary>
    public class MemoryGardenController : MonoBehaviour
    {
        [SerializeField] private Transform gardenArea;
        [SerializeField] private GameObject messagePanel;
        [SerializeField] private Text messageText;
        [SerializeField] private float messageDuration = 2.5f;
        [SerializeField] private float spacing = 0.6f;

        private int flowerCount;
        private float hideAt = -1f;

        public int FlowerCount => flowerCount;

        private static readonly Color[] Palette =
        {
            new Color(0.95f, 0.55f, 0.65f),
            new Color(0.98f, 0.78f, 0.35f),
            new Color(0.75f, 0.55f, 0.95f),
            new Color(0.55f, 0.75f, 0.95f),
        };

        private void Awake()
        {
            if (messagePanel != null) messagePanel.SetActive(false);
        }

        private void Update()
        {
            if (hideAt >= 0f && Time.time >= hideAt)
            {
                messagePanel.SetActive(false);
                hideAt = -1f;
            }
        }

        public void GrowOne()
        {
            SpawnFlower(flowerCount);
            flowerCount++;

            if (messageText != null)
            {
                messageText.text = "You grew a new flower today.";
                messagePanel.SetActive(true);
                hideAt = Time.time + messageDuration;
            }
        }

        private void SpawnFlower(int index)
        {
            var origin = gardenArea != null ? gardenArea.position : Vector3.zero;
            var basePos = origin + new Vector3((index % 5) * spacing, 0f, (index / 5) * spacing);

            var flower = new GameObject($"Flower_{index}");
            flower.transform.SetParent(gardenArea != null ? gardenArea : transform, false);
            flower.transform.position = basePos;

            var stem = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            stem.name = "Stem";
            stem.transform.SetParent(flower.transform, false);
            stem.transform.localScale = new Vector3(0.03f, 0.12f, 0.03f);
            stem.transform.localPosition = new Vector3(0f, 0.12f, 0f);
            SetColor(stem, new Color(0.35f, 0.6f, 0.3f));
            Destroy(stem.GetComponent<Collider>());

            var bloom = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            bloom.name = "Bloom";
            bloom.transform.SetParent(flower.transform, false);
            bloom.transform.localScale = Vector3.one * 0.12f;
            bloom.transform.localPosition = new Vector3(0f, 0.26f, 0f);
            SetColor(bloom, Palette[index % Palette.Length]);
            Destroy(bloom.GetComponent<Collider>());
        }

        private static void SetColor(GameObject go, Color color)
        {
            var renderer = go.GetComponent<Renderer>();
            if (renderer != null) renderer.material.color = color;
        }
    }
}
