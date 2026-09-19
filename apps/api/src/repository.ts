import { randomUUID, createHash } from "node:crypto";
import type { Database, Queryable } from "./db";
import {
  createState,
  restoreState,
  transition,
} from "../../../packages/domain/src/index.js";
import type {
  Snapshot,
  State,
  DomainAction,
  Knowledge,
  KnowledgeInput,
  Reminder,
  Preferences,
} from "../../../packages/contracts/src/index";
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export const iso = (value: any) => new Date(value).toISOString();
export const knowledgeRow = (r: any): Knowledge => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  content: r.content,
  tags: r.tags,
  author: r.author,
  revision: r.revision,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});
export const reminderRow = (r: any): Reminder => ({
  id: r.id,
  title: r.title,
  dueAt: iso(r.due_at),
  timezone: r.timezone,
  status: r.status,
  createdAt: iso(r.created_at),
});
const defaults: Preferences = {
  proactive: false,
  quietStart: 21,
  quietEnd: 8,
  speechRate: 0.88,
  retentionDays: 30,
};
export class Repository {
  constructor(public db: Database) {}
  async init() {
    await this.db.query(
      "INSERT INTO app_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO NOTHING",
      [JSON.stringify(createState())],
    );
    await this.db.query(
      "INSERT INTO settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO NOTHING",
      [JSON.stringify(defaults)],
    );
    await this.db.query(
      "UPDATE agent_runs SET status='interrupted',reply='This request was interrupted by a server restart. Please ask again.',updated_at=now() WHERE status='running'",
    );
  }
  async snapshot(tx: Queryable = this.db): Promise<Snapshot> {
    const r = (await tx.query("SELECT data,revision FROM app_state WHERE id=1"))
      .rows[0];
    return {
      state: restoreState(JSON.stringify(r.data)),
      revision: r.revision,
    };
  }
  async change(
    revision: number,
    id: string,
    payload: unknown,
    fn: (s: State, tx: Queryable) => Promise<{ state: State; reply?: string }>,
  ) {
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    return this.db.transaction(async (tx) => {
      await tx.query("SELECT id FROM app_state WHERE id=1 FOR UPDATE");
      const prior = (
        await tx.query("SELECT payload,result FROM commands WHERE id=$1", [id])
      ).rows[0];
      if (prior) {
        if (prior.payload !== fingerprint)
          throw new HttpError(
            409,
            "This request ID was already used for another change.",
          );
        return prior.result as Snapshot & { reply?: string };
      }
      const current = await this.snapshot(tx);
      if (current.revision !== revision)
        throw new HttpError(
          409,
          "Your records changed. The latest version is loaded; review and try again.",
        );
      const result = await fn(current.state, tx);
      const output = {
        state: result.state,
        revision: revision + 1,
        reply: result.reply,
      };
      await tx.query(
        "UPDATE app_state SET data=$1,revision=revision+1 WHERE id=1",
        [JSON.stringify(result.state)],
      );
      await tx.query(
        "INSERT INTO commands(id,payload,result) VALUES($1,$2,$3)",
        [id, fingerprint, JSON.stringify(output)],
      );
      return output;
    });
  }
  async action(revision: number, id: string, action: DomainAction) {
    return this.change(revision, id, action, async (state) => {
      const r = transition(state, action);
      if (r.reply) {
        r.state.messages.push({ role: "assistant", text: r.reply });
        r.state.messages = r.state.messages.slice(-40);
      }
      return r;
    });
  }
  async knowledge() {
    return (
      await this.db.query(
        "SELECT * FROM knowledge ORDER BY updated_at DESC LIMIT 500",
      )
    ).rows.map(knowledgeRow);
  }
  async search(query: string) {
    const tokens = query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
    const stop = new Set([
      "what",
      "where",
      "when",
      "does",
      "have",
      "this",
      "that",
      "with",
      "about",
      "please",
      "tell",
      "remember",
      "which",
      "would",
      "could",
      "should",
      "their",
      "your",
      "there",
      "they",
      "the",
    ]);
    const useful = tokens.filter((t) => !stop.has(t));
    return (await this.knowledge())
      .map((k) => {
        const title = (k.title + " " + k.tags.join(" ")).toLowerCase(),
          body = k.content.toLowerCase();
        return {
          k,
          score: useful.reduce(
            (n, t) =>
              n + (title.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0),
            0,
          ),
        };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.k);
  }
  async saveKnowledge(
    input: KnowledgeInput,
    revision: number,
    requestId: string,
    id?: string,
    noteRevision?: number,
  ) {
    return this.change(
      revision,
      requestId,
      { input, id, noteRevision },
      async (state, tx) => {
        let target = id || randomUUID();
        if (id) {
          const old = (
            await tx.query("SELECT * FROM knowledge WHERE id=$1", [id])
          ).rows[0];
          if (!old || old.revision !== noteRevision)
            throw new HttpError(
              409,
              "This note changed. Reload it before editing.",
            );
          await tx.query(
            "INSERT INTO knowledge_history(id,revision,data) VALUES($1,$2,$3)",
            [id, old.revision, JSON.stringify(knowledgeRow(old))],
          );
          await tx.query(
            "UPDATE knowledge SET kind=$2,title=$3,content=$4,tags=$5,author=$6,revision=revision+1,updated_at=now() WHERE id=$1",
            [
              id,
              input.kind,
              input.title,
              input.content,
              JSON.stringify(input.tags),
              input.author,
            ],
          );
        } else {
          if (
            Number(
              (await tx.query("SELECT count(*) AS n FROM knowledge")).rows[0].n,
            ) >= 500
          )
            throw new HttpError(
              400,
              "This local workspace supports up to 500 knowledge notes.",
            );
          await tx.query(
            "INSERT INTO knowledge(id,kind,title,content,tags,author) VALUES($1,$2,$3,$4,$5,$6)",
            [
              target,
              input.kind,
              input.title,
              input.content,
              JSON.stringify(input.tags),
              input.author,
            ],
          );
        }
        state.events.unshift({
          id: randomUUID(),
          at: new Date().toISOString(),
          title: id ? "Knowledge corrected" : "Knowledge saved",
          detail: input.title,
          source: input.author,
          type: "knowledge",
        });
        state.events = state.events.slice(0, 150);
        return { state, reply: "Saved. This note is available to Thread now." };
      },
    );
  }
  async removeKnowledge(id: string, revision: number, requestId: string) {
    return this.change(
      revision,
      requestId,
      { deleteKnowledge: id },
      async (state, tx) => {
        await tx.query("DELETE FROM knowledge_history WHERE id=$1", [id]);
        await tx.query("DELETE FROM knowledge WHERE id=$1", [id]);
        return { state, reply: "Note and its correction history deleted." };
      },
    );
  }
  async reminders() {
    await this.db.query(
      "UPDATE reminders SET status='due' WHERE status='scheduled' AND due_at <= now()",
    );
    return (
      await this.db.query(
        "SELECT * FROM reminders ORDER BY due_at DESC LIMIT 100",
      )
    ).rows.map(reminderRow);
  }
  async settings(): Promise<Preferences> {
    return (await this.db.query("SELECT data FROM settings WHERE id=1")).rows[0]
      .data;
  }
  async cleanup() {
    const settings = await this.settings();
    await this.db.query(
      "DELETE FROM agent_runs WHERE status<>'running' AND created_at < now() - ($1 * interval '1 day')",
      [settings.retentionDays],
    );
    await this.db.query(
      "DELETE FROM commands WHERE created_at < now() - interval '7 days'",
    );
  }
}
