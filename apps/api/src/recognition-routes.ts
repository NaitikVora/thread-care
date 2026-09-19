import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Database } from "./db";
import { eventView, fingerprint } from "./diary";
import { HttpError } from "./repository";

const outcomes = {
  independent: "recognized without a cue",
  cued: "recognized after a name, photo or voice cue",
  introduction: "needed an introduction",
};
export async function registerRecognition(app: FastifyInstance, db: Database) {
  app.post("/api/v1/diary/recognition", async (req) => {
    const b = z
      .object({
        id: z.uuid(),
        personId: z.uuid(),
        outcome: z.enum(["independent", "cued", "introduction"]),
        observedBy: z.enum(["patient", "caregiver"]),
        capturedAt: z.iso.datetime({ offset: true }),
      })
      .parse(req.body);
    const time = Date.parse(b.capturedAt);
    if (time > Date.now() + 60000 || time < Date.now() - 30 * 86400000)
      throw new HttpError(400, "Choose a time within the past 30 days.");
    return db.transaction(async (tx) => {
      await tx.query("SELECT id FROM app_state WHERE id=1 FOR UPDATE");
      const hash = fingerprint(b);
      const prior = (
        await tx.query("SELECT * FROM diary_events WHERE id=$1", [b.id])
      ).rows[0];
      if (prior) {
        if (prior.fingerprint !== hash)
          throw new HttpError(409, "This observation ID was already used.");
        return eventView(prior);
      }
      const person = (
        await tx.query("SELECT * FROM trusted_people WHERE id=$1", [b.personId])
      ).rows[0];
      if (!person)
        throw new HttpError(404, "Choose a saved familiar person first.");
      const row = (
        await tx.query(
          `INSERT INTO diary_events(id,kind,status,review,title,summary,category,details,fingerprint,captured_at,expires_at)
         VALUES($1,'note','ready','confirmed',$2,$3,'connection',$4,$5,$6,$6::timestamptz + interval '30 days') RETURNING *`,
          [
            b.id,
            "Recognition · " + person.name,
            `${b.observedBy === "caregiver" ? "Caregiver observation" : "Patient report"}: ${person.name} was ${outcomes[b.outcome]}.`,
            JSON.stringify({
              metric: "recognition",
              personId: b.personId,
              outcome: b.outcome,
              observedBy: b.observedBy,
            }),
            hash,
            b.capturedAt,
          ],
        )
      ).rows[0];
      return eventView(row);
    });
  });
  app.get("/api/v1/diary/recognition", async (req) => {
    const q = z
      .object({
        day: z.iso.date(),
        timezone: z.string().max(80).default("UTC"),
      })
      .parse(req.query);
    try {
      new Intl.DateTimeFormat("en", { timeZone: q.timezone });
    } catch {
      throw new HttpError(400, "Choose a valid time zone.");
    }
    const { rows } = await db.query(
      `
      WITH latest AS (
        SELECT DISTINCT ON ((captured_at AT TIME ZONE $2)::date, details->>'personId')
          (captured_at AT TIME ZONE $2)::date AS day, details->>'outcome' AS outcome
        FROM diary_events
        WHERE details->>'metric'='recognition' AND status='ready' AND review='confirmed' AND expires_at>now()
          AND (captured_at AT TIME ZONE $2)::date BETWEEN $1::date - 6 AND $1::date
        ORDER BY (captured_at AT TIME ZONE $2)::date, details->>'personId', captured_at DESC, received_at DESC, id DESC
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
        count(l.outcome)::int AS observations,
        count(*) FILTER (WHERE l.outcome='independent')::int AS independent,
        count(*) FILTER (WHERE l.outcome='cued')::int AS cued,
        count(*) FILTER (WHERE l.outcome='introduction')::int AS introduction
      FROM generate_series($1::date - 6, $1::date, interval '1 day') AS d(day)
      LEFT JOIN latest l ON l.day=d.day::date GROUP BY d.day ORDER BY d.day`,
      [q.day, q.timezone],
    );
    return { days: rows };
  });
}
