/**
 * The simulated clock's date arithmetic, kept in its own module with no heavy
 * imports so both the server page and the client surface can use it without
 * dragging the derive layer or the seed catalog into the browser bundle.
 *
 * These produce URL and storage keys, never display strings — everything shown
 * to a user goes through `@/lib/format`.
 */

/** Replaces the date portion of the seeded timestamp, keeping time-of-day and the IST offset. */
export function composeSimulatedIso(seededIso: string, date: string): string {
  return `${date}${seededIso.slice(10)}`;
}

export function dateOnly(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Accepts only a plain YYYY-MM-DD that resolves to a real calendar date. */
export function parseDateOnly(raw: string | undefined | null): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return dateOnly(d) === raw ? raw : null;
}
