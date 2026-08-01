import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { formatDate } from "@/lib/format";
import { EmptyState, Overline, Panel, PanelHeader, Explainer } from "@/components/patterns/primitives";
import { CountdownPill, SubmissionBadge, countdownOf } from "@/components/domain/assets/badges";
import { buildCommissioningRows, buildIndexes } from "@/components/domain/assets/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commissioning — Pravaah Field",
};

export default function FieldCommissioningIndex() {
  const ds = getDataset();
  const ctx = D.ctxOf(ds);
  const now = ctx.now;
  const rows = buildCommissioningRows(ds, now, buildIndexes(ds, now));

  const openClock = rows
    .filter((r) => r.submission === "OVERDUE" || r.submission === "NOT_SUBMITTED")
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  const recent = rows
    .filter((r) => r.submission !== "OVERDUE" && r.submission !== "NOT_SUBMITTED")
    .sort((a, b) => b.commissioningDate.localeCompare(a.commissioningDate))
    .slice(0, 12);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4" data-shell="field">
      <header>
        <Overline>Field · commissioning</Overline>
        <h1 className="t-display-md text-text-hi">OEM submission clocks</h1>
        <p className="t-body-sm mt-1 text-text-mid">Commissionings whose OEM window is still running. Late paperwork voids warranty.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Every commissioning whose OEM window is still running. Late paperwork is what invalidates a
          customer warranty, so these come first.
        </Explainer>
      </header>

      <Panel>
        <PanelHeader
          title="Clock running"
          sub={`${openClock.length} report${openClock.length === 1 ? "" : "s"} not yet submitted`}
        />
        {openClock.length ? (
          <ul className="flex flex-col gap-px bg-line">
            {openClock.map((r) => {
              const state = countdownOf({
                deadline: r.deadline,
                submittedAt: r.submittedAt,
                windowDays: r.windowDays,
                now,
              });
              return (
                <li key={r.id} className="bg-surface-1">
                  <Link
                    href={`/field/commissioning/${r.assetId}`}
                    className="flex min-h-[3.5rem] items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="t-mono block whitespace-nowrap text-text-hi">{r.serial}</span>
                      <span className="t-body-sm block text-text-mid">{r.customerName}</span>
                      <span className="t-body-sm block text-text-lo">
                        {r.model} · commissioned {formatDate(r.commissioningDate)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <CountdownPill state={state} />
                      <ArrowRight className="size-4 text-text-lo" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="Every commissioning has been submitted"
            body="No OEM submission window is open. New reports appear here the moment a commissioning date is recorded."
          />
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Recently submitted" sub="The last twelve, newest first." />
        <ul className="flex flex-col gap-px bg-line">
          {recent.map((r) => (
            <li key={r.id} className="bg-surface-1">
              <Link
                href={`/field/commissioning/${r.assetId}`}
                className="flex min-h-[3.5rem] items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2"
              >
                <span className="min-w-0">
                  <span className="t-mono block whitespace-nowrap text-text-hi">{r.serial}</span>
                  <span className="t-body-sm block text-text-lo">
                    {r.customerName} · {formatDate(r.commissioningDate)}
                  </span>
                </span>
                <SubmissionBadge state={r.submission} short />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Link
        href="/service/commissioning"
        className="t-body-sm inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-text-mid hover:border-line-strong hover:text-text-hi"
      >
        Open the full commissioning register
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </main>
  );
}
