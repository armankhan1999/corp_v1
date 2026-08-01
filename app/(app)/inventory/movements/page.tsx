import { MovementsClient, type MovementsFocus } from "@/components/domain/inventory/MovementsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Parts issue — Pravaah",
};

const FOCUS: MovementsFocus[] = ["ALL", "CRITICAL", "ROUTINE", "SHORT"];

/**
 * E7-S3 — issue against a job card or a project, service-critical first.
 * The screen itself is a client surface because the ledger fold and the
 * mutation overlay both live in the browser; the server component's only job is
 * to turn the query string into a starting view so a link can deep-link a state.
 */
export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const raw = (one(sp.show) ?? "ALL").toUpperCase() as MovementsFocus;
  const focus: MovementsFocus = FOCUS.includes(raw) ? raw : one(sp.critical) === "1" ? "CRITICAL" : "ALL";

  return (
    <MovementsClient
      initialQuery={one(sp.q) ?? ""}
      initialLocation={one(sp.location) ?? ""}
      initialFocus={focus}
    />
  );
}
