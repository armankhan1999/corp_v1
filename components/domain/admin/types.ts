import type { AuditAction, Role } from "@/lib/schemas/enums";

/**
 * Server → client row contracts for the Admin epic (E1-S5 … E1-S9).
 * Pages are server components that read the seeded dataset once and hand these
 * plain shapes to the client surfaces, which then layer the localStorage
 * overlay on top. The seed object is never mutated.
 */

/* ------------------------------------------------------------- E1-S6 audit */

export interface AuditRow {
  id: string;
  seq: number;
  actorUserId: string;
  actorName: string;
  actorRole: Role;
  impersonatedBy: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  summary: string;
  before: string | null;
  after: string | null;
  at: string;
  ip: string;
}

export interface AuditFacets {
  actors: { id: string; name: string; role: Role }[];
  roles: Role[];
  actions: AuditAction[];
  entityTypes: string[];
  earliest: string;
  latest: string;
}

/* ----------------------------------------------------------- E1-S7 masters */

export type MasterValue = string | number | boolean | null;

export interface MasterField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  options?: { value: string; label: string }[];
  mono?: boolean;
  suffix?: string;
  required?: boolean;
  /** Seeded identity columns stay fixed so references cannot be orphaned. */
  readOnly?: boolean;
  help?: string;
  numeric?: boolean;
  min?: number;
  max?: number;
  step?: number;
  hideInTable?: boolean;
}

export interface MasterRow {
  id: string;
  values: Record<string, MasterValue>;
  /** How many existing records point at this value. Blocks deletion. */
  refCount: number;
  /** Plain-language description of what references it. */
  refLabel: string;
  active: boolean;
  /** Structural rows the platform itself depends on — never deletable. */
  system?: boolean;
}

export interface MasterSet {
  key: string;
  label: string;
  group: string;
  description: string;
  /** The field whose value names the row in confirmations and audit entries. */
  labelField: string;
  fields: MasterField[];
  rows: MasterRow[];
  canCreate: boolean;
  entityType: string;
  note?: string;
  /** Extra panel rendered under the table for sets that need one. */
  kind?: "plain" | "numbering" | "sla";
}

export interface SeriesState {
  id: string;
  docType: string;
  prefix: string;
  fySegment: string;
  width: number;
  /** Numbers already consumed in the seeded data. */
  issuedCount: number;
  highest: number;
  gaps: number[];
  duplicates: number[];
  nextPreview: string;
}

/* ------------------------------------------------------------ users screen */

export interface UserRow {
  id: string;
  name: string;
  role: Role;
  branchId: string;
  email: string;
  phone: string;
  designation: string;
  active: boolean;
  employeeId: string | null;
  /** Audit entries attributed to this user — the "referenced by" count. */
  activityCount: number;
  isSelf: boolean;
}

/* ------------------------------------------------------ E1-S9 compliance */

export type DsrType = "ACCESS" | "CORRECTION" | "ERASURE" | "WITHDRAW_CONSENT" | "GRIEVANCE";
export type DsrStatus = "RECEIVED" | "IN_PROGRESS" | "CLOSED";

export interface DsrRow {
  id: string;
  number: string;
  requestType: DsrType;
  requester: string;
  receivedOn: string;
  status: DsrStatus;
  closedOn: string | null;
  note: string;
}

export interface RetentionRow {
  id: string;
  entityClass: string;
  retentionMonths: number;
  basis: string;
  /** Live record count in the seeded world, so retention has a subject. */
  recordCount: number;
}

/* ------------------------------------------------------- shared session bit */

export interface ActorInfo {
  userId: string;
  name: string;
  role: Role;
  branchId: string;
  impersonatedBy: string | null;
}
