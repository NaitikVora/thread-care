import { z } from "zod";
export const SessionPolicy = z.object({
  intervalSeconds: z
    .union([z.literal(30), z.literal(60), z.literal(120), z.literal(300)])
    .default(120),
  retainFrames: z.boolean().default(false),
  retainTranscript: z.boolean().default(false),
  retentionDays: z
    .union([z.literal(1), z.literal(7), z.literal(30)])
    .default(7),
  cloudConsent: z.literal(true),
  voiceConsent: z.boolean().default(false),
});
export type SessionPolicy = z.infer<typeof SessionPolicy>;
export const StartSession = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(120),
  policy: SessionPolicy,
});
export const Observation = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(1200),
  category: z.enum([
    "objects",
    "reading",
    "activity",
    "connection",
    "place",
    "moment",
  ]),
  tags: z.array(z.string().max(40)).max(8),
  objects: z
    .array(
      z.object({ name: z.string().max(80), location: z.string().max(180) }),
    )
    .max(8),
  visibleText: z.string().max(1000),
  uncertainty: z.string().max(400),
});
export type Observation = z.infer<typeof Observation>;
export const PersonInput = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).default(""),
  author: z.string().trim().min(1).max(80),
  photo: z.string().optional(),
  consent: z.literal(true),
});
export interface DiarySession {
  id: string;
  title: string;
  status: "active" | "paused" | "ended" | "interrupted";
  source: string;
  policy: SessionPolicy;
  startedAt: string;
  heartbeatAt: string;
  endedAt: string | null;
}
export interface DiaryEvent {
  id: string;
  sessionId: string | null;
  kind: "camera" | "note" | "conversation" | "person";
  status: "analyzing" | "ready" | "failed";
  review: "unreviewed" | "confirmed" | "corrected";
  title: string;
  summary: string;
  category: string;
  tags: string[];
  details: Record<string, any>;
  hasImage: boolean;
  error: string | null;
  revision: number;
  capturedAt: string;
  receivedAt: string;
  expiresAt: string;
}
export interface TrustedPerson {
  id: string;
  name: string;
  relationship: string;
  description: string;
  author: string;
  hasPhoto: boolean;
  revision: number;
  updatedAt: string;
}
export interface CurrentEncounter {
  id: string;
  person: TrustedPerson;
  observationId: string | null;
  confirmedAt: string;
  validUntil: string;
  basis: "patient-confirmed";
}
export interface LiveContext {
  sessionId: string;
  currentEncounter: CurrentEncounter | null;
  latestObservation: DiaryEvent | null;
  observationAgeSeconds: number | null;
  identityMode: "patient-confirmation";
  notice: string;
}
