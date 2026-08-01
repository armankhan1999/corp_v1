"use client";

/**
 * E1-S5 — Global command palette.
 *
 * Self-contained: the component owns the hotkey, the overlay, the grouping and
 * the recents store. It is mounted with a pre-computed, already role-filtered
 * index, so records the role cannot reach are absent from the index entirely
 * rather than rendered and blocked.
 *
 * Wiring note: this file deliberately does not touch `Shell.tsx`. Any surface
 * can open it by dispatching `window.dispatchEvent(new Event(PALETTE_EVENT))`.
 */

import * as React from "react";
import { Explainer } from "@/components/patterns/primitives";
import * as RadixDialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  Building2,
  Clock,
  CornerDownLeft,
  FileText,
  HardHat,
  LayoutGrid,
  Receipt,
  Search,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ model */

export type PaletteType =
  | "customer"
  | "asset"
  | "ticket"
  | "quotation"
  | "invoice"
  | "project"
  | "document"
  | "employee"
  | "screen"
  | "action";

export interface PaletteRecord {
  id: string;
  type: PaletteType;
  /** Primary line — the name, serial or document number. */
  title: string;
  /** Secondary line — the context that disambiguates two similar titles. */
  subtitle: string;
  href: string;
  /** Additional search terms: codes, serials, GSTIN, customer name. */
  hint?: string;
}

interface GroupSpec {
  type: PaletteType;
  label: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Group order is the order the acceptance criteria name. */
const GROUPS: GroupSpec[] = [
  { type: "customer", label: "Customers", badge: "Customer", icon: Building2 },
  { type: "asset", label: "Assets by serial", badge: "Asset", icon: Boxes },
  { type: "ticket", label: "Tickets", badge: "Ticket", icon: Wrench },
  { type: "quotation", label: "Quotations", badge: "Quotation", icon: LayoutGrid },
  { type: "invoice", label: "Invoices", badge: "Invoice", icon: Receipt },
  { type: "project", label: "Projects", badge: "Project", icon: HardHat },
  { type: "document", label: "Documents", badge: "Document", icon: FileText },
  { type: "employee", label: "Employees", badge: "Employee", icon: Users },
  { type: "screen", label: "Screens", badge: "Screen", icon: Search },
  { type: "action", label: "Actions", badge: "Action", icon: Zap },
];

const GROUP_BY_TYPE = new Map(GROUPS.map((g) => [g.type, g]));

/** A record type is a business record; screens and actions are not. */
function isRecordType(t: PaletteType): boolean {
  return t !== "screen" && t !== "action";
}

/* ---------------------------------------------------------------- recents */

export const RECENTS_KEY = "pravaah.v1.recents";
export const RECENTS_LIMIT = 5;
const RECENTS_VERSION = 1;
export const RECENTS_EVENT = "pravaah:recents";
/** Dispatch this on `window` to open the palette from anywhere. */
export const PALETTE_EVENT = "pravaah:command-palette";

interface RecentsFile {
  v: number;
  items: PaletteRecord[];
}

export function readRecents(): PaletteRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentsFile;
    if (!parsed || parsed.v !== RECENTS_VERSION || !Array.isArray(parsed.items)) return [];
    return parsed.items.slice(0, RECENTS_LIMIT);
  } catch {
    return [];
  }
}

/**
 * Records the visit. Any screen may call this on mount so the palette's
 * empty state offers the five most recently visited records.
 */
export function pushRecent(rec: PaletteRecord): void {
  if (typeof window === "undefined") return;
  if (!isRecordType(rec.type)) return;
  try {
    const next = [rec, ...readRecents().filter((r) => !(r.type === rec.type && r.id === rec.id))].slice(
      0,
      RECENTS_LIMIT,
    );
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify({ v: RECENTS_VERSION, items: next } satisfies RecentsFile));
    window.dispatchEvent(new Event(RECENTS_EVENT));
  } catch {
    /* private mode or quota — recents simply stay empty */
  }
}

/* ---------------------------------------------------------------- search */

/**
 * Deterministic ranking: title prefix beats title substring beats identifier
 * beats subtitle. Every whitespace-separated token must match somewhere.
 */
function scoreRecord(rec: PaletteRecord, tokens: string[]): number {
  const title = rec.title.toLowerCase();
  const sub = rec.subtitle.toLowerCase();
  const hint = (rec.hint ?? "").toLowerCase();
  let best = Number.POSITIVE_INFINITY;
  for (const token of tokens) {
    let s = -1;
    if (title.startsWith(token)) s = 0;
    else if (title.includes(token)) s = 10 + title.indexOf(token);
    else if (hint.includes(token)) s = 200 + hint.indexOf(token);
    else if (sub.includes(token)) s = 400 + sub.indexOf(token);
    if (s < 0) return -1;
    best = Math.min(best, s);
  }
  return best;
}

const PER_GROUP_LIMIT = 8;

interface GroupResult {
  spec: GroupSpec;
  items: PaletteRecord[];
}

/* ------------------------------------------------------------- component */

export function CommandPalette({
  records,
  indexNote,
}: {
  /** Already filtered to what this role may reach. */
  records: PaletteRecord[];
  /** Optional honesty note about index coverage, shown in the footer. */
  indexNote?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [recents, setRecents] = React.useState<PaletteRecord[]>([]);
  const priorFocus = React.useRef<HTMLElement | null>(null);

  /* Cmd+K / Ctrl+K anywhere, plus a window event so any control can open it. */
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onEvent);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onEvent);
    };
  }, []);

  React.useEffect(() => {
    function sync() {
      setRecents(readRecents());
    }
    sync();
    window.addEventListener(RECENTS_EVENT, sync);
    return () => window.removeEventListener(RECENTS_EVENT, sync);
  }, []);

  function handleOpenChange(next: boolean) {
    if (next) {
      priorFocus.current = document.activeElement as HTMLElement | null;
      setSearch("");
      setRecents(readRecents());
    }
    setOpen(next);
    if (!next) {
      // Radix restores focus itself; this is the belt-and-braces path for the
      // case where the prior element was removed or focus fell to the body.
      window.setTimeout(() => {
        const el = priorFocus.current;
        if (el && document.body.contains(el) && document.activeElement === document.body) el.focus();
      }, 0);
    }
  }

  const tokens = React.useMemo(
    () => search.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [search],
  );

  const grouped = React.useMemo<GroupResult[]>(() => {
    if (tokens.length === 0) return [];
    const buckets = new Map<PaletteType, { rec: PaletteRecord; s: number }[]>();
    for (const rec of records) {
      const s = scoreRecord(rec, tokens);
      if (s < 0) continue;
      const list = buckets.get(rec.type);
      if (list) list.push({ rec, s });
      else buckets.set(rec.type, [{ rec, s }]);
    }
    const out: GroupResult[] = [];
    for (const spec of GROUPS) {
      const list = buckets.get(spec.type);
      if (!list || list.length === 0) continue;
      list.sort((a, b) => a.s - b.s || a.rec.title.localeCompare(b.rec.title));
      out.push({ spec, items: list.slice(0, PER_GROUP_LIMIT).map((x) => x.rec) });
    }
    return out;
  }, [records, tokens]);

  const totalMatches = grouped.reduce((n, g) => n + g.items.length, 0);
  const staticGroups = React.useMemo<GroupResult[]>(
    () =>
      GROUPS.filter((g) => !isRecordType(g.type))
        .map((spec) => ({ spec, items: records.filter((r) => r.type === spec.type) }))
        .filter((g) => g.items.length > 0),
    [records],
  );

  function select(rec: PaletteRecord) {
    pushRecent(rec);
    setOpen(false);
    router.push(rec.href);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={handleOpenChange}
      label="Global command palette"
      shouldFilter={false}
      loop
      overlayClassName="fixed inset-0 z-50 bg-[var(--overlay)]"
      contentClassName={cn(
        "fixed left-1/2 top-[10vh] z-50 w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2",
        "overflow-hidden rounded-md border border-line-strong bg-surface-1",
      )}
      style={{ boxShadow: "var(--shadow-e2)" }}
    >
      <RadixDialog.Title className="sr-only">Command palette</RadixDialog.Title>
      <RadixDialog.Description className="sr-only">
        Search customers, assets by serial, tickets, quotations, invoices, projects, documents,
        employees, screens and actions. Arrow keys move, Enter opens, Escape closes.
      </RadixDialog.Description>

      <div className="flex items-center gap-2 border-b border-line px-3">
        <Search className="size-4 shrink-0 text-text-lo" aria-hidden />
        <Command.Input
          autoFocus
          value={search}
          onValueChange={setSearch}
          placeholder="Search records, screens and actions…"
          className="h-12 w-full bg-transparent text-[0.9375rem] text-text-hi outline-none placeholder:text-text-lo"
        />
        <kbd className="t-mono hidden rounded-md border border-line px-1 text-[0.6875rem] text-text-lo sm:inline">
          Esc
        </kbd>
      </div>

      <Command.List className="max-h-[52vh] overflow-y-auto overscroll-contain p-1.5">
        {tokens.length === 0 ? (
          <>
            <Command.Group
              heading={
                <GroupHeading
                  icon={Clock}
                  label={recents.length > 0 ? "Recently visited" : "Recently visited — nothing yet"}
                />
              }
            >
              {recents.length > 0 ? (
                recents.map((rec) => (
                  <Row key={`recent:${rec.type}:${rec.id}`} rec={rec} onSelect={select} recent />
                ))
              ) : (
                <Explainer className="px-2 py-2 text-text-lo">
                  Open a customer, asset, ticket, quotation, invoice, project, document or employee
                  and the five most recent appear here.
                </Explainer>
              )}
            </Command.Group>
            {staticGroups.map((g) => (
              <Command.Group key={g.spec.type} heading={<GroupHeading icon={g.spec.icon} label={g.spec.label} />}>
                {g.items.map((rec) => (
                  <Row key={`${rec.type}:${rec.id}`} rec={rec} onSelect={select} />
                ))}
              </Command.Group>
            ))}
          </>
        ) : totalMatches === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="t-body text-text-hi">No match for “{search.trim()}”</p>
            <p className="t-body-sm mx-auto mt-1 max-w-sm text-text-mid">
              Try a customer name, an asset serial, a document number such as BC/INV/2526/0184, or a
              screen name. Records your role cannot access are not indexed.
            </p>
          </div>
        ) : (
          grouped.map((g) => (
            <Command.Group key={g.spec.type} heading={<GroupHeading icon={g.spec.icon} label={g.spec.label} />}>
              {g.items.map((rec) => (
                <Row key={`${rec.type}:${rec.id}`} rec={rec} onSelect={select} />
              ))}
            </Command.Group>
          ))
        )}
      </Command.List>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-2 px-3 py-2">
        <Hint keys={[ArrowUp, ArrowDown]} label="Navigate" />
        <Hint keys={[CornerDownLeft]} label="Open" />
        <span className="t-body-sm text-text-lo">
          <kbd className="t-mono rounded-md border border-line px-1 text-[0.6875rem]">Esc</kbd> Close
        </span>
        <span className="t-body-sm ml-auto text-text-lo">
          {indexNote ?? `${records.length.toLocaleString("en-IN")} indexed for your role`}
        </span>
      </div>
    </Command.Dialog>
  );
}

/* -------------------------------------------------------------- fragments */

function GroupHeading({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="t-overline flex items-center gap-1.5 px-2 pb-1 pt-2.5 text-text-lo">
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

function Row({
  rec,
  onSelect,
  recent,
}: {
  rec: PaletteRecord;
  onSelect: (rec: PaletteRecord) => void;
  recent?: boolean;
}) {
  const spec = GROUP_BY_TYPE.get(rec.type);
  const mono = rec.type === "asset" || rec.type === "invoice" || rec.type === "quotation" || rec.type === "ticket";
  return (
    <Command.Item
      value={`${recent ? "recent:" : ""}${rec.type}:${rec.id}`}
      onSelect={() => onSelect(rec)}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5",
        "data-[selected=true]:bg-surface-3 data-[selected=true]:text-text-hi",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-text-hi", mono ? "t-mono" : "t-body")}>{rec.title}</span>
        <span className="t-body-sm block truncate text-text-lo">{rec.subtitle}</span>
      </span>
      <span className="t-overline shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid">
        {spec?.badge ?? rec.type}
      </span>
    </Command.Item>
  );
}

function Hint({
  keys,
  label,
}: {
  keys: React.ComponentType<{ className?: string }>[];
  label: string;
}) {
  return (
    <span className="t-body-sm flex items-center gap-1 text-text-lo">
      {keys.map((K, i) => (
        <kbd key={i} className="grid size-4 place-items-center rounded-md border border-line">
          <K className="size-2.5" aria-hidden />
        </kbd>
      ))}
      {label}
    </span>
  );
}
