"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Printer,
  Send,
  Signature,
  TriangleAlert,
} from "lucide-react";
import { OEM_LABEL, PRODUCT_LINE_LABEL, type OEMPrincipal, type ProductLine } from "@/lib/schemas/enums";
import { addMonths, formatDate, formatDateTime, formatQty } from "@/lib/format";
import { Overline, Panel, SimulatedBadge, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { CountdownPanel, SubmissionBadge, countdownOf } from "./badges";
import { CoverageBadge } from "./CoverageBadge";
import { CommissioningPrintSheet, type PrintSheetData } from "./CommissioningPrintSheet";
import {
  EMPTY_ASSETS,
  EMPTY_COMMISSIONING,
  coverageOf,
  localId,
  simulatedAckRef,
  submissionStateOf,
  useOverlay,
  type AssetsOverlay,
  type CommissioningOverlay,
} from "./store";
import {
  BlockedNote,
  Button,
  Checkbox,
  DateInput,
  Field,
  Section,
  Select,
  Serial,
  TextArea,
  TextInput,
  fromDateInput,
  toDateInput,
} from "./ui";
import type { AssetRow, ChecklistEntry, CommissioningDetail } from "./types";

const DAY = 86_400_000;

export interface CommissioningFormProps {
  asset: AssetRow;
  detail: CommissioningDetail;
  hasReport: boolean;
  checklistTemplate: string[];
  engineerName: string;
  todayIso: string;
  canEdit: boolean;
}

interface Draft {
  installationDate: string;
  commissioningDate: string;
  locationInSite: string;
  siteConditions: string;
  supplyVoltage: string;
  supplyPhase: string;
  earthingOhms: string;
  accessoriesFitted: string;
  checklist: ChecklistEntry[];
  initialPressureBar: string;
  initialFadCfm: string;
  loadCurrentAmp: string;
  trainingAcknowledged: boolean;
  customerSignatory: string;
  customerDesignation: string;
  signatureConfirmed: boolean;
  dealerAuthorisedBy: string;
  warrantyMonths: string;
}

const SUPPLY_PHASES = ["3 Phase, 4 Wire", "3 Phase, 3 Wire", "1 Phase, 2 Wire"];
const SITE_CONDITIONS = [
  "Covered utility room, adequate ventilation",
  "Open shed, dust exposure moderate",
  "Dedicated compressor house, good access",
  "Terrace plant room, ambient high",
  "Pump house adjoining the sump",
];

function buildDraft(
  detail: CommissioningDetail,
  hasReport: boolean,
  template: string[],
  engineerName: string,
  todayIso: string,
): Draft {
  return {
    installationDate: toDateInput(detail.installationDate ?? todayIso),
    commissioningDate: toDateInput(detail.commissioningDate ?? todayIso),
    locationInSite: detail.locationInSite,
    siteConditions: detail.siteConditions || SITE_CONDITIONS[0]!,
    supplyVoltage: detail.supplyVoltage || "415 V ± 5%",
    supplyPhase: detail.supplyPhase || SUPPLY_PHASES[0]!,
    earthingOhms: detail.earthingOhms ? String(detail.earthingOhms) : "",
    accessoriesFitted: detail.accessoriesFitted,
    checklist: hasReport && detail.checklist.length
      ? detail.checklist.map((c) => ({ ...c }))
      : template.map((item) => ({ item, pass: true, remark: "" })),
    initialPressureBar: detail.initialPressureBar === null ? "" : String(detail.initialPressureBar),
    initialFadCfm: detail.initialFadCfm === null ? "" : String(detail.initialFadCfm),
    loadCurrentAmp: detail.loadCurrentAmp === null ? "" : String(detail.loadCurrentAmp),
    trainingAcknowledged: detail.trainingAcknowledged,
    customerSignatory: detail.customerSignatory,
    customerDesignation: detail.customerDesignation,
    signatureConfirmed: hasReport && Boolean(detail.customerSignatory),
    dealerAuthorisedBy: detail.dealerAuthorisedBy || engineerName,
    warrantyMonths: String(detail.warrantyMonths),
  };
}

export function CommissioningForm(props: CommissioningFormProps) {
  const { asset, detail, hasReport, checklistTemplate, engineerName, todayIso, canEdit } = props;
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);

  const commissioningStore = useOverlay<CommissioningOverlay>(
    "pravaah.v1.commissioning",
    EMPTY_COMMISSIONING,
  );
  const assetStore = useOverlay<AssetsOverlay>("pravaah.v1.assets", EMPTY_ASSETS);

  const localReport =
    commissioningStore.state.created.find((r) => r.assetId === asset.id) ?? null;
  const effective = localReport ?? detail;
  const effectiveHasReport = hasReport || Boolean(localReport);

  const [draft, setDraft] = React.useState<Draft>(() =>
    buildDraft(detail, hasReport, checklistTemplate, engineerName, todayIso),
  );
  const [hydrated, setHydrated] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [showPrint, setShowPrint] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);

  // Rehydrate from the overlay once it has been read.
  React.useEffect(() => {
    if (!commissioningStore.ready || hydrated) return;
    if (localReport) {
      setDraft(buildDraft(localReport, true, checklistTemplate, engineerName, todayIso));
    }
    setHydrated(true);
  }, [commissioningStore.ready, hydrated, localReport, checklistTemplate, engineerName, todayIso]);

  const set = React.useCallback(
    (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch })),
    [],
  );

  function setChecklist(index: number, patch: Partial<ChecklistEntry>) {
    setDraft((d) => ({
      ...d,
      checklist: d.checklist.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  /* ------------------------------------------------------- derivations */
  const commissioningIso = fromDateInput(draft.commissioningDate);
  const windowDays = effective.windowDays;
  const deadlineIso = commissioningIso
    ? new Date(new Date(commissioningIso).getTime() + windowDays * DAY).toISOString()
    : effective.deadline;

  const submissionRecord = commissioningStore.state.submissions[effective.id];
  const submittedAt = submissionRecord?.submittedAt ?? effective.submittedAt;
  const acknowledgementRef = submissionRecord?.acknowledgementRef ?? effective.acknowledgementRef;

  const countdown = countdownOf({ deadline: deadlineIso, submittedAt, windowDays, now });
  const submission = submissionStateOf(submittedAt, deadlineIso, now);

  const months = Number(draft.warrantyMonths) || 0;
  const warrantyStart = commissioningIso;
  const warrantyEnd = warrantyStart ? addMonths(new Date(warrantyStart), months) : null;

  const failedWithoutRemark = draft.checklist.filter((c) => !c.pass && !c.remark.trim());
  const failedCount = draft.checklist.filter((c) => !c.pass).length;
  const cleanReport = failedCount === 0;

  const blockers: string[] = [];
  if (!draft.commissioningDate) blockers.push("A commissioning date is required — warranty starts from it.");
  if (failedWithoutRemark.length)
    blockers.push(
      `${failedWithoutRemark.length} failed check${failedWithoutRemark.length === 1 ? "" : "s"} carry no remark. A remark is mandatory on every failure.`,
    );
  if (!draft.trainingAcknowledged)
    blockers.push("Customer training acknowledgement has not been recorded.");
  if (!draft.customerSignatory.trim()) blockers.push("The customer signatory name is missing.");
  if (!draft.signatureConfirmed) blockers.push("The customer signature has not been captured.");
  if (!draft.dealerAuthorisedBy.trim()) blockers.push("Dealer authorisation is missing.");

  const blocked = blockers.length > 0;

  /* -------------------------------------------------------------- save */
  const projectedCoverage = React.useMemo(() => {
    const projected: AssetRow = {
      ...asset,
      commissioningDate: commissioningIso,
      warrantyMonths: months,
      warrantyEnd: warrantyEnd ? warrantyEnd.toISOString() : null,
    };
    return coverageOf(projected, now);
  }, [asset, commissioningIso, months, warrantyEnd, now]);

  function save() {
    setAttempted(true);
    if (blocked || !canEdit || !commissioningIso) return;

    const id = localReport?.id ?? (hasReport ? detail.id : localId("CMR"));
    const number = localReport?.number ?? (hasReport ? detail.number : `BC/CR/2627/L${id.slice(-4)}`);

    const record: CommissioningDetail = {
      ...effective,
      id,
      number,
      assetId: asset.id,
      commissioningDate: commissioningIso,
      windowDays,
      deadline: deadlineIso,
      submittedAt,
      acknowledgementRef,
      submission,
      engineerName,
      warrantyMonths: months,
      warrantyEnd: warrantyEnd ? warrantyEnd.toISOString() : null,
      cleanReport,
      failedItems: failedCount,
      siteConditions: draft.siteConditions,
      supplyVoltage: draft.supplyVoltage,
      supplyPhase: draft.supplyPhase,
      earthingOhms: Number(draft.earthingOhms) || 0,
      accessoriesFitted: draft.accessoriesFitted,
      checklist: draft.checklist.map((c) => ({ ...c })),
      initialPressureBar: draft.initialPressureBar ? Number(draft.initialPressureBar) : null,
      initialFadCfm: draft.initialFadCfm ? Number(draft.initialFadCfm) : null,
      loadCurrentAmp: draft.loadCurrentAmp ? Number(draft.loadCurrentAmp) : null,
      trainingAcknowledged: draft.trainingAcknowledged,
      customerSignatory: draft.customerSignatory.trim(),
      customerDesignation: draft.customerDesignation.trim(),
      dealerAuthorisedBy: draft.dealerAuthorisedBy.trim(),
      installationDate: fromDateInput(draft.installationDate),
      locationInSite: draft.locationInSite,
      local: true,
    };

    commissioningStore.update((prev) => ({
      ...prev,
      created: [...prev.created.filter((r) => r.assetId !== asset.id), record],
    }));

    // Warranty start becomes the commissioning date; coverage recomputes.
    assetStore.update((prev) => ({
      ...prev,
      patches: {
        ...prev.patches,
        [asset.id]: {
          ...prev.patches[asset.id],
          commissioningDate: commissioningIso,
          installationDate: fromDateInput(draft.installationDate),
          warrantyMonths: months,
          locationInSite: draft.locationInSite,
        },
      },
    }));

    setSavedAt(new Date().toISOString());
  }

  function submitToOem() {
    if (!effectiveHasReport && !savedAt) return;
    const id = localReport?.id ?? effective.id;
    const at = now.toISOString();
    const ref = simulatedAckRef();
    commissioningStore.update((prev) => ({
      ...prev,
      submissions: { ...prev.submissions, [id]: { submittedAt: at, acknowledgementRef: ref } },
    }));
  }

  const printData: PrintSheetData = {
    number: localReport?.number ?? effective.number,
    serial: asset.serial,
    model: asset.model,
    principal: asset.principal as OEMPrincipal,
    productLine: asset.productLine as ProductLine,
    capacityValue: asset.capacityValue,
    capacityUnit: asset.capacityUnit,
    ratedKw: asset.ratedKw,
    itemCode: effective.itemCode,
    customerName: asset.customerName,
    siteName: asset.siteName,
    siteAddress: effective.siteAddress,
    locationInSite: draft.locationInSite,
    installationDate: fromDateInput(draft.installationDate),
    commissioningDate: commissioningIso ?? effective.commissioningDate,
    deadline: deadlineIso,
    windowDays,
    submittedAt,
    acknowledgementRef,
    siteConditions: draft.siteConditions,
    supplyVoltage: draft.supplyVoltage,
    supplyPhase: draft.supplyPhase,
    earthingOhms: Number(draft.earthingOhms) || 0,
    accessoriesFitted: draft.accessoriesFitted,
    checklist: draft.checklist,
    initialPressureBar: draft.initialPressureBar ? Number(draft.initialPressureBar) : null,
    initialFadCfm: draft.initialFadCfm ? Number(draft.initialFadCfm) : null,
    loadCurrentAmp: draft.loadCurrentAmp ? Number(draft.loadCurrentAmp) : null,
    trainingAcknowledged: draft.trainingAcknowledged,
    customerSignatory: draft.customerSignatory,
    customerDesignation: draft.customerDesignation,
    dealerAuthorisedBy: draft.dealerAuthorisedBy,
    engineerName,
    warrantyMonths: months,
    warrantyStart,
    warrantyEnd: warrantyEnd ? warrantyEnd.toISOString() : null,
  };

  if (showPrint) {
    return (
      <div className="flex flex-col gap-3">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="t-heading-lg text-text-hi">A4 print preview</h1>
            <p className="t-body-sm text-text-mid">
              Suitable for OEM submission. Use your browser print dialogue to save as PDF.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowPrint(false)}>Back to report</Button>
            <Button tone="primary" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Print / save as PDF
            </Button>
          </div>
        </div>
        <CommissioningPrintSheet data={printData} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24" data-shell="field">
      {/* Header ---------------------------------------------------------- */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Overline>Commissioning report</Overline>
          <span className="t-overline rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-text-mid">
            {OEM_LABEL[asset.principal]}
          </span>
          {effectiveHasReport ? <SubmissionBadge state={submission} short /> : null}
          {!cleanReport ? (
            <StatusBadge tone="warn">Commissioned with observations</StatusBadge>
          ) : null}
        </div>
        <h1 className="t-display-md text-text-hi">
          <span className="t-mono text-[1.375rem] leading-tight">{asset.serial}</span>
        </h1>
        <p className="t-body text-text-mid">{asset.model}</p>
        <p className="t-body-sm text-text-lo">
          {asset.customerName} · {asset.siteName} ·{" "}
          {formatQty(asset.capacityValue, asset.capacityUnit)} ·{" "}
          {PRODUCT_LINE_LABEL[asset.productLine]}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/service/assets/${encodeURIComponent(asset.serial)}`}
            className="t-body-sm inline-flex min-h-11 items-center gap-1.5 rounded-md border border-line px-3 py-2 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            Asset passport
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          <Button className="min-h-11" onClick={() => setShowPrint(true)}>
            <Printer className="size-4" aria-hidden />
            A4 print preview
          </Button>
        </div>
      </header>

      {/* Countdown — prominent, per E5-S4 -------------------------------- */}
      <CountdownPanel
        state={countdown}
        deadline={deadlineIso}
        windowDays={windowDays}
        principal={asset.principal}
      />

      {/* Notification ladder --------------------------------------------- */}
      <Panel>
        <div className="flex flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Overline>Escalation ladder</Overline>
            <SimulatedBadge what="notification dispatch (INT-01 WhatsApp, INT-02 email)" />
          </div>
          <ul className="flex flex-col gap-1.5">
            {[
              {
                on: !countdown.submitted && countdown.daysRemaining <= 2 && !countdown.overdue,
                label: "Two days remaining — Service Manager and Branch Manager notified",
              },
              {
                on: countdown.overdue,
                label: "Window expired — Director – Business notified and an exception raised",
              },
              {
                on: countdown.submitted,
                label: "Submitted — clock stopped, warranty registration recorded",
              },
            ].map((s) => (
              <li key={s.label} className="t-body-sm flex items-start gap-2">
                {s.on ? (
                  <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
                ) : (
                  <span
                    aria-hidden
                    className="mt-1.5 size-2 shrink-0 rounded-full border border-line-strong"
                  />
                )}
                <span className={s.on ? "text-text-hi" : "text-text-lo"}>{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      {savedAt ? (
        <Panel className="border-ok/40">
          <div className="flex flex-col gap-2 p-3">
            <span className="t-overline flex items-center gap-1.5 text-ok">
              <Check className="size-3.5" aria-hidden />
              Report saved {formatDateTime(savedAt)}
            </span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Overline>Warranty start</Overline>
                <p className="t-body-sm text-text-hi">
                  {warrantyStart ? formatDate(warrantyStart) : "—"}
                </p>
              </div>
              <div>
                <Overline>Warranty end</Overline>
                <p className="t-body-sm text-text-hi">
                  {warrantyEnd ? formatDate(warrantyEnd) : "—"}
                </p>
              </div>
              <div>
                <Overline>Coverage now</Overline>
                <CoverageBadge state={projectedCoverage} />
              </div>
              <div>
                <Overline>Outcome</Overline>
                <p className="t-body-sm text-text-hi">
                  {cleanReport ? "Commissioned clean" : `With observations (${failedCount})`}
                </p>
              </div>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* Installation particulars ---------------------------------------- */}
      <Section title="Installation particulars" sub="Dates fix the warranty and the OEM clock.">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <Field label="Installation date">
            <DateInput
              value={draft.installationDate}
              onChange={(v) => set({ installationDate: v })}
              disabled={!canEdit}
            />
          </Field>
          <Field
            label="Commissioning date"
            required
            hint="Warranty starts here, not at the invoice date."
          >
            <DateInput
              value={draft.commissioningDate}
              onChange={(v) => set({ commissioningDate: v })}
              disabled={!canEdit}
              invalid={attempted && !draft.commissioningDate}
            />
          </Field>
          <Field label="Location within site" className="sm:col-span-2">
            <TextInput
              value={draft.locationInSite}
              onChange={(e) => set({ locationInSite: e.target.value })}
              disabled={!canEdit}
              placeholder="Compressor house, bay 2"
            />
          </Field>
          <Field label="Warranty duration (months)" hint="From the product-line configuration.">
            <TextInput
              value={draft.warrantyMonths}
              inputMode="numeric"
              onChange={(e) => set({ warrantyMonths: e.target.value })}
              disabled={!canEdit}
            />
          </Field>
          <div className="rounded-md border border-line bg-surface-0 px-3 py-2">
            <Overline>Warranty end — computed</Overline>
            <p className="t-body text-text-hi">{warrantyEnd ? formatDate(warrantyEnd) : "—"}</p>
          </div>
        </div>
      </Section>

      {/* Site conditions -------------------------------------------------- */}
      <Section title="Site conditions">
        <div className="grid grid-cols-1 gap-3 p-4">
          <Field label="Observed conditions">
            <Select
              value={draft.siteConditions}
              onChange={(e) => set({ siteConditions: e.target.value })}
              disabled={!canEdit}
            >
              {[...new Set([draft.siteConditions, ...SITE_CONDITIONS])].filter(Boolean).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Accessories fitted">
            <TextArea
              value={draft.accessoriesFitted}
              onChange={(e) => set({ accessoriesFitted: e.target.value })}
              disabled={!canEdit}
              placeholder="Air receiver, moisture separator, line filter"
            />
          </Field>
        </div>
      </Section>

      {/* Electrical supply ------------------------------------------------ */}
      <Section title="Electrical supply particulars">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <Field label="Supply voltage">
            <TextInput
              value={draft.supplyVoltage}
              onChange={(e) => set({ supplyVoltage: e.target.value })}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Phase and wiring">
            <Select
              value={draft.supplyPhase}
              onChange={(e) => set({ supplyPhase: e.target.value })}
              disabled={!canEdit}
            >
              {[...new Set([draft.supplyPhase, ...SUPPLY_PHASES])].filter(Boolean).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Earthing resistance (Ω)">
            <TextInput
              value={draft.earthingOhms}
              inputMode="decimal"
              onChange={(e) => set({ earthingOhms: e.target.value })}
              disabled={!canEdit}
              placeholder="1.8"
            />
          </Field>
        </div>
      </Section>

      {/* Checklist -------------------------------------------------------- */}
      <Section
        title="Commissioning checklist"
        sub={`${draft.checklist.length} checks · a failure makes a remark mandatory`}
        right={
          cleanReport ? (
            <StatusBadge tone="ok">Clean</StatusBadge>
          ) : (
            <StatusBadge tone="warn">{failedCount} failed</StatusBadge>
          )
        }
      >
        <ul className="flex flex-col gap-px bg-line">
          {draft.checklist.map((c, i) => {
            const needsRemark = !c.pass && !c.remark.trim();
            return (
              <li key={c.item} className="bg-surface-1 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="t-body min-w-[12rem] flex-1 text-text-hi">
                    <span className="t-mono mr-2 text-text-lo">{String(i + 1).padStart(2, "0")}</span>
                    {c.item}
                  </span>
                  <span className="flex shrink-0 gap-1" role="group" aria-label={`${c.item} result`}>
                    <button
                      type="button"
                      disabled={!canEdit}
                      aria-pressed={c.pass}
                      onClick={() => setChecklist(i, { pass: true })}
                      className={`t-body-sm inline-flex min-h-11 min-w-[4.5rem] items-center justify-center gap-1 rounded-md border px-3 ${
                        c.pass
                          ? "border-ok/50 bg-ok-bg text-ok"
                          : "border-line bg-surface-0 text-text-lo hover:text-text-hi"
                      }`}
                    >
                      <CircleCheck className="size-3.5" aria-hidden />
                      Pass
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit}
                      aria-pressed={!c.pass}
                      onClick={() => setChecklist(i, { pass: false })}
                      className={`t-body-sm inline-flex min-h-11 min-w-[4.5rem] items-center justify-center gap-1 rounded-md border px-3 ${
                        !c.pass
                          ? "border-danger/50 bg-danger-bg text-danger"
                          : "border-line bg-surface-0 text-text-lo hover:text-text-hi"
                      }`}
                    >
                      <CircleX className="size-3.5" aria-hidden />
                      Fail
                    </button>
                  </span>
                </div>
                {!c.pass ? (
                  <div className="mt-2">
                    <Field
                      label="Remark"
                      required
                      error={
                        needsRemark && attempted
                          ? "A remark is mandatory on a failed check."
                          : undefined
                      }
                    >
                      <TextArea
                        value={c.remark}
                        onChange={(e) => setChecklist(i, { remark: e.target.value })}
                        disabled={!canEdit}
                        invalid={needsRemark && attempted}
                        placeholder="Full-load current 6% above nameplate; customer advised to check supply balance."
                      />
                    </Field>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Running parameters ----------------------------------------------- */}
      <Section title="Initial running parameters">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <Field label="Working pressure (bar)">
            <TextInput
              value={draft.initialPressureBar}
              inputMode="decimal"
              onChange={(e) => set({ initialPressureBar: e.target.value })}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Free air delivery (CFM)">
            <TextInput
              value={draft.initialFadCfm}
              inputMode="decimal"
              onChange={(e) => set({ initialFadCfm: e.target.value })}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Load current (A)">
            <TextInput
              value={draft.loadCurrentAmp}
              inputMode="decimal"
              onChange={(e) => set({ loadCurrentAmp: e.target.value })}
              disabled={!canEdit}
            />
          </Field>
        </div>
      </Section>

      {/* Acknowledgement and signature ------------------------------------ */}
      <Section title="Training, signature and authorisation">
        <div className="flex flex-col gap-3 p-4">
          <Checkbox
            label="Operator training completed and acknowledged by the customer"
            description="Covers starting, stopping, routine checks and the maintenance schedule."
            checked={draft.trainingAcknowledged}
            disabled={!canEdit}
            onChange={(v) => set({ trainingAcknowledged: v })}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Customer signatory" required>
              <TextInput
                value={draft.customerSignatory}
                onChange={(e) => set({ customerSignatory: e.target.value })}
                disabled={!canEdit}
                invalid={attempted && !draft.customerSignatory.trim()}
                placeholder="Rakesh Prasad"
              />
            </Field>
            <Field label="Designation">
              <TextInput
                value={draft.customerDesignation}
                onChange={(e) => set({ customerDesignation: e.target.value })}
                disabled={!canEdit}
                placeholder="Maintenance Manager"
              />
            </Field>
          </div>

          <div className="rounded-md border border-line bg-surface-0 p-3">
            <span className="t-overline flex items-center gap-1.5 text-text-lo">
              <Signature className="size-3.5" aria-hidden />
              Customer signature
            </span>
            <p className="t-mono mt-3 border-b border-line-strong pb-1 text-text-hi">
              {draft.signatureConfirmed && draft.customerSignatory
                ? draft.customerSignatory
                : " "}
            </p>
            <p className="t-body-sm mt-1 text-text-lo">
              {draft.signatureConfirmed
                ? `Signed on this device · ${formatDateTime(now)}`
                : "Awaiting signature"}
            </p>
            <Checkbox
              label="Customer has signed on this device"
              checked={draft.signatureConfirmed}
              disabled={!canEdit || !draft.customerSignatory.trim()}
              onChange={(v) => set({ signatureConfirmed: v })}
            />
          </div>

          <Field label="Dealer authorised by" required>
            <TextInput
              value={draft.dealerAuthorisedBy}
              onChange={(e) => set({ dealerAuthorisedBy: e.target.value })}
              disabled={!canEdit}
              invalid={attempted && !draft.dealerAuthorisedBy.trim()}
            />
          </Field>
        </div>
      </Section>

      {/* OEM submission ---------------------------------------------------- */}
      <Section title="OEM submission" sub="The channel call is simulated in this prototype.">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SubmissionBadge state={submission} />
            <SimulatedBadge what="OEM channel portal (INT-11)" />
          </div>
          {submittedAt ? (
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <Overline>Submitted</Overline>
                <dd className="t-body-sm text-text-hi">{formatDateTime(submittedAt)}</dd>
              </div>
              <div>
                <Overline>Acknowledgement</Overline>
                <dd className="t-mono text-text-hi">{acknowledgementRef ?? "—"}</dd>
              </div>
            </dl>
          ) : (
            <p className="t-body-sm text-text-mid">
              Not yet submitted. Submitting produces a simulated acknowledgement reference and
              timestamp, and stops the countdown.
            </p>
          )}
          <Button
            className="min-h-11 self-start"
            onClick={submitToOem}
            disabled={Boolean(submittedAt) || (!effectiveHasReport && !savedAt) || !canEdit}
          >
            <Send className="size-4" aria-hidden />
            Submit to OEM
          </Button>
          {!effectiveHasReport && !savedAt ? (
            <BlockedNote
              rule="A report cannot be submitted to the OEM before it is saved."
              unblock="completing and saving the report below."
            />
          ) : null}
        </div>
      </Section>

      {/* Sticky action bar ------------------------------------------------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-1 px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {attempted && blocked ? (
            <BlockedNote
              rule={blockers[0]!}
              unblock={
                blockers.length > 1
                  ? `resolving all ${blockers.length} outstanding items listed on the form.`
                  : "completing that field."
              }
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="t-body-sm text-text-lo">
              {cleanReport ? (
                <span className="inline-flex items-center gap-1.5 text-ok">
                  <ClipboardCheck className="size-3.5" aria-hidden />
                  Clean commissioning
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-warn">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  Commissioned with observations — {failedCount} failed check
                  {failedCount === 1 ? "" : "s"}
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <Button className="min-h-11" onClick={() => setShowPrint(true)}>
                <Printer className="size-4" aria-hidden />
                Print
              </Button>
              <Button tone="primary" className="min-h-11" onClick={save} disabled={!canEdit}>
                Save report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {!canEdit ? (
        <Explainer className="text-text-lo">
          Your role holds read access to commissioning records. Writing a report sits with the field
          engineer and the Service Manager.
        </Explainer>
      ) : null}

      {/* Identity footer -------------------------------------------------- */}
      <p className="t-body-sm text-text-lo">
        Report <Serial value={localReport?.number ?? effective.number} /> · engineer {engineerName} ·
        simulated clock {formatDateTime(now)}
      </p>
    </div>
  );
}
