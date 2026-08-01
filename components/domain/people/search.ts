import type { Employee } from "@/lib/schemas/entities";
import type { Role } from "@/lib/schemas/enums";
import { can } from "@/lib/rbac/matrix";

/**
 * E9-S1 — employee personal data is excluded from a user's search results
 * unless that user holds the HR capability.
 *
 * Two layers, one predicate:
 *   • `globalEmployeeSearch` is what any general search surface must call. For a
 *     role without `hrDocuments` it returns nothing at all, so employee records
 *     never surface in a global result set for that user.
 *   • `employeeSearchFields` is what the HR register itself matches on. Without
 *     the capability, personal fields (contact, emergency contact, statutory
 *     identifiers) are not part of the index, so they cannot be probed by
 *     guessing a phone number into the search box.
 */

export function employeeSearchFields(employee: Employee, personalVisible: boolean): string {
  const base = [
    employee.code,
    employee.name,
    employee.designation,
    employee.department,
  ];
  if (!personalVisible) return base.join(" ").toLowerCase();
  return [
    ...base,
    employee.phone,
    employee.email,
    employee.emergencyContactName,
    employee.emergencyContactPhone,
    employee.pfNumberMasked,
    employee.esicNumberMasked,
    employee.uanMasked,
  ]
    .join(" ")
    .toLowerCase();
}

export interface GlobalSearchHit {
  id: string;
  label: string;
  sub: string;
  href: string;
}

/** The single entry point a global search surface should use for employees. */
export function globalEmployeeSearch(role: Role, employees: Employee[], query: string): GlobalSearchHit[] {
  if (!can(role, "hrDocuments")) return [];
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return employees
    .filter((e) => employeeSearchFields(e, true).includes(q))
    .slice(0, 20)
    .map((e) => ({
      id: e.id,
      label: e.name,
      sub: `${e.code} · ${e.designation}`,
      href: `/people/employees/${e.id}`,
    }));
}

export const SEARCH_EXCLUSION_NOTE =
  "Employee records are excluded from the global search index for any role without HR & Admin access. A denied request is written to the audit log rather than silently returning nothing.";
