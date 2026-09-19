import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("intention"), text: text(240) }),
  z.object({ type: z.literal("object"), name: text(80), location: text(180) }),
  z.object({ type: z.literal("start"), id: text(100) }),
  z.object({ type: z.literal("forget-object"), name: text(80) }),
  z.object({
    type: z.enum(["next", "pause", "resume", "help", "forget-intention"]),
  }),
  z.object({
    type: z.literal("request-status"),
    id: text(100),
    status: z.enum(["acknowledged", "resolved"]),
  }),
  z.object({
    type: z.literal("profile"),
    name: text(60),
    caregiver: text(60),
    visitAt: z.string().max(50),
    reassurance: z.string().max(400),
  }),
  z.object({
    type: z.literal("routine-edit"),
    id: text(100),
    steps: z.array(text(180)).min(1).max(12),
  }),
  z.object({
    type: z.literal("routine-create"),
    title: text(60),
    steps: z.array(text(180)).min(1).max(12),
  }),
  z.object({ type: z.literal("sound"), enabled: z.boolean() }),
]);
export type DomainAction = z.infer<typeof Action>;
export interface Routine {
  id: string;
  title: string;
  icon: string;
  description: string;
  steps: string[];
}
export interface State {
  version: 1;
  profile: {
    name: string;
    caregiver: string;
    visitAt: string;
    reassurance: string;
  };
  routines: Routine[];
  active: {
    routineId: string;
    step: number;
    status: "active" | "paused" | "completed";
  } | null;
  intention: {
    text: string;
    at: string;
    source: string;
    routineId: string | null;
  } | null;
  objects: { name: string; location: string; at: string; source: string }[];
  requests: {
    id: string;
    at: string;
    status: "open" | "acknowledged" | "resolved";
    context: string;
  }[];
  events: {
    id: string;
    at: string;
    title: string;
    detail: string;
    source: string;
    type: string;
  }[];
  messages: { role: "user" | "assistant"; text: string }[];
  sound: boolean;
}
export interface Snapshot {
  state: State;
  revision: number;
}
export const KnowledgeInput = z.object({
  kind: z.enum(["fact", "preference", "object", "person"]),
  title: text(100),
  content: text(2000),
  tags: z.array(text(40)).max(10).default([]),
  author: text(60).default("Caregiver"),
});
export type KnowledgeInput = z.infer<typeof KnowledgeInput>;
export interface Knowledge extends KnowledgeInput {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export const ReminderInput = z.object({
  title: text(140),
  dueAt: z.iso.datetime({ offset: true }),
  timezone: text(80),
});
export interface Reminder {
  id: string;
  title: string;
  dueAt: string;
  timezone: string;
  status: "scheduled" | "due" | "acknowledged";
  createdAt: string;
}
export const Preferences = z.object({
  proactive: z.boolean(),
  quietStart: z.number().int().min(0).max(23),
  quietEnd: z.number().int().min(0).max(23),
  speechRate: z.number().min(0.6).max(1.3),
  retentionDays: z.number().int().min(1).max(365),
});
export type Preferences = z.infer<typeof Preferences>;
export interface AIStatus {
  configured: boolean;
  source: "session" | "server" | null;
  model: string;
  sessionStorageAvailable: boolean;
}
export interface Example {
  id: string;
  label: string;
  note: string;
  group: string;
  split: "train" | "validation";
  task:
    | "object-description"
    | "text-reading"
    | "scene-description"
    | "reminiscence";
  createdAt: string;
}
export interface Trace {
  tool: string;
  status: string;
  detail: string;
}
export interface AgentResult {
  id: string;
  reply: string;
  actions: DomainAction[];
  sources: Knowledge[];
  trace: Trace[];
  revision: number;
  mode: "live" | "basic";
  model?: string;
  stale?: boolean;
}
