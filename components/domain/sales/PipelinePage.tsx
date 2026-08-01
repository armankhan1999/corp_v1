"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowUpRight, Ban, CalendarClock, Check, Clock, GripVertical, Inbox,
  LayoutGrid, MessageSquare, MoveRight, Search, TriangleAlert, User, X,
} from "lucide-react";
import type * as T from "@/lib/schemas/entities";
import type { Vertical } from "@/lib/schemas/enums";
import { VERTICAL_LABEL, VERTICAL_TOKEN } from "@/lib/schemas/enums";
import { abbreviateINR, formatCount, formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, Overline, Panel, PanelHeader, Skeleton, StatusBadge } from "@/components/patterns/primitives";
import {
  ACTIVITY_MODES, LOSS_REASONS, STAGES, STAGE_AGEING, STAGE_LABEL, VERTICALS,
  buildOpportunities, type Ageing, type Opportunity, type Stage,
} from "./calc";
import {
  MOVE_TARGETS, STAGE_HINT, ageingExplanation, ageingWord, buildBoard,
  checkBoardMove, executeBoardMove, offerToClose, type BoardColumn,
} from "./pipeline";
import { inScope, permissionsOf, scopeNoteFor, useSalesSession, type SalesPermissions } from "./session";
import { retryLoad, useSalesStore, type SalesWorld } from "./store";
import { FollowUpDialog, type FollowUpSubject } from "./FollowUp";
import {
  BlockedNotice, Btn, ErrorPanel, Field, FilterBar, FilteredEmpty, InlineLabel, LinkBtn,
  Modal, Notice, PageHeader, Select, Stat, TextInput,
} from "./ui";

/**
 * E3-S8 — pipeline board with automatic ageing.
 *
 * Every move, dragged or keyed, runs `executeBoardMove`, which runs the same
 * validations the quotation screen runs. A refusal never moves the card: it is
 * still rendered in its origin column and the reason is stated above the board.
 */

interface Filters extends Record<string, string> {
  q: string;
  owner: string;
  vertical: string;
  ageing: string;
}
const EMPTY: Filters = { q: "", owner: "", vertical: "", ageing: "" };

export function PipelinePage() {
  const store = useSalesStore();
  const session = useSalesSession();

  if (store.status === "loading" || !session) return <BoardSkeleton />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  return <Board w={store.world} perms={permissionsOf(session)} />;
}

/* ------------------------------------------------------------------ board */

function Board({ w, perms }: { w: SalesWorld; perms: SalesPermissions }) {
  const router = useRouter();
  const [f, setF] = React.useState<Filters>(EMPTY);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<Stage | null>(null);
  const [moveFor, setMoveFor] = React.useState<Opportunity | null>(null);
  const [lossFor, setLossFor] = React.useState<Opportunity | null>(null);
  const [followUp, setFollowUp] = React.useState<FollowUpSubject | null>(null);
  const [blocked, setBlocked] = React.useState<{ reason: string; remedy?: string; origin: Stage } | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");

  const opportunities = React.useMemo(
    () =>
      buildOpportunities({
        now: w.now,
        enquiries: w.enquiries,
        quotations: w.quotations,
        quotationLines: w.quotationLines,
        salesOrders: w.salesOrders,
        activities: w.activities,
        customers: w.customers,
        sites: w.sites,
      }),
    [w],
  );

  // E3-S8 AC-6 — a branch manager sees every executive in the branch, a sales
  // executive sees only their own cards. An unowned enquiry belongs to nobody's
  // personal board, so it never appears in an OWN-scoped session.
  const scoped = React.useMemo(
    () =>
      opportunities.filter((o) =>
        inScope(perms, "enquiries", { branchId: o.enquiry.branchId, ownerUserId: o.enquiry.ownerUserId }),
      ),
    [opportunities, perms],
  );

  const needle = f.q.trim().toLowerCase();
  const visible = React.useMemo(
    () =>
      scoped.filter((o) => {
        if (needle) {
          const hay = `${o.enquiry.number} ${o.customer?.legalName ?? ""} ${o.customer?.code ?? ""} ${o.latest?.number ?? ""}`;
          if (!hay.toLowerCase().includes(needle)) return false;
        }
        if (f.owner && o.enquiry.ownerUserId !== f.owner) return false;
        if (f.vertical && o.enquiry.vertical !== f.vertical) return false;
        if (f.ageing === "warn" && o.ageing === "OK") return false;
        if (f.ageing === "escalate" && o.ageing !== "ESCALATE") return false;
        if (f.ageing === "overdue" && !o.nextActionOverdue) return false;
        return true;
      }),
    [scoped, needle, f.owner, f.vertical, f.ageing],
  );

  const columns = React.useMemo(() => buildBoard(visible), [visible]);
  const byId = React.useMemo(() => new Map(visible.map((o) => [o.enquiry.id, o])), [visible]);

  const active: string[] = [];
  if (f.q) active.push(`search "${f.q}"`);
  if (f.owner) active.push(`owner ${w.userById.get(f.owner)?.name ?? f.owner}`);
  if (f.vertical) active.push(`vertical ${VERTICAL_LABEL[f.vertical as Vertical]}`);
  if (f.ageing === "warn") active.push("ageing or escalated only");
  if (f.ageing === "escalate") active.push("escalated only");
  if (f.ageing === "overdue") active.push("overdue next action");

  const openOpps = visible.filter((o) => o.stage !== "WON" && o.stage !== "LOST");
  const openValue = openOpps.reduce((s, o) => s + o.value, 0);
  const warnCount = openOpps.filter((o) => o.ageing === "WARN").length;
  const escalations = openOpps.filter((o) => o.ageing === "ESCALATE").sort((a, b) => b.value - a.value);
  const canMove = perms.canWrite("enquiries");
  const branchName = w.branchById.get(perms.branchId)?.name ?? "your branch";
  const scopeNote = scopeNoteFor(perms, "enquiries", branchName);

  function preview(o: Opportunity, to: Stage) {
    // A loss always collects a structured reason in the dialog, so the preview
    // tests the structural rules with a placeholder rather than reporting the
    // missing reason as though it were a blockage.
    return checkBoardMove(o, to, to === "LOST" ? "PRICE" : null, w.now);
  }

  function run(o: Opportunity, to: Stage, opts: Parameters<typeof executeBoardMove>[2] = {}) {
    const res = executeBoardMove(o, to, opts, perms.actor, w.now);
    if (!res.ok) {
      setFlash(null);
      setBlocked({
        reason: res.reason ?? "The transition was refused.",
        remedy: res.remedy,
        origin: o.stage,
      });
      setAnnouncement(
        `Move refused. ${o.enquiry.number} stays in ${STAGE_LABEL[o.stage]}. ${res.reason ?? ""}`,
      );
      return false;
    }
    setBlocked(null);
    setFlash(res.note ?? `Moved to ${STAGE_LABEL[to]}.`);
    setAnnouncement(`${o.enquiry.number} moved from ${STAGE_LABEL[o.stage]} to ${STAGE_LABEL[to]}.`);
    if (res.orderId) router.push(`/sales/orders/${res.orderId}`);
    return true;
  }

  function handleDrop(to: Stage) {
    const o = dragId ? byId.get(dragId) : null;
    setDragId(null);
    setOverStage(null);
    if (!o || o.stage === to) return;
    if (to === "LOST") {
      setLossFor(o);
      return;
    }
    run(o, to);
  }

  const dragging = dragId ? byId.get(dragId) ?? null : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Pipeline"
        lead="The board ages itself. Every card carries the days it has sat in its current stage against the threshold for that stage, so an opportunity going cold is visible before it is lost."
        meta={
          <>
            <StatusBadge tone="neutral" icon={false}>{formatCount(scoped.length)} opportunities in scope</StatusBadge>
            {scopeNote ? <StatusBadge tone="info">{scopeNote}</StatusBadge> : null}
            {canMove ? null : <StatusBadge tone="warn">Read-only session — cards cannot be moved</StatusBadge>}
          </>
        }
        right={
          <>
            <LinkBtn href="/sales/my-desk">My desk</LinkBtn>
            <LinkBtn href="/sales/enquiries" variant="primary">Capture enquiry</LinkBtn>
          </>
        }
      />

      <p aria-live="polite" role="status" className="sr-only">{announcement}</p>

      {flash ? (
        <Notice tone="ok" icon={Check} title={flash}>
          <button type="button" className="underline underline-offset-2" onClick={() => setFlash(null)}>Dismiss</button>
        </Notice>
      ) : null}

      {blocked ? (
        <BlockedNotice
          reason={`${blocked.reason} The card was returned to ${STAGE_LABEL[blocked.origin]}.`}
          remedy={blocked.remedy}
          action={<Btn size="sm" onClick={() => setBlocked(null)}><X className="size-3.5" aria-hidden /> Dismiss</Btn>}
        />
      ) : null}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><Stat label="Open pipeline value" value={abbreviateINR(openValue)} sub={`${formatCount(openOpps.length)} live opportunities · lapsed offers excluded`} /></li>
        <li><Stat label="Ageing past first threshold" value={formatCount(warnCount)} sub="Warning treatment applied on the card" tone={warnCount ? "warn" : "ok"} /></li>
        <li><Stat label="Escalated" value={formatCount(escalations.length)} sub="Past the second threshold — in the exception feed" tone={escalations.length ? "danger" : "ok"} /></li>
        <li><Stat label="Overdue next action" value={formatCount(openOpps.filter((o) => o.nextActionOverdue).length)} sub="Next-action date passed with no later activity" href="/sales/my-desk" tone={openOpps.some((o) => o.nextActionOverdue) ? "warn" : "ok"} /></li>
      </ul>

      <Panel>
        <PanelHeader
          title="Board"
          sub="Drag a card between columns, or use the Move to… control on any card — both run the identical validation set."
          right={<Overline>{formatCount(visible.length)} shown</Overline>}
        />
        <FilterBar>
          <label className="flex min-w-52 flex-1 flex-col gap-1">
            <InlineLabel>Search</InlineLabel>
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2 size-3.5 text-text-lo" aria-hidden />
              <TextInput
                value={f.q}
                onChange={(e) => setF({ ...f, q: e.target.value })}
                className="pl-7"
                placeholder="Enquiry number, quotation or customer"
              />
            </span>
          </label>
          {perms.ownOnly ? null : (
            <label className="flex flex-col gap-1">
              <InlineLabel>Executive</InlineLabel>
              <Select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} className="w-48">
                <option value="">All executives in scope</option>
                {w.ds.users
                  .filter((u) => u.role === "SALES_EXECUTIVE" || u.role === "BRANCH_MANAGER")
                  .filter((u) => (perms.visibleBranchIds ? u.branchId === perms.branchId : true))
                  .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <InlineLabel>Vertical</InlineLabel>
            <Select value={f.vertical} onChange={(e) => setF({ ...f, vertical: e.target.value })} className="w-44">
              <option value="">All verticals</option>
              {VERTICALS.map((v) => <option key={v} value={v}>{VERTICAL_LABEL[v]}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <InlineLabel>Ageing</InlineLabel>
            <Select value={f.ageing} onChange={(e) => setF({ ...f, ageing: e.target.value })} className="w-52">
              <option value="">Any age</option>
              <option value="warn">Ageing or escalated</option>
              <option value="escalate">Escalated only</option>
              <option value="overdue">Overdue next action</option>
            </Select>
          </label>
          {active.length > 0 ? <Btn onClick={() => setF(EMPTY)}>Clear filters</Btn> : null}
        </FilterBar>

        {scoped.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing in your pipeline yet"
            body="The board is built from enquiries you own. Capture one and it lands in the Enquiry column with its ageing clock already running."
            action={<LinkBtn href="/sales/enquiries" variant="primary">Capture an enquiry</LinkBtn>}
          />
        ) : visible.length === 0 ? (
          <FilteredEmpty noun="opportunities" activeFilters={active} onClear={() => setF(EMPTY)} />
        ) : (
          <div className="overflow-x-auto p-3">
            <div className="flex min-w-max items-start gap-3">
              {columns.map((col) => (
                <Column
                  key={col.stage}
                  col={col}
                  w={w}
                  canMove={canMove}
                  dragging={dragging}
                  isOver={overStage === col.stage}
                  check={dragging ? preview(dragging, col.stage) : null}
                  onDragOver={() => setOverStage(col.stage)}
                  onDragLeave={() => setOverStage((s) => (s === col.stage ? null : s))}
                  onDrop={() => handleDrop(col.stage)}
                  onDragStartCard={(id) => { setDragId(id); setBlocked(null); }}
                  onDragEndCard={() => { setDragId(null); setOverStage(null); }}
                  onMove={(o) => setMoveFor(o)}
                  onFollowUp={(s) => setFollowUp(s)}
                />
              ))}
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Escalations published to the exception feed"
            sub="A card past the second ageing threshold for its stage stops being a colour on a board and becomes an item somebody must answer for."
            right={
              perms.can("command.exceptions") ? (
                <LinkBtn href="/command/exceptions" size="sm">Open exception feed</LinkBtn>
              ) : (
                <Overline>Visible to the branch manager</Overline>
              )
            }
          />
          {escalations.length === 0 ? (
            <EmptyState
              icon={Check}
              title="No opportunity has breached its escalation threshold"
              body="Every card in scope is inside the ageing thresholds published for its stage. Nothing here is going cold unnoticed."
            />
          ) : (
            <ul className="divide-y divide-line">
              {escalations.slice(0, 8).map((o) => (
                <li key={o.enquiry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0">
                    <span className="t-body block truncate text-text-hi">{o.customer?.legalName ?? "Unknown customer"}</span>
                    <span className="t-body-sm flex flex-wrap items-center gap-1.5 text-text-lo">
                      <span className="t-mono">{o.enquiry.number}</span>
                      <span aria-hidden>·</span>
                      <span>{STAGE_LABEL[o.stage]}</span>
                      <span aria-hidden>·</span>
                      <span>{ageingExplanation(o.stage, o.ageing, o.daysInStage)}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="t-body tabular-nums text-text-hi">{abbreviateINR(o.value)}</span>
                    <StatusBadge tone="danger">{o.daysInStage} d</StatusBadge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Ageing thresholds" sub="Held as data, published on the board — FR-M3-18." />
          <ul className="divide-y divide-line">
            {STAGES.filter((s) => STAGE_AGEING[s].warn < 999).map((s) => (
              <li key={s} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="t-body-sm text-text-mid">{STAGE_LABEL[s]}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge tone="warn">warn {STAGE_AGEING[s].warn} d</StatusBadge>
                  <StatusBadge tone="danger">escalate {STAGE_AGEING[s].escalate} d</StatusBadge>
                </span>
              </li>
            ))}
          </ul>
          <p className="t-body-sm border-t border-line px-4 py-2.5 text-text-lo">
            Won and Lost are terminal and are never aged — a closed opportunity cannot go cold.
          </p>
        </Panel>
      </div>

      <MoveDialog
        o={moveFor}
        w={w}
        onOpenChange={(v) => { if (!v) setMoveFor(null); }}
        preview={preview}
        onChoose={(o, to) => {
          if (to === "LOST") {
            setMoveFor(null);
            setLossFor(o);
            return;
          }
          setMoveFor(null);
          run(o, to);
        }}
      />

      <LossDialog
        o={lossFor}
        onOpenChange={(v) => { if (!v) setLossFor(null); }}
        onConfirm={(o, lossReason, competitor, mode) => {
          setLossFor(null);
          run(o, "LOST", { lossReason, competitor, mode });
        }}
        hasOffer={lossFor ? !!offerToClose(lossFor, w.now) : false}
      />

      <FollowUpDialog
        open={!!followUp}
        onOpenChange={(v) => { if (!v) setFollowUp(null); }}
        subject={followUp}
        actor={perms.actor}
        todayIso={w.ds.meta.today}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- column */

function Column({
  col, w, canMove, dragging, isOver, check,
  onDragOver, onDragLeave, onDrop, onDragStartCard, onDragEndCard, onMove, onFollowUp,
}: {
  col: BoardColumn;
  w: SalesWorld;
  canMove: boolean;
  dragging: Opportunity | null;
  isOver: boolean;
  check: { ok: boolean; reason?: string } | null;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onMove: (o: Opportunity) => void;
  onFollowUp: (s: FollowUpSubject) => void;
}) {
  const isOrigin = dragging?.stage === col.stage;
  const droppable = !!dragging && !isOrigin && !!check?.ok;
  const refused = !!dragging && !isOrigin && !!check && !check.ok;

  return (
    <section
      aria-labelledby={`pv-col-${col.stage}`}
      onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = droppable ? "move" : "none";
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={cn(
        "flex w-[19.5rem] shrink-0 flex-col rounded-md border bg-surface-1 transition-colors duration-150",
        isOver && droppable && "border-primary-500 bg-primary-100/40",
        isOver && refused && "border-danger/60",
        !isOver && "border-line",
      )}
    >
      <header className="border-b border-line px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={`pv-col-${col.stage}`} className="t-overline text-text-mid">{STAGE_LABEL[col.stage]}</h2>
          <span className="t-body-sm tabular-nums text-text-lo">
            {formatCount(col.count)} {col.count === 1 ? "card" : "cards"}
          </span>
        </div>
        <p className="t-heading-md mt-1 text-right tabular-nums text-text-hi" title={formatINR(col.value)}>
          {abbreviateINR(col.value)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="t-body-sm text-text-lo">{STAGE_HINT[col.stage]}</span>
          {col.escalate > 0 ? <StatusBadge tone="danger">{col.escalate} escalated</StatusBadge> : null}
          {col.warn > 0 ? <StatusBadge tone="warn">{col.warn} ageing</StatusBadge> : null}
        </div>
        {dragging && !isOrigin ? (
          <p
            className={cn(
              "t-body-sm mt-2 flex items-start gap-1.5 rounded-sm border px-2 py-1",
              droppable ? "border-primary-500/50 bg-primary-100/50 text-text-hi" : "border-danger/40 bg-danger-bg text-danger",
            )}
          >
            {droppable ? <MoveRight className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Ban className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
            <span>{droppable ? `Drop to move to ${STAGE_LABEL[col.stage]}` : "Not permitted — drop to see why"}</span>
          </p>
        ) : null}
      </header>

      <ul className="flex max-h-[64vh] min-h-24 flex-col gap-2 overflow-y-auto p-2">
        {col.items.length === 0 ? (
          <li className="t-body-sm flex flex-1 items-center justify-center px-3 py-6 text-center text-text-lo">
            Nothing in {STAGE_LABEL[col.stage]}.
          </li>
        ) : (
          col.items.map((o) => (
            <Card
              key={o.enquiry.id}
              o={o}
              w={w}
              canMove={canMove}
              isDragging={dragging?.enquiry.id === o.enquiry.id}
              onDragStart={() => onDragStartCard(o.enquiry.id)}
              onDragEnd={onDragEndCard}
              onMove={() => onMove(o)}
              onFollowUp={() =>
                onFollowUp({
                  type: "ENQUIRY",
                  id: o.enquiry.id,
                  label: o.enquiry.number,
                  customerId: o.enquiry.customerId,
                })
              }
            />
          ))
        )}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------- card */

const AGEING_ICON: Record<Ageing, React.ComponentType<{ className?: string }>> = {
  OK: Clock,
  WARN: TriangleAlert,
  ESCALATE: AlertTriangle,
};

function Card({
  o, w, canMove, isDragging, onDragStart, onDragEnd, onMove, onFollowUp,
}: {
  o: Opportunity;
  w: SalesWorld;
  canMove: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: () => void;
  onFollowUp: () => void;
}) {
  const owner = o.enquiry.ownerUserId ? w.userById.get(o.enquiry.ownerUserId)?.name ?? "—" : "Unassigned";
  const AgeIcon = AGEING_ICON[o.ageing];
  const accent = { "--accent": VERTICAL_TOKEN[o.enquiry.vertical] } as React.CSSProperties;
  const href = o.latest ? `/sales/quotations/${o.latest.id}` : `/sales/customers/${o.enquiry.customerId}`;

  return (
    <li>
      <article
        draggable={canMove}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", o.enquiry.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        style={accent}
        aria-labelledby={`pv-card-${o.enquiry.id}`}
        className={cn(
          "accent-rail lift group relative rounded-md border bg-surface-1 py-2.5 pl-4 pr-3",
          o.ageing === "ESCALATE" ? "border-danger/45" : o.ageing === "WARN" ? "border-warn/40" : "border-line",
          isDragging && "opacity-55",
          canMove && "cursor-grab active:cursor-grabbing",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 id={`pv-card-${o.enquiry.id}`} className="t-body truncate font-medium text-text-hi">
              {o.customer?.legalName ?? "Unknown customer"}
            </h3>
            <p className="t-mono mt-0.5 truncate text-[0.75rem] text-text-lo">
              {o.latest ? `${o.latest.number} v${o.latest.version}` : o.enquiry.number}
            </p>
          </div>
          {canMove ? (
            <GripVertical className="mt-0.5 size-4 shrink-0 text-text-lo opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
          ) : null}
        </div>

        <p className="t-heading-md mt-2 text-right tabular-nums text-text-hi" title={`${formatINR(o.value)} — ${o.valueBasis}`}>
          {abbreviateINR(o.value)}
        </p>
        <p className="t-body-sm -mt-0.5 text-right text-text-lo">{o.valueBasis}</p>

        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-line pt-2">
          <div className="min-w-0">
            <dt className="t-overline text-text-lo">Owner</dt>
            <dd className="t-body-sm flex items-center gap-1 truncate text-text-mid">
              <User className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{owner}</span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="t-overline text-text-lo">In stage</dt>
            <dd
              className={cn(
                "t-body-sm flex items-center gap-1 tabular-nums",
                o.ageing === "ESCALATE" ? "text-danger" : o.ageing === "WARN" ? "text-warn" : "text-text-mid",
              )}
            >
              <AgeIcon className="size-3 shrink-0" aria-hidden />
              <span>{o.daysInStage} d · {ageingWord(o.ageing)}</span>
            </dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="t-overline text-text-lo">Next action</dt>
            <dd className={cn("t-body-sm flex items-center gap-1", o.nextActionOverdue ? "text-danger" : "text-text-mid")}>
              <CalendarClock className="size-3 shrink-0" aria-hidden />
              <span>
                {o.nextActionDate
                  ? `${formatDate(o.nextActionDate)}${o.nextActionOverdue ? " · overdue" : ""}`
                  : "None scheduled"}
              </span>
            </dd>
          </div>
        </dl>

        {o.ageing !== "OK" ? (
          <p
            className={cn(
              "t-body-sm mt-2 rounded-sm border px-2 py-1",
              o.ageing === "ESCALATE" ? "border-danger/40 bg-danger-bg text-danger" : "border-warn/40 bg-warn-bg text-warn",
            )}
          >
            {ageingExplanation(o.stage, o.ageing, o.daysInStage)}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {canMove ? (
            <Btn size="sm" onClick={onMove} aria-label={`Move ${o.enquiry.number} to another stage`}>
              <MoveRight className="size-3.5" aria-hidden /> Move to…
            </Btn>
          ) : null}
          <Btn size="sm" variant="ghost" onClick={onFollowUp} aria-label={`Record a follow-up on ${o.enquiry.number}`}>
            <MessageSquare className="size-3.5" aria-hidden /> Follow-up
          </Btn>
          <Link
            href={href}
            className="t-body-sm ml-auto inline-flex h-7 items-center gap-1 rounded-sm px-2 text-text-mid transition-colors duration-150 hover:bg-surface-2 hover:text-text-hi"
          >
            Open <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </article>
    </li>
  );
}

/* --------------------------------------------------------- move + loss UI */

function MoveDialog({
  o, w, onOpenChange, preview, onChoose,
}: {
  o: Opportunity | null;
  w: SalesWorld;
  onOpenChange: (v: boolean) => void;
  preview: (o: Opportunity, to: Stage) => { ok: boolean; reason?: string; remedy?: string };
  onChoose: (o: Opportunity, to: Stage) => void;
}) {
  return (
    <Modal
      open={!!o}
      onOpenChange={onOpenChange}
      title="Move to…"
      description={
        o
          ? `${o.customer?.legalName ?? "Unknown customer"} · ${o.enquiry.number} · currently ${STAGE_LABEL[o.stage]}, ${o.daysInStage} days in stage.`
          : undefined
      }
      footer={<Btn onClick={() => onOpenChange(false)}>Cancel</Btn>}
    >
      <p className="t-body-sm mb-3 text-text-mid">
        The keyboard route runs the same validations as the drag route — WCAG 2.2 requires a non-drag path, and it has
        to be the same path, not a lenient one. A stage that is not permitted states the rule and what would unblock it.
      </p>
      <ul className="flex flex-col gap-2">
        {o
          ? MOVE_TARGETS.map((to) => {
            const current = to === o.stage;
            const check = current ? { ok: false, reason: "This is the current stage." } : preview(o, to);
            if (current) {
              return (
                <li key={to}>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-primary-500/50 bg-primary-100/40 px-3 py-2">
                    <span className="t-body text-text-hi">{STAGE_LABEL[to]}</span>
                    <StatusBadge tone="info">Current stage</StatusBadge>
                  </div>
                </li>
              );
            }
            return (
              <li key={to}>
                {check.ok ? (
                  <button
                    type="button"
                    onClick={() => onChoose(o, to)}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-line bg-surface-1 px-3 py-2 text-left transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="t-body block text-text-hi">{STAGE_LABEL[to]}</span>
                      <span className="t-body-sm block text-text-lo">{STAGE_HINT[to]}</span>
                    </span>
                    <MoveRight className="size-4 shrink-0 text-text-mid" aria-hidden />
                  </button>
                ) : (
                  <div className="rounded-md border border-line bg-surface-2/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="t-body text-text-mid">{STAGE_LABEL[to]}</span>
                      <StatusBadge tone="warn">Not permitted</StatusBadge>
                    </div>
                    <p className="t-body-sm mt-1 text-text-mid">{check.reason}</p>
                    {check.remedy ? <p className="t-body-sm mt-0.5 text-text-lo">{check.remedy}</p> : null}
                  </div>
                )}
              </li>
            );
          })
          : null}
      </ul>
      {o?.order ? (
        <p className="t-body-sm mt-3 text-text-lo">
          This opportunity converted to order{" "}
          <Link href={`/sales/orders/${o.order.id}`} className="t-mono underline underline-offset-2">{o.order.number}</Link>
          {" "}— the order is the live record from here.
        </p>
      ) : null}
      {o ? (
        <p className="t-body-sm mt-3 text-text-lo">
          Value basis: {o.valueBasis.toLowerCase()} — {formatINR(o.value)}. Owner{" "}
          {o.enquiry.ownerUserId ? w.userById.get(o.enquiry.ownerUserId)?.name ?? "—" : "unassigned"}.
        </p>
      ) : null}
    </Modal>
  );
}

function LossDialog({
  o, hasOffer, onOpenChange, onConfirm,
}: {
  o: Opportunity | null;
  hasOffer: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (
    o: Opportunity,
    reason: T.Quotation["lossReason"],
    competitor: string | null,
    mode: T.Activity["mode"],
  ) => void;
}) {
  const [reason, setReason] = React.useState<string>("");
  const [competitor, setCompetitor] = React.useState("");
  const [mode, setMode] = React.useState<T.Activity["mode"]>("CALL");
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!o) return;
    setReason("");
    setCompetitor("");
    setMode("CALL");
    setErr(null);
  }, [o]);

  return (
    <Modal
      open={!!o}
      onOpenChange={onOpenChange}
      title="Record the loss"
      description={o ? `${o.customer?.legalName ?? "Unknown customer"} · ${o.enquiry.number}` : undefined}
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              if (!o) return;
              if (!reason) {
                setErr("A loss needs a structured reason — that is what makes the pipeline teach us something.");
                return;
              }
              onConfirm(o, reason as T.Quotation["lossReason"], competitor.trim() || null, mode);
            }}
          >
            <Check className="size-3.5" aria-hidden /> Mark lost
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Loss reason" required error={err} className="sm:col-span-2">
          {(p) => (
            <Select {...p} value={reason} onChange={(e) => { setReason(e.target.value); setErr(null); }}>
              <option value="">Select a reason</option>
              {LOSS_REASONS.map((r) => <option key={r.value ?? "none"} value={r.value ?? ""}>{r.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Competitor" hint="Optional. Feeds the competitor view in sales analytics.">
          {(p) => <TextInput {...p} value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="Atlas Copco" />}
        </Field>
        {hasOffer ? null : (
          <Field label="How was this learnt?" hint="No quotation was ever issued, so the reason is held as an activity on the enquiry.">
            {(p) => (
              <Select {...p} value={mode} onChange={(e) => setMode(e.target.value as T.Activity["mode"])}>
                {ACTIVITY_MODES.map((m) => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
              </Select>
            )}
          </Field>
        )}
      </div>
      <p className="t-body-sm mt-3 text-text-lo">
        {hasOffer
          ? "The live offer moves to Lost with the reason attached, the enquiry closes with it, and the transition is written to the audit trail."
          : "The enquiry closes as Lost and the reason lands on the customer activity timeline, so a pre-quotation loss is still counted in the loss distribution."}
      </p>
    </Modal>
  );
}

/* -------------------------------------------------------------- skeleton */

/** Matches the final geometry: header, four stats, six columns of cards. */
function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-display-md text-text-hi">Pipeline</h1>
        <Skeleton className="mt-2 h-2.5 w-96" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Panel key={i} className="p-3">
            <Skeleton className="h-2 w-24" />
            <Skeleton className="mt-3 h-6 w-28" />
            <Skeleton className="mt-2 h-2 w-32" />
          </Panel>
        ))}
      </div>
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-2 w-80" />
        </div>
        <div className="overflow-hidden p-3">
          <div className="flex gap-3">
            {STAGES.map((s) => (
              <div key={s} className="flex w-[19.5rem] shrink-0 flex-col rounded-md border border-line bg-surface-1">
                <div className="border-b border-line px-3 py-2.5">
                  <Skeleton className="h-2 w-20" />
                  <Skeleton className="ml-auto mt-2 h-5 w-24" />
                  <Skeleton className="mt-2 h-2 w-36" />
                </div>
                <div className="flex flex-col gap-2 p-2">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="rounded-md border border-line bg-surface-1 py-2.5 pl-4 pr-3">
                      <Skeleton className="h-2.5 w-36" />
                      <Skeleton className="mt-1.5 h-2 w-24" />
                      <Skeleton className="ml-auto mt-3 h-4 w-20" />
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-2">
                        <Skeleton className="h-2 w-16" />
                        <Skeleton className="h-2 w-16" />
                        <Skeleton className="col-span-2 h-2 w-28" />
                      </div>
                      <Skeleton className="mt-3 h-6 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <span className="sr-only" role="status">
        <LayoutGrid className="size-3" aria-hidden /> Loading the pipeline board.
      </span>
    </div>
  );
}
