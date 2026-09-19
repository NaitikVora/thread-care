import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Database } from "./db";
import { z } from "zod";
import { HttpError } from "./repository";

export async function registerAccess(
  app: FastifyInstance,
  db: Database,
  env: Record<string, string | undefined>,
) {
  const enabled = !!env.THREAD_CAREGIVER_PASSWORD,
    secure = !!env.PUBLIC_ORIGIN?.startsWith("https://");
  if (env.NODE_ENV === "production" && (!enabled || !secure))
    throw new Error(
      "Production requires THREAD_CAREGIVER_PASSWORD and an HTTPS PUBLIC_ORIGIN.",
    );
  for (const key of ["THREAD_CAREGIVER_PASSWORD", "THREAD_PATIENT_PASSWORD"])
    if (env[key] && env[key]!.length < 16)
      throw new Error(key + " must contain at least 16 characters.");
  if (
    env.THREAD_PATIENT_PASSWORD &&
    env.THREAD_PATIENT_PASSWORD === env.THREAD_CAREGIVER_PASSWORD
  )
    throw new Error("Use different caregiver and patient passwords.");
  const salt = randomBytes(16),
    hashes = {
      caregiver: env.THREAD_CAREGIVER_PASSWORD
        ? scryptSync(env.THREAD_CAREGIVER_PASSWORD, salt, 32)
        : null,
      patient: env.THREAD_PATIENT_PASSWORD
        ? scryptSync(env.THREAD_PATIENT_PASSWORD, salt, 32)
        : null,
    };
  const attempts = new Map<string, number[]>(),
    cookieName = "thread_household";
  const cookie = (value: string, age: number) =>
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
  function token(req: any) {
    return (
      String(req.headers.cookie || "")
        .split(";")
        .map((v: string) => v.trim())
        .find((v: string) => v.startsWith(cookieName + "="))
        ?.slice(cookieName.length + 1) || ""
    );
  }
  const digest = (s: string) => createHash("sha256").update(s).digest("hex");
  async function identity(req: any) {
    if (!enabled)
      return { role: "caregiver", mode: "local", authenticated: true };
    const raw = token(req);
    if (!/^[a-f0-9]{64}$/.test(raw)) return null;
    const row = (
      await db.query(
        "SELECT role FROM household_sessions WHERE token_hash=$1 AND expires_at>now()",
        [digest(raw)],
      )
    ).rows[0];
    return row
      ? { role: row.role, mode: "password", authenticated: true }
      : null;
  }
  app.get("/api/auth/status", async (req) => ({
    enabled,
    identity: await identity(req),
  }));
  app.post("/api/auth/login", async (req, reply) => {
    const b = z
        .object({
          role: z.enum(["caregiver", "patient"]),
          password: z.string().min(1).max(256),
        })
        .parse(req.body),
      ip = req.ip,
      now = Date.now(),
      recent = (attempts.get(ip) || []).filter((t) => t > now - 300000);
    if (recent.length >= 8)
      throw new HttpError(429, "Too many sign-in attempts. Wait five minutes.");
    recent.push(now);
    attempts.set(ip, recent);
    const supplied = scryptSync(b.password, salt, 32),
      expected = hashes[b.role] || Buffer.alloc(32);
    if (!timingSafeEqual(supplied, expected) || !hashes[b.role])
      throw new HttpError(401, "The role or password was not accepted.");
    const raw = randomBytes(32).toString("hex");
    await db.query("DELETE FROM household_sessions WHERE expires_at<now()");
    await db.query(
      "INSERT INTO household_sessions(token_hash,role,expires_at) VALUES($1,$2,$3)",
      [digest(raw), b.role, new Date(now + 12 * 3600000)],
    );
    reply.header("Set-Cookie", cookie(raw, 12 * 3600));
    return { signedIn: true };
  });
  app.post("/api/auth/logout", async (req, reply) => {
    await db.query("DELETE FROM household_sessions WHERE token_hash=$1", [
      digest(token(req)),
    ]);
    reply.header("Set-Cookie", cookie("", 0));
    return { signedOut: true };
  });
  app.addHook("preHandler", async (req) => {
    if (
      !req.url.startsWith("/api/") ||
      req.url.startsWith("/api/auth/") ||
      req.url === "/api/health"
    )
      return;
    const who = await identity(req);
    if (!who)
      throw new HttpError(401, "Sign in to your Thread household to continue.");
    if (who.role !== "patient") return;
    const url = req.url.split("?")[0];
    const adminOnly =
      /^\/api\/(connect|test|disconnect)$/.test(url) ||
      /^\/api\/v1\/(privacy\/clear|export|dataset\/export|import|preferences)$/.test(
        url,
      ) ||
      /^\/api\/v1\/voice\/(connect|test|disconnect|sync)$/.test(url) ||
      (req.method !== "GET" &&
        /^\/api\/v1\/(knowledge|people|examples)(\/|$)/.test(url));
    if (adminOnly)
      throw new HttpError(403, "This change needs the caregiver portal.");
    if (url === "/api/v1/action" && req.method === "POST") {
      const action = (req.body as any)?.action?.type;
      if (
        ![
          "intention",
          "object",
          "forget-intention",
          "forget-object",
          "start",
          "pause",
          "resume",
          "next",
          "repeat",
          "help",
          "sound",
        ].includes(action)
      )
        throw new HttpError(403, "This action needs a caregiver.");
    }
  });
  app.get("/api/health", async () => {
    await db.query("SELECT 1");
    return {
      status: "ok",
      access: enabled ? "authenticated-household" : "local-only",
    };
  });
  return { enabled, identity };
}
