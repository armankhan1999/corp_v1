import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  decodeSession,
  encodeSession,
  isRole,
  newSession,
} from "../../lib/rbac/session";
import { LANDING_ROUTE } from "../../lib/rbac/matrix";

/**
 * Regression cover for the Vercel MIDDLEWARE_INVOCATION_FAILED outage.
 *
 * The session cookie is user-editable, so `role` is untrusted input. Middleware
 * indexes Record<Role, …> maps with it; an unrecognised string produced
 * `undefined`, and calling `.split()` on that threw. A throw in middleware fails
 * the entire request, so a single malformed cookie returned 500 on every route —
 * including `/`, which has no page of its own and depends wholly on the guard.
 */

const GOOD = newSession(
  { id: "USR-001", role: "SERVICE_MANAGER", branchId: "BR-PAT", name: "Test Persona" },
  1_770_000_000_000,
);

describe("decodeSession", () => {
  it("round-trips a well-formed session", () => {
    expect(decodeSession(encodeSession(GOOD))).toEqual(GOOD);
  });

  it("returns null for absent, empty and undecodable input", () => {
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession(null)).toBeNull();
    expect(decodeSession("")).toBeNull();
    expect(decodeSession("not json")).toBeNull();
    expect(decodeSession("%E0%A4%A")).toBeNull(); // malformed percent-encoding
  });

  it("returns null on a schema-version mismatch (AR-5)", () => {
    expect(decodeSession(encodeSession({ ...GOOD, v: SCHEMA_VERSION + 1 }))).toBeNull();
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["unknown", "ADMIN"],
    ["lower-cased", "service_manager"],
    ["numeric", 7],
    ["object", { role: "AUDITOR" }],
    ["prototype key", "constructor"],
    ["prototype key", "__proto__"],
  ])("rejects a cookie whose role is %s", (_label, role) => {
    const raw = encodeURIComponent(JSON.stringify({ ...GOOD, role }));
    expect(decodeSession(raw)).toBeNull();
  });

  it("rejects an impersonation block carrying an invalid role (RBAC-7)", () => {
    const raw = encodeURIComponent(
      JSON.stringify({
        ...GOOD,
        impersonatedFrom: { userId: "USR-000", role: "GOD_MODE", name: "X" },
      }),
    );
    expect(decodeSession(raw)).toBeNull();
  });

  it("accepts a valid impersonation block", () => {
    const s = {
      ...GOOD,
      impersonatedFrom: { userId: "USR-000", role: "SUPER_ADMIN" as const, name: "Root" },
    };
    expect(decodeSession(encodeSession(s))).toEqual(s);
  });
});

describe("isRole", () => {
  it("accepts every one of the 12 roles, and nothing else", () => {
    const roles = Object.keys(LANDING_ROUTE);
    expect(roles).toHaveLength(12);
    for (const r of roles) expect(isRole(r)).toBe(true);
    for (const bad of ["", "ADMIN", "auditor", null, undefined, 0, {}, [], "toString"]) {
      expect(isRole(bad)).toBe(false);
    }
  });
});

describe("every decoded role can be landed", () => {
  // The guard's `/` branch indexes LANDING_ROUTE with the decoded role. If
  // decodeSession admits it, this lookup must resolve to a usable path.
  it("maps to a non-empty absolute route", () => {
    for (const role of Object.keys(LANDING_ROUTE)) {
      const raw = encodeURIComponent(JSON.stringify({ ...GOOD, role }));
      const session = decodeSession(raw);
      expect(session).not.toBeNull();
      const landing = LANDING_ROUTE[session!.role];
      expect(landing).toBeTypeOf("string");
      expect(landing.startsWith("/")).toBe(true);
    }
  });
});
