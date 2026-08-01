/**
 * Deterministic pseudo-randomness. SD-1 / FR-M13-06: a fixed seed must produce
 * an identical dataset on every build, in the same order, with the same ids.
 * Nothing here may call Date.now() or Math.random().
 */

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** mulberry32 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number, decimals = 2): number {
    const v = min + this.next() * (max - min);
    const p = 10 ** decimals;
    return Math.round(v * p) / p;
  }

  bool(pTrue = 0.5): boolean {
    return this.next() < pTrue;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("pick() from empty array");
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Weighted pick. weights need not sum to 1. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r <= 0) return v;
    }
    return entries[entries.length - 1]![0];
  }

  /** Fisher-Yates on a copy. */
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  }

  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, Math.min(n, arr.length));
  }

  /** Roughly normal via sum of three uniforms, clamped. */
  around(mean: number, spreadPct: number): number {
    const u = (this.next() + this.next() + this.next()) / 3;
    return mean * (1 + (u - 0.5) * 2 * spreadPct);
  }
}

/**
 * Split `total` into `n` positive parts that sum to EXACTLY `total`.
 * This is the primitive that makes SD-2 reconciliation true by construction
 * rather than by rounding luck: the last part absorbs the residue.
 */
export function allocateExact(rng: Rng, total: number, n: number, spread = 0.55): number[] {
  if (n <= 0) return [];
  if (n === 1) return [round2(total)];

  const weights: number[] = [];
  for (let i = 0; i < n; i++) weights.push(1 + rng.next() * spread * 2);
  const wSum = weights.reduce((a, b) => a + b, 0);

  const parts: number[] = [];
  let running = 0;
  for (let i = 0; i < n - 1; i++) {
    const raw = (total * weights[i]!) / wSum;
    const v = round2(raw);
    parts.push(v);
    running = round2(running + v);
  }
  parts.push(round2(total - running));
  return parts;
}

/** Same, but every part is a whole rupee. Used where paise would look wrong. */
export function allocateExactWhole(rng: Rng, total: number, n: number, spread = 0.55): number[] {
  if (n <= 0) return [];
  if (n === 1) return [Math.round(total)];
  const weights: number[] = [];
  for (let i = 0; i < n; i++) weights.push(1 + rng.next() * spread * 2);
  const wSum = weights.reduce((a, b) => a + b, 0);

  const parts: number[] = [];
  let running = 0;
  for (let i = 0; i < n - 1; i++) {
    const v = Math.max(1, Math.round((total * weights[i]!) / wSum));
    parts.push(v);
    running += v;
  }
  parts.push(Math.round(total - running));
  return parts;
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function sum(values: readonly number[]): number {
  return round2(values.reduce((a, b) => a + b, 0));
}

/** Stable, readable, collision-free ids. */
export function id(prefix: string, n: number, width = 4): string {
  return `${prefix}-${String(n).padStart(width, "0")}`;
}

/** Deterministic hash → hex, for mock IRN / EBN / signatures. */
export function hashHex(input: string, length: number): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  let out = "";
  let a = h1, b = h2;
  while (out.length < length) {
    a = Math.imul(a ^ (a >>> 13), 0x5bd1e995) >>> 0;
    b = Math.imul(b ^ (b >>> 11), 0xc2b2ae35) >>> 0;
    out += (a ^ b).toString(16).padStart(8, "0");
  }
  return out.slice(0, length);
}

export function hashDigits(input: string, length: number): string {
  const hex = hashHex(input, Math.max(length * 2, 16));
  let out = "";
  for (let i = 0; i < hex.length && out.length < length; i++) {
    const v = parseInt(hex[i]!, 16);
    out += String(v % 10);
  }
  return out.padEnd(length, "0").slice(0, length);
}
