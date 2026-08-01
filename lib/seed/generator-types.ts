import type * as T from "../schemas/entities";
import type { StockLocation } from "../schemas/entities";

/**
 * Shared generator contracts.
 *
 * These lived in generate-part2 and generate-part3 respectively, which made the
 * two files reference each other — part2 imported a value from part3 while
 * part3 imported types back from part2. TypeScript erased the type edge, but
 * the production bundle still tripped over the cycle and every render that
 * touched getDataset() failed with `a[d] is not a function` from the webpack
 * runtime. Hoisting the contracts here makes the dependency one-directional.
 */

export interface GenContext {
  machineItems: T.Item[];
  spareItems: T.Item[];
  serviceItems: T.Item[];
  custById: Map<string, T.Customer>;
  sitesByCustomer: Map<string, T.Site[]>;
  institutionalIds: Set<string>;
  fieldEngineers: T.Employee[];
  liveAmcs: T.AMCContract[];
  amcByAsset: Map<string, T.AMCContract>;
  inWarranty: T.InstalledAsset[];
  users: {
    uDB: T.User; uSM: T.User; uAC: T.User; uPM: T.User; uST: T.User;
    uSE: T.User; uHR: T.User; uBM: T.User; uSA: T.User;
  };
  cw: StockLocation;
  HISTORY_DAYS: number;
}

export interface Helpers {
  iso: (d: Date) => string;
  daysAgo: (n: number, h?: number, m?: number) => Date;
  shift: (base: Date, days: number, hours?: number) => Date;
  between: (from: Date, to: Date) => Date;
  fullName: () => string;
  addMonths: (d: Date, m: number) => Date;
  custById: Map<string, T.Customer>;
  itemById: Map<string, T.Item>;
  assetById: Map<string, T.InstalledAsset>;
  branchIds: string[];
  fyStart2526: Date;
  fyEnd2526: Date;
  fy2627Start: Date;
  serviceCriticalItems: T.Item[];
  partsAwaitedItems: Set<string>;
  allocateProportionalCapped: (total: number, weights: number[]) => number[];
}
