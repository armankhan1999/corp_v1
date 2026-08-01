"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/schemas/enums";
import {
  encodeSession, newSession, SESSION_COOKIE, STORAGE_NAMESPACE, landingFor,
} from "@/lib/rbac/session";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import { SimulatedBadge } from "@/components/patterns/primitives";

/** Rotating vertical accents so the persona grid reads as a system, not a list. */
const ACCENTS = [
  "var(--v-equipment)", "var(--v-service)", "var(--v-projects)", "var(--primary-500)",
];

interface Account {
  id: string; name: string; role: Role; roleLabel: string;
  branchId: string; branch: string; designation: string;
}

export function LoginPicker({ accounts, next }: { accounts: Account[]; next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  function signIn(a: Account) {
    setBusy(a.id);
    const now = Date.now();
    const session = newSession(
      { id: a.id, role: a.role, branchId: a.branchId, name: a.name }, now,
    );
    // Cookie so route handlers and middleware can enforce RBAC server-side (C-06);
    // localStorage mirror so the client keeps FR-M1-01's stated model.
    document.cookie = `${SESSION_COOKIE}=${encodeSession(session)}; path=/; max-age=86400; SameSite=Lax`;
    try {
      window.localStorage.setItem(`${STORAGE_NAMESPACE}.session`, JSON.stringify(session));
    } catch { /* storage disabled — cookie still carries the session */ }
    const dest = next && next.startsWith("/") ? next : landingFor(a.role);
    router.push(dest);
    router.refresh();
  }

  return (
    <section aria-labelledby="roles-heading" className="flex flex-col gap-4">
      <h1 id="roles-heading" className="t-heading-lg text-text-hi">
        Sign in as
      </h1>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a, i) => (
          <li key={a.id} className="pv-rise" style={{ animationDelay: `${Math.min(i * 22, 240)}ms` }}>
            <button
              type="button"
              onClick={() => signIn(a)}
              disabled={busy !== null}
              data-testid={`login-${a.role}`}
              style={{ ["--accent" as string]: ACCENTS[i % ACCENTS.length] }}
              className={cn(
                "panel lift accent-rail group flex w-full items-center gap-3 p-3.5 text-left",
                "hover:bg-surface-2",
                busy === a.id && "border-primary-500 bg-surface-2",
                busy !== null && busy !== a.id && "opacity-40",
              )}
            >
              <span
                aria-hidden
                className="grid size-11 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2 text-text-hi shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]"
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", letterSpacing: "0.02em" }}
              >
                {initials(a.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="t-body block truncate font-semibold text-text-hi">{a.roleLabel}</span>
                <span className="t-body-sm block truncate text-text-mid">{a.name}</span>
                <span className="t-body-sm block truncate text-text-lo">
                  {a.designation} · {a.branch}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="panel mt-2 flex flex-wrap items-center gap-3 px-4 py-3.5">
        <ShieldCheck className="size-4 text-text-lo" aria-hidden />
        <span className="t-body-sm text-text-mid">
          Single sign-on via Google Workspace or Microsoft 365 is a Phase 2 path.
        </span>
        <SimulatedBadge what="SSO (INT-09)" />
        <span className="t-body-sm text-text-lo">
          No password is validated in this prototype.
        </span>
      </div>
    </section>
  );
}
