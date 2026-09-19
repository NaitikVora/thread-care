import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../apps/api/src/db";
import { Repository } from "../apps/api/src/repository";
import { DiaryRepository } from "../apps/api/src/diary";
import { LocalImageStorage } from "../apps/api/src/storage";
const url = process.env.POSTGRES_TEST_URL;
test(
  "real PostgreSQL migrations, GIN retrieval and concurrent command idempotency",
  { skip: !url },
  async () => {
    // Use a disposable database only: migrations and these synthetic records are written.
    const db = await openDatabase("unused", url),
      repo = new Repository(db),
      id = randomUUID(),
      sessionId = randomUUID(),
      personId = randomUUID(),
      encounterId = randomUUID();
    try {
      assert.equal(db.kind, "PostgreSQL");
      await repo.init();
      const captured = new Date(),
        expires = new Date(Date.now() + 86400000);
      await db.query(
        "INSERT INTO diary_events(id,kind,status,review,title,summary,tags,fingerprint,captured_at,expires_at) VALUES($1,'note','ready','confirmed','Postgres integration check','The test umbrella is in the blue garage.','[\"umbrella\"]','ci-only',$2,$3)",
        [id, captured, expires],
      );
      const diary = new DiaryRepository(
        db,
        new LocalImageStorage("/tmp/thread-ci-unused"),
      );
      assert((await diary.search("umbrellas garage")).some((e) => e.id === id));
      await db.query(
        "INSERT INTO diary_sessions(id,title,status,policy) VALUES($1,'CI encounter','active','{}')",
        [sessionId],
      );
      await db.query(
        "INSERT INTO trusted_people(id,name,relationship,author,consent_at) VALUES($1,'CI Maya','daughter','QA',now())",
        [personId],
      );
      await db.query(
        "INSERT INTO diary_events(id,session_id,kind,status,review,title,summary,fingerprint,captured_at,expires_at) VALUES($1,$2,'person','ready','confirmed','CI visit','Confirmed CI visit','ci-only',now(),$3)",
        [encounterId, sessionId, expires],
      );
      await db.query(
        "INSERT INTO current_encounters(id,session_id,person_id,valid_until) VALUES($1,$2,$3,$4)",
        [encounterId, sessionId, personId, expires],
      );
      assert.equal(
        (await diary.liveContext(sessionId)).currentEncounter?.person.name,
        "CI Maya",
      );
      await diary.endEncounter(sessionId, "ci-finished");
      assert.equal((await diary.liveContext(sessionId)).currentEncounter, null);
      const current = await repo.snapshot(),
        requestId = randomUUID(),
        action = { type: "intention" as const, text: "CI synthetic intention" };
      const results = await Promise.all([
        repo.action(current.revision, requestId, action),
        repo.action(current.revision, requestId, action),
      ]);
      assert.equal(results[0].revision, results[1].revision);
    } finally {
      await db.query("DELETE FROM diary_sessions WHERE id=$1", [sessionId]);
      await db.query("DELETE FROM trusted_people WHERE id=$1", [personId]);
      await db.query("DELETE FROM diary_events WHERE id=$1", [id]);
      await db.close();
    }
  },
);
