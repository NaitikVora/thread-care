using System.Collections.Generic;
using UnityEngine;

namespace RecallAR.Game
{
    /// <summary>
    /// A gentle floor pathway: soft chevrons from the player to a target,
    /// routed through fixed waypoints so it goes around furniture. Recomputed
    /// as the player moves, breathing slowly rather than flashing (spec
    /// section 33: no flashing animations, no time pressure).
    /// </summary>
    public class GuidePathController : MonoBehaviour
    {
        [SerializeField] private Transform player;
        [SerializeField] private Vector3[] waypoints = new Vector3[0];
        [SerializeField] private Color color = new Color(0.45f, 0.85f, 0.7f);
        [SerializeField] private float spacing = 0.45f;
        [SerializeField] private float skipNearPlayer = 0.7f;
        [SerializeField] private float stopBeforeTarget = 0.45f;
        [SerializeField] private int maxMarkers = 40;
        [SerializeField] private float refreshInterval = 0.25f;

        private Transform target;
        private readonly List<Transform> markers = new List<Transform>();
        private readonly List<Renderer> markerRenderers = new List<Renderer>();
        private Material material;
        private float nextRefresh;

        public bool IsShowing => target != null;

        private void Awake()
        {
            material = new Material(Shader.Find("Standard")) { color = color };
            material.EnableKeyword("_EMISSION");
            for (var i = 0; i < maxMarkers; i++) markers.Add(CreateChevron(i));
            SetAllActive(false);
        }

        public void Show(Transform newTarget)
        {
            target = newTarget;
            nextRefresh = 0f;
        }

        public void Hide()
        {
            target = null;
            SetAllActive(false);
        }

        private void Update()
        {
            if (target == null || player == null) return;

            var pulse = 0.55f + 0.45f * (0.5f + 0.5f * Mathf.Sin(Time.time * 2.2f));
            material.SetColor("_EmissionColor", color * (0.35f * pulse));

            if (Time.time < nextRefresh) return;
            nextRefresh = Time.time + refreshInterval;
            Layout();
        }

        private void Layout()
        {
            var route = BuildRoute(Flat(player.position), Flat(target.position));

            var total = 0f;
            for (var i = 0; i < route.Count - 1; i++) total += Vector3.Distance(route[i], route[i + 1]);
            var limit = total - stopBeforeTarget;

            var used = 0;
            var next = skipNearPlayer;   // distance along the route of the next marker
            var walked = 0f;
            for (var i = 0; i < route.Count - 1 && used < markers.Count; i++)
            {
                var a = route[i];
                var segment = route[i + 1] - a;
                var length = segment.magnitude;
                if (length < 0.001f) continue;
                var dir = segment / length;

                while (next <= walked + length && next < limit && used < markers.Count)
                {
                    var m = markers[used++];
                    m.position = a + dir * (next - walked) + Vector3.up * 0.012f;
                    m.rotation = Quaternion.LookRotation(dir, Vector3.up);
                    m.gameObject.SetActive(true);
                    next += spacing;
                }
                walked += length;
            }

            for (var i = used; i < markers.Count; i++) markers[i].gameObject.SetActive(false);
        }

        /// <summary>Player → the nearest sensible waypoint onward → target.</summary>
        private List<Vector3> BuildRoute(Vector3 from, Vector3 to)
        {
            var route = new List<Vector3> { from };
            if (waypoints != null && waypoints.Length > 0)
            {
                // Start from the waypoint that is closest to the player without
                // sending them backwards: pick the nearest, then continue in order.
                var start = 0;
                var best = float.MaxValue;
                for (var i = 0; i < waypoints.Length; i++)
                {
                    var d = Vector3.Distance(from, Flat(waypoints[i]));
                    if (d < best) { best = d; start = i; }
                }
                // If the player is already past the nearest waypoint (closer to
                // the target than that waypoint is), skip it.
                for (var i = start; i < waypoints.Length; i++)
                {
                    var w = Flat(waypoints[i]);
                    if (Vector3.Distance(from, to) < Vector3.Distance(w, to) + 0.2f) continue;
                    route.Add(w);
                }
            }
            route.Add(to);
            return route;
        }

        private Transform CreateChevron(int index)
        {
            var root = new GameObject($"Path Marker {index}").transform;
            root.SetParent(transform, false);
            foreach (var sign in new[] { -1f, 1f })
            {
                var bar = GameObject.CreatePrimitive(PrimitiveType.Cube);
                bar.name = "Bar";
                Destroy(bar.GetComponent<Collider>());
                bar.transform.SetParent(root, false);
                // Two bars whose front ends meet at +Z (the direction of travel),
                // so the chevron's point leads the way rather than trailing.
                bar.transform.localScale = new Vector3(0.03f, 0.008f, 0.16f);
                bar.transform.localRotation = Quaternion.Euler(0f, -sign * 35f, 0f);
                bar.transform.localPosition = new Vector3(sign * 0.045f, 0f, -0.03f);
                var r = bar.GetComponent<Renderer>();
                r.sharedMaterial = material;
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                markerRenderers.Add(r);
            }
            return root;
        }

        private void SetAllActive(bool active)
        {
            foreach (var m in markers) m.gameObject.SetActive(active);
        }

        private static Vector3 Flat(Vector3 v) => new Vector3(v.x, 0f, v.z);
    }
}
