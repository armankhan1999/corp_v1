/**
 * E2-S4 — acknowledgement state for the exception feed.
 *
 * Exceptions are derived, not stored: the row for a breached SLA exists because
 * the clock says so, and disappears when the ticket is restored. What *is*
 * stored is the human response to it — acknowledged, assigned, snoozed — keyed
 * by the stable exception id. Held in module scope for the prototype; in Phase 2
 * this is a table, and the shape below is the column list.
 */

export type ExceptionLifecycle = "OPEN" | "ACKNOWLEDGED" | "ASSIGNED" | "SNOOZED";

export interface ExceptionStateEntry {
  state: ExceptionLifecycle;
  atIso: string;
  byUserId: string;
  byName: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  snoozeUntilIso: string | null;
  note: string | null;
}

const store = new Map<string, ExceptionStateEntry>();

export function readState(id: string): ExceptionStateEntry | undefined {
  return store.get(id);
}

export function writeState(id: string, entry: ExceptionStateEntry): void {
  store.set(id, entry);
}

export function snapshot(): Map<string, ExceptionStateEntry> {
  return new Map(store);
}

/**
 * A snooze that has run out returns the item to the feed — E2-S4 requires
 * snoozed items to come back after the chosen interval.
 */
export function effectiveState(entry: ExceptionStateEntry | undefined, now: Date): ExceptionLifecycle {
  if (!entry) return "OPEN";
  if (entry.state === "SNOOZED") {
    if (!entry.snoozeUntilIso) return "OPEN";
    return new Date(entry.snoozeUntilIso) > now ? "SNOOZED" : "OPEN";
  }
  return entry.state;
}

/** Unacknowledged = still demanding attention. Drives the header count. */
export function isOutstanding(entry: ExceptionStateEntry | undefined, now: Date): boolean {
  const s = effectiveState(entry, now);
  return s === "OPEN" || s === "ASSIGNED";
}

export const SNOOZE_OPTIONS: { value: string; label: string; hours: number }[] = [
  { value: "4h", label: "4 hours", hours: 4 },
  { value: "1d", label: "1 day", hours: 24 },
  { value: "3d", label: "3 days", hours: 72 },
  { value: "7d", label: "7 days", hours: 168 },
];

export function snoozeUntil(value: string, now: Date): Date {
  const opt = SNOOZE_OPTIONS.find((o) => o.value === value) ?? SNOOZE_OPTIONS[1]!;
  return new Date(now.getTime() + opt.hours * 3_600_000);
}

export const LIFECYCLE_LABEL: Record<ExceptionLifecycle, string> = {
  OPEN: "Open",
  ACKNOWLEDGED: "Acknowledged",
  ASSIGNED: "Assigned",
  SNOOZED: "Snoozed",
};
