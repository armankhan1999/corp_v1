"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleSlash, Lock, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import { can } from "@/lib/rbac/matrix";
import type { Role } from "@/lib/schemas/enums";
import { Panel } from "@/components/patterns/primitives";
import { highlightSegments } from "./search";
import { holderLabels, type Denial } from "./access";

/** Overlay state lives in localStorage, so it is read only after mount. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => { setHydrated(true); }, []);
  return hydrated;
}

/* ------------------------------------------------------------- highlight */

export function Highlight({ text, terms, className }: { text: string; terms: string[]; className?: string }) {
  if (!terms.length) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {highlightSegments(text, terms).map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="rounded-md bg-warn-bg px-[1px] text-warn">{seg.text}</mark>
        ) : (
          <React.Fragment key={i}>{seg.text}</React.Fragment>
        ),
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ tabs */

interface Tab { href: string; label: string; show: (role: Role) => boolean }

const TABS: Tab[] = [
  { href: "/vault", label: "Browse", show: (r) => can(r, "vault") },
  { href: "/vault/expiring", label: "Expiring", show: (r) => can(r, "vault") },
  { href: "/vault/ask", label: "Ask the Vault", show: (r) => can(r, "vaultAsk") },
  { href: "/vault/activity", label: "Activity", show: (r) => can(r, "vault") },
  { href: "/vault/feedback", label: "Answer feedback", show: (r) => can(r, "admin.compliance") || can(r, "admin.users") },
];

export function VaultTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Document Vault" className="flex flex-wrap items-center gap-1 border-b border-line">
      {TABS.filter((t) => t.show(role)).map((t) => {
        const active = t.href === "/vault" ? pathname === "/vault" || /^\/vault\/DOC-/.test(pathname) : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "t-body-sm -mb-px border-b-2 px-3 py-2 transition-colors duration-150",
              active
                ? "border-b-primary-500 text-text-hi"
                : "border-b-transparent text-text-mid hover:text-text-hi",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------- denial surfaces */

/**
 * E14-S2 permission-denied state. It explains the restriction and names the
 * roles that hold access, and it never leaks a field of the denied record.
 */
export function DenialPanel({
  denial, title = "Access not permitted", extra,
}: { denial: Denial; title?: string; extra?: React.ReactNode }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start gap-3">
        <ShieldX className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div className="min-w-0">
          <h2 className="t-heading-md text-text-hi">{title}</h2>
          <p className="t-body-sm mt-1.5 text-text-mid">{denial.reason}</p>
          {denial.holders.length > 0 ? (
            <p className="t-body-sm mt-2 text-text-mid">
              Access is held by <span className="text-text-hi">{holderLabels(denial.holders)}</span>.
            </p>
          ) : null}
          <p className="t-body-sm mt-2 text-text-lo">
            No title, type or other metadata for the requested document has been disclosed. The denial has been
            written to the vault activity log against your user.
          </p>
          {extra}
        </div>
      </div>
    </Panel>
  );
}

export function LockedBranch({ label, denial }: { label: string; denial: Denial }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-line px-3 py-2">
      <Lock className="mt-0.5 size-3.5 shrink-0 text-text-lo" aria-hidden />
      <div className="min-w-0">
        <p className="t-body-sm text-text-mid">{label}</p>
        <p className="t-body-sm mt-0.5 text-text-lo">{denial.reason}</p>
        {denial.holders.length ? (
          <p className="t-body-sm mt-0.5 text-text-lo">Held by {holderLabels(denial.holders)}.</p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ misc */

/** AI-G10 — every AI response is marked as deterministic prototype behaviour. */
export function PrototypeChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "t-overline inline-flex items-center gap-1 rounded-md border border-sim/60 bg-sim-bg px-1.5 py-0.5 text-sim",
        className,
      )}
      title="Phase 1 answers are deterministic and drawn from a seeded corpus. No model is called."
    >
      Deterministic · Phase 1
    </span>
  );
}

export function FilteredEmpty({
  filterSummary, onClear,
}: { filterSummary: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <CircleSlash className="size-8 text-text-lo" aria-hidden />
      <div>
        <p className="t-heading-md text-text-hi">No document matches these filters</p>
        <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
          The vault is not empty — your filters are. Currently applied: {filterSummary}.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="t-body-sm rounded-md border border-line-strong px-3 py-1.5 text-text-hi hover:bg-surface-2"
      >
        Clear filters
      </button>
    </div>
  );
}

export function RowSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-9 items-center gap-3 border-b border-line px-3">
          <div className="pv-skeleton h-3 w-[28%]" />
          <div className="pv-skeleton h-3 w-[14%]" />
          <div className="pv-skeleton h-3 w-[18%]" />
          <div className="pv-skeleton ml-auto h-3 w-[10%]" />
        </div>
      ))}
    </div>
  );
}
