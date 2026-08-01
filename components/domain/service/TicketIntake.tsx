"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck, Ban, CircleCheck, Search, ShieldAlert, Wrench, X,
} from "lucide-react";
import type * as T from "@/lib/schemas/entities";
import type { CoverageState, TicketCategory, TicketSeverity } from "@/lib/schemas/enums";
import { PRODUCT_LINE_LABEL } from "@/lib/schemas/enums";
import { OBSERVATION_PRESETS, machineFamily } from "@/lib/seed/catalog";
import { formatCount, formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { Panel, PanelHeader, Overline, StatusBadge } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import type { AssetIntakeRow, ContactRow } from "./project";
import { addTicket, logEvent, notify } from "./store";
import { coverageFrom, dueTimestamps, resolveSla, BUSINESS_HOURS_LABEL, ELAPSED_HOURS_LABEL } from "./sla";
import { Btn, Callout, Chip, Field, Select, Serial, TextArea, TextInput } from "./ui";
import {
  COVERAGE_LABEL, COVERAGE_TONE, SEVERITY_LABEL, SEVERITY_TONE, SEVERITY_SHORT,
  TICKET_CATEGORY_LABEL, type TicketView,
} from "./types";

const CHANNELS = ["PHONE", "WHATSAPP", "WEBSITE", "WALK_IN", "REFERRAL", "EXHIBITION", "OEM_LEAD"] as const;

const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = {
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website",
  WALK_IN: "Walk-in",
  REFERRAL: "Referral",
  EXHIBITION: "Exhibition",
  OEM_LEAD: "OEM lead",
};

export function TicketIntake({
  assets, contacts, slaDefinitions, nowMs, holidays, nextSeq, actorName,
}: {
  assets: AssetIntakeRow[];
  contacts: ContactRow[];
  slaDefinitions: T.SLADefinition[];
  nowMs: number;
  holidays: string[];
  nextSeq: number;
  actorName: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [assetId, setAssetId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<TicketSeverity>("HIGH");
  const [category, setCategory] = useState<TicketCategory>("BREAKDOWN");
  const [problem, setProblem] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("PHONE");
  const [businessHours, setBusinessHours] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const holidaySet = useMemo(() => new Set(holidays), [holidays]);
  const asset = useMemo(() => assets.find((a) => a.id === assetId) ?? null, [assets, assetId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return assets
      .filter((a) =>
        [a.serial, a.model, a.customerName, a.siteName, a.productLineLabel]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 12);
  }, [assets, query]);

  const assetContacts = useMemo(
    () => (asset ? contacts.filter((c) => c.customerId === asset.customerId) : []),
    [contacts, asset],
  );

  const coverage = useMemo(
    () => (asset ? coverageFrom(asset.facts, asset.coverageState as CoverageState) : null),
    [asset],
  );

  const sla = useMemo(() => {
    if (!asset) return null;
    const oemDefinition =
      slaDefinitions.find((d) => d.productLine === asset.productLine && d.severity === severity) ?? null;
    const severityDefinition =
      slaDefinitions.find((d) => d.productLine === null && d.severity === severity) ?? null;
    return resolveSla({
      severity,
      productLine: asset.productLineLabel,
      amc: asset.facts.amc
        ? {
          id: asset.facts.amc.id,
          number: asset.facts.amc.number,
          responseHours: asset.facts.amc.responseHours,
          restorationHours: asset.facts.amc.restorationHours,
          coverage: asset.facts.amc.coverage,
        }
        : null,
      oemDefinition,
      severityDefinition,
    });
  }, [asset, severity, slaDefinitions]);

  const due = useMemo(
    () =>
      sla
        ? dueTimestamps(nowMs, sla.responseHours, sla.restorationHours, businessHours, holidaySet)
        : null,
    [sla, nowMs, businessHours, holidaySet],
  );

  const presets = asset ? (OBSERVATION_PRESETS[machineFamily(asset.productLine as never)] ?? []) : [];

  const problemError = touched && problem.trim().length < 8
    ? "Describe the reported problem in at least a few words — it is the engineer's first briefing."
    : null;
  const assetError = touched && !asset ? "Select the installed asset the request is about." : null;
  const ready = Boolean(asset && problem.trim().length >= 8 && sla && due && coverage);

  function submit() {
    setTouched(true);
    if (!ready || !asset || !sla || !due || !coverage) return;
    setSubmitting(true);

    const id = `TKT-S${nextSeq}`;
    const number = `BC/TKT/2627/${String(nextSeq).padStart(4, "0")}`;
    const contact = assetContacts.find((c) => c.id === contactId) ?? null;

    const ticket: TicketView = {
      id,
      number,
      status: "LOGGED",
      severity,
      category,
      problem: problem.trim(),
      channel,
      customerId: asset.customerId,
      customerName: asset.customerName,
      customerType: asset.customerType,
      site: {
        id: asset.siteId,
        name: asset.siteName,
        address: asset.siteAddress,
        district: asset.siteDistrict,
        state: "Bihar",
        pincode: asset.sitePincode,
        lat: asset.siteLat,
        lng: asset.siteLng,
        contactPerson: asset.siteContactPerson,
        contactPhone: asset.siteContactPhone,
        notes: "",
      },
      asset: {
        id: asset.id,
        serial: asset.serial,
        principal: asset.principal as TicketView["asset"]["principal"],
        productLine: asset.productLine as TicketView["asset"]["productLine"],
        model: asset.model,
        capacityValue: asset.capacityValue,
        capacityUnit: asset.capacityUnit,
        ratedKw: asset.ratedKw,
        locationInSite: asset.locationInSite,
        runningHours: asset.runningHours,
        runningHoursAtMs: asset.runningHoursAtMs,
        commissioningDateMs: asset.facts.commissioningDateMs,
        warrantyMonths: asset.facts.warrantyMonths,
        status: asset.status,
      },
      contactName: contact?.name ?? asset.siteContactPerson,
      contactDesignation: contact?.designation ?? "Site contact",
      contactPhone: contact?.mobile ?? asset.siteContactPhone,
      branchId: asset.branchId,
      branchName: asset.branchName,
      branchPhone: asset.branchPhone,
      branchLat: asset.branchLat,
      branchLng: asset.branchLng,
      engineerId: null,
      engineerName: null,
      assignmentOverrideReason: null,
      coverage: coverage.coverage,
      coverageBasis: coverage.basis,
      amcContractId: coverage.amcContractId,
      amcNumber: coverage.amcNumber,
      amcCoverage: coverage.amcCoverage,
      loggedAtMs: nowMs,
      responseDueMs: due.responseDueMs,
      restorationDueMs: due.restorationDueMs,
      firstResponseAtMs: null,
      restoredAtMs: null,
      closedAtMs: null,
      breachedAtMs: null,
      breachReasonCode: null,
      pausedMs: 0,
      pauseStartedAtMs: null,
      slaRuleApplied: sla.ruleApplied,
      slaBusinessHours: businessHours,
      slaResponseHours: sla.responseHours,
      slaRestorationHours: sla.restorationHours,
      pauseOnAwaitingParts: sla.pauseOnAwaitingParts,
      pauseOnAwaitingCustomer: sla.pauseOnAwaitingCustomer,
      sessionLadder: sla.ladder,
      sessionCoverage: coverage,
    };

    addTicket(ticket);
    logEvent({
      ticketId: id,
      jobCardId: null,
      atMs: nowMs,
      kind: "CREATED",
      title: `Ticket logged via ${CHANNEL_LABEL[channel]}`,
      detail: `${problem.trim()} Coverage derived as ${COVERAGE_LABEL[coverage.coverage]} — ${coverage.basis}. SLA rule applied: ${sla.ruleApplied} (${sla.responseHours} h response / ${sla.restorationHours} h restoration, ${businessHours ? "business hours" : "elapsed hours"}).`,
      actor: actorName,
    });
    logEvent({
      ticketId: id,
      jobCardId: null,
      atMs: nowMs + 1000,
      kind: "COMMUNICATION",
      title: "Notification dispatched",
      detail: `Service Manager and ${asset.branchName} notified per the notification matrix.`,
      actor: "Pravaah",
    });
    notify([
      {
        role: "SERVICE_MANAGER",
        channel: "IN_APP",
        type: "TICKET_LOGGED",
        title: `${number} logged — ${SEVERITY_SHORT[severity]}`,
        body: `${asset.customerName} · ${asset.serial} · ${COVERAGE_LABEL[coverage.coverage]}. Restoration due ${formatDateTime(due.restorationDueMs)}.`,
        href: `/service/tickets/${id}`,
        atMs: nowMs,
        entityId: id,
      },
      {
        role: "BRANCH_MANAGER",
        channel: "IN_APP",
        type: "TICKET_LOGGED",
        title: `${number} logged at ${asset.branchName}`,
        body: `${asset.customerName} · ${asset.siteName}.`,
        href: `/service/tickets/${id}`,
        atMs: nowMs,
        entityId: id,
      },
    ]);

    router.push(`/service/tickets/${id}`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-4">
        {/* 1 — the machine */}
        <Panel>
          <PanelHeader
            title="1 · Installed asset"
            sub="Search by serial, model or customer. Selecting a machine populates the site, the machine particulars and the coverage state."
          />
          <div className="p-4">
            {!asset ? (
              <>
                <Field label="Find the machine" htmlFor="asset-search" error={assetError}>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-text-lo"
                      aria-hidden
                    />
                    <TextInput
                      id="asset-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="ELG24-40D7, Screw Compressor, Ganga Agro Mills…"
                      className="pl-8"
                      autoComplete="off"
                    />
                  </div>
                </Field>

                {query.trim().length >= 2 ? (
                  matches.length ? (
                    <ul className="mt-3 flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line">
                      {matches.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setAssetId(a.id);
                              const primary = contacts.find((c) => c.customerId === a.customerId && c.isPrimary);
                              setContactId(primary?.id ?? "");
                            }}
                            className="flex w-full items-center justify-between gap-3 bg-surface-1 px-3 py-2 text-left hover:bg-surface-2"
                          >
                            <span className="min-w-0">
                              <Serial>{a.serial}</Serial>
                              <span className="t-body-sm block text-text-mid">
                                {a.model} · {a.capacityValue} {a.capacityUnit}
                              </span>
                              <span className="t-body-sm block text-text-lo">
                                {a.customerName} · {a.siteName}, {a.siteDistrict}
                              </span>
                            </span>
                            <StatusBadge
                              tone={
                                a.coverageState === "IN_WARRANTY" ? "ok"
                                  : a.coverageState === "UNDER_AMC" ? "info" : "warn"
                              }
                            >
                              {a.coverageState === "OUT_OF_COVERAGE" ? "Chargeable" : COVERAGE_LABEL[a.coverageState as "IN_WARRANTY" | "UNDER_AMC"]}
                            </StatusBadge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Callout tone="neutral" title="No machine matches that text" className="mt-3" icon={Search}>
                      {formatCount(assets.length)} installed assets are searchable by serial, model,
                      customer or site. Check the serial on the nameplate, or search the customer name
                      instead.
                    </Callout>
                  )
                ) : (
                  <p className="t-body-sm mt-2 text-text-lo">
                    Type at least two characters. {formatCount(assets.length)} machines are on the
                    register.
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-line-strong bg-surface-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Serial className="text-base">{asset.serial}</Serial>
                    <p className="t-body mt-0.5 text-text-hi">{asset.model}</p>
                    <p className="t-body-sm text-text-mid">
                      {PRODUCT_LINE_LABEL[asset.productLine as keyof typeof PRODUCT_LINE_LABEL]} ·{" "}
                      {asset.capacityValue} {asset.capacityUnit}
                      {asset.ratedKw ? ` · ${asset.ratedKw} kW` : ""} · {asset.principal.replace("_", "-")}
                    </p>
                  </div>
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAssetId(null);
                      setQuery("");
                    }}
                  >
                    <X className="size-3.5" aria-hidden />
                    Change
                  </Btn>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 sm:grid-cols-3">
                  {[
                    ["Customer", asset.customerName],
                    ["Site", `${asset.siteName}, ${asset.siteDistrict}`],
                    ["Location in site", asset.locationInSite || "—"],
                    ["Running hours", `${formatCount(asset.runningHours)} h`],
                    ["Reading date", formatDate(asset.runningHoursAtMs)],
                    ["Machine status", asset.status.toLowerCase()],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <Overline>{k}</Overline>
                      <p className="t-body-sm text-text-hi">{v}</p>
                    </div>
                  ))}
                </dl>
                <p className="t-body-sm mt-3 border-t border-line pt-2 text-text-lo">
                  Site address — {asset.siteAddress}, {asset.siteDistrict} {asset.sitePincode}. Site
                  contact {asset.siteContactPerson}
                  {asset.siteContactPhone ? ` · ${formatPhone(asset.siteContactPhone)}` : ""}.
                </p>
              </div>
            )}
          </div>
        </Panel>

        {/* 2 — the request */}
        <Panel>
          <PanelHeader title="2 · The request" sub="What was reported, by whom, and through which channel." />
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            <Field label="Category" htmlFor="category" required>
              <Select id="category" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
                {(Object.keys(TICKET_CATEGORY_LABEL) as TicketCategory[]).map((c) => (
                  <option key={c} value={c}>{TICKET_CATEGORY_LABEL[c]}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Severity"
              htmlFor="severity"
              required
              hint="Severity drives the default commitment where no contract or OEM rule applies."
            >
              <Select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value as TicketSeverity)}>
                {(["CRITICAL", "HIGH", "NORMAL", "LOW"] as TicketSeverity[]).map((s) => (
                  <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Reported problem"
              htmlFor="problem"
              required
              error={problemError}
              className="md:col-span-2"
            >
              <TextArea
                id="problem"
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="What the caller described, in their words."
              />
            </Field>

            {presets.length ? (
              <div className="md:col-span-2">
                <Overline>Common reports for this product line</Overline>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <Chip key={p} selected={problem === p} onClick={() => setProblem(p)}>
                      {p}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            <Field label="Reporting contact" htmlFor="contact">
              <Select
                id="contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                disabled={!asset}
              >
                <option value="">
                  {asset ? `Site contact — ${asset.siteContactPerson}` : "Select a machine first"}
                </option>
                {assetContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.designation}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Channel" htmlFor="channel" required>
              <Select id="channel" value={channel} onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>
      </div>

      {/* Derivation column */}
      <div className="flex flex-col gap-4">
        <Panel>
          <PanelHeader
            title="Coverage — derived"
            sub="Read from the live warranty and AMC state. It is not a field anyone types."
            right={
              coverage ? (
                <StatusBadge tone={COVERAGE_TONE[coverage.coverage]}>
                  {COVERAGE_LABEL[coverage.coverage]}
                </StatusBadge>
              ) : undefined
            }
          />
          <div className="p-4">
            {!coverage ? (
              <p className="t-body-sm text-text-lo">
                Select a machine and the derivation runs against its warranty and contract state.
              </p>
            ) : (
              <>
                <ol className="flex flex-col gap-2">
                  {coverage.steps.map((s, i) => (
                    <li key={s.test} className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-md border",
                          s.passed ? "border-ok/50 bg-ok-bg text-ok" : "border-line bg-surface-2 text-text-lo",
                        )}
                        aria-hidden
                      >
                        {s.passed ? <CircleCheck className="size-3" /> : <Ban className="size-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="t-body-sm block text-text-hi">
                          {i + 1}. {s.test}
                        </span>
                        <span className="t-body-sm block text-text-lo">{s.outcome}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="t-body-sm mt-3 border-t border-line pt-2 text-text-mid">
                  <span className="text-text-lo">Basis stored on the ticket — </span>
                  {coverage.basis}
                </p>
                {coverage.requiresApproval ? (
                  <Callout tone="warn" title="Chargeable — approval may be needed" icon={ShieldAlert} className="mt-3">
                    No live warranty or AMC covers this serial. A quotation or a written customer
                    approval may be required before work starts, and parts consumed will flow to the
                    chargeable billing summary with GST.
                  </Callout>
                ) : coverage.amcCoverage === "NON_COMPREHENSIVE" ? (
                  <Callout tone="info" title="Non-comprehensive AMC" icon={BadgeCheck} className="mt-3">
                    Labour and visits are covered by {coverage.amcNumber}. Spares remain chargeable
                    and will appear on the billing summary.
                  </Callout>
                ) : (
                  <Callout tone="ok" title="Covered work" icon={BadgeCheck} className="mt-3">
                    Parts and labour are recorded at cost and marked non-billable.
                  </Callout>
                )}
              </>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="SLA — resolved by precedence"
            sub="AMC contract terms, then the OEM commitment for the product line, then the severity default."
          />
          <div className="p-4">
            {!sla || !due ? (
              <p className="t-body-sm text-text-lo">Select a machine to resolve the commitment.</p>
            ) : (
              <>
                <ol className="flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
                  {sla.ladder.map((rung, i) => (
                    <li
                      key={rung.source}
                      className={cn(
                        "bg-surface-1 p-2.5",
                        rung.applies && "border-l-2 border-l-primary-500 bg-primary-100/40",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="t-body-sm font-medium text-text-hi">
                          {i + 1}. {rung.label}
                        </span>
                        {rung.applies ? (
                          <StatusBadge tone="info">Applied</StatusBadge>
                        ) : (
                          <span className="t-overline text-text-lo">Not applied</span>
                        )}
                      </div>
                      <p className="t-body-sm mt-0.5 text-text-lo">{rung.reason}</p>
                      {rung.responseHours !== null ? (
                        <p className="t-mono mt-1 text-text-mid">
                          {rung.responseHours} h response · {rung.restorationHours} h restoration
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>

                <div className="mt-3 rounded-md border border-line bg-surface-2 p-3">
                  <Overline>Rule named on the ticket</Overline>
                  <p className="t-body mt-0.5 text-text-hi">{sla.ruleApplied}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <Overline>Response due</Overline>
                      <p className="t-mono text-text-hi">{formatDateTime(due.responseDueMs)}</p>
                    </div>
                    <div>
                      <Overline>Restoration due</Overline>
                      <p className="t-mono text-text-hi">{formatDateTime(due.restorationDueMs)}</p>
                    </div>
                  </dl>
                </div>

                <fieldset className="mt-3">
                  <legend className="t-overline text-text-lo">Calculation basis</legend>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="basis"
                        checked={!businessHours}
                        onChange={() => setBusinessHours(false)}
                        className="mt-1 accent-[var(--primary-600)]"
                      />
                      <span className="t-body-sm text-text-hi">
                        Elapsed hours
                        <span className="block text-text-lo">{ELAPSED_HOURS_LABEL}</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="basis"
                        checked={businessHours}
                        onChange={() => setBusinessHours(true)}
                        className="mt-1 accent-[var(--primary-600)]"
                      />
                      <span className="t-body-sm text-text-hi">
                        Business hours only
                        <span className="block text-text-lo">{BUSINESS_HOURS_LABEL}</span>
                      </span>
                    </label>
                  </div>
                  <p className="t-body-sm mt-1.5 text-text-lo">
                    Masters currently configures every SLA definition as elapsed hours. Switch the
                    basis here where the customer&apos;s site runs a day shift only — the clock then
                    excludes closed hours and says so.
                  </p>
                </fieldset>
              </>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="On save" sub="Notification matrix rows this ticket will fire." />
          <ul className="flex flex-col divide-y divide-line">
            <li className="px-4 py-2">
              <p className="t-body-sm text-text-hi">Service Manager — in-app</p>
              <p className="t-body-sm text-text-lo">New ticket with severity, coverage and clock.</p>
            </li>
            <li className="px-4 py-2">
              <p className="t-body-sm text-text-hi">
                Branch Manager — {asset?.branchName ?? "owning branch"} — in-app
              </p>
              <p className="t-body-sm text-text-lo">Branch is accountable for the commitment.</p>
            </li>
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
            <p className="t-body-sm text-text-lo">
              Logged at <span className="t-mono">{formatDateTime(nowMs)}</span>
            </p>
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => router.push("/service/tickets")}>
                Cancel
              </Btn>
              <Btn variant="primary" onClick={submit} disabled={submitting}>
                <Wrench className="size-4" aria-hidden />
                Log ticket
              </Btn>
            </div>
          </div>
          {touched && !ready ? (
            <p className="t-body-sm border-t border-line px-4 py-2 text-warn">
              {assetError ?? problemError}
            </p>
          ) : null}
        </Panel>

        {asset ? (
          <p className="t-body-sm text-text-lo">
            Severity{" "}
            <StatusBadge tone={SEVERITY_TONE[severity]} className="align-middle">
              {SEVERITY_SHORT[severity]}
            </StatusBadge>{" "}
            · the resolved rule and the coverage basis are both written onto the ticket, so the
            record defends its own clock later.
          </p>
        ) : null}
      </div>
    </div>
  );
}
