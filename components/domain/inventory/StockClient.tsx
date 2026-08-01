"use client";

/**
 * E7-S2 — stock balances over an append-only ledger, and E7-S6 — the
 * non-moving stock report.
 *
 * Nothing on this screen writes a balance. Every quantity shown is folded from
 * the ledger at render time, and the only two write paths offered are a
 * compensating movement and a transfer, both of which append rows. The
 * "edit balance" affordance exists solely to state the rule and refuse.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRight, Boxes, ClipboardCheck, FilePlus2, Hourglass, Lock, MapPin, Package,
  ScrollText, TrendingDown, TriangleAlert, Warehouse,
} from "lucide-react";
import {
  abbreviateINR, formatCount, formatDate, formatINR, formatPercent, formatQty, formatRelative,
} from "@/lib/format";
import * as D from "@/lib/derive";
import { EmptyState, Overline, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { OEM_LABEL, type ItemCategory, type OEMPrincipal } from "@/lib/schemas/enums";
import type * as T from "@/lib/schemas/entities";
import { canWrite } from "@/lib/rbac/matrix";
import {
  CATEGORY_LABEL, LOCATION_KIND_LABEL, STOCK_STATE_LABEL, availableOf, isCarried, matchesQuery,
  matchesState, nonMovingRows, onHandOf, reservedOf, stockStateOf, useInventory,
  type InvView, type StockState,
} from "./model";
import { DEFAULT_TRAILING_DAYS, useMutate, writeAudit } from "./store";
import { PostMovementModal, type PostMode } from "./MovementForm";
import {
  ActionResult, Blocked, Btn, ChipGroup, Column, FilteredEmpty, LinkBtn, MetricStrip, Modal, MonoCell,
  Note, Num, NumberStepper, PageHeader, PageSkeleton, SearchField, Select, SelectField, TextInput,
  Toolbar, VirtualTable,
} from "./ui";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ItemCategory[];
const PRINCIPALS = Object.keys(OEM_LABEL) as OEMPrincipal[];
const KIND_ORDER: T.StockLocation["kind"][] = ["CENTRAL_WAREHOUSE", "BRANCH", "ENGINEER_BOOT", "PROJECT_SITE"];

const KIND_ICON: Record<T.StockLocation["kind"], React.ComponentType<{ className?: string }>> = {
  CENTRAL_WAREHOUSE: Warehouse,
  BRANCH: Boxes,
  ENGINEER_BOOT: Package,
  PROJECT_SITE: MapPin,
};

const STATE_TONE: Record<StockState, "ok" | "warn" | "danger" | "neutral"> = {
  IN_STOCK: "ok",
  BELOW_REORDER: "warn",
  OUT_OF_STOCK: "danger",
  NON_MOVING: "neutral",
};

type StateFilter = "ALL" | StockState;

export function StockClient({
  initialState, initialLocation, initialQuery, initialTrailing,
}: {
  initialState: StateFilter;
  initialLocation: string;
  initialQuery: string;
  initialTrailing: number;
}) {
  const { view, ready, actor } = useInventory();
  const mutate = useMutate();

  const [query, setQuery] = React.useState(initialQuery);
  const [categories, setCategories] = React.useState<ItemCategory[]>([]);
  const [principals, setPrincipals] = React.useState<OEMPrincipal[]>([]);
  const [location, setLocation] = React.useState(initialLocation);
  const [state, setState] = React.useState<StateFilter>(initialState);
  const [trailing, setTrailing] = React.useState(initialTrailing);
  const [post, setPost] = React.useState<PostMode | null>(null);
  const [showBlock, setShowBlock] = React.useState(false);
  const [siteOpen, setSiteOpen] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  const scope = location === "ALL" ? null : location;

  const rows = React.useMemo(() => {
    if (!view) return [];
    return view.items.filter((i) => {
      if (i.category === "SERVICE") return false;
      if (!isCarried(view, i.id) && (view.onHand.get(i.id) ?? 0) === 0) return false;
      if (!matchesQuery(i, query)) return false;
      if (categories.length && !categories.includes(i.category)) return false;
      if (principals.length && !principals.includes(i.principal)) return false;
      if (scope && (view.onHandAt.get(`${i.id}|${scope}`) ?? 0) === 0) return false;
      if (state !== "ALL" && !matchesState(view, i, state, trailing, scope)) return false;
      return true;
    });
  }, [view, query, categories, principals, scope, state, trailing]);

  const nonMoving = React.useMemo(() => (view ? nonMovingRows(view, trailing) : []), [view, trailing]);

  if (!ready || !view) return <PageSkeleton metrics={4} columns={10} />;

  const mayWrite = canWrite(actor.role, "stock");
  const nonMovingValue = nonMoving.reduce((s, r) => s + r.value, 0);
  const nonMovingShare = view.totalStockValue ? (nonMovingValue / view.totalStockValue) * 100 : 0;

  const carried = view.items.filter((i) => i.category !== "SERVICE" && isCarried(view, i.id));
  const belowReorder = carried.filter((i) => i.reorderLevel > 0 && (view.onHand.get(i.id) ?? 0) <= i.reorderLevel);
  const criticalOpen = [...view.criticalByItem.values()].filter((c) => c.open);

  const activeFilters: string[] = [];
  if (query.trim()) activeFilters.push(`search "${query.trim()}"`);
  if (categories.length) activeFilters.push(`category ${categories.map((c) => CATEGORY_LABEL[c]).join(", ")}`);
  if (principals.length) activeFilters.push(`principal ${principals.join(", ")}`);
  if (scope) activeFilters.push(`location ${view.locationById.get(scope)?.name ?? scope}`);
  if (state !== "ALL") activeFilters.push(`state ${STOCK_STATE_LABEL[state]}`);

  function clearFilters() {
    setQuery("");
    setCategories([]);
    setPrincipals([]);
    setLocation("ALL");
    setState("ALL");
  }

  function openProjectSiteStore(projectId: string) {
    const project = view!.projectById.get(projectId);
    if (!project) return;
    const at = new Date().toISOString();
    const id = `SL-PS-${project.code.replace(/[^A-Za-z0-9]/g, "")}`;
    if (view!.locationById.has(id)) {
      setSiteOpen(false);
      setLocation(id);
      return;
    }
    mutate((o) => {
      o.newLocations.push({
        id,
        code: `SITE-${project.code}`,
        name: `Site Store — ${project.name}`,
        kind: "PROJECT_SITE",
        branchId: project.branchId,
        ownerUserId: null,
        projectId: project.id,
      });
      writeAudit(o, actor, {
        at,
        action: "CREATE",
        entityType: "StockLocation",
        entityId: id,
        entityLabel: `SITE-${project.code}`,
        summary: `Project-site stock location opened for ${project.name}`,
        before: null,
        after: "PROJECT_SITE",
      });
    });
    setSiteOpen(false);
    setLocation(id);
    setResult(`Site store opened for ${project.name}. Transfer stock into it to hold material at site.`);
  }

  const columns: Column<T.Item>[] = [
    { key: "code", header: "Item code", width: "116px", cell: (i) => <MonoCell>{i.code}</MonoCell> },
    {
      key: "description",
      header: "Description",
      width: "minmax(220px, 1.5fr)",
      cell: (i) => <span className="text-text-hi">{i.description}</span>,
    },
    { key: "cat", header: "Category", width: "110px", cell: (i) => <span className="text-text-mid">{CATEGORY_LABEL[i.category]}</span> },
    { key: "prin", header: "Principal", width: "98px", cell: (i) => <span className="text-text-mid">{OEM_LABEL[i.principal]}</span> },
    {
      key: "oem",
      header: "OEM part no.",
      width: "124px",
      cell: (i) => <MonoCell className="text-text-lo">{i.oemPartNumber}</MonoCell>,
    },
    {
      key: "locs",
      header: scope ? "Location" : "Locations",
      width: "132px",
      cell: (i) =>
        scope ? (
          <span className="t-body-sm truncate text-text-mid">{view.locationById.get(scope)?.name}</span>
        ) : (
          <span className="t-body-sm text-text-mid">
            {view.locations.filter((l) => (view.onHandAt.get(`${i.id}|${l.id}`) ?? 0) !== 0).length} holding
          </span>
        ),
    },
    {
      key: "onhand",
      header: "On hand",
      width: "88px",
      align: "right",
      cell: (i) => <Num>{formatQty(onHandOf(view, i.id, scope))}</Num>,
    },
    {
      key: "reserved",
      header: "Reserved",
      width: "84px",
      align: "right",
      cell: (i) => {
        const r = reservedOf(view, i.id, scope);
        return <Num tone={r > 0 ? "warn" : "lo"}>{formatQty(r)}</Num>;
      },
    },
    {
      key: "available",
      header: "Available",
      width: "88px",
      align: "right",
      cell: (i) => {
        const a = availableOf(view, i.id, scope);
        return <Num tone={a <= 0 ? "danger" : "default"}>{formatQty(a)}</Num>;
      },
    },
    {
      key: "value",
      header: "Value at cost",
      width: "108px",
      align: "right",
      cell: (i) => <Num tone="lo">{formatINR(onHandOf(view, i.id, scope) * i.standardCost)}</Num>,
    },
    {
      key: "state",
      header: "State",
      width: "126px",
      cell: (i) => {
        const s = stockStateOf(view, i, trailing, scope);
        return <StatusBadge tone={STATE_TONE[s]}>{STOCK_STATE_LABEL[s]}</StatusBadge>;
      },
    },
    {
      key: "last",
      header: "Last movement",
      width: "110px",
      align: "right",
      cell: (i) => {
        const t = view.lastMovementAt.get(i.id);
        return <Num tone="lo">{t ? formatRelative(t, view.today) : "never"}</Num>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Stock balances"
        lede="Every figure here is the sum of the movement ledger for that item and location. Nothing on this screen stores a balance, and nothing on this screen can edit one."
        right={
          <>
            <LinkBtn href="/inventory/stock/count" icon={ClipboardCheck}>
              Stock count
            </LinkBtn>
            <Btn icon={ArrowLeftRight} onClick={() => setPost("TRANSFER")} disabled={!mayWrite}>
              Transfer
            </Btn>
            <Btn variant="primary" icon={FilePlus2} onClick={() => setPost("CORRECTION")} disabled={!mayWrite}>
              Post correction
            </Btn>
          </>
        }
      />

      {result ? (
        <ActionResult tone="ok" title="Ledger updated" onDismiss={() => setResult(null)}>
          {result}
        </ActionResult>
      ) : null}

      <MetricStrip
        columns={4}
        metrics={[
          {
            label: "Stock value on hand",
            value: abbreviateINR(view.totalStockValue),
            sub: `${formatCount(carried.length)} carried lines across ${view.locations.length} locations`,
            icon: Boxes,
          },
          {
            label: "At or below reorder level",
            value: formatCount(belowReorder.length),
            sub: "carried lines needing replenishment",
            tone: "warn",
            icon: TrendingDown,
            href: "/inventory/reorder",
          },
          {
            label: "Service-critical shortages",
            value: formatCount(criticalOpen.length),
            sub: "each one stopped a job card",
            tone: "danger",
            icon: TriangleAlert,
            href: "/inventory/reorder?state=critical",
          },
          {
            label: `Non-moving — ${trailing} days`,
            value: abbreviateINR(nonMovingValue),
            sub: `${formatCount(nonMoving.length)} lines · ${formatPercent(nonMovingShare)} of stock value`,
            tone: "warn",
            icon: Hourglass,
            href: "/inventory/stock?state=non-moving",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
        <Note tone="neutral" title="How a balance is produced — FR-M6-05" icon={ScrollText}>
          Balance = Σ(movements into the location) − Σ(movements out of it), over{" "}
          <span className="t-mono text-text-hi">{formatCount(view.movements.length)}</span> rows currently in the ledger,
          the newest at sequence <span className="t-mono text-text-hi">{formatCount(view.maxSeq)}</span>. Open any item to
          replay its history row by row and arrive at the number shown here.
        </Note>
        <div className="rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-3">
          <Overline>Direct balance editing</Overline>
          <p className="t-body-sm mt-1 text-text-mid">
            No screen in Pravaah offers it. The control below exists to prove the refusal.
          </p>
          <Btn className="mt-2" icon={Lock} onClick={() => setShowBlock(true)}>
            Try to edit a balance
          </Btn>
        </div>
      </div>

      {showBlock ? (
        <Blocked
          title="Blocked — a stock balance cannot be typed over"
          rule="A balance is derived, not stored. There is no field to write to: changing it would break the guarantee that stock equals the sum of its ledger, and would destroy the audit trail behind every issue and receipt."
          unblock="Post a compensating movement with a stated reason, transfer the quantity to the location that actually holds it, or run a stock count so the variance is approved before it is posted."
          actions={
            <>
              <Btn icon={FilePlus2} onClick={() => { setShowBlock(false); setPost("CORRECTION"); }} disabled={!mayWrite}>
                Post a compensating movement
              </Btn>
              <LinkBtn href="/inventory/stock/count" icon={ClipboardCheck}>
                Run a stock count
              </LinkBtn>
              <Btn variant="ghost" onClick={() => setShowBlock(false)}>Dismiss</Btn>
            </>
          }
        />
      ) : null}

      {/* Locations — all four kinds are stock-holding. E7-S2 AC 6 / FR-M6-03 */}
      <Panel>
        <PanelHeader
          title="Stock-holding locations"
          sub="Central warehouse, every branch store, each engineer's boot stock and project sites all hold stock in the same ledger."
          right={
            <Btn size="sm" icon={MapPin} onClick={() => setSiteOpen(true)} disabled={!mayWrite}>
              Open a project-site store
            </Btn>
          }
        />
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          {KIND_ORDER.map((kind) => {
            const locs = view.locations.filter((l) => l.kind === kind);
            const Icon = KIND_ICON[kind];
            const kindValue = locs.reduce((sum, l) => {
              let v = 0;
              for (const item of view.items) {
                const q = view.onHandAt.get(`${item.id}|${l.id}`) ?? 0;
                if (q) v += q * item.standardCost;
              }
              return sum + v;
            }, 0);
            return (
              <div key={kind} className="bg-surface-1 p-3">
                <span className="flex items-center gap-1.5">
                  <Icon className="size-3.5 text-text-lo" aria-hidden />
                  <Overline>{LOCATION_KIND_LABEL[kind]}</Overline>
                </span>
                <p className="t-display-md mt-1 text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatCount(locs.length)}
                </p>
                <p className="t-body-sm text-text-mid">
                  {locs.length ? `${abbreviateINR(kindValue)} held` : "supported — none open yet"}
                </p>
                <ul className="mt-2 flex flex-col gap-0.5">
                  {locs.slice(0, 4).map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setLocation(l.id)}
                        className="t-body-sm w-full truncate text-left text-text-mid hover:text-text-hi"
                      >
                        <span className="t-mono text-text-lo">{l.code}</span> {l.name}
                      </button>
                    </li>
                  ))}
                  {locs.length > 4 ? (
                    <li className="t-body-sm text-text-lo">+{locs.length - 4} more</li>
                  ) : null}
                  {locs.length === 0 ? (
                    <li className="t-body-sm text-text-lo">
                      Open one from a project to hold material at site.
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Balances — FR-M6-15 search and filters */}
      <Panel>
        <Toolbar>
          <SearchField
            label="Search stock"
            placeholder="Item code, description or OEM part number"
            value={query}
            onChange={setQuery}
            width="w-80"
          />
          <SelectField
            label="Location"
            value={location}
            onChange={setLocation}
            options={[
              { value: "ALL", label: "All locations" },
              ...view.locations.map((l) => ({ value: l.id, label: `${l.name} · ${LOCATION_KIND_LABEL[l.kind]}` })),
            ]}
          />
          <SelectField
            label="Stock state"
            value={state}
            onChange={(v) => setState(v)}
            options={[
              { value: "ALL", label: "Any state" },
              { value: "IN_STOCK", label: "In stock" },
              { value: "BELOW_REORDER", label: "Below reorder" },
              { value: "OUT_OF_STOCK", label: "Out of stock" },
              { value: "NON_MOVING", label: "Non-moving" },
            ]}
          />
          {state === "NON_MOVING" ? (
            <NumberStepper label="Trailing" value={trailing} onChange={setTrailing} min={30} max={1095} step={30} suffix="days" />
          ) : null}
          <span className="t-body-sm ml-auto text-text-lo">
            <span className="t-mono text-text-mid">{formatCount(rows.length)}</span> lines
          </span>
          {activeFilters.length ? (
            <Btn size="sm" onClick={clearFilters}>Clear filters</Btn>
          ) : null}
        </Toolbar>
        <Toolbar className="border-b-0 pt-0">
          <ChipGroup
            label="Category"
            options={CATEGORIES.filter((c) => c !== "SERVICE").map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
            selected={categories}
            onToggle={(v) => setCategories((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          />
          <ChipGroup
            label="Principal"
            options={PRINCIPALS.map((p) => ({ value: p, label: OEM_LABEL[p] }))}
            selected={principals}
            onToggle={(v) => setPrincipals((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))}
          />
        </Toolbar>

        {rows.length === 0 ? (
          activeFilters.length ? (
            <FilteredEmpty filters={activeFilters} onClear={clearFilters} total={carried.length} />
          ) : (
            <EmptyState
              icon={Boxes}
              title="No stock is held anywhere yet"
              body="The ledger has no receipts. Raise a purchase order and record a goods receipt, and balances will appear here the moment the first row is written."
              action={<LinkBtn href="/inventory/purchase" variant="primary">Open purchase orders</LinkBtn>}
            />
          )
        ) : (
          <VirtualTable
            ariaLabel="Stock balances by item"
            rows={rows}
            columns={columns}
            rowKey={(i) => i.id}
            rowHref={(i) => `/inventory/stock/${i.id}${scope ? `?location=${scope}` : ""}`}
            height={520}
            rowTone={(i) => {
              const s = stockStateOf(view, i, trailing, scope);
              return s === "OUT_OF_STOCK" ? "danger" : s === "BELOW_REORDER" ? "warn" : null;
            }}
          />
        )}
      </Panel>

      <NonMovingReport
        view={view}
        trailing={trailing}
        onTrailingChange={setTrailing}
        rows={nonMoving}
        value={nonMovingValue}
        share={nonMovingShare}
      />

      <PostMovementModal
        open={post !== null}
        mode={post ?? "CORRECTION"}
        view={view}
        actor={actor}
        itemId={null}
        locationId={scope}
        onClose={() => setPost(null)}
        onPosted={(summary) => setResult(summary)}
      />

      <ProjectSiteModal
        open={siteOpen}
        view={view}
        onClose={() => setSiteOpen(false)}
        onPick={openProjectSiteStore}
      />
    </div>
  );
}

/* -------------------------------------------------- E7-S6 non-moving report */

function NonMovingReport({
  view, trailing, onTrailingChange, rows, value, share,
}: {
  view: InvView;
  trailing: number;
  onTrailingChange: (n: number) => void;
  rows: ReturnType<typeof nonMovingRows>;
  value: number;
  share: number;
}) {
  const [limit, setLimit] = React.useState(25);
  const shown = rows.slice(0, limit);

  return (
    <Panel id="non-moving">
      <PanelHeader
        title="Non-moving stock"
        sub={`Items with zero issues over the trailing period. Change the period and the list and the totals recompute immediately — nothing is cached.`}
        right={
          <div className="flex items-center gap-2">
            <NumberStepper
              label="Trailing period"
              value={trailing}
              onChange={onTrailingChange}
              min={30}
              max={1095}
              step={30}
              suffix="days"
            />
            {trailing !== DEFAULT_TRAILING_DAYS ? (
              <Btn size="sm" onClick={() => onTrailingChange(DEFAULT_TRAILING_DAYS)}>
                Reset to {DEFAULT_TRAILING_DAYS}
              </Btn>
            ) : null}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
        <div className="bg-surface-1 p-3">
          <Overline>Capital not moving</Overline>
          <p className="t-display-md text-warn" style={{ fontVariantNumeric: "tabular-nums" }}>
            {abbreviateINR(value)}
          </p>
          <p className="t-body-sm text-text-mid">{formatINR(value)} at standard cost</p>
        </div>
        <div className="bg-surface-1 p-3">
          <Overline>Share of total stock value</Overline>
          <p className="t-display-md text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatPercent(share)}
          </p>
          <p className="t-body-sm text-text-mid">of {abbreviateINR(view.totalStockValue)} held</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full bg-warn" style={{ width: `${Math.min(100, share)}%` }} aria-hidden />
          </div>
        </div>
        <div className="bg-surface-1 p-3">
          <Overline>Lines with no issue in {trailing} days</Overline>
          <p className="t-display-md text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCount(rows.length)}
          </p>
          <p className="t-body-sm text-text-mid">
            derived by <span className="t-mono">nonMovingItems({trailing})</span> in the shared KPI engine
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Hourglass}
          title={`Nothing has been idle for ${trailing} days`}
          body="Every line carrying stock has been issued inside the trailing period. Shorten the period to test a tighter definition of idle capital."
          action={<Btn onClick={() => onTrailingChange(Math.max(30, Math.round(trailing / 2)))}>Halve the period</Btn>}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-line-strong bg-surface-2">
                  {["Item code", "Description", "Location", "Quantity", "Value at cost", "Last movement", "Last issue"].map((h, i) => (
                    <th
                      key={h}
                      className={`t-overline px-3 py-1.5 text-text-lo ${i >= 3 ? "text-right" : "text-left"}`}
                      scope="col"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.item.id} className="border-b border-line/70 hover:bg-surface-2">
                    <td className="px-3 py-1.5">
                      <Link href={`/inventory/stock/${r.item.id}`} className="t-mono text-text-hi hover:underline">
                        {r.item.code}
                      </Link>
                    </td>
                    <td className="t-body-sm max-w-[26rem] truncate px-3 py-1.5 text-text-mid">{r.item.description}</td>
                    <td className="t-body-sm px-3 py-1.5 text-text-mid">
                      {r.locations.length
                        ? r.locations.map((l) => view.locationById.get(l.locationId)?.code ?? l.locationId).join(", ")
                        : "—"}
                    </td>
                    <td className="t-body-sm px-3 py-1.5 text-right text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(r.qty, r.item.uom)}
                    </td>
                    <td className="t-body-sm px-3 py-1.5 text-right text-warn" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatINR(r.value)}
                    </td>
                    <td className="t-body-sm px-3 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {r.lastMovementAt ? formatDate(r.lastMovementAt) : "—"}
                    </td>
                    <td className="t-body-sm px-3 py-1.5 text-right text-text-lo" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {r.lastIssueAt ? formatDate(r.lastIssueAt) : "never issued"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > shown.length ? (
            <div className="border-t border-line px-3 py-2">
              <Btn size="sm" onClick={() => setLimit((l) => l + 50)}>
                Show 50 more — {formatCount(rows.length - shown.length)} remaining
              </Btn>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}

/* --------------------------------------------------- project-site location */

function ProjectSiteModal({
  open, view, onClose, onPick,
}: { open: boolean; view: InvView; onClose: () => void; onPick: (projectId: string) => void }) {
  const [q, setQ] = React.useState("");
  const projects = view.seed.projects.filter(
    (p) => !q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-xl"
      title="Open a project-site stock location"
      sub="A site store is a stock-holding location like any other: material transferred to it stays on the same ledger and the same balances."
    >
      <div className="flex flex-col gap-3">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" />
        <ul className="flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
          {projects.map((p) => {
            const exists = view.locations.some((l) => l.projectId === p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  className="flex w-full items-center justify-between gap-3 bg-surface-1 px-3 py-2 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="t-mono block text-text-hi">{p.code}</span>
                    <span className="t-body-sm block truncate text-text-mid">{p.name}</span>
                  </span>
                  {exists ? <StatusBadge tone="ok">Store open</StatusBadge> : <StatusBadge tone="neutral">Open store</StatusBadge>}
                </button>
              </li>
            );
          })}
          {projects.length === 0 ? (
            <li className="t-body-sm bg-surface-1 px-3 py-4 text-center text-text-mid">
              No project matches “{q}”.
            </li>
          ) : null}
        </ul>
      </div>
    </Modal>
  );
}

export const STOCK_DERIVE = D;
export type { StateFilter };
export { Select };
