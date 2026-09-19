import { createHash } from "node:crypto";
import type { Database, Queryable } from "./db";
import { HttpError, iso } from "./repository";
import type {
  DiarySession,
  DiaryEvent,
  TrustedPerson,
  LiveContext,
} from "../../../packages/contracts/src/diary";
import type { ImageStorage } from "./storage";
export const fingerprint = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, v) =>
        v && typeof v === "object" && !Array.isArray(v)
          ? Object.fromEntries(
              Object.keys(v)
                .sort()
                .map((k) => [k, v[k]]),
            )
          : v,
      ),
    )
    .digest("hex");
export const sessionView = (r: any): DiarySession => ({
  id: r.id,
  title: r.title,
  status: r.status,
  source: r.source,
  policy: r.policy,
  startedAt: iso(r.started_at),
  heartbeatAt: iso(r.heartbeat_at),
  endedAt: r.ended_at ? iso(r.ended_at) : null,
});
export const eventView = (r: any): DiaryEvent => ({
  id: r.id,
  sessionId: r.session_id,
  kind: r.kind,
  status: r.status,
  review: r.review,
  title: r.title,
  summary: r.summary,
  category: r.category,
  tags: r.tags,
  details: r.details,
  hasImage: !!r.blob_key,
  error: r.error,
  revision: r.revision,
  capturedAt: iso(r.captured_at),
  receivedAt: iso(r.received_at),
  expiresAt: iso(r.expires_at),
});
export const personView = (r: any): TrustedPerson => ({
  id: r.id,
  name: r.name,
  relationship: r.relationship,
  description: r.description,
  author: r.author,
  hasPhoto: !!r.blob_key,
  revision: r.revision,
  updatedAt: iso(r.updated_at),
});
export class DiaryRepository {
  constructor(
    public db: Database,
    private storage: ImageStorage,
  ) {}
  async init() {
    await this.db.query(
      "UPDATE current_encounters SET ended_at=now(),end_reason='server-restarted' WHERE ended_at IS NULL",
    );
    await this.db.query(
      "UPDATE diary_sessions SET status='interrupted' WHERE status='active'",
    );
    await this.db.query(
      "UPDATE diary_events SET status='failed',error='Analysis was interrupted. Capture again to retry.' WHERE status='analyzing'",
    );
    await this.db.query(
      "UPDATE voice_sessions SET status='interrupted',ended_at=now() WHERE ended_at IS NULL",
    );
  }
  async session(id: string, tx: Queryable = this.db) {
    const r = (await tx.query("SELECT * FROM diary_sessions WHERE id=$1", [id]))
      .rows[0];
    if (!r) throw new HttpError(404, "This diary session was not found.");
    return sessionView(r);
  }
  async active(id: string) {
    const s = await this.session(id);
    if (s.status !== "active" || Date.parse(s.heartbeatAt) < Date.now() - 90000)
      throw new HttpError(
        409,
        "This session is paused or disconnected. Resume it before recording.",
      );
    return s;
  }
  async sessions() {
    await this.db.query(
      "UPDATE diary_sessions SET status='interrupted' WHERE status='active' AND heartbeat_at<now()-interval '90 seconds'",
    );
    return (
      await this.db.query(
        "SELECT * FROM diary_sessions ORDER BY started_at DESC LIMIT 30",
      )
    ).rows.map(sessionView);
  }
  async people() {
    return (
      await this.db.query("SELECT * FROM trusted_people ORDER BY name LIMIT 50")
    ).rows.map(personView);
  }
  async liveContext(sessionId: string): Promise<LiveContext> {
    const session = await this.session(sessionId);
    const active =
      session.status === "active" &&
      Date.parse(session.heartbeatAt) >= Date.now() - 90000;
    const [encounters, observations] = await Promise.all([
      active
        ? this.db.query(
            `SELECT c.*,row_to_json(p) AS person FROM current_encounters c
         JOIN trusted_people p ON p.id=c.person_id
         JOIN diary_events e ON e.id=c.id
         WHERE c.session_id=$1 AND c.ended_at IS NULL AND c.valid_until>now()
         AND e.expires_at>now() AND e.status='ready' AND e.review='confirmed'`,
            [sessionId],
          )
        : Promise.resolve({ rows: [] }),
      this.db.query(
        "SELECT * FROM diary_events WHERE session_id=$1 AND kind='camera' AND status='ready' AND expires_at>now() ORDER BY captured_at DESC LIMIT 1",
        [sessionId],
      ),
    ]);
    const c = encounters.rows[0];
    const latest = observations.rows[0]
      ? eventView(observations.rows[0])
      : null;
    return {
      sessionId,
      currentEncounter: c
        ? {
            id: c.id,
            person: personView(c.person),
            observationId: c.observation_id,
            confirmedAt: iso(c.confirmed_at),
            validUntil: iso(c.valid_until),
            basis: "patient-confirmed",
          }
        : null,
      latestObservation: latest,
      observationAgeSeconds: latest
        ? Math.max(
            0,
            Math.floor((Date.now() - Date.parse(latest.capturedAt)) / 1000),
          )
        : null,
      identityMode: "patient-confirmation",
      notice:
        "A current encounter means the patient confirmed who is with them, not that any visible face was matched. Use the confirmation time and profile. A past diary visit does not establish current presence. A camera observation describes one timestamped still only.",
    };
  }
  async endEncounter(
    sessionId: string,
    reason: string,
    tx: Queryable = this.db,
  ) {
    await tx.query(
      "UPDATE current_encounters SET ended_at=now(),end_reason=$2 WHERE session_id=$1 AND ended_at IS NULL",
      [sessionId, reason],
    );
  }
  async search(
    query = "",
    options: {
      day?: string;
      timezone?: string;
      category?: string;
      limit?: number;
      sessionId?: string;
    } = {},
  ) {
    const params: any[] = [];
    const where = [
      "status='ready'",
      "expires_at>now()",
      "(kind<>'conversation' OR details->>'role'='user')",
    ];
    const param = (v: any) => {
      params.push(v);
      return "$" + params.length;
    };
    if (options.day) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: options.timezone || "UTC" });
      } catch {
        throw new HttpError(400, "Choose a valid time zone.");
      }
      where.push(
        `(captured_at AT TIME ZONE ${param(options.timezone || "UTC")})::date=${param(options.day)}::date`,
      );
    }
    if (options.category) where.push("category=" + param(options.category));
    if (options.sessionId) where.push("session_id=" + param(options.sessionId));
    const words = query.match(/[\p{L}\p{N}]{2,}/gu)?.slice(0, 20) || [];
    let order = "captured_at DESC";
    if (words.length) {
      const q = param(words.join(" | "));
      where.push(`search_document @@ to_tsquery('english',${q})`);
      order = `ts_rank(search_document,to_tsquery('english',${q})) DESC,captured_at DESC`;
    }
    const limit = param(Math.min(200, Math.max(1, options.limit || 12)));
    return (
      await this.db.query(
        `SELECT * FROM diary_events WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ${limit}`,
        params,
      )
    ).rows.map(eventView);
  }
  async context(query: string) {
    return (await this.search(query, { limit: 8 })).map((e) => ({
      id: e.id,
      title: e.title,
      content: e.summary,
      kind: "fact" as const,
      tags: e.tags,
      author:
        e.review === "unreviewed"
          ? "Camera / voice observation — unconfirmed"
          : "User-reviewed diary",
      revision: e.revision,
      createdAt: e.capturedAt,
      updatedAt: e.capturedAt,
      sourceType: "diary",
      review: e.review,
      sourceTime: e.capturedAt,
    }));
  }
  async cleanup() {
    await this.sessions();
    await this.db.query(
      "UPDATE current_encounters c SET ended_at=now(),end_reason='expired-or-interrupted' WHERE ended_at IS NULL AND (valid_until<=now() OR NOT EXISTS(SELECT 1 FROM diary_sessions s WHERE s.id=c.session_id AND s.status='active'))",
    );
    const expired = (
      await this.db.query(
        "DELETE FROM diary_events WHERE expires_at<now() RETURNING blob_key",
      )
    ).rows;
    for (const r of expired)
      if (r.blob_key) await this.storage.remove(r.blob_key);
    if (expired.length) await this.db.query("DELETE FROM diary_digests");
    await this.db.query(
      "DELETE FROM diary_sessions WHERE started_at<now()-interval '31 days' AND status IN ('ended','interrupted') AND NOT EXISTS(SELECT 1 FROM diary_events WHERE session_id=diary_sessions.id)",
    );
  }
}
