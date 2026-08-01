# Documentation Package — Index & Reading Guide

## Project "Pravaah" — Unified Operations & Intelligence Platform for Bhushancorp Private Limited

| Field | Detail |
|---|---|
| **Client** | Bhushancorp Private Limited, Exhibition Road, Patna, Bihar 800001 |
| **Prepared by** | Aravya (aravya.in) — Solution Architecture, Product & Delivery |
| **Date** | 31 July 2026 |
| **Package version** | 1.0 |
| **Supersedes** | *Aravya Premium Proposal — AI & Digital Transformation for Bhushan Corp.in* (one-page proposal) |
| **Engagement scope** | Phase 1 — high-fidelity frontend prototype with simulated integrations and deterministic seed data |
| **Classification** | Confidential — Client & Aravya only |

---

## 1. What this package contains

Four documents. Each has a distinct audience and a distinct decision attached to it.

| # | Document | File | Answers | Sign-off owner |
|---|---|---|---|---|
| 01 | **Business Requirements Document** | `01_BRD_Bhushan_Operations_Platform.md` | *Why* are we building this, what business outcomes must it produce, what is deliberately excluded, and how will success be measured? | Executive Sponsor |
| 02 | **Product Requirements Document** | `02_PRD_Bhushan_Operations_Platform.md` | *What* exactly is being built — modules, screens, functional requirements, data model, permissions, design system, seed data, architecture | Sponsor + module owners |
| 03 | **Epics & User Stories** | `03_Epics_User_Stories_Bhushan_Operations_Platform.md` | *How* will it be delivered — 14 epics, 92 stories, acceptance criteria, sprint plan, traceability | Delivery lead + Product Owner |
| 00 | **This index** | `00_README_Documentation_Index.md` | Where to start, how the documents relate, what is still open | — |

### Reading order by audience

| If you are… | Read |
|---|---|
| The client's Managing Director | BRD §1 Executive Summary, §5 Objectives, §6 Scope, §9 Value Engineering, §14 Business Case → then PRD §17 Demonstration Script |
| The client's functional head (service, projects, accounts, HR) | BRD §3 Pain Points → PRD §2 your persona → PRD §5 your module's functional requirements |
| A developer picking up the build | PRD §11 Design System, §13 Technical Architecture, §12 Seed Data → then Epics document end to end |
| A reviewer checking rigour | BRD §16 Traceability → Epics document Traceability Matrix → any story back to its BRD requirement |

---

## 2. Package statistics

| Artefact | Count |
|---|---|
| Business requirements (BR-001 … BR-062) | 62 |
| Business objectives (BO-01 … BO-12) | 12 |
| Business KPIs with published formulas (K-01 … K-22) | 22 |
| Pain points registered (P-01 … P-17) | 17 |
| Explicit exclusions (X-01 … X-14) | 14 |
| Value additions beyond the original proposal (VA-01 … VA-09) | 9 |
| Risks scored (R-01 … R-10) | 10 |
| Discovery questions | 24 |
| Personas | 9 (+1 deferred) |
| Modules (M1 … M12 + cross-cutting) | 13 |
| Screens specified | 63 |
| Functional requirements (FR-M*-**) | ~190 |
| Data entities | 36 |
| Roles in the RBAC matrix | 12 |
| Simulated integrations (INT-01 … INT-11) | 11 |
| AI guardrails (AI-G1 … AI-G10) | 10 |
| Non-functional requirements (NFR-01 … NFR-25) | 25 |
| Engagement acceptance criteria (A-01 … A-22) | 22 |
| **Epics** | **14** |
| **User stories** | **92** (67 P0 · 22 P1 · 3 P2) |
| **Story points** | **560** across 6 sprints |

---

## 3. The five things that matter most in this package

If the client reads nothing else, these are the points that carry the engagement.

1. **The business runs four commercially distinct engines, and generic software serves none of them properly.** Equipment distribution, field service and AMC, turnkey water projects, and rental each have their own statutory documents and cash cycles. A configured off-the-shelf suite cannot model a serial-numbered warranty register, an OEM commissioning submission window, or a BOQ-to-RA-bill-to-retention lifecycle. This is the entire build-versus-buy argument, and it is set out honestly in BRD §2.5 — including the counter-argument.

2. **₹2.17 crore of locked cash is the headline.** The seeded dataset presents receivables of ₹1.82 crore plus project retention of ₹34.6 lakh as a single figure that decomposes to individual invoices and retention entries. Nothing else in the prototype gets a leadership audience's attention as quickly.

3. **The recurring-revenue leak is quantified, not asserted.** 14 AMCs worth ₹18.4 lakh expiring within 60 days, and 144 installed machines with no coverage at all — a 42% attach rate. That is not a complaint about the past; it is a pipeline nobody has yet seen.

4. **The AI is deliberately narrow and deliberately honest.** It retrieves with citations, summarises, and drafts. It cannot take a business action, and it says so when it does not know. One seeded vault question returns "no supporting source was found" on purpose, because that behaviour is what makes the rest of the answers trustworthy.

5. **Every exclusion is a decision, not an omission.** Statutory payroll computation, live integrations, native mobile apps, autonomous agents and a self-service report builder are all excluded with stated reasons (BRD §6.2). The accounting ledger explicitly remains the book of record.

---

## 4. How the documents cross-reference

```
BRD                          PRD                         EPICS
───                          ───                         ─────
BO-01 … BO-12   ─────────►   (objectives inherited)  ──► Epic business objectives
BR-001 … BR-062 ─────────►   FR-M1-01 … FR-M13-10   ──► E1-S1 … E14-S6
K-01 … K-22     ─────────►   §11 KPI wiring, §6.4   ──► E12-S1 single-source engine
X-01 … X-14     ─────────►   §1.5 non-goals         ──► Epic scope boundaries
R-01 … R-10     ─────────►   design mitigations     ──► Epic risks / assumptions
AS/CN/DP        ─────────►   PD-001 … PD-012        ──► B1 … B8 blockers
```

Any story in document 03 can be traced back to a business requirement in document 01 via the traceability matrix at the end of document 03. If a story cannot be traced, it does not belong in the backlog.

---

## 5. Open items requiring client input

Nothing in this list blocks the build — every item has a documented working default — but each answer improves fidelity.

### Business blockers (needed by the sprint shown)

| ID | Item | Needed by | Default if unanswered |
|---|---|---|---|
| B1 | Confirmed branch cities and warehouse designation | Sprint 1 | Patna (HQ + warehouse), Muzaffarpur, Bhagalpur, Gaya — held as data, not code |
| B2 | Brand assets, or approval to derive identity from the live website | Sprint 1 | Sample the primary hue from the wordmark on bhushancorp.in |
| B3 | Redacted sample documents — quotation, challan, invoice, job card, commissioning report, BOQ, RA-bill | Sprint 1 | Build from standard Indian trade formats; accept rework risk |
| B4 | Discount approval thresholds by role | Sprint 2 | 5% Branch Manager, 10% Director – Business, above 10% Director – Strategy |
| B5 | OEM commissioning submission window per principal | Sprint 3 | 7 days |
| B6 | Default SLA hours by severity and coverage | Sprint 3 | Critical 4h/24h · High 8h/48h · Normal 24h/96h · Low 48h/168h |
| B7 | Retention percentage and defect-liability period defaults | Sprint 4 | 5% retention, 12-month defect-liability period |
| B8 | Whether public institutional client names may appear in seed data | Sprint 1 | Use anonymised institutional archetypes |

### Highest-value discovery answers

Of the 24 questions in BRD §12, these five change the most:

1. **Confirmed headcount** — public sources conflict (35 in the MSME award listing versus a 55-member team in the company's own profile). Drives role provisioning and licensing.
2. **Incumbent accounting package and version** — determines the Phase 2 synchronisation pattern and the ledger hand-off format.
3. **Live AMC contract count and comprehensive/non-comprehensive split** — the single most important number for sizing the recurring-revenue opportunity.
4. **Current OEM commissioning window and turnaround commitments per principal** — these are configuration values, but they are the ones that make the warranty story credible.
5. **Monthly transaction volumes** — determines pagination, virtualisation and archival strategy.

---

## 6. Correction of record

Two claims that circulate widely in secondary sources were tested during research and are **not** relied upon anywhere in this package. They are recorded here so that nobody reintroduces them:

1. **There is no corroborated "three-day" e-invoice IRP reporting window effective October 2025.** The confirmed rule is a **30-day** reporting window for taxpayers with aggregate annual turnover of ₹10 crore or more, effective 1 April 2025.
2. **India WhatsApp template rates are published by Meta in USD at very low per-message levels.** A widely circulated rupee figure conflates a different market's authentication rate and should not be used for cost modelling.

Statutory positions throughout this package are stated **as at July 2026** and require re-validation before Phase 2 go-live. The Labour Code central rules and DPDP enforcement are both mid-implementation, which is why all compliance-sensitive logic in the PRD is specified as configuration-driven and effective-dated rather than hard-coded (BRD CN-001).

---

## 7. Using this package as a build specification

For an AI-assisted or agent-driven build, these three documents are the source of truth in this precedence order:

1. **`03_Epics_User_Stories`** — the acceptance criteria are the contract. Build to satisfy the Given/When/Then, not to satisfy a description.
2. **`02_PRD`** — for anything the stories do not specify: design tokens, component behaviour, data-model fields, RBAC cells, seed volumes, folder structure, architectural rules.
3. **`01_BRD`** — for adjudicating anything ambiguous. If a design choice cannot be justified against a business requirement or objective, it is the wrong choice.

Non-negotiables that apply to every story, drawn from the PRD architectural rules and design principles:

- Derived values (SLA state, coverage state, ageing bucket, retention amount, every KPI) are computed once in a shared module and never stored as editable fields.
- Zod schemas are the single source of entity truth; TypeScript types are inferred from them.
- RBAC is enforced in route handlers as well as in the UI.
- Every mutation writes an audit entry through one shared utility.
- Every simulated integration carries a visible "Simulated" indicator and sits behind one integration boundary so Phase 2 is a swap, not a rewrite.
- Indian formatting (lakh/crore, `DD MMM YYYY`, tabular numerals) goes through one utility and is never hand-formatted in a component.
- The field job card has a hard budget of six taps for a standard visit. This is a measured constraint, not an aspiration.
- Seed data must remain reconcilable — the validation script from story `E14-S1` fails the build if any reconciliation rule breaks.

---

## 8. Suggested next steps

| # | Step | Owner | Outcome |
|---|---|---|---|
| 1 | Client review of BRD §5 Objectives, §6 Scope and §6.2 Exclusions | Client sponsor | Scope boundary agreed and signed |
| 2 | Discovery session against BRD §12 (24 questions) and the 8 blockers above | Both | Assumptions ratified or replaced |
| 3 | Client confirmation of the 12 product decisions in PRD §19 | Client | Defaults confirmed or overridden |
| 4 | PRD countersigned as the Phase 1 specification | Client + Aravya | Build authorised |
| 5 | Sprint 1 executed; velocity measured; backlog re-cut and reissued as v1.1 | Aravya | Realistic plan replaces estimated plan |
| 6 | Sprint 4 mid-point walkthrough for seed-data realism, before polish | Both | Credibility problems surfaced while still cheap |
| 7 | Full acceptance against PRD §16 (A-01 … A-22), then demo rehearsal | Both | Prototype accepted; Phase 2 scoped |

---

**Prepared by Aravya · 31 July 2026 · Package version 1.0**
