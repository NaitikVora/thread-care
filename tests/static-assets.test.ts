import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase } from "../apps/api/src/db";
import { createApp } from "../apps/api/src/app";
import { LocalImageStorage } from "../apps/api/src/storage";

test("HTML revalidates and stale module URLs return 404 instead of the app shell", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "thread-assets-"));
  const root = path.join(dir, "web");
  await mkdir(path.join(root, "assets"), { recursive: true });
  await writeFile(
    path.join(root, "index.html"),
    "<!doctype html><title>Test shell</title>",
  );
  await writeFile(
    path.join(root, "assets", "current.js"),
    "export const current = true;",
  );
  const db = await openDatabase("memory://");
  const app = await createApp({
    db,
    storage: new LocalImageStorage(path.join(dir, "images")),
    staticDir: root,
    scheduler: false,
    env: {
      SESSION_SECRET: "static-test-only-secret-not-used-outside-test-12345",
    },
  });
  t.after(async () => {
    await app.close();
    await db.close();
    await rm(dir, { recursive: true, force: true });
  });
  for (const url of ["/", "/diary", "/index.html"]) {
    const r = await app.inject({ url, headers: { host: "localhost" } });
    assert.equal(r.statusCode, 200);
    assert.equal(r.headers["cache-control"], "no-cache");
    assert.match(r.body, /Test shell/);
  }
  const current = await app.inject({
    url: "/assets/current.js",
    headers: { host: "localhost" },
  });
  assert.equal(current.statusCode, 200);
  assert.match(String(current.headers["content-type"]), /javascript/);
  const stale = await app.inject({
    url: "/assets/deleted.js",
    headers: { host: "localhost" },
  });
  assert.equal(stale.statusCode, 404);
  assert.equal(stale.headers["cache-control"], "no-store");
  assert.doesNotMatch(stale.body, /Test shell/);
});
