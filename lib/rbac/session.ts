import type { Role } from "../schemas/enums";
import { DEFAULT_DENSITY, DEFAULT_THEME, LANDING_ROUTE } from "./matrix";

/**
 * Session model. FR-M1-01 keeps state in localStorage, but NFR-19 / AR-4 / RBAC-1
 * require a route handler to deny a guessed URL server-side — and a handler
 * cannot read localStorage. Per PLAN.md conflict C-06 the session is therefore
 * mirrored into a cookie, and AR-6 is amended to permit exactly that one cookie.
 */

export const SESSION_COOKIE = "pravaah.v1.session";
export const STORAGE_NAMESPACE = "pravaah.v1";
export const SCHEMA_VERSION = 1;
/** FR-M1-20 — inactivity returns the user to login with a resumable notice. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface Session {
  v: number;
  userId: string;
  role: Role;
  branchId: string;
  name: string;
  /** Set when a Super Admin is viewing as another role (FR-M1-03, RBAC-7). */
  impersonatedFrom?: { userId: string; role: Role; name: string } | null;
  theme: "dark" | "light";
  density: "compact" | "comfortable";
  branchScope: string | "ALL";
  issuedAt: number;
  lastSeenAt: number;
}

export function newSession(user: {
  id: string; role: Role; branchId: string; name: string;
}, at: number): Session {
  return {
    v: SCHEMA_VERSION,
    userId: user.id, role: user.role, branchId: user.branchId, name: user.name,
    impersonatedFrom: null,
    theme: DEFAULT_THEME[user.role],
    density: DEFAULT_DENSITY[user.role],
    branchScope: "ALL",
    issuedAt: at, lastSeenAt: at,
  };
}

export function encodeSession(s: Session): string {
  return encodeURIComponent(JSON.stringify(s));
}

/**
 * The 12 valid roles, written out rather than derived.
 *
 * This was `new Set(Object.keys(LANDING_ROUTE))`, which reads better but
 * evaluates at module scope against a binding owned by another module. Module
 * initialisation order is the bundler's to decide, and a throw at module scope
 * in middleware is not catchable by the handler below — it surfaces as
 * `MIDDLEWARE_INVOCATION_FAILED`, taking down every route at once. This project
 * has already lost a production bundle to exactly that class of bug (see
 * `lib/seed/generator-types.ts`), so the Edge entry graph does no cross-module
 * work at module scope. A literal cannot fail to initialise.
 *
 * `_exhaustive` below is compile-time only: it fails `tsc` if a role is added
 * to the enum and not to this list, which is what deriving bought us.
 */
const ROLE_LIST = [
  "SUPER_ADMIN", "DIRECTOR_BUSINESS", "DIRECTOR_STRATEGY", "BRANCH_MANAGER",
  "SALES_EXECUTIVE", "SERVICE_MANAGER", "FIELD_ENGINEER", "PROJECT_MANAGER",
  "ACCOUNTS_EXECUTIVE", "HR_ADMIN", "STORE_INCHARGE", "AUDITOR",
] as const;

type _Exhaustive = Exclude<Role, (typeof ROLE_LIST)[number]> extends never ? true : never;
const _exhaustive: _Exhaustive = true;
void _exhaustive;

const VALID_ROLES = new Set<string>(ROLE_LIST);

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && VALID_ROLES.has(value);
}

export function decodeSession(raw: string | undefined | null): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Session;
    // AR-5 — a schema-version mismatch resets cleanly rather than throwing.
    if (!parsed || parsed.v !== SCHEMA_VERSION) return null;
    // A cookie is user-editable, so the role is untrusted input. It must be a
    // real member of the enum, not merely present: every consumer indexes a
    // Record<Role, …> with it, and an unrecognised string yields undefined —
    // which, in middleware, throws and fails the whole request.
    if (!isRole(parsed.role)) return null;
    if (parsed.impersonatedFrom && !isRole(parsed.impersonatedFrom.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function landingFor(role: Role): string {
  return LANDING_ROUTE[role];
}

export function isExpired(s: Session, now: number): boolean {
  return now - s.lastSeenAt > IDLE_TIMEOUT_MS;
}
