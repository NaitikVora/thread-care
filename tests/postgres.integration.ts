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
      id = randomUUID();
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
      const current = await repo.snapshot(),
        requestId = randomUUID(),
        action = { type: "intention" as const, text: "CI synthetic intention" };
      const results = await Promise.all([
        repo.action(current.revision, requestId, action),
        repo.action(current.revision, requestId, action),
      ]);
      assert.equal(results[0].revision, results[1].revision);
    } finally {
      await db.query("DELETE FROM diary_events WHERE id=$1", [id]);
      await db.close();
    }
  },
);
