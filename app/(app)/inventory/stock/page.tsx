import { StockClient, type StateFilter } from "@/components/domain/inventory/StockClient";

export const dynamic = "force-dynamic";

const STATES: StateFilter[] = ["ALL", "IN_STOCK", "BELOW_REORDER", "OUT_OF_STOCK", "NON_MOVING"];

/**
 * E7-S2 / E7-S6 — balances as the sum of an append-only ledger, per location,
 * plus the non-moving report on a configurable trailing period.
 */
export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const rawState = (one(sp.state) ?? "ALL").toUpperCase().replace(/-/g, "_") as StateFilter;
  const state: StateFilter = STATES.includes(rawState) ? rawState : "ALL";
  const trailing = Number(one(sp.trailing));

  return (
    <StockClient
      initialState={state}
      initialLocation={one(sp.location) ?? ""}
      initialQuery={one(sp.q) ?? ""}
      initialTrailing={Number.isFinite(trailing) && trailing > 0 ? trailing : 180}
    />
  );
}
