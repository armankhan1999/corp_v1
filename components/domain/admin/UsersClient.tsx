"use client";

/**
 * E1 / FR-M1-02 — users and roles.
 *
 * Twelve seeded accounts, one per role. The screen exists to answer three
 * questions without ambiguity: who holds which role, where they are scoped, and
 * what changes the moment a role is reassigned. Every mutation lands in the
 * browser overlay (`pravaah.v1.users`) and in the append-only audit log; the
 * seeded dataset is never touched, so a Demo Controls reset returns the world
 * exactly to its baseline.
 *
 * Two rules have teeth here rather than being asserted: an account cannot
 * deactivate itself, and the last active Super Admin cannot be deactivated or
 * demoted. Both surface as blocked states that name the rule and what would
 * unblock it, rather than as a disabled button.
 */

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCog,
  UserX,
  X,
} from "lucide-react";
import { EmptyState, Overline, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { CAPABILITIES, LANDING_ROUTE, MATRIX, can } from "@/lib/rbac/matrix";
import { ROLE_LABEL, type Role } from "@/lib/schemas/enums";
import { formatCount, formatPhone, pluralise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { appendAudit, describeChange } from "./auditStore";
import {
  ADMIN_KEYS,
  EMPTY_USERS,
  downloadCsv,
  localId,
  toCsv,
  useOverlay,
  type UsersOverlay,
} from "./store";
import {
  Btn,
  Callout,
  ConfirmDialog,
  Field,
  FilteredEmpty,
  Modal,
  Select,
  Td,
  TextInput,
  Th,
} from "./ui";
import type { ActorInfo, UserRow } from "./types";

const ROLES = Object.keys(MATRIX) as Role[];

export interface BranchLite {
  id: string;
  code: string;
  name: string;
  city: string;
}

export interface EmployeeLite {
  code: string;
  name: string;
}

interface Draft {
  name: string;
  role: Role;
  branchId: string;
  email: string;
  phone: string;
  designation: string;
}

type DraftErrors = Partial<Record<keyof Draft, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(d: Draft, others: UserRow[]): DraftErrors {
  const e: DraftErrors = {};
  if (d.name.trim().length < 2) {
    e.name = "A full name is required — it is written onto every audit entry this account raises.";
  }
  const email = d.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    e.email = "Enter a work address in the form name@bhushancorp.in.";
  } else if (others.some((u) => u.email.trim().toLowerCase() === email)) {
    e.email = "Another account already holds this address, and sign-in resolves by email.";
  }
  if (d.phone.replace(/\D/g, "").length !== 10) {
    e.phone = "Ten digits. WhatsApp and SMS notifications route to this number.";
  }
  if (d.designation.trim().length < 2) {
    e.designation = "Designation is required — it appears beside the name on every assignment picker.";
  }
  return e;
}

/** The overlay merged over the seeded accounts. The seed object is never mutated. */
function mergeUsers(base: UserRow[], ov: UsersOverlay, selfId: string): UserRow[] {
  const created: UserRow[] = ov.created.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    branchId: c.branchId,
    email: c.email,
    phone: c.phone,
    designation: c.designation,
    active: c.active,
    employeeId: null,
    activityCount: 0,
    isSelf: c.id === selfId,
  }));
  return [...base, ...created].map((u) => {
    const patch = ov.patches[u.id];
    return patch ? { ...u, ...patch } : u;
  });
}

function capabilityDelta(from: Role, to: Role): { gained: string[]; lost: string[] } {
  return {
    gained: CAPABILITIES.filter((c) => can(to, c) && !can(from, c)),
    lost: CAPABILITIES.filter((c) => can(from, c) && !can(to, c)),
  };
}

/* ------------------------------------------------------------ blocked state */

interface BlockedState {
  subject: string;
  headline: string;
  rule: string;
  unblock: string;
}

function RuleBlock({ blocked, onClose }: { blocked: BlockedState; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Action blocked"
      sub={blocked.subject}
      width={520}
      footer={<Btn onClick={onClose}>Close</Btn>}
    >
      <Callout tone="danger" title={blocked.headline}>
        <p>{blocked.rule}</p>
      </Callout>
      <p className="t-body-sm mt-3 text-text-mid">
        <span className="text-text-hi">What would unblock it: </span>
        {blocked.unblock}
      </p>
      <p className="t-body-sm mt-2 text-text-lo">
        Nothing was written. The account is exactly as it was, and no audit entry was raised for a
        change that did not happen.
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ screen */

export function UsersClient({
  users,
  branches,
  employees,
  actor,
  canEdit,
  canCreate,
  readOnlyRole,
  focusId,
}: {
  users: UserRow[];
  branches: BranchLite[];
  employees: Record<string, EmployeeLite>;
  actor: ActorInfo;
  canEdit: boolean;
  canCreate: boolean;
  readOnlyRole: boolean;
  focusId: string | null;
}) {
  const { state: ov, ready, update } = useOverlay<UsersOverlay>(ADMIN_KEYS.users, EMPTY_USERS);

  const [q, setQ] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"ALL" | Role>("ALL");
  const [branchFilter, setBranchFilter] = React.useState("ALL");
  const [stateFilter, setStateFilter] = React.useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [focus, setFocus] = React.useState<string | null>(focusId);

  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [assigning, setAssigning] = React.useState<UserRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [confirmOff, setConfirmOff] = React.useState<UserRow | null>(null);
  const [blocked, setBlocked] = React.useState<BlockedState | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  const rows = React.useMemo(() => mergeUsers(users, ov, actor.userId), [users, ov, actor.userId]);

  const branchById = React.useMemo(
    () => new Map(branches.map((b) => [b.id, b])),
    [branches],
  );
  const branchLabel = React.useCallback(
    (id: string) => {
      const b = branchById.get(id);
      return b ? `${b.name}, ${b.city}` : id;
    },
    [branchById],
  );

  const activeSuperAdmins = rows.filter((u) => u.active && u.role === "SUPER_ADMIN").length;
  const canOpenEmployee = can(actor.role, "employees");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (branchFilter !== "ALL" && u.branchId !== branchFilter) return false;
      if (stateFilter === "ACTIVE" && !u.active) return false;
      if (stateFilter === "INACTIVE" && u.active) return false;
      if (!needle) return true;
      return [u.name, u.email, u.designation, u.id, u.phone].some((v) =>
        v.toLowerCase().includes(needle),
      );
    });
  }, [rows, q, roleFilter, branchFilter, stateFilter]);

  const activeFilters: string[] = [];
  if (q.trim()) activeFilters.push(`text “${q.trim()}”`);
  if (roleFilter !== "ALL") activeFilters.push(`role ${ROLE_LABEL[roleFilter]}`);
  if (branchFilter !== "ALL") activeFilters.push(`branch ${branchLabel(branchFilter)}`);
  if (stateFilter !== "ALL") activeFilters.push(stateFilter === "ACTIVE" ? "active only" : "inactive only");

  function clearFilters() {
    setQ("");
    setRoleFilter("ALL");
    setBranchFilter("ALL");
    setStateFilter("ALL");
  }

  /* ---------------------------------------------------------- mutations */

  function saveProfile(row: UserRow, next: Draft) {
    const changes: { label: string; before: string; after: string }[] = [];
    if (row.name !== next.name.trim()) changes.push({ label: "Name", before: row.name, after: next.name.trim() });
    if (row.email !== next.email.trim()) changes.push({ label: "Email", before: row.email, after: next.email.trim() });
    if (row.phone !== next.phone.trim()) {
      changes.push({ label: "Phone", before: formatPhone(row.phone), after: formatPhone(next.phone.trim()) });
    }
    if (row.designation !== next.designation.trim()) {
      changes.push({ label: "Designation", before: row.designation, after: next.designation.trim() });
    }
    if (changes.length === 0) {
      setEditing(null);
      return;
    }
    update((prev) => ({
      ...prev,
      patches: {
        ...prev.patches,
        [row.id]: {
          ...prev.patches[row.id],
          name: next.name.trim(),
          email: next.email.trim(),
          phone: next.phone.trim(),
          designation: next.designation.trim(),
        },
      },
    }));
    const d = describeChange(changes);
    appendAudit({
      actor,
      action: "UPDATE",
      entityType: "User",
      entityId: row.id,
      entityLabel: row.name,
      summary: `User account — ${d.summary} changed`,
      before: d.before,
      after: d.after,
    });
    setFlash(`${next.name.trim()} updated. The prior and the new value are both in the audit log.`);
    setEditing(null);
  }

  function saveAssignment(row: UserRow, role: Role, branchId: string) {
    if (
      row.role === "SUPER_ADMIN" &&
      role !== "SUPER_ADMIN" &&
      row.active &&
      activeSuperAdmins <= 1
    ) {
      setAssigning(null);
      setBlocked({
        subject: `${row.name} — ${row.id}`,
        headline: "This is the last active Super Admin",
        rule: "Exactly one active account holds Super Admin. Moving it to another role would leave the platform with nobody who can create users, edit the permission-bearing records or reset the demonstration, and no role can grant itself Super Admin.",
        unblock:
          "Create or reactivate a second Super Admin first. With two active, either may be reassigned.",
      });
      return;
    }
    const changes: { label: string; before: string; after: string }[] = [];
    if (row.role !== role) {
      changes.push({ label: "Role", before: ROLE_LABEL[row.role], after: ROLE_LABEL[role] });
    }
    if (row.branchId !== branchId) {
      changes.push({ label: "Branch", before: branchLabel(row.branchId), after: branchLabel(branchId) });
    }
    if (changes.length === 0) {
      setAssigning(null);
      return;
    }
    update((prev) => ({
      ...prev,
      patches: { ...prev.patches, [row.id]: { ...prev.patches[row.id], role, branchId } },
    }));
    const d = describeChange(changes);
    const delta = capabilityDelta(row.role, role);
    const roleMoved = row.role !== role;
    appendAudit({
      actor,
      action: "UPDATE",
      entityType: "User",
      entityId: row.id,
      entityLabel: row.name,
      summary: roleMoved
        ? `Role reassigned to ${ROLE_LABEL[role]} — landing route becomes ${LANDING_ROUTE[role]}, ${formatCount(delta.gained.length)} ${pluralise(delta.gained.length, "capability", "capabilities")} gained and ${formatCount(delta.lost.length)} lost`
        : `Branch reassigned to ${branchLabel(branchId)} — branch-scoped lists re-filter to it`,
      before: d.before,
      after: d.after,
    });
    setFlash(
      roleMoved
        ? `${row.name} is now ${ROLE_LABEL[role]}. Their landing route is ${LANDING_ROUTE[role]} and their navigation changes at their next sign-in.`
        : `${row.name} moved to ${branchLabel(branchId)}.`,
    );
    setAssigning(null);
  }

  function attemptDeactivate(row: UserRow) {
    if (row.isSelf) {
      setBlocked({
        subject: `${row.name} — ${row.id}`,
        headline: "An account cannot deactivate itself",
        rule: "You are signed in as this account. Deactivating it would end your own session and leave the change unattributable, so the platform refuses the self-inflicted case outright — the rule holds for every role, including Super Admin.",
        unblock:
          "Another Super Admin must deactivate this account. Sign in as a second Super Admin, or ask one to do it, and the control becomes available on this row for them.",
      });
      return;
    }
    if (row.role === "SUPER_ADMIN" && activeSuperAdmins <= 1) {
      setBlocked({
        subject: `${row.name} — ${row.id}`,
        headline: "This is the last active Super Admin",
        rule: "Deactivating the only active Super Admin would leave the platform with no account able to create users, manage reference data or reset the demonstration. Nothing in the product can re-grant the role once it is gone.",
        unblock:
          "Create or reactivate a second Super Admin first. With two active accounts holding the role, either may be deactivated.",
      });
      return;
    }
    setConfirmOff(row);
  }

  function setActive(row: UserRow, active: boolean) {
    update((prev) => ({
      ...prev,
      patches: { ...prev.patches, [row.id]: { ...prev.patches[row.id], active } },
    }));
    appendAudit({
      actor,
      action: "STATE_TRANSITION",
      entityType: "User",
      entityId: row.id,
      entityLabel: row.name,
      summary: active
        ? `User account reactivated — ${ROLE_LABEL[row.role]} at ${branchLabel(row.branchId)} can sign in again`
        : `User account deactivated — sign-in refused and the account leaves every assignment picker; records already attributed to it are untouched`,
      before: active ? "Inactive" : "Active",
      after: active ? "Active" : "Inactive",
    });
    setFlash(
      active
        ? `${row.name} reactivated. They can sign in and be assigned work again.`
        : `${row.name} deactivated. Their ${formatCount(row.activityCount)} audit ${pluralise(row.activityCount, "entry", "entries")} and every record they raised stay exactly as they are.`,
    );
    setConfirmOff(null);
  }

  function createUser(d: Draft) {
    const id = localId("USR");
    update((prev) => ({
      ...prev,
      created: [
        ...prev.created,
        {
          id,
          name: d.name.trim(),
          role: d.role,
          branchId: d.branchId,
          email: d.email.trim(),
          phone: d.phone.trim(),
          designation: d.designation.trim(),
          active: true,
        },
      ],
    }));
    appendAudit({
      actor,
      action: "CREATE",
      entityType: "User",
      entityId: id,
      entityLabel: d.name.trim(),
      summary: `User account created as ${ROLE_LABEL[d.role]} at ${branchLabel(d.branchId)} — lands on ${LANDING_ROUTE[d.role]}`,
      after: `Name: ${d.name.trim()} · Role: ${ROLE_LABEL[d.role]} · Branch: ${branchLabel(d.branchId)} · Email: ${d.email.trim()} · Designation: ${d.designation.trim()}`,
    });
    setFlash(
      `${d.name.trim()} created with id ${id}. Local accounts carry an L in the identifier so they are never mistaken for seeded ones.`,
    );
    setCreating(false);
  }

  function exportCsv() {
    const csv = toCsv(
      [
        "User ID",
        "Name",
        "Role",
        "Branch",
        "Designation",
        "Email",
        "Phone",
        "Linked employee",
        "Audit entries",
        "State",
      ],
      filtered.map((u) => [
        u.id,
        u.name,
        ROLE_LABEL[u.role],
        branchLabel(u.branchId),
        u.designation,
        u.email,
        u.phone,
        u.employeeId ? employees[u.employeeId]?.code ?? u.employeeId : "",
        u.activityCount,
        u.active ? "Active" : "Inactive",
      ]),
    );
    downloadCsv("pravaah-users.csv", csv);
    appendAudit({
      actor,
      action: "EXPORT",
      entityType: "User",
      entityId: "user-register",
      entityLabel: `${formatCount(filtered.length)} user ${pluralise(filtered.length, "account")}`,
      summary: "User register exported as CSV containing exactly the filtered rows",
      after: activeFilters.length ? `Filters: ${activeFilters.join(" · ")}` : "No filters — every account",
    });
    setFlash(`Exported ${formatCount(filtered.length)} ${pluralise(filtered.length, "row")}. The export itself is in the audit log.`);
  }

  /* ------------------------------------------------------------- render */

  const inactiveCount = rows.filter((u) => !u.active).length;

  return (
    <div className="flex flex-col gap-4">
      {!canEdit ? (
        <Callout
          tone="info"
          title={`${ROLE_LABEL[actor.role]} holds read access to user accounts`}
        >
          <p>
            The permission matrix grants your role <span className="t-mono">R</span> on{" "}
            <span className="t-mono">admin.users</span>. You can see who holds which role and where
            they are scoped; no create, edit, deactivate or reassignment control is rendered for
            your role. They are absent rather than disabled, so the interface never advertises what
            it would refuse.
            {readOnlyRole
              ? " RBAC-5 makes the Auditor read-only everywhere in the platform, with no write path on any screen."
              : ` Changing a role or a branch is held by ${ROLE_LABEL.SUPER_ADMIN}.`}
          </p>
        </Callout>
      ) : null}

      {flash ? (
        <div className="flex items-start gap-2 rounded-lg border border-ok/40 bg-ok-bg px-3 py-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
          <p className="t-body-sm text-text-mid">{flash}</p>
          <button
            type="button"
            onClick={() => setFlash(null)}
            aria-label="Dismiss confirmation"
            className="ml-auto grid size-6 shrink-0 place-items-center rounded-md text-text-lo hover:bg-surface-2 hover:text-text-hi"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {focus ? (
        <Callout
          tone="info"
          title="Opened from a reference elsewhere in the platform"
          right={
            <Btn onClick={() => setFocus(null)} icon={X}>
              Clear highlight
            </Btn>
          }
        >
          <p>
            The row for <span className="t-mono">{focus}</span> is highlighted below.
          </p>
        </Callout>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Accounts", value: formatCount(rows.length) },
          { label: "Active", value: formatCount(rows.length - inactiveCount) },
          { label: "Deactivated", value: formatCount(inactiveCount) },
          { label: "Roles in use", value: formatCount(new Set(rows.map((u) => u.role)).size) },
        ].map((s) => (
          <li key={s.label} className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
            <Overline>{s.label}</Overline>
            <p className="t-display-md tabular-nums text-text-hi">{ready ? s.value : "—"}</p>
          </li>
        ))}
      </ul>

      <Panel>
        <PanelHeader
          title="User register"
          sub="One account per role in the seeded world. Role decides what the account can reach; branch decides how much of it."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <Btn icon={Download} onClick={exportCsv} disabled={!ready || filtered.length === 0}>
                Export CSV
              </Btn>
              {canCreate ? (
                <Btn tone="primary" icon={Plus} onClick={() => setCreating(true)}>
                  Add user
                </Btn>
              ) : null}
            </div>
          }
        />

        <div className="flex flex-wrap items-end gap-2 border-b border-line px-3 py-2.5">
          <label className="relative">
            <span className="sr-only">Search accounts by name, email, designation or user id</span>
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-lo"
              aria-hidden
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, designation, id"
              className="h-8 w-56 rounded-md border border-line bg-surface-0 pl-7 pr-2 text-[0.8125rem] text-text-hi outline-none placeholder:text-text-lo focus:border-line-strong"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="t-overline text-text-lo">Role</span>
            <Select
              className="w-44"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "ALL" | Role)}
            >
              <option value="ALL">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="t-overline text-text-lo">Branch</span>
            <Select
              className="w-44"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="ALL">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}, {b.city}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="t-overline text-text-lo">State</span>
            <Select
              className="w-36"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            >
              <option value="ALL">Active and inactive</option>
              <option value="ACTIVE">Active only</option>
              <option value="INACTIVE">Inactive only</option>
            </Select>
          </label>

          {activeFilters.length > 0 ? (
            <Btn icon={X} onClick={clearFilters}>
              Clear {formatCount(activeFilters.length)} {pluralise(activeFilters.length, "filter")}
            </Btn>
          ) : null}
        </div>

        {!ready ? (
          <div className="flex flex-col gap-px bg-line" aria-busy="true" aria-live="polite">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-surface-1 p-2" style={{ height: "var(--row-h)" }}>
                <div className="pv-skeleton h-4 rounded-md" aria-hidden />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No user accounts exist"
            body="The seeded world normally carries twelve accounts, one per role. If this list is empty the overlay has replaced them; a Demo Controls reset restores the seeded twelve."
            action={
              canCreate ? (
                <Btn tone="primary" icon={Plus} onClick={() => setCreating(true)}>
                  Add the first account
                </Btn>
              ) : null
            }
          />
        ) : filtered.length === 0 ? (
          <FilteredEmpty active={activeFilters} onClear={clearFilters} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse">
              <caption className="sr-only">
                User accounts with role, branch, designation, linked employee record and activity
                count
              </caption>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Branch</Th>
                  <Th>Designation</Th>
                  <Th>Linked employee</Th>
                  <Th align="right">Audit entries</Th>
                  <Th>State</Th>
                  {canEdit ? <Th align="right">Manage</Th> : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const emp = u.employeeId ? employees[u.employeeId] : undefined;
                  const highlighted = focus === u.id;
                  return (
                    <tr
                      key={u.id}
                      aria-current={highlighted ? "true" : undefined}
                      className={cn(
                        "hover:bg-surface-2",
                        !u.active && "opacity-60",
                        highlighted && "bg-info-bg",
                      )}
                    >
                      <Td>
                        <span className="flex flex-col">
                          <span className="t-body-sm text-text-hi">
                            {u.name}
                            {u.isSelf ? (
                              <span className="t-overline ml-1.5 rounded-md border border-line bg-surface-2 px-1 py-0.5 text-text-mid">
                                You
                              </span>
                            ) : null}
                          </span>
                          <span className="t-mono text-text-lo">{u.id}</span>
                          <span className="t-mono text-text-lo">{u.email}</span>
                        </span>
                      </Td>
                      <Td>
                        <span className="flex flex-col">
                          <span className="t-body-sm text-text-hi">{ROLE_LABEL[u.role]}</span>
                          <span className="t-mono text-text-lo">{LANDING_ROUTE[u.role]}</span>
                        </span>
                      </Td>
                      <Td>{branchLabel(u.branchId)}</Td>
                      <Td>{u.designation}</Td>
                      <Td>
                        {u.employeeId && emp ? (
                          canOpenEmployee ? (
                            <Link
                              href={`/people/employees/${u.employeeId}`}
                              className="inline-flex flex-col rounded-md px-0.5 py-0.5 hover:bg-surface-2"
                            >
                              <span className="t-mono text-text-hi underline decoration-line-strong underline-offset-2">
                                {emp.code}
                              </span>
                              <span className="t-body-sm text-text-lo">{emp.name}</span>
                            </Link>
                          ) : (
                            <span className="flex flex-col">
                              <span className="t-mono text-text-hi">{emp.code}</span>
                              <span className="t-body-sm text-text-lo">{emp.name}</span>
                            </span>
                          )
                        ) : (
                          <span className="t-body-sm text-text-lo">
                            Not linked to an employee record
                          </span>
                        )}
                      </Td>
                      <Td align="right" mono>
                        {formatCount(u.activityCount)}
                      </Td>
                      <Td>
                        <StatusBadge tone={u.active ? "ok" : "warn"}>
                          {u.active ? "Active" : "Deactivated"}
                        </StatusBadge>
                      </Td>
                      {canEdit ? (
                        <Td align="right">
                          <span className="inline-flex flex-wrap items-center justify-end gap-1">
                            <Btn icon={Pencil} onClick={() => setEditing(u)}>
                              Edit
                            </Btn>
                            <Btn icon={UserCog} onClick={() => setAssigning(u)}>
                              Role &amp; branch
                            </Btn>
                            {u.active ? (
                              <Btn tone="danger" icon={UserX} onClick={() => attemptDeactivate(u)}>
                                Deactivate
                              </Btn>
                            ) : (
                              <Btn icon={RotateCcw} onClick={() => setActive(u, true)}>
                                Reactivate
                              </Btn>
                            )}
                          </span>
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
          {ready
            ? `${formatCount(filtered.length)} of ${formatCount(rows.length)} ${pluralise(rows.length, "account")}. `
            : "Reading the browser overlay… "}
          {canEdit
            ? "Every create, edit, reassignment and state change writes an audit entry carrying the prior and the new value."
            : "Read-only for your role; nothing on this screen can be changed from here."}
        </p>
      </Panel>

      {/* ------------------------------------------------------- dialogs */}

      {creating ? (
        <UserForm
          key="create"
          title="Add a user account"
          sub="A local account, created in the browser overlay. It carries an L in its identifier so it is never mistaken for a seeded record."
          initial={{
            name: "",
            role: "SALES_EXECUTIVE",
            branchId: branches[0]?.id ?? "",
            email: "",
            phone: "",
            designation: "",
          }}
          branches={branches}
          others={rows}
          isNew
          onClose={() => setCreating(false)}
          onSave={createUser}
        />
      ) : null}

      {editing ? (
        <UserForm
          key={`edit-${editing.id}`}
          title={`Edit — ${editing.name}`}
          sub={`${editing.id} · role and branch are changed from the Role & branch dialog, where the effect is stated first.`}
          initial={{
            name: editing.name,
            role: editing.role,
            branchId: editing.branchId,
            email: editing.email,
            phone: editing.phone,
            designation: editing.designation,
          }}
          branches={branches}
          others={rows.filter((u) => u.id !== editing.id)}
          lockAssignment
          onClose={() => setEditing(null)}
          onSave={(d) => saveProfile(editing, d)}
        />
      ) : null}

      {assigning ? (
        <AssignmentForm
          key={`assign-${assigning.id}`}
          row={assigning}
          branches={branches}
          branchLabel={branchLabel}
          activeSuperAdmins={activeSuperAdmins}
          onClose={() => setAssigning(null)}
          onSave={(role, branchId) => saveAssignment(assigning, role, branchId)}
        />
      ) : null}

      <ConfirmDialog
        open={confirmOff !== null}
        onClose={() => setConfirmOff(null)}
        onConfirm={() => confirmOff && setActive(confirmOff, false)}
        title={confirmOff ? `Deactivate ${confirmOff.name}?` : "Deactivate account"}
        confirmLabel="Deactivate account"
        consequence={
          confirmOff
            ? `${confirmOff.name} loses sign-in immediately and disappears from every assignment picker, dispatch list and approval ladder.`
            : undefined
        }
        body={
          confirmOff ? (
            <div className="flex flex-col gap-2">
              <p>
                <span className="t-mono text-text-hi">{confirmOff.id}</span> —{" "}
                {ROLE_LABEL[confirmOff.role]} at {branchLabel(confirmOff.branchId)}.
              </p>
              <p>
                Deactivation is not deletion. The{" "}
                {formatCount(confirmOff.activityCount)}{" "}
                {pluralise(confirmOff.activityCount, "audit entry", "audit entries")} attributed to
                this account, and every quotation, ticket, invoice and approval it raised, stay
                exactly as they are and keep reading correctly — that is the whole reason the
                platform deactivates rather than deletes.
              </p>
              <p>
                Anything currently assigned to them will need reassigning by hand; the platform does
                not move work silently.
              </p>
            </div>
          ) : null
        }
      />

      {blocked ? <RuleBlock blocked={blocked} onClose={() => setBlocked(null)} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------- the forms */

function UserForm({
  title,
  sub,
  initial,
  branches,
  others,
  isNew,
  lockAssignment,
  onClose,
  onSave,
}: {
  title: string;
  sub: string;
  initial: Draft;
  branches: BranchLite[];
  others: UserRow[];
  isNew?: boolean;
  lockAssignment?: boolean;
  onClose: () => void;
  onSave: (d: Draft) => void;
}) {
  const [draft, setDraft] = React.useState<Draft>(initial);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [attempted, setAttempted] = React.useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((p) => ({ ...p, [key]: value }));
  }

  function submit() {
    const e = validate(draft, others);
    setErrors(e);
    setAttempted(true);
    if (Object.keys(e).length > 0) return;
    onSave(draft);
  }

  const errorCount = Object.keys(errors).length;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      sub={sub}
      width={560}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn tone="primary" onClick={submit}>
            {isNew ? "Create account" : "Save changes"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {attempted && errorCount > 0 ? (
          <Callout
            tone="danger"
            title={`${formatCount(errorCount)} ${pluralise(errorCount, "field needs", "fields need")} attention`}
          >
            <p>
              Nothing was saved. Each field below states what it expects; correct them and save
              again.
            </p>
          </Callout>
        ) : null}

        <Field label="Full name" error={errors.name ?? null}>
          <TextInput
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Anjali Prasad"
            autoComplete="off"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Role"
            hint={
              lockAssignment
                ? "Changed from the Role & branch dialog, which states the effect first."
                : `Lands on ${LANDING_ROUTE[draft.role]}`
            }
          >
            <Select
              value={draft.role}
              disabled={lockAssignment}
              onChange={(e) => set("role", e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Branch"
            hint={
              lockAssignment
                ? "Changed from the Role & branch dialog."
                : "Branch-scoped roles see only this branch."
            }
          >
            <Select
              value={draft.branchId}
              disabled={lockAssignment}
              onChange={(e) => set("branchId", e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}, {b.city}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Work email" error={errors.email ?? null} hint="Sign-in resolves by email.">
            <TextInput
              mono
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="name@bhushancorp.in"
              autoComplete="off"
              inputMode="email"
            />
          </Field>

          <Field
            label="Mobile"
            error={errors.phone ?? null}
            hint={
              draft.phone.replace(/\D/g, "").length === 10
                ? formatPhone(draft.phone)
                : "Ten digits, Indian mobile."
            }
          >
            <TextInput
              mono
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="9XXXXXXXXX"
              autoComplete="off"
              inputMode="tel"
            />
          </Field>
        </div>

        <Field label="Designation" error={errors.designation ?? null}>
          <TextInput
            value={draft.designation}
            onChange={(e) => set("designation", e.target.value)}
            placeholder="e.g. Senior Sales Executive"
            autoComplete="off"
          />
        </Field>

        <p className="t-body-sm text-text-lo">
          {isNew
            ? "The account is written to this browser only. No invitation is sent and no identity provider is contacted — authentication is simulated in Phase 1."
            : "Saving writes an audit entry naming each field that changed, with its prior and new value."}
        </p>
      </div>
    </Modal>
  );
}

function AssignmentForm({
  row,
  branches,
  branchLabel,
  activeSuperAdmins,
  onClose,
  onSave,
}: {
  row: UserRow;
  branches: BranchLite[];
  branchLabel: (id: string) => string;
  activeSuperAdmins: number;
  onClose: () => void;
  onSave: (role: Role, branchId: string) => void;
}) {
  const [role, setRole] = React.useState<Role>(row.role);
  const [branchId, setBranchId] = React.useState(row.branchId);

  const roleMoved = role !== row.role;
  const branchMoved = branchId !== row.branchId;
  const delta = capabilityDelta(row.role, role);
  const lastSuperAdmin =
    row.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && row.active && activeSuperAdmins <= 1;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Role & branch — ${row.name}`}
      sub={`${row.id} · the effect of the change is stated before it is made`}
      width={600}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            tone="primary"
            disabled={!roleMoved && !branchMoved}
            onClick={() => onSave(role, branchId)}
          >
            Apply assignment
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Role" hint={`Currently ${ROLE_LABEL[row.role]}`}>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch" hint={`Currently ${branchLabel(row.branchId)}`}>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}, {b.city}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {lastSuperAdmin ? (
          <Callout tone="danger" title="This is the last active Super Admin">
            <p>
              Applying this would leave the platform with nobody able to create users or reset the
              demonstration, so it will be refused. Create or reactivate a second Super Admin
              first.
            </p>
          </Callout>
        ) : null}

        {roleMoved ? (
          <div className="rounded-lg border border-line bg-surface-2 shadow-[var(--elev-1)] p-3">
            <Overline>What changes for {row.name}</Overline>
            <dl className="mt-2 flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt className="t-body-sm text-text-lo">Landing route</dt>
                <dd className="t-mono text-text-hi">
                  {LANDING_ROUTE[row.role]} → {LANDING_ROUTE[role]}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt className="t-body-sm text-text-lo">Navigation</dt>
                <dd className="t-body-sm text-text-hi">
                  {formatCount(delta.gained.length)}{" "}
                  {pluralise(delta.gained.length, "capability", "capabilities")} gained,{" "}
                  {formatCount(delta.lost.length)} lost — the left rail and the command palette
                  re-scope to match, and forbidden routes are denied by the route guard rather than
                  hidden.
                </dd>
              </div>
              {delta.gained.length > 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt className="t-body-sm text-text-lo">Gains</dt>
                  <dd className="t-mono text-ok">
                    {delta.gained.slice(0, 8).join(", ")}
                    {delta.gained.length > 8 ? ` +${formatCount(delta.gained.length - 8)} more` : ""}
                  </dd>
                </div>
              ) : null}
              {delta.lost.length > 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <dt className="t-body-sm text-text-lo">Loses</dt>
                  <dd className="t-mono text-danger">
                    {delta.lost.slice(0, 8).join(", ")}
                    {delta.lost.length > 8 ? ` +${formatCount(delta.lost.length - 8)} more` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        {role === "SUPER_ADMIN" && row.role !== "SUPER_ADMIN" ? (
          <Callout tone="warn" title="Super Admin is the platform's full-control role">
            <p>
              It holds every administration capability — users, permissions, reference data,
              compliance and demo controls — and lands on{" "}
              <span className="t-mono">{LANDING_ROUTE.SUPER_ADMIN}</span>. It carries no business
              approval authority, deliberately: platform administration and commercial sign-off are
              separate powers. The grant is written to the audit log with your name against it.
            </p>
          </Callout>
        ) : null}

        {branchMoved ? (
          <Callout tone="info" title="Branch scope moves with the account">
            <p>
              Every branch-scoped list, dashboard and analytics query re-filters to{" "}
              {branchLabel(branchId)}. For a branch-locked role the selector in the header stays
              locked to it.
            </p>
          </Callout>
        ) : null}

        {row.isSelf && roleMoved ? (
          <Callout tone="warn" title="This is your own account">
            <p>
              Your current session keeps the role it was issued with; the new role applies the next
              time this account signs in. Nothing about the screen you are on changes as you click
              Apply.
            </p>
          </Callout>
        ) : null}

        {!roleMoved && !branchMoved ? (
          <p className="t-body-sm flex items-center gap-1.5 text-text-lo">
            <ShieldAlert className="size-3.5" aria-hidden />
            Nothing selected yet differs from the current assignment.
          </p>
        ) : null}

        <p className="t-body-sm text-text-lo">
          A reassignment never rewrites history: records already attributed to{" "}
          {row.name} keep the role that was in force when they were raised.
        </p>
      </div>
    </Modal>
  );
}
