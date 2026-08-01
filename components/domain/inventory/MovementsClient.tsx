"use client";

/**
 * E7-S3 — issue against a job card or a project.
 *
 * The screen is a queue, not a form: pending parts requests arrive already
 * prioritised by service impact, each carrying its own availability position,
 * and Issue is one action that writes the ledger rows, decrements the balances
 * and tells the engineer. Nothing here edits a balance — every quantity that
 * moves is an append-only movement written through `appendMovements`, which is
 * also what gives each new row its monotonically increasing `seq`.
 *
 * Three rules from the acceptance criteria are structural rather than cosmetic:
 *   1. Requested above available is never silently truncated — the partial
 *      issue is offered, the shortfall is recorded, and the item is flagged
 *      service-critical so it surfaces on the reorder list (E7-S5).
 *   2. A store in-charge sees only the locations they are assigned to (RBAC-3),
 *      and the screen says so rather than quietly filtering.
 *   3. A project issue references the project *and* the BOQ line, so the
 *      consumption can be reconciled against the measured work.
 */

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightLeft, Boxes, ClipboardList, Hourglass, Info, Layers, MapPin, PackageCheck,
  PackageX, ShieldAlert, User, Warehouse,
} from "lucide-react";
import { formatCount, formatDate, formatDateTime, formatQty, formatRelative, enumLabel } from "@/lib/format";
import { canWrite, isReadOnlyRole } from "@/lib/rbac/matrix";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import type * as T from "@/lib/schemas/entities";
import { Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { availableOf, onHandOf, useInventory, type InvView } from "./model";
import {
  appendMovements, notify, useMutate, writeAudit, type Actor, type MovementDraft, type Overlay,
} from "./store";
import {
  ActionResult, Blocked, Btn, Field, FilteredEmpty, LinkBtn, MetricStrip, Modal, Note,
  NumInput, PageHeader, PageSkeleton, SearchField, Select, SelectField, TextArea, TextInput, Toolbar,
} from "./ui";

/* ------------------------------------------------------------------ model */

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

interface RequestLineRow {
  itemId: string;
  item: T.Item | null;
  requested: number;
  alreadyIssued: number;
  outstanding: number;
  available: number;
  issuable: number;
  shortfall: number;
}

interface RequestRow {
  request: T.PartsRequest;
  lines: RequestLineRow[];
  jobCard: T.JobCard | null;
  ticket: T.ServiceTicket | null;
  project: T.Project | null;
  boqLine: T.BOQLine | null;
  engineerName: string;
  engineerUserId: string;
  location: T.StockLocation | null;
  severity: string | null;
  totalRequested: number;
  totalIssuable: number;
  totalShortfall: number;
  criticalReason: string | null;
}

function buildRows(view: InvView): RequestRow[] {
  const rows: RequestRow[] = [];
  for (const request of view.partsRequests) {
    if (request.status !== "PENDING" && request.status !== "PARTIAL") continue;
    const jobCard = request.jobCardId ? view.jobCardById.get(request.jobCardId) ?? null : null;
    const ticket = jobCard ? view.ticketById.get(jobCard.ticketId) ?? null : null;
    const project = request.projectId ? view.projectById.get(request.projectId) ?? null : null;
    const boqLine = request.boqLineId ? view.boqLineById.get(request.boqLineId) ?? null : null;
    const user = view.userById.get(request.requestedByUserId) ?? null;

    const lines: RequestLineRow[] = request.lines.map((l) => {
      const item = view.itemById.get(l.itemId) ?? null;
      const outstanding = Math.max(0, l.qtyRequested - l.qtyIssued);
      const available = Math.max(0, availableOf(view, l.itemId, request.stockLocationId));
      const issuable = Math.min(outstanding, available);
      return {
        itemId: l.itemId,
        item,
        requested: l.qtyRequested,
        alreadyIssued: l.qtyIssued,
        outstanding,
        available,
        issuable,
        shortfall: Math.max(0, outstanding - available),
      };
    });

    rows.push({
      request,
      lines,
      jobCard,
      ticket,
      project,
      boqLine,
      engineerName: user?.name ?? request.requestedByUserId,
      engineerUserId: request.requestedByUserId,
      location: view.locationById.get(request.stockLocationId) ?? null,
      severity: ticket?.severity ?? null,
      totalRequested: lines.reduce((s, l) => s + l.outstanding, 0),
      totalIssuable: lines.reduce((s, l) => s + l.issuable, 0),
      totalShortfall: lines.reduce((s, l) => s + l.shortfall, 0),
      criticalReason: request.serviceCritical
        ? ticket?.status === "AWAITING_PARTS"
          ? `Ticket ${ticket.number} is Awaiting parts — the repair is stopped until this issue is made`
          : "Flagged service-critical when the request was raised"
        : null,
    });
  }

  /* AC1 — service-critical first, then severity, then oldest waiting. */
  return rows.sort((a, b) => {
    const ac = a.request.serviceCritical ? 0 : 1;
    const bc = b.request.serviceCritical ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const as = SEVERITY_RANK[a.severity ?? "LOW"] ?? 4;
    const bs = SEVERITY_RANK[b.severity ?? "LOW"] ?? 4;
    if (as !== bs) return as - bs;
    return a.request.raisedAt.localeCompare(b.request.raisedAt);
  });
}

/* ------------------------------------------------------------------ screen */

type Focus = "ALL" | "CRITICAL" | "ROUTINE" | "SHORT";

const FOCUS_LABEL: Record<Focus, string> = {
  ALL: "All pending",
  CRITICAL: "Service-critical",
  ROUTINE: "Routine",
  SHORT: "Short of stock",
};

export function MovementsClient({
  initialQuery,
  initialLocation,
  initialFocus,
}: {
  initialQuery: string;
  initialLocation: string;
  initialFocus: Focus;
}) {
  const { view, ready, actor } = useInventory();
  const [query, setQuery] = React.useState(initialQuery);
  const [location, setLocation] = React.useState(initialLocation);
  const [focus, setFocus] = React.useState<Focus>(initialFocus);
  const [issuing, setIssuing] = React.useState<string | null>(null);
  const [projectOpen, setProjectOpen] = React.useState(false);
  const [result, setResult] = React.useState<{ tone: "ok" | "warn"; title: string; body: string } | null>(null);

  const allRows = React.useMemo(() => (view ? buildRows(view) : []), [view]);

  if (!ready || !view) return <PageSkeleton metrics={4} rows={8} columns={6} />;

  const sessionUser = view.userById.get(actor.userId) ?? null;
  /* RBAC-3 — the location set this store in-charge may act on. */
  const assigned =
    actor.role === "STORE_INCHARGE" && sessionUser && sessionUser.stockLocationIds.length
      ? sessionUser.stockLocationIds
      : null;
  const assignedNames = assigned
    ? assigned.map((id) => view.locationById.get(id)?.name ?? id)
    : [];

  const inScope = assigned ? allRows.filter((r) => assigned.includes(r.request.stockLocationId)) : allRows;
  const hiddenByScope = allRows.length - inScope.length;

  const q = query.trim().toLowerCase();
  const rows = inScope.filter((r) => {
    if (location && r.request.stockLocationId !== location) return false;
    if (focus === "CRITICAL" && !r.request.serviceCritical) return false;
    if (focus === "ROUTINE" && r.request.serviceCritical) return false;
    if (focus === "SHORT" && r.totalShortfall <= 0) return false;
    if (!q) return true;
    return (
      r.request.number.toLowerCase().includes(q) ||
      (r.jobCard?.number.toLowerCase().includes(q) ?? false) ||
      (r.ticket?.number.toLowerCase().includes(q) ?? false) ||
      (r.project?.code.toLowerCase().includes(q) ?? false) ||
      r.engineerName.toLowerCase().includes(q) ||
      r.lines.some(
        (l) =>
          (l.item?.code.toLowerCase().includes(q) ?? false) ||
          (l.item?.description.toLowerCase().includes(q) ?? false) ||
          (l.item?.oemPartNumber.toLowerCase().includes(q) ?? false),
      )
    );
  });

  const mayIssue = canWrite(actor.role, "stock") && !isReadOnlyRole(actor.role);
  const criticalCount = inScope.filter((r) => r.request.serviceCritical).length;
  const shortCount = inScope.filter((r) => r.totalShortfall > 0).length;
  const issuedThisSession = view.overlay.movements.filter((m) => m.type === "ISSUE").length;

  const activeFilters: string[] = [];
  if (q) activeFilters.push(`search "${query.trim()}"`);
  if (location) activeFilters.push(`location ${view.locationById.get(location)?.name ?? location}`);
  if (focus !== "ALL") activeFilters.push(`view ${FOCUS_LABEL[focus]}`);

  const locationOptions = [
    { value: "", label: "All locations in scope" },
    ...(assigned ?? view.locations.map((l) => l.id)).map((id) => ({
      value: id,
      label: view.locationById.get(id)?.name ?? id,
    })),
  ];

  const openRow = issuing ? rows.find((r) => r.request.id === issuing) ?? null : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Parts issue"
        lede="Pending requests from the field, ordered by service impact. Issuing writes movements against the job card or the project and BOQ line it came from; balances follow the ledger, never the other way round."
        right={
          <>
            <LinkBtn href="/inventory/stock" icon={Boxes}>
              Stock balances
            </LinkBtn>
            <LinkBtn href="/inventory/reorder" icon={ShieldAlert}>
              Reorder list
            </LinkBtn>
            {mayIssue ? (
              <Btn variant="primary" icon={Layers} onClick={() => setProjectOpen(true)}>
                Issue to a project
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
          { label: "Pending requests", value: formatCount(inScope.length), icon: ClipboardList, sub: "Awaiting issue in your scope" },
          {
            label: "Service-critical",
            value: formatCount(criticalCount),
            tone: criticalCount ? "danger" : "default",
            icon: ShieldAlert,
            sub: "A repair is stopped until issued",
          },
          {
            label: "Short of stock",
            value: formatCount(shortCount),
            tone: shortCount ? "warn" : "ok",
            icon: PackageX,
            sub: "Partial issue offered, shortfall recorded",
          },
          { label: "Issued this session", value: formatCount(issuedThisSession), icon: PackageCheck, sub: "Ledger rows appended" },
          {
            label: "Next ledger sequence",
            value: `#${formatCount(view.maxSeq + 1)}`,
            icon: Hourglass,
            sub: "Movements are append-only",
            href: "/inventory/stock",
          },
        ]}
      />

      {assigned ? (
        <Note tone="info" title="You are issuing on behalf of assigned locations only" icon={MapPin}>
          {ROLE_LABEL[actor.role]} <span className="text-text-hi">{actor.name}</span> is assigned to{" "}
          <span className="text-text-hi">{assignedNames.join(", ")}</span>. Requests raised against any other
          stock-holding location are not shown and cannot be issued from this session
          {hiddenByScope > 0 ? (
            <>
              {" "}— <span className="text-text-hi">{formatCount(hiddenByScope)}</span>{" "}
              {hiddenByScope === 1 ? "request is" : "requests are"} withheld by that assignment.
            </>
          ) : (
            <> — no pending request currently falls outside it.</>
          )}
        </Note>
      ) : null}

      {!mayIssue ? (
        <Note tone="neutral" title="Read-only view">
          {ROLE_LABEL[actor.role]} may see the issue queue but holds no write on stock, so no Issue control is
          rendered. Issuing is held by the Store In-charge and the Service Manager.
        </Note>
      ) : null}

      <Panel>
        <Toolbar>
          <SearchField
            value={query}
            onChange={setQuery}
            label="Search pending parts requests"
            placeholder="Request, job card, ticket, engineer, item…"
            width="w-80"
          />
          <SelectField
            label="Location"
            value={location}
            onChange={setLocation}
            options={locationOptions}
          />
          <SelectField
            label="Show"
            value={focus}
            onChange={(v) => setFocus(v)}
            options={(Object.keys(FOCUS_LABEL) as Focus[]).map((f) => ({ value: f, label: FOCUS_LABEL[f] }))}
          />
          <span className="t-body-sm ml-auto text-text-lo">
            {formatCount(rows.length)} of {formatCount(inScope.length)} pending · sorted service-critical first
          </span>
        </Toolbar>

        {rows.length === 0 ? (
          activeFilters.length ? (
            <FilteredEmpty
              filters={activeFilters}
              total={inScope.length}
              onClear={() => {
                setQuery("");
                setLocation("");
                setFocus("ALL");
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <PackageCheck className="size-8 text-ok" aria-hidden />
              <div>
                <p className="t-heading-md text-text-hi">Nothing is waiting on the store</p>
                <p className="t-body-sm mx-auto mt-1 max-w-lg text-text-mid">
                  Every parts request raised against your locations has been issued. New requests arrive here the
                  moment an engineer raises one from a job card.
                </p>
              </div>
              <LinkBtn href="/inventory/stock" icon={Boxes}>
                Open stock balances
              </LinkBtn>
            </div>
          )
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <RequestCard
                key={row.request.id}
                row={row}
                mayIssue={mayIssue}
                onIssue={() => setIssuing(row.request.id)}
              />
            ))}
          </ul>
        )}
      </Panel>

      <SessionLedger view={view} />

      {openRow ? (
        <IssueModal
          open
          row={openRow}
          view={view}
          actor={actor}
          onClose={() => setIssuing(null)}
          onIssued={(tone, title, body) => {
            setResult({ tone, title, body });
            setIssuing(null);
          }}
        />
      ) : null}

      <ProjectIssueModal
        open={projectOpen}
        view={view}
        actor={actor}
        onClose={() => setProjectOpen(false)}
        onIssued={(tone, title, body) => {
          setResult({ tone, title, body });
          setProjectOpen(false);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- request card */

function RequestCard({
  row,
  mayIssue,
  onIssue,
}: {
  row: RequestRow;
  mayIssue: boolean;
  onIssue: () => void;
}) {
  const { request, jobCard, ticket, project, boqLine } = row;
  const nothingAvailable = row.totalIssuable === 0;

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex flex-col gap-3 px-3 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="t-mono text-text-hi">{request.number}</span>
          {request.serviceCritical ? (
            <StatusBadge tone="danger">Service-critical</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Routine</StatusBadge>
          )}
          {request.status === "PARTIAL" ? <StatusBadge tone="warn">Partially issued</StatusBadge> : null}
          {ticket ? (
            <span className="t-body-sm text-text-mid">
              Severity <span className="text-text-hi">{enumLabel(ticket.severity)}</span>
            </span>
          ) : null}
          <span className="t-body-sm text-text-lo">
            Raised {formatRelative(request.raisedAt, new Date())} · {formatDate(request.raisedAt)}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {mayIssue ? (
              <Btn variant="primary" icon={PackageCheck} onClick={onIssue} disabled={nothingAvailable}>
                {row.totalShortfall > 0 && row.totalIssuable > 0 ? "Issue what is available" : "Issue"}
              </Btn>
            ) : null}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Against</dt>
            <dd className="t-body-sm text-text-hi">
              {jobCard ? (
                <Link href={`/service/job-cards/${jobCard.id}`} className="t-mono hover:underline">
                  {jobCard.number}
                </Link>
              ) : project ? (
                <Link href={`/projects/${project.id}`} className="t-mono hover:underline">
                  {project.code}
                </Link>
              ) : (
                <span className="text-text-lo">Not linked</span>
              )}
              {ticket ? (
                <>
                  {" · "}
                  <Link href={`/service/tickets/${ticket.id}`} className="t-mono text-text-mid hover:underline">
                    {ticket.number}
                  </Link>
                </>
              ) : null}
              {boqLine ? (
                <>
                  {" · "}
                  <span className="t-body-sm text-text-mid">
                    BOQ <span className="t-mono">{boqLine.code}</span>
                  </span>
                </>
              ) : null}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Requesting engineer</dt>
            <dd className="t-body-sm flex items-center gap-1.5 text-text-hi">
              <User className="size-3.5 text-text-lo" aria-hidden />
              {row.engineerName}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Issue from</dt>
            <dd className="t-body-sm flex items-center gap-1.5 text-text-hi">
              <Warehouse className="size-3.5 text-text-lo" aria-hidden />
              {row.location?.name ?? request.stockLocationId}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="t-overline text-text-lo">Position</dt>
            <dd className="t-body-sm text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatQty(row.totalIssuable)} of {formatQty(row.totalRequested)} issuable
              {row.totalShortfall > 0 ? (
                <span className="text-warn"> · {formatQty(row.totalShortfall)} short</span>
              ) : null}
            </dd>
          </div>
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse">
            <caption className="sr-only">Items requested on {request.number}</caption>
            <thead>
              <tr>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-left text-text-lo">
                  Item
                </th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-left text-text-lo">
                  Description
                </th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-right text-text-lo">
                  Requested
                </th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-right text-text-lo">
                  Available
                </th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-right text-text-lo">
                  Shortfall
                </th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-left text-text-lo">
                  State
                </th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((l) => (
                <tr key={l.itemId}>
                  <td className="t-mono border-b border-line/70 px-2 py-1 text-text-hi">
                    <Link href={`/inventory/stock?q=${encodeURIComponent(l.item?.code ?? "")}`} className="hover:underline">
                      {l.item?.code ?? l.itemId}
                    </Link>
                  </td>
                  <td className="t-body-sm border-b border-line/70 px-2 py-1 text-text-mid">
                    {l.item?.description ?? "Unknown item"}
                  </td>
                  <td className="t-body-sm border-b border-line/70 px-2 py-1 text-right text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatQty(l.outstanding, l.item?.uom)}
                  </td>
                  <td
                    className={`t-body-sm border-b border-line/70 px-2 py-1 text-right ${l.available < l.outstanding ? "text-warn" : "text-text-hi"}`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatQty(l.available, l.item?.uom)}
                  </td>
                  <td className="t-body-sm border-b border-line/70 px-2 py-1 text-right text-danger" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {l.shortfall > 0 ? formatQty(l.shortfall, l.item?.uom) : "—"}
                  </td>
                  <td className="border-b border-line/70 px-2 py-1">
                    {l.shortfall === 0 ? (
                      <StatusBadge tone="ok">Full issue possible</StatusBadge>
                    ) : l.available === 0 ? (
                      <StatusBadge tone="danger">No stock at this location</StatusBadge>
                    ) : (
                      <StatusBadge tone="warn">Partial only</StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {row.criticalReason ? (
          <p className="t-body-sm flex items-start gap-1.5 text-text-mid">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />
            {row.criticalReason}.
          </p>
        ) : null}

        {nothingAvailable ? (
          <Blocked
            title="Issue blocked — nothing on this request can be issued from that location"
            rule={`${row.location?.name ?? "The location"} holds no available quantity against any line on ${request.number}. A ledger can never be driven negative, so an issue that has nothing behind it is refused rather than written.`}
            unblock="Transfer the part in from another location, or raise a purchase order — the shortfall is already flagged service-critical on the reorder list."
            actions={
              <>
                <LinkBtn href="/inventory/reorder?critical=1" icon={ShieldAlert}>
                  Reorder list
                </LinkBtn>
                <LinkBtn href="/inventory/stock" icon={ArrowRightLeft}>
                  Transfer stock
                </LinkBtn>
              </>
            }
          />
        ) : row.totalShortfall > 0 ? (
          <Note tone="warn" title="Partial issue will be offered">
            {formatQty(row.totalIssuable)} of {formatQty(row.totalRequested)} can be issued now. The remaining{" "}
            {formatQty(row.totalShortfall)} is recorded as a shortfall against this request and the item is flagged
            service-critical on the reorder list, with this job card linked as the reason.
          </Note>
        ) : null}
      </div>
    </li>
  );
}

/* --------------------------------------------------------------- issue modal */

function IssueModal({
  open,
  row,
  view,
  actor,
  onClose,
  onIssued,
}: {
  open: boolean;
  row: RequestRow;
  view: InvView;
  actor: Actor;
  onClose: () => void;
  onIssued: (tone: "ok" | "warn", title: string, body: string) => void;
}) {
  const mutate = useMutate();
  const [qty, setQty] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(row.lines.map((l) => [l.itemId, l.issuable])),
  );
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    setQty(Object.fromEntries(row.lines.map((l) => [l.itemId, l.issuable])));
    setNote("");
  }, [row]);

  const totals = row.lines.reduce(
    (acc, l) => {
      const q = qty[l.itemId] ?? 0;
      acc.issue += q;
      acc.short += Math.max(0, l.outstanding - q);
      return acc;
    },
    { issue: 0, short: 0 },
  );
  const overIssue = row.lines.some((l) => (qty[l.itemId] ?? 0) > l.issuable);
  const blocked = totals.issue <= 0 || overIssue;
  const isPartial = totals.short > 0;
  const sourceLabel = row.jobCard?.number ?? row.project?.code ?? row.request.number;

  function confirm() {
    if (blocked) return;
    const at = new Date().toISOString();
    const drafts: MovementDraft[] = [];
    for (const l of row.lines) {
      const q = qty[l.itemId] ?? 0;
      if (q <= 0) continue;
      drafts.push({
        itemId: l.itemId,
        type: "ISSUE",
        qty: q,
        fromLocationId: row.request.stockLocationId,
        toLocationId: null,
        sourceType: row.jobCard ? "JOB_CARD" : "PROJECT",
        sourceId: row.jobCard?.id ?? row.project?.id ?? null,
        sourceLabel: row.boqLine ? `${sourceLabel} · BOQ ${row.boqLine.code}` : sourceLabel,
        rate: l.item?.standardCost ?? 0,
        reason: note.trim() ? note.trim() : null,
      });
    }

    mutate((o: Overlay) => {
      appendMovements(o, view.maxSeq, actor, drafts, at);

      o.requestPatches[row.request.id] = {
        status: isPartial ? "PARTIAL" : "ISSUED",
        lines: row.lines.map((l) => ({
          itemId: l.itemId,
          qtyRequested: l.requested,
          qtyIssued: l.alreadyIssued + (qty[l.itemId] ?? 0),
        })),
        issuedAt: at,
      };

      /* AC3 — a shortfall is recorded and the item is flagged service-critical. */
      for (const l of row.lines) {
        const short = Math.max(0, l.outstanding - (qty[l.itemId] ?? 0));
        if (short <= 0) continue;
        o.criticalFlags.push({
          itemId: l.itemId,
          jobCardId: row.jobCard?.id ?? null,
          jobCardNumber: row.jobCard?.number ?? row.project?.code ?? row.request.number,
          shortfall: short,
          reason: row.jobCard
            ? `Short issue on ${row.request.number} left job card ${row.jobCard.number} waiting for ${formatQty(short, l.item?.uom)}`
            : `Short issue on ${row.request.number} left ${formatQty(short, l.item?.uom)} outstanding`,
          at,
        });
      }

      writeAudit(o, actor, {
        at,
        action: isPartial ? "STATE_TRANSITION" : "CREATE",
        entityType: "PartsRequest",
        entityId: row.request.id,
        entityLabel: row.request.number,
        summary: `${isPartial ? "Partial issue" : "Issue"} of ${formatQty(totals.issue)} against ${sourceLabel}${
          isPartial ? ` — ${formatQty(totals.short)} short` : ""
        }`,
        before: `${row.request.status} · ${formatQty(row.totalRequested)} outstanding`,
        after: `${isPartial ? "PARTIAL" : "ISSUED"} · ${drafts.length} ledger ${drafts.length === 1 ? "row" : "rows"} appended`,
      });

      /* AC4 — the requesting engineer is notified. */
      notify(o, {
        at,
        toUserId: row.engineerUserId,
        toLabel: row.engineerName,
        channel: "IN_APP",
        digest: false,
        title: isPartial ? "Parts partially issued" : "Parts issued",
        body: `${formatQty(totals.issue)} issued against ${sourceLabel} from ${
          row.location?.name ?? "the store"
        }${isPartial ? `. ${formatQty(totals.short)} remains short and is on the reorder list.` : "."}`,
        href: row.jobCard ? `/service/job-cards/${row.jobCard.id}` : row.project ? `/projects/${row.project.id}` : null,
      });

      if (isPartial) {
        const sm = view.ds.users.find((u) => u.role === "SERVICE_MANAGER");
        if (sm) {
          notify(o, {
            at,
            toUserId: sm.id,
            toLabel: sm.name,
            channel: "IN_APP",
            digest: false,
            title: "Service-critical shortfall recorded",
            body: `${formatQty(totals.short)} short on ${row.request.number} against ${sourceLabel}. The affected lines are flagged service-critical on the reorder list.`,
            href: "/inventory/reorder?critical=1",
          });
        }
      }
    });

    onIssued(
      isPartial ? "warn" : "ok",
      isPartial ? "Partial issue written to the ledger" : "Issue written to the ledger",
      isPartial
        ? `${formatQty(totals.issue)} issued against ${sourceLabel}; ${formatQty(
            totals.short,
          )} recorded as a shortfall and flagged service-critical. ${row.engineerName} has been notified.`
        : `${formatQty(totals.issue)} issued against ${sourceLabel}. Balances now reflect ${
            drafts.length
          } new ledger ${drafts.length === 1 ? "row" : "rows"} and ${row.engineerName} has been notified.`,
    );
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-3xl"
      title={`Issue against ${sourceLabel}`}
      sub="One action writes every line. Each row below becomes an append-only ISSUE movement carrying its source document, so the balance can be reconstructed from the ledger alone."
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon={PackageCheck} onClick={confirm} disabled={blocked}>
            {isPartial ? "Issue partially" : "Issue"} · {formatQty(totals.issue)}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Note tone="neutral" title="What this writes" icon={Info}>
          {row.lines.filter((l) => (qty[l.itemId] ?? 0) > 0).length} ledger{" "}
          {row.lines.filter((l) => (qty[l.itemId] ?? 0) > 0).length === 1 ? "row" : "rows"} from sequence{" "}
          <span className="t-mono text-text-hi">{view.maxSeq + 1}</span>, out of{" "}
          <span className="text-text-hi">{row.location?.name ?? "the store"}</span>, referencing{" "}
          <span className="t-mono text-text-hi">{sourceLabel}</span>
          {row.boqLine ? (
            <>
              {" "}
              and BOQ line <span className="t-mono text-text-hi">{row.boqLine.code}</span>
            </>
          ) : null}
          , actor <span className="text-text-hi">{actor.name}</span>, timestamped{" "}
          <span className="t-mono text-text-hi">{formatDateTime(new Date())}</span>. Nothing here can be edited
          afterwards — a correction is another movement.
        </Note>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <caption className="sr-only">Quantities to issue</caption>
            <thead>
              <tr>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-left text-text-lo">Item</th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-right text-text-lo">Outstanding</th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-right text-text-lo">Available</th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-right text-text-lo">Issue now</th>
                <th scope="col" className="t-overline border-b border-line px-2 py-1 text-right text-text-lo">Shortfall</th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((l) => {
                const q = qty[l.itemId] ?? 0;
                const short = Math.max(0, l.outstanding - q);
                return (
                  <tr key={l.itemId}>
                    <td className="border-b border-line/70 px-2 py-1.5">
                      <span className="t-mono block text-text-hi">{l.item?.code ?? l.itemId}</span>
                      <span className="t-body-sm block text-text-lo">{l.item?.description}</span>
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-2 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(l.outstanding, l.item?.uom)}
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-2 py-1.5 text-right text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(l.available, l.item?.uom)}
                    </td>
                    <td className="border-b border-line/70 px-2 py-1.5 text-right">
                      <label className="inline-flex items-center gap-1.5">
                        <span className="sr-only">Quantity of {l.item?.code ?? l.itemId} to issue</span>
                        <NumInput
                          className="w-24"
                          min={0}
                          max={l.issuable}
                          value={q}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            setQty((prev) => ({
                              ...prev,
                              [l.itemId]: Number.isFinite(n) ? Math.max(0, Math.min(l.issuable, Math.round(n))) : 0,
                            }));
                          }}
                        />
                      </label>
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-2 py-1.5 text-right text-danger" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {short > 0 ? formatQty(short, l.item?.uom) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isPartial ? (
          <Note tone="warn" title="This will be recorded as a partial issue">
            {formatQty(totals.short)} stays outstanding on {row.request.number}, the request remains open at status
            Partially issued, and every short line is flagged service-critical against{" "}
            <span className="t-mono">{row.jobCard?.number ?? sourceLabel}</span> on the reorder list.
          </Note>
        ) : null}

        <Field
          label="Note on the issue"
          hint="Optional. Recorded verbatim on every ledger row this action writes."
        >
          <TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Handed to the engineer at the counter, remainder on order…"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------- project issue modal */

function ProjectIssueModal({
  open,
  view,
  actor,
  onClose,
  onIssued,
}: {
  open: boolean;
  view: InvView;
  actor: Actor;
  onClose: () => void;
  onIssued: (tone: "ok" | "warn", title: string, body: string) => void;
}) {
  const mutate = useMutate();
  const projects = React.useMemo(
    () => [...view.ds.projects].sort((a, b) => a.code.localeCompare(b.code)),
    [view.ds.projects],
  );
  const [projectId, setProjectId] = React.useState("");
  const [boqLineId, setBoqLineId] = React.useState("");
  const [itemId, setItemId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [locationId, setLocationId] = React.useState(view.locations[0]?.id ?? "");
  const [qty, setQty] = React.useState(1);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setProjectId("");
    setBoqLineId("");
    setItemId("");
    setSearch("");
    setQty(1);
    setReason("");
  }, [open]);

  const boqLines = React.useMemo(
    () =>
      projectId
        ? view.ds.boqLines.filter((l) => l.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    [projectId, view.ds.boqLines],
  );
  const boqLine = boqLineId ? view.boqLineById.get(boqLineId) ?? null : null;

  React.useEffect(() => {
    if (boqLine?.itemId) setItemId(boqLine.itemId);
  }, [boqLine]);

  const item = itemId ? view.itemById.get(itemId) ?? null : null;
  const candidates = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return view.items
      .filter(
        (i) =>
          i.code.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.oemPartNumber.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, view.items]);

  const project = projectId ? view.projectById.get(projectId) ?? null : null;
  const available = item ? Math.max(0, availableOf(view, item.id, locationId)) : 0;
  const overdraw = item ? qty > available : false;
  const blocked = !project || !boqLine || !item || qty <= 0 || overdraw;

  function confirm() {
    if (blocked || !project || !boqLine || !item) return;
    const at = new Date().toISOString();
    const number = `BC/PR/2627/L${String(view.partsRequests.length + 1).padStart(4, "0")}`;
    const sourceLabel = `${project.code} · BOQ ${boqLine.code}`;

    mutate((o: Overlay) => {
      appendMovements(
        o,
        view.maxSeq,
        actor,
        [
          {
            itemId: item.id,
            type: "ISSUE",
            qty,
            fromLocationId: locationId,
            toLocationId: null,
            sourceType: "PROJECT",
            sourceId: project.id,
            sourceLabel,
            rate: item.standardCost,
            reason: reason.trim() ? reason.trim() : `Issued to ${project.code} against BOQ line ${boqLine.code}`,
          },
        ],
        at,
      );

      o.newRequests.push({
        id: `PR-L${String(view.partsRequests.length + 1).padStart(4, "0")}`,
        number,
        jobCardId: null,
        projectId: project.id,
        boqLineId: boqLine.id,
        requestedByUserId: actor.userId,
        stockLocationId: locationId,
        lines: [{ itemId: item.id, qtyRequested: qty, qtyIssued: qty }],
        serviceCritical: false,
        status: "ISSUED",
        raisedAt: at,
        issuedAt: at,
      });

      writeAudit(o, actor, {
        at,
        action: "CREATE",
        entityType: "StockMovement",
        entityId: number,
        entityLabel: number,
        summary: `Issue of ${formatQty(qty, item.uom)} ${item.code} to ${project.code}, BOQ line ${boqLine.code}`,
        before: null,
        after: `ISSUE ${qty} ${item.uom} · ${sourceLabel}`,
      });

      notify(o, {
        at,
        toUserId: project.managerUserId,
        toLabel: view.userById.get(project.managerUserId)?.name ?? "Project manager",
        channel: "IN_APP",
        digest: false,
        title: "Material issued to your project",
        body: `${formatQty(qty, item.uom)} of ${item.code} issued against BOQ line ${boqLine.code} on ${project.code}.`,
        href: `/projects/${project.id}/boq`,
      });
    });

    onIssued(
      "ok",
      "Material issued to the project",
      `${formatQty(qty, item.uom)} of ${item.code} left ${
        view.locationById.get(locationId)?.name ?? "the store"
      } against ${sourceLabel}. The movement carries the project and the BOQ line, so it reconciles against measured work.`,
    );
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="Issue material against a project BOQ line"
      sub="A project issue must name the BOQ line it is consumed against, so executed quantity and material draw can be reconciled later."
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon={PackageCheck} onClick={confirm} disabled={blocked}>
            Issue to project
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Project" required>
            <Select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setBoqLineId("");
                setItemId("");
              }}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="BOQ line" required hint={projectId ? undefined : "Choose a project first"}>
            <Select value={boqLineId} onChange={(e) => setBoqLineId(e.target.value)} disabled={!projectId}>
              <option value="">Select a BOQ line…</option>
              {boqLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.description.slice(0, 48)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {item ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2">
            <span className="min-w-0">
              <span className="t-mono block text-text-hi">{item.code}</span>
              <span className="t-body-sm block truncate text-text-mid">{item.description}</span>
            </span>
            <Btn
              size="sm"
              onClick={() => {
                setItemId("");
                setSearch("");
              }}
            >
              Change item
            </Btn>
          </div>
        ) : (
          <Field label="Item" required hint="Search by item code, description or OEM part number">
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Start typing…" />
          </Field>
        )}

        {!item && candidates.length ? (
          <ul className="flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setItemId(c.id)}
                  className="flex min-h-8 w-full items-center justify-between gap-3 bg-surface-1 px-3 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="t-mono text-text-hi">{c.code}</span>
                  <span className="t-body-sm min-w-0 flex-1 truncate text-text-mid">{c.description}</span>
                  <span className="t-mono text-text-lo">{formatQty(onHandOf(view, c.id), c.uom)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Issue from" required>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {view.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Quantity"
            required
            error={overdraw ? `Only ${formatQty(available)} available at that location` : null}
          >
            <NumInput min={1} value={qty} onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value) || 0)))} />
          </Field>
        </div>

        <Field label="Reason or reference" hint="Optional. Written onto the ledger row alongside the BOQ reference.">
          <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Pipework for pump house, section B…" />
        </Field>

        {overdraw ? (
          <Blocked
            title="Issue blocked — the location does not hold that quantity"
            rule={`${view.locationById.get(locationId)?.name ?? "The location"} has ${formatQty(available)} available of ${
              item?.code ?? "this item"
            }. Issuing more would drive the ledger negative, which the platform refuses.`}
            unblock="Reduce the quantity, transfer stock into this location, or receive against an open purchase order first."
          />
        ) : null}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ session ledger */

function SessionLedger({ view }: { view: InvView }) {
  const issued = view.overlay.movements.filter((m) => m.type === "ISSUE").slice().reverse();
  const notices = view.notices.slice().reverse().slice(0, 6);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader
          title="Issued in this session"
          sub="Every row below was appended by this screen. There is no edit or delete path for any of them."
        />
        {issued.length === 0 ? (
          <p className="t-body-sm px-3 py-6 text-center text-text-lo">
            No issue has been made yet in this session. Issue a pending request and its ledger rows appear here with
            their sequence numbers.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse">
              <caption className="sr-only">Stock movements written in this session</caption>
              <thead>
                <tr>
                  <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-left text-text-lo">Seq</th>
                  <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-left text-text-lo">Item</th>
                  <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-right text-text-lo">Qty</th>
                  <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-left text-text-lo">Source</th>
                  <th scope="col" className="t-overline border-b border-line px-3 py-1.5 text-left text-text-lo">At</th>
                </tr>
              </thead>
              <tbody>
                {issued.map((m) => (
                  <tr key={m.id}>
                    <td className="t-mono border-b border-line/70 px-3 py-1.5 text-text-lo">#{m.seq}</td>
                    <td className="t-mono border-b border-line/70 px-3 py-1.5 text-text-hi">
                      {view.itemById.get(m.itemId)?.code ?? m.itemId}
                    </td>
                    <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-right text-text-hi" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatQty(m.qty)}
                    </td>
                    <td className="t-mono border-b border-line/70 px-3 py-1.5 text-text-mid">{m.sourceLabel}</td>
                    <td className="t-body-sm border-b border-line/70 px-3 py-1.5 text-text-lo">{formatDateTime(m.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Notifications raised"
          sub="Issue and shortfall notices sent from this screen. Service-critical goes immediately; routine shortages batch into the daily digest on the reorder list."
        />
        {notices.length === 0 ? (
          <p className="t-body-sm px-3 py-6 text-center text-text-lo">
            No notification has been raised in this session.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--line)]">
            {notices.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 px-3 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="t-body-sm font-medium text-text-hi">{n.title}</span>
                  <StatusBadge tone={n.digest ? "neutral" : "warn"}>
                    {n.digest ? "Daily digest" : "Immediate"}
                  </StatusBadge>
                  <span className="t-body-sm text-text-lo">to {n.toLabel}</span>
                  <span className="t-body-sm ml-auto text-text-lo">{formatDateTime(n.at)}</span>
                </span>
                <span className="t-body-sm text-text-mid">{n.body}</span>
                {n.href ? (
                  <Link href={n.href} className="t-body-sm text-info hover:underline">
                    Open the record
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export type { Focus as MovementsFocus };
