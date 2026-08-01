import { CAPABILITIES, MATRIX, grantFor, type Capability } from "@/lib/rbac/matrix";
import { ROLE_LABEL, ROLE_SHORT, type Role } from "@/lib/schemas/enums";
import { Overline, Panel, PanelHeader, Explainer } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ROLES = Object.keys(MATRIX) as Role[];

const LEVEL_STYLE: Record<string, string> = {
  F: "bg-ok-bg text-ok",
  CRU: "bg-info-bg text-info",
  RU: "bg-info-bg text-info",
  R: "bg-surface-2 text-text-mid",
  NONE: "text-text-lo",
};

const SCOPE_MARK: Record<string, string> = {
  ALL: "", BRANCH: "b", OWN: "o", ASSIGNED: "a", SELF: "s",
};

const GROUPS: { label: string; caps: Capability[] }[] = [
  { label: "Command", caps: ["command", "command.league", "command.exceptions"] },
  { label: "Sales", caps: ["customers", "enquiries", "quotations", "salesOrders"] },
  { label: "Service", caps: ["assets", "tickets", "dispatch", "jobCards", "commissioning", "amc", "renewals", "rental"] },
  { label: "Projects", caps: ["projects", "dpr", "raBills", "retention", "projectCost"] },
  { label: "Inventory", caps: ["items", "stock", "reorder", "purchaseOrders"] },
  { label: "Commercial", caps: ["challans", "invoices", "eway", "receipts", "receivables", "handoff"] },
  { label: "People", caps: ["employees", "attendance", "leave", "hrDocuments"] },
  { label: "Knowledge & workflow", caps: ["vault", "vaultAsk", "approvals", "chainDesigner", "notifications"] },
  { label: "Analytics", caps: ["analytics.sales", "analytics.service", "analytics.projects", "analytics.cash", "analytics.inventory", "assistant"] },
  { label: "Admin", caps: ["admin.users", "admin.permissions", "admin.masters", "admin.integrations", "admin.compliance", "admin.audit", "admin.demo"] },
];

/**
 * FR-M1-13 / E1-S3 — the permission matrix as a read-only reference, rendered
 * from the same `MATRIX` the middleware and route handlers enforce, so the
 * documentation cannot drift from the enforcement.
 */
export default function PermissionMatrixPage() {
  const listed = new Set(GROUPS.flatMap((g) => g.caps));
  const ungrouped = CAPABILITIES.filter((c) => !listed.has(c));
  const groups = ungrouped.length
    ? [...GROUPS, { label: "Other", caps: ungrouped as Capability[] }]
    : GROUPS;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="t-display-md text-text-hi">Permission Matrix</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">Twelve roles. Generated from the source the route guard reads.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Twelve roles across {CAPABILITIES.length} capabilities. This grid is generated from the
          same source the route guard reads, so what is shown here is what is enforced — in
          navigation, in the middleware, and in the data scope.
        </Explainer>
      </div>

      <Panel className="p-3">
        <Overline>Legend</Overline>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {[
            ["F", "Full — create, read, update, delete"],
            ["CRU", "Create, read, update"],
            ["RU", "Read, update"],
            ["R", "Read"],
            ["—", "No access"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={cn("t-mono rounded-md px-1.5 py-0.5", LEVEL_STYLE[k] ?? "text-text-lo")}>{k}</span>
              <span className="t-body-sm text-text-mid">{v}</span>
            </li>
          ))}
          <li className="t-body-sm text-text-lo">
            Superscript scope: <span className="t-mono">b</span> branch ·{" "}
            <span className="t-mono">o</span> own records · <span className="t-mono">a</span>{" "}
            assigned · <span className="t-mono">s</span> self · <span className="t-mono">A</span>{" "}
            approval authority
          </li>
        </ul>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Role × capability"
          sub="Approval authority is tracked separately from data access (RBAC-4)."
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="t-overline sticky left-0 z-10 border-b border-r border-line bg-surface-2 px-3 py-2 text-left text-text-lo">
                  Capability
                </th>
                {ROLES.map((r) => (
                  <th
                    key={r}
                    title={ROLE_LABEL[r]}
                    className="t-overline border-b border-line bg-surface-2 px-2 py-2 text-center text-text-lo"
                  >
                    {ROLE_SHORT[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <>
                  <tr key={g.label}>
                    <td
                      colSpan={ROLES.length + 1}
                      className="t-overline sticky left-0 border-b border-line bg-surface-3 px-3 py-1.5 text-text-mid"
                    >
                      {g.label}
                    </td>
                  </tr>
                  {g.caps.map((cap) => (
                    <tr key={cap} className="hover:bg-surface-2">
                      <th
                        scope="row"
                        className="t-body-sm sticky left-0 z-10 border-b border-r border-line bg-surface-1 px-3 py-1.5 text-left font-normal text-text-hi"
                      >
                        {cap}
                      </th>
                      {ROLES.map((r) => {
                        const g2 = grantFor(r, cap);
                        const mark = SCOPE_MARK[g2.scope] ?? "";
                        return (
                          <td
                            key={r}
                            className="border-b border-line px-2 py-1.5 text-center"
                            title={`${ROLE_LABEL[r]} — ${g2.level}${g2.note ? ` · ${g2.note}` : ""}`}
                          >
                            {g2.level === "NONE" ? (
                              <span className="text-text-lo">—</span>
                            ) : (
                              <span
                                className={cn(
                                  "t-mono rounded-md px-1 py-0.5 text-[0.6875rem]",
                                  LEVEL_STYLE[g2.level],
                                )}
                              >
                                {g2.level}
                                {mark ? <sup className="text-text-lo">{mark}</sup> : null}
                                {g2.approve ? <sup className="text-ok">A</sup> : null}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-4">
        <Overline>Enforcement</Overline>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
          {[
            "Permissions are enforced at three layers: navigation visibility, route guard, and data query scope. A guessed URL is denied at the guard, not merely hidden from the menu.",
            "Branch-scoped roles have every list, dashboard and analytics query filtered to their branch, and the branch selector is locked. The branch league table is the one stated exception, so managers can compare.",
            "\"Own records only\" scoping applies at record level — assigned owner or assigned engineer — not by branch alone.",
            "Approval authority is separate from data access: viewing a quotation does not confer authority to approve its discount.",
            "The Auditor is read-only everywhere, with no write path in any interface, and is the only non-admin role with audit-log access.",
            "Every denied attempt is written to the audit log with the attempted route.",
          ].map((t) => (
            <li key={t} className="t-body-sm text-text-mid">{t}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
