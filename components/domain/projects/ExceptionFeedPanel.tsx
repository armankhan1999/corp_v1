"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EXCEPTION_LABEL } from "./labels";
import { useProjectsOverlay } from "./store";

export interface ExceptionItem {
  id: string;
  type: "PROJECT_SCHEDULE_VARIANCE" | "RABILL_AWAITING_CERTIFICATION" | "RETENTION_ELIGIBLE" | "DOCUMENT_EXPIRED";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  owner: string;
  href: string;
  /** Overlay key that, once present, resolves this exception. */
  clearsOnBillId?: string;
  clearsOnRetentionId?: string;
}

const SEVERITY_TONE = { CRITICAL: "danger", HIGH: "danger", MEDIUM: "warn", LOW: "info" } as const;

/**
 * E6-S4, E6-S5, E6-S6, E6-S7 all require their exception to reach the feed.
 * The Command Centre owns `/command/exceptions`; this panel is the projects
 * slice of the same unified taxonomy (C-16), rendered where the work is done.
 */
export function ExceptionFeedPanel({ items }: { items: ExceptionItem[] }) {
  const overlay = useProjectsOverlay();

  const open = items.filter((x) => {
    if (x.clearsOnBillId) {
      const patch = overlay.billPatches[x.clearsOnBillId];
      if (patch?.status && patch.status !== "SUBMITTED") return false;
    }
    if (x.clearsOnRetentionId) {
      if (overlay.releases[x.clearsOnRetentionId]) return false;
    }
    return true;
  });

  const grouped = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const)
    .flatMap((sev) => open.filter((x) => x.severity === sev));

  return (
    <Panel>
      <PanelHeader
        title="Exception feed — Projects"
        sub="The four project exception types in the platform taxonomy, each naming what is wrong and who owns it."
        right={
          <Link href="/command/exceptions" className="t-body-sm text-text-mid underline decoration-line underline-offset-2 hover:text-text-hi">
            Open the full feed
          </Link>
        }
      />
      {grouped.length === 0 ? (
        <div className="flex items-center gap-2.5 px-4 py-6">
          <CheckCircle2 className="size-5 text-ok" aria-hidden />
          <div>
            <p className="t-body text-text-hi">No open project exceptions</p>
            <p className="t-body-sm text-text-mid">
              Every live project sits inside its schedule tolerance, no bill is overdue for certification,
              and no retention has become claimable without a claim.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col">
          {grouped.map((x) => (
            <li key={x.id} className="border-b border-line last:border-b-0">
              <Link href={x.href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-surface-2">
                <AlertTriangle
                  className={cn("mt-0.5 size-4 shrink-0", x.severity === "CRITICAL" || x.severity === "HIGH" ? "text-danger" : "text-warn")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={SEVERITY_TONE[x.severity]} icon={false}>
                      {EXCEPTION_LABEL[x.type]}
                    </StatusBadge>
                    <span className="t-body font-medium text-text-hi">{x.title}</span>
                  </span>
                  <span className="t-body-sm mt-0.5 block text-text-mid">{x.detail}</span>
                  <span className="t-body-sm block text-text-lo">Owner — {x.owner}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
        {formatCount(grouped.length)} open · resolved exceptions drop off as soon as the underlying record moves.
      </p>
    </Panel>
  );
}
