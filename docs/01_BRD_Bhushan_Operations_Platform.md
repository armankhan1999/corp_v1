# Business Requirements Document (BRD)

## Project "Pravaah" — Unified Operations & Intelligence Platform for Bhushancorp Private Limited

| Field | Detail |
|---|---|
| **Document Type** | Business Requirements Document (BRD) |
| **Document ID** | ARV-BC-BRD-001 |
| **Version** | 1.0 |
| **Date** | 31 July 2026 |
| **Prepared By** | Solution Architecture & Delivery, Aravya (aravya.in) |
| **Prepared For** | Bhushancorp Private Limited, Exhibition Road, Patna, Bihar 800001 |
| **Client Sponsor** | Director – Business (to be confirmed at kick-off) |
| **Status** | Issued for Client Review |
| **Classification** | Confidential — Client & Aravya only |
| **Supersedes** | *AI & Digital Transformation Proposal for Bhushan Corp.in* (1-page proposal) |
| **Companion Documents** | ARV-BC-PRD-001 (Product Requirements), ARV-BC-EPC-001 (Epics & User Stories) |

### Revision History

| Ver | Date | Author | Change Summary |
|---|---|---|---|
| 0.1 | 28 Jul 2026 | Aravya | Internal draft from source proposal + public-domain business research |
| 1.0 | 31 Jul 2026 | Aravya | First issue for client review — scope, objectives, exclusions, build-vs-buy analysis |

### Approval Matrix

| Role | Name | Responsibility | Signature | Date |
|---|---|---|---|---|
| Executive Sponsor (Director – Business) | | Approves scope, budget, objectives | | |
| Director – Strategy / Founder | | Approves business alignment | | |
| Head – Service Operations | | Validates service & AMC requirements | | |
| Head – Projects (EPC) | | Validates project & billing requirements | | |
| Accounts & Commercial Lead | | Validates GST, invoicing, receivables | | |
| HR & Admin Lead | | Validates attendance & workforce requirements | | |
| Aravya Engagement Lead | | Accepts delivery obligation | | |

---

## 1. Executive Summary

### 1.1 Purpose of this document

This BRD converts the one-page Aravya proposal into a formally scoped, testable set of business requirements for a single, unified operations platform for Bhushancorp Private Limited ("Bhushan Corp"). It defines **why** the platform is being built, **what business outcomes** it must produce, **what is explicitly excluded**, and **how success will be measured**. It is the controlling document for the companion PRD and backlog.

### 1.2 The business in one paragraph

Bhushan Corp is a Patna-headquartered industrial equipment and water-infrastructure house, operating as the authorised channel and service partner for **ELGi air compressors**, **ATS-ELGi automotive workshop equipment**, **KSB pumps** and **Ion Exchange** water-treatment products across Bihar and adjoining markets, with a parallel **turnkey water & environment projects (EPC)** vertical that has delivered institutional works including a 1200 KLD STP at IGIMS, an ETP at RMIRMS, and sewage pipeline works at AIIMS Patna. The business therefore runs **four commercially distinct engines simultaneously** — equipment sales, field service and AMC, turnkey projects, and equipment rental — from multiple branch locations with a central warehouse.

### 1.3 The core problem

Each of those four engines has its own document trail, cadence and cash cycle, but the company operates them on a **fragmented substrate of spreadsheets, WhatsApp threads, paper job cards, physical registers and a standalone accounting ledger**. There is no single place where leadership can see, on any given morning: what is in the sales pipeline, which machines are down and breaching turnaround commitments, which AMCs and warranties expire this month, how much cash is stuck in receivables and project retention, and which branch is underperforming. Consequently, decisions are reactive, recurring-revenue leaks silently, and management effort is spent assembling information rather than acting on it.

### 1.4 The proposed response

A single, role-aware, AI-assisted web platform — **"Pravaah"** — that models Bhushan Corp's actual document lifecycles (enquiry → quotation → order → challan → GST invoice → collection; complaint → job card → visit → spares → commissioning/service report → AMC renewal; tender → BOQ → work order → DPR → RA-bill → retention release) and surfaces them through a leadership command centre, with AI used narrowly and honestly for document retrieval, summarisation and briefing rather than for autonomous action.

### 1.5 What is being delivered in this engagement

This engagement delivers a **high-fidelity, click-through functional prototype** built on production-grade frontend engineering (Next.js 15, TypeScript, Tailwind, shadcn/ui), populated with realistic Bhushan-specific seed data, with all external systems (accounting, GST portal, WhatsApp, UPI, biometric attendance, e-sign) **faithfully simulated in the interface**. The prototype is the decision artefact: it lets Bhushan Corp experience and approve the entire operating model before committing to backend build, data migration and integration expenditure.

### 1.6 Headline business case

| Dimension | Position |
|---|---|
| Primary financial lever | Recovery of leaked recurring revenue (AMC renewals, warranty-driven service, spares attach) and reduction of cash locked in receivables & retention |
| Secondary lever | Elimination of manual coordination and report assembly across branches |
| Strategic lever | An operating asset owned by Bhushan Corp, modelled on its own trade — not a per-seat subscription to a generic suite |
| Risk posture | Prototype-first. No backend, migration or integration spend is committed until the operating model is signed off |
| Investment protection | Every screen, entity and workflow validated in the prototype becomes the specification for Phase 2 |

---

## 2. Business Context

### 2.1 Company profile (public-domain research, to be confirmed at kick-off)

| Attribute | Finding | Confidence |
|---|---|---|
| Registered entity | Bhushancorp Private Limited | Verified (MCA-derived records) |
| CIN | U29309BR2017PTC035016 | Verified |
| Incorporated | 3 July 2017, RoC Patna | Verified |
| Brand lineage | Trading arm of Bhushan International, established 1985–86; incorporated as a private limited company in 2017 to professionalise the business | Verified (company website) |
| Registered office | 2nd Floor, B-3, Grand Shere-II, Exhibition Road, Patna, Bihar 800001 | Verified |
| Directors | Two directors — founder and second-generation director | Verified |
| Industry classification | Industrial plants & machinery (NIC 29309 lineage) | Verified |
| Employees | 35 (award listing) vs 55-member team (company profile) | **Conflicting — confirm** |
| Branches | 4 branch offices | Company-stated |
| Warehouse | ~8,000 sq ft | Company-stated |
| Annual turnover | ₹5–10 crore band | Self-declared (B2B directory) |
| Recognition | India 5000 Best MSME Award 2024 — Industrial Plants & Machinery | Verified |
| Geography | Bihar (primary), with industrial customers extending to Birgunj, Nepal | Company-stated |

> **AS-001 (Assumption):** Where the two headcount figures conflict, the platform is designed for **45–60 named users with 11 distinct roles**, which comfortably accommodates either figure. Licensing and role provisioning will be finalised at kick-off.

### 2.2 Business verticals and how each actually earns

| ID | Vertical | Principal lines | Commercial pattern | Cash cycle characteristic |
|---|---|---|---|---|
| **V1** | Equipment Sales & Distribution | ELGi piston / screw / oil-free / portable / direct-drive compressors; air dryers & accessories; PPR piping; ATS-ELGi body-shop, lube, washing, lifting equipment, pneumatic tools, tyre inflators; KSB pumps; Ion Exchange resins | Project-style B2B selling: enquiry → technical sizing → quotation → negotiation → PO → delivery → commissioning | Medium; advance/part-payment common, balance on commissioning |
| **V2** | Service, Spares & AMC | Installation & commissioning, warranty service, breakdown response, preventive maintenance, comprehensive & non-comprehensive AMC, spare parts | Recurring and reactive; highest-margin, lowest-visibility engine | Short, but leaks badly when renewals are untracked |
| **V3** | Turnkey Water & Environment Projects (EPC) | STP / ETP design, supply, erection & commissioning; sewage pipeline works; government and CSR-funded works | Tender / NIT → BOQ → work order → staged execution → RA-billing → retention → O&M | **Longest and most punishing** — institutional payment lags plus retention withheld |
| **V4** | Equipment Rental | Compressor rental fleet | Utilisation-driven; asset-return and condition risk | Short but asset-intensive |

> **Architectural consequence:** A generic "projects and tasks" module cannot serve V1–V4. Each vertical requires its own statutory and commercial document objects. This is the single largest reason a configured off-the-shelf suite under-serves this business.

### 2.3 OEM channel obligations as a first-class business driver

Bhushan Corp's dealership economics depend on OEM-facing discipline that is currently paper-bound:

1. **Commissioning documentation:** A dealer-completed, stamped and signed installation & commissioning report must reach the OEM within a defined short window (approximately seven days of commissioning) for the customer's warranty to be valid. A misplaced or late report converts a warranty claim into an out-of-pocket cost or a customer dispute.
2. **Restoration turnaround commitments:** The compressor OEM's service programme is built around rapid parts dispatch and machine restoration (an approximately 48-hour air-restoration commitment, with rental reimbursement remedies). Bhushan Corp is the visible party against that clock.
3. **Warranty register integrity:** Warranty validity depends on serial-number-level records of commissioning date, running hours and service history.

> These are not "nice to have" features. They are the mechanism by which the dealership protects margin and channel standing, and they are the most defensible reason to build rather than buy.

### 2.4 Regulatory landscape (as at July 2026)

| Domain | Obligation relevant to Bhushan Corp | As-of position | Platform implication |
|---|---|---|---|
| GST e-invoicing | Mandatory for B2B/B2G/export supplies at ₹5 crore aggregate turnover. Businesses with AATO ≥ ₹10 crore must report invoices to the IRP within **30 days** of invoice date (effective 1 April 2025). | Confirmed via GSTN advisory | Invoice objects must carry IRN + signed QR; ageing alerts for unreported invoices |
| E-way bill | Required above ₹50,000 consignment value (Bihar follows the ₹50,000 threshold). 2FA mandatory. From 1 Jan 2025, an e-way bill cannot be generated against a base document older than 180 days. | Confirmed | Challan/dispatch flow must produce e-way bill data and block stale base documents |
| Delivery challan | A statutory GST document under CGST Rule 55, issued in triplicate (consignee / transporter / consigner). | Confirmed | Challan is a distinct entity, not a printout of the invoice |
| Labour Codes | The four Labour Codes came into force **21 November 2025**, consolidating 29 earlier statutes. Draft Central Rules gazetted 30 December 2025; final rules anticipated around 1 April 2026. Obligations include mandatory appointment letters, pan-India ESIC coverage, statutory minimum wages, timely wage payment, gratuity for fixed-term employees after one year. | In force; rules still settling | HR module must hold appointment letters and statutory documents, and be **configurable** rather than hard-coded to any rule set |
| DPDP Act 2023 / DPDP Rules 2025 | Rules notified 13 November 2025 with phased enforcement running to approximately May 2027. Obligations: itemised plain-language consent notice, easy withdrawal, data-principal rights, breach intimation to the Board without delay with a detailed report and notification of affected data principals within 72 hours, erasure on purpose completion, retention logs. Penalties up to ₹200 crore (breach-notification failure) and ₹250 crore (inadequate safeguards). | Notified; phased | Consent notice, data-subject request register, retention policy, audit log, breach-response placeholder |
| SMS vs WhatsApp | Transactional SMS requires TRAI DLT registration. WhatsApp Business API does **not** require DLT; Meta moved to per-delivered-template pricing on 1 July 2025, with service messages inside the 24-hour customer window free of charge. | Confirmed | WhatsApp is the correct primary notification channel; SMS is fallback only |

> **CN-001 (Constraint):** Labour Code central rules and DPDP enforcement are both mid-implementation. All compliance-sensitive logic must be **configuration-driven with effective-dating**, never hard-coded. The BRD states positions as of July 2026 and requires re-validation before Phase 2 go-live.

### 2.5 Competitive / build-vs-buy analysis

An honest assessment of the alternative to building.

| Option | Indicative annual cost (list, 2026) | Covers well | Does not cover |
|---|---|---|---|
| **Zoho One** (all-employee plan, ₹1,500/employee/month + 18% GST) — at 45 employees ≈ **₹9.6 lakh/year** | Recurring, perpetual | CRM, Books/GST, People, Projects, Inventory, mail | Serial-number warranty register; OEM commissioning report loop; BOQ/RA-bill/retention lifecycle; unified leadership command centre across all four verticals |
| **Zoho One** (flexible-user plan, ₹3,500/user/month + GST) — at 18 software users ≈ **₹8.9 lakh/year** | Recurring, perpetual | As above, fewer seats | As above |
| **Best-of-breed stack** (Keka or greytHR for HR ≈ ₹99/employee/month; a field-service tool; Tally retained) | ≈ ₹4–7 lakh/year plus integration effort | Payroll compliance, biometric device support, mobile apps | Cross-vertical consolidation; leadership single pane; bespoke document objects |
| **Custom platform (this engagement)** | One-time build; no per-seat escalation | Exact document model, OEM obligations, four-vertical command centre, owned asset | Payroll statutory engine, mature mobile apps, breadth of a 45-app suite |

**Honest counter-argument, stated for the record:** off-the-shelf suites already ship payroll statutory computation, mobile applications and hundreds of integrations that are expensive to rebuild and expensive to keep compliant. **Therefore this platform is deliberately positioned as the operations and intelligence layer, not as a replacement for the accounting ledger or a statutory payroll engine.** Tally (or the incumbent ledger) remains the book of record; payroll computation remains a candidate for a specialist tool. The platform owns the operational truth and the leadership view, and is designed to exchange data with those systems in Phase 2.

> **RQ-001 (Open question for client):** Confirm the incumbent accounting package (Tally Prime / Busy / other), version, and whether it runs on-premise. This determines the Phase 2 synchronisation pattern.

---

## 3. Current State Assessment (As-Is)

### 3.1 Method and caveat

The as-is picture below is constructed from public-domain research into Bhushan Corp's operations plus documented norms for Indian industrial dealerships of comparable size and vertical mix. Items marked **(I)** are informed inferences requiring confirmation in discovery; items marked **(V)** are evidenced from the company's own public material.

### 3.2 Pain-point register

| # | Process area | Observed / inferred current state | Business consequence | Severity |
|---|---|---|---|---|
| P-01 | Leadership visibility | No consolidated view; numbers assembled on request from branch staff **(I)** | Decisions lag reality by days; management time consumed by data collection | **Critical** |
| P-02 | Enquiry handling | Enquiries arrive by phone, website form, WhatsApp and walk-in; captured inconsistently **(I)** | Leakage before quotation; no measurable conversion rate | **Critical** |
| P-03 | Quotation control | Quotations produced in Excel/Word per executive; no version control, no expiry discipline, no win/loss capture **(I)** | Margin inconsistency; silent pipeline decay; no pricing intelligence | High |
| P-04 | Warranty & commissioning | Commissioning reports completed on paper, couriered/scanned to OEM; no central register of what was submitted when **(I)** | Warranty invalidation risk; disputes absorbed as cost | **Critical** |
| P-05 | Service dispatch | Complaints logged in a register or WhatsApp group; technician assignment verbal **(I)** | No turnaround clock, no first-time-fix measurement, OEM commitments unmanaged | **Critical** |
| P-06 | AMC lifecycle | Contracts tracked in a spreadsheet; renewals surfaced when someone remembers **(I)** | **Direct recurring-revenue leakage** — the single largest quantifiable loss | **Critical** |
| P-07 | Spares & warehouse | ~8,000 sq ft warehouse **(V)**; stock verified physically; no reorder signal **(I)** | Second visits caused by parts unavailability; capital tied in slow stock | High |
| P-08 | Project execution | BOQ, progress and measurement books maintained in spreadsheets and site diaries **(I)** | Slippage discovered late; RA-bills raised late | High |
| P-09 | Retention money | Retention withheld per project not centrally tracked to release **(I)** | Cash permanently forfeited through non-pursuit | **Critical** |
| P-10 | Receivables | Institutional and government receivables followed up by phone; ageing not visible **(I)** | Elevated DSO; working capital strain | **Critical** |
| P-11 | GST compliance | Invoicing in the accounting package; e-invoice/e-way bill handled transaction-by-transaction **(I)** | Reporting-window exposure; manual effort | Medium |
| P-12 | Attendance | Register and/or standalone biometric; field engineers effectively unmonitored **(I)** | No technician utilisation measure; payroll input disputes | High |
| P-13 | HR documentation | Appointment letters and statutory records in physical files **(I)** | Labour Code exposure; retrieval delay | Medium |
| P-14 | Document retrieval | Drawings, O&M manuals, test certificates, contracts and PO copies across email, drives and physical files **(I)** | Hours lost per week; institutional memory tied to individuals | High |
| P-15 | Approvals | Discount, purchase and leave approvals by phone/WhatsApp; no record of who approved what **(I)** | Accountability gap; audit weakness; delay | High |
| P-16 | Branch comparison | No like-for-like branch performance measure **(I)** | Underperformance persists unchallenged | High |
| P-17 | Rental fleet | Rental service offered **(V)**; asset location, utilisation and return condition tracked informally **(I)** | Idle-asset revenue loss; disputes on return | Medium |

### 3.3 Root-cause synthesis

The seventeen pain points reduce to **three structural root causes**:

1. **No system of record for operational objects.** The accounting ledger records money, not machines, commitments, or work. Anything that is not an accounting entry — an installed asset, an AMC due date, a retention balance, a commissioning submission — lives in a spreadsheet or a person's memory.
2. **No enforced lifecycle.** Because documents are files rather than states, nothing can expire, escalate, or age. Renewals, retentions and follow-ups fail silently rather than loudly.
3. **No aggregation layer.** With four verticals, multiple branches and a warehouse, leadership has no denominator. Performance cannot be compared, so it cannot be managed.

---

## 4. Problem Statement

> Bhushan Corp operates four commercially distinct engines — equipment distribution, field service and AMC, turnkey water projects, and rental — across multiple branches and a central warehouse, but has **no system of record for the operational objects that generate its margin** (installed assets, warranty and commissioning submissions, AMC commitments, BOQ progress, retention balances, receivables ageing) and **no aggregation layer** through which leadership can see them together. As a result, recurring revenue leaks through untracked renewals and warranty invalidation, cash remains locked in unpursued receivables and retention, OEM turnaround commitments are managed by memory rather than by clock, and leadership decisions are made on information that is assembled manually and is already stale on arrival.

---

## 5. Business Objectives and Success Criteria

Objectives are SMART, each mapped to measurable outcome KPIs. **Prototype-phase targets** are demonstrability targets (can the platform evidence this capability?); **Phase 2 targets** are operational outcome targets to be baselined during discovery.

| ID | Business objective | Outcome KPI | Baseline | Prototype success criterion | Phase 2 target (12 months) |
|---|---|---|---|---|---|
| **BO-01** | Give leadership a single morning view of the whole business | Time to answer "how is the business doing?" | Hours (manual assembly) **(I)** | Command centre renders full four-vertical position in ≤ 3 seconds from login | ≤ 60 seconds, self-service, no staff involvement |
| **BO-02** | Stop AMC and warranty revenue leakage | AMC renewal rate; warranty-expiry conversion | Not measured | Renewal radar surfaces every contract/warranty expiring in 30/60/90 days with owner and action | +15 percentage points on renewal rate |
| **BO-03** | Release cash trapped in receivables and retention | DSO; retention locked-up value | Not measured | Ageing buckets and retention register demonstrable with drill-down to source document | DSO reduced by 15%; ≥ 80% of eligible retention formally pursued |
| **BO-04** | Manage service turnaround against OEM commitments | SLA compliance %; first-time-fix rate (FTFR) | Not measured | Live SLA clocks with breach escalation; FTFR computed from job-card outcomes | ≥ 90% SLA compliance; FTFR ≥ 85% |
| **BO-05** | Protect warranty validity through disciplined commissioning | Commissioning reports submitted within OEM window | Not measured | Digital commissioning report with submission-window countdown and register | ≥ 98% within window |
| **BO-06** | Convert enquiries at a measured, improving rate | Enquiry→order conversion; quotation win rate | Not measured | Full funnel with stage ageing and win/loss reasons | Conversion measured and improved by 10% |
| **BO-07** | Eliminate manual coordination and report assembly | Staff hours/week on status collation | Estimated 15–25 h/week **(I)** | Every report in the platform is generated, not assembled | ≥ 70% reduction |
| **BO-08** | Make approvals fast, recorded and accountable | Median approval turnaround; % approvals with audit trail | Verbal, unrecorded | Multi-step approval engine with full audit trail and simulated WhatsApp action | Median ≤ 4 working hours; 100% audited |
| **BO-09** | Make institutional knowledge retrievable | Time to locate a document | Minutes to hours **(I)** | AI document search returns cited answers from the seeded corpus | ≤ 30 seconds, ≥ 90% first-attempt success |
| **BO-10** | Create like-for-like branch accountability | Branch league table adoption | Does not exist | League table ranks branches on sales, service, receivables | Reviewed monthly in management meeting |
| **BO-11** | Establish a defensible compliance posture | GST / Labour Code / DPDP readiness | Manual, undocumented | Compliance artefacts present: IRN/QR, statutory document vault, consent notice, audit log, DSR register | Zero compliance findings |
| **BO-12** | De-risk the digital investment itself | Scope approved before backend spend | N/A | Client signs off operating model from the prototype | Phase 2 delivered to approved spec, no rework |

### 5.1 Definition of success for this engagement

The engagement is successful when Bhushan Corp's leadership can, unaided, navigate the prototype end-to-end and state that **"this is how our business works, and this is the view we have been missing"** — and countersign the PRD as the specification for Phase 2.

---

## 6. Project Scope

### 6.1 In scope — this engagement (prototype)

| Module | Business capability | MoSCoW |
|---|---|---|
| M1 | Platform foundation: role-based login, application shell, navigation, theming, audit log, admin | **Must** |
| M2 | Leadership Command Centre: cross-vertical KPIs, branch league table, exception feed, AI daily briefing | **Must** |
| M3 | CRM & Sales Pipeline: customers, sites, contacts, enquiries, quotations, sales orders | **Must** |
| M4 | Service Desk, Job Cards & AMC: installed-asset register, tickets, SLA clocks, dispatch, job cards, spares consumption, commissioning & service reports, AMC lifecycle, renewal radar | **Must** |
| M5 | Projects & EPC Execution: projects, BOQ, milestones, DPRs, RA-bills, retention register | **Must** |
| M6 | Inventory, Spares & Warehouse: item master, stock ledger, reorder signal, goods movement | **Must** |
| M7 | Commercial: delivery challans, GST invoices with simulated IRN/QR, e-way bill, receipts, receivables ageing | **Must** |
| M8 | HR, Attendance & Workforce: employee register, geo/biometric-style attendance, leave, statutory document vault | **Must** |
| M9 | Document Vault & AI Document Intelligence: hierarchical vault, metadata, versioning, cited AI search | **Should** |
| M10 | Workflow, Approvals & Notifications: configurable approval chains, notification centre, simulated WhatsApp channel | **Should** |
| M11 | Analytics & KPI Studio: curated dashboards per vertical with drill-down and export | **Should** |
| M12 | AI Executive Assistant: natural-language querying over platform data, report drafting, anomaly surfacing | **Could** |
| — | Rental fleet register (asset, agreement, utilisation) — delivered as a feature set within M4/M6 | **Could** |

### 6.2 Out of scope — explicitly excluded from this engagement

Exclusions are deliberate. Each is stated with its reason so that the boundary is defensible in review.

| # | Excluded item | Reason for exclusion |
|---|---|---|
| X-01 | Production backend, database, hosting, authentication provider | Prototype validates the operating model; backend investment follows sign-off |
| X-02 | **Live** integrations to accounting, GST IRP, e-way bill portal, WhatsApp Business API, UPI/payment gateway, biometric devices, e-sign | Each requires client credentials, commercial agreements and OEM/vendor onboarding. All are **faithfully simulated** so the experience is complete |
| X-03 | **Statutory payroll computation engine** (salary calculation, EPF/ESIC/PT returns, Form 16, payslip generation) | Specialist compliance domain with continuous statutory change; specialist tools do this better and cheaper. Platform captures payroll *inputs* only |
| X-04 | Native iOS / Android applications | Responsive web fully evidences the field-engineer experience; native build is a post-validation investment |
| X-05 | Multi-tenant / white-label architecture | Single-client platform; multi-tenancy is premature complexity |
| X-06 | Self-service report builder / BI warehouse / OLAP layer | A curated, opinionated KPI set is more useful to this leadership team and materially less to maintain. Revisit only if demanded |
| X-07 | Autonomous AI agents taking business actions (auto-approving, auto-ordering, auto-replying to customers) | Retrieval-augmented systems still return materially incorrect answers in independent evaluation. Human-in-the-loop is a design commitment, not a limitation |
| X-08 | Customer-facing self-service portal | Real value, but a separate audience and trust model. Phase 3 candidate |
| X-09 | Public tender / e-procurement portal scraping and bid management | Legally and technically fragile; low prototype value |
| X-10 | Multi-language / Hindi UI | Confirmed English-primary user base. Architecture will be i18n-ready but no second locale is built |
| X-11 | Offline-first field application with conflict resolution | Significant engineering; deferred until field connectivity is measured in the pilot |
| X-12 | Data migration from spreadsheets and legacy files | Phase 2 workstream with its own discovery, cleansing and reconciliation plan |
| X-13 | Manufacturing / production planning, MRP | Bhushan Corp is a distribution, service and EPC business, not a manufacturer |
| X-14 | Fleet GPS telematics / vehicle tracking hardware | Adjacent problem; no dependency for the core model |

### 6.3 Deferred to Phase 2 / Phase 3 (in-principle scope, not this engagement)

| Phase | Candidate |
|---|---|
| Phase 2 | Production backend & database; accounting-ledger synchronisation; real GST e-invoice & e-way bill integration; WhatsApp Business API; biometric/geo attendance devices; SSO; data migration; UAT & training |
| Phase 3 | Customer self-service portal; native field app with offline capability; OEM portal integration; IoT compressor telemetry & predictive maintenance; supplier portal |

---

## 7. Stakeholder Analysis

### 7.1 Stakeholder register

| ID | Stakeholder | Interest | Influence | Engagement strategy |
|---|---|---|---|---|
| SH-01 | Director – Business (MD) | Growth, margin, visibility, professionalisation | **Decision-maker** | Primary demo audience; command centre designed for this persona |
| SH-02 | Director – Strategy / Founder | Legacy, customer relationships, channel standing | High | Emphasise OEM discipline, warranty protection, customer history |
| SH-03 | Branch / Sales Managers | Targets, pipeline, commission | High (adoption) | Show that the platform reduces their reporting burden, not adds to it |
| SH-04 | Service Manager / Coordinator | Turnaround, technician load, customer escalations | High (adoption) | Dispatch board and SLA clocks must feel faster than the WhatsApp group |
| SH-05 | Field Service Engineers | Simplicity on a phone, fewer forms | **Highest adoption risk** | Mobile job card must be genuinely faster than paper; keep taps minimal |
| SH-06 | Projects (EPC) Manager | Schedule, measurement, billing | High | BOQ → DPR → RA-bill chain must reflect real site practice |
| SH-07 | Accounts & Commercial | GST accuracy, collections, reconciliation | High | Ledger remains authoritative; platform must not threaten that |
| SH-08 | HR & Admin | Attendance accuracy, statutory files | Medium | Attendance and document vault, without payroll disruption |
| SH-09 | Store / Warehouse In-charge | Stock accuracy, issue discipline | Medium | Fast issue-against-job-card flow |
| SH-10 | OEM principals (ELGi, ATS-ELGi, KSB, Ion Exchange) | Channel compliance, warranty integrity | External, indirect | Commissioning and warranty registers strengthen channel standing |
| SH-11 | Institutional / government customers | Delivery, documentation, statutory invoices | External | Better documentation and faster response |
| SH-12 | Aravya delivery team | Scope clarity, sign-off | Delivery | This document set |

### 7.2 RACI — this engagement

| Activity | Client Sponsor | Client Module Owners | Aravya BA/SA | Aravya Engineering |
|---|---|---|---|---|
| Discovery & as-is confirmation | A | R | R | C |
| BRD approval | **A** | C | R | I |
| PRD approval | **A** | R | R | C |
| Backlog prioritisation | A | C | R | C |
| Seed-data realism validation | I | **R** | C | R |
| Prototype build | I | I | C | **R** |
| Module walkthrough & feedback | C | **R** | R | C |
| Final acceptance | **A** | R | C | C |
| Phase 2 scoping | A | C | R | R |

*R = Responsible, A = Accountable, C = Consulted, I = Informed*

---

## 8. Business Requirements

Requirements are traceable: **BR-xxx** (this document) → **FR-Mx-xxx** (PRD) → **Ex-Sx** (backlog). Priority uses MoSCoW.

### 8.1 Leadership visibility and decision support

| ID | Business requirement | Priority | Objective | Module |
|---|---|---|---|---|
| BR-001 | Leadership must see the consolidated position of all four verticals on a single screen without requesting data from staff | Must | BO-01 | M2 |
| BR-002 | Every headline number must be traceable by click-through to the underlying source document | Must | BO-01 | M2, all |
| BR-003 | Leadership must be able to compare branches on a like-for-like basis across sales, service and collections | Must | BO-10 | M2, M11 |
| BR-004 | The system must surface exceptions requiring management attention without the user searching for them | Must | BO-01 | M2, M10 |
| BR-005 | Leadership must receive a plain-language daily business briefing summarising position, movement and risks | Should | BO-01 | M2, M12 |
| BR-006 | Leadership must be able to ask business questions in natural language and receive answers sourced from platform data | Could | BO-01 | M12 |
| BR-007 | The system must detect and flag abnormal movements in key metrics rather than requiring the user to notice them | Could | BO-01 | M11, M12 |

### 8.2 Sales and customer management

| ID | Business requirement | Priority | Objective | Module |
|---|---|---|---|---|
| BR-008 | Every enquiry, regardless of arrival channel, must be captured as a tracked record with an accountable owner | Must | BO-06 | M3 |
| BR-009 | Quotations must be generated from a controlled item and price master, with version history and validity expiry | Must | BO-06 | M3 |
| BR-010 | Discounts beyond defined thresholds must require recorded approval before the quotation is issued | Must | BO-08 | M3, M10 |
| BR-011 | Won quotations must convert to sales orders without re-entry of data | Must | BO-06 | M3 |
| BR-012 | Lost quotations must capture a structured loss reason and competitor where known | Should | BO-06 | M3 |
| BR-013 | Each customer must present a unified history: sites, installed machines, tickets, contracts, orders, invoices, outstanding balance | Must | BO-01 | M3 |
| BR-014 | Pipeline must age automatically and escalate stalled opportunities | Should | BO-06 | M3, M10 |
| BR-015 | Sales performance must be measurable against target by branch, executive, vertical and product line | Should | BO-10 | M11 |

### 8.3 Service, warranty and AMC

| ID | Business requirement | Priority | Objective | Module |
|---|---|---|---|---|
| BR-016 | Every machine sold or serviced must exist as a serial-numbered installed asset with commissioning date, warranty status and full service history | Must | BO-05 | M4 |
| BR-017 | Service requests must be logged with a response and resolution clock derived from the applicable contract or OEM commitment | Must | BO-04 | M4 |
| BR-018 | Approaching and breached turnaround commitments must escalate automatically to named roles | Must | BO-04 | M4, M10 |
| BR-019 | Engineers must record work, observations, parts consumed and customer acknowledgement digitally from the field | Must | BO-04 | M4 |
| BR-020 | Commissioning must produce a structured digital report with a visible countdown to the OEM submission deadline, and a register of what was submitted when | Must | BO-05 | M4 |
| BR-021 | AMC contracts must hold scope, coverage type, visit schedule, value and renewal date, and must generate scheduled preventive-maintenance visits | Must | BO-02 | M4 |
| BR-022 | The system must proactively surface every AMC and warranty expiring within configurable horizons, with an accountable owner and next action | Must | BO-02 | M4, M2 |
| BR-023 | First-time-fix rate must be derived automatically from job-card outcomes, not entered manually | Should | BO-04 | M4, M11 |
| BR-024 | Technician utilisation and workload must be visible before dispatch decisions are made | Should | BO-04 | M4 |
| BR-025 | Rental assets must be tracked to customer, period, utilisation and return condition | Could | — | M4/M6 |

### 8.4 Projects and EPC

| ID | Business requirement | Priority | Objective | Module |
|---|---|---|---|---|
| BR-026 | Projects must hold a BOQ with itemised quantities, rates and cumulative executed quantity | Must | BO-03 | M5 |
| BR-027 | Project progress must be recorded through dated daily progress reports attributable to site staff | Must | BO-07 | M5 |
| BR-028 | RA-bills must be generated from executed BOQ quantities, with cumulative and current-period values, deductions and net payable | Must | BO-03 | M5, M7 |
| BR-029 | Retention withheld on every certified bill must be recorded, aggregated and tracked to release, with defect-liability expiry visible | Must | BO-03 | M5 |
| BR-030 | Milestone slippage must be visible against the approved schedule, with schedule variance quantified | Should | BO-07 | M5 |
| BR-031 | Project profitability must be visible as billed versus cost incurred against BOQ value | Should | BO-01 | M5, M11 |

### 8.5 Commercial, GST and cash

| ID | Business requirement | Priority | Objective | Module |
|---|---|---|---|---|
| BR-032 | Dispatches must produce a compliant delivery challan carrying the statutory triplicate designation | Must | BO-11 | M7 |
| BR-033 | Tax invoices must carry correct GST treatment (HSN/SAC, CGST/SGST/IGST, place of supply) and present IRN and signed QR | Must | BO-11 | M7 |
| BR-034 | Consignments above the statutory threshold must produce e-way bill data, and the system must prevent generation against a base document older than the permitted age | Must | BO-11 | M7 |
| BR-035 | Receivables must be aged into buckets with drill-down to invoice and customer, and must distinguish institutional/government exposure | Must | BO-03 | M7, M2 |
| BR-036 | Collection follow-up actions must be recordable against an invoice with a promised-payment date | Should | BO-03 | M7 |
| BR-037 | Invoices approaching the statutory e-invoice reporting window must be flagged before the window closes | Should | BO-11 | M7 |
| BR-038 | The accounting ledger remains the book of record; the platform must be designed to hand off, not to replace it | Must | — | M7 |

### 8.6 Inventory and spares

| ID | Business requirement | Priority | Objective | Module |
|---|---|---|---|---|
| BR-039 | A single item master must serve sales, service and projects, with category, unit, HSN and OEM part reference | Must | BO-07 | M6 |
| BR-040 | Stock must be maintained per location with a movement ledger attributable to a source document | Must | BO-07 | M6 |
| BR-041 | Parts issued against a job card must decrement stock and attach to the service record and its billing | Must | BO-04 | M6, M4 |
| BR-042 | Items below reorder level must be surfaced as an actionable list, prioritised by movement velocity | Must | BO-04 | M6 |
| BR-043 | Slow-moving and non-moving stock must be identifiable so that capital can be released | Should | BO-03 | M6, M11 |

### 8.7 Workforce

| ID | Business requirement | Priority | Objective | Module |
|---|---|---|---|---|
| BR-044 | Every employee must have a record holding role, branch, reporting line, joining date and statutory documents including the appointment letter | Must | BO-11 | M8 |
| BR-045 | Attendance must be capturable by office staff and by field engineers, with location evidence for field capture | Must | BO-12 | M8 |
| BR-046 | Leave must be requestable, approvable and visible as a balance, with a team calendar preventing coverage gaps | Must | BO-08 | M8, M10 |
| BR-047 | Attendance and leave must produce a monthly summary suitable as an input to external payroll | Must | X-03 boundary | M8 |
| BR-048 | Statutory HR documents must be stored with expiry awareness and retrievable on demand | Should | BO-11 | M8, M9 |

### 8.8 Knowledge, workflow and governance

| ID | Business requirement | Priority | Objective | Module |
|---|---|---|---|---|
| BR-049 | All business documents must be stored in a structured, permissioned vault, linked to the entity they relate to | Should | BO-09 | M9 |
| BR-050 | Users must be able to ask a question of the document corpus and receive an answer that cites the specific source documents | Should | BO-09 | M9 |
| BR-051 | AI-produced answers must always show provenance and must never be presented as authoritative without a source | Must | BO-09 | M9, M12 |
| BR-052 | Approvals must run on configurable multi-step chains with thresholds, delegation and full audit trail | Should | BO-08 | M10 |
| BR-053 | Notifications must reach users through in-app alerts and a messaging channel appropriate to Indian business practice | Should | BO-08 | M10 |
| BR-054 | Access must be governed by role, restricted by branch where applicable, and enforced consistently in navigation, data and actions | Must | BO-11 | M1 |
| BR-055 | Every create, update, delete, approval and export must be recorded in an immutable audit log | Must | BO-11 | M1 |
| BR-056 | The platform must present a data-protection consent notice and maintain a register of data-principal requests | Must | BO-11 | M1 |
| BR-057 | Data retention periods must be configurable per entity class, with retention actions logged | Should | BO-11 | M1 |

### 8.9 Non-functional business requirements

| ID | Business requirement | Priority | Module |
|---|---|---|---|
| BR-058 | The platform must be usable by staff with limited software exposure, in low-bandwidth conditions, on mid-range Android devices | Must | All |
| BR-059 | The interface must be visually distinct and credibly bespoke to Bhushan Corp — not a recognisable template | Must | All |
| BR-060 | The platform must meet WCAG 2.2 Level AA | Must | All |
| BR-061 | Seed data must be realistic to Bhushan Corp's trade, and must contain **no real personal data** | Must | All |
| BR-062 | The prototype must be demonstrable offline from a local build, without dependence on external services | Must | All |

---

## 9. Value Engineering — additions beyond the original proposal

The source proposal listed nine solution areas. Research into Bhushan Corp's actual trade identifies the following additions, each justified by a specific business mechanism rather than by feature appeal. These are the differentiators that make the platform recognisably *theirs*.

| # | Value addition | Business mechanism | Not in original proposal | Priority |
|---|---|---|---|---|
| **VA-01** | **AMC & Warranty Renewal Radar** | Converts an untracked spreadsheet into a forward-looking revenue pipeline with owners and horizons. Recurring revenue is the highest-margin engine and the easiest to lose | ✔ | Must |
| **VA-02** | **Locked-Cash Board (receivables ageing + retention register)** | Aggregates institutional receivables and project retention into one number leadership can act on. Retention is routinely forfeited simply because nobody is tracking it | ✔ | Must |
| **VA-03** | **Serial-numbered Installed-Asset Register with OEM commissioning countdown** | Protects warranty validity and channel standing by enforcing the OEM submission window; also becomes the service and spares upsell base | ✔ | Must |
| **VA-04** | **Digital field job card with location-stamped attendance and customer acknowledgement** | Automatically produces FTFR, technician utilisation and a defensible service record — three metrics that today do not exist | ✔ | Must |
| **VA-05** | **GST-authentic commercial documents (statutory challan, IRN + signed QR, e-way bill, stale-base-document block)** | Signals compliance credibility to institutional customers and removes manual portal work; directly relevant at Bhushan Corp's turnover band | ✔ | Must |
| **VA-06** | **WhatsApp-native approval and notification layer** | Matches how Indian SMEs actually coordinate; no DLT registration burden; service replies inside the customer window are free; far higher read rate than SMS | Partially | Should |
| **VA-07** | **Branch League Table** | Creates like-for-like accountability across the four branches on sales, service and collections — the fastest behavioural lever available to leadership | ✔ | Must |
| **VA-08** | **Spares reorder signal driven by service demand, not by guesswork** | Directly raises first-time-fix rate by ensuring fast-moving parts are on the shelf; releases capital held in non-moving stock | ✔ | Must |
| **VA-09** | **Cited AI document intelligence over drawings, manuals, contracts and certificates** | Turns institutional memory into a queryable asset with provenance; the citation-first design is also the honest answer to AI reliability | Refined | Should |

---

## 10. Assumptions, Constraints and Dependencies

### 10.1 Assumptions

| ID | Assumption | Impact if invalid |
|---|---|---|
| AS-001 | User base is 45–60 named users across 11 roles | Role model and licensing revision |
| AS-002 | Four branches plus one central warehouse | Location hierarchy and league table revision |
| AS-003 | The accounting package remains the statutory book of record and is retained | Commercial module scope expands materially |
| AS-004 | English is the working language of all software users | i18n workstream required |
| AS-005 | Field engineers carry Android smartphones with intermittent connectivity | Offline capability moves in scope (currently X-11) |
| AS-006 | Monthly volumes are in the order of tens of enquiries, tens of service tickets, single-digit projects | Pagination, virtualisation and archival strategy revision |
| AS-007 | Bhushan Corp can nominate module owners for validation sessions during the build | Feedback loop lengthens; seed-data realism weakens |
| AS-008 | Statutory positions stated in §2.4 remain current at Phase 2 kick-off | Compliance re-validation required |
| AS-009 | Brand assets (logo, colour references) will be supplied, or the live website may be used as the reference | Visual identity requires a design decision round |
| AS-010 | OEM commissioning and turnaround parameters are configurable, and exact current values will be confirmed | Configuration values updated; no structural change |

### 10.2 Constraints

| ID | Constraint |
|---|---|
| CN-001 | Labour Code central rules and DPDP enforcement are mid-implementation; compliance logic must be configuration-driven and effective-dated |
| CN-002 | Prototype is frontend-only: no persistent server-side data store, no real external calls |
| CN-003 | All external systems are simulated; no client credentials are requested or held during this engagement |
| CN-004 | No real personal data of employees or customers may be used in seed data |
| CN-005 | The prototype must run from a local build for demonstration in variable-connectivity environments |
| CN-006 | Statutory payroll computation is out of scope (X-03); the platform produces payroll inputs only |

### 10.3 Dependencies

| ID | Dependency | Owner | Needed by |
|---|---|---|---|
| DP-001 | Discovery session to close open questions in §12 | Client | Before PRD sign-off |
| DP-002 | Brand assets or approval to derive identity from the live website | Client | Before UI build |
| DP-003 | Sample real-world documents with commercials redacted (quotation, challan, invoice, job card, commissioning report, BOQ, RA-bill) | Client | Before seed-data build |
| DP-004 | Nomination of module owners per SH-03 to SH-09 | Client | Build phase |
| DP-005 | Confirmation of current OEM commissioning window and turnaround commitments | Client | Before M4 build |
| DP-006 | Confirmation of accounting package and version | Client | Phase 2 scoping |

---

## 11. RAID Log

### 11.1 Risks

| ID | Risk | Cat. | P | I | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|---|
| R-01 | Field engineers reject digital job cards as slower than paper | Adoption | H | H | **9** | Design the mobile job card to a hard budget of ≤ 6 taps for a standard visit; validate with two real engineers before build sign-off | Aravya + SH-04 |
| R-02 | Scope expands during demos as new ideas surface | Delivery | H | M | 6 | Documented exclusion list (§6.2) signed at BRD approval; all additions enter a Phase 2 register, none enter the prototype | Aravya |
| R-03 | Seed data feels generic, undermining credibility | Credibility | M | H | 6 | Build seed data from real redacted documents (DP-003); use genuine product nomenclature, Bihar geography, institutional project archetypes | Aravya |
| R-04 | Client interprets simulated integrations as working integrations | Expectation | M | H | 6 | Every simulated action carries a persistent "Simulated" indicator; a dedicated Integration Readiness screen states real-world prerequisites for each | Aravya |
| R-05 | AI features over-promise and then disappoint | Credibility | M | H | 6 | Citation-first design; visible confidence state; explicit "no confident answer" behaviour; no autonomous actions (X-07) | Aravya |
| R-06 | Statutory change during or after build | Compliance | M | M | 4 | Configuration-driven compliance parameters with effective dates; re-validation checkpoint at Phase 2 kick-off | Both |
| R-07 | Branch league table triggers internal political resistance | Change | M | M | 4 | Introduce as coaching and comparison, normalised for branch size; sponsor-led framing | SH-01 |
| R-08 | Prototype's simulated performance sets unrealistic expectations for real data volumes | Technical | M | M | 4 | Seed to realistic multi-year volumes; virtualise tables; publish measured render performance | Aravya |
| R-09 | Accounting team perceives the platform as a threat to the ledger | Adoption | M | M | 4 | Explicit design principle: ledger is the book of record (BR-038); position as hand-off, not replacement | Aravya + SH-07 |
| R-10 | Headcount / branch ambiguity causes rework in role and location models | Requirements | M | L | 2 | Close in discovery (DP-001); model both configurations as data, not code | Aravya |

*P/I scale: H=3, M=2, L=1. Score = P × I.*

### 11.2 Issues (open at issue of this document)

| ID | Issue | Action | Owner |
|---|---|---|---|
| I-01 | Conflicting headcount (35 vs 55) in public sources | Confirm in discovery | Client |
| I-02 | Incumbent accounting package unknown | Confirm in discovery | Client |
| I-03 | Actual transaction volumes unknown | Confirm in discovery | Client |
| I-04 | Brand colour references not formally supplied | Supply assets or approve website derivation | Client |

### 11.3 Dependencies

*See §10.3.*

---

## 12. Open Questions for Discovery

To be closed before PRD sign-off. Answers become documented assumptions if unavailable.

**Organisation & scale**
1. Confirmed employee headcount, and how many require platform access?
2. Names, locations and functions of the four branches; which is the primary warehouse?
3. Current organisation chart with designations and reporting lines?

**Commercial systems**
4. Which accounting package, which version, on-premise or cloud?
5. Who currently generates GST invoices, e-invoices and e-way bills, and in which system?
6. Confirmed aggregate annual turnover band, for e-invoicing threshold determination?

**Sales**
7. Approximate monthly enquiry and quotation volume? Typical quotation validity period?
8. Discount authority thresholds by role?
9. Is there a defined price list per OEM, and how often does it change?

**Service**
10. Monthly service ticket volume? Split between warranty, AMC and chargeable?
11. Number of live AMC contracts, and split between comprehensive and non-comprehensive?
12. Current OEM commissioning submission window and turnaround commitments, per principal?
13. Number of field engineers, and how are they currently assigned?
14. Approximate count of installed machines under coverage?

**Projects**
15. Number of live projects, and typical value band and duration?
16. Standard retention percentage and defect-liability period by client type?
17. Who prepares BOQ and measurement records today?

**Inventory**
18. Approximate number of active SKUs, and are fast-moving spares already identified?
19. Is stock currently tracked in the accounting package or separately?

**Workforce**
20. Current attendance mechanism? Any existing biometric hardware, and which make?
21. Which payroll tool or process is used today?

**Documents & IT**
22. Where do drawings, O&M manuals, test certificates and contracts currently live?
23. Existing email/collaboration platform (Google Workspace / Microsoft 365 / other)?
24. Any existing software the platform must coexist with?

---

## 13. Business KPI Dictionary

Each KPI has a single authoritative formula, so that the same number cannot be computed two ways.

| ID | KPI | Formula | Owner role | Frequency |
|---|---|---|---|---|
| K-01 | Enquiry→Order conversion % | Sales orders won ÷ enquiries received in period × 100 | Branch Manager | Monthly |
| K-02 | Quotation win rate % | Quotations won ÷ (won + lost) × 100 | Branch Manager | Monthly |
| K-03 | Average quotation ageing (days) | Mean (today − quotation date) for open quotations | Branch Manager | Weekly |
| K-04 | Order book value | Σ value of confirmed orders not yet fully invoiced | Director – Business | Weekly |
| K-05 | SLA compliance % | Tickets resolved within applicable commitment ÷ tickets closed × 100 | Service Manager | Weekly |
| K-06 | First-time-fix rate (FTFR) % | Tickets closed on first visit ÷ tickets closed × 100 | Service Manager | Weekly |
| K-07 | Mean time to respond / restore (hours) | Mean (first-response − logged); mean (restored − logged) | Service Manager | Weekly |
| K-08 | Technician utilisation % | Productive field hours ÷ available hours × 100 | Service Manager | Weekly |
| K-09 | AMC renewal rate % | Contracts renewed ÷ contracts falling due × 100 | Service Manager | Monthly |
| K-10 | AMC contract-attach rate % | Installed assets under live AMC ÷ total eligible installed assets × 100 | Service Manager | Monthly |
| K-11 | Warranty exposure (count / value) | Installed assets in warranty; estimated remaining obligation | Service Manager | Monthly |
| K-12 | Commissioning submission compliance % | Reports submitted within OEM window ÷ commissionings × 100 | Service Manager | Monthly |
| K-13 | Spares revenue mix % | Spares & service revenue ÷ total revenue × 100 | Director – Business | Monthly |
| K-14 | DSO (days) | (Closing receivables ÷ credit sales in period) × days in period | Accounts | Monthly |
| K-15 | Receivables ageing distribution | Outstanding split into 0–30 / 31–60 / 61–90 / 90+ days | Accounts | Weekly |
| K-16 | Retention locked-up | Σ retention withheld on certified bills not yet released | Projects Manager | Monthly |
| K-17 | Project schedule variance % | (Actual cumulative progress − planned) ÷ planned × 100 | Projects Manager | Weekly |
| K-18 | Project billing realisation % | Cumulative certified value ÷ cumulative executed BOQ value × 100 | Projects Manager | Monthly |
| K-19 | Stock-out incidence | Job cards delayed or reopened due to parts unavailability ÷ total job cards × 100 | Store In-charge | Monthly |
| K-20 | Non-moving stock value | Σ value of items with zero issues in the trailing 180 days | Store In-charge | Quarterly |
| K-21 | Approval turnaround (median hours) | Median (decision timestamp − request timestamp) | Director – Business | Monthly |
| K-22 | Rental utilisation % | Days on rent ÷ days available, per asset | Service Manager | Monthly |

> **Benchmark caveat:** External benchmarks referenced during research (first-time-fix around 80% as a general field-service average; service and parts contributing a large share of gross profit in dealership models) derive from global field-service and automotive-dealership sources. They are directionally useful for target-setting but are **not** India industrial-equipment benchmarks. Bhushan Corp's own baselines, established in the first quarter of live operation, are the only authoritative reference.

---

## 14. Business Case Summary

### 14.1 Value hypothesis

The platform's return is not primarily labour savings; it is **leak closure**. Four leaks are individually quantifiable once baselines exist:

| Leak | Mechanism | Platform intervention | Measured by |
|---|---|---|---|
| Lapsed AMC renewals | Renewals visible only when remembered | Renewal radar with owner and horizon (VA-01) | K-09, K-10 |
| Invalidated warranty claims | Commissioning report late or unlocatable | Digital commissioning + submission-window countdown and register (VA-03) | K-12 |
| Forfeited retention | No central retention register | Retention register tracked to release (VA-02) | K-16 |
| Extended receivables | Ageing invisible; follow-up ad hoc | Locked-cash board with drill-down and follow-up log (VA-02) | K-14, K-15 |

Secondary returns: reduced second visits through parts availability (K-19 → K-06), released working capital from non-moving stock (K-20), reduced management time on report assembly (BO-07), and faster approvals (K-21).

### 14.2 Cost posture

| Aspect | Position |
|---|---|
| This engagement | One-time prototype build; no licence, hosting, integration or migration cost |
| Comparison | Off-the-shelf suites at Bhushan Corp's headcount imply an indicative ₹8–10 lakh per year, recurring and escalating, at list prices as of 2026 |
| Ownership | The platform is a Bhushan Corp asset; the specification and design system transfer with it |
| Decision gate | Phase 2 investment is authorised only after the operating model is validated in the prototype |

### 14.3 Recommendation

Proceed with the prototype as scoped in §6.1, with the exclusions in §6.2 held firm, and with the value additions in §9 treated as the core differentiators. Convene the discovery session (§12) before PRD sign-off, and retain the position that the accounting ledger and statutory payroll remain outside the platform boundary.

---

## 15. Phased Roadmap (Business View)

| Phase | Name | Duration (indicative) | Business outcome | Gate |
|---|---|---|---|---|
| **0** | Discovery & confirmation | 1 week | Open questions closed; assumptions ratified; sample documents received | BRD & PRD signed |
| **1** | **Prototype (this engagement)** | 4–6 weeks | Complete operating model demonstrable end-to-end with realistic data; all integrations simulated | Leadership sign-off on operating model |
| **2** | Production build | 12–16 weeks | Live platform with backend, real GST and messaging integrations, ledger hand-off, attendance devices, migrated data, trained users | UAT sign-off; pilot branch live |
| **3** | Extension | 8–12 weeks | Customer portal, native field app with offline capability, OEM/supplier interfaces, IoT-based predictive maintenance | Business case per item |

---

## 16. Traceability Overview

| Objective | Business requirements | Modules | Epics |
|---|---|---|---|
| BO-01 Leadership visibility | BR-001–007, BR-013 | M2, M11, M12 | E2, E11, E12 |
| BO-02 Stop AMC/warranty leakage | BR-016, BR-021, BR-022 | M4, M2 | E4, E2 |
| BO-03 Release trapped cash | BR-029, BR-035, BR-036, BR-043 | M5, M7 | E5, E7 |
| BO-04 Service turnaround | BR-017–019, BR-023, BR-024, BR-041 | M4, M6 | E4, E6 |
| BO-05 Warranty protection | BR-016, BR-020 | M4 | E4 |
| BO-06 Sales conversion | BR-008–012, BR-014 | M3 | E3 |
| BO-07 Eliminate manual collation | BR-027, BR-039, BR-040 | M5, M6, M11 | E5, E6, E11 |
| BO-08 Fast accountable approvals | BR-010, BR-046, BR-052, BR-053 | M10 | E10 |
| BO-09 Retrievable knowledge | BR-049–051 | M9 | E9 |
| BO-10 Branch accountability | BR-003, BR-015 | M2, M11 | E2, E11 |
| BO-11 Compliance posture | BR-032–034, BR-037, BR-044, BR-054–057 | M1, M7, M8 | E1, E7, E8 |
| BO-12 De-risk investment | BR-058–062 | All | E13 |

---

## 17. Glossary

| Term | Meaning |
|---|---|
| **AMC** | Annual Maintenance Contract. *Comprehensive* includes spares; *non-comprehensive* covers labour and visits only |
| **AATO** | Aggregate Annual Turnover, as defined for GST purposes |
| **BOQ** | Bill of Quantities — itemised schedule of work with quantities and rates, the basis of EPC billing |
| **CFM** | Cubic Feet per Minute — air-delivery rating of a compressor |
| **CNR / IRN** | IRN = Invoice Reference Number issued by the Invoice Registration Portal for an e-invoice |
| **Delivery Challan** | Statutory GST document accompanying goods movement, issued in triplicate under CGST Rule 55 |
| **DLT** | Distributed Ledger Technology registration required by TRAI for transactional SMS in India |
| **DPR** | Daily Progress Report — dated site record of work executed, manpower and plant deployed |
| **DPDP** | Digital Personal Data Protection Act 2023 and DPDP Rules 2025 |
| **DSO** | Days Sales Outstanding |
| **ETP / STP** | Effluent Treatment Plant / Sewage Treatment Plant |
| **E-way bill** | Electronic movement document required above the statutory consignment value |
| **FTFR** | First-Time-Fix Rate |
| **HSN / SAC** | Harmonised System of Nomenclature (goods) / Services Accounting Code — GST classification codes |
| **KLD** | Kilolitres per Day — capacity rating of a treatment plant |
| **Muster roll** | Statutory attendance record |
| **O&M** | Operations & Maintenance |
| **PPR piping** | Polypropylene Random copolymer piping, used in compressed-air and water distribution |
| **RA-bill** | Running Account Bill — periodic interim payment claim on an EPC contract, cumulative in form |
| **RCM** | Reverse Charge Mechanism under GST |
| **Retention money** | Percentage withheld from certified bills, released after the defect-liability period |
| **SLA** | Service Level Agreement — contractual response and restoration commitments |

---

## 18. Reference Notes

Public-domain sources consulted in the preparation of this document (accessed July 2026). Cited for traceability of factual claims; all descriptive content in this document is Aravya's own analysis.

**Client and market**
- Bhushancorp Private Limited — corporate website (bhushancorp.in): company history, product lines, service and rental offerings
- MCA-derived company records (CIN, incorporation, directors, capital) via public company-information services
- India 5000 Best MSME Awards 2024 listing — employee count and category
- B2B directory listing — turnover band and completed project references (IGIMS 1200 KLD STP, RMIRMS ETP, AIIMS Patna sewage pipeline)

**Regulatory**
- GSTN advisories on e-invoicing thresholds and the 30-day IRP reporting requirement for AATO ≥ ₹10 crore
- CGST Rules — Rule 55 (delivery challan), e-way bill provisions and thresholds
- Press Information Bureau and professional-services commentary on the commencement of the four Labour Codes (21 November 2025) and the gazetting of draft Central Rules (30 December 2025)
- MeitY notification of the DPDP Rules 2025 (13 November 2025) and associated breach-notification and penalty provisions

**Product and integration benchmarks**
- Zoho One published India pricing (2026)
- Published pricing for Indian HR/attendance platforms (Keka, greytHR, Kredily)
- Meta WhatsApp Business Platform pricing model change effective 1 July 2025, including the free service-message window
- OEM technical and service literature for compressor commissioning documentation and restoration commitments
- ERP and field-service product documentation for standard document lifecycles (quotation → order → challan → invoice; ticket → job card → service report)

**Methodology**
- IIBA/BABOK-aligned conventions for BRD structure and requirement traceability
- INVEST criteria and Gherkin acceptance-criteria conventions for backlog decomposition
- W3C WCAG 2.2 Level AA success criteria
- Independent academic evaluation of retrieval-augmented legal research tools reporting materially non-trivial rates of incorrect output, informing the citation-first and human-in-the-loop AI design stance

> **Correction of record:** two claims commonly repeated in secondary sources were tested and are **not** relied upon in this document — (i) a "three-day" e-invoice IRP reporting window said to apply from October 2025 is not corroborated by GSTN; the confirmed rule is the 30-day window for AATO ≥ ₹10 crore effective 1 April 2025; and (ii) India WhatsApp template rates are published by Meta in USD at very low per-message levels, and a widely circulated rupee figure conflates a different market's authentication rate.

---

**End of Business Requirements Document — ARV-BC-BRD-001 v1.0**
