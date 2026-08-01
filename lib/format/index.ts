/**
 * Indian formatting — the single utility. NFR-23, PRD §11.7, DoD #7.
 * Nothing in a component may hand-format a number, a date or an identifier.
 */

export const IST_OFFSET_MIN = 330;

/* ------------------------------------------------------------------ money */

/** Indian digit grouping: 2-2-3 from the right. 18245600 -> "1,82,45,600" */
export function groupIndian(value: number): string {
  const neg = value < 0;
  const [intPart, fracPart] = Math.abs(value).toFixed(2).split(".");
  let out: string;
  if (intPart.length <= 3) {
    out = intPart;
  } else {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    out = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  const frac = fracPart === "00" ? "" : "." + fracPart;
  return (neg ? "-" : "") + out + frac;
}

/** Full-precision rupees, for documents and tooltips. ₹1,82,45,600 */
export function formatINR(value: number, opts?: { paise?: boolean }): string {
  const neg = value < 0;
  const abs = Math.abs(value);
  const [i, f] = abs.toFixed(2).split(".");
  let intOut: string;
  if (i.length <= 3) intOut = i;
  else intOut = i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + i.slice(-3);
  const frac = opts?.paise ? "." + f : "";
  return `${neg ? "-" : ""}₹${intOut}${frac}`;
}

const LAKH = 100_000;
const CRORE = 10_000_000;

function trim1(n: number): string {
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/**
 * Abbreviated rupees for metrics, axes and cards. PRD §11.7:
 *   below ₹1 L  -> full figure with Indian grouping
 *   ₹1 L–99.99 L -> lakh, up to 1 decimal
 *   ≥ ₹1 Cr      -> crore, 2 decimals
 */
export function abbreviateINR(value: number): string {
  const neg = value < 0;
  const abs = Math.abs(value);
  let body: string;
  if (abs >= CRORE) body = `₹${(abs / CRORE).toFixed(2)} Cr`;
  else if (abs >= LAKH) body = `₹${trim1(abs / LAKH)} L`;
  else body = formatINR(abs);
  return (neg ? "-" : "") + body;
}

/** Compact axis label. Same thresholds, tighter. */
export function axisINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= CRORE) return `${sign}₹${trim1(abs / CRORE)}Cr`;
  if (abs >= LAKH) return `${sign}₹${Math.round(abs / LAKH)}L`;
  if (abs >= 1000) return `${sign}₹${Math.round(abs / 1000)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

/** Rupees in words, for the statutory "Amount in words" block on invoices. */
export function inrInWords(value: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const two = (n: number): string =>
    n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
  const three = (n: number): string =>
    n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? " " + two(n % 100) : ""}` : two(n);

  const rupees = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Rupees Zero Only";

  const crore = Math.floor(rupees / CRORE);
  const lakh = Math.floor((rupees % CRORE) / LAKH);
  const thousand = Math.floor((rupees % LAKH) / 1000);
  const rest = rupees % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (rest) parts.push(three(rest));

  let out = `Rupees ${parts.join(" ")}`;
  if (paise) out += ` and ${two(paise)} Paise`;
  return out + " Only";
}

/* ------------------------------------------------------------------ dates */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** DD MMM YYYY — 31 Jul 2026 */
export function formatDate(value: Date | string | number): string {
  const d = toDate(value);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** DD MMM YYYY, HH:mm — IST implied */
export function formatDateTime(value: Date | string | number): string {
  const d = toDate(value);
  return `${formatDate(d)}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** HH:mm only */
export function formatTime(value: Date | string | number): string {
  const d = toDate(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Relative for recency under 24h, absolute beyond. PRD §11.7 */
export function formatRelative(value: Date | string | number, now: Date): string {
  const d = toDate(value);
  const diffMs = now.getTime() - d.getTime();
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.floor(abs / 60000);
  if (mins < 1) return "just now";
  if (abs < 86_400_000) {
    const label = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h`;
    return future ? `in ${label}` : `${label} ago`;
  }
  return formatDate(d);
}

/** Whole days between two dates, calendar-aligned (ignores time of day). */
export function daysBetween(from: Date | string | number, to: Date | string | number): number {
  const a = toDate(from), b = toDate(to);
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

export function addDays(value: Date | string | number, days: number): Date {
  const d = new Date(toDate(value).getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(value: Date | string | number, months: number): Date {
  const d = new Date(toDate(value).getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export function addHours(value: Date | string | number, hours: number): Date {
  return new Date(toDate(value).getTime() + hours * 3_600_000);
}

/** Indian financial year label — April to March. FY 2026-27 */
export function financialYear(value: Date | string | number): string {
  const d = toDate(value);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function financialYearBounds(value: Date | string | number): { start: Date; end: Date } {
  const d = toDate(value);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    start: new Date(startYear, 3, 1, 0, 0, 0, 0),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
}

/** Short numbering-series FY segment: 2026-27 -> "2627" */
export function fySeriesSegment(value: Date | string | number): string {
  const d = toDate(value);
  const startYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(startYear % 100).padStart(2, "0")}${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Remaining/overrun clock for SLA display: mono HH:MM */
export function formatDurationHM(ms: number): string {
  const abs = Math.abs(ms);
  const totalMin = Math.floor(abs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Human elapsed for breach overrun: "26h 12m over" */
export function formatOverrun(ms: number): string {
  const totalMin = Math.floor(Math.abs(ms) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* -------------------------------------------------------------- quantities */

/** Up to 3 decimals, trailing zeros trimmed to at least 0 places, unit suffixed. */
export function formatQty(value: number, unit?: string): string {
  const s = value.toFixed(3).replace(/\.?0+$/, "");
  const grouped = groupIndian(Number(s)).replace(/\.00$/, "");
  const withDec = s.includes(".") ? s : grouped;
  return unit ? `${withDec} ${unit}` : withDec;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(/\.0$/, "")}%`;
}

export function formatCount(value: number): string {
  return groupIndian(value).replace(/\.\d+$/, "");
}

/* ------------------------------------------------------------ identifiers */

/** +91 9XXXX XXXXX */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return raw;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGSTIN(value: string): boolean {
  return GSTIN_RE.test(value.toUpperCase().trim());
}

/** State code is the first two digits of a GSTIN. Bihar = 10. */
export function gstinStateCode(value: string): string | null {
  const v = value.toUpperCase().trim();
  return /^[0-9]{2}/.test(v) ? v.slice(0, 2) : null;
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export function isValidPAN(value: string): boolean {
  return PAN_RE.test(value.toUpperCase().trim());
}

/* ------------------------------------------------------------------ misc */

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Enum token -> readable label. AWAITING_PARTS -> "Awaiting parts" */
export function enumLabel(value: string): string {
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? singular + "s");
}
