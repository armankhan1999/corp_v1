"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CircleSlash, Package, Pencil, Plus, TriangleAlert } from "lucide-react";
import {
  OEM_LABEL,
  PRODUCT_LINE_LABEL,
  type CoverageState,
  type OEMPrincipal,
  type ProductLine,
  type AssetStatus,
} from "@/lib/schemas/enums";
import { formatCount, formatDate, formatPercent, formatQty } from "@/lib/format";
import { EmptyState, Panel, Overline } from "@/components/patterns/primitives";
import { AssetStatusBadge, CountdownPill, countdownOf } from "./badges";
import { AmcAlsoInForce, CoverageBadge } from "./CoverageBadge";
import {
  AssetForm,
  type AssetDraft,
  type AssetFormOptions,
  draftFromRow,
  emptyDraft,
  validateDraft,
} from "./AssetForm";
import {
  DECOMMISSION_REASONS,
  EMPTY_ASSETS,
  amcAdditionallyInForce,
  applyAssetOverlay,
  coverageOf,
  localId,
  useOverlay,
  warrantyEndOf,
  type AssetsOverlay,
} from "./store";
import { attachFormulaWithNumbers, attachRateOf } from "./metrics";
import {
  BlockedNote,
  Button,
  Field,
  FilteredEmpty,
  FormulaDisclosure,
  Metric,
  Modal,
  PageHeader,
  Row,
  SearchField,
  SelectField,
  Serial,
  Select,
  TableFrame,
  Td,
  TextArea,
  Th,
  Toolbar,
  fromDateInput,
} from "./ui";
import type { AssetRow } from "./types";

const ALL = "ALL";
const PAGE = 60;

export function AssetRegister({
  rows: seedRows,
  options,
  todayIso,
  canCreate,
  canEdit,
}: {
  rows: AssetRow[];
  options: AssetFormOptions;
  todayIso: string;
  canCreate: boolean;
  canEdit: boolean;
}) {
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const { state: overlay, ready, update } = useOverlay<AssetsOverlay>("pravaah.v1.assets", EMPTY_ASSETS);

  const rows = React.useMemo(
    () => applyAssetOverlay(seedRows, overlay, now),
    [seedRows, overlay, now],
  );

  const serialIndex = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.serial.toUpperCase(), r.id);
    return m;
  }, [rows]);

  const rowById = React.useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  /* ------------------------------------------------------------ filters */
  const [query, setQuery] = React.useState("");
  const [principal, setPrincipal] = React.useState<string>(ALL);
  const [productLine, setProductLine] = React.useState<string>(ALL);
  const [coverage, setCoverage] = React.useState<string>(ALL);
  const [status, setStatus] = React.useState<string>(ALL);
  const [branch, setBranch] = React.useState<string>(ALL);
  const [limit, setLimit] = React.useState(PAGE);

  const activeFilters: string[] = [];
  if (query.trim()) activeFilters.push(`Search "${query.trim()}"`);
  if (principal !== ALL) activeFilters.push(`Principal ${OEM_LABEL[principal as OEMPrincipal]}`);
  if (productLine !== ALL)
    activeFilters.push(`Product line ${PRODUCT_LINE_LABEL[productLine as ProductLine]}`);
  if (coverage !== ALL) activeFilters.push(`Coverage ${coverage.replace(/_/g, " ").toLowerCase()}`);
  if (status !== ALL) activeFilters.push(`Status ${status.replace(/_/g, " ").toLowerCase()}`);
  if (branch !== ALL)
    activeFilters.push(`Branch ${options.branches.find((b) => b.id === branch)?.code ?? branch}`);

  function clearFilters() {
    setQuery("");
    setPrincipal(ALL);
    setProductLine(ALL);
    setCoverage(ALL);
    setStatus(ALL);
    setBranch(ALL);
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (principal !== ALL && r.principal !== principal) return false;
      if (productLine !== ALL && r.productLine !== productLine) return false;
      if (coverage !== ALL && r.coverage !== coverage) return false;
      if (status !== ALL && r.status !== status) return false;
      if (branch !== ALL && r.branchId !== branch) return false;
      if (!q) return true;
      return (
        r.serial.toLowerCase().includes(q) ||
        r.model.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.siteName.toLowerCase().includes(q)
      );
    });
  }, [rows, query, principal, productLine, coverage, status, branch]);

  const visible = filtered.slice(0, limit);
  const attach = attachRateOf(rows);

  /* ------------------------------------------------------- create / edit */
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<AssetDraft>(() => emptyDraft(todayIso, options.productLines));
  const [submitted, setSubmitted] = React.useState(false);

  const errors = validateDraft(draft, serialIndex, editingId);
  const duplicateHref = errors.duplicateSerialOf
    ? `/service/assets/${encodeURIComponent(rowById.get(errors.duplicateSerialOf.id)?.serial ?? errors.duplicateSerialOf.serial)}`
    : null;
  const hasErrors = Object.keys(errors).filter((k) => k !== "duplicateSerialOf").length > 0;

  function openCreate() {
    setDraft(emptyDraft(todayIso, options.productLines));
    setEditingId(null);
    setSubmitted(false);
    setFormOpen(true);
  }

  function openEdit(row: AssetRow) {
    setDraft(draftFromRow(row));
    setEditingId(row.id);
    setSubmitted(false);
    setFormOpen(true);
  }

  function commit() {
    setSubmitted(true);
    if (hasErrors) return;
    const customer = options.customers.find((c) => c.id === draft.customerId);
    const site = customer?.sites.find((s) => s.id === draft.siteId);
    const item = options.items.find((i) => i.id === draft.itemId);
    const invoice = options.invoices.find((i) => i.id === draft.saleInvoiceId);
    const branchId = customer?.branchId ?? options.branches[0]?.id ?? "BR-01";
    const branchRow = options.branches.find((b) => b.id === branchId);
    const commissioningDate = fromDateInput(draft.commissioningDate);
    const patch: Partial<AssetRow> = {
      serial: draft.serial.trim().toUpperCase(),
      principal: draft.principal,
      productLine: draft.productLine,
      model: draft.model.trim(),
      capacityValue: Number(draft.capacityValue) || 0,
      capacityUnit: draft.capacityUnit,
      ratedKw: draft.ratedKw.trim() ? Number(draft.ratedKw) : null,
      customerId: draft.customerId,
      customerName: customer?.name ?? draft.customerId,
      siteId: draft.siteId,
      siteName: site?.name ?? draft.siteId,
      siteDistrict: site?.district ?? "",
      locationInSite: draft.locationInSite.trim(),
      itemId: draft.itemId,
      itemCode: item?.code ?? "",
      itemDescription: item?.description ?? draft.model.trim(),
      saleInvoiceId: draft.saleInvoiceId || null,
      saleInvoiceNumber: invoice?.number ?? null,
      installationDate: fromDateInput(draft.installationDate),
      commissioningDate,
      warrantyMonths: Number(draft.warrantyMonths) || 12,
      runningHours: Number(draft.runningHours) || 0,
      runningHoursAt: fromDateInput(draft.runningHoursAt) ?? todayIso,
      status: draft.status,
      branchId,
      branchCode: branchRow?.code ?? branchId,
      branchName: branchRow?.name ?? branchId,
    };

    if (editingId) {
      update((prev) => ({
        ...prev,
        patches: { ...prev.patches, [editingId]: { ...prev.patches[editingId], ...patch } },
      }));
    } else {
      const id = localId("AST");
      const base: AssetRow = {
        id,
        serial: patch.serial ?? "",
        principal: draft.principal,
        productLine: draft.productLine,
        model: patch.model ?? "",
        capacityValue: patch.capacityValue ?? 0,
        capacityUnit: draft.capacityUnit,
        ratedKw: patch.ratedKw ?? null,
        customerId: draft.customerId,
        customerName: patch.customerName ?? "",
        siteId: draft.siteId,
        siteName: patch.siteName ?? "",
        siteDistrict: patch.siteDistrict ?? "",
        locationInSite: patch.locationInSite ?? "",
        itemId: draft.itemId,
        itemCode: patch.itemCode ?? "",
        itemDescription: patch.itemDescription ?? "",
        saleInvoiceId: patch.saleInvoiceId ?? null,
        saleInvoiceNumber: patch.saleInvoiceNumber ?? null,
        installationDate: patch.installationDate ?? null,
        commissioningDate: commissioningDate,
        warrantyMonths: patch.warrantyMonths ?? 12,
        warrantyEnd: null,
        runningHours: patch.runningHours ?? 0,
        runningHoursAt: patch.runningHoursAt ?? todayIso,
        status: draft.status,
        branchId,
        branchCode: patch.branchCode ?? branchId,
        branchName: patch.branchName ?? branchId,
        decommissionReason: null,
        coverage: "OUT_OF_COVERAGE",
        amcId: null,
        amcNumber: null,
        amcStart: null,
        amcEnd: null,
        openTickets: 0,
        totalTickets: 0,
        lastServiceAt: null,
        commissioningReportId: null,
        commissioningNumber: null,
        commissioningDeadline: null,
        commissioningSubmission: null,
        local: true,
      };
      const end = warrantyEndOf(base);
      base.warrantyEnd = end ? end.toISOString() : null;
      base.coverage = coverageOf(base, now);
      update((prev) => ({ ...prev, created: [...prev.created, base] }));
    }
    setFormOpen(false);
  }

  /* ------------------------------------------------------ decommission */
  const [decomTarget, setDecomTarget] = React.useState<AssetRow | null>(null);
  const [decomReason, setDecomReason] = React.useState(DECOMMISSION_REASONS[0] as string);
  const [decomNote, setDecomNote] = React.useState("");
  const decomBlocked = !decomReason.trim();

  function commitDecommission() {
    if (!decomTarget || decomBlocked) return;
    const reason = decomNote.trim() ? `${decomReason} — ${decomNote.trim()}` : decomReason;
    const id = decomTarget.id;
    update((prev) => ({
      ...prev,
      patches: {
        ...prev.patches,
        [id]: {
          ...prev.patches[id],
          status: "DECOMMISSIONED" as AssetStatus,
          decommissionReason: reason,
        },
      },
    }));
    setDecomTarget(null);
    setDecomNote("");
  }

  function recommission(row: AssetRow) {
    update((prev) => ({
      ...prev,
      patches: {
        ...prev.patches,
        [row.id]: { ...prev.patches[row.id], status: "RUNNING" as AssetStatus, decommissionReason: null },
      },
    }));
  }

  /* ------------------------------------------------------------- render */
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Installed asset register"
        sub="Every machine supplied, recorded against a serial at a real site. Coverage is derived from dates and contracts, never typed."
        right={
          canCreate ? (
            <Button tone="primary" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              New asset
            </Button>
          ) : null
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <li>
          <Metric label="Assets on register" value={formatCount(attach.totalAssets)} sub={`${attach.decommissioned} decommissioned`} />
        </li>
        <li>
          <Metric label="In warranty" value={formatCount(attach.inWarranty)} sub="OEM exposure" tone="ok" />
        </li>
        <li>
          <Metric label="Under AMC" value={formatCount(attach.underAmc)} sub="live contracts" tone="info" />
        </li>
        <li>
          <Metric
            label="Out of coverage"
            value={formatCount(attach.outOfCoverage)}
            sub="renewal opportunity"
            tone="danger"
          />
        </li>
        <li>
          <Metric
            label="AMC attach rate"
            value={formatPercent(attach.pct)}
            sub={`${attach.underAmc} of ${attach.eligible} eligible`}
            tone="warn"
          />
        </li>
      </ul>

      <FormulaDisclosure
        title="How the attach rate is calculated"
        formula={attachFormulaWithNumbers(attach)}
        note="An in-warranty machine is not yet an AMC opportunity and a decommissioned machine never will be, so neither sits in the denominator. Stated so the figure is not confused with a naive uncovered count."
      />

      <Panel>
        <Toolbar>
          <SearchField
            label="Search"
            value={query}
            onChange={(v) => {
              setQuery(v);
              setLimit(PAGE);
            }}
            placeholder="Serial, model, customer or site"
          />
          <SelectField
            label="Principal"
            value={principal}
            onChange={setPrincipal}
            className="w-40"
            options={[
              { value: ALL, label: "All principals" },
              ...(Object.keys(OEM_LABEL) as OEMPrincipal[]).map((p) => ({
                value: p,
                label: OEM_LABEL[p],
              })),
            ]}
          />
          <SelectField
            label="Product line"
            value={productLine}
            onChange={setProductLine}
            className="w-52"
            options={[
              { value: ALL, label: "All product lines" },
              ...(Object.keys(PRODUCT_LINE_LABEL) as ProductLine[]).map((p) => ({
                value: p,
                label: PRODUCT_LINE_LABEL[p],
              })),
            ]}
          />
          <SelectField
            label="Coverage"
            value={coverage}
            onChange={setCoverage}
            className="w-44"
            options={[
              { value: ALL, label: "All coverage states" },
              ...(["IN_WARRANTY", "UNDER_AMC", "OUT_OF_COVERAGE"] as CoverageState[]).map((c) => ({
                value: c,
                label: c === "IN_WARRANTY" ? "In warranty" : c === "UNDER_AMC" ? "Under AMC" : "Out of coverage",
              })),
            ]}
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            className="w-40"
            options={[
              { value: ALL, label: "All statuses" },
              { value: "RUNNING", label: "Running" },
              { value: "DOWN", label: "Down" },
              { value: "ON_RENT", label: "On rent" },
              { value: "DECOMMISSIONED", label: "Decommissioned" },
            ]}
          />
          <SelectField
            label="Branch"
            value={branch}
            onChange={setBranch}
            className="w-40"
            options={[
              { value: ALL, label: "All branches" },
              ...options.branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
            ]}
          />
        </Toolbar>

        {!ready ? (
          <div className="flex flex-col gap-px bg-line p-px">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 bg-surface-1" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No installed assets yet"
            body="Every machine supplied becomes a serial-numbered asset here, so service, warranty and contracts attach to a real machine rather than a customer name."
            action={canCreate ? <Button tone="primary" onClick={openCreate}>Register the first asset</Button> : undefined}
          />
        ) : filtered.length === 0 ? (
          <FilteredEmpty entity="assets" names={activeFilters} onClear={clearFilters} />
        ) : (
          <>
            <TableFrame>
              <thead>
                <tr>
                  <Th>Serial</Th>
                  <Th>Machine</Th>
                  <Th>Customer · site</Th>
                  <Th>Coverage</Th>
                  <Th>Status</Th>
                  <Th>Commissioning</Th>
                  <Th numeric>Running hrs</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const countdown = r.commissioningDeadline
                    ? countdownOf({
                        deadline: r.commissioningDeadline,
                        submittedAt: null,
                        windowDays: 0,
                        now,
                      })
                    : null;
                  const submission = r.commissioningSubmission;
                  return (
                    <Row key={r.id} tone={r.status === "DECOMMISSIONED" ? "warn" : "none"}>
                      <Td nowrap>
                        <Link
                          href={`/service/assets/${encodeURIComponent(r.serial)}`}
                          className="hover:underline"
                        >
                          <Serial value={r.serial} />
                        </Link>
                        {r.local ? (
                          <span className="t-overline ml-2 rounded-md bg-surface-2 px-1 text-text-lo">
                            Local
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <span className="block text-text-hi">{r.model}</span>
                        <span className="t-body-sm block text-text-lo">
                          {OEM_LABEL[r.principal]} · {PRODUCT_LINE_LABEL[r.productLine]} ·{" "}
                          {formatQty(r.capacityValue, r.capacityUnit)}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-text-hi">{r.customerName}</span>
                        <span className="t-body-sm block text-text-lo">
                          {r.siteName} · {r.branchCode}
                        </span>
                      </Td>
                      <Td>
                        <span className="flex flex-wrap items-center gap-1">
                          <CoverageBadge state={r.coverage} />
                          {amcAdditionallyInForce(r, now) && r.amcNumber ? (
                            <AmcAlsoInForce amcNumber={r.amcNumber} amcEnd={r.amcEnd} />
                          ) : null}
                        </span>
                        {r.warrantyEnd ? (
                          <span className="t-body-sm block text-text-lo">
                            Warranty to {formatDate(r.warrantyEnd)}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <AssetStatusBadge status={r.status} />
                        {r.openTickets > 0 ? (
                          <span className="t-body-sm block text-warn">
                            {r.openTickets} open ticket{r.openTickets === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </Td>
                      <Td nowrap>
                        {r.commissioningDate ? (
                          <span className="block text-text-mid">{formatDate(r.commissioningDate)}</span>
                        ) : (
                          <span className="block text-text-lo">Not commissioned</span>
                        )}
                        {submission && countdown ? (
                          <CountdownPill
                            state={{
                              ...countdown,
                              submitted: submission.startsWith("SUBMITTED"),
                              overdue: submission === "OVERDUE",
                              headline:
                                submission === "SUBMITTED_IN_WINDOW"
                                  ? "OEM: in window"
                                  : submission === "SUBMITTED_LATE"
                                    ? "OEM: late"
                                    : submission === "OVERDUE"
                                      ? `OEM: ${Math.abs(countdown.daysRemaining)}d overdue`
                                      : `OEM: ${countdown.daysRemaining}d left`,
                              tone:
                                submission === "SUBMITTED_IN_WINDOW"
                                  ? "ok"
                                  : submission === "OVERDUE"
                                    ? "danger"
                                    : submission === "SUBMITTED_LATE"
                                      ? "warn"
                                      : countdown.daysRemaining <= 2
                                        ? "warn"
                                        : "info",
                            }}
                            className="mt-0.5"
                          />
                        ) : null}
                      </Td>
                      <Td numeric nowrap>
                        <span className="block text-text-hi">{formatCount(r.runningHours)}</span>
                        <span className="t-body-sm block text-text-lo">
                          {formatDate(r.runningHoursAt)}
                        </span>
                      </Td>
                      <Td className="text-right" nowrap>
                        <span className="inline-flex items-center gap-1">
                          {canEdit ? (
                            <>
                              <Button
                                tone="ghost"
                                aria-label={`Edit ${r.serial}`}
                                onClick={() => openEdit(r)}
                                className="px-2"
                              >
                                <Pencil className="size-3.5" aria-hidden />
                              </Button>
                              {r.status === "DECOMMISSIONED" ? (
                                <Button tone="ghost" className="px-2" onClick={() => recommission(r)}>
                                  Restore
                                </Button>
                              ) : (
                                <Button
                                  tone="ghost"
                                  aria-label={`Decommission ${r.serial}`}
                                  onClick={() => {
                                    setDecomTarget(r);
                                    setDecomReason(DECOMMISSION_REASONS[0]);
                                    setDecomNote("");
                                  }}
                                  className="px-2"
                                >
                                  <CircleSlash className="size-3.5" aria-hidden />
                                </Button>
                              )}
                            </>
                          ) : null}
                          <Link
                            href={`/service/assets/${encodeURIComponent(r.serial)}`}
                            className="t-body-sm inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
                          >
                            Passport
                            <ArrowRight className="size-3" aria-hidden />
                          </Link>
                        </span>
                      </Td>
                    </Row>
                  );
                })}
              </tbody>
            </TableFrame>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2">
              <p className="t-body-sm text-text-lo">
                Showing {formatCount(visible.length)} of {formatCount(filtered.length)} matching ·{" "}
                {formatCount(rows.length)} on register
              </p>
              {visible.length < filtered.length ? (
                <Button onClick={() => setLimit((l) => l + PAGE)}>Load more</Button>
              ) : null}
            </div>
          </>
        )}
      </Panel>

      {/* Create / edit ---------------------------------------------------- */}
      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        wide
        title={editingId ? "Edit installed asset" : "Register installed asset"}
        description="Serial numbers are unique platform-wide. Coverage state is derived and has no field here."
        footer={
          <>
            {submitted && hasErrors ? (
              <p className="t-body-sm mr-auto text-danger">
                <TriangleAlert className="mr-1 inline size-3.5" aria-hidden />
                Correct the highlighted fields before saving.
              </p>
            ) : null}
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button tone="primary" onClick={commit} disabled={submitted && hasErrors}>
              {editingId ? "Save changes" : "Register asset"}
            </Button>
          </>
        }
      >
        <AssetForm
          draft={draft}
          setDraft={setDraft}
          errors={submitted || draft.serial ? errors : {}}
          options={options}
          mode={editingId ? "edit" : "create"}
          duplicateSerialHref={duplicateHref}
        />
      </Modal>

      {/* Decommission ----------------------------------------------------- */}
      <Modal
        open={Boolean(decomTarget)}
        onOpenChange={(v) => {
          if (!v) setDecomTarget(null);
        }}
        title="Decommission asset"
        description="A reason is mandatory. The machine stays fully visible in history but leaves coverage and renewal calculations."
        footer={
          <>
            <Button onClick={() => setDecomTarget(null)}>Cancel</Button>
            <Button tone="danger" onClick={commitDecommission} disabled={decomBlocked}>
              Decommission
            </Button>
          </>
        }
      >
        {decomTarget ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-line bg-surface-0 px-3 py-2">
              <Overline>Asset</Overline>
              <p className="t-body text-text-hi">
                <Serial value={decomTarget.serial} /> · {decomTarget.model}
              </p>
              <p className="t-body-sm text-text-mid">
                {decomTarget.customerName} · {decomTarget.siteName}
              </p>
            </div>

            {decomTarget.openTickets > 0 ? (
              <p className="t-body-sm flex items-start gap-2 rounded-md border border-warn/40 bg-warn-bg px-2.5 py-2 text-warn">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  {decomTarget.openTickets} open service ticket
                  {decomTarget.openTickets === 1 ? "" : "s"} stand against this machine. They remain
                  open and visible after decommissioning — close or cancel them separately.
                </span>
              </p>
            ) : null}

            <Field label="Reason" required>
              <Select value={decomReason} onChange={(e) => setDecomReason(e.target.value)}>
                {DECOMMISSION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Note" hint="Optional detail appended to the reason.">
              <TextArea
                value={decomNote}
                onChange={(e) => setDecomNote(e.target.value)}
                placeholder="Buy-back against order BC/SO/2627/0042"
              />
            </Field>

            {decomBlocked ? (
              <BlockedNote
                rule="A decommissioning cannot be saved without a reason."
                unblock="choosing one of the reasons above."
              />
            ) : (
              <p className="t-body-sm rounded-md border border-line bg-surface-0 px-2.5 py-2 text-text-mid">
                After saving, coverage resolves to Out of coverage, the machine drops out of the
                attach-rate denominator and the renewal radar, and every ticket, visit and part
                remains readable on its passport.
              </p>
            )}
          </div>
        ) : null}
      </Modal>

      {!canEdit ? (
        <p className="t-body-sm text-text-lo">
          Your role holds read access to the asset register. Creation, editing and decommissioning
          sit with the Service Manager.
        </p>
      ) : null}
    </div>
  );
}
