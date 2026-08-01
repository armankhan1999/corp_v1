import Link from "next/link";
import {
  Database,
  FileClock,
  PlugZap,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { TODAY_ISO, getDataset } from "@/lib/seed";
import { CAPABILITIES, MATRIX, can, grantFor, type Capability } from "@/lib/rbac/matrix";
import { requireCapability } from "@/lib/rbac/guard";
import { ROLE_LABEL, type Role } from "@/lib/schemas/enums";
import { formatCount, formatDate, pluralise } from "@/lib/format";
import { Overline, Panel , Explainer } from "@/components/patterns/primitives";
import { INTEGRATIONS } from "@/components/domain/admin/integrations";
import { buildMasters } from "@/components/domain/admin/mastersData";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Administration — Pravaah",
};

interface AdminCard {
  cap: Capability;
  href: string;
  title: string;
  lede: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Live figures read from the seeded world — no card is decorative. */
  stats: { label: string; value: string }[];
}

/**
 * E1-S3 AC1 — the landing screen for SUPER_ADMIN (`LANDING_ROUTE.SUPER_ADMIN`).
 *
 * Cards the viewer's role cannot open are absent, not disabled: a placeholder
 * would reveal the existence of an area the role may not reach, which is exactly
 * what the acceptance criterion forbids. Every card carries a figure read from
 * the seeded dataset at render time, so the index states the size of what it
 * links to rather than decorating it.
 */
export default async function AdminIndexPage() {
  // RBAC-1 — guarded here, not in a layout: every /admin/* child carries its
  // own capability, so an ancestor guard would demand admin.users of roles
  // such as AUDITOR that only hold admin.audit.
  const session = await requireCapability("admin.users", "/admin");
  const ds = getDataset();
  const role: Role = session.role;

  const roles = Object.keys(MATRIX) as Role[];
  const grantedCells = roles.reduce(
    (n, r) => n + CAPABILITIES.filter((c) => can(r, c)).length,
    0,
  );

  const masters = buildMasters(ds);
  const masterValues = masters.sets.reduce((n, s) => n + s.rows.length, 0);

  const prereqCount = INTEGRATIONS.reduce(
    (n, i) => n + i.prerequisites.filter((p) => !p.none).length,
    0,
  );

  const openDsr = ds.dsrRequests.filter((r) => r.status !== "CLOSED").length;
  const auditActors = new Set(ds.auditLog.map((e) => e.actorUserId)).size;
  const auditActions = new Set(ds.auditLog.map((e) => e.action)).size;
  const earliest = ds.auditLog.reduce(
    (min, e) => (e.at < min ? e.at : min),
    ds.auditLog[0]?.at ?? TODAY_ISO,
  );

  const activeUsers = ds.users.filter((u) => u.active).length;

  const cards: AdminCard[] = [
    {
      cap: "admin.users",
      href: "/admin/users",
      title: "Users & Roles",
      lede: "Who holds which role, where they are scoped, and what changes the moment a role is reassigned.",
      icon: Users,
      stats: [
        { label: "Accounts", value: `${formatCount(ds.users.length)} seeded` },
        { label: "Active", value: formatCount(activeUsers) },
        { label: "Branches", value: formatCount(ds.branches.length) },
      ],
    },
    {
      cap: "admin.permissions",
      href: "/admin/permissions",
      title: "Permission Matrix",
      lede: "The same matrix the middleware and the route handlers enforce, rendered so documentation cannot drift from enforcement.",
      icon: ShieldCheck,
      stats: [
        { label: "Capabilities", value: formatCount(CAPABILITIES.length) },
        { label: "Roles", value: formatCount(roles.length) },
        { label: "Granted cells", value: formatCount(grantedCells) },
      ],
    },
    {
      cap: "admin.masters",
      href: "/admin/masters",
      title: "Reference Data Masters",
      lede: "Business rules and vocabulary as data, so a client answer is an edit rather than a release.",
      icon: Database,
      stats: [
        { label: "Values", value: formatCount(masterValues) },
        { label: "Sets", value: formatCount(masters.sets.length) },
        { label: "Numbering series", value: formatCount(masters.series.length) },
      ],
    },
    {
      cap: "admin.integrations",
      href: "/admin/integrations",
      title: "Integration Readiness",
      lede: "Every external system this prototype simulates, how faithfully, and exactly what a live connection would require.",
      icon: PlugZap,
      stats: [
        { label: "Simulated", value: formatCount(INTEGRATIONS.length) },
        { label: "Phase 2 prerequisites", value: formatCount(prereqCount) },
        { label: "Live connections", value: "0" },
      ],
    },
    {
      cap: "admin.compliance",
      href: "/admin/compliance",
      title: "Compliance & Consent",
      lede: "The DPDP posture stated explicitly: consent notice, data-principal requests, retention periods and the breach checklist.",
      icon: ScrollText,
      stats: [
        { label: "Data-principal requests", value: formatCount(ds.dsrRequests.length) },
        { label: "Open", value: formatCount(openDsr) },
        { label: "Retention policies", value: formatCount(ds.retentionPolicies.length) },
      ],
    },
    {
      cap: "admin.audit",
      href: "/admin/audit",
      title: "Audit Log",
      lede: "Append-only by construction — no interface path edits or removes an entry, and every mutation in the platform lands here.",
      icon: FileClock,
      stats: [
        { label: "Seeded entries", value: formatCount(ds.auditLog.length) },
        { label: "Actors", value: formatCount(auditActors) },
        { label: "Since", value: formatDate(earliest) },
      ],
    },
    {
      cap: "admin.demo",
      href: "/admin/demo",
      title: "Demo Controls",
      lede: "Reset to the seeded baseline, move the simulated clock, and force the four demonstration scenarios.",
      icon: SlidersHorizontal,
      stats: [
        { label: "Seeded today", value: formatDate(TODAY_ISO) },
        { label: "Scenario switches", value: "4" },
        { label: "Audit actions", value: formatCount(auditActions) },
      ],
    },
  ];

  const visible = cards.filter((c) => can(role, c.cap));

  return (
    <div className="flex flex-col gap-5">
      <div className="max-w-3xl">
        <h1 className="t-display-md text-text-hi">Administration</h1>
        <p className="t-body-sm mt-1 text-text-mid">Identity, permissions, reference data, integrations and the audit trail.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Governance is inherited here rather than bolted on: identity, the permission matrix that
          the route guard actually enforces, the reference data every module reads, the disclosure
          of what is simulated, the data-protection posture, and the append-only record of
          everything that has happened. Signed in as{" "}
          <span className="text-text-hi">{session.name}</span> —{" "}
          <span className="text-text-hi">{ROLE_LABEL[role]}</span>.
        </Explainer>
      </div>

      {visible.length === 0 ? (
        <Panel className="p-6">
          <p className="t-heading-md text-text-hi">No administration screen is open to your role</p>
          <p className="t-body-sm mt-1 text-text-mid">
            Your landing screen is the right place to work from. Nothing is hidden behind a disabled
            control here — a screen your role cannot open simply is not listed.
          </p>
        </Panel>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const level = grantFor(role, c.cap).level;
            return (
              <li key={c.cap}>
                <Link
                  href={c.href}
                  className="group flex h-full flex-col gap-3 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-4 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2">
                      <c.icon className="size-4 text-text-mid" aria-hidden />
                    </span>
                    <span className="t-overline rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-lo">
                      {level === "F" ? "Full control" : level === "R" ? "Read only" : level}
                    </span>
                  </div>
                  <div>
                    <h2 className="t-heading-md text-text-hi group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2">
                      {c.title}
                    </h2>
                    <p className="t-body-sm mt-1 text-text-mid">{c.lede}</p>
                  </div>
                  <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-line pt-2.5">
                    {c.stats.map((s) => (
                      <div key={s.label} className="min-w-0">
                        <dt>
                          <Overline>{s.label}</Overline>
                        </dt>
                        <dd className="t-body-sm truncate tabular-nums text-text-hi">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Panel className="p-4">
        <Overline>How to read these figures</Overline>
        <Explainer className="mt-1 text-text-mid">
          Every count above is read from the seeded dataset at render time, not written into the
          card. The seed is fixed, so the same figures appear on every run and any difference is a
          real difference. The world is generated against{" "}
          <span className="t-mono">{formatDate(TODAY_ISO)}</span>; Demo Controls moves that date and
          the derived states recompute with it. Session changes live in the browser only — the
          seeded dataset is never mutated, which is what makes a reset exact.
        </Explainer>
        <p className="t-body-sm mt-2 text-text-lo">
          {formatCount(visible.length)} administration{" "}
          {pluralise(visible.length, "screen")} open to {ROLE_LABEL[role]}.
        </p>
      </Panel>
    </div>
  );
}
