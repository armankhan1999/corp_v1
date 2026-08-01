"use client";

/**
 * E7-S5 — the reorder list, ordered by service impact rather than by a static
 * minimum level.
 *
 * Two things make this screen different from a stock report:
 *
 *  1. **Velocity** — the default order is a movement-velocity score derived from
 *     issue frequency over a trailing window, normalised to issues per 30 days
 *     so the number reads the same whichever window is selected.
 *  2. **Service impact overrides velocity** — a line that actually stopped a
 *     repair sorts above everything ranked only by velocity, carries the
 *     referencing job card as a working link, and is notified immediately
 *     rather than batched into the daily digest.
 *
 * The membership rule, the velocity formula and the notification treatment are
 * all printed on the screen, so no figure here has to be taken on trust.
 */

import * as React from "react";
import Link from "next/link";
import {
  AlarmClock, BellRing, CalendarClock, ClipboardList, FileStack, Info, PackageX, Send,
  ShieldAlert, ShoppingCart, Truck,
} from "lucide-react";
import { abbreviateINR, formatCount, formatDateTime, formatINR, formatQty } from "@/lib/format";
import { canCreate, canWrite, isReadOnlyRole } from "@/lib/rbac/matrix";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import type * as T from "@/lib/schemas/entities";
import { Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import {
  CATEGORY_LABEL, reorderRows, sortReorder, useInventory, velocityOf,
  type InvView, type ReorderRow,
} from "./model";
import {
  PO_APPROVAL_THRESHOLD, nextCounter, notify, pad, useMutate, writeAudit, type Actor, type Overlay,
} from "./store";
import { DataGrid, GridCheckbox, type GridColumn } from "./grid";
import {
  ActionResult, Btn, Field, FilteredEmpty, LinkBtn, MetricStrip, Modal, Note, Num, NumInput,
  NumberStepper, PageHeader, PageSkeleton, SearchField, Select, SelectField, TextArea, Toolbar,
} from "./ui";

type SortKey = "IMPACT" | "VELOCITY" | "SHORTFALL" | "LEAD" | "VALUE" | "CODE";

const SORT_LABEL: Record<SortKey, string> = {
  IMPACT: "Service impact, then velocity",
  VELOCITY: "Movement velocity",
  SHORTFALL: "Shortfall against level",
  LEAD: "Lead time",
  VALUE: "Suggested order value",
  CODE: "Item code",
};

/** The seed plan's deliberate figure, kept visible beside the ledger truth. */
const SEED_PLAN_BELOW_REORDER = 168;

function applySort(rows: ReorderRow[], key: SortKey): ReorderRow[] {
  if (key === "IMPACT") return sortReorder(rows);
  const copy = [...rows];
  switch (key) {
    case "VELOCITY":
      return copy.sort((a, b) => b.velocity - a.velocity || a.item.code.localeCompare(b.item.code));
    case "SHORTFALL":
      return copy.sort(
        (a, b) =>
          b.reorderLevel - b.onHand - (a.reorderLevel - a.onHand) || a.item.code.localeCompare(b.item.code),
      );
    case "LEAD":
      return copy.sort((a, b) => b.leadTimeDays - a.leadTimeDays || a.item.code.localeCompare(b.item.code));
    case "VALUE":
      return copy.sort((a, b) => b.value - a.value || a.item.code.localeCompare(b.item.code));
    case "CODE":
      return copy.sort((a, b) => a.item.code.localeCompare(b.item.code));
  }
}

export function ReorderClient({
  initialQuery,
  initialCriticalOnly,
  initialTrailing,
}: {
  initialQuery: string;
  initialCriticalOnly: boolean;
  initialTrailing: number;
}) {
  const { view, ready, actor } = useInventory();
  const [query, setQuery] = React.useState(initialQuery);
  const [criticalOnly, setCriticalOnly] = React.useState(initialCriticalOnly);
  const [supplier, setSupplier] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [trailing, setTrailing] = React.useState(initialTrailing);
  const [sort, setSort] = React.useState<SortKey>("IMPACT");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [poOpen, setPoOpen] = React.useState(false);
  const [result, setResult] = React.useState<{ tone: "ok" | "warn" | "info"; title: string; body: string } | null>(null);

  const all = React.useMemo(() => (view ? reorderRows(view, trailing) : []), [view, trailing]);

  if (!ready || !view) return <PageSkeleton metrics={5} rows={16} columns={10} />;

  const q = query.trim().toLowerCase();
  const filtered = all.filter((r) => {
    if (criticalOnly && !r.critical) return false;
    if (supplier && r.supplierId !== supplier) return false;
    if (category && r.item.category !== category) return false;
    if (!q) return true;
    return (
      r.item.code.toLowerCase().includes(q) ||
      r.item.description.toLowerCase().includes(q) ||
      r.item.oemPartNumber.toLowerCase().includes(q)
    );
  });
  const rows = applySort(filtered, sort);

  const criticalRows = all.filter((r) => r.critical);
  const openCritical = criticalRows.filter((r) => r.critical?.open);
  const outOfStock = all.filter((r) => r.onHand <= 0);
  const suggestedValue = all.reduce((s, r) => s + r.value, 0);
  const selectedRows = rows.filter((r) => selected.has(r.item.id));
  const mayOrder = canCreate(actor.role, "purchaseOrders") && !isReadOnlyRole(actor.role);
  const mayNotify = canWrite(actor.role, "reorder") && !isReadOnlyRole(actor.role);

  const activeFilters: string[] = [];
  if (q) activeFilters.push(`search "${query.trim()}"`);
  if (criticalOnly) activeFilters.push("service-critical only");
  if (supplier) activeFilters.push(`supplier ${view.supplierById.get(supplier)?.name ?? supplier}`);
  if (category) activeFilters.push(`category ${CATEGORY_LABEL[category as T.Item["category"]] ?? category}`);

  function clearFilters() {
    setQuery("");
    setCriticalOnly(false);
    setSupplier("");
    setCategory("");
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.item.id));
  const someVisibleSelected = rows.some((r) => selected.has(r.item.id));

  const columns: GridColumn<ReorderRow>[] = [
    {
      key: "select",
      header: "Select for a purchase order",
      width: "32px",
      srHeader: true,
      headerCell: mayOrder ? (
        <GridCheckbox
          checked={allVisibleSelected}
          indeterminate={someVisibleSelected}
          label={allVisibleSelected ? "Clear the selection" : `Select all ${rows.length} listed lines`}
          onChange={(next) =>
            setSelected(() => (next ? new Set(rows.map((r) => r.item.id)) : new Set<string>()))
          }
        />
      ) : (
        <span className="sr-only">Select</span>
      ),
      cell: (r) =>
        mayOrder ? (
          <GridCheckbox
            checked={selected.has(r.item.id)}
            onChange={() => toggle(r.item.id)}
            label={`Select ${r.item.code} for a purchase order`}
          />
        ) : null,
    },
    {
      key: "code",
      header: "Item code",
      width: "116px",
      cell: (r) => (
        <Link href={`/inventory/stock?q=${encodeURIComponent(r.item.code)}`} className="t-mono block truncate text-text-hi hover:underline">
          {r.item.code}
        </Link>
      ),
    },
    {
      key: "description",
      header: "Description",
      width: "minmax(200px,1fr)",
      cell: (r) => (
        <span className="block truncate text-text-mid" title={r.item.description}>
          {r.item.description}
        </span>
      ),
    },
    {
      key: "flag",
      header: "Service impact",
      width: "210px",
      cell: (r) =>
        r.critical ? (
          <span className="flex items-center gap-1.5">
            <StatusBadge tone={r.critical.open ? "danger" : "warn"}>
              {r.critical.open ? "Stopped a repair" : "Caused a revisit"}
            </StatusBadge>
            {r.critical.jobCardId ? (
              <Link
                href={`/service/job-cards/${r.critical.jobCardId}`}
                className="t-mono truncate text-info hover:underline"
                title={r.critical.reason}
              >
                {r.critical.jobCardNumber}
              </Link>
            ) : (
              <span className="t-mono truncate text-text-lo">{r.critical.jobCardNumber}</span>
            )}
          </span>
        ) : (
          <span className="t-body-sm text-text-lo">Velocity-ranked</span>
        ),
    },
    {
      key: "onHand",
      header: "On hand",
      width: "84px",
      align: "right",
      cell: (r) => (
        <Num tone={r.onHand <= 0 ? "danger" : r.onHand <= r.reorderLevel ? "warn" : "default"}>
          {formatQty(r.onHand)}
        </Num>
      ),
    },
    {
      key: "level",
      header: "Level",
      width: "72px",
      align: "right",
      cell: (r) => <Num tone="lo">{formatQty(r.reorderLevel)}</Num>,
    },
    {
      key: "suggest",
      header: "Suggested",
      width: "92px",
      align: "right",
      cell: (r) => <Num>{formatQty(r.suggestedQty, r.item.uom)}</Num>,
    },
    {
      key: "lead",
      header: "Lead days",
      width: "84px",
      align: "right",
      cell: (r) => <Num tone={r.leadTimeDays >= 30 ? "warn" : "default"}>{formatCount(r.leadTimeDays)}</Num>,
    },
    {
      key: "rate",
      header: "Last rate",
      width: "104px",
      align: "right",
      cell: (r) =>
        r.lastPurchaseRate === null ? (
          <Num tone="lo">Never bought</Num>
        ) : (
          <Num>{formatINR(r.lastPurchaseRate)}</Num>
        ),
    },
    {
      key: "supplier",
      header: "Preferred supplier",
      width: "180px",
      cell: (r) => {
        const s = r.supplierId ? view.supplierById.get(r.supplierId) : null;
        return s ? (
          <Link href={`/inventory/purchase?tab=suppliers&focus=${s.id}`} className="block truncate text-text-mid hover:underline" title={s.name}>
            {s.name}
          </Link>
        ) : (
          <span className="text-text-lo">Not established</span>
        );
      },
    },
    {
      key: "velocity",
      header: "Velocity",
      width: "92px",
      align: "right",
      cell: (r) => (
        <Num tone={r.velocity > 0 ? "default" : "lo"}>
          {r.velocity > 0 ? `${r.velocity.toFixed(2)}/30d` : "Dormant"}
        </Num>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Reorder list"
        lede="Every line at or below its reorder level, ranked by what a shortage actually costs. Lines that stopped a repair sit above lines ranked only by how fast they move."
        right={
          <>
            <LinkBtn href="/inventory/movements" icon={ClipboardList}>
              Parts issue
            </LinkBtn>
            <LinkBtn href="/inventory/purchase" icon={FileStack}>
              Purchase orders
            </LinkBtn>
            {mayOrder ? (
              <Btn
                variant="primary"
                icon={ShoppingCart}
                onClick={() => setPoOpen(true)}
                disabled={selectedRows.length === 0}
              >
                Create purchase order
                {selectedRows.length ? ` · ${formatCount(selectedRows.length)}` : ""}
              </Btn>
            ) : null}
          </>
        }
      />

      {result ? (
        <ActionResult tone={result.tone} title={result.title} onDismiss={() => setResult(null)}>
          {result.body}
        </ActionResult>
      ) : null}

      <MetricStrip
        columns={5}
        metrics={[
          {
            label: "At or below level",
            value: formatCount(all.length),
            icon: PackageX,
            tone: "warn",
            sub: `Seed plan places ${formatCount(SEED_PLAN_BELOW_REORDER)} deliberately below level`,
          },
          {
            label: "Service-critical",
            value: formatCount(criticalRows.length),
            tone: criticalRows.length ? "danger" : "ok",
            icon: ShieldAlert,
            sub: `${formatCount(openCritical.length)} still holding a job card open`,
          },
          {
            label: "Out of stock",
            value: formatCount(outOfStock.length),
            tone: outOfStock.length ? "danger" : "ok",
            icon: PackageX,
            sub: "Nothing on hand anywhere in the ledger",
          },
          {
            label: "Suggested order value",
            value: abbreviateINR(suggestedValue),
            icon: ShoppingCart,
            sub: "At last purchase rate, standard cost where never bought",
          },
          {
            label: "Longest lead time",
            value: `${formatCount(all.reduce((m, r) => Math.max(m, r.leadTimeDays), 0))} d`,
            icon: Truck,
            sub: "Order-by dates follow the lead time on each line",
          },
        ]}
      />

      <NotificationPanel
        view={view}
        actor={actor}
        openCritical={openCritical}
        routine={all.filter((r) => !r.critical)}
        mayNotify={mayNotify}
        onRaised={(tone, title, body) => setResult({ tone, title, body })}
      />

      <Panel>
        <Toolbar>
          <SearchField
            value={query}
            onChange={setQuery}
            label="Search the reorder list"
            placeholder="Item code, description, OEM part number…"
            width="w-80"
          />
          <SelectField
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v)}
            options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({ value: k, label: SORT_LABEL[k] }))}
          />
          <SelectField
            label="Category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "All categories" },
              ...(Object.keys(CATEGORY_LABEL) as T.Item["category"][])
                .filter((c) => c !== "SERVICE")
                .map((c) => ({ value: c as string, label: CATEGORY_LABEL[c] })),
            ]}
          />
          <SelectField
            label="Supplier"
            value={supplier}
            onChange={setSupplier}
            options={[
              { value: "", label: "All suppliers" },
              ...view.suppliers.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <NumberStepper
            label="Velocity window"
            value={trailing}
            onChange={setTrailing}
            min={30}
            max={730}
            step={30}
            suffix="days"
          />
          <label className="flex min-h-8 items-center gap-1.5">
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(e) => setCriticalOnly(e.target.checked)}
              className="size-3.5 accent-[var(--primary-600)]"
            />
            <span className="t-body-sm text-text-mid">Service-critical only</span>
          </label>
          <span className="t-body-sm ml-auto text-text-lo">
            {formatCount(rows.length)} of {formatCount(all.length)} lines
            {selectedRows.length ? ` · ${formatCount(selectedRows.length)} selected` : ""}
          </span>
        </Toolbar>

        {rows.length === 0 ? (
          activeFilters.length ? (
            <FilteredEmpty filters={activeFilters} total={all.length} onClear={clearFilters} />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <ShoppingCart className="size-8 text-ok" aria-hidden />
              <div>
                <p className="t-heading-md text-text-hi">Nothing is at or below its reorder level</p>
                <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
                  Every carried line is holding above the level set on the item master. The list rebuilds itself from
                  the ledger on every read, so a single issue can bring a line back onto it.
                </p>
              </div>
              <LinkBtn href="/inventory/stock" icon={ClipboardList}>
                Stock balances
              </LinkBtn>
            </div>
          )
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            rowKey={(r) => r.item.id}
            ariaLabel="Items at or below reorder level"
            height={540}
            rowTone={(r) => (r.critical?.open ? "danger" : r.critical ? "warn" : r.onHand <= 0 ? "warn" : null)}
          />
        )}
      </Panel>

      <FormulaPanel view={view} trailing={trailing} total={all.length} critical={criticalRows.length} />

      <CreatePOModal
        open={poOpen}
        rows={selectedRows}
        view={view}
        actor={actor}
        onClose={() => setPoOpen(false)}
        onCreated={(tone, title, body) => {
          setResult({ tone, title, body });
          setSelected(new Set());
          setPoOpen(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------- notification split */

function NotificationPanel({
  view,
  actor,
  openCritical,
  routine,
  mayNotify,
  onRaised,
}: {
  view: InvView;
  actor: Actor;
  openCritical: ReorderRow[];
  routine: ReorderRow[];
  mayNotify: boolean;
  onRaised: (tone: "ok" | "info", title: string, body: string) => void;
}) {
  const mutate = useMutate();
  const store = view.ds.users.find((u) => u.role === "STORE_INCHARGE") ?? null;
  const manager = view.ds.users.find((u) => u.role === "SERVICE_MANAGER") ?? null;
  const sent = view.notices.filter((n) => !n.digest && n.title.includes("Service-critical shortage")).length;
  const digested = view.notices.filter((n) => n.digest).length;
  const digestValue = routine.reduce((s, r) => s + r.value, 0);

  function raiseImmediate() {
    const at = new Date().toISOString();
    mutate((o: Overlay) => {
      for (const target of [store, manager]) {
        if (!target) continue;
        notify(o, {
          at,
          toUserId: target.id,
          toLabel: target.name,
          channel: "IN_APP",
          digest: false,
          title: "Service-critical shortage",
          body: `${formatCount(openCritical.length)} ${
            openCritical.length === 1 ? "line is" : "lines are"
          } holding a job card open: ${openCritical
            .slice(0, 3)
            .map((r) => r.item.code)
            .join(", ")}${openCritical.length > 3 ? ` and ${openCritical.length - 3} more` : ""}.`,
          href: "/inventory/reorder?critical=1",
        });
      }
      writeAudit(o, actor, {
        at,
        action: "SIMULATED_INTEGRATION",
        entityType: "Notification",
        entityId: "REORDER-CRITICAL",
        entityLabel: "Service-critical shortage notice",
        summary: `Immediate notice raised for ${openCritical.length} service-critical ${
          openCritical.length === 1 ? "line" : "lines"
        }`,
        before: null,
        after: `Store In-charge and Service Manager notified at ${formatDateTime(at)}`,
      });
    });
    onRaised(
      "ok",
      "Service-critical notices sent immediately",
      `${store?.name ?? "The Store In-charge"} and ${manager?.name ?? "the Service Manager"} were notified without waiting for the digest, because these lines are holding repairs open.`,
    );
  }

  function queueDigest() {
    const at = new Date().toISOString();
    mutate((o: Overlay) => {
      if (store) {
        notify(o, {
          at,
          toUserId: store.id,
          toLabel: store.name,
          channel: "EMAIL",
          digest: true,
          title: "Daily reorder digest",
          body: `${formatCount(routine.length)} routine ${
            routine.length === 1 ? "line" : "lines"
          } at or below level, ${abbreviateINR(digestValue)} suggested order value. Batched for the 18:00 digest rather than sent one at a time.`,
          href: "/inventory/reorder",
        });
      }
      writeAudit(o, actor, {
        at,
        action: "SIMULATED_INTEGRATION",
        entityType: "Notification",
        entityId: "REORDER-DIGEST",
        entityLabel: "Daily reorder digest",
        summary: `Routine shortages batched into the daily digest — ${routine.length} lines`,
        before: null,
        after: `Queued for 18:00 · ${abbreviateINR(digestValue)}`,
      });
    });
    onRaised(
      "info",
      "Routine shortages queued for the daily digest",
      `${formatCount(routine.length)} routine lines were batched rather than sent individually. Only service impact earns an immediate notification.`,
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          title="Immediate — service-critical"
          sub="A shortage that stopped a repair notifies the Store In-charge and the Service Manager the moment it is detected."
          right={<BellRing className="size-4 text-danger" aria-hidden />}
        />
        <div className="flex flex-col gap-3 p-3">
          <p className="t-body-sm text-text-mid">
            <span className="t-display-md block text-danger" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCount(openCritical.length)}
            </span>
            {openCritical.length === 1 ? "line is" : "lines are"} holding a job card open right now. Recipients:{" "}
            <span className="text-text-hi">{store?.name ?? "Store In-charge"}</span> ·{" "}
            <span className="text-text-hi">{manager?.name ?? "Service Manager"}</span>.
          </p>
          {openCritical.length ? (
            <ul className="flex flex-col gap-1">
              {openCritical.slice(0, 4).map((r) => (
                <li key={r.item.id} className="t-body-sm flex flex-wrap items-center gap-2">
                  <span className="t-mono text-text-hi">{r.item.code}</span>
                  <span className="min-w-0 flex-1 truncate text-text-mid">{r.item.description}</span>
                  {r.critical?.jobCardId ? (
                    <Link href={`/service/job-cards/${r.critical.jobCardId}`} className="t-mono text-info hover:underline">
                      {r.critical.jobCardNumber}
                    </Link>
                  ) : null}
                </li>
              ))}
              {openCritical.length > 4 ? (
                <li className="t-body-sm text-text-lo">and {formatCount(openCritical.length - 4)} more</li>
              ) : null}
            </ul>
          ) : (
            <p className="t-body-sm text-text-lo">No shortage is currently holding a repair open.</p>
          )}
          {mayNotify ? (
            <Btn variant="secondary" icon={Send} onClick={raiseImmediate} disabled={openCritical.length === 0}>
              Raise the immediate notice
            </Btn>
          ) : (
            <p className="t-body-sm text-text-lo">
              {ROLE_LABEL[actor.role]} may read the reorder list but does not raise store notifications.
            </p>
          )}
          {sent > 0 ? (
            <p className="t-body-sm text-ok">
              {formatCount(sent)} immediate {sent === 1 ? "notice" : "notices"} raised in this session.
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Batched — routine daily digest"
          sub="Everything else waits for one digest a day, so a store keeper is not paged for a filter that is one unit under its level."
          right={<CalendarClock className="size-4 text-text-lo" aria-hidden />}
        />
        <div className="flex flex-col gap-3 p-3">
          <p className="t-body-sm text-text-mid">
            <span className="t-display-md block text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatCount(routine.length)}
            </span>
            routine lines, {abbreviateINR(digestValue)} suggested order value. Next digest{" "}
            <span className="text-text-hi">18:00 today</span>, one email to the Store In-charge.
          </p>
          <div className="rounded-md border border-line bg-surface-2 p-2.5">
            <span className="t-overline text-text-lo">Digest preview</span>
            <p className="t-body-sm mt-1 text-text-mid">
              Top movers below level:{" "}
              {routine
                .slice()
                .sort((a, b) => b.velocity - a.velocity)
                .slice(0, 3)
                .map((r) => `${r.item.code} (${r.velocity.toFixed(2)}/30d)`)
                .join(", ") || "none"}
              .
            </p>
          </div>
          {mayNotify ? (
            <Btn variant="secondary" icon={AlarmClock} onClick={queueDigest} disabled={routine.length === 0}>
              Queue tonight&rsquo;s digest
            </Btn>
          ) : null}
          {digested > 0 ? (
            <p className="t-body-sm text-info">
              {formatCount(digested)} {digested === 1 ? "digest" : "digests"} queued in this session.
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------ formula panel */

function FormulaPanel({
  view,
  trailing,
  total,
  critical,
}: {
  view: InvView;
  trailing: number;
  total: number;
  critical: number;
}) {
  const sample = view.items.find((i) => (view.issueEvents.get(i.id)?.length ?? 0) > 2) ?? null;
  const sampleVelocity = sample ? velocityOf(view, sample.id, trailing) : null;

  return (
    <Panel>
      <PanelHeader
        title="How this list is built"
        sub="Every rule that decides membership and order, printed rather than implied."
        right={<Info className="size-4 text-text-lo" aria-hidden />}
      />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="t-overline text-text-lo">Membership</dt>
          <dd className="t-body-sm text-text-mid">
            An active, stocked line with a reorder level above zero and at least one movement in the ledger, whose
            on-hand quantity across all locations is at or below that level. Machines and service lines are excluded
            — they are supplied against an order, never shelved.{" "}
            <span className="text-text-hi">{formatCount(total)}</span> lines qualify against the ledger today. The
            seed plan places <span className="text-text-hi">{formatCount(SEED_PLAN_BELOW_REORDER)}</span> lines
            deliberately below level; the balance fall under it through issue history and opening allocation. The
            ledger figure governs, because it is recomputed from movements on every read.
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="t-overline text-text-lo">Movement velocity</dt>
          <dd className="t-body-sm text-text-mid">
            Issues counted over the trailing <span className="text-text-hi">{formatCount(trailing)}</span> days,
            normalised to issues per 30 days, so the score reads the same whichever window is chosen. Quantity is
            deliberately ignored — frequency is what predicts the next stock-out.
            {sample && sampleVelocity ? (
              <>
                {" "}
                Worked example: <span className="t-mono text-text-hi">{sample.code}</span> was issued{" "}
                {formatCount(sampleVelocity.issues)} times in {formatCount(trailing)} days ={" "}
                <span className="text-text-hi">{sampleVelocity.score.toFixed(2)}</span> per 30 days.
              </>
            ) : null}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="t-overline text-text-lo">Service-critical override</dt>
          <dd className="t-body-sm text-text-mid">
            A line is service-critical when a parts request against it moved a job card to Awaiting parts, or when a
            short issue left a job card waiting. Those{" "}
            <span className="text-text-hi">{formatCount(critical)}</span> lines sort above every velocity-ranked
            line and carry the referencing job card as a link, because a repair stopped is a cost the velocity score
            cannot see.
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="t-overline text-text-lo">Suggested quantity and value</dt>
          <dd className="t-body-sm text-text-mid">
            The greater of the item&rsquo;s reorder quantity and the gap back to its level. Value uses the last
            purchase rate for that line where one exists, and the standard cost where the line has never been
            bought. Both are stated on the row, so the number can be argued with.
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

/* -------------------------------------------------------------- PO creation */

interface DraftGroup {
  supplierId: string | null;
  supplier: T.Supplier | null;
  lines: { row: ReorderRow; qty: number }[];
}

function CreatePOModal({
  open,
  rows,
  view,
  actor,
  onClose,
  onCreated,
}: {
  open: boolean;
  rows: ReorderRow[];
  view: InvView;
  actor: Actor;
  onClose: () => void;
  onCreated: (tone: "ok" | "warn", title: string, body: string) => void;
}) {
  const mutate = useMutate();
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [note, setNote] = React.useState("");
  const [destination, setDestination] = React.useState(
    view.locations.find((l) => l.kind === "CENTRAL_WAREHOUSE")?.id ?? view.locations[0]?.id ?? "",
  );

  React.useEffect(() => {
    if (!open) return;
    setQty(Object.fromEntries(rows.map((r) => [r.item.id, r.suggestedQty])));
    setNote("");
  }, [open, rows]);

  const groups: DraftGroup[] = React.useMemo(() => {
    const map = new Map<string, DraftGroup>();
    for (const row of rows) {
      const key = row.supplierId ?? "__none";
      let g = map.get(key);
      if (!g) {
        g = {
          supplierId: row.supplierId,
          supplier: row.supplierId ? view.supplierById.get(row.supplierId) ?? null : null,
          lines: [],
        };
        map.set(key, g);
      }
      g.lines.push({ row, qty: qty[row.item.id] ?? row.suggestedQty });
    }
    return [...map.values()].sort((a, b) => (a.supplier?.name ?? "").localeCompare(b.supplier?.name ?? ""));
  }, [rows, qty, view.supplierById]);

  const orphan = groups.find((g) => !g.supplier) ?? null;
  const orderable = groups.filter((g) => g.supplier);
  const totalValue = orderable.reduce(
    (s, g) => s + g.lines.reduce((t, l) => t + l.qty * (l.row.lastPurchaseRate ?? l.row.item.standardCost), 0),
    0,
  );
  const aboveThreshold = orderable.filter(
    (g) => g.lines.reduce((t, l) => t + l.qty * (l.row.lastPurchaseRate ?? l.row.item.standardCost), 0) > PO_APPROVAL_THRESHOLD,
  ).length;

  function create() {
    if (!orderable.length) return;
    const at = new Date().toISOString();
    const today = new Date();
    const numbers: string[] = [];

    mutate((o: Overlay) => {
      for (const g of orderable) {
        if (!g.supplier) continue;
        const n = nextCounter(o, "po", view.purchaseOrders.length);
        const number = `BC/PO/2627/${pad(n, 4)}`;
        const poId = `PO-L${pad(n, 4)}`;
        const maxLead = g.lines.reduce((m, l) => Math.max(m, l.row.leadTimeDays), 7);
        const expected = new Date(today.getTime() + maxLead * 86_400_000);

        const po: T.PurchaseOrder = {
          id: poId,
          number,
          supplierId: g.supplier.id,
          toLocationId: destination,
          orderDate: at,
          expectedDelivery: expected.toISOString(),
          terms: g.supplier.paymentTerms,
          status: "DRAFT",
          approvalRequestId: null,
          raisedByUserId: actor.userId,
        };
        o.newPOs.push(po);

        let lineNo = 0;
        for (const l of g.lines) {
          lineNo += 1;
          o.newPOLines.push({
            id: `POL-L${pad(n, 4)}-${pad(lineNo, 2)}`,
            purchaseOrderId: poId,
            itemId: l.row.item.id,
            qty: l.qty,
            rate: l.row.lastPurchaseRate ?? l.row.item.standardCost,
            qtyReceived: 0,
          });
        }

        const value = g.lines.reduce((t, l) => t + l.qty * (l.row.lastPurchaseRate ?? l.row.item.standardCost), 0);
        numbers.push(number);

        writeAudit(o, actor, {
          at,
          action: "CREATE",
          entityType: "PurchaseOrder",
          entityId: poId,
          entityLabel: number,
          summary: `Draft purchase order raised from the reorder list — ${g.lines.length} ${
            g.lines.length === 1 ? "line" : "lines"
          } to ${g.supplier.name}, ${formatINR(value)}${note.trim() ? ` — ${note.trim()}` : ""}`,
          before: null,
          after: `DRAFT · ${formatINR(value)}${value > PO_APPROVAL_THRESHOLD ? " · approval required before Sent" : ""}`,
        });
      }

      notify(o, {
        at,
        toUserId: actor.userId,
        toLabel: actor.name,
        channel: "IN_APP",
        digest: false,
        title: "Draft purchase orders created",
        body: `${numbers.length} draft ${numbers.length === 1 ? "order" : "orders"} raised from the reorder list, grouped by preferred supplier.`,
        href: "/inventory/purchase?status=DRAFT",
      });
    });

    onCreated(
      aboveThreshold > 0 ? "warn" : "ok",
      `${numbers.length} draft purchase ${numbers.length === 1 ? "order" : "orders"} created`,
      `${numbers.join(", ")} — grouped by preferred supplier and pre-populated with the suggested quantities.${
        aboveThreshold > 0
          ? ` ${aboveThreshold} of them sit above the ${formatINR(PO_APPROVAL_THRESHOLD)} threshold and cannot be marked Sent until approved.`
          : ""
      }`,
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-4xl"
      title="Create purchase orders from the reorder list"
      sub="One draft per preferred supplier, pre-populated with the suggested quantities. Nothing is sent — a draft above the approval threshold cannot be sent until it is approved."
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon={ShoppingCart} onClick={create} disabled={orderable.length === 0}>
            Create {formatCount(orderable.length)} draft {orderable.length === 1 ? "order" : "orders"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Note tone="neutral" title="What this writes" icon={Info}>
          {formatCount(orderable.length)} draft {orderable.length === 1 ? "order" : "orders"} carrying{" "}
          {formatCount(orderable.reduce((s, g) => s + g.lines.length, 0))} lines, {formatINR(totalValue)} in total,
          delivered to <span className="text-text-hi">{view.locationById.get(destination)?.name ?? destination}</span>.
          Each order takes its payment terms from the supplier master and its expected delivery from the longest lead
          time on the order.
        </Note>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Deliver to" required>
            <Select value={destination} onChange={(e) => setDestination(e.target.value)}>
              {view.locations
                .filter((l) => l.kind === "CENTRAL_WAREHOUSE" || l.kind === "BRANCH")
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Note for the buyer" hint="Recorded on the audit entry for every order created.">
            <TextArea
              className="min-h-8"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Raised against service-critical shortages, expedite where possible…"
            />
          </Field>
        </div>

        {orphan ? (
          <Note tone="warn" title={`${orphan.lines.length} selected ${orphan.lines.length === 1 ? "line has" : "lines have"} no preferred supplier`}>
            {orphan.lines.map((l) => l.row.item.code).slice(0, 6).join(", ")}
            {orphan.lines.length > 6 ? ` and ${orphan.lines.length - 6} more` : ""} cannot be grouped onto an order.
            Set a supplier against the category in the supplier master, then reselect them.
          </Note>
        ) : null}

        <div className="flex flex-col gap-4">
          {orderable.map((g) => {
            const supplier = g.supplier;
            if (!supplier) return null;
            const value = g.lines.reduce((t, l) => t + l.qty * (l.row.lastPurchaseRate ?? l.row.item.standardCost), 0);
            return (
              <div key={supplier.id} className="rounded-lg border border-line">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="t-body block font-medium text-text-hi">{supplier.name}</span>
                    <span className="t-body-sm block text-text-lo">
                      <span className="t-mono">{supplier.gstin}</span> · {supplier.paymentTerms} ·{" "}
                      {g.lines.length} {g.lines.length === 1 ? "line" : "lines"}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="t-body block text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatINR(value)}
                    </span>
                    {value > PO_APPROVAL_THRESHOLD ? (
                      <StatusBadge tone="warn">Approval required before Sent</StatusBadge>
                    ) : (
                      <StatusBadge tone="ok">Below approval threshold</StatusBadge>
                    )}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] border-collapse">
                    <caption className="sr-only">Lines for {supplier.name}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="t-overline border-b border-line px-3 py-1 text-left text-text-lo">Item</th>
                        <th scope="col" className="t-overline border-b border-line px-3 py-1 text-right text-text-lo">On hand</th>
                        <th scope="col" className="t-overline border-b border-line px-3 py-1 text-right text-text-lo">Order qty</th>
                        <th scope="col" className="t-overline border-b border-line px-3 py-1 text-right text-text-lo">Rate</th>
                        <th scope="col" className="t-overline border-b border-line px-3 py-1 text-right text-text-lo">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.lines.map((l) => {
                        const rate = l.row.lastPurchaseRate ?? l.row.item.standardCost;
                        return (
                          <tr key={l.row.item.id}>
                            <td className="border-b border-line/70 px-3 py-1.5">
                              <span className="t-mono block text-text-hi">{l.row.item.code}</span>
                              <span className="t-body-sm block truncate text-text-lo">{l.row.item.description}</span>
                            </td>
                            <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {formatQty(l.row.onHand)}
                            </td>
                            <td className="border-b border-line/70 px-3 py-1.5 text-right">
                              <label className="inline-flex items-center">
                                <span className="sr-only">Order quantity for {l.row.item.code}</span>
                                <NumInput
                                  className="w-24"
                                  min={1}
                                  value={l.qty}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    setQty((prev) => ({
                                      ...prev,
                                      [l.row.item.id]: Number.isFinite(n) ? Math.max(1, Math.round(n)) : 1,
                                    }));
                                  }}
                                />
                              </label>
                            </td>
                            <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {formatINR(rate)}
                            </td>
                            <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                              {formatINR(l.qty * rate)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>

        {orderable.length === 0 ? (
          <p className="t-body-sm text-text-lo">
            Nothing selectable is left in the selection. Close this dialog, tick the lines you want to order, and
            reopen it.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
