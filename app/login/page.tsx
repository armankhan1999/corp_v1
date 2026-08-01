import { getDataset } from "@/lib/seed";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { LoginPicker } from "./LoginPicker";
import { COMPANY } from "@/lib/seed/catalog";

/** E1-S1 — twelve seeded demo accounts, each selectable in one click. */
export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; reason?: string }> }) {
  const sp = await searchParams;
  const ds = getDataset();
  const accounts = ds.users.map((u) => ({
    id: u.id, name: u.name, role: u.role, roleLabel: ROLE_LABEL[u.role],
    branchId: u.branchId,
    branch: ds.branches.find((b) => b.id === u.branchId)?.city ?? "—",
    designation: u.designation,
  }));

  return (
    <main className="min-h-dvh bg-surface-0 px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3 border-b border-line pb-6">
          <div className="flex items-baseline gap-3">
            <span
              className="t-display-md text-text-hi"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Pravaah
            </span>
            <span className="h-4 w-px bg-line-strong" aria-hidden />
            <span className="t-body-sm text-text-mid">{COMPANY.legalName}</span>
          </div>
          <p className="t-body-sm max-w-2xl text-text-mid">
            Unified operations &amp; intelligence platform. Prototype build — authentication is
            simulated and every external system is faithfully mocked. Choose a role to begin.
          </p>
          {sp.reason === "idle" ? (
            <p className="t-body-sm rounded-md border border-warn/40 bg-warn-bg px-3 py-2 text-warn">
              Your session was idle for 30 minutes and was ended. Sign in again to resume where you
              left off.
            </p>
          ) : null}
        </header>

        <LoginPicker accounts={accounts} next={sp.next} />

        <footer className="border-t border-line pt-5">
          <p className="t-body-sm text-text-lo">
            All seed data is fictional and contains no real personal data. Statutory positions are
            stated as at July 2026.
          </p>
        </footer>
      </div>
    </main>
  );
}
