import { cookies } from "next/headers";
import { getDataset } from "@/lib/seed";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import { serviceCtx } from "@/components/domain/service/project";
import { FieldAttendance } from "@/components/domain/people/FieldAttendance";
import * as D from "@/lib/derive";

export const dynamic = "force-dynamic";

/**
 * E9-S2 — field check-in with captured geolocation, a simulated selfie step and
 * the link to the job card being attended, which is what makes attendance
 * verifiable against work performed (VA-04).
 */
export default async function FieldAttendancePage() {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const ds = getDataset();
  const { now } = serviceCtx();

  const employee = ds.employees.find(
    (e) => e.id === ds.users.find((u) => u.id === session?.userId)?.employeeId,
  ) ?? ds.employees.find((e) => e.workLocationType === "FIELD")!;

  const todayKey = now.toISOString().slice(0, 10);
  const todays = ds.attendance.find(
    (a) => a.employeeId === employee.id && a.date.slice(0, 10) === todayKey,
  ) ?? null;

  const recent = ds.attendance
    .filter((a) => a.employeeId === employee.id)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 10)
    .map((a) => ({
      id: a.id, date: a.date, state: a.state,
      checkInAt: a.checkInAt, checkOutAt: a.checkOutAt,
      placeLabel: a.placeLabel, source: a.source,
      lateMark: a.lateMark, missingCheckOut: a.missingCheckOut,
      geofenceBreachKm: a.geofenceBreachKm,
      jobCardNumber: a.jobCardId
        ? ds.jobCards.find((j) => j.id === a.jobCardId)?.number ?? null
        : null,
    }));

  // Today's assigned visits give the engineer a job card to attach the check-in to.
  const assignments = ds.tickets
    .filter((t) => D.isOpenTicket(t) && t.assignedEngineerId === employee.id)
    .slice(0, 6)
    .map((t) => {
      const site = ds.sites.find((s) => s.id === t.siteId)!;
      const customer = ds.customers.find((c) => c.id === t.customerId)!;
      return {
        ticketId: t.id,
        ticketNumber: t.number,
        customerName: customer.tradeName,
        siteName: site.name,
        siteDistrict: site.district,
        lat: site.lat,
        lng: site.lng,
      };
    });

  return (
    <FieldAttendance
      employeeName={employee.name}
      employeeCode={employee.code}
      branchName={ds.branches.find((b) => b.id === employee.branchId)?.name ?? "—"}
      todayIso={ds.meta.today}
      seededToday={todays ? { state: todays.state, checkInAt: todays.checkInAt } : null}
      assignments={assignments}
      recent={recent}
    />
  );
}
