"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, Send, TriangleAlert } from "lucide-react";
import { OEM_LABEL, type CommissioningSubmission, type OEMPrincipal } from "@/lib/schemas/enums";
import { formatCount, formatDate, formatDateTime, formatPercent } from "@/lib/format";
import { EmptyState, Overline, Panel, SimulatedBadge, Explainer } from "@/components/patterns/primitives";
import { CountdownPill, SubmissionBadge, countdownOf } from "./badges";
import {
  EMPTY_COMMISSIONING,
  applyCommissioningOverlay,
  simulatedAckRef,
  useOverlay,
  type CommissioningOverlay,
} from "./store";
import {
  Button,
  FilteredEmpty,
  FormulaDisclosure,
  Metric,
  Modal,
  PageHeader,
  Row,
  SearchField,
  SelectField,
  Serial,
  TableFrame,
  Td,
  Th,
  Toolbar,
} from "./ui";
import type { BranchOption, CommissioningRow } from "./types";

const ALL = "ALL";

type PeriodId = "ALL" | "FYTD" | "T12";

const STATE_ORDER: Record<CommissioningSubmission, number> = {
  OVERDUE: 0,
  NOT_SUBMITTED: 1,
  SUBMITTED_LATE: 2,
  SUBMITTED_IN_WINDOW: 3,
};

function periodStart(period: PeriodId, now: Date): Date | null {
  if (period === "ALL") return null;
  if (period === "T12") return new Date(now.getTime() - 365 * 86_400_000);
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(startYear, 3, 1);
}

function warrantyConsequence(row: CommissioningRow): { text: string; tone: string } {
  switch (row.submission) {
    case "SUBMITTED_IN_WINDOW":
      return {
        text: row.warrantyEnd
          ? `Registered — warranty to ${formatDate(row.warrantyEnd)}`
          : "Registered with the OEM",
        tone: "text-ok",
      };
    case "SUBMITTED_LATE":
      return {
        text: "Registration at OEM discretion — submitted after the window",
        tone: "text-warn",
      };
    case "OVERDUE":
      return { text: "Warranty registration at risk — window closed", tone: "text-danger" };
    default:
      return { text: "Not yet registered — window still open", tone: "text-text-mid" };
  }
}

export function CommissioningRegister({
  rows: seedRows,
  branches,
  todayIso,
  canSubmit,
}: {
  rows: CommissioningRow[];
  branches: BranchOption[];
  todayIso: string;
  canSubmit: boolean;
}) {
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const { state: overlay, ready, update } = useOverlay<CommissioningOverlay>(
    "pravaah.v1.commissioning",
    EMPTY_COMMISSIONING,
  );

  const rows = React.useMemo(
    () => applyCommissioningOverlay(seedRows, overlay, now),
    [seedRows, overlay, now],
  );

  const [period, setPeriod] = React.useState<PeriodId>("ALL");
  const [state, setState] = React.useState<string>(ALL);
  const [principal, setPrincipal] = React.useState<string>(ALL);
  const [branch, setBranch] = React.useState<string>(ALL);
  const [query, setQuery] = React.useState("");
  const [confirm, setConfirm] = React.useState<CommissioningRow | null>(null);

  const from = periodStart(period, now);

  const inPeriod = React.useMemo(
    () => rows.filter((r) => (from ? new Date(r.commissioningDate) >= from : true)),
    [rows, from],
  );

  const activeFilters: string[] = [];
  if (query.trim()) activeFilters.push(`Search "${query.trim()}"`);
  if (state !== ALL) activeFilters.push(`State ${state.replace(/_/g, " ").toLowerCase()}`);
  if (principal !== ALL) activeFilters.push(`Principal ${OEM_LABEL[principal as OEMPrincipal]}`);
  if (branch !== ALL)
    activeFilters.push(`Branch ${branches.find((b) => b.id === branch)?.code ?? branch}`);

  function clearFilters() {
    setQuery("");
    setState(ALL);
    setPrincipal(ALL);
    setBranch(ALL);
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return inPeriod
      .filter((r) => {
        if (state !== ALL && r.submission !== state) return false;
        if (principal !== ALL && r.principal !== principal) return false;
        if (branch !== ALL && r.branchId !== branch) return false;
        if (!q) return true;
        return (
          r.serial.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.number.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const s = STATE_ORDER[a.submission] - STATE_ORDER[b.submission];
        if (s !== 0) return s;
        return b.commissioningDate.localeCompare(a.commissioningDate);
      });
  }, [inPeriod, query, state, principal, branch]);

  /* ------------------------------------------------- compliance figures */
  const counts = {
    total: inPeriod.length,
    inWindow: inPeriod.filter((r) => r.submission === "SUBMITTED_IN_WINDOW").length,
    late: inPeriod.filter((r) => r.submission === "SUBMITTED_LATE").length,
    overdue: inPeriod.filter((r) => r.submission === "OVERDUE").length,
    notSubmitted: inPeriod.filter((r) => r.submission === "NOT_SUBMITTED").length,
  };
  const compliance = counts.total ? (counts.inWindow / counts.total) * 100 : 0;

  function submitToOem(row: CommissioningRow) {
    const at = now.toISOString();
    const ref = simulatedAckRef();
    update((prev) => ({
      ...prev,
      submissions: { ...prev.submissions, [row.id]: { submittedAt: at, acknowledgementRef: ref } },
    }));
    setConfirm(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Commissioning register"
        sub="Every commissioning and its OEM submission state. Overdue records escalate to the top — a closed window is a warranty the customer may not have."
        right={
          <SelectField
            label="Period"
            value={period}
            onChange={(v) => setPeriod(v as PeriodId)}
            className="w-52"
            options={[
              { value: "ALL", label: "All commissionings" },
              { value: "FYTD", label: "This financial year to date" },
              { value: "T12", label: "Trailing 12 months" },
            ]}
          />
        }
      />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <li>
          <Metric label="Commissionings" value={formatCount(counts.total)} sub="in the selected period" />
        </li>
        <li>
          <Metric label="Within window" value={formatCount(counts.inWindow)} tone="ok" sub="warranty protected" />
        </li>
        <li>
          <Metric label="Submitted late" value={formatCount(counts.late)} tone="warn" sub="OEM discretion" />
        </li>
        <li>
          <Metric
            label="Overdue"
            value={formatCount(counts.overdue)}
            tone="danger"
            sub={`${counts.notSubmitted} still inside window`}
          />
        </li>
        <li>
          <Metric
            label="Submission compliance"
            value={formatPercent(compliance)}
            tone={compliance >= 98 ? "ok" : "warn"}
            sub={`${counts.inWindow} of ${counts.total}`}
          />
        </li>
      </ul>

      <FormulaDisclosure
        title="How submission compliance is calculated"
        formula={`${formatPercent(compliance)} = ${counts.inWindow} submitted within window ÷ ${counts.total} commissionings in period`}
        note={`Reconciles exactly to the records listed below: ${counts.inWindow} within window, ${counts.late} late, ${counts.overdue} overdue, ${counts.notSubmitted} not yet submitted with the window still open. The window is set per principal — ELGi and ATS-ELGi 7 days, KSB 10, Ion Exchange 15.`}
      />

      {counts.overdue > 0 ? (
        <Panel className="border-danger/50">
          <div className="flex flex-wrap items-start gap-3 p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="t-heading-md text-text-hi">
                {counts.overdue} commissioning{counts.overdue === 1 ? "" : "s"} past the OEM window
              </p>
              <p className="t-body-sm mt-0.5 text-text-mid">
                Director – Business has been notified and an exception raised for each. These sit at
                the top of the register and in the command-centre exception feed.
              </p>
            </div>
            <Link
              href="/command/exceptions"
              className="t-body-sm inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              Exception feed
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <Toolbar>
          <SearchField
            label="Search"
            value={query}
            onChange={setQuery}
            placeholder="Serial, customer, report number or model"
          />
          <SelectField
            label="Submission state"
            value={state}
            onChange={setState}
            className="w-52"
            options={[
              { value: ALL, label: "All states" },
              { value: "OVERDUE", label: "Overdue" },
              { value: "NOT_SUBMITTED", label: "Not submitted" },
              { value: "SUBMITTED_LATE", label: "Submitted late" },
              { value: "SUBMITTED_IN_WINDOW", label: "Submitted within window" },
            ]}
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
            label="Branch"
            value={branch}
            onChange={setBranch}
            className="w-40"
            options={[
              { value: ALL, label: "All branches" },
              ...branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })),
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
            icon={ClipboardCheck}
            title="No commissioning has been recorded"
            body="A commissioning report is written from the field the moment a machine is handed over. Each one starts an OEM submission clock and fixes the warranty start date."
          />
        ) : filtered.length === 0 ? (
          <FilteredEmpty entity="commissionings" names={activeFilters} onClear={clearFilters} />
        ) : (
          <TableFrame>
            <thead>
              <tr>
                <Th>Report · serial</Th>
                <Th>Customer</Th>
                <Th>Commissioned</Th>
                <Th>Deadline</Th>
                <Th>State</Th>
                <Th>Submitted</Th>
                <Th>Acknowledgement</Th>
                <Th>Warranty consequence</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const countdown = countdownOf({
                  deadline: r.deadline,
                  submittedAt: r.submittedAt,
                  windowDays: r.windowDays,
                  now,
                });
                const consequence = warrantyConsequence(r);
                const escalated = r.submission === "OVERDUE";
                return (
                  <Row key={r.id} tone={escalated ? "danger" : "none"}>
                    <Td nowrap>
                      <span className="flex items-center gap-2">
                        {escalated ? (
                          <span aria-hidden className="h-6 w-[3px] shrink-0 rounded-full bg-danger" />
                        ) : null}
                        <span>
                          <Link
                            href={`/field/commissioning/${r.assetId}`}
                            className="t-mono inline-flex min-h-6 items-center text-text-hi hover:underline"
                          >
                            {r.number}
                          </Link>
                          <Link
                            href={`/service/assets/${encodeURIComponent(r.serial)}`}
                            className="inline-flex min-h-6 items-center hover:underline"
                          >
                            <Serial value={r.serial} className="text-text-mid" />
                          </Link>
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span className="block text-text-hi">{r.customerName}</span>
                      <span className="t-body-sm block text-text-lo">
                        {r.siteName} · {r.branchCode} · {OEM_LABEL[r.principal]}
                      </span>
                    </Td>
                    <Td nowrap>{formatDate(r.commissioningDate)}</Td>
                    <Td nowrap>
                      <span className="block text-text-mid">{formatDate(r.deadline)}</span>
                      <CountdownPill state={countdown} className="mt-0.5" />
                    </Td>
                    <Td nowrap>
                      <SubmissionBadge state={r.submission} short />
                      {!r.cleanReport ? (
                        <span className="t-body-sm block text-warn">
                          {r.failedItems} observation{r.failedItems === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </Td>
                    <Td nowrap>{r.submittedAt ? formatDate(r.submittedAt) : "—"}</Td>
                    <Td nowrap>
                      {r.acknowledgementRef ? (
                        <span className="flex flex-col gap-0.5">
                          <span className="t-mono text-text-hi">{r.acknowledgementRef}</span>
                          <SimulatedBadge what="OEM channel portal (INT-11)" />
                        </span>
                      ) : (
                        <span className="text-text-lo">—</span>
                      )}
                    </Td>
                    <Td className={consequence.tone}>{consequence.text}</Td>
                    <Td className="text-right" nowrap>
                      {r.submittedAt ? (
                        <Link
                          href={`/field/commissioning/${r.assetId}`}
                          className="t-body-sm inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-text-mid hover:border-line-strong hover:text-text-hi"
                        >
                          Open report
                        </Link>
                      ) : (
                        <Button
                          tone={escalated ? "danger" : "default"}
                          disabled={!canSubmit}
                          onClick={() => setConfirm(r)}
                        >
                          <Send className="size-3.5" aria-hidden />
                          Submit to OEM
                        </Button>
                      )}
                    </Td>
                  </Row>
                );
              })}
            </tbody>
          </TableFrame>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2">
          <p className="t-body-sm text-text-lo">
            {formatCount(filtered.length)} listed · compliance {formatPercent(compliance)} across{" "}
            {formatCount(counts.total)} in period
          </p>
          {!canSubmit ? (
            <p className="t-body-sm text-text-lo">
              Submitting to the OEM channel sits with the Service Manager and field engineers.
            </p>
          ) : null}
        </div>
      </Panel>

      <Modal
        open={Boolean(confirm)}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
        title="Submit to the OEM channel"
        description="The channel call is simulated in this prototype. Phase 2 replaces it with the principal's portal API."
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button tone="primary" onClick={() => confirm && submitToOem(confirm)}>
              <Send className="size-4" aria-hidden />
              Submit and record acknowledgement
            </Button>
          </>
        }
      >
        {confirm ? (
          <div className="flex flex-col gap-3">
            <SimulatedBadge what="OEM channel portal (INT-11)" />
            <dl className="grid grid-cols-2 gap-3">
              {(
                [
                  ["Report", confirm.number],
                  ["Serial", confirm.serial],
                  ["Customer", confirm.customerName],
                  ["Principal", OEM_LABEL[confirm.principal]],
                  ["Commissioned", formatDate(confirm.commissioningDate)],
                  ["Deadline", `${formatDate(confirm.deadline)} (${confirm.windowDays} days)`],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k}>
                  <Overline>{k}</Overline>
                  <dd className="t-body-sm text-text-hi">{v}</dd>
                </div>
              ))}
            </dl>
            <Explainer className="rounded-md border border-line bg-surface-0 px-2.5 py-2 text-text-mid">
              A submission timestamp of {formatDateTime(now)} and a simulated acknowledgement
              reference will be recorded against the report. The submission state recomputes
              immediately from that timestamp against the deadline.
            </Explainer>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
