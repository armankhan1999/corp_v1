# Pravaah — Build Plan

**Project:** Unified Operations & Intelligence Platform — Bhushancorp Private Limited, Patna
**Scope:** Phase 1, high-fidelity frontend prototype. No backend, no database, no real external call.
**Stack:** Next.js 15.5 (App Router) · React 19 · TypeScript strict · Tailwind v4 · restyled shadcn/ui · TanStack Query/Table/Virtual · Zod · Recharts · Playwright · axe-core
**Simulated today:** 31 July 2026 (Friday), FY 2026-27

---

## 1. Source of truth and precedence

Per `00_README_Documentation_Index.md` §7:

1. `03_Epics_User_Stories` — the Given/When/Then acceptance criteria **are the contract**. Build to satisfy the AC, not the description.
2. `02_PRD` — for anything the stories do not specify: tokens, component behaviour, data-model fields, RBAC cells, seed volumes, folder structure, architectural rules.
3. `01_BRD` — for adjudicating ambiguity. A design choice that cannot be justified against a business requirement is the wrong choice.

Extracted and treated as binding: **14 epics · 92 stories (67 P0 / 22 P1 / 3 P2) · 560 points · 216 functional requirements · 63 screens (+6 list routes, see §3 conflict C-15) · 36 entity slots (~57 real entities) · 12-role RBAC matrix · 25 NFRs · 11 simulated integrations · 10 AI guardrails · 22 acceptance criteria · notification & escalation matrix (34 events) · 11 interaction states · 11 seeded narrative hooks · the 12-minute demonstration script.**

---

## 2. Brand extraction — evidence from bhushancorp.in

Probed live on 01 Aug 2026 (`pravaah/scripts/brand-probe.mjs`, `brand-probe2.mjs`): homepage HTML, 11 linked stylesheets, footer logo bitmap decoded in-process.

| Finding | Evidence | Verdict |
|---|---|---|
| `#fd6701` **ELGi orange** | `color:#fd6701!important` on the site's 30px/600 headings (sheet `dh6woi1t`); `.slicknav_btn{background-color:#fd6701}` (sheet `kkwvw7bg`). Two independent theme sheets. | **Genuine brand accent.** Adopted. |
| `#003388` deep blue | Inline style attributes in homepage HTML (2 uses). HSL 222/100/27. | **Genuine brand blue.** Adopted as the `--primary` anchor. |
| `#007bff · #dc3545 · #28a745 · #ffc107 · #17a2b8` | Exact Bootstrap 4 defaults, in vendor sheets. | Framework noise — **rejected.** |
| `#0757fe · #1ea0c3` | WordPress `wp-social-link-behance` / `-bandcamp` block defaults. | Noise — **rejected.** |
| `#fc3116` | MasterSlider `.ms-skin-contrast` tooltip default. | Noise — **rejected.** |
| Footer logo PNG | 180×180 indexed PNG, decoded: 4,391 opaque pixels, all `#f8f8f8`. | No usable colour. Wordmark set in Sora 700 per PRD §11.6. |
| Theme name | `ELGi-Bhushan` / `ELGi-Master` | Confirms the dealership identity is ELGi-led. |

**Product lines confirmed verbatim from the site** (used for all seed vocabulary):
ELGi — Piston Compressors · Electric Lubricated Screw Compressors · Portable Compressors · Oil Free Compressors · Direct Drive Compressors · Air Accessories.
ATS-ELGi — Body Shop Equipment · Lube Equipment · Washing Equipment · Lifting Equipment · Pneumatic Tools · Tyre Inflators.
Services — Service Appointments, Rental Service. History — "The journey of Bhushan International started in 1985 with a vision to create employment in Bihar."
Address — 2nd Floor, B-3, Grand Shere – II, Exhibition Road, Patna, Bihar-800001. Phone — +91 612 2320269 / 2320956 / +91 99559 97458.

**Palette decision.** `--primary` is anchored to the sampled `#003388` hue (217–222), lifted for dark-UI legibility. The evidenced `#fd6701` becomes the **Equipment / compressed-air vertical** token — which also resolves conflict C-07 below, where the PRD had `--v-air` set to the identical hex as `--warn`. Contrast verified: white on `--primary-600 #1A62D6` = 5.58:1; the button against `--surface-0` = 3.46:1; `#FD6701` on `--surface-1` = 6.14:1.

---

## 3. Spec conflict register — adjudications

A line-by-line read of all four documents surfaced 16 conflicts that block a deterministic build. Each is resolved here under the §1 precedence rule. **These adjudications are binding on every agent.**

| # | Conflict | Adjudication |
|---|---|---|
| C-01 | Epic renumbering (M4 split into E4+E5) never propagated: BRD §16 and PRD §4/§20 point to the wrong epic for everything ≥E5. | Use the **Epics doc numbering** (E1–E14) everywhere. The Epics traceability matrix is correct; the two parents are stale. |
| C-02 | Five priority inversions: P0 stories depend on P1/P2 stories (E3-S6→E11-S1; E9-S4→E11-S1; E11-S2→E11-S1; E10-S4→E10-S3→E10-S1; E13-S4→E13-S1). | **Promote E11-S1, E10-S1, E10-S3, E13-S1 to P0.** Real P0 set = 71 stories. All are built regardless. |
| C-03 | De-scope order drops E13-S1 (orphaning P0 E13-S4) and E14-S6 (failing A-21, A-22). | Not exercised — everything is built. Recorded so the client's v1.1 re-cut fixes the order. |
| C-04 | PRD §18 gates A-01…A-04 at end of S2, but A-02 needs E2-S3 (S5), A-03 needs E12-S1 (S5), A-04 needs all of E8 (S5). | Gate is unachievable as written. Build order follows **dependency**, not the PRD sprint table. |
| C-05 | Six-tap budget defined three ways: E4-S5 AC says "no parts consumed"; A-05 and the demo script both include a part. | **E4-S5 AC wins** (stories > PRD). Definition published on-screen: a *tap* is one discrete pointer/keyboard commit; a *standard visit* is one asset, one root cause, outcome Resolved, no parts. A **live tap counter** is rendered in the job card so the claim is measurable, not asserted. A separate 8-tap path covers the with-parts case demonstrated in the script. |
| C-06 | `localStorage` session (FR-M1-01, AR-6) cannot be read by a route handler, yet NFR-19/AR-4/RBAC-1 demand server-side denial. | **Mirror the session into a `pravaah.v1.session` cookie** alongside `localStorage`. AR-6 amended (documented). Server components read the cookie, so a guessed URL is genuinely denied server-side and logged. Enforcement began as Edge middleware and now lives in guard layouts (`lib/rbac/guard.ts`) — see the deployment note below. |
| C-07 | Six token collisions: `--v-air`=`--warn`=`--dv-3`; `--sla-comfortable`=`--ok`; `--sla-breached`=`--danger`; `--info`=`--primary-500`=`--dv-1`; `--v-water`=`--dv-2`; `--v-project`=`--dv-4`. Contradicts PRD §11.2 colour rules 1 and 2. | **Separate ramps.** Verticals get their own scale (air = evidenced `#FD6701`), semantics their own, SLA its own 4 distinct steps, charts an independent 8-colour `--dv-*` ramp. |
| C-08 | Published dark palette fails its own AA rule (NFR-09, E1-S4, E14-S3): `--text-lo` 3.84:1, `--text-inv` on `--primary-600` 3.41:1, `--danger`-on-tint 3.84:1, `--info`-on-tint 4.05:1, `--ok`-on-tint 4.29:1. | **Corrected tokens.** `--text-lo` → `#7C8899`; solid-accent text → white; tint backgrounds darkened. Every pair asserted by a Vitest contrast unit test so regressions fail the build. |
| C-09 | Light theme declares only surfaces/text/3 primary steps, with semantics left as a prose note. | **Light theme fully specified** to the same token count as dark, same AA test applied. |
| C-10 | Vertical enum is EQUIPMENT_SALES/SERVICE_AMC/PROJECTS/RENTAL, but colour tokens are air/water/project/garage/rental — no token for Service & AMC, three for Equipment. | Four **vertical** tokens matching the enum; air/water/garage retained as **product-line** sub-tokens used only inside Equipment Sales breakdowns. |
| C-11 | 42% AMC attach rate is not derivable: 104/286 = 36.4%, 144 uncovered = 50.3% uncovered. Only 104/(286−38 in-warranty) = 41.9% gives 42%. K-10's "eligible" is undefined. | **K-10 denominator = total assets − in-warranty − decommissioned (248).** Printed in the on-screen formula disclosure so the number defends itself. Both figures shown: "42% attach · 144 uncovered". |
| C-12 | Seed 736 job cards / 12 months / 9 engineers = **1.6 visits/engineer/week**, vs persona P5's 4–15. Starves dispatch capacity warnings and makes K-08 utilisation absurd. | **Job cards raised to 2,140** (≈4.6/engineer/week, bottom of persona range). All dependent aggregates (FTFR 78%, parts consumption 61%) recomputed against the new base. Ticket count held at 512 per spec; multi-visit ratio absorbs the difference. |
| C-13 | 9 service-critical items vs ~113 repeat visits — too thin to draw the parts→FTFR relationship E12-S3 requires. | **28 parts-driven revisits seeded** across 9 service-critical items, so the stock-out↔FTFR chart has real signal. |
| C-14 | 12 Nepal export transactions seeded, `EXPORT_ZERO_RATED` enum exists, but FR-M7-04/E8-S2 derive tax only as intra-state vs inter-state. | **Third derivation branch added**: place of supply outside India → zero-rated export under LUT, no IRN, e-way bill required to the border. Shown in the derivation panel. |
| C-15 | Navigation exposes 6 list routes the 63-screen inventory never counts (job cards, quotations, orders, invoices, challans, e-way bills). | **69 screens built.** The 63 named screens plus the 6 orphan list routes, so no nav item dead-ends. |
| C-16 | Seven FRs have no story: FR-M7-10 credit/debit notes (load-bearing — the outstanding formula subtracts them), FR-M5-16 project cost / BR-031, FR-M3-22 sales targets (league table needs them), FR-M6-14 stock count (yet "stock adjustment" is an approval type), FR-M5-20 O&M, FR-M1-20 session timeout, FR-M8-12 holiday calendar. | **All seven built.** Assigned to the owning wave agent as `X-` items in §6. |

Minor corrections also applied: exception taxonomy unified to a **single 14-type enum** (it was defined four times with different membership across FR-M2-06, E2-S4, E8-S3, E10-S2); Auditor made the only non-admin role with audit-log access per RBAC-5 (matrix had granted DB/DS read); DS granted the 5 missing cells its "full visibility" scope implies; office check-in granted to AC/SE/ST (matrix left AC with no attendance access at all); RBAC-2 amended to except the league table per E2-S5.

---

## 4. Architecture

Per PRD §13.2/§13.3. **`/lib` is written in Wave 1 only.** W2–W4 agents read it and never modify it — that is what makes AR-1 and AR-2 structural rather than remembered.

```
pravaah/
  app/
    (auth)/login/                     E1-S1
    (app)/layout.tsx                  shell: rail, header, breadcrumbs, palette
      command/ sales/ service/ projects/ inventory/
      commercial/ people/ vault/ workflow/ analytics/ assistant/ admin/
    (field)/field/                    mobile-first shell, 44px targets, AR-10
    api/                              mock route handlers, RBAC-guarded (AR-3, AR-4)
  components/
    ui/          restyled shadcn primitives (never visual defaults)
    patterns/    KpiCard DataTable SlaClock Timeline DocumentPreview ApprovalCard
                 AiAnswer SimulatedBadge EmptyState ChartFrame StateBoundary
    domain/      DispatchBoard BoqSheet RaBillBuilder RenewalRadar AgeingTable
                 AssetPassport WhatsAppPreview TapCounter
  lib/
    schemas/     Zod — single source of entity truth, types inferred (NFR-16)
    seed/        deterministic generators + fixtures + reconciliation validator
    derive/      SLA · coverage · ageing · retention · all 22 KPIs (AR-1, AR-2)
    format/      INR lakh/crore · DD MMM YYYY · quantities · GSTIN (NFR-23)
    rbac/        matrix · guards · scoping · route-handler enforcement
    ai/          question bank · retrieval simulation · streaming
    integrations/ single boundary for all 11 simulated integrations (AR-7)
    store/       localStorage adapter, versioned + schema-guarded (AR-5)
    audit/       single middleware-style writer invoked by every mutation (AR-9)
  tests/e2e/     Playwright critical paths
  tests/unit/    Vitest — formatters, derivations, contrast, reconciliation
```

**Non-negotiables enforced structurally:** derived values computed once in `/lib/derive`; Zod schemas infer all types; RBAC checked in route handlers *and* UI; every mutation routed through the audit writer; every simulated call behind `/lib/integrations`; all Indian formatting through `/lib/format`; seed reconciliation validator fails the build on any broken rule.

---

## 5. Wave plan

| Wave | Agent | Epics | Blocking? |
|---|---|---|---|
| **W1** | `agent-foundation` (primary, in-session) | E1 (all 9) · E14-S1 seed engine · E7-S1 item master · E5-S1 asset register | **Yes** — everything depends on `/lib` + shell |
| **W2** | `agent-command` · `agent-sales` · `agent-service` · `agent-assets` · `agent-projects` · `agent-inventory` | E2 · E3 · E4 · E5 rest · E6 · E7 rest | 6 parallel |
| **W3** | `agent-commercial` · `agent-people` · `agent-workflow` · `agent-vault` · `agent-analytics` | E8 · E9 · E11 · E10 · E12+E13 | 5 parallel |
| **W4** | `agent-hardening` · `agent-design-audit` | E14 rest · 69-screen consistency sweep | Sequential after W3 |

Agents share only `/lib`. Any agent failing a validation gate is re-dispatched with the failure output.

---

## 6. Story → files → agent → wave

### Wave 1 — `agent-foundation` (blocking)

| Story | P | Title | Primary files |
|---|---|---|---|
| E14-S1 | P0 | Deterministic seed engine + reconciliation validator | `lib/seed/*`, `lib/seed/validate.ts`, `scripts/validate-seed.ts` |
| E1-S1 | P0 | Role login + demo persona switching | `app/login/page.tsx`, `lib/rbac/session.ts`, `lib/rbac/guard.ts` |
| E1-S2 | P0 | Application shell & navigation | `app/(app)/layout.tsx`, `components/patterns/{Rail,Header,Breadcrumbs}.tsx` |
| E1-S3 | P0 | RBAC across nav, routes, data | `lib/rbac/{matrix,guard,scope}.ts`, `app/api/_lib/guard.ts` |
| E1-S4 | P1 | Theme + density preferences | `app/globals.css`, `components/patterns/ThemeDensity.tsx` |
| E1-S5 | P1 | Global command palette | `components/patterns/CommandPalette.tsx` |
| E1-S6 | P0 | Immutable audit log | `lib/audit/*`, `app/(app)/admin/audit/page.tsx` |
| E1-S7 | P0 | Reference data masters | `app/(app)/admin/masters/page.tsx`, `lib/seed/masters.ts` |
| E1-S8 | P0 | Integration readiness disclosure | `app/(app)/admin/integrations/page.tsx`, `lib/integrations/registry.ts` |
| E1-S9 | P0 | Compliance, consent, retention | `app/(app)/admin/compliance/page.tsx` |
| E7-S1 | P0 | Unified item master | `app/(app)/inventory/items/`, `lib/schemas/item.ts` |
| E5-S1 | P0 | Installed asset register | `app/(app)/service/assets/`, `lib/schemas/asset.ts` |
| X-16a | — | Session inactivity timeout (FR-M1-20) | `lib/rbac/session.ts` |

### Wave 2 — 6 parallel agents

| Story | P | Title | Agent | Primary files |
|---|---|---|---|---|
| E2-S1 | P0 | Headline KPI cards | command | `app/(app)/command/page.tsx`, `components/patterns/KpiCard.tsx` |
| E2-S2 | P0 | Vertical health tiles | command | `components/domain/VerticalTile.tsx` |
| E2-S3 | P0 | Locked cash panel (₹2.17 Cr) | command | `components/domain/LockedCashPanel.tsx` |
| E2-S4 | P0 | Exception feed | command | `app/(app)/command/exceptions/`, `lib/derive/exceptions.ts` |
| E2-S5 | P0 | Branch league table | command | `app/(app)/command/branches/` |
| E2-S6 | P1 | AI daily briefing | command | `components/domain/DailyBriefing.tsx` |
| E2-S7 | P1 | Executive view + period control | command | `app/(app)/command/page.tsx?view=executive` |
| E3-S1 | P0 | Customer/site/contact masters | sales | `app/(app)/sales/customers/` |
| E3-S2 | P0 | Customer 360 | sales | `app/(app)/sales/customers/[id]/` |
| E3-S3 | P0 | Enquiry capture & assignment | sales | `app/(app)/sales/enquiries/` |
| E3-S4 | P0 | Quotation builder + GST | sales | `app/(app)/sales/quotations/[id]/` |
| E3-S5 | P0 | Quotation versioning & lifecycle | sales | `lib/derive/quotation.ts` |
| E3-S6 | P0 | Discount approval gate | sales | `app/(app)/sales/quotations/[id]/approval.tsx` |
| E3-S7 | P0 | Win/loss & order conversion | sales | `app/(app)/sales/orders/` |
| E3-S8 | P0 | Pipeline board with ageing | sales | `app/(app)/sales/pipeline/` |
| E3-S9 | P1 | Sales desk & follow-up log | sales | `app/(app)/sales/my-desk/` |
| X-16b | — | Sales targets CRUD (FR-M3-22) | sales | `app/(app)/admin/masters/targets.tsx` |
| E4-S1 | P0 | Ticket intake + SLA derivation | service | `app/(app)/service/tickets/`, `lib/derive/sla.ts` |
| E4-S2 | P0 | Live SLA clocks & escalation | service | `components/patterns/SlaClock.tsx` |
| E4-S3 | P0 | Dispatch board + availability | service | `components/domain/DispatchBoard.tsx` |
| E4-S4 | P0 | Job card (desktop) | service | `app/(app)/service/job-cards/` |
| E4-S5 | P0 | **Mobile job card, 6 taps** | service | `app/(field)/field/job/[id]/`, `components/domain/TapCounter.tsx` |
| E4-S6 | P0 | Parts consumption → stock | service | `lib/derive/stock.ts` |
| E4-S7 | P0 | Service report + billing hand-off | service | `components/domain/ServiceReport.tsx` |
| E4-S8 | P0 | Field engineer day view | service | `app/(field)/field/today/` |
| E5-S2 | P0 | Asset passport | assets | `app/(app)/service/assets/[serial]/` |
| E5-S3 | P0 | Derived coverage state | assets | `lib/derive/coverage.ts` |
| E5-S4 | P0 | Commissioning + OEM countdown | assets | `app/(field)/field/commissioning/[assetId]/` |
| E5-S5 | P0 | Commissioning register | assets | `app/(app)/service/commissioning/` |
| E5-S6 | P0 | AMC contracts + visit schedules | assets | `app/(app)/service/amc/` |
| E5-S7 | P0 | Renewal radar | assets | `app/(app)/service/renewals/` |
| E5-S8 | P2 | Rental fleet register | assets | `app/(app)/service/rental/` |
| E6-S1 | P0 | Project record + portfolio | projects | `app/(app)/projects/` |
| E6-S2 | P0 | BOQ sheet, cumulative execution | projects | `components/domain/BoqSheet.tsx` |
| E6-S3 | P0 | Daily progress report (immutable) | projects | `app/(app)/projects/[id]/dpr/` |
| E6-S4 | P0 | Milestones, S-curve, variance | projects | `app/(app)/projects/[id]/` |
| E6-S5 | P0 | RA-bill builder + deductions | projects | `components/domain/RaBillBuilder.tsx` |
| E6-S6 | P0 | Retention register (₹34.6 L) | projects | `app/(app)/projects/retention/` |
| E6-S7 | P1 | Project workspace + doc register | projects | `app/(app)/projects/[id]/` |
| X-16c | — | Project cost / billed-vs-cost (BR-031, FR-M5-16) | projects | `app/(app)/projects/[id]/cost/` |
| X-16d | — | O&M phase (FR-M5-20) | projects | `lib/derive/oam.ts` |
| E7-S2 | P0 | Stock balances + append-only ledger | inventory | `app/(app)/inventory/stock/`, `lib/derive/stock.ts` |
| E7-S3 | P0 | Issue against job card / project | inventory | `app/(app)/inventory/movements/` |
| E7-S4 | P0 | Goods receipt + purchase orders | inventory | `app/(app)/inventory/purchase/` |
| E7-S5 | P0 | Reorder list, service-critical first | inventory | `app/(app)/inventory/reorder/` |
| E7-S6 | P1 | Non-moving stock report | inventory | `app/(app)/analytics/inventory/` |
| X-16e | — | Stock count + variance (FR-M6-14) | inventory | `app/(app)/inventory/stock/count.tsx` |

### Wave 3 — 5 parallel agents

| Story | P | Title | Agent | Primary files |
|---|---|---|---|---|
| E8-S1 | P0 | Delivery challan (triplicate) | commercial | `app/(app)/commercial/challans/` |
| E8-S2 | P0 | Tax invoice, derived GST | commercial | `app/(app)/commercial/invoices/`, `lib/derive/gst.ts` |
| E8-S3 | P0 | Simulated IRN/QR + window tracking | commercial | `lib/integrations/irp.ts` |
| E8-S4 | P0 | E-way bill + stale-document block | commercial | `app/(app)/commercial/eway/` |
| E8-S5 | P0 | Receipts and allocation | commercial | `app/(app)/commercial/receipts/` |
| E8-S6 | P0 | Receivables ageing + follow-up | commercial | `app/(app)/commercial/receivables/` |
| E8-S7 | P1 | Ledger hand-off + numbering | commercial | `app/(app)/commercial/handoff/` |
| X-16f | — | Credit/debit notes (FR-M7-10) | commercial | `app/(app)/commercial/invoices/[id]/notes.tsx` |
| E9-S1 | P0 | Employee register + statutory docs | people | `app/(app)/people/employees/` |
| E9-S2 | P0 | Attendance incl. field geolocation | people | `app/(field)/field/attendance/` |
| E9-S3 | P0 | Attendance board + regularisation | people | `app/(app)/people/attendance/` |
| E9-S4 | P0 | Leave + coverage warning | people | `app/(app)/people/leave/` |
| E9-S5 | P0 | Monthly payroll-input summary | people | `app/(app)/people/attendance/summary.tsx` |
| E9-S6 | P1 | Technician utilisation | people | `lib/derive/utilisation.ts` (read-only consumer) |
| X-16g | — | Holiday calendar per branch (FR-M8-12) | people | `app/(app)/admin/masters/holidays.tsx` |
| E11-S1 | **P0**† | Approval engine + chains | workflow | `lib/derive/approvals.ts`, `app/api/approvals/` |
| E11-S2 | P0 | My Approvals, inline context | workflow | `app/(app)/workflow/approvals/` |
| E11-S3 | P1 | Approval chain designer | workflow | `app/(app)/workflow/chains/` |
| E11-S4 | P0 | Notification centre | workflow | `app/(app)/workflow/notifications/` |
| E11-S5 | P1 | Simulated WhatsApp, actionable | workflow | `components/domain/WhatsAppPreview.tsx` |
| E11-S6 | P1 | Channel prefs + message log | workflow | `app/(app)/workflow/notifications/log.tsx` |
| E10-S1 | **P0**† | Vault structure, versioning, perms | vault | `app/(app)/vault/` |
| E10-S2 | P1 | Metadata, expiry, direct search | vault | `app/(app)/vault/search.tsx` |
| E10-S3 | **P0**† | Ask the Vault + inline citations | vault | `app/(app)/vault/ask/`, `lib/ai/retrieval.ts` |
| E10-S4 | P0 | Confidence + honest insufficiency | vault | `lib/ai/confidence.ts` |
| E10-S5 | P1 | Answer feedback capture | vault | `app/(app)/vault/ask/feedback.tsx` |
| E12-S1 | P0 | Single-source KPI engine | analytics | `lib/derive/kpi.ts` (22 KPIs) |
| E12-S2 | P1 | Sales + service analytics | analytics | `app/(app)/analytics/{sales,service}/` |
| E12-S3 | P1 | Projects, cash, inventory analytics | analytics | `app/(app)/analytics/{projects,cash,inventory}/` |
| E12-S4 | P1 | Anomaly flags, export, a11y tables | analytics | `components/patterns/ChartFrame.tsx` |
| E13-S1 | **P0**† | NL querying + record-set disclosure | analytics | `app/(app)/assistant/` |
| E13-S2 | P1 | Daily briefing generation | analytics | `lib/ai/briefing.ts` |
| E13-S3 | P2 | Management-review drafting | analytics | `app/(app)/assistant/report.tsx` |
| E13-S4 | P0 | Guardrails, refusal, disclosure | analytics | `lib/ai/guardrails.ts` |

† Promoted to P0 per conflict C-02.

### Wave 4

| Story | P | Title | Agent |
|---|---|---|---|
| E14-S2 | P0 | Complete interaction-state coverage | hardening |
| E14-S3 | P0 | WCAG 2.2 AA conformance | hardening |
| E14-S4 | P0 | Performance budgets | hardening |
| E14-S5 | P0 | Playwright critical-path suite | hardening |
| E14-S6 | P1 | Demo controls + documentation | hardening |
| — | — | 69-screen consistency sweep | design-audit |

---

## 7. Design law

Dark-first industrial control room on the PRD §11 token set, corrected per C-07/C-08/C-09/C-10. Precision instrument, never a SaaS template.

- **Geometry:** radii 3/5/8px only · 1px hairline borders carry structure · elevation `e0`/`e1` only, `e2` reserved for overlays · 4px spacing base · 36px compact / 44px comfortable rows · 240/64px rail · 56px header · 1600px max content.
- **Type:** Sora 600/700 display · Inter 400/500/600 UI · JetBrains Mono for serials, invoice numbers, IRN, GSTIN, audit IDs. `font-variant-numeric: tabular-nums` on every numeric cell. Max three type sizes per card. Numbers right-align, text left-aligns, never centre.
- **Colour:** vertical tokens identify a vertical only; semantic tokens signal state only; every coloured state also carries an icon and a text label; max three accents per viewport; 4 distinct SLA clock states.
- **Indian by default:** ₹1,82,45,600 grouping · ₹1.82 Cr / ₹34.6 L abbreviation above ₹1 L · `DD MMM YYYY` · `FY 2026-27` · `+91 9XXXX XXXXX` · 15-char GSTIN.
- **Banned:** stock art, illustration, emoji, mascots, purple-blue gradients, generic hero cards, decorative shadow, colour-only meaning.
- **Responsive:** verified 375 / 768 / 1024 / 1440 / 1920. Field routes mobile-first, ≥44px targets, one-handed thumb reach.
- **Rules with teeth:** every number is a doorway to its source record; every simulated integration wears a visible "Simulated" chip linking to `/admin/integrations`.

---

## 8. Validation gates — run to green, fix, re-run

| Gate | Command | Target |
|---|---|---|
| Types | `npx tsc --noEmit` | 0 errors, no `any`, no suppressions |
| Lint | `npm run lint` | 0 warnings |
| Build | `npm run build` | clean |
| Seed reconciliation | `npm run validate:seed` | every rule in SD-2/SD-3 asserts; **₹1.82 Cr + ₹34.6 L = ₹2.17 Cr exact** |
| Unit | `npx vitest run` | formatters, derivations, WCAG contrast pairs |
| E2E | `npx playwright test` | every FR-M13-05 critical path, 3 consecutive clean runs |
| Accessibility | axe-core in Playwright | 0 serious/critical, WCAG 2.2 AA |
| RBAC | E2E URL-bypass | forbidden route denied by handler + `ACCESS_DENIED` audit entry |
| Performance | Lighthouse / instrumented | LCP < 2.5s, FCP < 1.5s, route change < 300ms |
| Acceptance | manual walk | A-01 … A-22 |

Deliverable README carries: 12 role credentials, the seed model and reconciliation rules, the demo script, the simulated-integration inventory with Phase 2 prerequisites, and **measured** performance figures (not targets).


---

## Deployment note — why the route guard is not Edge middleware

RBAC-1 layer 2 was implemented as `middleware.ts` and worked locally, but could not be kept.

On Vercel the deployed Edge bundle threw `ReferenceError: __dirname is not defined` at module
scope. `__dirname` is a Node CommonJS global with no equivalent in the Edge runtime, and the
symbol appears nowhere in a locally built bundle — verified against the middleware manifest,
whose Edge function is only `edge-runtime-webpack.js` and `middleware.js`. It was never
reproducible locally, because `next start` runs middleware in a permissive Node sandbox rather
than a real Edge isolate.

The consequence is what forced the change. A middleware fault does not degrade: it replaces the
whole response with `MIDDLEWARE_INVOCATION_FAILED`. Every route returned 500 — including
`/login`, the one page that could have cleared a bad cookie, and `/favicon.ico`. A throw at
module scope is not catchable from inside the handler, so no amount of defensive code in the
function body helps.

The guard now sits in server layouts, one at each `ROUTE_RULES` prefix. These run on the same
Node runtime as the pages, so what passes locally is what runs in production, and a fault
renders one route's error boundary instead of blanking the site. Enforcement is still
server-side, which is what RBAC-1 requires.

**Placement follows longest-prefix, with one exception.** Nesting means a route must satisfy its
ancestors' capabilities too. That is equivalent to `capabilityForPath` for every role and prefix
but one: `PROJECT_MANAGER` and `ACCOUNTS_EXECUTIVE` hold `command.exceptions` without holding
`command`, so a guard on `/command` would wrongly deny them `/command/exceptions`. `/command`
and `/admin` therefore guard themselves from inside a `(overview)` route group, which applies to
the index route without becoming an ancestor of the children. The equivalence was computed
across all twelve roles before the layouts were generated.

**One behavioural difference worth knowing.** Where a route has a `loading.tsx`, the response
streams, so the 200 is committed before the guard resolves and the redirect is delivered inside
the RSC stream rather than as a 307. The page component still never renders — a denied role
receives no data from it, only the redirect — and the browser follows it normally.
