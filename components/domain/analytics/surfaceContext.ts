import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Dataset } from "@/lib/schemas";
import * as D from "@/lib/derive";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE, type Session } from "@/lib/rbac/session";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import type { Capability } from "@/lib/rbac/matrix";
import { formatDateTime } from "@/lib/format";
import {
  BASIS_IN_WORDS, comparisonPeriod, parseBasisKey, parsePeriodKey, resolvePeriod, resolveScope, scopeDataset,
  type AnalyticsScope, type BasisKey, type PeriodKey, type ResolvedPeriod,
} from "./scope";
import type { KpiInput } from "./kpiRegistry";
import type { Provenance } from "./exportUtils";

/**
 * The five surfaces share one assembly step: read the session, resolve the
 * three header controls, filter the world to the scope, and hand the result to
 * the unchanged formulas. Doing this once is what makes "the same KPI on two
 * surfaces is identical to the last displayed digit" structurally true.
 */

export interface SurfaceContext {
  session: Session;
  /** Unscoped world — used only where a position is deliberately company-wide. */
  full: Dataset;
  /** Scoped world — what every formula on the surface is fed. */
  ds: Dataset;
  ctx: D.DeriveCtx;
  now: Date;
  period: ResolvedPeriod;
  periodKey: PeriodKey;
  basis: BasisKey;
  basisInWords: string;
  comparison: { period: ResolvedPeriod; basisInWords: string } | null;
  scope: AnalyticsScope;
  kpiInput: KpiInput;
  provenance: Provenance;
}

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export async function buildSurfaceContext(
  surfaceName: string,
  cap: Capability,
  searchParams: SearchParams,
): Promise<SurfaceContext> {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const full = getDataset();
  const now = new Date(full.meta.today);

  const periodKey = parsePeriodKey(first(searchParams.period));
  const basis = parseBasisKey(first(searchParams.basis));
  const period = resolvePeriod(periodKey, now);
  const scope = resolveScope(full, session, cap, first(searchParams.branch));
  const ds = scopeDataset(full, scope);
  const ctx: D.DeriveCtx = { ds, now };

  const cmpPeriod = comparisonPeriod(basis, period);
  const comparison = cmpPeriod ? { period: cmpPeriod, basisInWords: BASIS_IN_WORDS[basis] } : null;

  return {
    session,
    full,
    ds,
    ctx,
    now,
    period,
    periodKey,
    basis,
    basisInWords: BASIS_IN_WORDS[basis],
    comparison,
    scope,
    kpiInput: { ds, ctx, period, scope },
    provenance: {
      surface: surfaceName,
      periodLabel: period.label,
      periodRange: period.rangeLabel,
      scopeStatement: scope.statement,
      branchLabel: scope.branchLabel,
      basisInWords: BASIS_IN_WORDS[basis],
      filters: scope.filters,
      generatedAt: `${formatDateTime(now)} IST`,
      generatedBy: `${session.name} (${ROLE_LABEL[session.role]})`,
      simulatedClock: `${formatDateTime(now)} IST — simulated platform clock`,
    },
  };
}
