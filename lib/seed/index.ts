import { generate, SEED, TODAY_ISO, TARGETS } from "./generate";
import type { Dataset } from "../schemas";

export { SEED, TODAY_ISO, TARGETS, generate };

let cached: Dataset | null = null;

/**
 * The single seeded world. SD-1: the same seed produces the same dataset on
 * every call, so demonstrations are reproducible.
 */
export function getDataset(): Dataset {
  if (!cached) cached = generate(SEED, TODAY_ISO);
  return cached;
}

/** Demo Controls — reset to the seeded baseline (E14-S6). */
export function resetDataset(): Dataset {
  cached = generate(SEED, TODAY_ISO);
  return cached;
}

/** Demo Controls — advance the simulated clock; all derived state recomputes. */
export function setSimulatedToday(todayIso: string): Dataset {
  const ds = getDataset();
  ds.meta.today = todayIso;
  return ds;
}
