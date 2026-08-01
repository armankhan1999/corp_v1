import Link from "next/link";
import { cookies } from "next/headers";
import { CalendarCheck2, ChevronRight, MapPin, Phone } from "lucide-react";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { getDataset } from "@/lib/seed";
import * as D from "@/lib/derive";
import { formatDate, formatDurationHM, formatOverrun, formatTime } from "@/lib/format";
import { EmptyState, Overline, Panel, StatusBadge } from "@/components/patterns/primitives";
import {
  dialable, projectTicket, serviceCtx, suggestRoute, type RouteStop,
} from "@/components/domain/service/project";
import { SEVERITY_LABEL, SEVERITY_TONE, SLA_STATE_LABEL } from "@/components/domain/service/types";

export const dynamic = "force-dynamic";

const SLA_TONE = {
  COMFORTABLE: "ok", APPROACHING: "warn", IMMINENT: "warn", BREACHED: "danger",
} as const;

/**
 * E4-S8 — the engineer's day. Today's visits in suggested route order, each
 * carrying everything needed to get there and start work, so nobody has to
 * ring the office for an address or a serial.
 */
export default async function FieldTodayPage() {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const ds = getDataset();
  const { now } = serviceCtx();

  // A field engineer sees their own assignments; anyone else previewing the
  // screen sees the branch's board so the route is never blank in a demo.
  const employeeId = ds.users.find((u) => u.id === session?.userId)?.employeeId ?? null;
  const mine = ds.tickets.filter((t) => D.isOpenTicket(t) && t.assignedEngineerId === employeeId);
  const fallback = ds.tickets
    .filter((t) => D.isOpenTicket(t) && t.assignedEngineerId !== null)
    .slice(0, 6);
  const source = mine.length > 0 ? mine : fallback;
  const previewing = mine.length === 0 && fallback.length > 0;

  const views = source.map((t) => projectTicket(ds, t, now));

  const branch = views[0];
  const stops: RouteStop[] = views.map((v) => ({
    id: v.id, lat: v.site.lat, lng: v.site.lng,
  } as RouteStop));
  const order = branch
    ? suggestRoute({ lat: branch.branchLat, lng: branch.branchLng }, stops)
    : [];
  const ranked = order.length
    ? order.map((id) => views.find((v) => v.id === id)!).filter(Boolean)
    : views;

  const completedToday = ds.jobCards.filter(
    (j) =>
      j.engineerUserId === employeeId &&
      j.submittedAt !== null &&
      new Date(j.submittedAt).toDateString() === now.toDateString(),
  );

  const nextScheduled = ds.scheduledVisits
    .filter((v) => new Date(v.dueDate) > now)
    .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="t-display-md text-text-hi">Today</h1>
        <p className="t-body-sm mt-0.5 text-text-mid">
          {formatDate(now)} · {ranked.length} {ranked.length === 1 ? "visit" : "visits"} in
          suggested route order
        </p>
      </div>

      {previewing ? (
        <p className="t-body-sm rounded-md border border-info/40 bg-info-bg px-3 py-2 text-info">
          You have no visits assigned. Showing the branch board so the field flow can be walked.
        </p>
      ) : null}

      {ranked.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="No visits assigned for today"
          body={
            nextScheduled
              ? `Your next scheduled visit is on ${formatDate(nextScheduled.dueDate)}.`
              : "Nothing is scheduled. New assignments appear here as soon as the service desk dispatches them."
          }
          action={
            <Link
              href="/field/attendance"
              className="t-body-sm inline-flex min-h-11 items-center rounded-md border border-line px-3 text-text-mid"
            >
              Mark attendance
            </Link>
          }
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {ranked.map((v, i) => {
            const ticket = ds.tickets.find((t) => t.id === v.id)!;
            const clock = D.slaClock(ticket, now);
            const tel = dialable(v.contactPhone ?? v.site.contactPhone);
            return (
              <li key={v.id}>
                <Panel className="overflow-hidden">
                  <div className="flex items-start gap-3 border-b border-line p-3">
                    <span
                      aria-hidden
                      className="t-mono grid size-7 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-text-mid"
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="t-body font-medium text-text-hi">{v.customerName}</p>
                      <p className="t-body-sm text-text-mid">
                        {v.site.name} · {v.site.district}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge tone={SEVERITY_TONE[v.severity]}>
                        {SEVERITY_LABEL[v.severity]}
                      </StatusBadge>
                      <StatusBadge tone={SLA_TONE[clock.state]}>
                        {clock.breached
                          ? `${formatOverrun(clock.overrunMs)} over`
                          : formatDurationHM(clock.remainingMs)}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 p-3">
                    <div>
                      <Overline>Machine</Overline>
                      <p className="t-body-sm text-text-hi">
                        {v.asset.model} ·{" "}
                        <span className="t-mono">{v.asset.serial}</span>
                      </p>
                      <p className="t-body-sm text-text-lo">{v.asset.locationInSite}</p>
                    </div>
                    <div>
                      <Overline>Reported</Overline>
                      <p className="t-body-sm text-text-mid">{v.problem}</p>
                    </div>
                    <p className="t-body-sm text-text-lo">
                      Logged {formatTime(new Date(v.loggedAtMs))} ·{" "}
                      {SLA_STATE_LABEL[clock.state]} · {v.slaRuleApplied}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-px border-t border-line bg-line">
                    {tel ? (
                      <a
                        href={`tel:${tel}`}
                        className="flex min-h-12 items-center justify-center gap-1.5 bg-surface-1 text-text-mid active:bg-surface-2"
                      >
                        <Phone className="size-4" aria-hidden />
                        <span className="t-body-sm">Call</span>
                      </a>
                    ) : (
                      <span className="flex min-h-12 items-center justify-center bg-surface-1 text-text-lo">
                        <span className="t-body-sm">No number</span>
                      </span>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${v.site.lat},${v.site.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-12 items-center justify-center gap-1.5 bg-surface-1 text-text-mid active:bg-surface-2"
                    >
                      <MapPin className="size-4" aria-hidden />
                      <span className="t-body-sm">Map</span>
                    </a>
                    <Link
                      href={`/field/job/${v.id}`}
                      className="flex min-h-12 items-center justify-center gap-1 bg-primary-600 text-white active:bg-primary-500"
                    >
                      <span className="t-body-sm font-medium">Start</span>
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ol>
      )}

      {completedToday.length > 0 ? (
        <section>
          <h2 className="t-overline mb-2 text-text-lo">Completed today</h2>
          <ul className="flex flex-col gap-2">
            {completedToday.map((j) => (
              <li
                key={j.id}
                className="flex items-center justify-between rounded-md border border-line bg-surface-1 px-3 py-2"
              >
                <span className="t-body-sm text-text-mid">{j.number}</span>
                <StatusBadge tone="ok">{j.outcome ?? "Submitted"}</StatusBadge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
