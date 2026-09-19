import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { openDatabase } from "./db";
import { LocalImageStorage } from "./storage";
import { createApp } from "./app";
try {
  process.loadEnvFile(".env");
} catch (e: any) {
  if (e.code !== "ENOENT") throw e;
}
const dir = path.resolve(process.env.DATA_DIR || ".local-data");
await mkdir(dir, { recursive: true, mode: 0o700 });
if (!process.env.SESSION_SECRET) {
  const secretFile = path.join(dir, "session-secret");
  try {
    process.env.SESSION_SECRET = await readFile(secretFile, "utf8");
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
    const value = randomBytes(32).toString("hex");
    await writeFile(secretFile, value, { mode: 0o600, flag: "wx" });
    process.env.SESSION_SECRET = value;
  }
}
const db = await openDatabase(
  path.join(dir, "postgres"),
  process.env.DATABASE_URL,
);
const app = await createApp({
  db,
  storage: new LocalImageStorage(path.join(dir, "images")),
  env: process.env,
  staticDir: path.resolve("build/web"),
});
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
if (
  host !== "127.0.0.1" &&
  (!process.env.THREAD_CAREGIVER_PASSWORD ||
    !process.env.PUBLIC_ORIGIN?.startsWith("https://"))
)
  throw new Error(
    "Network listening requires household authentication and an HTTPS PUBLIC_ORIGIN.",
  );
await app.listen({ host, port });
console.log(
  "Thread is ready: http://127.0.0.1:" +
    port +
    " · " +
    db.kind +
    " · local household workspace",
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
