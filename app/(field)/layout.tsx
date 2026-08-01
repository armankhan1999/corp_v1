import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarDays, ClipboardCheck, Fingerprint, Wrench } from "lucide-react";
import { decodeSession, SESSION_COOKIE, isExpired } from "@/lib/rbac/session";
import { initials } from "@/lib/format";

/**
 * AR-10 — field routes use a separate layout: single column, reduced chrome,
 * larger touch targets. `data-shell="field"` lifts the row height and padding
 * tokens regardless of the user's density preference (globals.css).
 */
export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  // See app/(app)/layout.tsx — the per-route guard beneath this one knows the
  // requested path and redirects with `?next=`; this layout does not.
  if (!session) return <>{children}</>;
  if (isExpired(session, Date.now())) redirect("/login?reason=idle");

  const tabs = [
    { href: "/field/today", label: "Today", icon: CalendarDays },
    { href: "/field/attendance", label: "Attendance", icon: Fingerprint },
    { href: "/field/commissioning", label: "Commissioning", icon: ClipboardCheck },
  ];

  return (
    <div data-shell="field" className="flex min-h-dvh flex-col bg-surface-0">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface-1 px-4">
        <Wrench className="size-4 shrink-0 text-v-service" aria-hidden />
        <span
          className="text-text-hi"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.0625rem" }}
        >
          Pravaah Field
        </span>
        <Link
          href="/login"
          className="ml-auto flex min-h-11 items-center gap-2 rounded-md border border-line px-2 text-text-mid"
          aria-label="Switch role"
        >
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-md bg-surface-3 text-[0.625rem]"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {initials(session.name)}
          </span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 p-4">{children}</main>

      <nav
        aria-label="Field sections"
        className="sticky bottom-0 z-20 grid grid-cols-3 gap-px border-t border-line bg-line"
      >
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 bg-surface-1 text-text-mid active:bg-surface-2"
          >
            <t.icon className="size-5" aria-hidden />
            <span className="t-body-sm">{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
