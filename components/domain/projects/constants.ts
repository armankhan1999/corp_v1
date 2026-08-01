/** Statuses that count as a live project across E6. Shared by client and server. */
export const LIVE_STATE_LIST: string[] = ["MOBILISED", "IN_PROGRESS", "COMMISSIONING"];

/** Trades offered in the DPR manpower capture. */
export const DPR_TRADES = [
  "Mason", "Fitter", "Welder", "Helper", "Electrician", "Rigger", "Carpenter", "Bar bender", "Operator",
] as const;

/** Plant and machinery offered in the DPR capture. */
export const DPR_PLANT = [
  "Excavator", "Concrete mixer", "Welding set", "Crane 12T", "Vibrator", "Dewatering pump",
  "Tractor trolley", "Compressor", "Hydra 14T",
] as const;

export const DPR_WEATHER = [
  "Clear", "Hot and humid", "Intermittent rain", "Overcast", "Heavy rain",
] as const;

export const CONTRACT_TYPES = [
  "Item rate", "EPC lump sum", "Item rate with price variation", "Percentage rate", "Turnkey",
] as const;
