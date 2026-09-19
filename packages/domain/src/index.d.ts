import type { State, DomainAction, Routine } from "../../contracts/src/index";
export const STORAGE_KEY: string;
export const DEFAULT_ROUTINES: Routine[];
export function createState(): State;
export function restoreState(raw: string | null): State;
export function transition(
  previous: State,
  action: DomainAction,
  at?: string,
): { state: State; reply: string };
export function replyTo(
  previous: State,
  text: string,
  at?: string,
): { state: State; reply: string };
export function recall(state: State): string;
export function routineContext(
  state: State,
): {
  routine: Routine;
  step: string;
  status: "active" | "paused" | "completed";
} | null;
export function objectKey(value: string): string;
