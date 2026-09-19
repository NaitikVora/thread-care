using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace RecallAR.Telemetry
{
    /// <summary>
    /// Minimal Supabase REST (PostgREST) client: queued, sequential, retried
    /// inserts and updates using the public anon key. No SDK dependency —
    /// just UnityWebRequest and a tiny hand-rolled JSON writer, which is all
    /// the activity log needs. Requests never block gameplay; failures are
    /// logged and dropped after a few retries.
    /// </summary>
    public class SupabaseClient : MonoBehaviour
    {
        private const int MaxAttempts = 3;

        private SupabaseConfig config;
        private readonly Queue<Request> queue = new Queue<Request>();
        private bool sending;

        public bool IsConfigured => config != null;
        public int Pending => queue.Count + (sending ? 1 : 0);

        private class Request
        {
            public string method;
            public string url;
            public string body;
            public string prefer;
            public int attempts;
        }

        public void Configure(SupabaseConfig cfg) => config = cfg;

        /// <summary>POST one row (a JSON object string) into a table.</summary>
        public void Insert(string table, string jsonRow)
        {
            if (config == null) return;
            Enqueue(new Request { method = "POST", url = config.RestBase + table, body = jsonRow, prefer = "return=minimal" });
        }

        /// <summary>PATCH rows matching a PostgREST filter (e.g. "id=eq.&lt;uuid&gt;").</summary>
        public void Update(string table, string filter, string jsonPatch)
        {
            if (config == null) return;
            Enqueue(new Request { method = "PATCH", url = config.RestBase + table + "?" + filter, body = jsonPatch, prefer = "return=minimal" });
        }

        private void Enqueue(Request request)
        {
            queue.Enqueue(request);
            if (!sending) StartCoroutine(Drain());
        }

        private IEnumerator Drain()
        {
            sending = true;
            while (queue.Count > 0)
            {
                var request = queue.Peek();
                request.attempts++;

                using (var www = new UnityWebRequest(request.url, request.method))
                {
                    www.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(request.body));
                    www.downloadHandler = new DownloadHandlerBuffer();
                    www.SetRequestHeader("Content-Type", "application/json");
                    www.SetRequestHeader("apikey", config.anonKey);
                    www.SetRequestHeader("Authorization", "Bearer " + config.anonKey);
                    www.SetRequestHeader("Prefer", request.prefer);
                    www.timeout = 15;
                    yield return www.SendWebRequest();

                    if (www.result == UnityWebRequest.Result.Success)
                    {
                        queue.Dequeue();
                    }
                    else
                    {
                        var detail = $"{(int)www.responseCode} {www.error} {www.downloadHandler.text}";
                        // 4xx means the request itself is wrong (schema, key, RLS); retrying won't help.
                        var clientError = www.responseCode >= 400 && www.responseCode < 500;
                        if (clientError || request.attempts >= MaxAttempts)
                        {
                            Debug.LogWarning($"SupabaseClient: dropping {request.method} {request.url} after {request.attempts} attempt(s): {detail}");
                            queue.Dequeue();
                        }
                        else
                        {
                            Debug.Log($"SupabaseClient: retrying {request.method} {request.url}: {detail}");
                            yield return new WaitForSeconds(2f * request.attempts);
                        }
                    }
                }
            }
            sending = false;
        }

        // ---------------------------------------------------------------
        // Tiny JSON object writer (enough for flat rows + one nested object)
        // ---------------------------------------------------------------
        public class Json
        {
            private readonly StringBuilder sb = new StringBuilder("{");
            private bool any;

            private void Key(string key)
            {
                if (any) sb.Append(',');
                any = true;
                sb.Append('"').Append(Escape(key)).Append("\":");
            }

            public Json Str(string key, string value)
            {
                Key(key);
                if (value == null) sb.Append("null");
                else sb.Append('"').Append(Escape(value)).Append('"');
                return this;
            }

            public Json Num(string key, int value) { Key(key); sb.Append(value.ToString(CultureInfo.InvariantCulture)); return this; }
            public Json Num(string key, float value) { Key(key); sb.Append(Math.Round(value, 1).ToString(CultureInfo.InvariantCulture)); return this; }
            public Json Bool(string key, bool value) { Key(key); sb.Append(value ? "true" : "false"); return this; }
            public Json Null(string key) { Key(key); sb.Append("null"); return this; }
            public Json Raw(string key, string rawJson) { Key(key); sb.Append(string.IsNullOrEmpty(rawJson) ? "{}" : rawJson); return this; }

            public override string ToString() => sb + "}";

            public static string Escape(string s)
            {
                var b = new StringBuilder(s.Length + 8);
                foreach (var c in s)
                {
                    switch (c)
                    {
                        case '"': b.Append("\\\""); break;
                        case '\\': b.Append("\\\\"); break;
                        case '\n': b.Append("\\n"); break;
                        case '\r': b.Append("\\r"); break;
                        case '\t': b.Append("\\t"); break;
                        default:
                            if (c < ' ') b.Append("\\u").Append(((int)c).ToString("x4"));
                            else b.Append(c);
                            break;
                    }
                }
                return b.ToString();
            }
        }
    }
}
