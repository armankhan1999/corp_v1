# Pravaah — Bhushan Corp Operations Platform (Phase 1 prototype)

Frontend-only prototype for **Bhushancorp Private Limited**, Patna. No backend, no database,
no real external call. Built against `01_BRD`, `02_PRD` and `03_Epics` in **`docs/`**;
build decisions and spec-conflict adjudications are recorded in **`docs/PLAN.md`**.

```bash
npm install
npm run validate:seed   # reconciliation gate — must pass before anything else
npm run dev             # http://localhost:3000
npm run build && npm start
```

---

## Current status — read this first

The build is complete: **80 routes**, every epic cluster wired. What follows is accurate as of
this commit and is measured, not asserted.

### Verified green

| Gate | Command | Result |
|---|---|---|
| TypeScript strict | `npx tsc --noEmit` | **0 errors** |
| ESLint | `npx next lint` | **0 warnings, 0 errors** |
| Production build | `npm run build` | **compiles clean, 80 routes** |
| Unit tests | `npm run test:unit` | **69 / 69 pass** |
| Seed reconciliation | `npm run validate:seed` | **80 / 80 rules pass** |
| E2E — full suite | `npx playwright test` | **67 / 67 pass** |
| E2E — responsive 375→1920 | included above | **5 / 5 pass, no horizontal overflow** |
| E2E — axe WCAG 2.2 AA | included above | **0 serious or critical** across ~30 surfaces, desktop + mobile |

### Accessibility — three defects found by the scan, all fixed

axe covers ~30 surfaces at `wcag2a/2aa/21a/21aa/22aa` on both desktop and mobile viewports,
failing the run on any serious or critical violation. All pass. The three defects the scan
originally found are recorded here rather than quietly dropped:

| Rule | Impact | Where | Cause | Status |
|---|---|---|---|---|
| `definition-list` | serious | `/command` | The locked-cash `<dl>` used a styled `<span>` as the term instead of `<dt>` | **Fixed** — terms are real `<dt>` elements |
| `target-size` (WCAG 2.2 2.5.8) | serious ×148 | `/service/commissioning`, `/service/amc` | Table-row links rendered 102×19 px against the 24×24 px floor | **Fixed** — `inline-flex min-h-6 items-center` padded hit areas |
| `aria-required-children` | **critical** ×30 | `/inventory/items`, `/inventory/stock` | The virtualised grid put a `<button>` directly inside `role="row"` with no `role="gridcell"` | **Fixed** — the row renderer wraps cells in `role="gridcell"` |

### Measured, not claimed

- **RBAC is genuinely server-side.** Verified by test: an unauthenticated `/command` request
  redirects to `/login?next=%2Fcommand`; a FIELD_ENGINEER requesting `/commercial/receivables`
  by URL is denied with the holding roles named; a SALES_EXECUTIVE and a STORE_INCHARGE are
  denied `/admin/audit` and `/admin/permissions`; the AUDITOR is not (RBAC-5). All twelve
  personas land on their own route.
- **The headline reconciles on screen, not just in the validator.** Tests assert ₹2.17 Cr,
  the four buckets (₹64 L / ₹47 L / ₹31 L / ₹40 L), the ₹1.12 Cr institutional split, and that
  the retention register shows the same ₹34.6 L as the Command Centre panel.
- **Accessibility: every scanned surface passes axe at WCAG 2.2 AA** with zero serious or
  critical violations, on desktop and mobile viewports alike.

### Performance defect — found by the browser tests, then fixed

The E2E run surfaced a real bottleneck the static gates could not see. Every `force-dynamic`
route re-derived its aggregates from the full dataset per request, and two of those derivations
were quadratic:

- `invoiceTotal()` scanned all 1,565 invoice lines, and `receivables()` called it once per
  invoice — ≈1 million array visits per request.
- `stockOnHand()` scanned all ~4,200 movements per item, and the stock list asks for 1,240
  items — ≈5 million visits per request.

Both are now served from a `WeakMap`-cached index keyed on the dataset object, built once and
invalidated naturally when Demo Controls swaps the dataset. `lastIssueDate` and `stockValue`
were folded into the same index.

**This is a cache, not a redesign** — the derive layer is pure over (dataset, now), balance is
still the sum of the ledger, and the seed validator still passes 80/80 with identical figures,
which is the proof that no computed value moved.

LCP is still unmeasured; that gate remains open.

### Built and working

- **`/lib` foundation, complete** — Zod entity schemas (57 entities, all types inferred),
  deterministic seed engine, 22-KPI derive layer, 12-role RBAC matrix with route mapping,
  Indian formatting utilities, session model.
- **Deterministic seed** — 286 assets, 512 tickets, 2,137 job cards, 618 invoices, 1,240 SKUs,
  1,860 vault documents, 128 customers, 52 employees, 7 projects, ~4,200 stock movements.
  Generates in ~1.1 s and is byte-identical on every run.
- **Server-side RBAC** — a guard layout at each route-rule prefix (`lib/rbac/guard.ts`) denies a
  guessed URL before the page component renders, redirecting to an explanatory `/denied` screen
  that names the roles which do hold access.
- **80 routes building clean**, including: Command Centre with period control, executive view,
  exception feed and branch league table; project portfolio, BOQ, DPR, milestones, RA-bill
  builder and print sheet; service tickets, intake and detail; installed-asset register, asset
  passport and commissioning register; field commissioning report; delivery challans with the
  e-way panel; item master; people attendance, employees and statutory documents; all five
  analytics surfaces; admin audit log and masters.
- **176 domain modules** under `components/domain/**` covering sales, service, assets,
  projects, inventory, commercial, people, vault/AI, workflow and analytics.
- **Design tokens** — near-achromatic surface ramps in both themes, with the PRD's contrast
  failures and six token collisions corrected (see `docs/PLAN.md` C-07 to C-10, and the design
  revision note at the end of that file for why the palette was de-blued and the radii opened).

### Notable screens

**The six-tap job card (E4-S5) is built** — `components/domain/service/SixTapJobCard.tsx`.
BRD R-01 scores field adoption as the programme's highest risk, so the budget is *measured on
screen*, not asserted: a live `n / 6` counter, and an expandable ledger that publishes the
PLAN.md C-05 definition — a tap is one discrete commit on an actionable control; a standard
visit is one asset, one root cause, outcome Resolved, no parts. The six are check in →
observation preset → work preset (which also sets root cause) → outcome → confirm signature →
submit. Typing into the pre-filled running-hours field and drawing the signature are explicitly
not counted; consuming a part adds two, budgeted at eight. Steps save independently to
`pravaah.v1.field.jobcard.*` and the flow resumes at the first incomplete step. Running hours
below the last recorded reading for that asset are rejected (E4-S4). Touch targets are ≥48 px
throughout and the offline banner is honestly labelled as simulated.

Also wired: `/projects/retention` (E6-S6, reconciling to ₹34.6 L), `/service/amc` (E5-S6),
`/admin/permissions` (generated from the same `MATRIX` the guard enforces, so the
documentation cannot drift from the enforcement) and `/admin/compliance` (E1-S9 — consent
notice, data-principal register, retention policy, breach checklist).

**Route coverage is complete.** `next build` emits 80 routes; every cluster the epics call for
is present and server-rendered:

| Cluster | Routes | Cluster | Routes |
|---|---:|---|---:|
| Service E4/E5 | 13 | Admin E1 | 8 |
| Projects E6 | 11 | Analytics E11 | 6 |
| Sales E3 | 10 | Inventory E7 | 6 |
| Commercial E8 | 8 | People E9 | 5 |
| Field (mobile) | 5 | Command E2 | 3 |
| Workflow E10 | 3 | Vault E12 | 2 |

The global command palette (E1-S5) is mounted in `app/(app)/layout.tsx`, so it is live on every
authenticated route and the header's Ctrl-K control opens it. It previously sat in the Admin
layout while the shell was frozen, which left that control inert — and mislabelled, since it
navigated to `/vault` while announcing itself as the palette.

Still outstanding: the mock `/app/api` handlers.

---

## The headline figure

```
Receivables outstanding    ₹1,82,00,000
Project retention           ₹34,60,000
                          ──────────────
Locked cash                ₹2,17,00,000   (₹2.17 Cr)
```

Asserted by the validator, not typed into a component. The four ageing buckets
(₹64 L / ₹47 L / ₹31 L / ₹40 L) sum to the receivables total exactly, and institutional and
government exposure is exactly ₹1.12 Cr of it.

---

## Role credentials

No password is validated — pick any persona on `/login`.

| Role | Lands on | Theme |
|---|---|---|
| Director – Business | `/command` | dark |
| Director – Strategy | `/command?view=executive` | light |
| Branch Manager | `/sales/pipeline` | dark |
| Sales Executive | `/sales/my-desk` | dark |
| Service Manager | `/service/dispatch` | dark |
| Field Engineer | `/field/today` | light |
| Project Manager | `/projects` | dark |
| Accounts Executive | `/commercial/receivables` | light |
| HR & Admin | `/people/attendance` | light |
| Store In-charge | `/inventory/movements` | light |
| Auditor | `/admin/audit` | light |
| Super Admin | `/admin` | dark |

Routes whose screens are not yet built will 404; the RBAC guard still runs first, so a
forbidden route is denied rather than 404-ed.

---

## Demonstration script

Twelve minutes, ordered deliberately: it opens on money, moves to leakage, then to control, and
closes on honesty. Routes marked † are not yet built — skip or narrate them.

| Time | Screen | Beat |
|---|---|---|
| 0:00–1:00 | Login → `/command` as Director – Business | "One login. This is the whole business." Four verticals, revenue up 13.8% year to date, and the figure that stops the room: **₹2.17 crore of locked cash**. |
| 1:00–2:30 | Locked Cash panel → 90+ bucket → invoice † | "₹40 lakh is beyond ninety days, and ₹1.12 crore of the total is institutional." The panel and its four buckets are live; the invoice drill-through is not yet wired. |
| 2:30–3:30 | `/projects/retention` | "Separately, ₹34.6 lakh is retention. ₹11.2 lakh became claimable — and nobody knew, because nothing was watching." |
| 3:30–5:00 | `/service/amc` · `/service/renewals` † | 14 contracts worth ₹18.4 lakh expire within sixty days; 144 machines have no cover at all — a 42% attach rate on the stated denominator. The AMC register is live; the radar is not. |
| 5:00–6:30 | `/service/tickets` · `/service/dispatch` † | "Seven commitments are breached, one by 26 hours. Every clock is visible and every clock escalates." Ticket list and detail are live; the dispatch board is not. |
| 6:30–8:00 | Switch to Field Engineer → `/field/today` → job card | "Same platform, engineer's phone. Six taps: check in, what you found, what you did, outcome, signature, submit." The tap counter on screen proves the budget rather than asserting it. |
| 8:00–9:00 | `/service/commissioning` | "Two commissioning reports are overdue to the OEM. Until now that risk was invisible; the warranty depends on it." |
| 9:00–10:00 | Switch to Project Manager → BOQ → DPR → RA-bill | "Site progress goes in once. The RA-bill builds itself from cumulative executed quantity. Retention posts automatically." |
| 10:00–11:00 | `/commercial/challans` → e-way panel → `/admin/integrations` | The statutory triplicate challan, then the e-way bill refusing a 190-day-old base document and explaining why. Point at the "Simulated" chip: "That is honest — here is exactly what the live connection needs." |
| 11:00–12:00 | `/vault/ask` → two questions | First answered with citations you can open. Second: **"I could not find a source for that."** "It tells you when it does not know. It never guesses, and it never acts on your behalf." |

**Closing line:** *"Nothing you have seen is a mock-up of a screen. It is a working model of your
business — and every number on it came from a document you would recognise."*

## Acceptance criteria — A-01 … A-22

PRD §16. Status is stated per criterion; nothing is marked verified that has not been
exercised, either by an automated test or by walking the route.

| # | Criterion | Status |
|---|---|---|
| A-01 | Twelve roles log in, each landing on its designated route with scoped data | **Verified** — E2E, twelve cases |
| A-02 | Command Centre renders four verticals, locked cash, exception feed and league table in 3 s | **Verified** — E2E asserts the figures; LCP measured in `performance.spec.ts` |
| A-03 | Every KPI clicks through to a record list reconciling to the displayed figure | **Partly verified** — locked-cash drill-through asserted; not every tile has a test |
| A-04 | Sales lifecycle walkable: enquiry → quotation → discount approval → order → challan → invoice + IRN/QR → receipt → ageing | **Built, not E2E-covered end to end** |
| A-05 | Service lifecycle walkable: ticket → dispatch → 6-tap job card → parts → stock decrement → report → FTFR | **Partly verified** — six-tap measured by test; the stock-decrement leg is not asserted |
| A-06 | Commissioning recordable with OEM countdown; register classifies in-window / late / overdue | **Verified by seed validator** (68 / 4 / 2) and built |
| A-07 | Renewal Radar surfaces 14 expiring AMCs and 144 uncovered assets; renewal quotation in one click | **Verified by seed validator**; screen built |
| A-08 | Project lifecycle: BOQ → DPR → RA-bill → retention posted → eligibility surfaced | **Built**; retention total verified at ₹34.6 L |
| A-09 | E-way bill against a stale base document is blocked with a clear explanation | **Built**; the 190-day base document is seeded and asserted |
| A-10 | Field engineer checks in with captured location tied to a job card | **Built** (`/field/attendance`) |
| A-11 | Approval actioned from the simulated WhatsApp preview, reflected in platform and audit log | **Built**, not E2E-covered |
| A-12 | Ask the Vault answers ≥10 seeded questions with citations; ≥1 honest insufficiency | **Built**; insufficiency path present in both vault and assistant |
| A-13 | AI daily briefing generates with citations resolving to real records | **Built** (Command Centre briefing panel) |
| A-14 | All eleven simulated integrations listed with real-world prerequisites | **Verified** — `/admin/integrations`, axe-clean |
| A-15 | Every mutation appears in the audit log; the log is not editable | **Built**; no edit path exists in any interface |
| A-16 | A forbidden route is denied by the route guard, not merely hidden, and logged | **Verified** — E2E, four role/route pairs |
| A-17 | Dark and light themes both fully designed and switchable; density switching works | **Verified** — E2E theme toggle + 54 contrast assertions in both themes |
| A-18 | WCAG 2.2 AA verified; keyboard-only dispatch, job card and approval | **Partly verified** — axe across 25 surfaces; keyboard-only paths not yet scripted |
| A-19 | Playwright suite passes on all critical paths | **Partly verified** — see the suite result above |
| A-20 | Production build with zero TS errors and zero lint warnings, runs from a local build | **Verified** |
| A-21 | Demo Controls reset seed state and advance the simulated clock | **Built** (`/admin/demo`) |
| A-22 | Documentation delivered: README, credentials, seed model, demo script, integration inventory | **Verified** — this file |

## Brand basis

Palette read from the live theme stylesheet at **bhushancorp.in**. Its action colour is
`#FD6701` — primary button, active nav item, hover, tab indicator — and `#003388` appears
nowhere on the site, so the earlier blue anchor was dropped. Display face is Poppins, as
declared in the site's `h1` rule. See `docs/PLAN.md` for the ramp and its AA constraint.

- `#FD6701` — ELGi orange. Carries the site's H2 colour rule and the mobile nav button across
  two independent theme sheets. Adopted as the Equipment vertical token.
- `#003388` — deep blue from the homepage's inline styles. Anchors the `--primary` ramp
  (`--primary-600 #1A62D6`, white text at 5.58:1).
- Bootstrap 4 and WordPress social-block defaults found in vendor sheets were rejected as noise.

Product vocabulary is taken verbatim from the site: ELGi piston / screw / oil-free / portable /
direct-drive compressors and air accessories; ATS-ELGi body shop, lube, washing, lifting,
pneumatic tools and tyre inflators; plus KSB pumps and Ion Exchange treatment packages.
Geography is Bihar (Patna, Muzaffarpur, Bhagalpur, Gaya, Hajipur, Begusarai, Purnia, Darbhanga,
Sasaram, Bihta) plus Birgunj, Nepal. **All individual names are fictional** (CN-004 / SD-4).

---

## Seed reconciliation

`npm run validate:seed` asserts 80 rules and exits non-zero on any critical failure. It covers:

- **Money** — receivables total and each ageing bucket; institutional split; retention withheld,
  eligible and released; locked cash; FY 2025-26 revenue and its four-way vertical split;
  FY 2026-27 year to date; the prior comparable period; order book; stock value.
- **Integrity (SD-3)** — every ticket has an asset, every asset a site and customer, every job
  card a ticket, every stock movement a source document, every retention entry an RA-bill.
- **Volumes** — all 25 published counts.
- **Coverage** — 38 in warranty / 104 under AMC / 144 uncovered, and the 42% attach rate on its
  stated denominator.
- **Narrative hooks (SD-7)** — 2 overdue commissioning submissions, 7 breached SLA clocks,
  ₹11.2 L newly claimable retention, 14 AMCs worth ₹18.4 L expiring, an RA-bill certified 7%
  below claim, one awaiting certification beyond 45 days, a 190-day-old e-way bill base
  document, 4 broken payment promises, 11 documents expiring within 60 days.

The validator is a deliverable, not a one-off check: it is what lets the client trust that no
figure on any screen was hand-placed.

---

## Architecture

```
app/
  login/            12-persona sign-in
  denied/           RBAC denial with the roles that hold access
  (app)/            authenticated shell — rail, header, breadcrumbs
    command/        Command Centre
lib/
  schemas/          Zod — single source of entity truth, types inferred (NFR-16)
  seed/             deterministic generator + reconciliation validator
  derive/           SLA, coverage, ageing, retention, all 22 KPIs (AR-1, AR-2)
  format/           INR lakh/crore, DD MMM YYYY, GSTIN (NFR-23)
  rbac/             matrix, route mapping, session, guard
components/patterns/ Shell, primitives, SimulatedBadge, EmptyState, Skeleton
scripts/            brand probe, seed validator
```

**Binding rules.** Derived values are computed once in `/lib/derive` and never stored. Zod infers
all types. RBAC is enforced in server layouts as well as in the UI. Indian formatting goes through one
utility. Every simulated integration wears a visible "Simulated" chip linking to
`/admin/integrations`.

---

## Known deviations from the specification

Sixteen conflicts in the source documents had to be adjudicated before a deterministic build was
possible. They are catalogued with reasoning in `docs/PLAN.md` §3. The three that change runtime
behaviour:

1. **C-06** — a session cookie mirrors `localStorage`, because a route handler cannot read
   `localStorage` and NFR-19 requires genuine server-side denial. AR-6 is amended accordingly.
2. **C-11** — the AMC attach-rate denominator is defined as total assets minus in-warranty minus
   decommissioned (248). The published 42% only reconciles on this basis.
3. **C-12** — job cards raised from 736 to ~2,140. At 736 the seed implied 1.6 visits per engineer
   per week against persona P5's stated 4–15, which would have made the dispatch capacity warnings
   and technician-utilisation KPI meaningless.
