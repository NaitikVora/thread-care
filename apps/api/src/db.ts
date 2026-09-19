import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
export interface Queryable {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
}
export interface Database extends Queryable {
  kind: string;
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDatabase(
  dataDir: string,
  url?: string,
): Promise<Database> {
  let db: Database;
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 10 });
    db = {
      kind: "PostgreSQL",
      query: async (sql, p) => pool.query(sql, p),
      close: () => pool.end(),
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const value = await fn({ query: async (sql, p) => c.query(sql, p) });
          await c.query("COMMIT");
          return value;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
    };
  } else {
    if (dataDir !== "memory://") await mkdir(dataDir, { recursive: true });
    const lite = new PGlite(dataDir);
    await lite.waitReady;
    db = {
      kind: "PGlite (local)",
      query: async (sql, p) => lite.query(sql, p),
      close: () => lite.close(),
      transaction: async (fn) =>
        lite.transaction(async (tx) =>
          fn({ query: async (sql, p) => tx.query(sql, p) }),
        ),
    };
  }
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir(path.resolve("migrations")))
    .filter((x) => x.endsWith(".sql"))
    .sort()) {
    await db.transaction(async (tx) => {
      if (
        (
          await tx.query("SELECT name FROM schema_migrations WHERE name=$1", [
            name,
          ])
        ).rows.length
      )
        return;
      const sql = await readFile(path.resolve("migrations", name), "utf8");
      for (const statement of sql
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean))
        await tx.query(statement);
      await tx.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
    });
  }
  return db;
}
