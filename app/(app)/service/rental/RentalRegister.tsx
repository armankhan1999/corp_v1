"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight, BellRing, CircleCheck, PackageCheck, Truck, TriangleAlert, Undo2,
} from "lucide-react";
import { abbreviateINR, formatCount, formatDate, formatINR, formatPercent } from "@/lib/format";
import { EmptyState, Panel, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { assetUtilisation, rentalUtilisation } from "@/components/domain/assets/metrics";
import {
  EMPTY_RENTAL,
  applyRentalOverlay,
  useOverlay,
  type RentalOverlay,
} from "@/components/domain/assets/store";
import {
  BlockedNote,
  Button,
  DateInput,
  Field,
  FilteredEmpty,
  Metric,
  Modal,
  PageHeader,
  Row,
  SearchField,
  Select,
  SelectField,
  Serial,
  TabBar,
  TableFrame,
  Td,
  TextArea,
  Th,
  Toolbar,
  fromDateInput,
  toDateInput,
} from "@/components/domain/assets/ui";
import type {
  BranchOption,
  RentalAgreementRow,
  RentalAssetRow,
} from "@/components/domain/assets/types";

/**
 * E5-S8 — the rental fleet register.
 *
 * A machine is On Rent while a live agreement exists; the status is read off
 * the agreements rather than typed, so a unit cannot be marked available while
 * it is still at a customer's site. Utilisation is days on rent against days
 * available across the trailing year, per asset and in aggregate.
 */

const ALL = "ALL";
const DAY = 86_400_000;
const TRAILING_DAYS = 365;

const CONDITIONS = ["Excellent", "Good", "Fair", "Damaged — repair required"] as const;

type TabId = "FLEET" | "AGREEMENTS";

interface ReturnDraft {
  agreementId: string;
  number: string;
  serial: string;
  customerName: string;
  actualReturn: string;
  returnCondition: string;
  damageNote: string;
}

export function RentalRegister({
  assets,
  agreements: seedAgreements,
  branches,
  todayIso,
  canWrite,
}: {
  assets: RentalAssetRow[];
  agreements: RentalAgreementRow[];
  branches: BranchOption[];
  todayIso: string;
  canWrite: boolean;
}) {
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const { state: overlay, ready, update } = useOverlay<RentalOverlay>(
    "pravaah.v1.rental",
    EMPTY_RENTAL,
  );

  const agreements = React.useMemo(
    () => applyRentalOverlay(seedAgreements, overlay),
    [seedAgreements, overlay],
  );

  const [tab, setTab] = React.useState<TabId>("FLEET");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>(ALL);
  const [branch, setBranch] = React.useState<string>(ALL);
  const [draft, setDraft] = React.useState<ReturnDraft | null>(null);
  const [attempted, setAttempted] = React.useState(false);

  const assetById = React.useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  /** The live agreement, if any, for each rental asset. Status derives from it. */
  const liveByAsset = React.useMemo(() => {
    const m = new Map<string, RentalAgreementRow>();
    for (const a of agreements) if (!a.actualReturn) m.set(a.rentalAssetId, a);
    return m;
  }, [agreements]);

  const overdueDays = (a: RentalAgreementRow): number =>
    a.actualReturn ? 0 : Math.floor((now.getTime() - new Date(a.expectedReturn).getTime()) / DAY);

  const isOverdue = (a: RentalAgreementRow): boolean => overdueDays(a) > 0;

  const overdue = agreements.filter(isOverdue);
  const onRent = agreements.filter((a) => !a.actualReturn);
  const returned = agreements.filter((a) => a.actualReturn);
  const fleetUtil = rentalUtilisation(agreements, assets.length, now, TRAILING_DAYS);
  const depositHeld = onRent.reduce((s, a) => s + a.deposit, 0);

  const activeFilters: string[] = [];
  if (query.trim()) activeFilters.push(`Search "${query.trim()}"`);
  if (status !== ALL) activeFilters.push(`Status ${status.replace(/_/g, " ").toLowerCase()}`);
  if (branch !== ALL)
    activeFilters.push(`Branch ${branches.find((b) => b.id === branch)?.code ?? branch}`);

  function clearFilters() {
    setQuery("");
    setStatus(ALL);
    setBranch(ALL);
  }

  const q = query.trim().toLowerCase();

  const fleetRows = React.useMemo(
    () =>
      assets.filter((a) => {
        const live = liveByAsset.get(a.id);
        if (branch !== ALL && a.branchId !== branch) return false;
        if (status === "ON_RENT" && !live) return false;
        if (status === "AVAILABLE" && live) return false;
        if (status === "OVERDUE" && !(live && isOverdue(live))) return false;
        if (!q) return true;
        return (
          a.serial.toLowerCase().includes(q) ||
          a.model.toLowerCase().includes(q) ||
          (live?.customerName.toLowerCase().includes(q) ?? false)
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, liveByAsset, branch, status, q, now],
  );

  const agreementRows = React.useMemo(
    () =>
      agreements
        .filter((a) => {
          const asset = assetById.get(a.rentalAssetId);
          if (branch !== ALL && asset?.branchId !== branch) return false;
          if (status === "ON_RENT" && a.actualReturn) return false;
          if (status === "AVAILABLE" && !a.actualReturn) return false;
          if (status === "OVERDUE" && !isOverdue(a)) return false;
          if (!q) return true;
          return (
            a.number.toLowerCase().includes(q) ||
            a.customerName.toLowerCase().includes(q) ||
            a.siteName.toLowerCase().includes(q) ||
            (asset?.serial.toLowerCase().includes(q) ?? false)
          );
        })
        .sort((x, y) => {
          const ox = isOverdue(x) ? 0 : x.actualReturn ? 2 : 1;
          const oy = isOverdue(y) ? 0 : y.actualReturn ? 2 : 1;
          if (ox !== oy) return ox - oy;
          return x.expectedReturn.localeCompare(y.expectedReturn);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agreements, assetById, branch, status, q, now],
  );

  function openReturn(a: RentalAgreementRow) {
    const asset = assetById.get(a.rentalAssetId);
    setDraft({
      agreementId: a.id,
      number: a.number,
      serial: asset?.serial ?? a.rentalAssetId,
      customerName: a.customerName,
      actualReturn: toDateInput(todayIso),
      returnCondition: asset?.condition ?? "Good",
      damageNote: "",
    });
    setAttempted(false);
  }

  const draftError =
    draft && !draft.actualReturn
      ? "A return date is required — the asset stays On Rent until one is recorded."
      : draft && draft.returnCondition.startsWith("Damaged") && !draft.damageNote.trim()
        ? "Describe the damage. A damaged return cannot be recorded without a note."
        : null;

  function commitReturn() {
    setAttempted(true);
    if (!draft || draftError) return;
    const iso = fromDateInput(draft.actualReturn);
    if (!iso) return;
    update((prev) => ({
      ...prev,
      returns: {
        ...prev.returns,
        [draft.agreementId]: {
          actualReturn: iso,
          returnCondition: draft.returnCondition,
          damageNote: draft.damageNote.trim(),
        },
      },
    }));
    setDraft(null);
  }

  function sendReminder(a: RentalAgreementRow) {
    update((prev) => ({
      ...prev,
      notified: { ...prev.notified, [a.id]: new Date().toISOString() },
    }));
  }

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "FLEET", label: "Fleet", count: fleetRows.length },
    { id: "AGREEMENTS", label: "Agreements", count: agreementRows.length },
  ];

  const skeleton = (
    <div className="flex flex-col gap-px bg-line p-px">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 bg-surface-1" />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Rental fleet"
        sub="Machines out on hire, the agreements behind them, and what each unit has actually earned. A unit shows On Rent while a live agreement exists — the status is derived, not set."
        right={
          <span className="t-body-sm inline-flex items-center gap-2 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] px-3 py-1.5">
            <Truck className="size-4 text-v-service" aria-hidden />
            <span className="t-mono tabular-nums text-text-hi">
              {onRent.length} of {assets.length}
            </span>
            <span className="text-text-lo">on rent</span>
          </span>
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <li>
          <Metric label="Fleet size" value={formatCount(assets.length)} sub="rental machines" />
        </li>
        <li>
          <Metric
            label="On rent"
            value={formatCount(onRent.length)}
            sub={`${assets.length - onRent.length} available`}
            tone="info"
          />
        </li>
        <li>
          <Metric
            label="Overdue for return"
            value={formatCount(overdue.length)}
            sub={overdue.length ? "expected return date passed" : "nothing past its date"}
            tone={overdue.length ? "danger" : "ok"}
          />
        </li>
        <li>
          <Metric
            label="Trailing utilisation"
            value={formatPercent(fleetUtil.pct)}
            sub={`${formatCount(fleetUtil.onRentDays)} of ${formatCount(fleetUtil.availableDays)} asset-days`}
            tone="info"
          />
        </li>
        <li>
          <Metric label="Deposits held" value={abbreviateINR(depositHeld)} sub="against live hires" />
        </li>
        <li>
          <Metric
            label="Returns recorded"
            value={formatCount(returned.length)}
            sub="with condition on return"
            tone={returned.length ? "ok" : "default"}
          />
        </li>
      </ul>

      {overdue.length ? (
        <div className="rounded-lg border border-danger/45 bg-danger-bg p-3">
          <p className="t-body flex items-start gap-2 font-medium text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {overdue.length} {overdue.length === 1 ? "machine is" : "machines are"} past the expected
            return date
          </p>
          <ul className="mt-1.5 flex flex-col gap-1 pl-6">
            {overdue.map((a) => {
              const asset = assetById.get(a.rentalAssetId);
              return (
                <li key={a.id} className="t-body-sm text-text-mid">
                  <Serial value={asset?.serial ?? a.rentalAssetId} /> · {a.customerName} ·{" "}
                  {a.siteName} — due{" "}
                  <span className="t-mono">{formatDate(a.expectedReturn)}</span>, overdue by{" "}
                  <span className="t-mono tabular-nums text-danger">{overdueDays(a)} days</span>
                  {overlay.notified[a.id] ? (
                    <span className="t-overline ml-2 rounded-md border border-ok/40 bg-ok-bg px-1 py-px text-ok">
                      Reminder sent
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Explainer className="mt-1.5 pl-6 text-text-lo">
            The notification matrix dispatches an overdue-return alert to the Service Manager and
            the owning branch as soon as the date passes.
          </Explainer>
        </div>
      ) : null}

      {!canWrite ? (
        <BlockedNote
          rule="Your role can read the rental register but cannot record a return."
          unblock="signing in as the Service Manager or the Store In-charge, who hold the write grant on rental."
        />
      ) : null}

      <Panel>
        <Toolbar>
          <SearchField
            label="Search"
            value={query}
            onChange={setQuery}
            placeholder="Serial, model, customer, site or agreement number"
          />
          <SelectField
            label="Status"
            value={status}
            onChange={setStatus}
            className="w-44"
            options={[
              { value: ALL, label: "All statuses" },
              { value: "ON_RENT", label: "On rent" },
              { value: "AVAILABLE", label: "Available / returned" },
              { value: "OVERDUE", label: "Overdue" },
            ]}
          />
          <SelectField
            label="Branch"
            value={branch}
            onChange={setBranch}
            className="w-44"
            options={[
              { value: ALL, label: "All branches" },
              ...branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
            ]}
          />
        </Toolbar>

        <TabBar tabs={tabs} active={tab} onChange={setTab} label="Rental register views" />

        <section aria-label={tab === "FLEET" ? "Rental fleet" : "Rental agreements"}>
          {!ready ? (
            skeleton
          ) : tab === "FLEET" ? (
            assets.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="No rental machine on the register"
                body="A rental asset carries its serial, specification and condition, and shows On Rent for as long as a live agreement exists against it."
              />
            ) : fleetRows.length === 0 ? (
              <FilteredEmpty entity="machines" names={activeFilters} onClear={clearFilters} />
            ) : (
              <TableFrame className="min-w-full">
                <thead>
                  <tr>
                    <Th>Serial</Th>
                    <Th>Specification</Th>
                    <Th>Condition</Th>
                    <Th>Branch</Th>
                    <Th>Status</Th>
                    <Th>Currently with</Th>
                    <Th numeric>Utilisation (365 days)</Th>
                    <Th>Available from</Th>
                  </tr>
                </thead>
                <tbody>
                  {fleetRows.map((a) => {
                    const live = liveByAsset.get(a.id);
                    const late = live ? isOverdue(live) : false;
                    const util = assetUtilisation(agreements, a.id, now, TRAILING_DAYS);
                    return (
                      <Row key={a.id} tone={late ? "danger" : "none"}>
                        <Td nowrap>
                          <Serial value={a.serial} />
                          <span className="t-body-sm block text-text-lo">{a.itemCode}</span>
                        </Td>
                        <Td>
                          <span className="block text-text-hi">{a.model}</span>
                          <span className="t-body-sm block tabular-nums text-text-lo">
                            {a.capacityValue} {a.capacityUnit}
                          </span>
                        </Td>
                        <Td nowrap>{a.condition}</Td>
                        <Td nowrap>{a.branchCode}</Td>
                        <Td nowrap>
                          {late ? (
                            <StatusBadge tone="danger">Overdue</StatusBadge>
                          ) : live ? (
                            <StatusBadge tone="info">On rent</StatusBadge>
                          ) : (
                            <StatusBadge tone="ok">Available</StatusBadge>
                          )}
                        </Td>
                        <Td>
                          {live ? (
                            <>
                              <span className="block text-text-hi">{live.customerName}</span>
                              <span className="t-body-sm block text-text-lo">
                                {live.siteName} · due {formatDate(live.expectedReturn)}
                              </span>
                            </>
                          ) : (
                            <span className="t-body-sm text-text-lo">In yard</span>
                          )}
                        </Td>
                        <Td numeric nowrap>
                          <span className={cn(util.pct >= 50 ? "text-ok" : "text-text-hi")}>
                            {formatPercent(util.pct)}
                          </span>
                          <span className="t-body-sm block text-text-lo">
                            {formatCount(util.onRentDays)} of {formatCount(util.availableDays)} days
                          </span>
                        </Td>
                        <Td nowrap>
                          <span className="t-mono text-text-mid">{formatDate(a.availableFrom)}</span>
                        </Td>
                      </Row>
                    );
                  })}
                </tbody>
              </TableFrame>
            )
          ) : agreements.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title="No rental agreement recorded"
              body="An agreement records the customer, site, period, rate basis, deposit and expected return date. Without one, a machine cannot show as On Rent."
            />
          ) : agreementRows.length === 0 ? (
            <FilteredEmpty entity="agreements" names={activeFilters} onClear={clearFilters} />
          ) : (
            <TableFrame className="min-w-full">
              <thead>
                <tr>
                  <Th>Agreement</Th>
                  <Th>Customer &amp; site</Th>
                  <Th>Machine</Th>
                  <Th>Period</Th>
                  <Th numeric>Rate</Th>
                  <Th numeric>Deposit</Th>
                  <Th>Expected return</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Return</Th>
                </tr>
              </thead>
              <tbody>
                {agreementRows.map((a) => {
                  const asset = assetById.get(a.rentalAssetId);
                  const late = isOverdue(a);
                  return (
                    <Row key={a.id} tone={late ? "danger" : "none"}>
                      <Td nowrap>
                        <span className="t-mono text-text-hi">{a.number}</span>
                        {a.local ? (
                          <span className="t-overline ml-2 rounded-md bg-surface-2 px-1 text-text-lo">
                            Local
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <span className="block text-text-hi">{a.customerName}</span>
                        <span className="t-body-sm block text-text-lo">{a.siteName}</span>
                      </Td>
                      <Td nowrap>
                        <Serial value={asset?.serial ?? a.rentalAssetId} />
                        <span className="t-body-sm block text-text-lo">{asset?.model ?? "—"}</span>
                      </Td>
                      <Td nowrap>
                        <span className="block text-text-mid">
                          {formatDate(a.startDate)} →{" "}
                          {a.actualReturn ? formatDate(a.actualReturn) : "open"}
                        </span>
                        <span className="t-body-sm block text-text-lo">
                          {a.rateBasis === "PER_DAY" ? "Per day" : "Per month"}
                        </span>
                      </Td>
                      <Td numeric nowrap>
                        {formatINR(a.rate)}
                      </Td>
                      <Td numeric nowrap>
                        {formatINR(a.deposit)}
                      </Td>
                      <Td nowrap>
                        <span className={cn("t-mono", late ? "text-danger" : "text-text-mid")}>
                          {formatDate(a.expectedReturn)}
                        </span>
                        {late ? (
                          <span className="t-body-sm block tabular-nums text-danger">
                            {overdueDays(a)} days over
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        {a.actualReturn ? (
                          <>
                            <StatusBadge tone="ok">Returned</StatusBadge>
                            <span className="t-body-sm mt-0.5 block text-text-lo">
                              {a.returnCondition ?? "condition not recorded"}
                              {a.damageNote ? ` · ${a.damageNote}` : ""}
                            </span>
                          </>
                        ) : late ? (
                          <StatusBadge tone="danger">Overdue</StatusBadge>
                        ) : (
                          <StatusBadge tone="info">On rent</StatusBadge>
                        )}
                      </Td>
                      <Td className="text-right" nowrap>
                        {a.actualReturn ? (
                          <span className="t-body-sm inline-flex min-h-6 items-center gap-1 text-ok">
                            <CircleCheck className="size-3.5" aria-hidden />
                            {formatDate(a.actualReturn)}
                          </span>
                        ) : !canWrite ? (
                          <span className="t-body-sm text-text-lo">Read-only role</span>
                        ) : (
                          <span className="inline-flex flex-wrap justify-end gap-1.5">
                            {late && !overlay.notified[a.id] ? (
                              <Button onClick={() => sendReminder(a)}>
                                <BellRing className="size-3.5" aria-hidden />
                                Remind
                              </Button>
                            ) : null}
                            <Button tone="primary" onClick={() => openReturn(a)}>
                              <Undo2 className="size-3.5" aria-hidden />
                              Record return
                            </Button>
                          </span>
                        )}
                      </Td>
                    </Row>
                  );
                })}
              </tbody>
            </TableFrame>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2">
          <p className="t-body-sm text-text-lo">
            Utilisation is days on rent ÷ days available across the trailing {TRAILING_DAYS} days —{" "}
            <span className="t-mono tabular-nums text-text-mid">
              {formatCount(fleetUtil.onRentDays)} ÷ {formatCount(fleetUtil.availableDays)} ={" "}
              {formatPercent(fleetUtil.pct)}
            </span>
            .
          </p>
          <Link
            href="/service/assets"
            className="t-body-sm inline-flex min-h-6 items-center gap-1.5 text-text-mid hover:text-text-hi"
          >
            Open the installed asset register
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </Panel>

      <Modal
        open={draft !== null}
        onOpenChange={(o) => {
          if (!o) setDraft(null);
        }}
        title="Record return"
        description="Return date, condition on return and any damage note. The machine goes back to available the moment this is saved."
        footer={
          <>
            {attempted && draftError ? (
              <p className="t-body-sm mr-auto text-danger">
                <TriangleAlert className="mr-1 inline size-3.5" aria-hidden />
                {draftError}
              </p>
            ) : null}
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button tone="primary" onClick={commitReturn}>
              <Undo2 className="size-4" aria-hidden />
              Record return
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <p className="t-body-sm text-text-mid">
              <span className="t-mono text-text-hi">{draft.number}</span> · {draft.customerName} ·{" "}
              <Serial value={draft.serial} />
            </p>

            <Field label="Return date" required>
              <DateInput
                value={draft.actualReturn}
                onChange={(v) => setDraft({ ...draft, actualReturn: v })}
                invalid={attempted && !draft.actualReturn}
              />
            </Field>

            <Field label="Condition on return" required>
              <Select
                value={draft.returnCondition}
                onChange={(e) => setDraft({ ...draft, returnCondition: e.target.value })}
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Damage note"
              hint="Required where the unit comes back damaged; recorded against the agreement and the deposit settlement."
              error={attempted && draftError && draft.returnCondition.startsWith("Damaged") ? draftError : null}
            >
              <TextArea
                value={draft.damageNote}
                onChange={(e) => setDraft({ ...draft, damageNote: e.target.value })}
                placeholder="Cracked receiver guard, missing tow hitch pin…"
                invalid={attempted && draft.returnCondition.startsWith("Damaged") && !draft.damageNote.trim()}
              />
            </Field>

            <p className="t-body-sm rounded-md border border-info/40 bg-info-bg px-2.5 py-2 text-text-mid">
              Deposit of{" "}
              <span className="t-mono">
                {formatINR(agreements.find((a) => a.id === draft.agreementId)?.deposit ?? 0)}
              </span>{" "}
              is held against this hire and settles on return, less any recorded damage.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
