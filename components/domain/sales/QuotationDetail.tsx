"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, FileText, GitBranch, Handshake, History, Lock, MessageSquare,
  Percent, Plus, Printer, Search, ShieldCheck, ThumbsDown, Trash2, TriangleAlert, X,
} from "lucide-react";
import type * as T from "@/lib/schemas/entities";
import type { QuotationStatus } from "@/lib/schemas/enums";
import {
  abbreviateINR, enumLabel, formatCount, formatDate, formatDateTime, formatINR, formatPercent,
} from "@/lib/format";
import { EmptyState, KeyValue, Overline, Panel, PanelHeader, StatusBadge , Explainer } from "@/components/patterns/primitives";
import {
  DISCOUNT_BANDS, LOSS_REASONS, QUOTATION_TONE, QUOTATION_TRANSITIONS, checkTransition,
  customerExposure, derivePlaceOfSupply, discountGate, effectiveStatus, labelRole, labelStatus,
  lineAmounts, priceListRate, quotationTotals, selfAuthorityPct, validityEnd,
} from "./calc";
import { permissionsOf, useSalesSession } from "./session";
import {
  addCustomQuotationLine, addQuotationLineFromItem, decideQuotationApproval, linesOf,
  quotationFamily, removeQuotationLine, retryLoad, reviseQuotation, transitionQuotation,
  updateQuotation, updateQuotationLine, useSalesStore, type SalesWorld,
} from "./store";
import { QuotationPrintSheet } from "./QuotationPrint";
import { FollowUpDialog, type FollowUpSubject } from "./FollowUp";
import {
  Btn, BlockedNotice, ErrorPanel, Field, LinkBtn, Modal, Notice, NumberInput, PageHeader,
  PageSkeleton, Select, Stat, TableFrame, TextArea, TextInput, Th, Td, Tr,
} from "./ui";

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const PRINT_CSS = `
@media print {
  body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #pv-print-root, #pv-print-root * { visibility: visible !important; }
  #pv-print-root { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
}
`;

export function QuotationDetail({ quotationId }: { quotationId: string }) {
  const store = useSalesStore();
  const session = useSalesSession();
  const router = useRouter();

  const [printOpen, setPrintOpen] = React.useState(false);
  const [itemPickerOpen, setItemPickerOpen] = React.useState(false);
  const [reviseOpen, setReviseOpen] = React.useState(false);
  const [lostOpen, setLostOpen] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [followUp, setFollowUp] = React.useState<FollowUpSubject | null>(null);
  const [blocked, setBlocked] = React.useState<{ reason: string; remedy?: string } | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  if (store.status === "loading" || !session) return <PageSkeleton title="Quotation" cols={8} />;
  if (store.status === "error") return <ErrorPanel message={store.message} onRetry={retryLoad} />;

  const w = store.world;
  const perms = permissionsOf(session);
  const q = w.quotationById.get(quotationId);

  if (!q) {
    return (
      <Panel className="p-2">
        <EmptyState
          icon={AlertTriangle}
          title="No such quotation"
          body={`Nothing in this dataset carries the id ${quotationId}.`}
          action={<LinkBtn href="/sales/quotations" variant="primary">Back to quotations</LinkBtn>}
        />
      </Panel>
    );
  }

  const lines = linesOf(w, q.id);
  const customer = w.customerById.get(q.customerId);
  const site = q.siteId ? w.siteById.get(q.siteId) : undefined;
  const pos = derivePlaceOfSupply(customer, site);
  const totals = quotationTotals(lines, pos.treatment);
  const status = effectiveStatus(q, w.now);
  const family = quotationFamily(w, q);
  const isLatest = family[family.length - 1]?.id === q.id;
  const enquiry = q.enquiryId ? w.enquiryById.get(q.enquiryId) : undefined;
  const order = w.orderByQuotation.get(q.id);
  const approval = q.approvalRequestId ? w.approvals.find((a) => a.id === q.approvalRequestId) : undefined;
  const approvalStep = approval?.resolvedSteps.find((s) => s.order === approval.currentStep);
  const pendingRole = approvalStep?.approverRole ?? null;
  const decisions = approval ? w.approvalDecisions.filter((d) => d.requestId === approval.id) : [];
  const rejection = decisions.find((d) => d.decision === "REJECTED");

  const gate = discountGate(totals.effectiveDiscountPct, perms.role);
  const pendingRateLines = lines.filter((l) => w.pendingRateLineIds.has(l.id));
  const editable = perms.canWrite("quotations") && status === "DRAFT" && isLatest;
  const lapsedAuto = q.status !== "EXPIRED" && status === "EXPIRED";

  const cost = lines.reduce((s, l) => s + l.qty * (w.itemById.get(l.itemId)?.standardCost ?? 0), 0);
  const marginPct = totals.taxable > 0 ? ((totals.taxable - cost) / totals.taxable) * 100 : 0;
  const exposure = perms.can("invoices") ? customerExposure(w.ds, q.customerId, w.now, customer?.creditLimit ?? 0) : null;

  function attempt(to: QuotationStatus, opts: { lossReason?: T.Quotation["lossReason"]; competitor?: string | null } = {}) {
    const res = transitionQuotation(q!.id, to, opts, perms.actor);
    if (!res.ok) {
      setBlocked({ reason: res.reason ?? "The transition was refused.", remedy: res.remedy });
      return;
    }
    setBlocked(null);
    if (res.orderId) {
      setFlash(`Won. Sales order created with every line, term and customer detail carried across — nothing was re-entered.`);
      router.push(`/sales/orders/${res.orderId}`);
      return;
    }
    if (res.approvalId) {
      setFlash(`Approval request raised. Issue stays blocked until ${gate.pendingRole ? labelRole(gate.pendingRole) : "the approver"} records a decision.`);
      return;
    }
    setFlash(`Moved to ${labelStatus(to)}.`);
  }

  const permitted = QUOTATION_TRANSITIONS[status];
  const canApproveThis =
    !!approval && (approval.status === "PENDING" || approval.status === "ESCALATED") &&
    approvalStep?.approverRole === perms.role;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${q.number} · v${q.version}`}
        lead={`${customer?.legalName ?? "Unknown customer"}${site ? ` — ${site.name}, ${site.district}` : ""}. Raised ${formatDate(q.quotationDate)}, valid until ${formatDate(validityEnd(q))}.`}
        meta={
          <>
            <StatusBadge tone={QUOTATION_TONE[status]}>{labelStatus(status)}</StatusBadge>
            {lapsedAuto ? <StatusBadge tone="warn">Auto-expired on validity</StatusBadge> : null}
            {!isLatest ? <StatusBadge tone="neutral">Superseded — read-only</StatusBadge> : null}
            {enquiry ? (
              <Link href="/sales/enquiries" className="t-body-sm text-text-mid underline underline-offset-2">
                from enquiry {enquiry.number}
              </Link>
            ) : null}
            {order ? (
              <Link href={`/sales/orders/${order.id}`} className="t-body-sm text-ok underline underline-offset-2">
                order {order.number}
              </Link>
            ) : null}
          </>
        }
        right={
          <>
            <Btn onClick={() => setFollowUp({ type: "QUOTATION", id: q.id, label: `${q.number} v${q.version}`, customerId: q.customerId })}>
              <MessageSquare className="size-3.5" aria-hidden /> Follow-up
            </Btn>
            <Btn
              onClick={() => {
                if (status === "PENDING_APPROVAL") {
                  setBlocked({
                    reason: `Export and send are blocked while the discount approval sits with ${pendingRole ? labelRole(pendingRole) : "the approver"}.`,
                    remedy: `${pendingRole ? labelRole(pendingRole) : "The approver"} must approve request ${approval?.number ?? ""} before this offer can leave the building.`,
                  });
                  return;
                }
                setPrintOpen(true);
              }}
            >
              <Printer className="size-3.5" aria-hidden /> Print preview
            </Btn>
            {perms.canWrite("quotations") ? (
              <Btn variant="primary" onClick={() => setReviseOpen(true)}>
                <GitBranch className="size-3.5" aria-hidden /> Create revision
              </Btn>
            ) : null}
          </>
        }
      />

      {flash ? (
        <Notice tone="ok" icon={Check} title={flash}>
          <button type="button" className="underline underline-offset-2" onClick={() => setFlash(null)}>Dismiss</button>
        </Notice>
      ) : null}
      {blocked ? <BlockedNotice reason={blocked.reason} remedy={blocked.remedy} action={<Btn size="sm" onClick={() => setBlocked(null)}><X className="size-3.5" aria-hidden /> Dismiss</Btn>} /> : null}

      {lapsedAuto ? (
        <Notice tone="warn" icon={TriangleAlert} title={`Validity lapsed on ${formatDate(validityEnd(q))} — the system marked this Expired`}>
          It has dropped out of open pipeline value and cannot be marked Won. Create revision v{family.length + 1} with
          fresh validity to continue with this customer. The lapse is written to the audit trail below.
        </Notice>
      ) : null}

      {status === "PENDING_APPROVAL" ? (
        <BlockedNotice
          reason={`Issue, send and export are blocked — discount approval is with ${pendingRole ? labelRole(pendingRole) : "the approver"}`}
          remedy={`Request ${approval?.number ?? ""} raised ${approval ? formatDateTime(approval.raisedAt) : ""}. Step ${approval?.currentStep ?? 1} of ${approval?.resolvedSteps.length ?? 1}.`}
          action={canApproveThis ? <Btn size="sm" variant="primary" onClick={() => setApproveOpen(true)}><ShieldCheck className="size-3.5" aria-hidden /> Review and decide</Btn> : undefined}
        />
      ) : null}

      {rejection && status === "DRAFT" ? (
        <Notice tone="danger" icon={ThumbsDown} title={`Approval rejected by ${w.userById.get(rejection.approverUserId)?.name ?? "the approver"} on ${formatDate(rejection.at)}`}>
          Reason given: {rejection.comment || "no reason recorded"}. The quotation returned to Draft — adjust the
          discount or the scope and send it again.
        </Notice>
      ) : null}

      {pendingRateLines.length > 0 ? (
        <Notice tone="warn" icon={TriangleAlert} title={`${pendingRateLines.length} line has no price-list rate`}>
          A line with no price-list entry effective on {formatDate(q.quotationDate)} is left blank, never priced at
          zero. Enter each rate manually before this quotation can be issued.
        </Notice>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <li><Stat label="Taxable value" value={abbreviateINR(totals.taxable)} sub={`${lines.length} line${lines.length === 1 ? "" : "s"}`} /></li>
        <li><Stat label="Tax" value={abbreviateINR(totals.tax)} sub={pos.heads === "CGST_SGST" ? "CGST + SGST" : pos.heads === "IGST" ? "IGST" : "Zero-rated"} /></li>
        <li><Stat label="Grand total" value={abbreviateINR(totals.grandTotal)} sub={`Rounding ${totals.roundOff >= 0 ? "+" : "−"}${formatINR(Math.abs(totals.roundOff), { paise: true })}`} /></li>
        <li>
          <Stat
            label="Effective discount"
            value={formatPercent(totals.effectiveDiscountPct, 2)}
            sub={gate.required ? "Above your authority" : "Within your authority"}
            tone={gate.required ? "warn" : "ok"}
          />
        </li>
        <li>
          <Stat
            label="Indicative margin"
            value={formatPercent(marginPct, 1)}
            sub={`Against ${abbreviateINR(Math.round(cost))} standard cost`}
            tone={marginPct < 10 ? "danger" : marginPct < 18 ? "warn" : "ok"}
          />
        </li>
      </ul>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Lines */}
          <Panel>
            <PanelHeader
              title="Line items"
              sub={editable
                ? "Description, HSN/SAC, unit and GST rate populate from the item master; the rate defaults to the price list."
                : "This version is read-only. Create a revision to change anything."}
              right={
                editable ? (
                  <div className="flex gap-2">
                    <Btn size="sm" onClick={() => setItemPickerOpen(true)}>
                      <Plus className="size-3.5" aria-hidden /> Add from item master
                    </Btn>
                    <Btn size="sm" onClick={() => addCustomQuotationLine(q.id, "Non-catalogue supply — describe here", perms.actor)}>
                      <Plus className="size-3.5" aria-hidden /> Non-catalogue line
                    </Btn>
                  </div>
                ) : null
              }
            />
            {lines.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No lines yet"
                body="Pull items from the master — description, HSN/SAC, unit and GST rate come with them, and the price-list rate fills in as the default."
                action={editable ? <Btn variant="primary" onClick={() => setItemPickerOpen(true)}><Plus className="size-3.5" aria-hidden /> Add the first line</Btn> : undefined}
              />
            ) : (
              <TableFrame>
                <thead>
                  <tr>
                    <Th>#</Th><Th>Description</Th><Th>HSN/SAC</Th><Th right>Qty</Th><Th>UOM</Th>
                    <Th right>Rate</Th><Th right>Disc %</Th><Th right>Taxable</Th><Th right>GST %</Th>
                    <Th right>Tax</Th><Th right>Line total</Th>{editable ? <Th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const a = lineAmounts(l, pos.treatment);
                    const noRate = w.pendingRateLineIds.has(l.id);
                    return (
                      <Tr key={l.id} className={noRate ? "bg-warn-bg/40" : undefined}>
                        <Td>{i + 1}</Td>
                        <Td className="min-w-64 text-text-hi">
                          {editable ? (
                            <TextInput
                              aria-label={`Description for line ${i + 1}`}
                              value={l.description}
                              onChange={(e) => updateQuotationLine(l.id, { description: e.target.value })}
                            />
                          ) : l.description}
                        </Td>
                        <Td mono>
                          {editable ? (
                            <TextInput
                              aria-label={`HSN or SAC for line ${i + 1}`}
                              className="w-24 t-mono"
                              value={l.hsnSac}
                              onChange={(e) => updateQuotationLine(l.id, { hsnSac: e.target.value })}
                            />
                          ) : l.hsnSac}
                        </Td>
                        <Td right>
                          {editable ? (
                            <NumberInput
                              aria-label={`Quantity for line ${i + 1}`}
                              className="w-20"
                              min={0}
                              value={l.qty}
                              onChange={(e) => updateQuotationLine(l.id, { qty: num(e.target.value) })}
                            />
                          ) : l.qty}
                        </Td>
                        <Td>{l.uom}</Td>
                        <Td right>
                          {editable ? (
                            <NumberInput
                              aria-label={`Rate for line ${i + 1}`}
                              className={noRate ? "w-28 border-warn" : "w-28"}
                              min={0}
                              placeholder={noRate ? "Rate required" : undefined}
                              value={noRate ? "" : l.rate}
                              onChange={(e) => updateQuotationLine(l.id, { rate: num(e.target.value) })}
                            />
                          ) : noRate ? (
                            <StatusBadge tone="warn">Rate required</StatusBadge>
                          ) : formatINR(l.rate)}
                        </Td>
                        <Td right>
                          {editable ? (
                            <NumberInput
                              aria-label={`Discount percent for line ${i + 1}`}
                              className="w-20"
                              min={0}
                              max={100}
                              step={0.5}
                              value={l.discountPct}
                              onChange={(e) => updateQuotationLine(l.id, { discountPct: num(e.target.value) })}
                            />
                          ) : `${l.discountPct.toFixed(2)}%`}
                        </Td>
                        <Td right>{noRate ? "—" : formatINR(a.taxable)}</Td>
                        <Td right>
                          {editable ? (
                            <NumberInput
                              aria-label={`GST rate for line ${i + 1}`}
                              className="w-16"
                              min={0}
                              max={28}
                              value={l.gstRate}
                              onChange={(e) => updateQuotationLine(l.id, { gstRate: num(e.target.value) })}
                            />
                          ) : `${l.gstRate}%`}
                        </Td>
                        <Td right>{noRate ? "—" : formatINR(a.tax)}</Td>
                        <Td right className="font-medium text-text-hi">{noRate ? "—" : formatINR(a.total)}</Td>
                        {editable ? (
                          <Td>
                            <Btn size="sm" variant="ghost" aria-label={`Remove line ${i + 1}`} onClick={() => removeQuotationLine(l.id, q.id, perms.actor)}>
                              <Trash2 className="size-3.5" aria-hidden />
                            </Btn>
                          </Td>
                        ) : null}
                      </Tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-2">
                    <Td colSpan={7} className="text-right font-medium text-text-hi">Totals</Td>
                    <Td right className="font-medium text-text-hi">{formatINR(totals.taxable)}</Td>
                    <Td />
                    <Td right className="font-medium text-text-hi">{formatINR(totals.tax)}</Td>
                    <Td right className="font-medium text-text-hi">{formatINR(totals.grandTotal)}</Td>
                    {editable ? <Td /> : null}
                  </tr>
                </tfoot>
              </TableFrame>
            )}
          </Panel>

          {/* Commercial terms */}
          <Panel>
            <PanelHeader title="Commercial terms" sub="Everything the customer is being promised, in the words that print on the document." />
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              <Field label="Validity (days)">
                {(p) => (
                  <NumberInput
                    {...p}
                    disabled={!editable}
                    min={1}
                    value={q.validityDays}
                    onChange={(e) => updateQuotation(q.id, { validityDays: num(e.target.value) }, perms.actor)}
                  />
                )}
              </Field>
              <Field label="Payment terms">
                {(p) => (
                  <TextInput {...p} disabled={!editable} value={q.paymentTerms} onChange={(e) => updateQuotation(q.id, { paymentTerms: e.target.value }, perms.actor)} />
                )}
              </Field>
              <Field label="Delivery terms">
                {(p) => (
                  <TextInput {...p} disabled={!editable} value={q.deliveryTerms} onChange={(e) => updateQuotation(q.id, { deliveryTerms: e.target.value }, perms.actor)} />
                )}
              </Field>
              <Field label="Warranty terms">
                {(p) => (
                  <TextInput {...p} disabled={!editable} value={q.warrantyTerms} onChange={(e) => updateQuotation(q.id, { warrantyTerms: e.target.value }, perms.actor)} />
                )}
              </Field>
              <Field label="Scope inclusions" className="sm:col-span-2">
                {(p) => (
                  <TextArea {...p} disabled={!editable} value={q.inclusions} onChange={(e) => updateQuotation(q.id, { inclusions: e.target.value }, perms.actor)} />
                )}
              </Field>
              <Field label="Scope exclusions" className="sm:col-span-2">
                {(p) => (
                  <TextArea {...p} disabled={!editable} value={q.exclusions} onChange={(e) => updateQuotation(q.id, { exclusions: e.target.value }, perms.actor)} />
                )}
              </Field>
              <Field label="Technical notes" className="sm:col-span-2">
                {(p) => (
                  <TextArea {...p} disabled={!editable} value={q.technicalNotes} onChange={(e) => updateQuotation(q.id, { technicalNotes: e.target.value }, perms.actor)} />
                )}
              </Field>
            </div>
          </Panel>

          {/* Version history */}
          <Panel>
            <PanelHeader
              title="Version history"
              sub="Every revision preserved. Opening a version shows that version's content exactly, not the current one."
              right={<Overline>{family.length} version{family.length === 1 ? "" : "s"}</Overline>}
            />
            <TableFrame>
              <thead><tr><Th>Version</Th><Th>Date</Th><Th>Author</Th><Th>What changed</Th><Th right>Value</Th><Th>State</Th><Th /></tr></thead>
              <tbody>
                {family.map((v) => {
                  const vLines = linesOf(w, v.id);
                  const vPos = derivePlaceOfSupply(w.customerById.get(v.customerId), v.siteId ? w.siteById.get(v.siteId) : undefined);
                  const vTotals = quotationTotals(vLines, vPos.treatment);
                  const vStatus = effectiveStatus(v, w.now);
                  return (
                    <Tr key={v.id} className={v.id === q.id ? "bg-surface-2" : undefined}>
                      <Td mono className="text-text-hi">v{v.version}{v.id === q.id ? " · open" : ""}</Td>
                      <Td>{formatDate(v.quotationDate)}</Td>
                      <Td>{w.userById.get(v.ownerUserId)?.name ?? "—"}</Td>
                      <Td className="max-w-96">{v.changeSummary ?? (v.version === 1 ? "Original offer" : "—")}</Td>
                      <Td right>{formatINR(vTotals.grandTotal)}</Td>
                      <Td><StatusBadge tone={QUOTATION_TONE[vStatus]}>{labelStatus(vStatus)}</StatusBadge></Td>
                      <Td>
                        {v.id === q.id ? <span className="text-text-lo">Viewing</span> : (
                          <Link href={`/sales/quotations/${v.id}`} className="text-text-mid underline underline-offset-2 hover:text-text-hi">Open v{v.version}</Link>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </TableFrame>
          </Panel>

          {/* Audit trail for this quotation */}
          <Panel>
            <PanelHeader title="Audit trail" sub="Every state change on this offer, in order." />
            <ul className="divide-y divide-line">
              {lapsedAuto ? (
                <li className="flex items-start gap-3 px-4 py-2.5">
                  <Lock className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                  <div className="min-w-0">
                    <p className="t-body-sm text-text-hi">Auto-expired — validity lapsed</p>
                    <p className="t-body-sm text-text-lo">
                      System · {formatDate(validityEnd(q))} · derived on evaluation, excluded from open pipeline value
                    </p>
                  </div>
                </li>
              ) : null}
              {w.audit.filter((a) => a.entityId === q.id || a.entityId === q.approvalRequestId).map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                  <History className="mt-0.5 size-4 shrink-0 text-text-lo" aria-hidden />
                  <div className="min-w-0">
                    <p className="t-body-sm text-text-hi">{a.summary}</p>
                    <p className="t-body-sm text-text-lo">
                      {a.actorName} ({labelRole(a.actorRole)}) · {formatDateTime(a.at)} · <span className="t-mono">{a.id}</span>
                    </p>
                  </div>
                </li>
              ))}
              <li className="flex items-start gap-3 px-4 py-2.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-text-lo" aria-hidden />
                <div>
                  <p className="t-body-sm text-text-hi">Quotation raised{q.version > 1 ? ` as revision v${q.version}` : ""}</p>
                  <p className="t-body-sm text-text-lo">
                    {w.userById.get(q.ownerUserId)?.name ?? "—"} · {formatDateTime(q.createdAt)}
                  </p>
                </div>
              </li>
            </ul>
          </Panel>
        </div>

        {/* Right rail */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* Place of supply — shown, not silently applied. E3-S4 AC-3 */}
          <Panel>
            <PanelHeader title="Place of supply derivation" sub="Shown for verification. Nothing about tax is applied silently." />
            <div className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <StatusBadge tone={pos.treatment === "EXPORT_ZERO_RATED" ? "sim" : pos.heads === "IGST" ? "info" : "ok"}>
                  {pos.treatment === "EXPORT_ZERO_RATED" ? "Zero-rated export" : pos.heads === "IGST" ? "Inter-state · IGST" : "Intra-state · CGST + SGST"}
                </StatusBadge>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <KeyValue label="Supplier state"><span className="t-mono">10</span> Bihar</KeyValue>
                <KeyValue label="Place of supply"><span className="t-mono">{pos.stateCode}</span> {pos.stateName}</KeyValue>
              </dl>
              <div>
                <Overline>Read from</Overline>
                <p className="t-body-sm mt-0.5 text-text-mid">{pos.source}</p>
              </div>
              <div>
                <Overline>Rule applied</Overline>
                <p className="t-body-sm mt-0.5 text-text-mid">{pos.rule}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 border-t border-line pt-3">
                {pos.heads === "CGST_SGST" ? (
                  <>
                    <KeyValue label="CGST"><span className="tabular-nums">{formatINR(totals.cgst, { paise: true })}</span></KeyValue>
                    <KeyValue label="SGST"><span className="tabular-nums">{formatINR(totals.sgst, { paise: true })}</span></KeyValue>
                  </>
                ) : pos.heads === "IGST" ? (
                  <KeyValue label="IGST"><span className="tabular-nums">{formatINR(totals.igst, { paise: true })}</span></KeyValue>
                ) : (
                  <KeyValue label="Integrated tax">Nil — supply under LUT, e-way bill still required to the border</KeyValue>
                )}
              </dl>
            </div>
          </Panel>

          {/* Discount authority */}
          <Panel>
            <PanelHeader title="Discount authority" sub="PD-005 thresholds, held as data and shown next to the gate." />
            <div className="flex flex-col gap-3 p-4">
              <dl className="grid grid-cols-2 gap-3">
                <KeyValue label="Effective discount">
                  <span className="tabular-nums">{formatPercent(totals.effectiveDiscountPct, 2)}</span>
                </KeyValue>
                <KeyValue label="Steepest single line">
                  <span className="tabular-nums">{formatPercent(totals.maxLineDiscountPct, 2)}</span>
                </KeyValue>
                <KeyValue label="Your authority">
                  {selfAuthorityPct(perms.role) === Number.POSITIVE_INFINITY ? "Unlimited" : `${selfAuthorityPct(perms.role)}%`}
                </KeyValue>
                <KeyValue label="Band">{gate.band.label}</KeyValue>
              </dl>
              <div className="overflow-hidden rounded-md border border-line">
                <TableFrame>
                  <thead><tr><Th>Band</Th><Th>Approval chain</Th></tr></thead>
                  <tbody>
                    {DISCOUNT_BANDS.map((b) => (
                      <Tr key={b.label} className={b.label === gate.band.label && gate.required ? "bg-warn-bg/50" : undefined}>
                        <Td className="text-text-hi">{b.label}</Td>
                        <Td>{b.chainRoles.map(labelRole).join(" → ")}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </TableFrame>
              </div>
              <p className="t-body-sm text-text-mid">{gate.explanation}</p>
            </div>
          </Panel>

          {/* Lifecycle */}
          <Panel>
            <PanelHeader title="Lifecycle" sub="Draft → Pending Approval → Issued → Negotiation → Won / Lost / Expired." />
            <div className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-1">
                {(["DRAFT", "PENDING_APPROVAL", "ISSUED", "NEGOTIATION", "WON"] as QuotationStatus[]).map((s, i) => (
                  <React.Fragment key={s}>
                    {i > 0 ? <span className="text-text-lo" aria-hidden>→</span> : null}
                    <span className={s === status ? "t-overline rounded-md border border-primary-600 bg-primary-100 px-1.5 py-0.5 text-text-hi" : "t-overline rounded-md border border-line px-1.5 py-0.5 text-text-lo"}>
                      {labelStatus(s)}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {perms.canWrite("quotations") ? (
                <div className="mt-2 flex flex-col gap-2">
                  {(["PENDING_APPROVAL", "ISSUED", "NEGOTIATION", "WON", "LOST"] as QuotationStatus[]).map((to) => {
                    const check = checkTransition(q, to, {
                      now: w.now, lines,
                      pendingRateLineIds: w.pendingRateLineIds,
                      lossReason: to === "LOST" ? "PRICE" : q.lossReason,
                      effectiveDiscountPct: totals.effectiveDiscountPct,
                      role: perms.role,
                      approvalPendingRole: pendingRole,
                    });
                    const allowed = permitted.includes(to);
                    if (!allowed && !(to === "ISSUED" && status === "DRAFT")) return null;
                    return (
                      <div key={to} className="flex items-start justify-between gap-2 rounded-md border border-line px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="t-body-sm text-text-hi">Mark {labelStatus(to)}</p>
                          {!check.ok ? <p className="t-body-sm text-text-lo">{check.reason}</p> : null}
                        </div>
                        <Btn
                          size="sm"
                          variant={to === "WON" ? "primary" : to === "LOST" ? "danger" : "default"}
                          onClick={() => (to === "LOST" ? setLostOpen(true) : attempt(to))}
                        >
                          {to === "WON" ? <Handshake className="size-3.5" aria-hidden /> : to === "LOST" ? <ThumbsDown className="size-3.5" aria-hidden /> : to === "PENDING_APPROVAL" ? <Percent className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
                          {labelStatus(to)}
                        </Btn>
                      </div>
                    );
                  })}
                  {permitted.length === 0 ? (
                    <p className="t-body-sm text-text-lo">
                      {labelStatus(status)} is a terminal state. {status === "EXPIRED" ? "Create a revision to continue." : "No further transition is permitted."}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="t-body-sm text-text-lo">Your role holds read access to quotations, so no transition control is offered.</p>
              )}
            </div>
          </Panel>

          {/* Approval record */}
          {approval ? (
            <Panel>
              <PanelHeader
                title="Discount approval"
                sub="Reference, approver and timestamp are recorded on the quotation permanently."
                right={<StatusBadge tone={approval.status === "APPROVED" ? "ok" : approval.status === "REJECTED" ? "danger" : "warn"}>{enumLabel(approval.status)}</StatusBadge>}
              />
              <div className="flex flex-col gap-3 p-4">
                <dl className="grid grid-cols-2 gap-3">
                  <KeyValue label="Reference"><span className="t-mono">{approval.number}</span></KeyValue>
                  <KeyValue label="Raised">{formatDateTime(approval.raisedAt)}</KeyValue>
                  <KeyValue label="Requested by">{w.userById.get(approval.requesterUserId)?.name ?? "—"}</KeyValue>
                  <KeyValue label="Value at stake"><span className="tabular-nums">{formatINR(approval.value)}</span></KeyValue>
                </dl>
                <ol className="flex flex-col gap-1">
                  {approval.resolvedSteps.map((s) => {
                    const d = decisions.find((x) => x.stepOrder === s.order);
                    const current = approval.currentStep === s.order && (approval.status === "PENDING" || approval.status === "ESCALATED");
                    return (
                      <li key={s.order} className="flex items-center justify-between gap-2 rounded-md border border-line px-2 py-1.5">
                        <span className="t-body-sm text-text-hi">Step {s.order} · {labelRole(s.approverRole)}</span>
                        {d ? (
                          <StatusBadge tone={d.decision === "APPROVED" ? "ok" : "danger"}>{enumLabel(d.decision)}</StatusBadge>
                        ) : current ? (
                          <StatusBadge tone="warn">Awaiting</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Queued</StatusBadge>
                        )}
                      </li>
                    );
                  })}
                </ol>
                {q.approvedByUserId && q.approvedAt ? (
                  <Notice tone="ok" icon={ShieldCheck} title="Approval recorded on the quotation">
                    {w.userById.get(q.approvedByUserId)?.name ?? q.approvedByUserId} approved on {formatDateTime(q.approvedAt)} against
                    reference <span className="t-mono">{approval.number}</span>. This prints on the document and cannot be edited away.
                  </Notice>
                ) : null}
                {canApproveThis ? (
                  <Btn variant="primary" onClick={() => setApproveOpen(true)}>
                    <ShieldCheck className="size-3.5" aria-hidden /> Review and decide
                  </Btn>
                ) : approval.status === "PENDING" || approval.status === "ESCALATED" ? (
                  <p className="t-body-sm text-text-lo">
                    Held by {pendingRole ? labelRole(pendingRole) : "the approver"}. Sign in as that persona to decide.
                  </p>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {/* Customer context */}
          <Panel>
            <PanelHeader title="Customer context" sub="What this offer is being made against." />
            <div className="flex flex-col gap-3 p-4">
              <KeyValue label="Customer">
                <Link href={`/sales/customers/${q.customerId}`} className="underline underline-offset-2">
                  {customer?.legalName ?? "—"}
                </Link>
              </KeyValue>
              <dl className="grid grid-cols-2 gap-3">
                <KeyValue label="Type">{customer ? enumLabel(customer.type) : "—"}</KeyValue>
                <KeyValue label="Credit terms">{customer?.creditTermDays ?? 0} days</KeyValue>
                <KeyValue label="Won before">
                  {formatCount(w.quotations.filter((x) => x.customerId === q.customerId && x.status === "WON").length)}
                </KeyValue>
                <KeyValue label="Lost before">
                  {formatCount(w.quotations.filter((x) => x.customerId === q.customerId && x.status === "LOST").length)}
                </KeyValue>
                {exposure ? (
                  <>
                    <KeyValue label="Outstanding">
                      <span className={exposure.exceeded ? "tabular-nums text-danger" : "tabular-nums"}>{abbreviateINR(exposure.outstanding)}</span>
                    </KeyValue>
                    <KeyValue label="Credit limit"><span className="tabular-nums">{abbreviateINR(exposure.limit)}</span></KeyValue>
                  </>
                ) : null}
              </dl>
              {exposure?.exceeded ? (
                <Notice tone="danger" icon={TriangleAlert} title="Customer is over its credit limit">
                  Exposure exceeds the sanctioned limit by {formatINR(exposure.overBy)}. Winning this offer will need a
                  credit-limit override before despatch.
                </Notice>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      {/* -------------------------------------------------------- dialogs */}

      <ItemPicker
        open={itemPickerOpen}
        onOpenChange={setItemPickerOpen}
        onPick={(itemId) => { addQuotationLineFromItem(q.id, itemId, perms.actor); setItemPickerOpen(false); }}
        world={w}
        onDate={new Date(q.quotationDate)}
      />

      <ReviseDialog
        open={reviseOpen}
        onOpenChange={setReviseOpen}
        nextVersion={family.length + 1}
        onConfirm={(summary) => {
          const rev = reviseQuotation(q.id, summary, perms.actor);
          setReviseOpen(false);
          router.push(`/sales/quotations/${rev.id}`);
        }}
      />

      <LostDialog
        open={lostOpen}
        onOpenChange={setLostOpen}
        onConfirm={(reason, competitor) => { setLostOpen(false); attempt("LOST", { lossReason: reason, competitor }); }}
      />

      {approval ? (
        <ApprovalDialog
          open={approveOpen}
          onOpenChange={setApproveOpen}
          request={approval}
          quotation={q}
          lines={lines}
          totals={totals}
          marginPct={marginPct}
          cost={cost}
          world={w}
          onDecide={(decision, comment) => {
            const res = decideQuotationApproval({ requestId: approval.id, decision, comment }, perms.actor);
            setApproveOpen(false);
            if (!res.ok) setBlocked({ reason: res.reason ?? "Decision refused.", remedy: res.remedy });
            else setFlash(decision === "APPROVED" ? "Approved. The quotation is Issued and the approval reference is now permanent on the document." : "Rejected. The quotation returned to Draft with the reason visible to the requester.");
          }}
        />
      ) : null}

      <Modal
        open={printOpen}
        onOpenChange={setPrintOpen}
        wide
        title={`Print preview — ${q.number} v${q.version}`}
        description="A4 at 100%. Use your browser print dialogue and choose Save as PDF to export."
        footer={
          <>
            <Btn onClick={() => setPrintOpen(false)}>Close</Btn>
            <Btn variant="primary" onClick={() => window.print()}>
              <Printer className="size-3.5" aria-hidden /> Print / Save as PDF
            </Btn>
          </>
        }
      >
        <style>{PRINT_CSS}</style>
        <div className="overflow-x-auto bg-surface-3 p-3">
          <QuotationPrintSheet world={w} quotation={q} lines={lines} />
        </div>
      </Modal>

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

/* --------------------------------------------------------- item picker */

function ItemPicker({
  open, onOpenChange, onPick, world, onDate,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; onPick: (itemId: string) => void;
  world: SalesWorld;
  onDate: Date;
}) {
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState("");

  const results = React.useMemo(() => {
    const n = q.trim().toLowerCase();
    return world.ds.items
      .filter((i) => i.active && (!category || i.category === category))
      .filter((i) => !n || `${i.code} ${i.description} ${i.oemPartNumber} ${i.hsnSac}`.toLowerCase().includes(n))
      .slice(0, 60);
  }, [q, category, world.ds.items]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Add from the item master"
      description="Description, HSN/SAC, unit and GST rate come from the item. The rate defaults to the price-list entry effective on the quotation date."
    >
      <div className="flex flex-wrap gap-2">
        <span className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 size-3.5 text-text-lo" aria-hidden />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} className="pl-7" placeholder="Code, description, OEM part or HSN" aria-label="Search the item master" />
        </span>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-44" aria-label="Filter by category">
          <option value="">All categories</option>
          {["MACHINE", "SPARE", "CONSUMABLE", "ACCESSORY", "PIPE_FITTING", "SERVICE"].map((c) => (
            <option key={c} value={c}>{enumLabel(c)}</option>
          ))}
        </Select>
      </div>
      <div className="mt-3 max-h-[52vh] overflow-y-auto rounded-md border border-line">
        <TableFrame>
          <thead><tr><Th>Code</Th><Th>Description</Th><Th>Category</Th><Th>HSN/SAC</Th><Th right>GST</Th><Th right>Price list</Th><Th /></tr></thead>
          <tbody>
            {results.map((i) => {
              const rate = priceListRate(world.ds, i.id, onDate);
              return (
                <Tr key={i.id}>
                  <Td mono>{i.code}</Td>
                  <Td className="max-w-96 text-text-hi">{i.description}</Td>
                  <Td>{enumLabel(i.category)}</Td>
                  <Td mono>{i.hsnSac}</Td>
                  <Td right>{i.gstRate}%</Td>
                  <Td right>{rate === null ? <StatusBadge tone="warn">No entry</StatusBadge> : formatINR(rate)}</Td>
                  <Td><Btn size="sm" onClick={() => onPick(i.id)}>Add</Btn></Td>
                </Tr>
              );
            })}
          </tbody>
        </TableFrame>
        {results.length === 0 ? (
          <p className="t-body-sm px-4 py-6 text-center text-text-lo">
            No item matches that search. Widen it, or add a non-catalogue line and enter the rate manually.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------- dialogs */

function ReviseDialog({
  open, onOpenChange, nextVersion, onConfirm,
}: { open: boolean; onOpenChange: (v: boolean) => void; nextVersion: number; onConfirm: (summary: string) => void }) {
  const [summary, setSummary] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { if (open) { setSummary(""); setErr(null); } }, [open]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Create revision v${nextVersion}`}
      description="A new version is created as Draft with every line copied. The version you are on becomes read-only."
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              if (!summary.trim()) { setErr("Say what changed — the version history is worthless without it."); return; }
              onConfirm(summary.trim());
            }}
          >
            <GitBranch className="size-3.5" aria-hidden /> Create v{nextVersion}
          </Btn>
        </>
      }
    >
      <Field label="Summary of what changed" required error={err}>
        {(p) => (
          <TextArea
            {...p}
            value={summary}
            onChange={(e) => { setSummary(e.target.value); if (err) setErr(null); }}
            placeholder="Dryer capacity increased to 250 CFM and payment terms relaxed to 45 days."
          />
        )}
      </Field>
    </Modal>
  );
}

function LostDialog({
  open, onOpenChange, onConfirm,
}: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: (reason: T.Quotation["lossReason"], competitor: string | null) => void }) {
  const [reason, setReason] = React.useState<string>("");
  const [competitor, setCompetitor] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { if (open) { setReason(""); setCompetitor(""); setErr(null); } }, [open]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record the loss"
      description="A loss without a structured reason teaches nothing. The transition is blocked until one is given."
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn
            variant="danger"
            onClick={() => {
              if (!reason) { setErr("Select a loss reason from the configured list."); return; }
              onConfirm(reason as T.Quotation["lossReason"], competitor.trim() || null);
            }}
          >
            <ThumbsDown className="size-3.5" aria-hidden /> Mark Lost
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Loss reason" required error={err} hint="The configured list drives the loss-reason distribution on sales analytics.">
          {(p) => (
            <Select {...p} value={reason} onChange={(e) => { setReason(e.target.value); if (err) setErr(null); }}>
              <option value="">Select a reason</option>
              {LOSS_REASONS.map((r) => <option key={r.value ?? ""} value={r.value ?? ""}>{r.label}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Competitor" hint="Optional. Recorded so the competitive picture builds over time.">
          {(p) => <TextInput {...p} value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="Atlas Copco" />}
        </Field>
      </div>
    </Modal>
  );
}

function ApprovalDialog({
  open, onOpenChange, request, quotation, lines, totals, marginPct, cost, world, onDecide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: T.ApprovalRequest;
  quotation: T.Quotation;
  lines: T.QuotationLine[];
  totals: ReturnType<typeof quotationTotals>;
  marginPct: number;
  cost: number;
  world: SalesWorld;
  onDecide: (decision: "APPROVED" | "REJECTED", comment: string) => void;
}) {
  const [comment, setComment] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { if (open) { setComment(""); setErr(null); } }, [open]);

  const customer = world.customerById.get(quotation.customerId);
  const history = world.quotations.filter((x) => x.customerId === quotation.customerId);
  const won = history.filter((x) => x.status === "WON");
  const lost = history.filter((x) => x.status === "LOST");
  const orders = world.salesOrders.filter((o) => o.customerId === quotation.customerId);
  const pos = derivePlaceOfSupply(customer, quotation.siteId ? world.siteById.get(quotation.siteId) : undefined);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={`Approve discount — ${quotation.number} v${quotation.version}`}
      description={`${request.number} · step ${request.currentStep} of ${request.resolvedSteps.length} · raised by ${world.userById.get(request.requesterUserId)?.name ?? "—"}`}
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn
            variant="danger"
            onClick={() => {
              if (!comment.trim()) { setErr("A rejection needs a reason — it goes back to the requester verbatim."); return; }
              onDecide("REJECTED", comment.trim());
            }}
          >
            <ThumbsDown className="size-3.5" aria-hidden /> Reject
          </Btn>
          <Btn variant="primary" onClick={() => onDecide("APPROVED", comment.trim())}>
            <ShieldCheck className="size-3.5" aria-hidden /> Approve
          </Btn>
        </>
      }
    >
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <li><Stat label="Effective discount" value={formatPercent(totals.effectiveDiscountPct, 2)} tone="warn" sub={`Steepest line ${formatPercent(totals.maxLineDiscountPct, 2)}`} /></li>
        <li><Stat label="Grand total" value={abbreviateINR(totals.grandTotal)} sub={pos.heads === "IGST" ? "IGST" : pos.heads === "CGST_SGST" ? "CGST + SGST" : "Zero-rated"} /></li>
        <li><Stat label="Indicative margin" value={formatPercent(marginPct, 1)} tone={marginPct < 10 ? "danger" : marginPct < 18 ? "warn" : "ok"} sub={`Cost ${abbreviateINR(Math.round(cost))}`} /></li>
        <li><Stat label="Discount given away" value={abbreviateINR(totals.discount)} sub="Against gross value" /></li>
      </ul>

      <div className="mt-4">
        <Overline>Line-level discounts</Overline>
        <div className="mt-1 rounded-md border border-line">
          <TableFrame>
            <thead><tr><Th>Description</Th><Th right>Qty</Th><Th right>Rate</Th><Th right>Disc %</Th><Th right>Taxable</Th><Th right>Line margin</Th></tr></thead>
            <tbody>
              {lines.map((l) => {
                const a = lineAmounts(l, pos.treatment);
                const lineCost = l.qty * (world.itemById.get(l.itemId)?.standardCost ?? 0);
                const m = a.taxable > 0 ? ((a.taxable - lineCost) / a.taxable) * 100 : 0;
                return (
                  <Tr key={l.id}>
                    <Td className="max-w-80 text-text-hi">{l.description}</Td>
                    <Td right>{l.qty}</Td>
                    <Td right>{formatINR(l.rate)}</Td>
                    <Td right className={l.discountPct > 10 ? "text-danger" : l.discountPct > 5 ? "text-warn" : undefined}>{l.discountPct.toFixed(2)}%</Td>
                    <Td right>{formatINR(a.taxable)}</Td>
                    <Td right className={m < 10 ? "text-danger" : m < 18 ? "text-warn" : "text-ok"}>{formatPercent(m, 1)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableFrame>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Overline>Customer history</Overline>
          <dl className="mt-1 grid grid-cols-2 gap-2">
            <KeyValue label="Customer">{customer?.legalName ?? "—"}</KeyValue>
            <KeyValue label="Type">{customer ? enumLabel(customer.type) : "—"}</KeyValue>
            <KeyValue label="Quotations won">{formatCount(won.length)}</KeyValue>
            <KeyValue label="Quotations lost">{formatCount(lost.length)}</KeyValue>
            <KeyValue label="Orders placed">{formatCount(orders.length)}</KeyValue>
            <KeyValue label="Credit limit"><span className="tabular-nums">{abbreviateINR(customer?.creditLimit ?? 0)}</span></KeyValue>
          </dl>
        </div>
        <div>
          <Overline>Commercial terms offered</Overline>
          <dl className="mt-1 flex flex-col gap-1">
            <KeyValue label="Payment">{quotation.paymentTerms}</KeyValue>
            <KeyValue label="Delivery">{quotation.deliveryTerms}</KeyValue>
            <KeyValue label="Warranty">{quotation.warrantyTerms}</KeyValue>
            <KeyValue label="Validity">{quotation.validityDays} days · lapses {formatDate(validityEnd(quotation))}</KeyValue>
          </dl>
        </div>
      </div>

      <div className="mt-4">
        <Field label="Decision note" error={err} hint="Required to reject; optional to approve. The requester sees it verbatim.">
          {(p) => <TextArea {...p} value={comment} onChange={(e) => { setComment(e.target.value); if (err) setErr(null); }} />}
        </Field>
      </div>
      <Explainer className="mt-2 text-text-lo">
        Approval at the final step issues the quotation and stamps the reference, approver and timestamp on it
        permanently. Rejection returns it to Draft with this note attached.
      </Explainer>
    </Modal>
  );
}
