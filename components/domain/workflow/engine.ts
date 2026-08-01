/**
 * E11-S1 — the approval engine.
 *
 * Pure, deterministic, framework-free. Every rule the story states lives here
 * exactly once so that My Approvals, the chain designer, the WhatsApp channel
 * and the notification dispatcher cannot disagree about who may act, when a
 * request escalates, or which chain governs a request already in flight.
 *
 * Nothing in this module reads the clock, localStorage or the seed. `now` is
 * always passed in from `ds.meta.today` (PRD SD-8).
 */

import type * as T from "@/lib/schemas/entities";
import type { ApprovalRequestType, ApprovalStatus, Role } from "@/lib/schemas/enums";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { abbreviateINR, formatPercent } from "@/lib/format";

const HOUR = 3_600_000;

/* ------------------------------------------------------------ type metadata */

/**
 * A threshold band is read against different units depending on the request
 * type: a discount chain bands on percentage, a purchase order on rupees, a
 * leave request on nothing at all. Stating the basis on screen is what stops
 * "Discount up to 5%" from being silently compared against ₹14,50,000.
 */
export type BandBasis = "PERCENT" | "MONEY" | "NONE";

export interface RequestTypeMeta {
  label: string;
  /** Where the request originates, in the requester's language. */
  origin: string;
  basis: BandBasis;
  subjectEntity: string;
  /** Capability a viewer needs before the subject record may be opened. */
  subjectCapability: string;
}

export const REQUEST_TYPE_META: Record<ApprovalRequestType, RequestTypeMeta> = {
  QUOTATION_DISCOUNT: {
    label: "Quotation discount",
    origin: "Quotation builder — discount beyond the role's threshold",
    basis: "PERCENT",
    subjectEntity: "Quotation",
    subjectCapability: "quotations",
  },
  CREDIT_LIMIT_OVERRIDE: {
    label: "Credit limit override",
    origin: "Sales order or invoice blocked on credit exposure",
    basis: "MONEY",
    subjectEntity: "Customer",
    subjectCapability: "customers",
  },
  PURCHASE_ORDER: {
    label: "Purchase order",
    origin: "Purchase order raised above the delegated value",
    basis: "MONEY",
    subjectEntity: "Purchase order",
    subjectCapability: "purchaseOrders",
  },
  LEAVE: {
    label: "Leave request",
    origin: "Employee leave application",
    basis: "NONE",
    subjectEntity: "Leave request",
    subjectCapability: "leave",
  },
  EXPENSE_CLAIM: {
    label: "Expense claim",
    origin: "Field or office expense reimbursement",
    basis: "MONEY",
    subjectEntity: "Expense claim",
    subjectCapability: "employees",
  },
  STOCK_ADJUSTMENT: {
    label: "Stock adjustment",
    origin: "Physical count variance posted against the ledger",
    basis: "MONEY",
    subjectEntity: "Stock count",
    subjectCapability: "stock",
  },
  AMC_PRICING_EXCEPTION: {
    label: "AMC pricing exception",
    origin: "AMC renewal quoted away from the standard schedule",
    basis: "MONEY",
    subjectEntity: "AMC contract",
    subjectCapability: "amc",
  },
  RA_BILL_SUBMISSION: {
    label: "RA-bill submission",
    origin: "Running-account bill ready for client submission",
    basis: "MONEY",
    subjectEntity: "RA-bill",
    subjectCapability: "raBills",
  },
  PRICE_LIST_CHANGE: {
    label: "Price list change",
    origin: "Principal price list revision",
    basis: "PERCENT",
    subjectEntity: "Price list",
    subjectCapability: "items",
  },
  USER_ROLE_CHANGE: {
    label: "User role change",
    origin: "Administrator changing a user's role assignment",
    basis: "NONE",
    subjectEntity: "User",
    subjectCapability: "admin.users",
  },
};

export const REQUEST_TYPES = Object.keys(REQUEST_TYPE_META) as ApprovalRequestType[];

export function bandUnit(basis: BandBasis): string {
  return basis === "PERCENT" ? "%" : basis === "MONEY" ? "₹" : "—";
}

export function formatBandValue(value: number, basis: BandBasis): string {
  if (basis === "PERCENT") return formatPercent(value, 2);
  if (basis === "MONEY") return abbreviateINR(value);
  return String(value);
}

/**
 * Bands are half-open: `[min, max)`. `max = null` is unbounded. Publishing the
 * convention is what makes 0–5 / 5–10 / 10+ a contiguous set rather than a
 * three-way overlap, and it is stated on the designer screen.
 */
export function bandLabel(min: number, max: number | null, basis: BandBasis): string {
  if (basis === "NONE") return "All requests";
  if (max === null) return `${formatBandValue(min, basis)} and above`;
  return `${formatBandValue(min, basis)} – under ${formatBandValue(max, basis)}`;
}

export function inBand(value: number, min: number, max: number | null): boolean {
  return value >= min && (max === null || value < max);
}

/* ------------------------------------------------------- chain resolution */

export interface ResolvedChain {
  chain: T.ApprovalChain;
  steps: T.ApprovalChainStep[];
  resolvedSteps: T.ApprovalRequest["resolvedSteps"];
}

/**
 * AC: "the applicable chain is selected by request type and by the request's
 * value against the configured threshold bands, and the resolved chain is
 * recorded on the request so it cannot change retrospectively."
 *
 * The recording half is the caller's job — `raiseRequest` copies `resolvedSteps`
 * onto the request, and every later evaluation reads that copy, never the
 * live chain.
 */
export function resolveChain(
  chains: T.ApprovalChain[],
  steps: T.ApprovalChainStep[],
  type: ApprovalRequestType,
  value: number,
): ResolvedChain | null {
  const candidates = chains.filter((c) => c.requestType === type);
  if (candidates.length === 0) return null;

  const banded = candidates.find((c) => inBand(value, c.minValue, c.maxValue));
  // A value below every configured floor still needs an owner: the lowest band
  // takes it, rather than the request vanishing without an approver.
  const chain =
    banded ??
    [...candidates].sort((a, b) => a.minValue - b.minValue)[0]!;

  const chainSteps = steps
    .filter((s) => s.chainId === chain.id)
    .filter((s) => s.minValue === null && s.maxValue === null
      ? true
      : inBand(value, s.minValue ?? 0, s.maxValue))
    .sort((a, b) => a.order - b.order);

  return {
    chain,
    steps: chainSteps,
    resolvedSteps: chainSteps.map((s, i) => ({
      order: i + 1,
      approverRole: s.approverRole,
      escalationHours: s.escalationHours,
    })),
  };
}

/* --------------------------------------------------------- band validation */

export type BandIssueKind = "OVERLAP" | "GAP" | "FLOOR" | "UNBOUNDED" | "STEP_OUTSIDE" | "EMPTY";

export interface BandIssue {
  kind: BandIssueKind;
  message: string;
  chainIds: string[];
}

/**
 * E11-S3 AC: "validation blocks the save and states the specific overlap or gap".
 * Generic "invalid configuration" is not acceptable — each issue names the two
 * chains and the exact interval at fault.
 */
export function validateChainBands(
  chains: T.ApprovalChain[],
  steps: T.ApprovalChainStep[],
  type: ApprovalRequestType,
): BandIssue[] {
  const basis = REQUEST_TYPE_META[type].basis;
  const set = chains
    .filter((c) => c.requestType === type)
    .sort((a, b) => a.minValue - b.minValue);
  const issues: BandIssue[] = [];

  if (set.length === 0) {
    issues.push({
      kind: "EMPTY",
      message: `${REQUEST_TYPE_META[type].label} has no chain. Every request of this type would be raised with no approver.`,
      chainIds: [],
    });
    return issues;
  }

  for (const c of set) {
    if (steps.filter((s) => s.chainId === c.id).length === 0) {
      issues.push({
        kind: "EMPTY",
        message: `"${c.name}" has no steps. A chain with no step cannot route a request.`,
        chainIds: [c.id],
      });
    }
  }

  if (basis === "NONE") return issues;

  if (set[0]!.minValue > 0) {
    issues.push({
      kind: "FLOOR",
      message: `Gap below the first band: values from ${formatBandValue(0, basis)} up to ${formatBandValue(set[0]!.minValue, basis)} match no chain. Lower "${set[0]!.name}" to ${formatBandValue(0, basis)} or add a chain covering it.`,
      chainIds: [set[0]!.id],
    });
  }

  for (let i = 0; i < set.length - 1; i++) {
    const a = set[i]!;
    const b = set[i + 1]!;
    if (a.maxValue === null) {
      issues.push({
        kind: "OVERLAP",
        message: `"${a.name}" is unbounded (${formatBandValue(a.minValue, basis)} and above) yet "${b.name}" starts at ${formatBandValue(b.minValue, basis)}. Both chains claim every value from ${formatBandValue(b.minValue, basis)} upward.`,
        chainIds: [a.id, b.id],
      });
      continue;
    }
    if (a.maxValue > b.minValue) {
      issues.push({
        kind: "OVERLAP",
        message: `Overlap of ${formatBandValue(b.minValue, basis)} – ${formatBandValue(a.maxValue, basis)}: "${a.name}" ends at ${formatBandValue(a.maxValue, basis)} but "${b.name}" already starts at ${formatBandValue(b.minValue, basis)}.`,
        chainIds: [a.id, b.id],
      });
    } else if (a.maxValue < b.minValue) {
      issues.push({
        kind: "GAP",
        message: `Gap of ${formatBandValue(a.maxValue, basis)} – ${formatBandValue(b.minValue, basis)}: "${a.name}" ends at ${formatBandValue(a.maxValue, basis)} and "${b.name}" only begins at ${formatBandValue(b.minValue, basis)}. A request in that interval would resolve to no chain.`,
        chainIds: [a.id, b.id],
      });
    }
  }

  const last = set[set.length - 1]!;
  if (last.maxValue !== null) {
    issues.push({
      kind: "GAP",
      message: `Gap above the last band: "${last.name}" ends at ${formatBandValue(last.maxValue, basis)} and nothing covers values beyond it. Set its upper bound to unbounded or add a further chain.`,
      chainIds: [last.id],
    });
  }

  for (const c of set) {
    for (const s of steps.filter((x) => x.chainId === c.id)) {
      if (s.minValue === null && s.maxValue === null) continue;
      const sMin = s.minValue ?? 0;
      const sMax = s.maxValue;
      const outsideLow = sMin < c.minValue;
      const outsideHigh = c.maxValue !== null && (sMax === null || sMax > c.maxValue);
      if (outsideLow || outsideHigh) {
        issues.push({
          kind: "STEP_OUTSIDE",
          message: `Step ${s.order} of "${c.name}" bands ${bandLabel(sMin, sMax, basis)}, which reaches outside the chain's own band of ${bandLabel(c.minValue, c.maxValue, basis)}. A step cannot apply to values the chain never receives.`,
          chainIds: [c.id],
        });
      }
    }
  }

  return issues;
}

/* ------------------------------------------------------------- evaluation */

export type StepState =
  | "APPROVED"
  | "CURRENT"
  | "WAITING"
  | "REJECTED"
  | "RETURNED"
  | "NOT_REACHED";

export interface StepView {
  order: number;
  approverRole: Role;
  escalationHours: number;
  parallel: boolean;
  state: StepState;
  startedAt: string | null;
  dueAt: string | null;
  decision: T.ApprovalDecision | null;
}

export interface Evaluation {
  request: T.ApprovalRequest;
  /** The status after the escalation timer has been applied. */
  status: ApprovalStatus;
  persistedStatus: ApprovalStatus;
  terminal: boolean;
  steps: StepView[];
  currentStepOrder: number | null;
  currentStepRole: Role | null;
  stepStartedAt: string;
  stepDueAt: string;
  slaHours: number;
  ageMs: number;
  stepElapsedMs: number;
  remainingMs: number;
  overdue: boolean;
  escalated: boolean;
  escalatedAt: string | null;
  escalatedToRole: Role | null;
  /** Roles that may act right now: the current approver plus any escalation target. */
  actionableRoles: Role[];
  history: T.ApprovalDecision[];
}

const TERMINAL: ApprovalStatus[] = ["APPROVED", "REJECTED", "RETURNED", "WITHDRAWN"];

/**
 * Escalation ladder used when the current step is the last one in the chain —
 * there is no "next step" to escalate into, but authority must still move.
 */
const NEXT_AUTHORITY: Partial<Record<Role, Role>> = {
  SALES_EXECUTIVE: "BRANCH_MANAGER",
  FIELD_ENGINEER: "SERVICE_MANAGER",
  STORE_INCHARGE: "SERVICE_MANAGER",
  ACCOUNTS_EXECUTIVE: "DIRECTOR_BUSINESS",
  HR_ADMIN: "DIRECTOR_BUSINESS",
  SERVICE_MANAGER: "DIRECTOR_BUSINESS",
  PROJECT_MANAGER: "DIRECTOR_BUSINESS",
  BRANCH_MANAGER: "DIRECTOR_BUSINESS",
  DIRECTOR_BUSINESS: "DIRECTOR_STRATEGY",
  DIRECTOR_STRATEGY: "DIRECTOR_STRATEGY",
};

export function nextAuthority(role: Role): Role | null {
  return NEXT_AUTHORITY[role] ?? null;
}

/**
 * When a step began. Step 1 begins when the request is raised; step n begins
 * at the timestamp of the approval that advanced the request into it. This is
 * what makes the escalation clock per-step rather than per-request.
 */
export function stepStartedAt(
  request: T.ApprovalRequest,
  decisions: T.ApprovalDecision[],
  order: number,
): string {
  if (order <= 1) return request.raisedAt;
  const prior = decisions
    .filter((d) => d.requestId === request.id && d.stepOrder === order - 1 && d.decision === "APPROVED")
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  return prior?.at ?? request.raisedAt;
}

export function evaluate(
  request: T.ApprovalRequest,
  allDecisions: T.ApprovalDecision[],
  now: Date,
): Evaluation {
  const history = allDecisions
    .filter((d) => d.requestId === request.id)
    .sort((a, b) => a.at.localeCompare(b.at) || a.stepOrder - b.stepOrder);

  const persistedStatus = request.status;
  const terminal = TERMINAL.includes(persistedStatus);
  const defs = request.resolvedSteps.length
    ? request.resolvedSteps
    : [{ order: 1, approverRole: "DIRECTOR_BUSINESS" as Role, escalationHours: 24 }];

  const currentOrder = terminal ? null : Math.min(request.currentStep, defs.length);
  const currentDef = currentOrder ? defs.find((s) => s.order === currentOrder) ?? defs[currentOrder - 1]! : null;

  const startedIso = currentOrder ? stepStartedAt(request, allDecisions, currentOrder) : request.raisedAt;
  const started = new Date(startedIso).getTime();
  const slaHours = currentDef?.escalationHours ?? 0;
  const due = started + slaHours * HOUR;
  const stepElapsedMs = now.getTime() - started;
  const remainingMs = due - now.getTime();
  const overdue = !terminal && remainingMs <= 0;

  // AC: "Given a step's escalation timer elapses without a decision, When
  // escalation is evaluated, Then the request escalates to the next authority."
  // Escalation is derived from the clock, so it is true the moment it becomes
  // true — it does not wait for a background job that this prototype has not got.
  const escalated = !terminal && (persistedStatus === "ESCALATED" || overdue);
  const escalatedAt = escalated
    ? request.escalatedAt ?? new Date(due).toISOString()
    : null;

  let escalatedToRole: Role | null = null;
  if (escalated && currentDef) {
    const nextStep = defs.find((s) => s.order === currentDef.order + 1);
    escalatedToRole = nextStep?.approverRole ?? nextAuthority(currentDef.approverRole);
    if (escalatedToRole === currentDef.approverRole) escalatedToRole = nextAuthority(currentDef.approverRole);
  }

  const rejection = history.find((d) => d.decision === "REJECTED");
  const ret = history.find((d) => d.decision === "RETURNED");

  const steps: StepView[] = defs.map((def) => {
    const decision = history.find((d) => d.stepOrder === def.order) ?? null;
    let state: StepState;
    if (decision?.decision === "REJECTED") state = "REJECTED";
    else if (decision?.decision === "RETURNED") state = "RETURNED";
    else if (decision?.decision === "APPROVED") state = "APPROVED";
    else if (terminal) state = "NOT_REACHED";
    else if (def.order === currentOrder) state = "CURRENT";
    else if (currentOrder !== null && def.order < currentOrder) state = "APPROVED";
    else state = "WAITING";

    const sStart = def.order <= (currentOrder ?? defs.length)
      ? stepStartedAt(request, allDecisions, def.order)
      : null;
    return {
      order: def.order,
      approverRole: def.approverRole,
      escalationHours: def.escalationHours,
      parallel: false,
      state,
      startedAt: sStart,
      dueAt: sStart ? new Date(new Date(sStart).getTime() + def.escalationHours * HOUR).toISOString() : null,
      decision,
    };
  });

  const status: ApprovalStatus = terminal
    ? persistedStatus
    : escalated
      ? "ESCALATED"
      : "PENDING";

  const actionableRoles: Role[] = [];
  if (!terminal && currentDef) {
    actionableRoles.push(currentDef.approverRole);
    if (escalatedToRole && escalatedToRole !== currentDef.approverRole) actionableRoles.push(escalatedToRole);
  }

  return {
    request,
    status,
    persistedStatus,
    terminal,
    steps,
    currentStepOrder: currentOrder,
    currentStepRole: currentDef?.approverRole ?? null,
    stepStartedAt: startedIso,
    stepDueAt: new Date(due).toISOString(),
    slaHours,
    ageMs: now.getTime() - new Date(request.raisedAt).getTime(),
    stepElapsedMs,
    remainingMs,
    overdue,
    escalated,
    escalatedAt,
    escalatedToRole,
    actionableRoles,
    history: rejection || ret ? history : history,
  };
}

/* ---------------------------------------------------------- delegation */

export function activeDelegationFor(
  delegations: T.Delegation[],
  delegateUserId: string,
  at: Date,
): T.Delegation[] {
  const t = at.getTime();
  return delegations.filter(
    (d) =>
      d.delegateUserId === delegateUserId &&
      new Date(d.fromDate).getTime() <= t &&
      new Date(d.toDate).getTime() >= t,
  );
}

export function delegationsGrantedBy(
  delegations: T.Delegation[],
  approverUserId: string,
): T.Delegation[] {
  return delegations.filter((d) => d.approverUserId === approverUserId);
}

/* ------------------------------------------------------ decision rights */

export type DenyReason =
  | "OK"
  | "TERMINAL"
  | "NO_APPROVAL_AUTHORITY"
  | "NOT_THIS_STEP"
  | "ALREADY_ACTED_EARLIER_STEP"
  | "OWN_REQUEST"
  | "READ_ONLY"
  | "OVER_LIMIT";

export interface DecisionRights {
  canDecide: boolean;
  reason: DenyReason;
  /** The role that holds the authority — E11-S2 requires it be named. */
  authorityRole: Role | null;
  authorityUserName: string | null;
  viaDelegation: T.Delegation | null;
  delegatedForUserId: string | null;
  message: string;
}

export interface RightsInput {
  evaluation: Evaluation;
  viewer: {
    userId: string;
    role: Role;
    hasApprovalAuthority: boolean;
    approveLimit: number | null;
    readOnly: boolean;
  };
  users: { id: string; name: string; role: Role }[];
  delegations: T.Delegation[];
  now: Date;
  /** For QUOTATION_DISCOUNT the limit is read as a percentage, not rupees. */
  limitBasisValue?: number;
}

export function decisionRights(input: RightsInput): DecisionRights {
  const { evaluation: e, viewer, users, delegations, now } = input;
  const authorityRole = e.escalated && e.escalatedToRole ? e.escalatedToRole : e.currentStepRole;
  const holder = users.find((u) => u.role === authorityRole) ?? null;
  const named = authorityRole ? ROLE_LABEL[authorityRole] : "no configured approver";

  const base = {
    authorityRole,
    authorityUserName: holder?.name ?? null,
    viaDelegation: null as T.Delegation | null,
    delegatedForUserId: null as string | null,
  };

  if (e.terminal) {
    return {
      ...base,
      canDecide: false,
      reason: "TERMINAL",
      message: `This request is already ${e.persistedStatus.toLowerCase()}. The decision history below is retained in full and cannot be amended.`,
    };
  }

  if (viewer.readOnly) {
    return {
      ...base,
      canDecide: false,
      reason: "READ_ONLY",
      message: `Auditor access is read-only across the platform. Authority for this step rests with ${named}${holder ? ` (${holder.name})` : ""}.`,
    };
  }

  if (e.request.requesterUserId === viewer.userId) {
    return {
      ...base,
      canDecide: false,
      reason: "OWN_REQUEST",
      message: `You raised this request, so you cannot also decide it. It is with ${named}${holder ? ` (${holder.name})` : ""}.`,
    };
  }

  // Delegation — E11-S3: requests routed to the approver during the range are
  // *additionally* actionable by the delegate; the original approver keeps theirs.
  const active = activeDelegationFor(delegations, viewer.userId, now);
  const delegatedFrom = active.find((d) => {
    const principal = users.find((u) => u.id === d.approverUserId);
    return principal ? e.actionableRoles.includes(principal.role) : false;
  }) ?? null;

  const roleMatches = authorityRole !== null && e.actionableRoles.includes(viewer.role);

  if (!roleMatches && !delegatedFrom) {
    const actedEarlier = e.steps.some(
      (s) => s.approverRole === viewer.role && (s.state === "APPROVED" || s.decision?.decision === "APPROVED"),
    );
    if (actedEarlier) {
      return {
        ...base,
        canDecide: false,
        reason: "ALREADY_ACTED_EARLIER_STEP",
        message: `You already decided an earlier step of this sequential chain. Only ${named} may act at step ${e.currentStepOrder}; an earlier approver cannot re-decide.`,
      };
    }
    return {
      ...base,
      canDecide: false,
      reason: "NOT_THIS_STEP",
      message: `Step ${e.currentStepOrder} rests with ${named}${holder ? ` (${holder.name})` : ""}. It becomes actionable to you only if it escalates.`,
    };
  }

  if (!viewer.hasApprovalAuthority && !delegatedFrom) {
    return {
      ...base,
      canDecide: false,
      reason: "NO_APPROVAL_AUTHORITY",
      message: `Your role has data access to approvals but holds no approval authority. Authority for this request rests with ${named}${holder ? ` (${holder.name})` : ""}.`,
    };
  }

  if (viewer.approveLimit !== null && input.limitBasisValue !== undefined) {
    if (input.limitBasisValue > viewer.approveLimit) {
      const meta = REQUEST_TYPE_META[e.request.type];
      return {
        ...base,
        canDecide: false,
        reason: "OVER_LIMIT",
        message: `${ROLE_LABEL[viewer.role]} authority is capped at ${formatBandValue(viewer.approveLimit, meta.basis)}; this request is ${formatBandValue(input.limitBasisValue, meta.basis)}. It must be decided by ${named}.`,
      };
    }
  }

  return {
    ...base,
    canDecide: true,
    reason: "OK",
    viaDelegation: delegatedFrom,
    delegatedForUserId: delegatedFrom?.approverUserId ?? null,
    message: delegatedFrom
      ? `You may act as the nominated delegate of ${users.find((u) => u.id === delegatedFrom.approverUserId)?.name ?? "the approver"}. The decision will be recorded as delegated.`
      : e.escalated
        ? `Escalated to you as ${ROLE_LABEL[viewer.role]} after the step SLA elapsed.`
        : `You hold authority at step ${e.currentStepOrder}.`,
  };
}

/* ------------------------------------------------------------- mutation */

export interface DecisionInput {
  request: T.ApprovalRequest;
  evaluation: Evaluation;
  decision: "APPROVED" | "REJECTED" | "RETURNED";
  comment: string;
  channel: T.ApprovalDecision["channel"];
  actorUserId: string;
  onBehalfOfUserId: string | null;
  now: Date;
  decisionId: string;
}

export interface DecisionResult {
  decision: T.ApprovalDecision;
  patch: Partial<T.ApprovalRequest>;
  advancedToStep: number | null;
  finalStatus: ApprovalStatus;
  summary: string;
}

/** Rejection and return-for-clarification require a reason. Enforced here. */
export function reasonRequired(decision: "APPROVED" | "REJECTED" | "RETURNED"): boolean {
  return decision === "REJECTED" || decision === "RETURNED";
}

export function validateComment(
  decision: "APPROVED" | "REJECTED" | "RETURNED",
  comment: string,
): string | null {
  if (!reasonRequired(decision)) return null;
  const trimmed = comment.trim();
  if (trimmed.length === 0) {
    return decision === "REJECTED"
      ? "A rejection reason is mandatory. The requester sees this text."
      : "A clarification note is mandatory. The requester sees this text and acts on it.";
  }
  if (trimmed.length < 8) {
    return "Give the requester enough to act on — at least a short sentence.";
  }
  return null;
}

export function applyDecision(input: DecisionInput): DecisionResult {
  const { request, evaluation, decision, comment, channel, actorUserId, onBehalfOfUserId, now } = input;
  const at = now.toISOString();
  const stepOrder = evaluation.currentStepOrder ?? request.currentStep;
  const totalSteps = request.resolvedSteps.length || 1;

  const record: T.ApprovalDecision = {
    id: input.decisionId,
    requestId: request.id,
    stepOrder,
    approverUserId: actorUserId,
    onBehalfOfUserId,
    decision,
    comment: comment.trim(),
    channel,
    at,
  };

  if (decision === "APPROVED") {
    const isLast = stepOrder >= totalSteps;
    if (isLast) {
      return {
        decision: record,
        patch: { status: "APPROVED", decidedAt: at, escalatedAt: null, currentStep: stepOrder },
        advancedToStep: null,
        finalStatus: "APPROVED",
        summary: `Approved at final step ${stepOrder} of ${totalSteps}`,
      };
    }
    return {
      decision: record,
      patch: { status: "PENDING", currentStep: stepOrder + 1, escalatedAt: null, decidedAt: null },
      advancedToStep: stepOrder + 1,
      finalStatus: "PENDING",
      summary: `Approved at step ${stepOrder}; advanced to step ${stepOrder + 1}`,
    };
  }

  const finalStatus: ApprovalStatus = decision === "REJECTED" ? "REJECTED" : "RETURNED";
  return {
    decision: record,
    patch: { status: finalStatus, decidedAt: at, escalatedAt: null, currentStep: stepOrder },
    advancedToStep: null,
    finalStatus,
    summary:
      decision === "REJECTED"
        ? `Rejected at step ${stepOrder} — returned to requester with reason`
        : `Returned for clarification at step ${stepOrder} — reason visible to requester`,
  };
}

/* ------------------------------------------------------------ raising */

export interface RaiseInput {
  id: string;
  number: string;
  type: ApprovalRequestType;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  value: number;
  requesterUserId: string;
  branchId: string;
  chains: T.ApprovalChain[];
  steps: T.ApprovalChainStep[];
  now: Date;
  context: Record<string, string | number | boolean>;
}

export function raiseRequest(input: RaiseInput): T.ApprovalRequest | null {
  const resolved = resolveChain(input.chains, input.steps, input.type, input.value);
  if (!resolved) return null;
  return {
    id: input.id,
    number: input.number,
    type: input.type,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    subjectLabel: input.subjectLabel,
    value: input.value,
    requesterUserId: input.requesterUserId,
    branchId: input.branchId,
    resolvedChainId: resolved.chain.id,
    // Frozen at raise time. A later chain revision cannot reach back into it.
    resolvedSteps: resolved.resolvedSteps,
    currentStep: 1,
    status: "PENDING",
    raisedAt: input.now.toISOString(),
    decidedAt: null,
    escalatedAt: null,
    context: input.context,
  };
}

/* ------------------------------------------------- bulk inline validation */

export interface BulkCandidate {
  requestId: string;
  eligible: boolean;
  reason: string | null;
}

/**
 * E11-S2 AC: "each request is still recorded as an individual decision with its
 * own audit entry, and any request whose inline validation fails is excluded
 * from the bulk action with the reason shown."
 */
export function bulkEligibility(
  evaluations: Evaluation[],
  rightsFor: (e: Evaluation) => DecisionRights,
  chains: T.ApprovalChain[],
): BulkCandidate[] {
  return evaluations.map((e) => {
    const rights = rightsFor(e);
    if (!rights.canDecide) {
      return { requestId: e.request.id, eligible: false, reason: rights.message };
    }
    const chain = chains.find((c) => c.id === e.request.resolvedChainId);
    if (!chain) {
      return {
        requestId: e.request.id,
        eligible: false,
        reason: "The chain this request resolved to no longer exists. Re-resolve it before deciding in bulk.",
      };
    }
    if (e.request.resolvedSteps.length === 0) {
      return {
        requestId: e.request.id,
        eligible: false,
        reason: "No approval steps were recorded on this request when it was raised.",
      };
    }
    return { requestId: e.request.id, eligible: true, reason: null };
  });
}

/* ----------------------------------------------------------- presentation */

export type SlaTone = "comfortable" | "approaching" | "imminent" | "breached";

export function slaTone(e: Evaluation): SlaTone {
  if (e.terminal) return "comfortable";
  if (e.remainingMs <= 0) return "breached";
  const total = e.slaHours * HOUR;
  const frac = total > 0 ? e.remainingMs / total : 1;
  if (frac < 0.1) return "imminent";
  if (frac < 0.25) return "approaching";
  return "comfortable";
}

export function ageHours(e: Evaluation): number {
  return e.ageMs / HOUR;
}

export function describeSla(e: Evaluation): string {
  const elapsed = Math.max(0, Math.round(e.stepElapsedMs / HOUR));
  if (e.terminal) return `Closed after ${Math.round(e.ageMs / HOUR)} h`;
  if (e.remainingMs <= 0) {
    return `${elapsed} h on step · ${Math.abs(Math.round(e.remainingMs / HOUR))} h past the ${e.slaHours} h SLA`;
  }
  return `${elapsed} h on step · ${Math.round(e.remainingMs / HOUR)} h of the ${e.slaHours} h SLA remaining`;
}

export const STATUS_TONE: Record<ApprovalStatus, "ok" | "warn" | "danger" | "info" | "neutral"> = {
  PENDING: "info",
  APPROVED: "ok",
  REJECTED: "danger",
  RETURNED: "warn",
  ESCALATED: "danger",
  WITHDRAWN: "neutral",
};
