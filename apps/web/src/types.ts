import type {
  Snapshot,
  Knowledge,
  Reminder,
  Preferences,
  AIStatus,
  Example,
  Trace,
} from "../../../packages/contracts/src/index";
import type { AgentAction } from "../../../packages/agent/src/index";
export type { Knowledge, Reminder, Preferences, AIStatus, Example, Snapshot };
export interface Bootstrap {
  identity?: { role: "caregiver" | "patient"; mode: string };
  snapshot: Snapshot;
  knowledge: Knowledge[];
  reminders: Reminder[];
  preferences: Preferences;
  storage: string;
  budget: { limit: number; used: number };
  examples: Example[];
}
export interface Result {
  id: string;
  reply: string;
  actions: AgentAction[];
  sources: Partial<Knowledge>[];
  trace: Trace[];
  revision: number;
  mode: "live" | "basic";
  model?: string;
  stale?: boolean;
  applied?: number[];
}
export type Ask = (
  message: string,
  purpose?: "chat" | "test" | "routine" | "summary" | "message",
  image?: string,
) => Promise<void>;
export type Mutate = (
  route: string,
  body: Record<string, unknown>,
  success?: string,
) => Promise<boolean>;
