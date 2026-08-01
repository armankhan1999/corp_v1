"use client";

import * as React from "react";
import { Camera, Check, Clock, LogIn, LogOut, MapPin, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatTime, enumLabel } from "@/lib/format";
import { Overline, Panel, PanelHeader, SimulatedBadge, StatusBadge } from "@/components/patterns/primitives";
import type { AttendanceState } from "@/lib/schemas/enums";

const STORE_KEY = "pravaah.v1.field.attendance";

interface Assignment {
  ticketId: string; ticketNumber: string; customerName: string;
  siteName: string; siteDistrict: string; lat: number; lng: number;
}
interface RecentRow {
  id: string; date: string; state: AttendanceState;
  checkInAt: string | null; checkOutAt: string | null;
  placeLabel: string | null; source: string;
  lateMark: boolean; missingCheckOut: boolean;
  geofenceBreachKm: number | null; jobCardNumber: string | null;
}
interface Capture {
  checkInAt: string | null;
  checkOutAt: string | null;
  lat: number | null;
  lng: number | null;
  place: string | null;
  selfie: boolean;
  ticketId: string | null;
  geofenceKm: number | null;
}

const BLANK: Capture = {
  checkInAt: null, checkOutAt: null, lat: null, lng: null,
  place: null, selfie: false, ticketId: null, geofenceKm: null,
};

const STATE_TONE: Record<string, "ok" | "info" | "warn" | "neutral"> = {
  PRESENT: "ok", ON_FIELD: "info", ON_LEAVE: "warn",
  ABSENT: "warn", HALF_DAY: "warn", WEEK_OFF: "neutral", HOLIDAY: "neutral",
};

/** Straight-line distance, used only to flag a geofence breach honestly. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function FieldAttendance({
  employeeName, employeeCode, branchName, todayIso, seededToday, assignments, recent,
}: {
  employeeName: string;
  employeeCode: string;
  branchName: string;
  todayIso: string;
  seededToday: { state: AttendanceState; checkInAt: string | null } | null;
  assignments: Assignment[];
  recent: RecentRow[];
}) {
  const now = React.useMemo(() => new Date(todayIso), [todayIso]);
  const [cap, setCap] = React.useState<Capture>(BLANK);
  const [hydrated, setHydrated] = React.useState(false);
  const [locating, setLocating] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) setCap({ ...BLANK, ...(JSON.parse(raw) as Capture) });
    } catch { /* storage unavailable */ }
    setHydrated(true);
  }, []);

  const save = (patch: Partial<Capture>) =>
    setCap((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch { /* storage unavailable */ }
      return next;
    });

  const target = assignments.find((a) => a.ticketId === cap.ticketId) ?? null;

  function capturePosition() {
    setLocating(true);
    const finish = (lat: number, lng: number, label: string) => {
      const breach = target ? km({ lat, lng }, target) : null;
      save({
        lat, lng, place: label,
        geofenceKm: breach !== null && breach > 0.5 ? Math.round(breach * 10) / 10 : null,
      });
      setLocating(false);
    };
    if (!navigator.geolocation) {
      // Fall back to the assigned site so the flow is walkable indoors.
      const t = target ?? assignments[0];
      finish(t?.lat ?? 25.6093, t?.lng ?? 85.1376, t ? `${t.siteName}, ${t.siteDistrict}` : "Patna");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => finish(pos.coords.latitude, pos.coords.longitude, target ? `${target.siteName}, ${target.siteDistrict}` : "Current location"),
      () => {
        const t = target ?? assignments[0];
        finish(t?.lat ?? 25.6093, t?.lng ?? 85.1376, t ? `${t.siteName}, ${t.siteDistrict}` : "Patna");
      },
      { timeout: 6000 },
    );
  }

  const canCheckIn = cap.lat !== null && cap.selfie && !cap.checkInAt;
  const checkedIn = cap.checkInAt !== null;

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3">
        <div className="pv-skeleton h-24 w-full" />
        <div className="pv-skeleton h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="t-display-md text-text-hi">Attendance</h1>
        <p className="t-body-sm mt-0.5 text-text-mid">
          {employeeName} · <span className="t-mono">{employeeCode}</span> · {branchName}
        </p>
        <p className="t-body-sm text-text-lo">{formatDate(now)}</p>
      </div>

      {/* Today */}
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Overline>Today</Overline>
          {checkedIn ? (
            <StatusBadge tone="info">On field since {formatTime(cap.checkInAt!)}</StatusBadge>
          ) : seededToday ? (
            <StatusBadge tone={STATE_TONE[seededToday.state] ?? "neutral"}>
              {enumLabel(seededToday.state)}
            </StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Not marked</StatusBadge>
          )}
        </div>

        {!checkedIn ? (
          <div className="mt-4 flex flex-col gap-3">
            {/* Step 1 — which visit this check-in belongs to (VA-04) */}
            <div>
              <Overline>Attending</Overline>
              <p className="t-body-sm mb-2 mt-0.5 text-text-lo">
                Linking the check-in to a job card is what makes it verifiable against work done.
              </p>
              {assignments.length === 0 ? (
                <p className="t-body-sm rounded-md border border-line bg-surface-2 px-3 py-2 text-text-mid">
                  No visits assigned today. You can still mark office attendance below.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignments.map((a) => (
                    <button
                      key={a.ticketId}
                      type="button"
                      onClick={() => save({ ticketId: a.ticketId, lat: null, lng: null, place: null, geofenceKm: null })}
                      className={cn(
                        "flex min-h-12 w-full items-center justify-between gap-3 rounded-md border px-3 text-left transition-colors",
                        cap.ticketId === a.ticketId
                          ? "border-primary-500 bg-primary-100"
                          : "border-line bg-surface-2 active:bg-surface-3",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="t-body block truncate text-text-hi">{a.customerName}</span>
                        <span className="t-body-sm block truncate text-text-mid">
                          {a.siteName} · {a.siteDistrict}
                        </span>
                      </span>
                      <span className="t-mono shrink-0 text-text-lo">{a.ticketNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 2 — location */}
            <div>
              <Overline>Location</Overline>
              {cap.lat !== null ? (
                <div className="mt-1 rounded-md border border-line bg-surface-2 p-3">
                  <p className="t-body-sm flex items-center gap-1.5 text-text-hi">
                    <MapPin className="size-3.5 text-ok" aria-hidden />
                    {cap.place}
                  </p>
                  <p className="t-mono mt-0.5 text-text-lo">
                    {cap.lat.toFixed(5)}, {cap.lng!.toFixed(5)}
                  </p>
                  {cap.geofenceKm !== null ? (
                    <p className="t-body-sm mt-2 flex items-start gap-1.5 text-warn">
                      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {cap.geofenceKm} km from the expected site. The check-in is accepted and
                      flagged as an exception for HR to review.
                    </p>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={capturePosition}
                  disabled={locating}
                  className="mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface-2 text-text-hi active:bg-surface-3 disabled:opacity-50"
                >
                  <MapPin className="size-4" aria-hidden />
                  <span className="t-body">{locating ? "Capturing…" : "Capture my location"}</span>
                </button>
              )}
            </div>

            {/* Step 3 — simulated selfie */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <Overline>Photo verification</Overline>
                <SimulatedBadge what="Biometric / geo attendance (INT-07)" />
              </div>
              <button
                type="button"
                onClick={() => save({ selfie: !cap.selfie })}
                className={cn(
                  "mt-1 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border transition-colors",
                  cap.selfie
                    ? "border-ok/50 bg-ok-bg text-ok"
                    : "border-line bg-surface-2 text-text-hi active:bg-surface-3",
                )}
              >
                {cap.selfie ? <Check className="size-4" aria-hidden /> : <Camera className="size-4" aria-hidden />}
                <span className="t-body">{cap.selfie ? "Photo captured" : "Take photo"}</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!canCheckIn}
              onClick={() => save({ checkInAt: new Date(todayIso).toISOString() })}
              className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary-600 font-medium text-white active:bg-primary-500 disabled:opacity-40"
            >
              <LogIn className="size-4" aria-hidden />
              Check in
            </button>
            {!canCheckIn ? (
              <p className="t-body-sm text-text-lo">
                Capture your location and photo before checking in.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="t-overline text-text-lo">Checked in</dt>
                <dd className="t-body text-text-hi">{formatTime(cap.checkInAt!)}</dd>
              </div>
              <div>
                <dt className="t-overline text-text-lo">Location</dt>
                <dd className="t-body text-text-hi">{cap.place ?? "—"}</dd>
              </div>
              {target ? (
                <div className="col-span-2">
                  <dt className="t-overline text-text-lo">Linked to</dt>
                  <dd className="t-body text-text-hi">
                    {target.customerName} · <span className="t-mono">{target.ticketNumber}</span>
                  </dd>
                </div>
              ) : null}
            </dl>
            {cap.checkOutAt ? (
              <p className="t-body-sm flex items-center gap-1.5 rounded-md border border-ok/40 bg-ok-bg px-3 py-2 text-ok">
                <Check className="size-3.5" aria-hidden />
                Checked out at {formatTime(cap.checkOutAt)}. Day complete.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => save({ checkOutAt: new Date().toISOString() })}
                className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-line bg-surface-2 text-text-hi active:bg-surface-3"
              >
                <LogOut className="size-4" aria-hidden />
                Check out
              </button>
            )}
            <button
              type="button"
              onClick={() => { window.localStorage.removeItem(STORE_KEY); setCap(BLANK); }}
              className="t-body-sm min-h-11 rounded-md border border-line text-text-lo"
            >
              Reset today (demo)
            </button>
          </div>
        )}
      </Panel>

      {/* History */}
      <Panel>
        <PanelHeader title="Recent" sub="Your last ten recorded days." />
        <ul className="flex flex-col">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="t-body-sm block text-text-hi">{formatDate(r.date)}</span>
                <span className="t-body-sm block truncate text-text-lo">
                  {r.checkInAt ? `${formatTime(r.checkInAt)} – ${r.checkOutAt ? formatTime(r.checkOutAt) : "—"}` : "—"}
                  {r.placeLabel ? ` · ${r.placeLabel}` : ""}
                  {r.jobCardNumber ? ` · ${r.jobCardNumber}` : ""}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge tone={STATE_TONE[r.state] ?? "neutral"}>{enumLabel(r.state)}</StatusBadge>
                {r.lateMark ? <StatusBadge tone="warn">Late</StatusBadge> : null}
                {r.missingCheckOut ? <StatusBadge tone="warn">No check-out</StatusBadge> : null}
                {r.geofenceBreachKm !== null ? (
                  <StatusBadge tone="warn">{r.geofenceBreachKm} km off site</StatusBadge>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="t-body-sm flex items-center gap-1.5 border-t border-line px-4 py-3 text-text-lo">
          <Clock className="size-3.5" aria-hidden />
          Payroll computation sits outside this platform. Attendance here is the input to it.
        </p>
      </Panel>
    </div>
  );
}
