import Link from "next/link";
import { cookies } from "next/headers";
import { ShieldX } from "lucide-react";
import { decodeSession, SESSION_COOKIE, landingFor } from "@/lib/rbac/session";
import { rolesHolding, type Capability } from "@/lib/rbac/matrix";
import { ROLE_LABEL } from "@/lib/schemas/enums";

/**
 * E1-S3 / E14-S2 — a denied route explains the restriction, names the roles that
 * hold access, and offers the user's own landing route. Never a blank screen.
 */
export default async function DeniedPage({
  searchParams,
}: { searchParams: Promise<{ path?: string; cap?: string }> }) {
  const sp = await searchParams;
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const holders = sp.cap ? rolesHolding(sp.cap as Capability) : [];

  return (
    <main className="grid min-h-dvh place-items-center bg-surface-0 px-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)] p-6">
        <div className="flex items-start gap-3">
          <ShieldX className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div className="min-w-0">
            <h1 className="t-heading-lg text-text-hi">Access not permitted</h1>
            <p className="t-body-sm mt-2 text-text-mid">
              Your role{session ? ` — ${ROLE_LABEL[session.role]}` : ""} does not have access to{" "}
              <span className="t-mono text-text-hi">{sp.path ?? "this route"}</span>.
            </p>
            {holders.length > 0 ? (
              <p className="t-body-sm mt-2 text-text-mid">
                This area is available to:{" "}
                <span className="text-text-hi">
                  {holders.map((r) => ROLE_LABEL[r]).join(", ")}
                </span>
                .
              </p>
            ) : null}
            <p className="t-body-sm mt-3 text-text-lo">
              The attempt has been written to the audit log with the requested path.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href={session ? landingFor(session.role) : "/login"}
                className="t-body-sm rounded-md bg-primary-600 px-3 py-1.5 text-white hover:bg-primary-500"
              >
                Go to my landing screen
              </Link>
              <Link
                href="/login"
                className="t-body-sm rounded-md border border-line px-3 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                Switch role
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
