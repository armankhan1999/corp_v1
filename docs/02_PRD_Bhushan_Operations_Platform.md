# Product Requirements Document (PRD)

## "Pravaah" — Unified Operations & Intelligence Platform for Bhushancorp Private Limited

| Field | Detail |
|---|---|
| **Document Type** | Product Requirements Document (PRD) |
| **Document ID** | ARV-BC-PRD-001 |
| **Version** | 1.0 |
| **Date** | 31 July 2026 |
| **Prepared By** | Solution Architecture & Product, Aravya (aravya.in) |
| **Prepared For** | Bhushancorp Private Limited, Patna, Bihar |
| **Parent Document** | ARV-BC-BRD-001 v1.0 (Business Requirements) |
| **Child Document** | ARV-BC-EPC-001 v1.0 (Epics & User Stories) |
| **Delivery Scope** | Phase 1 — high-fidelity frontend prototype, simulated integrations |
| **Status** | Issued for Client Review |
| **Classification** | Confidential |

### Revision History

| Ver | Date | Author | Change Summary |
|---|---|---|---|
| 1.0 | 31 Jul 2026 | Aravya | First issue — modules, functional requirements, data model, RBAC, design system, NFRs, seed-data spec, demo script |

---

## 1. Product Vision & Positioning

### 1.1 Vision statement

> **Pravaah is the operating surface of Bhushan Corp** — one place where every machine sold, every service commitment made, every rupee owed and every project underway is visible, accountable and actionable, so that a business built over four decades can be run from evidence rather than from memory.

### 1.2 Product name and rationale

**Pravaah** (प्रवाह) — Sanskrit/Hindi for *flow* or *current*.

| Reason | Explanation |
|---|---|
| Domain resonance | Bhushan Corp's entire trade is the movement of flows — compressed air, water, effluent. The name is literally descriptive of what the customer's machines do |
| Operational resonance | The platform's purpose is to make work, documents, approvals and cash flow rather than stall |
| Cultural fit | Indian-rooted, dignified, pronounceable, unmistakably not a generic SaaS coinage |
| Availability | Short, memorable, works as a subdomain (`pravaah.bhushancorp.in`) and as a product wordmark |

**Alternates if the client prefers:** *Setu* (bridge), *Kendra* (centre), *BC One*, *Bhushan Command*.

> **PD-001 (Product decision required):** Confirm product name before UI build. Naming is applied in one place in the theme configuration; changing it later is a find-and-replace, but the wordmark and favicon are design work.

### 1.3 Positioning statement

| Element | Statement |
|---|---|
| **For** | The leadership and operating teams of Bhushan Corp |
| **Who** | Run four commercially distinct engines (equipment distribution, field service & AMC, turnkey water projects, rental) across four branches and a central warehouse |
| **Pravaah is** | A role-aware operations and intelligence platform |
| **That** | Models their actual statutory and commercial documents, enforces their OEM and contractual commitments, and consolidates all four engines into a single leadership view |
| **Unlike** | Generic business suites and per-seat SaaS subscriptions |
| **Pravaah** | Is built around serial-numbered installed assets, OEM commissioning obligations, BOQ and retention lifecycles, and Indian statutory documents — and is owned outright rather than rented |

### 1.4 Design principles

These are binding. Any feature that violates one is rejected regardless of appeal.

| # | Principle | Practical test |
|---|---|---|
| **DP-1** | **Every number is a doorway.** No metric exists that cannot be clicked to its source records | Can I get from a KPI card to an individual invoice in ≤ 3 clicks? |
| **DP-2** | **Lifecycle over storage.** Objects have states that age, escalate and expire; nothing fails silently | Does this object know when it is overdue, and who to tell? |
| **DP-3** | **Honest AI.** AI retrieves, summarises and drafts. It cites. It never acts autonomously and never asserts without provenance | Can the user see exactly which record produced this sentence? |
| **DP-4** | **The field is the constraint.** If a field engineer cannot complete it one-handed on a mid-range Android on 3G, it is redesigned | Standard visit closed in ≤ 6 taps? |
| **DP-5** | **Simulation is labelled.** Every simulated integration is visibly marked; the prototype never pretends to be connected | Is the "Simulated" affordance visible without hovering? |
| **DP-6** | **Indian by default.** Lakh/crore formatting, DD MMM YYYY dates, GST document semantics, WhatsApp-first notification, IST | Would an Indian accountant recognise this as their own paperwork? |
| **DP-7** | **Density with air.** Enterprise information density, but with disciplined whitespace and typographic hierarchy — not a wall of grey tables | Can the eye find the one thing that matters in under two seconds? |
| **DP-8** | **Refuse scope.** The exclusion list in the BRD is a feature of the product, not a limitation of it | Is this in BRD §6.1? If not, it goes to the Phase 2 register |

### 1.5 Goals and non-goals

**Product goals**
1. A leadership command centre that answers "how is the business doing?" in one screen and three seconds.
2. Complete, walkable lifecycles for all four verticals with statutorily authentic documents.
3. Automatic derivation of every KPI in the BRD dictionary from transactional records — never manual entry.
4. A field experience fast enough that engineers prefer it to paper.
5. A visual identity credibly bespoke to Bhushan Corp.
6. AI that is useful and honest, in three narrow roles: retrieve with citation, summarise, draft.

**Product non-goals (this release)**
1. Not a general-purpose ERP or accounting system.
2. Not a statutory payroll engine.
3. Not a report builder.
4. Not an autonomous agent platform.
5. Not a customer-facing product.
6. Not a native mobile application.

---

## 2. Personas

Nine personas drive the design. Each has an explicit "first ninety seconds" — what they must be able to do immediately on login — which becomes the acceptance test for their landing experience.

### P1 — Director, Business (Managing Director)

| Attribute | Detail |
|---|---|
| Archetype | Second-generation leader, professionally educated, previously in a structured corporate environment; now running a legacy family business he intends to modernise |
| Devices | Laptop primary, phone constantly |
| Software comfort | High; expects the polish of consumer-grade tools |
| Reports to | Board / founder |
| Owns | P&L, growth, professionalisation |
| Jobs to be done | Know the position of all four verticals; know what is broken today; know which branch is lagging; approve what needs approving; not chase staff for numbers |
| Frustrations | Numbers arrive late, differ between sources, and require a phone call to obtain |
| Success feeling | "I opened the laptop and I already knew." |
| **First ninety seconds** | Command centre loads → four vertical health tiles + locked-cash figure + exception feed + AI daily briefing → one click into the worst exception |
| Key screens | M2 Command Centre, M11 Analytics, M10 Approvals, M12 Assistant |

### P2 — Director, Strategy (Founder)

| Attribute | Detail |
|---|---|
| Archetype | Founder of the original 1985 business; deep customer and OEM relationships; the institutional memory of the firm |
| Devices | Phone primary, tablet |
| Software comfort | Moderate; values clarity and large legible type over density |
| Jobs to be done | See customer relationships and history; protect OEM channel standing; approve exceptions; check the health of long-standing accounts |
| Frustrations | Details he personally remembers are not written down anywhere |
| Success feeling | "Forty years of relationships are finally recorded." |
| **First ninety seconds** | Simplified executive view → top accounts by lifetime value → customer 360 for any account → OEM commissioning compliance tile |
| Key screens | M2 (executive mode), M3 Customer 360, M4 Commissioning register |

### P3 — Branch / Sales Manager

| Attribute | Detail |
|---|---|
| Archetype | Runs one of four branches; carries a sales target; manages 3–6 sales executives; technically literate about compressors and pumps |
| Devices | Laptop and phone |
| Jobs to be done | Work the pipeline; chase ageing quotations; get discount approvals fast; hit target; not lose enquiries |
| Frustrations | No visibility of which quotations are going cold; approvals wait on a phone call |
| Success feeling | "Nothing in my pipeline is invisible to me." |
| **First ninety seconds** | Branch pipeline board → ageing quotations flagged → today's follow-ups → target vs achieved gauge |
| Key screens | M3 Pipeline, M3 Quotations, M11 Sales analytics, M2 Branch league table |

### P4 — Service Manager / Service Coordinator

| Attribute | Detail |
|---|---|
| Archetype | The operational nerve centre; fields customer escalations; assigns engineers; owns turnaround commitments to customers and OEM |
| Devices | Desktop all day, phone for escalations |
| Jobs to be done | See every open ticket and its clock; dispatch the right engineer; ensure parts are available; close commissioning paperwork within the OEM window; renew AMCs |
| Frustrations | Everything lives in a WhatsApp group; no clock; no record of who was told what |
| Success feeling | "I can see every clock in the business." |
| **First ninety seconds** | Dispatch board → tickets sorted by time-to-breach → red breaches at top → drag-assign to an available engineer → renewal radar |
| Key screens | M4 Dispatch board, M4 Ticket detail, M4 AMC & renewal radar, M4 Commissioning register, M6 Stock check |

### P5 — Field Service Engineer

| Attribute | Detail |
|---|---|
| Archetype | OEM-trained technician; 4–15 site visits a week; may be on a customer's shop floor with oil on their hands; connectivity variable |
| Devices | Mid-range Android phone, 3G/4G, sometimes no data at site |
| Software comfort | Low to moderate; WhatsApp-fluent; hostile to forms |
| Jobs to be done | Know today's jobs and addresses; mark arrival; record what was done and which parts were used; get the customer's signature; leave |
| Frustrations | Paper job cards get lost or wet; being asked to fill the same information twice |
| Success feeling | "It's faster than the paper card." |
| **First ninety seconds** | Today's assigned jobs list with addresses and machine details → tap job → check in (location captured) → guided job card |
| Key screens | M8 Attendance check-in, M4 My Jobs, M4 Mobile job card, M4 Commissioning report, M6 Parts request |
| **Hard constraint** | Standard visit closable in ≤ 6 taps; every screen must be operable one-handed with thumb reach |

### P6 — Projects (EPC) Manager

| Attribute | Detail |
|---|---|
| Archetype | Engineer running STP/ETP and pipeline works for institutional and government clients; lives between site, office and client engineers |
| Devices | Laptop and phone |
| Jobs to be done | Track BOQ execution against plan; capture site progress; raise RA-bills on time; pursue retention release; keep the defect-liability clock visible |
| Frustrations | Measurement records in spreadsheets; RA-bills late; retention forgotten once a project closes |
| Success feeling | "Every rupee we've earned is claimed, and every rupee withheld is being chased." |
| **First ninety seconds** | Project portfolio → schedule variance flags → BOQ execution progress bars → RA-bill due list → retention register total |
| Key screens | M5 Project portfolio, M5 BOQ, M5 DPR, M5 RA-bill, M5 Retention register |

### P7 — Accounts & Commercial Executive

| Attribute | Detail |
|---|---|
| Archetype | Raises invoices, manages GST documents, chases collections, reconciles with the accounting ledger |
| Devices | Desktop |
| Software comfort | High within accounting software; expects statutory correctness |
| Jobs to be done | Raise correct GST invoices; produce challans and e-way bills; know ageing; log collection follow-ups; keep the ledger reconciled |
| Frustrations | Data re-entry between systems; discovering a reporting window has closed |
| Success feeling | "The paperwork is right the first time." |
| **First ninety seconds** | Receivables ageing → 90+ bucket → invoice detail → log follow-up with promised date → e-invoice window warnings |
| Key screens | M7 Invoices, M7 Challans, M7 E-way bill, M7 Receivables ageing, M7 Ledger hand-off |

### P8 — HR & Admin Executive

| Attribute | Detail |
|---|---|
| Archetype | Manages 45–60 staff records, attendance, leave and statutory files across four locations |
| Devices | Desktop |
| Jobs to be done | Confirm daily attendance including field staff; process leave; maintain appointment letters and statutory documents; produce a monthly attendance summary for payroll |
| Frustrations | Field staff attendance is unverifiable; documents are in physical files |
| Success feeling | "Month-end takes an hour, not three days." |
| **First ninety seconds** | Today's attendance board (present / absent / on leave / field) → exceptions → pending leave approvals |
| Key screens | M8 Attendance, M8 Leave, M8 Employee register, M8 Statutory documents |

### P9 — Store / Warehouse In-charge

| Attribute | Detail |
|---|---|
| Archetype | Runs the central warehouse; issues parts against job cards and projects; receives OEM consignments |
| Devices | Desktop, tablet on the floor |
| Jobs to be done | Issue parts fast against a job card; receive stock; know what to reorder; complete stock counts |
| Frustrations | Being asked whether a part is in stock, repeatedly, by phone |
| Success feeling | "Nobody has to call me to know what's on the shelf." |
| **First ninety seconds** | Pending issue requests → issue against job card → reorder list sorted by velocity → today's receipts |
| Key screens | M6 Stock, M6 Issue/receipt, M6 Reorder list |

### Deferred persona — Customer (Phase 3)

Institutional and industrial customers would eventually value a self-service view of their machines, tickets, AMC status and invoices. Explicitly excluded (BRD X-08); noted here so the data model does not preclude it.

### 2.1 Persona → landing route matrix

| Role | Landing route | Density default | Theme default |
|---|---|---|---|
| DIRECTOR_BUSINESS | `/command` | Comfortable | Dark |
| DIRECTOR_STRATEGY | `/command?view=executive` | Comfortable, large type | Light |
| BRANCH_MANAGER | `/sales/pipeline` | Compact | Dark |
| SALES_EXEC | `/sales/my-desk` | Compact | Dark |
| SERVICE_MANAGER | `/service/dispatch` | Compact | Dark |
| FIELD_ENGINEER | `/field/today` | Mobile-first | Light (outdoor legibility) |
| PROJECT_MANAGER | `/projects` | Compact | Dark |
| ACCOUNTS_EXEC | `/commercial/receivables` | Compact | Light |
| HR_ADMIN | `/people/attendance` | Compact | Light |
| STORE_INCHARGE | `/inventory/issues` | Compact | Light |
| AUDITOR | `/admin/audit` | Compact | Light |
| SUPER_ADMIN | `/admin` | Compact | Dark |

---

## 3. Information Architecture

### 3.1 Navigation model

Primary navigation is a persistent left rail (240 px expanded, 64 px collapsed) grouped by **business function, not by module number**. Secondary navigation is in-page tabs. A global command palette (`Cmd/Ctrl + K`) provides direct access to any record, screen or action.

```
Pravaah
│
├── COMMAND
│   └── Command Centre                    /command
│       ├── Executive view                /command?view=executive
│       ├── Branch league table           /command/branches
│       └── Exception feed                /command/exceptions
│
├── SALES
│   ├── My Desk                           /sales/my-desk
│   ├── Pipeline                          /sales/pipeline
│   ├── Enquiries                         /sales/enquiries
│   ├── Quotations                        /sales/quotations
│   ├── Sales Orders                      /sales/orders
│   └── Customers                         /sales/customers
│       └── Customer 360                  /sales/customers/[id]
│
├── SERVICE
│   ├── Dispatch Board                    /service/dispatch
│   ├── Tickets                           /service/tickets
│   ├── Job Cards                         /service/job-cards
│   ├── Installed Assets                  /service/assets
│   │   └── Asset passport                /service/assets/[serial]
│   ├── AMC Contracts                     /service/amc
│   ├── Renewal Radar                     /service/renewals
│   ├── Commissioning Register            /service/commissioning
│   └── Rental Fleet                      /service/rental
│
├── PROJECTS
│   ├── Portfolio                         /projects
│   ├── Project workspace                 /projects/[id]
│   │   ├── BOQ                           /projects/[id]/boq
│   │   ├── Progress (DPR)                /projects/[id]/dpr
│   │   ├── RA-Bills                      /projects/[id]/ra-bills
│   │   └── Retention                     /projects/[id]/retention
│   └── Retention Register (all)          /projects/retention
│
├── INVENTORY
│   ├── Stock                             /inventory/stock
│   ├── Issue & Receipt                   /inventory/movements
│   ├── Reorder List                      /inventory/reorder
│   ├── Item Master                       /inventory/items
│   └── Suppliers & POs                   /inventory/purchase
│
├── COMMERCIAL
│   ├── Receivables                       /commercial/receivables
│   ├── Invoices                          /commercial/invoices
│   ├── Delivery Challans                 /commercial/challans
│   ├── E-Way Bills                       /commercial/eway
│   ├── Receipts                           /commercial/receipts
│   └── Ledger Hand-off                   /commercial/handoff
│
├── PEOPLE
│   ├── Attendance                        /people/attendance
│   ├── Leave                             /people/leave
│   ├── Employees                         /people/employees
│   └── Statutory Documents               /people/documents
│
├── KNOWLEDGE
│   ├── Document Vault                    /vault
│   └── Ask the Vault (AI)                /vault/ask
│
├── WORKFLOW
│   ├── My Approvals                      /workflow/approvals
│   ├── Approval Chains                   /workflow/chains
│   └── Notification Centre               /workflow/notifications
│
├── ANALYTICS
│   ├── Sales                             /analytics/sales
│   ├── Service                           /analytics/service
│   ├── Projects                          /analytics/projects
│   ├── Cash                              /analytics/cash
│   └── Inventory                         /analytics/inventory
│
├── ASSISTANT                             /assistant
│
├── FIELD (mobile-first, role-scoped)
│   ├── Today                             /field/today
│   ├── Job card                          /field/job/[id]
│   ├── Commissioning                     /field/commissioning/[assetId]
│   └── Attendance                        /field/attendance
│
└── ADMIN
    ├── Users & Roles                     /admin/users
    ├── Permission Matrix                 /admin/permissions
    ├── Masters                           /admin/masters
    ├── Integration Readiness             /admin/integrations
    ├── Compliance & Consent              /admin/compliance
    ├── Audit Log                         /admin/audit
    └── Demo Controls                     /admin/demo
```

### 3.2 Cross-cutting UI furniture

| Element | Behaviour |
|---|---|
| Global header | Product wordmark, global search, command palette hint, branch scope selector, notification bell with count, theme toggle, density toggle, "View as role" switcher (demo affordance), user menu |
| Branch scope selector | Filters all data to a branch or "All branches"; disabled and locked for branch-scoped roles |
| Command palette | Fuzzy search across records (customer, asset serial, ticket, invoice, project, document), screens, and actions |
| Notification bell | In-app notification centre with unread state, grouped by type |
| Breadcrumbs | On all detail routes |
| Simulated-integration badge | Amber outline chip reading "Simulated" on any control that would call an external system |
| Demo reset | Available in Admin → Demo Controls; restores seed state |

### 3.3 Screen inventory

| # | Screen | Route | Persona(s) | Module |
|---|---|---|---|---|
| 1 | Login & role selection | `/login` | All | M1 |
| 2 | Command Centre | `/command` | P1 | M2 |
| 3 | Executive view | `/command?view=executive` | P2 | M2 |
| 4 | Branch league table | `/command/branches` | P1, P2 | M2 |
| 5 | Exception feed | `/command/exceptions` | P1, P4 | M2 |
| 6 | Sales My Desk | `/sales/my-desk` | Sales Exec | M3 |
| 7 | Pipeline board | `/sales/pipeline` | P3 | M3 |
| 8 | Enquiry list & intake | `/sales/enquiries` | P3 | M3 |
| 9 | Quotation builder | `/sales/quotations/[id]` | P3 | M3 |
| 10 | Sales order | `/sales/orders/[id]` | P3, P7 | M3 |
| 11 | Customer list | `/sales/customers` | P3, P2 | M3 |
| 12 | Customer 360 | `/sales/customers/[id]` | P2, P3, P4 | M3 |
| 13 | Dispatch board | `/service/dispatch` | P4 | M4 |
| 14 | Ticket detail | `/service/tickets/[id]` | P4 | M4 |
| 15 | Installed asset register | `/service/assets` | P4 | M4 |
| 16 | Asset passport | `/service/assets/[serial]` | P4, P5, P2 | M4 |
| 17 | AMC contract list & detail | `/service/amc` | P4 | M4 |
| 18 | Renewal radar | `/service/renewals` | P4, P1 | M4 |
| 19 | Commissioning register | `/service/commissioning` | P4, P2 | M4 |
| 20 | Rental fleet | `/service/rental` | P4 | M4 |
| 21 | Project portfolio | `/projects` | P6, P1 | M5 |
| 22 | Project workspace | `/projects/[id]` | P6 | M5 |
| 23 | BOQ sheet | `/projects/[id]/boq` | P6 | M5 |
| 24 | DPR log & entry | `/projects/[id]/dpr` | P6 | M5 |
| 25 | RA-bill builder | `/projects/[id]/ra-bills/[n]` | P6, P7 | M5 |
| 26 | Retention register | `/projects/retention` | P6, P1, P7 | M5 |
| 27 | Stock list | `/inventory/stock` | P9, P4 | M6 |
| 28 | Issue / receipt | `/inventory/movements` | P9 | M6 |
| 29 | Reorder list | `/inventory/reorder` | P9, P4 | M6 |
| 30 | Item master | `/inventory/items` | P9 | M6 |
| 31 | Purchase orders | `/inventory/purchase` | P9 | M6 |
| 32 | Receivables ageing | `/commercial/receivables` | P7, P1 | M7 |
| 33 | Invoice detail | `/commercial/invoices/[id]` | P7 | M7 |
| 34 | Challan detail | `/commercial/challans/[id]` | P7, P9 | M7 |
| 35 | E-way bill | `/commercial/eway/[id]` | P7 | M7 |
| 36 | Receipts | `/commercial/receipts` | P7 | M7 |
| 37 | Ledger hand-off | `/commercial/handoff` | P7 | M7 |
| 38 | Attendance board | `/people/attendance` | P8 | M8 |
| 39 | Leave management | `/people/leave` | P8 | M8 |
| 40 | Employee register & profile | `/people/employees/[id]` | P8 | M8 |
| 41 | Statutory documents | `/people/documents` | P8 | M8 |
| 42 | Document vault | `/vault` | All | M9 |
| 43 | Ask the Vault | `/vault/ask` | All | M9 |
| 44 | My approvals | `/workflow/approvals` | P1, P3, P4, P6 | M10 |
| 45 | Approval chain designer | `/workflow/chains` | P1, Admin | M10 |
| 46 | Notification centre | `/workflow/notifications` | All | M10 |
| 47 | Analytics — Sales | `/analytics/sales` | P1, P3 | M11 |
| 48 | Analytics — Service | `/analytics/service` | P1, P4 | M11 |
| 49 | Analytics — Projects | `/analytics/projects` | P1, P6 | M11 |
| 50 | Analytics — Cash | `/analytics/cash` | P1, P7 | M11 |
| 51 | Analytics — Inventory | `/analytics/inventory` | P9, P4 | M11 |
| 52 | AI Assistant | `/assistant` | P1, P2, P3, P4 | M12 |
| 53 | Field — Today | `/field/today` | P5 | M4/M8 |
| 54 | Field — Job card | `/field/job/[id]` | P5 | M4 |
| 55 | Field — Commissioning | `/field/commissioning/[assetId]` | P5 | M4 |
| 56 | Field — Attendance | `/field/attendance` | P5 | M8 |
| 57 | Users & roles | `/admin/users` | Admin | M1 |
| 58 | Permission matrix | `/admin/permissions` | Admin | M1 |
| 59 | Masters | `/admin/masters` | Admin | M1 |
| 60 | Integration readiness | `/admin/integrations` | Admin, P1 | M1 |
| 61 | Compliance & consent | `/admin/compliance` | Admin, Auditor | M1 |
| 62 | Audit log | `/admin/audit` | Auditor, Admin | M1 |
| 63 | Demo controls | `/admin/demo` | Admin | M1 |

**Total: 63 distinct screens.**

---

## 4. Module Catalogue

| ID | Module | MoSCoW | Epic | Screens | Primary personas |
|---|---|---|---|---|---|
| M1 | Platform Foundation, Identity & Governance | Must | E1 | 8 | All, Admin, Auditor |
| M2 | Leadership Command Centre | Must | E2 | 4 | P1, P2 |
| M3 | CRM & Sales Pipeline | Must | E3 | 7 | P3, Sales Exec, P2 |
| M4 | Service Desk, Job Cards & AMC Lifecycle | Must | E4 | 11 | P4, P5 |
| M5 | Projects & EPC Execution | Must | E5 | 6 | P6 |
| M6 | Inventory, Spares & Warehouse | Must | E6 | 5 | P9, P4 |
| M7 | Commercial: GST Documents & Receivables | Must | E7 | 6 | P7 |
| M8 | HR, Attendance & Workforce | Must | E8 | 5 | P8, P5 |
| M9 | Document Vault & AI Document Intelligence | Should | E9 | 2 | All |
| M10 | Workflow, Approvals & Notifications | Should | E10 | 3 | P1, P3, P4, P6 |
| M11 | Analytics & KPI Studio | Should | E11 | 5 | P1, functional heads |
| M12 | AI Executive Assistant | Could | E12 | 1 | P1, P2 |
| — | Quality, Accessibility & Demo Readiness | Must | E13 | cross-cutting | Delivery |

---

## 5. Functional Requirements

Numbering: **FR-M{module}-{nn}**. Priority: **M** = Must, **S** = Should, **C** = Could. Every FR traces to a BRD business requirement.

### M1 — Platform Foundation, Identity & Governance

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M1-01 | Login screen accepts a seeded user credential and establishes a mock session persisted to `localStorage` under a versioned namespace | M | BR-054 |
| FR-M1-02 | Twelve seeded demo users, one per role, selectable from the login screen with role, branch and avatar shown, so a demo can start as any persona in one click | M | BR-054 |
| FR-M1-03 | A "View as role" switcher in the header re-scopes the entire application to the selected role without logout, showing a persistent banner identifying the impersonated role | M | BR-054 |
| FR-M1-04 | Application shell renders a collapsible left rail, global header, breadcrumb bar and content area; rail state persists per user | M | BR-058 |
| FR-M1-05 | Navigation renders only the sections permitted to the active role; forbidden routes redirect to a role-appropriate landing page with an explanatory message, never a blank screen | M | BR-054 |
| FR-M1-06 | Branch scope selector filters all list and dashboard data; roles designated branch-scoped have the selector locked to their own branch | M | BR-054 |
| FR-M1-07 | Global command palette (`Cmd/Ctrl+K`) searches customers, assets by serial, tickets, quotations, invoices, projects, documents, employees, screens and actions, with grouped results and keyboard navigation | M | BR-058 |
| FR-M1-08 | Dark and light themes, both fully designed, toggleable, persisted; system preference respected on first visit | M | BR-059 |
| FR-M1-09 | Density toggle (Compact / Comfortable) alters table row height, card padding and type scale, persisted per user | S | BR-058 |
| FR-M1-10 | An immutable audit log records every create, update, delete, state transition, approval, export and login, capturing actor, role, action, entity type, entity ID, before/after summary, timestamp and simulated IP | M | BR-055 |
| FR-M1-11 | Audit log screen supports filtering by actor, entity type, action and date range, with CSV export | M | BR-055 |
| FR-M1-12 | Audit records cannot be edited or deleted through any interface | M | BR-055 |
| FR-M1-13 | Permission matrix screen displays the full role × module × operation grid as a read-only reference, exportable | M | BR-054 |
| FR-M1-14 | Users & roles screen supports create, edit, deactivate, role assignment and branch assignment for users | M | BR-054 |
| FR-M1-15 | Masters screen manages reference data: branches, product categories, OEM principals, ticket categories, loss reasons, leave types, unit of measure, HSN/SAC codes, GST rates, approval thresholds, SLA definitions, retention percentages | M | BR-009, BR-039 |
| FR-M1-16 | Integration Readiness screen lists every simulated integration with its real-world prerequisites (credentials, commercial agreement, vendor onboarding, statutory registration), current simulation status and Phase 2 effort indication | M | BRD X-02, R-04 |
| FR-M1-17 | Compliance screen presents a DPDP-style consent notice, a data-principal request register with request type and status, configurable per-entity retention periods, and a breach-response checklist placeholder | M | BR-056, BR-057 |
| FR-M1-18 | Demo Controls screen allows reset to seed state, advancing the simulated clock, and toggling scenario states (e.g., force an SLA breach, force a stock-out) for demonstration purposes | M | BRD §14 |
| FR-M1-19 | All destructive actions require typed or explicit confirmation and are recorded in the audit log | M | BR-055 |
| FR-M1-20 | Session inactivity of 30 minutes returns the user to the login screen with a resumable state notice | S | BR-054 |

### M2 — Leadership Command Centre

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M2-01 | A single screen presents the consolidated position of all four verticals above the fold, rendering fully within 3 seconds of route entry | M | BR-001 |
| FR-M2-02 | Six primary KPI cards: Revenue (period, vs prior), Order Book, **Locked Cash** (receivables + retention), Open Service Commitments, AMC Renewals Due (90 days), Projects At Risk. Each shows value, delta, direction and a sparkline | M | BR-001 |
| FR-M2-03 | Four vertical health tiles (Equipment Sales, Service & AMC, Projects, Rental), each with a computed health state (Healthy / Watch / Action) derived from published rules, and its own headline metric | M | BR-001 |
| FR-M2-04 | Every KPI card and tile is clickable, navigating to a filtered list or analytics view that reconciles exactly to the displayed figure | M | BR-002 |
| FR-M2-05 | **Locked Cash panel** decomposes into receivables ageing buckets (0–30 / 31–60 / 61–90 / 90+), institutional vs private split, and project retention outstanding, each drillable to source documents | M | BR-035, BR-029 |
| FR-M2-06 | **Exception feed** lists items requiring management attention, each with type, severity, entity link, age and accountable owner. Types include SLA breach or imminent breach, commissioning report approaching the OEM window, AMC expiring, quotation ageing beyond threshold, invoice crossing 90 days, project schedule variance beyond tolerance, stock below reorder for a fast-moving part, approval pending beyond SLA, retention eligible for release | M | BR-004 |
| FR-M2-07 | Exception feed supports acknowledge, assign and snooze, all audit-logged | S | BR-004 |
| FR-M2-08 | **Branch league table** ranks branches on a normalised composite of revenue vs target, service SLA compliance, receivables health and AMC renewal rate, with per-column sort and drill-down, and normalisation for branch size shown transparently | M | BR-003 |
| FR-M2-09 | **AI Daily Briefing** panel renders a plain-language summary of position, notable movements, and the three items most warranting attention, with inline citations to the specific records that produced each statement, streamed on generation | S | BR-005, BR-051 |
| FR-M2-10 | The briefing declines to assert where seeded data is insufficient, stating what is missing rather than producing a confident but unsupported statement | S | BR-051 |
| FR-M2-11 | **Executive view** variant presents a reduced set of six figures at larger type with minimal chrome, suited to the Director – Strategy persona and to a phone | S | P2 |
| FR-M2-12 | Period selector (This Month / Last Month / This Quarter / This FY / Custom) applies to all monetary and count metrics; Indian financial year (April–March) is the default FY basis | M | DP-6 |
| FR-M2-13 | A "data as of" timestamp is displayed; in the prototype this reflects the simulated clock | M | BR-002 |
| FR-M2-14 | Command Centre is fully responsive; on a phone it becomes a vertically stacked priority order: exceptions, locked cash, vertical tiles, KPIs, briefing | M | BR-058 |

### M3 — CRM & Sales Pipeline

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M3-01 | Customer master holds legal name, trade name, type (Industrial / Institutional / Government / Dealer / Retail), GSTIN with format validation, PAN, industry, credit terms, credit limit, assigned branch, assigned executive, and status | M | BR-013 |
| FR-M3-02 | Each customer may hold multiple **sites** with address, district, state, contact person, and site-level notes; installed assets attach to sites, not to customers | M | BR-013 |
| FR-M3-03 | Each customer holds multiple **contacts** with name, designation, mobile, email and preferred channel | M | BR-013 |
| FR-M3-04 | **Customer 360** presents in one screen: profile, sites, installed assets with warranty/AMC state, open tickets, live AMC contracts, quotation and order history, invoices with outstanding balance, documents, and a chronological activity timeline | M | BR-013 |
| FR-M3-05 | Enquiry intake captures source channel (Phone / Website / WhatsApp / Walk-in / Referral / Exhibition / OEM lead), customer (existing or new), site, vertical, requirement description, technical parameters where applicable (e.g., required air delivery in CFM, working pressure in bar, head and flow for pumps), expected value, expected closure date and owner | M | BR-008 |
| FR-M3-06 | Enquiries are assigned an owner on creation; unassigned enquiries appear in an unassigned queue visible to the branch manager | M | BR-008 |
| FR-M3-07 | Enquiry list supports filter by branch, owner, source, vertical, status and age, with saved views | M | BR-008 |
| FR-M3-08 | **Quotation builder** composes line items from the item master, applying price-list rates, quantity, discount, GST rate by HSN/SAC, and computing taxable value, tax and total with correct rounding | M | BR-009 |
| FR-M3-09 | Quotation holds validity period, payment terms, delivery terms, warranty terms, scope inclusions and exclusions, and free-text technical notes | M | BR-009 |
| FR-M3-10 | Quotations are versioned; revising a quotation creates a new version preserving the prior version read-only, with a visible version history and change summary | M | BR-009 |
| FR-M3-11 | Discount above a configured threshold blocks issue and raises an approval request to the configured approver chain; the quotation cannot be issued until approved | M | BR-010 |
| FR-M3-12 | Quotations past validity are automatically marked Expired and excluded from open pipeline value, with the change audit-logged | M | BR-009 |
| FR-M3-13 | Quotation states: Draft → Pending Approval → Issued → Negotiation → Won / Lost / Expired, with permitted transitions enforced | M | BR-009 |
| FR-M3-14 | Marking a quotation Lost requires a structured loss reason (Price / Delivery lead time / Technical fit / Competitor relationship / Budget withdrawn / No decision / Other) and optional competitor name | S | BR-012 |
| FR-M3-15 | Marking a quotation Won generates a sales order pre-populated from the quotation with no re-entry, linked bidirectionally | M | BR-011 |
| FR-M3-16 | Sales order holds customer PO reference and date, delivery schedule, advance received, and line-level fulfilment status; partial fulfilment is supported | M | BR-011 |
| FR-M3-17 | **Pipeline board** presents a kanban of stages (Enquiry / Qualified / Quoted / Negotiation / Won / Lost) with cards showing customer, value, owner, age and next action; drag between stages triggers the corresponding state transition and its validations | M | BR-008 |
| FR-M3-18 | Pipeline cards age visibly: a card exceeding its stage threshold displays a warning treatment, and beyond a second threshold an escalation treatment, with thresholds configurable per stage | S | BR-014 |
| FR-M3-19 | Sales My Desk presents an executive's own open enquiries, quotations awaiting action, today's follow-ups, and target versus achieved | M | BR-015 |
| FR-M3-20 | Follow-up activities (call / visit / email / WhatsApp) are recordable against any enquiry, quotation or customer, with outcome and next-action date, appearing on the customer timeline | M | BR-014 |
| FR-M3-21 | Quotation and sales order documents render as print-ready A4 previews with the Bhushan Corp letterhead, statutory particulars, terms, and authorised signatory block, exportable to PDF | M | BR-009 |
| FR-M3-22 | Sales target may be set per branch, per executive and per period, and is the denominator for achievement metrics | S | BR-015 |

### M4 — Service Desk, Job Cards & AMC Lifecycle

*The most operationally distinctive module. This is where the platform earns credibility.*

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M4-01 | **Installed asset register**: every machine at a customer site exists as a record holding OEM principal, product line, model/series, capacity rating (kW / CFM / bar / head-flow as applicable), **serial number (unique)**, customer, site, exact location within site, sale invoice reference, installation date, commissioning date, warranty start and end, running-hours reading with reading date, current status (Running / Down / Decommissioned / Rental) and coverage state (In Warranty / Under AMC / Out of Coverage) | M | BR-016 |
| FR-M4-02 | **Asset passport** screen presents a single machine's complete life: identity, coverage timeline, every ticket, every visit, every part consumed, commissioning report, service reports, documents, and running-hours history chart | M | BR-016 |
| FR-M4-03 | Coverage state is derived, never manually set: warranty end date and live AMC contract dates determine it, recomputed against the current date | M | BR-016 |
| FR-M4-04 | **Service ticket** captures customer, site, installed asset (searchable by serial), reported problem, category (Breakdown / Preventive Maintenance / Installation & Commissioning / Warranty Claim / Inspection / Rental Support), severity (Critical – production stopped / High / Normal / Low), reported-by contact, channel, and coverage classification (Warranty / AMC / Chargeable) auto-derived from the asset's coverage state | M | BR-017 |
| FR-M4-05 | On creation, a ticket is assigned a **response due** and **restoration due** timestamp computed from the applicable SLA definition, which is resolved in precedence order: AMC contract terms → OEM commitment for the product line → default by severity | M | BR-017 |
| FR-M4-06 | SLA clocks are displayed as live countdowns with four visual states: comfortable, approaching (< 25% remaining), imminent (< 10% remaining), breached. Breach records the breach timestamp and reason code permanently | M | BR-017, BR-018 |
| FR-M4-07 | SLA definitions are configurable in Masters by product line, severity and coverage type, expressed in hours, with an option for business-hours-only or elapsed-hours calculation | M | BR-017 |
| FR-M4-08 | **Dispatch board** presents all open tickets in a single operational view, default-sorted by time-to-breach ascending, with columns or lanes by status (Logged / Assigned / En route / On site / Awaiting parts / Awaiting customer / Resolved) and colour-coded by SLA state | M | BR-018 |
| FR-M4-09 | Dispatch board shows engineer availability alongside the ticket queue: each engineer's assigned load today, current status, branch and skill/OEM certification tags | M | BR-024 |
| FR-M4-10 | Assignment is possible by drag-and-drop or by an assign dialog; assignment to an engineer already at capacity produces a warning but is permitted with a recorded override reason | M | BR-024 |
| FR-M4-11 | Approaching and breached SLAs raise escalation notifications to the Service Manager and, at a second threshold, to the Director – Business; escalations appear in the Command Centre exception feed | M | BR-018 |
| FR-M4-12 | **Job card** is created per site visit against a ticket, holding scheduled date, engineer, check-in and check-out timestamps with captured location, observations, root-cause category, work performed, parts consumed, machine running-hours reading, next-visit recommendation, customer acknowledgement (name, designation, signature capture) and outcome (Resolved / Partially resolved / Parts awaited / Revisit required / Not attended) | M | BR-019 |
| FR-M4-13 | Job card records whether the ticket was resolved on this visit; **first-time-fix rate is derived from this field**, never entered | M | BR-023 |
| FR-M4-14 | Parts consumed on a job card are selected from stock, decrement the issuing location's stock on job-card submission, attach to the service record, and flow to chargeable billing where coverage is Chargeable or the AMC is non-comprehensive | M | BR-041 |
| FR-M4-15 | If a required part is unavailable, the engineer raises a parts request from the job card; the ticket moves to Awaiting Parts, the SLA clock is optionally paused per configuration, and the store receives a prioritised request | M | BR-041, BR-042 |
| FR-M4-16 | **Mobile job card** is a guided, single-column, thumb-reachable flow completable for a standard visit in **six taps or fewer**, with each step independently saveable, a visible progress indicator, and camera capture for site photographs | M | BR-019, DP-4 |
| FR-M4-17 | **Commissioning report** is a distinct structured document capturing installation particulars, site conditions, electrical supply particulars, accessories fitted, commissioning checklist with pass/fail per item, initial running parameters, customer training acknowledgement, customer signature and dealer authorisation | M | BR-020 |
| FR-M4-18 | On commissioning-date capture, the system starts a **visible countdown to the OEM submission deadline** (configurable per principal, defaulting to seven days) and displays it on the report, the asset passport and the commissioning register | M | BR-020 |
| FR-M4-19 | **Commissioning register** lists all commissionings with submission state (Not submitted / Submitted within window / Submitted late / Overdue), submission date, acknowledgement reference, and warranty validity consequence; overdue items escalate to the Command Centre exception feed | M | BR-020 |
| FR-M4-20 | Warranty start is derived from commissioning date, not invoice date, with warranty duration configurable per product line | M | BR-016 |
| FR-M4-21 | **AMC contract** holds contract number, customer, covered assets (one or many), coverage type (Comprehensive / Non-comprehensive), start and end dates, contract value, billing schedule (one-time / quarterly / half-yearly), number of preventive visits committed per year, response and restoration commitments, inclusions and exclusions, and status | M | BR-021 |
| FR-M4-22 | On activation, an AMC generates its schedule of preventive-maintenance visits across the contract period; each scheduled visit becomes a due ticket at the appropriate time, and visit completion against commitment is tracked as a fulfilment percentage | M | BR-021 |
| FR-M4-23 | AMC states: Draft → Active → Expiring (within 60 days) → Expired / Renewed / Terminated, with the state derived from dates | M | BR-021 |
| FR-M4-24 | **Renewal Radar** presents every AMC and every warranty expiring within 30 / 60 / 90 days in a single prioritised view showing customer, assets, expiring value, days remaining, coverage history (visits used vs committed), assigned owner, renewal status and last action; a renewal quotation can be initiated in one click, pre-populated from the expiring contract | M | BR-022, VA-01 |
| FR-M4-25 | Renewal Radar exposes counts and value for out-of-coverage assets — machines with no live warranty or AMC — as the AMC attach-rate opportunity | M | BR-022 |
| FR-M4-26 | Assets whose warranty expires within 90 days appear on the radar as an AMC conversion opportunity, with the machine's service history summarised to support the sales conversation | S | BR-022, VA-01 |
| FR-M4-27 | **Service report** renders as a print-ready customer-facing document from a completed job card, with letterhead, machine particulars, work performed, parts, recommendations and signatures, exportable to PDF | M | BR-019 |
| FR-M4-28 | Chargeable work produces a service billing summary (labour, parts, travel, applicable GST) which flows to invoicing in M7 | M | BR-041 |
| FR-M4-29 | **Field Today** screen lists an engineer's assigned visits for the day in route order, each showing customer, site address with a map link, machine and serial, reported problem, severity, SLA state, and contact number with a tap-to-call affordance | M | BR-019 |
| FR-M4-30 | **Rental fleet**: rental assets are registered with serial and specification; rental agreements hold customer, site, period, rate basis, deposit and expected return; utilisation percentage is computed per asset; overdue returns are flagged | C | BR-025 |
| FR-M4-31 | Preventive-maintenance visits due within seven days appear on the dispatch board as forward-planned work distinguishable from breakdowns | S | BR-021 |
| FR-M4-32 | Ticket detail presents a complete chronological activity trail: creation, assignment, status transitions, visits, parts, communications, escalations and closure | M | BR-017 |

### M5 — Projects & EPC Execution

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M5-01 | Project record holds project code, name, client (institutional / government / private), client type, site location, scope summary, contract type, work order reference and date, contract value, start date, contractual completion date, revised completion date, defect-liability period, retention percentage, price-variation clause presence, liquidated-damages terms, project manager and status | M | BR-026 |
| FR-M5-02 | **BOQ sheet** holds line items with item code, description, unit, contracted quantity, rate, amount, and cumulative executed quantity; the sheet computes executed value, balance quantity and balance value per line and in total | M | BR-026 |
| FR-M5-03 | BOQ lines may be grouped into sections (e.g., civil works, mechanical supply, electrical, erection & commissioning, O&M) with section subtotals | M | BR-026 |
| FR-M5-04 | Executed quantity is updated only through a dated progress entry attributable to a user; direct editing of cumulative executed quantity is not permitted | M | BR-027 |
| FR-M5-05 | Executed quantity cannot exceed contracted quantity unless a variation is recorded; attempting to exceed prompts either a variation entry or rejection | M | BR-026 |
| FR-M5-06 | **Daily Progress Report (DPR)** captures date, weather, manpower deployed by trade with counts, plant and machinery deployed, work executed against BOQ lines with quantities, materials received, site instructions received, hindrances or delays with cause category, safety observations, and photographs | M | BR-027 |
| FR-M5-07 | DPR entries are immutable after submission; corrections are made by a superseding entry with a reason, both retained | M | BR-027 |
| FR-M5-08 | **Milestone schedule** holds planned milestones with planned and actual dates, weightage and status; cumulative planned versus actual progress is charted as an S-curve | M | BR-030 |
| FR-M5-09 | Schedule variance is computed as the difference between cumulative actual and cumulative planned progress, expressed as a percentage, with a configurable tolerance beyond which the project is flagged At Risk | M | BR-030 |
| FR-M5-10 | **RA-bill builder** generates a running-account bill from cumulative executed BOQ quantities, presenting: cumulative value to date, value of the previous bill, **current-period value**, mobilisation-advance recovery, retention deduction, statutory deductions (TDS, labour cess where applicable), other deductions, and net payable | M | BR-028 |
| FR-M5-11 | RA-bills are sequentially numbered per project; a new bill cannot be raised until the previous is submitted; the cumulative basis prevents double-claiming | M | BR-028 |
| FR-M5-12 | RA-bill states: Draft → Submitted → Under certification → Certified (with certified value, which may differ from claimed) → Paid, with the variance between claimed and certified visible | M | BR-028 |
| FR-M5-13 | Retention is computed automatically on each certified bill at the project's retention percentage and posted to the retention register | M | BR-029 |
| FR-M5-14 | **Retention register** aggregates, across all projects, retention withheld, retention released, retention outstanding, defect-liability expiry date per project, and release eligibility state (Not eligible / Eligible / Claim raised / Released), sortable by value and by eligibility date | M | BR-029, VA-02 |
| FR-M5-15 | Retention becoming eligible for release raises an exception to the Command Centre with the project, value and days since eligibility | M | BR-029 |
| FR-M5-16 | Project cost capture records committed and incurred cost by category (material, subcontract, labour, plant, overhead), enabling billed-versus-cost comparison against BOQ value | S | BR-031 |
| FR-M5-17 | **Project portfolio** lists all projects with client, value, physical progress, financial progress, schedule variance, retention outstanding, and status, with At Risk projects surfaced first | M | BR-030 |
| FR-M5-18 | Project workspace consolidates BOQ, DPR log, milestones, RA-bills, retention, documents (drawings, approvals, test certificates, measurement records) and team, in tabs | M | BR-026 |
| FR-M5-19 | Project document register distinguishes drawing revisions, client approvals, test and commissioning certificates, and measurement books, each with revision and approval state | S | BR-049 |
| FR-M5-20 | O&M phase, where contracted, is represented as a post-completion period with its own visit schedule, mirroring AMC behaviour | C | BR-021 |

### M6 — Inventory, Spares & Warehouse

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M6-01 | **Item master** holds item code, description, category (Machine / Spare / Consumable / Accessory / Pipe & Fitting / Service), OEM principal, OEM part number, unit of measure, HSN/SAC, GST rate, standard purchase cost, standard selling price, reorder level, reorder quantity, lead-time days, storage location and status | M | BR-039 |
| FR-M6-02 | A single item master serves quotations, sales orders, job cards, project BOQs and purchase orders; no parallel masters exist | M | BR-039 |
| FR-M6-03 | Stock is held **per location** (central warehouse, each branch, engineer boot stock, project site), with quantity on hand, quantity reserved and quantity available shown distinctly | M | BR-040 |
| FR-M6-04 | Every stock movement is a ledger entry recording type (Receipt / Issue / Return / Transfer / Adjustment / Scrap), quantity, from-location, to-location, **source document reference**, actor and timestamp; the ledger is append-only | M | BR-040 |
| FR-M6-05 | Current stock is always the sum of ledger movements — never an independently editable figure | M | BR-040 |
| FR-M6-06 | Issue against a job card is a first-class flow: the store selects the job card, sees requested parts, issues in one action, and stock decrements with the job-card reference recorded | M | BR-041 |
| FR-M6-07 | Issue against a project is supported with the project and BOQ line as the reference | M | BR-040 |
| FR-M6-08 | Goods receipt against a purchase order records received quantity, batch or serial where applicable, and updates stock; short and excess receipts are flagged | M | BR-040 |
| FR-M6-09 | **Reorder list** presents every item at or below reorder level, sorted by a movement-velocity score derived from issue frequency over the trailing period, showing on-hand, reorder level, suggested quantity, lead time, last purchase rate and preferred supplier | M | BR-042, VA-08 |
| FR-M6-10 | Items that caused a job card to move to Awaiting Parts are marked on the reorder list as **service-critical**, and are prioritised above pure velocity | M | BR-042, VA-08 |
| FR-M6-11 | Non-moving stock report lists items with zero issues in a configurable trailing period (default 180 days) with value, supporting capital release decisions | S | BR-043 |
| FR-M6-12 | Purchase order holds supplier, items with quantity and rate, delivery date, terms, and status (Draft / Approved / Sent / Partially received / Received / Closed); POs above a threshold require approval | S | BR-042 |
| FR-M6-13 | Supplier master holds name, GSTIN, contact, payment terms, and supplied item categories | S | BR-042 |
| FR-M6-14 | Stock-count entry allows recording physical quantity against system quantity, producing a variance list and an adjustment entry requiring approval | C | BR-040 |
| FR-M6-15 | Stock list supports search by item code, description and OEM part number, with filters by category, principal, location and stock state (In stock / Below reorder / Out of stock / Non-moving) | M | BR-039 |

### M7 — Commercial: GST Documents & Receivables

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M7-01 | **Delivery challan** is a distinct document, not a variant of the invoice, carrying challan number and date, consignor and consignee particulars with GSTINs, transport details (mode, vehicle number, transporter, LR number), item particulars with quantity and taxable value, reason for transportation, and the statutory triplicate designation label (Original for consignee / Duplicate for transporter / Triplicate for consigner) on the printed copies | M | BR-032 |
| FR-M7-02 | Challans may be raised against a sales order, a project supply, a rental despatch, or a service part despatch, and reference the source document | M | BR-032 |
| FR-M7-03 | **Tax invoice** holds invoice number and date, place of supply, customer with GSTIN, line items with HSN/SAC, quantity, rate, taxable value, discount, and tax split correctly as CGST+SGST for intra-state or IGST for inter-state, with rounding, amount in words, bank particulars, and authorised signatory block | M | BR-033 |
| FR-M7-04 | GST treatment is derived from the place-of-supply comparison against the Bhushan Corp state of supply, not entered manually; the derivation is shown to the user for verification | M | BR-033 |
| FR-M7-05 | Invoice types supported: equipment sale, spares sale, service (chargeable), AMC contract billing, rental billing, and project RA-bill invoice | M | BR-033 |
| FR-M7-06 | On issue, an invoice displays a **simulated IRN** and a rendered **signed QR code** in the statutory position, with a persistent "Simulated" indicator and an explanatory tooltip identifying what the real integration requires | M | BR-033, X-02 |
| FR-M7-07 | Invoices are tracked against the statutory e-invoice reporting window; invoices approaching the end of the applicable window without simulated reporting are flagged, and the applicable window is configurable in Masters to accommodate turnover-band changes | S | BR-037 |
| FR-M7-08 | **E-way bill** generation is available for consignments above the configured threshold (default ₹50,000), capturing supply type, sub-type, document reference, transport mode, distance, transporter and vehicle, producing a simulated e-way bill number with validity | M | BR-034 |
| FR-M7-09 | E-way bill generation is **blocked** where the base document date exceeds the configured maximum age (default 180 days), with a clear explanatory message | M | BR-034 |
| FR-M7-10 | Credit notes and debit notes are supported against an invoice with reason, and adjust the outstanding balance | S | BR-033 |
| FR-M7-11 | **Receipts** record amount, date, mode (NEFT / RTGS / Cheque / UPI / Cash / Adjustment), reference, and allocation across one or more invoices; part-allocation is supported and unallocated receipts are visible | M | BR-035 |
| FR-M7-12 | A simulated UPI collection link may be generated against an invoice, with a mock state progression (Generated → Sent → Viewed → Paid) triggerable from Demo Controls, clearly marked as simulated | C | X-02 |
| FR-M7-13 | **Receivables ageing** presents outstanding by bucket (0–30 / 31–60 / 61–90 / 90+ days) with count and value, filterable by branch, customer type and executive, and drillable to invoice level | M | BR-035 |
| FR-M7-14 | Receivables distinguishes **institutional and government exposure** from private-sector exposure, given materially different payment behaviour | M | BR-035, VA-02 |
| FR-M7-15 | Collection follow-up is recordable against an invoice with date, mode, person spoken to, outcome, promised payment date and amount; promised dates that pass without receipt raise an exception | M | BR-036 |
| FR-M7-16 | Customer credit limit and terms are visible during quotation and order creation; exceeding the limit produces a warning and, above a configured tolerance, requires approval | S | BR-035 |
| FR-M7-17 | **Ledger hand-off** screen presents a period-wise export of invoices, receipts, challans and credit notes in a structured format suitable for import into the accounting package, with a clearly stated position that the accounting ledger remains the book of record | M | BR-038 |
| FR-M7-18 | Every commercial document renders as a print-ready A4 preview with correct statutory particulars and exports to PDF | M | BR-032, BR-033 |
| FR-M7-19 | Document numbering follows configurable series per document type and financial year, with the series definition held in Masters and gaps prevented | M | BR-033 |

### M8 — HR, Attendance & Workforce

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M8-01 | Employee record holds employee code, name, designation, department, branch, reporting manager, date of joining, employment type (Permanent / Fixed-term / Probation / Contract), work location type (Office / Field), contact details, emergency contact, statutory identifiers (PF, ESIC, UAN) as masked reference fields, and status | M | BR-044 |
| FR-M8-02 | Employee record holds a statutory document set with **appointment letter** as a first-class required document, plus offer letter, ID proof reference, qualification and OEM training certificates, and any period-bound documents with expiry awareness | M | BR-044, BR-048 |
| FR-M8-03 | Field engineers carry OEM certification tags used by the dispatch board for skill-based assignment | M | BR-024 |
| FR-M8-04 | **Attendance capture** supports office check-in/out and **field check-in/out with captured geolocation and a simulated selfie step**, recording timestamp, coordinates, reverse-geocoded place label and device indication | M | BR-045 |
| FR-M8-05 | Field check-in performed at a customer site is associated with the job card being attended, creating a verifiable link between attendance and work | M | BR-045, VA-04 |
| FR-M8-06 | A simulated biometric-device feed may be triggered from Demo Controls to demonstrate device-sourced attendance alongside app-sourced attendance, clearly marked as simulated | S | X-02 |
| FR-M8-07 | **Attendance board** shows, for a selected date, every employee's state (Present / Absent / On leave / On field / Half day / Week off / Holiday), with exceptions (late, no check-out, missing field location) surfaced separately | M | BR-045 |
| FR-M8-08 | Attendance may be regularised by HR with a reason, and the regularisation is audit-logged with the original record retained | M | BR-045, BR-055 |
| FR-M8-09 | **Leave** supports configurable leave types with entitlement, accrual and balance; requests capture type, dates, reason and coverage arrangement, and route to the reporting manager through the approval engine | M | BR-046 |
| FR-M8-10 | A team leave calendar shows approved and pending leave by branch and department, warning where field-engineer coverage in a branch would fall below a configured minimum | S | BR-046 |
| FR-M8-11 | **Monthly attendance summary** produces, per employee, days present, days absent, leave taken by type, week-offs, holidays, late marks and field days, exportable as a payroll input file — with an explicit statement on screen that payroll computation is outside the platform | M | BR-047, X-03 |
| FR-M8-12 | Holiday calendar is maintained per branch, accommodating regional observances | S | BR-045 |
| FR-M8-13 | **Technician utilisation** is derived from field attendance and job-card durations, presented per engineer and per branch | S | BR-024 |
| FR-M8-14 | Employee documents and personal data are governed by the retention configuration in M1 and are excluded from general search for users without HR permission | M | BR-056 |
| FR-M8-15 | Statutory document dashboard shows completeness per employee (e.g., appointment letter present or missing), supporting Labour Code readiness | S | BR-044 |

### M9 — Document Vault & AI Document Intelligence

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M9-01 | Hierarchical document vault organised by domain: Customers, Installed Assets, Projects, OEM & Technical, Commercial, HR, Statutory, Company | S | BR-049 |
| FR-M9-02 | Every document holds title, type, category, linked entity (customer / asset / project / employee / invoice), owner, upload date, version, effective and expiry dates, tags, access level and file metadata | S | BR-049 |
| FR-M9-03 | Documents are versioned; superseded versions remain retrievable with a visible version history | S | BR-049 |
| FR-M9-04 | Document access is governed by role and by linked-entity permission; a user who cannot see a project cannot see its documents | M | BR-054 |
| FR-M9-05 | Documents with expiry (test certificates, insurance, licences, agreements) surface as expiring in the notification centre and, where material, in the Command Centre exception feed | S | BR-049 |
| FR-M9-06 | **Ask the Vault** accepts a natural-language question and returns a synthesised answer composed only from the seeded document corpus | S | BR-050 |
| FR-M9-07 | Every assertion in an answer carries an inline citation to the specific source document, and each citation is clickable, opening the source with the relevant passage highlighted | M | BR-050, BR-051, DP-3 |
| FR-M9-08 | Answers display a confidence state (High / Moderate / Low) with the basis for that state stated in plain language (for example, number and consistency of supporting sources) | M | BR-051 |
| FR-M9-09 | Where the corpus does not support an answer, the system states that explicitly, names what it searched, and offers the nearest related documents — it does not generate a plausible answer without sources | M | BR-051, DP-3 |
| FR-M9-10 | Answers stream progressively with a visible retrieval step ("searching 1,860 documents", "reading 4 sources") so that the reasoning path is legible rather than magical | S | DP-3 |
| FR-M9-11 | Suggested starter questions grounded in real Bhushan Corp scenarios are offered (for example: warranty terms for a specific machine series; the tested capacity recorded in a named project's commissioning certificate; the scope exclusions in a named AMC) | S | BR-050 |
| FR-M9-12 | A feedback control on every answer records helpful / not helpful with an optional comment, retained for evaluation | S | BR-051 |
| FR-M9-13 | Full-text and metadata search across the vault is available independently of the AI answer path, so that users are never forced through AI to find a file | M | BR-049 |

### M10 — Workflow, Approvals & Notifications

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M10-01 | An approval engine supports configurable chains per request type, with sequential steps, role-based or named approvers, monetary thresholds determining the chain, and optional parallel steps | S | BR-052 |
| FR-M10-02 | Request types covered: quotation discount beyond threshold, credit-limit override, purchase order above threshold, leave, expense claim, stock adjustment, AMC pricing exception, RA-bill submission, price-list change, user role change | S | BR-052 |
| FR-M10-03 | **Approval chain designer** allows a permitted user to define, for each request type, the ordered steps with role, threshold band, escalation timer and delegation, with a visual representation of the resulting chain | S | BR-052 |
| FR-M10-04 | **My Approvals** presents pending requests with type, requester, entity, value, age against SLA, and full supporting context inline, so that an approver never has to navigate away to decide | M | BR-052 |
| FR-M10-05 | Approve, reject and return-for-clarification are supported; rejection and return require a reason; all decisions are audit-logged with actor, timestamp and comment | M | BR-052, BR-055 |
| FR-M10-06 | Approvals pending beyond a configured SLA escalate to the next authority and appear in the Command Centre exception feed | S | BR-052 |
| FR-M10-07 | Delegation allows an approver to nominate a delegate for a date range, with delegated decisions recorded as such | C | BR-052 |
| FR-M10-08 | **Notification centre** presents in-app notifications grouped by type, with read/unread state, entity deep-links and bulk mark-as-read | M | BR-053 |
| FR-M10-09 | A **simulated WhatsApp channel** renders an authentic WhatsApp-style message preview for each outbound notification, including interactive approval buttons where the notification is an approval request, with a mock delivery-state progression (Queued → Sent → Delivered → Read) and a visible "Simulated" indicator | S | BR-053, VA-06 |
| FR-M10-10 | Acting on a simulated WhatsApp approval button performs the real in-platform approval, demonstrating the end-to-end mechanism | S | VA-06 |
| FR-M10-11 | A notification preference matrix allows, per notification type and per role, selection of channels (In-app / WhatsApp / Email / SMS), with SMS annotated as requiring TRAI DLT registration and WhatsApp annotated as not requiring it | S | BR-053 |
| FR-M10-12 | A message log records every simulated outbound message with recipient, channel, template, content, timestamp and state, providing an auditable communication trail | S | BR-055 |
| FR-M10-13 | Notification templates are defined per event with variable substitution, previewable in the designer | C | BR-053 |

### M11 — Analytics & KPI Studio

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M11-01 | Five curated analytics surfaces — Sales, Service, Projects, Cash, Inventory — each presenting the KPIs from the BRD dictionary relevant to that domain, with a consistent header of period selector, branch scope and comparison basis | S | BR-015 |
| FR-M11-02 | Every KPI is computed from transactional seed data using the single published formula in the BRD dictionary; no KPI is a stored or hand-entered figure | M | BR-002 |
| FR-M11-03 | Each KPI tile exposes its formula and the record set behind it on demand, so a disputed number can be settled in the interface | M | BR-002, DP-1 |
| FR-M11-04 | Sales analytics: enquiry funnel with stage conversion, quotation win rate, average deal value, revenue by product line, revenue by OEM principal, revenue by customer type, target versus achieved by branch and executive, quotation ageing distribution, loss-reason distribution | S | BR-015 |
| FR-M11-05 | Service analytics: ticket volume by category and severity, SLA compliance trend, first-time-fix trend, mean time to respond and restore, engineer utilisation and load distribution, AMC renewal rate, AMC attach rate, commissioning submission compliance, warranty exposure, top failure modes by product line | S | BR-023 |
| FR-M11-06 | Projects analytics: portfolio value, physical versus financial progress, S-curve per project, schedule variance distribution, RA-bill claimed versus certified variance, retention outstanding trend and ageing | S | BR-031 |
| FR-M11-07 | Cash analytics: revenue trend, receivables ageing trend, DSO trend, collection efficiency, locked-cash composition, institutional versus private exposure, promised-versus-received performance | S | BR-035 |
| FR-M11-08 | Inventory analytics: stock value by category and location, movement velocity, reorder exposure, stock-out incidence against first-time-fix, non-moving stock value trend | S | BR-043 |
| FR-M11-09 | All charts support hover detail, legend toggling, and click-through to the underlying record list filtered to the clicked dimension | M | DP-1 |
| FR-M11-10 | Every analytics surface exports its current view to CSV and to a print-ready PDF carrying the period, filters and generation timestamp | S | BR-015 |
| FR-M11-11 | **Anomaly flags**: a metric deviating from its trailing baseline beyond a configured tolerance is visibly flagged with the magnitude and direction of deviation and a link to the contributing records | C | BR-007 |
| FR-M11-12 | Charts respect the accessible data-visualisation palette, never rely on colour alone to convey meaning, and provide a tabular equivalent of every chart | M | BR-060 |

### M12 — AI Executive Assistant

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M12-01 | A conversational surface accepts natural-language business questions and answers them from platform transactional data — for example, outstanding above ninety days for institutional customers, AMCs expiring next month by branch, engineers with the lowest first-time-fix rate this quarter | C | BR-006 |
| FR-M12-02 | Every answer presents the computed result **together with the record set it was computed from**, accessible in one click, and states the formula applied | M | BR-051, DP-1 |
| FR-M12-03 | Results are rendered in the appropriate form — a figure, a table, or a chart — not as prose where structure is clearer | C | BR-006 |
| FR-M12-04 | The assistant declines questions it cannot answer from available data, stating precisely what data would be required, rather than estimating | M | BR-051 |
| FR-M12-05 | The assistant **cannot perform business actions**. It may prepare a draft (a renewal quotation, a follow-up message, a report) and hand it to the user for review and submission; the user always performs the action | M | X-07, DP-3 |
| FR-M12-06 | **Daily briefing generation** composes the Command Centre briefing from that day's position and movements, with citations, and is regenerable on demand | S | BR-005 |
| FR-M12-07 | **Report drafting**: the assistant drafts a monthly management review narrative from the period's data, structured by vertical, with figures cited to their sources, editable and exportable | C | BR-005 |
| FR-M12-08 | Conversation history is retained per user for the session and is resumable, with a visible control to clear it | C | BR-006 |
| FR-M12-09 | Answers stream with a visible reasoning trail identifying which datasets were queried | C | DP-3 |
| FR-M12-10 | A standing disclosure on the surface states that the assistant reads platform data, cites its sources, and does not take actions | M | DP-3 |
| FR-M12-11 | Prompt suggestions are grounded in the personas' real questions, differing by role | C | BR-006 |

### E13 — Quality, Accessibility & Demo Readiness (cross-cutting)

| FR | Requirement | Pri | BRD |
|---|---|---|---|
| FR-M13-01 | TypeScript strict mode enabled with no suppressions; ESLint and Prettier configured; the production build must complete with zero errors and zero warnings | M | BR-062 |
| FR-M13-02 | Every list, detail, form and dashboard implements four states: loading (skeleton matched to final layout), empty (with a constructive next action), error (with retry), and populated | M | BR-058 |
| FR-M13-03 | WCAG 2.2 Level AA conformance: keyboard operability throughout, visible and unobscured focus indication, target size of at least 24×24 px, non-drag alternatives for every drag interaction, text contrast of at least 4.5:1 and non-text contrast of at least 3:1, consistent navigation and help placement, programmatic labels and error identification, no colour-only meaning | M | BR-060 |
| FR-M13-04 | Responsive behaviour verified at 375, 768, 1024, 1440 and 1920 px; field screens designed mobile-first | M | BR-058 |
| FR-M13-05 | Playwright end-to-end tests cover the critical paths: login as each role; enquiry to quotation to order; ticket to job card to service report; commissioning with countdown; AMC renewal initiation; RA-bill generation with retention posting; invoice with simulated IRN; e-way bill stale-document block; attendance check-in; approval decision; vault question with citation | M | BR-062 |
| FR-M13-06 | Seed data is deterministic: the same seed produces the same dataset on every build, so that demonstrations are reproducible | M | BR-061 |
| FR-M13-07 | Seed data contains no real personal data; all individual names, contact numbers and identifiers are fictional, and this is stated on the Compliance screen | M | BR-061, CN-004 |
| FR-M13-08 | The prototype runs from a local production build with no dependency on external network services | M | BR-062, CN-005 |
| FR-M13-09 | Performance targets: first contentful paint under 1.5 s and largest contentful paint under 2.5 s on the Command Centre at simulated 4G on mid-range hardware; client-side route transitions under 300 ms; lists of 1,000+ rows virtualised and interactive within 500 ms | M | BR-058 |
| FR-M13-10 | A guided demo mode offers an optional step-through of the primary narrative for unattended review by the client | S | BRD §14 |

---

## 6. Data Model

### 6.1 Entity catalogue

Thirty-six entities. Prototype persistence is in-memory with `localStorage` overlay; the schema is nonetheless production-shaped so it transfers directly to Phase 2.

| # | Entity | Purpose | Key relationships |
|---|---|---|---|
| 1 | `Branch` | Location master (4 branches + central warehouse) | 1→N Users, Customers, StockLocations |
| 2 | `User` | Platform account | N→1 Branch; N→1 Role; 1→1 Employee (optional) |
| 3 | `Role` | Named role with permission set | 1→N Users; N→N Permissions |
| 4 | `Permission` | Module × operation grant | N→N Roles |
| 5 | `Customer` | Buying entity | 1→N Sites, Contacts, Quotations, Orders, Invoices, Tickets, AMCs |
| 6 | `Site` | Customer premises | N→1 Customer; 1→N InstalledAssets |
| 7 | `Contact` | Person at a customer | N→1 Customer |
| 8 | `Item` | Unified product/spare/service master | 1→N QuotationLines, StockBalances, BOQ references |
| 9 | `PriceListEntry` | Rate for an item on a price list, effective-dated | N→1 Item |
| 10 | `Enquiry` | Captured demand | N→1 Customer, Site, User; 1→N Quotations |
| 11 | `Quotation` | Priced offer, versioned | N→1 Enquiry; 1→N QuotationLines; 1→0..1 SalesOrder |
| 12 | `QuotationLine` | Offer line | N→1 Quotation, Item |
| 13 | `SalesOrder` | Confirmed order | N→1 Quotation, Customer; 1→N SalesOrderLines, DeliveryChallans, Invoices |
| 14 | `SalesOrderLine` | Order line with fulfilment state | N→1 SalesOrder, Item |
| 15 | `DeliveryChallan` | Statutory goods-movement document | N→1 SalesOrder or Project; 1→0..1 EWayBill |
| 16 | `Invoice` | Tax invoice | N→1 Customer; N→0..1 SalesOrder / JobCard / AMCContract / RABill; 1→N InvoiceLines, Receipts (via allocation) |
| 17 | `InvoiceLine` | Invoice line with tax | N→1 Invoice, Item |
| 18 | `EWayBill` | Movement authorisation | N→1 DeliveryChallan or Invoice |
| 19 | `Receipt` | Money received, allocable | N→N Invoices via `ReceiptAllocation` |
| 20 | `InstalledAsset` | Serial-numbered machine in the field | N→1 Site, Item; 1→N Tickets, JobCards, AMC coverage; 1→0..1 CommissioningReport |
| 21 | `CommissioningReport` | OEM-facing commissioning record | 1→1 InstalledAsset |
| 22 | `AMCContract` | Maintenance agreement | N→1 Customer; N→N InstalledAssets; 1→N ScheduledVisits, Invoices |
| 23 | `ScheduledVisit` | Planned preventive visit | N→1 AMCContract; 1→0..1 Ticket |
| 24 | `ServiceTicket` | Service demand with SLA clocks | N→1 Customer, Site, InstalledAsset; 1→N JobCards |
| 25 | `JobCard` | Single visit record | N→1 ServiceTicket, User (engineer); 1→N PartConsumptions |
| 26 | `PartConsumption` | Part used on a visit | N→1 JobCard, Item; 1→1 StockMovement |
| 27 | `Project` | EPC engagement | 1→N BOQLines, Milestones, DPRs, RABills, RetentionEntries |
| 28 | `BOQLine` | Contracted work item with cumulative execution | N→1 Project, Item (optional) |
| 29 | `Milestone` | Planned/actual schedule point | N→1 Project |
| 30 | `DPR` | Daily progress report (immutable) | N→1 Project |
| 31 | `RABill` | Running-account bill, cumulative | N→1 Project; 1→1 RetentionEntry; 1→0..1 Invoice |
| 32 | `RetentionEntry` | Retention withheld/released | N→1 Project, RABill |
| 33 | `StockLocation` / `StockBalance` | Quantity by item and location | N→1 Item, Branch |
| 34 | `StockMovement` | Append-only inventory ledger entry | N→1 Item, StockLocation; polymorphic source document |
| 35 | `Supplier` / `PurchaseOrder` / `POLine` / `GoodsReceipt` | Inbound procurement chain | N→1 Supplier, Item |
| 36 | `Employee` / `AttendanceRecord` / `LeaveRequest` / `EmployeeDocument` | Workforce records | N→1 Branch; AttendanceRecord N→0..1 JobCard |
| — | `Document` / `DocumentVersion` | Vault record with polymorphic entity link | N→1 owning entity |
| — | `ApprovalRequest` / `ApprovalStep` / `ApprovalChain` | Workflow | polymorphic subject entity |
| — | `Notification` / `MessageLog` | Alerting and simulated outbound messaging | N→1 User |
| — | `AuditLog` | Immutable action record | polymorphic entity |
| — | `AIConversation` / `AIMessage` / `AICitation` | Assistant and vault Q&A with provenance | N→1 User; AICitation N→1 Document or record |
| — | `RentalAsset` / `RentalAgreement` | Rental vertical | N→1 Customer, Item |
| — | `Target` | Sales target by branch/user/period | N→1 Branch, User |

### 6.2 Core relationship narrative

```
Customer ──1:N── Site ──1:N── InstalledAsset ──1:1── CommissioningReport
                                    │
                                    ├──N:N── AMCContract ──1:N── ScheduledVisit
                                    │
                                    └──1:N── ServiceTicket ──1:N── JobCard ──1:N── PartConsumption
                                                                        │              │
                                                                        │              └──1:1── StockMovement
                                                                        └── AttendanceRecord (field check-in)

Enquiry ──1:N── Quotation(v1..vn) ──1:1── SalesOrder ──1:N── DeliveryChallan ──1:1── EWayBill
                                                  │
                                                  └──1:N── Invoice ──N:N── Receipt

Project ──1:N── BOQLine ◄── executed qty ── DPR
   │
   ├──1:N── Milestone
   └──1:N── RABill ──1:1── RetentionEntry
                 └──1:1── Invoice
```

### 6.3 Key enumerations

| Enumeration | Values |
|---|---|
| `Vertical` | EQUIPMENT_SALES, SERVICE_AMC, PROJECTS, RENTAL |
| `OEMPrincipal` | ELGI, ATS_ELGI, KSB, ION_EXCHANGE, OTHER |
| `ItemCategory` | MACHINE, SPARE, CONSUMABLE, ACCESSORY, PIPE_FITTING, SERVICE |
| `CustomerType` | INDUSTRIAL, INSTITUTIONAL, GOVERNMENT, DEALER, RETAIL |
| `EnquirySource` | PHONE, WEBSITE, WHATSAPP, WALK_IN, REFERRAL, EXHIBITION, OEM_LEAD |
| `QuotationStatus` | DRAFT, PENDING_APPROVAL, ISSUED, NEGOTIATION, WON, LOST, EXPIRED |
| `LossReason` | PRICE, DELIVERY_LEAD_TIME, TECHNICAL_FIT, COMPETITOR_RELATIONSHIP, BUDGET_WITHDRAWN, NO_DECISION, OTHER |
| `TicketCategory` | BREAKDOWN, PREVENTIVE_MAINTENANCE, INSTALLATION_COMMISSIONING, WARRANTY_CLAIM, INSPECTION, RENTAL_SUPPORT |
| `TicketSeverity` | CRITICAL, HIGH, NORMAL, LOW |
| `CoverageType` | IN_WARRANTY, UNDER_AMC, CHARGEABLE |
| `TicketStatus` | LOGGED, ASSIGNED, EN_ROUTE, ON_SITE, AWAITING_PARTS, AWAITING_CUSTOMER, RESOLVED, CLOSED, CANCELLED |
| `SLAState` | COMFORTABLE, APPROACHING, IMMINENT, BREACHED |
| `JobOutcome` | RESOLVED, PARTIALLY_RESOLVED, PARTS_AWAITED, REVISIT_REQUIRED, NOT_ATTENDED |
| `AMCCoverage` | COMPREHENSIVE, NON_COMPREHENSIVE |
| `AMCStatus` | DRAFT, ACTIVE, EXPIRING, EXPIRED, RENEWED, TERMINATED |
| `AssetStatus` | RUNNING, DOWN, DECOMMISSIONED, ON_RENT |
| `CommissioningSubmission` | NOT_SUBMITTED, SUBMITTED_IN_WINDOW, SUBMITTED_LATE, OVERDUE |
| `ProjectStatus` | TENDERED, AWARDED, MOBILISED, IN_PROGRESS, COMMISSIONING, COMPLETED, DLP, CLOSED, ON_HOLD |
| `RABillStatus` | DRAFT, SUBMITTED, UNDER_CERTIFICATION, CERTIFIED, PAID |
| `RetentionState` | WITHHELD, NOT_ELIGIBLE, ELIGIBLE, CLAIM_RAISED, RELEASED |
| `MovementType` | RECEIPT, ISSUE, RETURN, TRANSFER, ADJUSTMENT, SCRAP |
| `InvoiceType` | EQUIPMENT, SPARES, SERVICE, AMC, RENTAL, PROJECT_RA |
| `TaxTreatment` | INTRA_STATE_CGST_SGST, INTER_STATE_IGST, EXPORT_ZERO_RATED |
| `PaymentMode` | NEFT, RTGS, CHEQUE, UPI, CASH, ADJUSTMENT |
| `AttendanceState` | PRESENT, ABSENT, ON_LEAVE, ON_FIELD, HALF_DAY, WEEK_OFF, HOLIDAY |
| `ApprovalStatus` | PENDING, APPROVED, REJECTED, RETURNED, ESCALATED, WITHDRAWN |
| `NotificationChannel` | IN_APP, WHATSAPP, EMAIL, SMS |
| `ConfidenceState` | HIGH, MODERATE, LOW, INSUFFICIENT |

### 6.4 Derived fields — computed, never stored as editable

| Field | Derivation |
|---|---|
| `InstalledAsset.coverageState` | Warranty end date and live AMC coverage evaluated against current date |
| `InstalledAsset.warrantyStart` | Commissioning date (not invoice date) |
| `ServiceTicket.responseDue` / `restorationDue` | SLA definition resolved via AMC → OEM commitment → severity default |
| `ServiceTicket.slaState` | Remaining time as a proportion of the committed window |
| `CommissioningReport.submissionDeadline` | Commissioning date + OEM window (per principal) |
| `AMCContract.status` | Dates evaluated against current date |
| `BOQLine.executedValue` / `balanceQty` | Cumulative executed quantity × rate; contracted − executed |
| `RABill.currentPeriodValue` | Cumulative value − previous bill cumulative value |
| `RetentionEntry.amount` | Certified value × project retention percentage |
| `Invoice.outstanding` | Invoice total − allocated receipts − credit notes |
| `StockBalance.onHand` | Sum of stock movements for the item and location |
| All KPIs (K-01 … K-22) | Formulas as published in the BRD dictionary |

---

## 7. Role-Based Access Control

### 7.1 Roles

| Code | Role | Scope | Notes |
|---|---|---|---|
| SA | Super Admin | All branches | Platform administration; no business approval authority by default |
| DB | Director – Business | All branches | Full visibility; top-tier approval authority |
| DS | Director – Strategy | All branches | Full visibility; approval authority on exceptions |
| BM | Branch Manager | Own branch | Sales and local service oversight; discount approval to threshold |
| SE | Sales Executive | Own branch, own records | Pipeline execution |
| SM | Service Manager | All branches (service domain) | Dispatch, SLA, AMC, commissioning |
| FE | Field Engineer | Own assignments | Field execution only |
| PM | Project Manager | Assigned projects | EPC execution and billing preparation |
| AC | Accounts Executive | All branches (commercial domain) | GST documents, receipts, receivables |
| HR | HR & Admin | All branches (people domain) | Attendance, leave, employee records |
| ST | Store In-charge | Assigned stock locations | Inventory movements |
| AU | Auditor | All branches | Read-only across all modules including audit log |

### 7.2 Permission matrix

Legend: **F** full (create, read, update, delete) · **CRU** create/read/update · **RU** read/update · **R** read · **A** approve · **O** own records only · **—** no access

| Module / Capability | SA | DB | DS | BM | SE | SM | FE | PM | AC | HR | ST | AU |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Command Centre (all branches) | R | R | R | — | — | — | — | — | — | — | — | R |
| Command Centre (own branch) | R | R | R | R | — | R | — | — | — | — | — | R |
| Branch league table | R | R | R | R (own highlighted) | — | R | — | — | — | — | — | R |
| Exception feed | R | RU+A | RU | RU (own branch) | — | RU | — | RU (own projects) | RU | — | — | R |
| Customers & sites | F | R | R | F (own branch) | CRU (own) | R | R (assigned) | R | R | — | — | R |
| Enquiries | F | R | R | F (own branch) | CRU (own) | R | — | — | — | — | — | R |
| Quotations | F | R + A | R + A | CRU + A (to threshold) | CRU (own) | R | — | — | R | — | — | R |
| Sales orders | F | R | R | CRU (own branch) | CRU (own) | R | — | — | R | — | — | R |
| Installed assets | F | R | R | R (own branch) | R | F | RU (assigned) | R | — | — | R | R |
| Service tickets | F | R | R | R (own branch) | CRU (own customers) | F | RU (assigned) | — | R | — | R | R |
| Dispatch & assignment | F | R | — | R (own branch) | — | F | R (own) | — | — | — | — | R |
| Job cards | F | R | R | R (own branch) | R | F | CRU (own) | — | R | — | R | R |
| Commissioning reports | F | R | R | R (own branch) | R | F | CRU (own) | — | — | — | — | R |
| AMC contracts | F | R + A | R | CRU (own branch) | CRU (own) | F | R (assigned) | — | R | — | — | R |
| Renewal radar | R | R | R | R (own branch) | R (own) | F | — | — | — | — | — | R |
| Rental fleet | F | R | R | R (own branch) | R | F | R | — | R | — | RU | R |
| Projects & BOQ | F | R | R | R | — | R | — | F (assigned) | R | — | R | R |
| DPR | F | R | R | — | — | — | — | CRU (assigned) | — | — | — | R |
| RA-bills | F | R + A | R | — | — | — | — | CRU (assigned) | RU | — | — | R |
| Retention register | F | R | R | — | — | — | — | RU (assigned) | RU | — | — | R |
| Item master | F | R | R | R | R | R | R | R | R | — | CRU | R |
| Stock & movements | F | R | R | R (own branch) | R | RU | R (boot stock) | R | R | — | F | R |
| Reorder list | R | R | — | R (own branch) | — | RU | — | — | — | — | F | R |
| Purchase orders | F | R + A | R | — | — | R | — | R | R | — | CRU | R |
| Delivery challans | F | R | R | R (own branch) | R | R | R | R | F | — | CRU | R |
| Invoices | F | R | R | R (own branch) | R (own) | R | — | R | F | — | — | R |
| E-way bills | F | R | — | R (own branch) | — | — | — | — | F | — | CRU | R |
| Receipts & allocation | F | R | R | R (own branch) | R (own) | — | — | — | F | — | — | R |
| Receivables & follow-up | F | R | R | RU (own branch) | R (own) | — | — | R | F | — | — | R |
| Ledger hand-off | R | R | — | — | — | — | — | — | F | — | — | R |
| Employees | F | R | R | R (own branch) | — | R | R (self) | — | — | F | — | R |
| Attendance | F | R | R | RU (own branch) | R (self) | RU (engineers) | CRU (self) | R (team) | — | F | R (self) | R |
| Leave | F | R + A | R | A (own branch) | CRU (self) | A (engineers) | CRU (self) | A (team) | CRU (self) | F | CRU (self) | R |
| Statutory HR documents | R | R | R | — | — | — | R (self) | — | — | F | — | R |
| Document vault | F | R | R | R (own branch scope) | R (own scope) | R | R (assigned) | R (own projects) | R | R (HR scope) | R | R |
| Ask the Vault | R | R | R | R | R | R | R | R | R | R | R | R |
| Approvals (act) | — | A | A | A (to threshold) | — | A (service) | — | A (project) | A (commercial) | A (HR) | — | R |
| Approval chain designer | F | RU | R | — | — | — | — | — | — | — | — | R |
| Notification centre | F | R | R | R | R | R | R | R | R | R | R | R |
| Analytics — Sales | R | R | R | R (own branch) | R (own) | — | — | — | R | — | — | R |
| Analytics — Service | R | R | R | R (own branch) | — | R | R (own) | — | — | — | R | R |
| Analytics — Projects | R | R | R | — | — | — | — | R (assigned) | R | — | — | R |
| Analytics — Cash | R | R | R | R (own branch) | — | — | — | R | R | — | — | R |
| Analytics — Inventory | R | R | — | R (own branch) | — | R | — | R | R | — | R | R |
| AI Assistant | R | R | R | R (scoped) | R (scoped) | R (scoped) | — | R (scoped) | R (scoped) | R (scoped) | — | R |
| Users & roles | F | R | R | — | — | — | — | — | — | R | — | R |
| Permission matrix | F | R | R | R | — | R | — | — | R | R | — | R |
| Masters | F | R | R | R | — | RU (SLA, categories) | — | — | RU (tax, series) | RU (leave types) | RU (items) | R |
| Integration readiness | F | R | R | — | — | — | — | — | R | — | — | R |
| Compliance & consent | F | R | R | — | — | — | — | — | R | R | — | R |
| Audit log | R | R | R | — | — | — | — | — | — | — | — | **R** |
| Demo controls | F | RU | — | — | — | — | — | — | — | — | — | — |

### 7.3 Enforcement requirements

| ID | Requirement |
|---|---|
| RBAC-1 | Permissions are enforced at three layers: navigation visibility, route guard, and data query scope. A user who guesses a URL is denied at the route guard, not merely hidden from the menu |
| RBAC-2 | Branch-scoped roles have every list, dashboard and analytics query filtered to their branch; the branch selector is locked |
| RBAC-3 | "Own records only" scoping is applied at the record level (assigned owner or assigned engineer), not by branch alone |
| RBAC-4 | Approval authority is separate from data access: viewing a quotation does not confer authority to approve its discount |
| RBAC-5 | The Auditor role is read-only everywhere, with no write path in any interface, and is the only non-admin role with audit-log access |
| RBAC-6 | Every denied access attempt is recorded in the audit log with the attempted route or action |
| RBAC-7 | The "View as role" demo switcher is itself audit-logged and displays a persistent banner, so impersonation is never invisible |

---

## 8. Simulated Integration Layer

Every integration is simulated. Each simulation is designed to be **behaviourally faithful** — correct sequence, states, latency and failure modes — so that Phase 2 replaces the simulation without redesigning the interface.

| ID | Integration | Real-world role | Simulation design | Visible states | Phase 2 prerequisites |
|---|---|---|---|---|---|
| INT-01 | Accounting ledger (Tally Prime / Busy) | Statutory book of record | Ledger hand-off screen produces a structured period export; a "Sync" control shows a mock progression with per-document success/failure counts and a reconciliation summary | Not synced / Syncing / Synced / Partial failure | Confirm package and version; on-premise connector; chart-of-accounts mapping; test company file |
| INT-02 | GST e-invoice (IRP) | IRN and signed QR on B2B invoices | Invoice issue generates a deterministic mock IRN, an acknowledgement number and date, and renders a QR code in the statutory position; a reporting-window tracker ages unreported invoices | Draft / Issued / Reported (simulated) / Window closing / Window missed | GSTP or API credentials via an authorised GSP; turnover-band confirmation; sandbox testing |
| INT-03 | E-way bill portal | Movement authorisation above threshold | Generation form captures statutory fields, returns a mock EBN with validity and distance-based expiry; **blocks** where the base document exceeds the configured age | Not required / Required / Generated / Expired / Blocked (stale base document) | Portal credentials with 2FA; transporter master; distance source |
| INT-04 | WhatsApp Business API | Notifications and approval actions | Message composer renders an authentic WhatsApp-style preview with interactive buttons; delivery state advances on a timer; buttons perform real in-platform actions; message log retained | Queued / Sent / Delivered / Read / Failed | Meta Business verification; WABA and phone number; template approval; BSP selection. Note: DLT registration is not required for WhatsApp |
| INT-05 | SMS | Fallback channel | Simulated send with a visible annotation that transactional SMS requires TRAI DLT registration of header and template | Queued / Sent / DLT template required | DLT registration; sender header; template approval |
| INT-06 | UPI / payment gateway | Collections against invoices | Collection link generated per invoice with a mock state progression triggerable from Demo Controls | Generated / Sent / Viewed / Paid / Expired | Merchant onboarding; VPA or gateway account; settlement account mapping |
| INT-07 | Biometric / geo attendance | Muster roll for office and field staff | App check-in captures live coordinates and a simulated selfie step; a Demo Controls trigger injects a device-sourced attendance batch | Captured / Device-sourced / Regularised / Exception | Device make/model confirmation; SDK or push API; geofence definitions per branch |
| INT-08 | Aadhaar eSign / DigiLocker | Signed approvals and documents | eSign flow shows a simulated consent and OTP step, returning a signed-document state with a signature panel on the PDF | Unsigned / Signing / Signed (simulated) | ASP/ESP engagement; consent artefact design; legal review |
| INT-09 | SSO (Google Workspace / Microsoft 365) | Authentication | Login screen presents provider buttons which resolve to the seeded demo session | Available (simulated) | Tenant admin consent; domain verification; group-to-role mapping |
| INT-10 | Maps / routing | Site addresses and engineer routing | Static map thumbnails with pins from seeded coordinates; a route-order suggestion computed from a fixed distance matrix | Rendered from seed | Maps API key; billing account; geocoding of real site addresses |
| INT-11 | OEM channel portals | Commissioning submission and warranty claims | Commissioning register offers a "Submit to OEM" action producing a mock acknowledgement reference and timestamp | Not submitted / Submitted / Acknowledged | OEM portal access per principal; agreement on submission format |

> **FR-M1-16** requires all eleven to be listed on the Integration Readiness screen with these prerequisites, so that the client sees precisely what Phase 2 involves and never mistakes simulation for connection.

---

## 9. AI Specification

### 9.1 Scope of AI in this product

AI performs exactly three jobs. Anything else is out of scope.

| Job | Where | Behaviour |
|---|---|---|
| **Retrieve with citation** | M9 Ask the Vault | Answers questions from the document corpus, citing each assertion to a source document and passage |
| **Summarise** | M2 Daily Briefing, M11 anomaly notes, M12 report drafting | Condenses platform data into plain language, citing the records behind each statement |
| **Draft** | M12 Assistant | Prepares renewal quotations, follow-up messages and management-review narratives for human review and submission |

### 9.2 Guardrails

These are product requirements, not aspirations. Independent academic evaluation of retrieval-augmented professional research tools has reported materially non-trivial rates of incorrect output even in well-resourced commercial systems. The product's design assumes that AI will sometimes be wrong and makes that safe.

| ID | Guardrail |
|---|---|
| AI-G1 | **No autonomous action.** The AI cannot create, modify, approve, send or delete a business record. It may only prepare a draft for a human to act on |
| AI-G2 | **No assertion without provenance.** Every factual statement carries a citation to a document or a record set. An uncited sentence is a defect |
| AI-G3 | **Explicit insufficiency.** Where evidence is inadequate, the system states so, names what it searched, and offers nearest matches. Confident-sounding unsupported answers are a defect |
| AI-G4 | **Visible confidence.** Every answer shows High / Moderate / Low / Insufficient with the plain-language basis for that state |
| AI-G5 | **Legible retrieval.** The retrieval path is shown ("searching 1,860 documents → reading 4 sources") so users can judge the basis |
| AI-G6 | **Scoped to permission.** The AI answers only from data the asking user is permitted to see; the same question from two roles may correctly yield different answers |
| AI-G7 | **Standing disclosure.** Every AI surface states what the AI does and does not do |
| AI-G8 | **Feedback capture.** Helpful / not-helpful with comment on every answer, retained for evaluation |
| AI-G9 | **No personal-data inference.** The AI does not infer or assert anything about individuals beyond the records; employee personal data is excluded from general AI retrieval |
| AI-G10 | **Simulated in Phase 1.** All AI responses are deterministic, seeded, and marked as prototype behaviour; the UX contract is what is being validated |

### 9.3 Simulation approach in the prototype

| Aspect | Approach |
|---|---|
| Answer generation | Deterministic, pre-authored answer set keyed to a curated question bank, plus a template-driven path for parameterised questions (for example, expiring AMCs by branch and month) computed live from seed data |
| Streaming | Character-streamed at 18–28 characters per second with a blinking caret, preceded by staged retrieval indicators |
| Citations | Real links to real seeded documents and record sets, with passage highlighting on open |
| Confidence | Derived from the number and agreement of matched sources in the seeded index |
| Insufficiency | Deliberately included in the question bank so the honest-failure behaviour is demonstrable, not hypothetical |
| Latency | 600–1,400 ms before first token, to feel authentic rather than instant |

### 9.4 Curated question bank (illustrative)

| Surface | Question | Expected behaviour |
|---|---|---|
| Vault | "What are the scope exclusions in the AMC for the compressors at the Hajipur unit?" | Cites the specific AMC document, quoting the exclusion clause reference |
| Vault | "What capacity was recorded in the commissioning certificate for the treatment plant project?" | Cites the commissioning certificate and states the recorded figure |
| Vault | "Which test certificates for live projects expire in the next sixty days?" | Returns a list, each citing its document |
| Vault | "What is our standard warranty period on screw compressors?" | Cites the OEM terms document; if the corpus lacks a definitive source, returns Insufficient with nearest matches |
| Assistant | "How much is outstanding beyond ninety days from institutional customers?" | Returns figure + invoice list + formula |
| Assistant | "Which AMCs expire next month, by branch?" | Returns a table + link to Renewal Radar filtered identically |
| Assistant | "Which engineer has the lowest first-time-fix rate this quarter?" | Returns figure per engineer, formula, contributing job cards; notes small-sample caution where applicable |
| Assistant | "Will the treatment plant project finish on time?" | Declines to forecast; presents schedule variance and the evidence, stating that it does not predict |
| Assistant | "Draft the monthly management review for July." | Produces a structured narrative with cited figures, editable and exportable |
| Briefing | (automatic) | Position, movements, three items warranting attention, each cited |

---

## 10. Non-Functional Requirements

| ID | Category | Requirement | Verification |
|---|---|---|---|
| NFR-01 | Performance | Command Centre FCP < 1.5 s, LCP < 2.5 s on simulated 4G, mid-range hardware | Lighthouse + measured runs |
| NFR-02 | Performance | Client-side route transitions < 300 ms | Instrumented timing |
| NFR-03 | Performance | Lists of 1,000+ rows virtualised; interactive within 500 ms; scroll at 60 fps | Manual + profiler |
| NFR-04 | Performance | Charts render < 400 ms for up to 24 data series | Profiler |
| NFR-05 | Performance | Simulated API latency 120–400 ms, so loading states are genuinely exercised | Code review |
| NFR-06 | Responsiveness | Verified at 375 / 768 / 1024 / 1440 / 1920 px; field screens mobile-first | Device matrix |
| NFR-07 | Accessibility | WCAG 2.2 Level AA in full, including focus not obscured, target size ≥ 24 px, dragging alternatives, accessible authentication, consistent help | axe-core + keyboard-only pass + manual audit |
| NFR-08 | Accessibility | Full keyboard operability including the dispatch board, which must offer a non-drag assignment path | Manual |
| NFR-09 | Accessibility | Contrast ≥ 4.5:1 text, ≥ 3:1 non-text; no meaning conveyed by colour alone; every chart has a tabular equivalent | Automated + manual |
| NFR-10 | Browser support | Latest two versions of Chrome, Edge, Firefox, Safari; Chrome on Android 10+; Safari on iOS 15+ | Matrix testing |
| NFR-11 | Usability | Field job card completable in ≤ 6 taps for a standard visit; validated with two real engineers before build sign-off | Task-based test |
| NFR-12 | Usability | Every screen reachable in ≤ 3 clicks from the user's landing route, or via the command palette in one action | Navigation audit |
| NFR-13 | Reliability | No unhandled promise rejections or console errors in the production build | Console audit in E2E |
| NFR-14 | Reliability | `localStorage` writes are versioned and schema-guarded; a version mismatch resets cleanly with a user notice rather than failing | Code review + test |
| NFR-15 | Maintainability | TypeScript strict, no `any` in application code, no ESLint suppressions without a documented reason | CI check |
| NFR-16 | Maintainability | Zod schemas are the single source of truth for entity shapes; TypeScript types are inferred from them | Code review |
| NFR-17 | Maintainability | No component file exceeds 400 lines; shared logic is extracted to hooks and utilities | Lint rule + review |
| NFR-18 | Security (prototype-appropriate) | No real credentials, no real personal data, no external network calls at runtime | Code review + network audit |
| NFR-19 | Security | Route guards enforce RBAC server-side in route handlers, not only in client components | Code review + E2E |
| NFR-20 | Privacy | Seed data fictional throughout; DPDP-style consent notice and data-principal request register present | Compliance screen review |
| NFR-21 | Auditability | Every mutation writes an audit entry; the audit store is append-only in the prototype implementation | E2E assertion |
| NFR-22 | Portability | Runs from a local production build with no external dependency | Offline demo run |
| NFR-23 | Internationalisation readiness | All user-facing strings externalised; Indian number, currency and date formatting centralised in one utility | Code review |
| NFR-24 | Documentation | README covering setup, seed model, role credentials, demo script, and the simulated-integration inventory | Deliverable review |
| NFR-25 | Testability | Every interactive element carries a stable `data-testid` | Lint rule |

---

## 11. Design System

### 11.1 Design intent

The product must read as **industrial instrumentation, not office software**. Bhushan Corp sells precision machinery that runs continuously under load; the interface should carry that character — measured, dense, legible, quietly confident. The reference register is a modern control room or a well-designed engineering instrument panel, not a consumer dashboard template.

Three consequences follow:
1. **Squared geometry, not rounded friendliness.** Small radii, hairline borders, flat surfaces.
2. **Typographic hierarchy carries the load, not colour.** Colour is reserved for state and vertical identity, so that when something turns amber it means something.
3. **Numbers are the hero.** Tabular figures, Indian grouping, consistent alignment, generous size for headline metrics.

> **PD-002 (Product decision required):** The palette below is a proposed bespoke identity. Exact primary hue should be sampled from the Bhushan Corp wordmark on the live website, or brand assets supplied per BRD DP-002. All colour is expressed as tokens, so re-anchoring the hue is a single-file change.

### 11.2 Colour tokens

```css
/* ============ DARK (default for operational roles) ============ */
--surface-0:      #0B0E13;   /* app background            */
--surface-1:      #12161D;   /* panels, cards             */
--surface-2:      #191F28;   /* raised, table headers     */
--surface-3:      #212A35;   /* hover, active rows        */
--line:           #2A3441;   /* hairline borders          */
--line-strong:    #3A4756;   /* emphasised dividers       */

--text-hi:        #EDF1F6;   /* primary text              */
--text-mid:       #9AA7B8;   /* secondary text            */
--text-lo:        #67748A;   /* tertiary, placeholders    */
--text-inv:       #0B0E13;   /* text on solid accents     */

/* Brand primary — "Bhushan Blue" (sample from wordmark, PD-002) */
--primary-700:    #0F4E8F;
--primary-600:    #1668B8;   /* default action            */
--primary-500:    #2F86D9;   /* hover / focus             */
--primary-100:    #143049;   /* tinted background         */

/* Vertical identity — used consistently everywhere a vertical is shown */
--v-air:          #E9A63B;   /* Equipment / compressed air */
--v-water:        #17A3A0;   /* Water & pumps              */
--v-project:      #6C6BE0;   /* Projects / EPC             */
--v-garage:       #C2705A;   /* Garage equipment           */
--v-rental:       #8B93A6;   /* Rental                     */

/* Semantic state */
--ok:             #2FA05C;
--ok-bg:          #12301F;
--warn:           #E9A63B;
--warn-bg:        #33260D;
--danger:         #D8453C;
--danger-bg:      #34150F;
--info:           #2F86D9;
--info-bg:        #10263C;
--sim:            #C9922C;   /* "Simulated" indicator      */

/* SLA clock states — deliberately distinct from generic semantics */
--sla-comfortable:#2FA05C;
--sla-approaching:#D9A22E;
--sla-imminent:   #E07A2C;
--sla-breached:   #D8453C;

/* Data visualisation — colour-blind safe, ordered for sequential use */
--dv-1: #2F86D9;  --dv-2: #17A3A0;  --dv-3: #E9A63B;
--dv-4: #6C6BE0;  --dv-5: #C2705A;  --dv-6: #4FA86B;
--dv-7: #A8739F;  --dv-8: #7C8CA0;

/* ============ LIGHT (default for accounts, HR, field) ============ */
--surface-0:      #F6F8FA;
--surface-1:      #FFFFFF;
--surface-2:      #EEF2F6;
--surface-3:      #E3EAF1;
--line:           #D7DFE8;
--line-strong:    #BCC7D4;
--text-hi:        #101720;
--text-mid:       #4A5666;
--text-lo:        #778393;
--primary-600:    #14559A;
--primary-500:    #1668B8;
--primary-100:    #E4EFF9;
/* semantic and vertical tokens retain hue, darkened ~8% for AA on light */
```

**Colour rules**
1. Vertical tokens are used *only* to identify a vertical (a tile, a badge, a chart series). They never become decorative.
2. Semantic tokens are used *only* for state. Nothing is red unless something is wrong.
3. Every state that uses colour also uses an icon and a text label (WCAG 2.2, NFR-09).
4. Maximum three accent colours visible in any single viewport.

### 11.3 Typography

| Role | Family | Weights | Usage |
|---|---|---|---|
| Display | **Sora** | 600, 700 | Page titles, KPI headline figures, wordmark |
| UI | **Inter** | 400, 500, 600 | All interface text, labels, tables, body |
| Mono | **JetBrains Mono** | 400, 500 | Serial numbers, document numbers, IRN, codes, audit entries |

```
Type scale (rem)
display-lg   2.25 / 1.15  Sora 700   tabular-nums   — KPI headline
display-md   1.75 / 1.20  Sora 600                  — page title
heading-lg   1.25 / 1.30  Sora 600                  — section
heading-md   1.0625/1.35  Inter 600                 — card title
body-lg      0.9375/1.55  Inter 400                 — prose
body         0.875 /1.55  Inter 400                 — default UI
body-sm      0.8125/1.50  Inter 400                 — table cells, meta
label        0.75  /1.40  Inter 500  +0.02em        — form labels
overline     0.6875/1.30  Inter 600  +0.08em UPPER  — table headers, eyebrows
mono-sm      0.8125/1.45  JetBrains Mono 400        — identifiers
```

**Typographic rules**
1. `font-variant-numeric: tabular-nums` on every numeric cell and every metric, so columns of figures align.
2. Identifiers (serial numbers, invoice numbers, IRN) always render in mono — they are read character by character.
3. Maximum three type sizes per card.
4. Never centre-align body text or numeric columns; numbers right-align, text left-aligns.

### 11.4 Spatial system

| Token | Value | Use |
|---|---|---|
| Base unit | 4 px | All spacing is a multiple |
| Scale | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 | |
| Radius | `sm` 3 px · `md` 5 px · `lg` 8 px · `full` pill (badges only) | Deliberately tight — industrial, not soft |
| Border | 1 px hairline, `--line` | Structure comes from lines, not shadows |
| Elevation | `e0` none · `e1` `0 1px 2px rgb(0 0 0 / .18)` · `e2` `0 4px 12px rgb(0 0 0 / .22)` (overlays only) | No decorative shadows |
| Grid | 12-column, 24 px gutter, max content width 1600 px | |
| Left rail | 240 px expanded / 64 px collapsed | |
| Header | 56 px | |
| Table row | 36 px compact · 44 px comfortable | |
| Touch target | ≥ 44 px on field screens, ≥ 24 px minimum everywhere (WCAG 2.2) | |

### 11.5 Component specifications

| Component | Specification |
|---|---|
| **KPI card** | Overline label · `display-lg` value with Indian currency abbreviation · delta chip with arrow and comparison basis · 40 px sparkline · optional footnote · entire card is a link; hover raises border to `--line-strong` |
| **Vertical health tile** | Vertical colour bar on the left edge (3 px) · vertical name · state chip (Healthy / Watch / Action) with icon · one headline metric · two supporting metrics · click-through |
| **Data table** | Sticky header in `overline` · 36 px rows · zebra off, hover `--surface-3` · right-aligned numerics with `tabular-nums` · sortable headers with explicit direction indicator · column visibility control · sticky first column on horizontal scroll · virtualised beyond 100 rows · row click opens detail; row actions in a trailing menu · selection with bulk action bar |
| **Status badge** | Uppercase `overline`, 3 px radius, 1 px border, tinted background, always paired with a 12 px icon |
| **SLA clock** | Mono countdown (`HH:MM` remaining) · 4-segment progress bar in SLA state colour · icon changes per state · on breach, shows elapsed overrun in `--sla-breached` with a warning icon |
| **Dispatch board** | Columns by ticket status · cards showing customer, machine and serial, severity, SLA clock, assigned engineer avatar · drag-to-assign **plus** a keyboard-accessible assign dialog (NFR-08) · engineer availability strip pinned to the right |
| **Timeline** | Vertical rail with event nodes · timestamp in mono · actor avatar · event label · expandable detail |
| **Document preview** | A4 aspect ratio, white paper on `--surface-0`, letterhead, statutory particulars, print stylesheet, PDF export control |
| **Approval card** | Request type · requester · subject entity summary rendered inline (no navigation required) · value · age against SLA · Approve / Return / Reject with reason field on the latter two |
| **AI answer block** | Streaming text · superscript citation markers `[1]` linked to source · source list beneath with document title and type · confidence chip with tooltip explaining the basis · feedback control · standing disclosure line |
| **Simulated badge** | `--sim` outlined chip, text "Simulated", with a tooltip naming what the real integration requires; never hidden behind hover alone |
| **Empty state** | 32 px line icon · one-line explanation · a primary action that resolves the emptiness · never a bare "No data" |
| **Skeleton** | Matches the final layout's geometry exactly, so the page does not reflow on load |
| **Command palette** | Centred overlay, 640 px, grouped results with type badges, keyboard-first, recent items retained |
| **Toast** | Bottom-right, 4 s, with undo where the action is reversible |
| **Chart** | Recharts · `--dv-*` palette in order · gridlines at 8% opacity · axis labels in `body-sm` · Indian abbreviated currency on axes (₹1.2 Cr, ₹84 L) · legend toggling · hover tooltip with full precision · tabular equivalent accessible via a control |

### 11.6 Iconography and imagery

| Aspect | Decision |
|---|---|
| Icon set | Lucide, 1.5 px stroke, 16 px inline / 20 px controls / 24 px navigation |
| Vertical icons | Equipment — wind/gauge motif · Water — droplet/pump motif · Projects — construction motif · Rental — clock/handshake motif |
| Illustration | None. No stock illustration, no 3D renders, no mascots. Empty states use line icons only |
| Photography | Only user-captured site photographs within job cards and DPRs |
| Logo treatment | Wordmark in Sora 700 with a small industrial glyph; monochrome on dark, brand-primary on light |

### 11.7 Indian formatting conventions (binding)

| Aspect | Rule | Example |
|---|---|---|
| Currency grouping | Indian digit grouping (2-2-3) | ₹1,82,45,600 |
| Currency abbreviation | Lakh / crore in metrics and axes | ₹1.82 Cr · ₹34.6 L · ₹84,500 |
| Abbreviation threshold | Below ₹1 lakh show full figure; ₹1 L–₹99.99 L show lakh; ≥ ₹1 Cr show crore, 2 decimals | |
| Precision | Full precision in documents and tooltips; abbreviated in metrics and charts | |
| Date | `DD MMM YYYY` | 31 Jul 2026 |
| Date-time | `DD MMM YYYY, HH:mm` with IST implied | 31 Jul 2026, 14:35 |
| Relative time | For recency under 24 h | "3 h ago" |
| Financial year | April–March, labelled `FY 2026-27` | |
| Quantities | Up to 3 decimals, unit suffixed | 12.500 Nos · 45.000 Mtr |
| Phone | `+91 9XXXX XXXXX` | |
| GSTIN | 15-character mono, format-validated | |
| Serial numbers | Mono, never truncated in lists | |

### 11.8 Motion

| Interaction | Duration | Easing |
|---|---|---|
| Hover, focus, colour | 120 ms | `ease-out` |
| Dropdown, popover, toast | 160 ms | `cubic-bezier(.2,.8,.2,1)` |
| Panel, drawer, modal | 220 ms | `cubic-bezier(.2,.8,.2,1)` |
| Route transition | 180 ms fade with skeleton | `ease-out` |
| Chart entry | 400 ms, staggered 30 ms per series | `ease-out` |
| SLA clock tick | 1 s, no animation on the digit itself | — |
| AI streaming | 18–28 chars/sec, blinking caret | — |
| Count-up on KPI | 600 ms, only on first paint, never on refresh | `ease-out` |

`prefers-reduced-motion` disables all non-essential motion; count-ups render final values immediately.

---

## 12. Seed Data Specification

Seed data is the difference between a prototype that impresses and a prototype that looks like a template. It must be **internally consistent, arithmetically reconcilable, and recognisably Bhushan Corp's trade**.

### 12.1 Governing rules

| ID | Rule |
|---|---|
| SD-1 | **Deterministic.** A fixed seed produces an identical dataset on every build (FR-M13-06) |
| SD-2 | **Reconcilable.** Every KPI computes from the records; the sum of invoice values equals the revenue figure; ageing buckets sum to total receivables; retention register total equals the sum of retention entries |
| SD-3 | **Referentially complete.** Every ticket has an asset; every asset has a site and a customer; every invoice traces to an order, job card, AMC or RA-bill; every stock movement has a source document |
| SD-4 | **No real personal data.** All individual names, mobile numbers, email addresses and identifiers are fictional (FR-M13-07). Public institutional client names may be referenced as project history where already public, subject to client confirmation |
| SD-5 | **Domain-authentic vocabulary.** Correct terminology throughout: CFM, bar, kW, KLD, BOQ, RA-bill, DPR, muster roll, delivery challan. No invented jargon |
| SD-6 | **Model references at series level.** Machine records reference product line and capacity rather than fabricated catalogue codes; exact model codes to be substituted from the current OEM catalogue at client confirmation |
| SD-7 | **Deliberate imperfection.** The dataset contains breaches, overdue items, a stock-out, a late commissioning submission, a claimed-versus-certified variance and an at-risk project — because a dataset where everything is green demonstrates nothing |
| SD-8 | **Time-anchored.** Simulated "today" is 31 July 2026, inside FY 2026-27, with 18 months of history behind it |

### 12.2 Volumes and figures

| Domain | Seed specification |
|---|---|
| **Branches** | 4 — Patna (HQ + Central Warehouse), Muzaffarpur, Bhagalpur, Gaya. *Branch cities to be confirmed per BRD DP-001; held as data, not code* |
| **Users** | 12 demo accounts, one per role, plus 40 additional employee records without platform access |
| **Employees** | 52 — 9 field engineers (Patna 4, Muzaffarpur 2, Bhagalpur 2, Gaya 1), 11 sales, 6 accounts, 4 stores, 3 HR/admin, 5 projects, 14 support/other |
| **Customers** | 128 — 92 industrial, 14 institutional/government, 8 dealers, 14 retail/other; 6 located in Birgunj, Nepal |
| **Customer industries** | Rice and flour mills, dairy, pharmaceutical, plastics and packaging, tyre retreading, automobile dealership workshops, cold storage, breweries, cement and construction materials, hospitals, hotels, municipal bodies, water-supply undertakings |
| **Sites** | 164 across Bihar districts (Patna, Muzaffarpur, Bhagalpur, Gaya, Hajipur, Begusarai, Purnia, Darbhanga, Sasaram, Bihta) plus Birgunj |
| **Installed assets** | 286 — 172 compressors (piston, screw, oil-free, portable, direct-drive), 61 garage equipment units, 44 pumps, 9 treatment-plant equipment items. Coverage: 38 in warranty, 104 under AMC, 144 out of coverage → **AMC attach rate 42%**, presented as the headline opportunity |
| **AMC contracts** | 96 live (covering 104 assets), 61 comprehensive / 35 non-comprehensive; **14 expiring within 60 days with ₹18.4 L of contract value at stake**; 8 expired unrenewed in the trailing 6 months (the leak, made visible) |
| **Service tickets** | 512 over trailing 12 months; **41 currently open** — 7 breached, 5 imminent, 9 approaching, 20 comfortable. Trailing SLA compliance 86%; trailing FTFR 78% |
| **Job cards** | 736 across the trailing 12 months, with parts consumption on 61% |
| **Commissioning reports** | 74 in the trailing 12 months — 68 submitted within window, 4 submitted late, **2 currently overdue** (visible on the exception feed) |
| **Enquiries** | 340 over trailing 12 months across all channels |
| **Quotations** | 214 — 71 won, 88 lost, 41 open, 14 expired → **win rate 45%**, enquiry-to-order conversion 21%. Loss reasons distributed with price and delivery lead time dominant |
| **Sales orders** | 71 won orders; **order book ₹2.38 Cr** unfulfilled or uninvoiced |
| **Revenue** | FY 2025-26 completed: **₹8.62 Cr** — Equipment ₹4.74 Cr (55%), Service & AMC & spares ₹1.90 Cr (22%), Projects ₹1.72 Cr (20%), Rental ₹0.26 Cr (3%). FY 2026-27 year-to-date (Apr–Jul): **₹3.05 Cr**, against ₹2.68 Cr in the comparable prior period (**+13.8%**) |
| **Invoices** | 618 over 18 months across all six invoice types, with correct intra-state and inter-state tax treatment and 12 export-style Nepal transactions |
| **Delivery challans** | 540, each with the triplicate designation on print |
| **E-way bills** | 312 generated; 1 seeded case deliberately blocked for a stale base document, to demonstrate the control |
| **Receivables** | **₹1.82 Cr outstanding** — 0–30: ₹64 L · 31–60: ₹47 L · 61–90: ₹31 L · 90+: ₹40 L. Institutional and government exposure ₹1.12 Cr (61%). 4 broken payment promises seeded |
| **Projects** | 7 total — 3 live (a treatment-plant package at ₹1.35 Cr, an effluent-treatment package at ₹86 L, a pipeline package at ₹42 L), 4 completed of which 2 are in the defect-liability period. One live project seeded **At Risk** with −11% schedule variance |
| **BOQ lines** | 240 across the 7 projects, sectioned into civil, mechanical supply, electrical, erection & commissioning, and O&M |
| **DPRs** | 420 entries across live projects, with 6 recorded hindrances |
| **RA-bills** | 22 across all projects — including one with a claimed-versus-certified variance of 7%, and one awaiting certification beyond 45 days |
| **Retention** | **₹34.6 L outstanding** across 5 projects; ₹11.2 L across 2 projects now eligible for release (both surfaced as exceptions); ₹6.8 L released historically |
| **Locked cash headline** | ₹1.82 Cr + ₹34.6 L = **₹2.17 Cr** — the single most arresting figure on the Command Centre |
| **Items** | 1,240 SKUs — 96 machines, 742 spares, 168 consumables, 134 accessories, 78 pipes and fittings, 22 service items. Stock value **₹41.8 L** |
| **Stock exceptions** | 168 items at or below reorder level, of which **9 flagged service-critical** (each having caused a job card to await parts); 61 non-moving items worth ₹6.4 L |
| **Purchase orders** | 84 over 12 months across 22 suppliers |
| **Attendance** | 18 months of records for 52 employees, including field check-ins with coordinates tied to job cards; today's board seeded with 3 exceptions (one late, one missing check-out, one field check-in outside geofence) |
| **Leave** | 214 requests over 12 months; 6 pending approval today; one seeded case where approval would drop a branch below minimum engineer coverage |
| **Documents** | 1,860 in the vault — OEM manuals and technical literature, warranty terms, AMC agreements, commissioning certificates, project drawings with revisions, test certificates, client approvals, measurement records, PO copies, customer agreements, HR statutory documents. 11 expiring within 60 days |
| **Approvals** | 9 pending across types today, including 2 breaching approval SLA |
| **Notifications** | 40 seeded, mixed read/unread, across all channels with simulated WhatsApp previews |
| **Audit log** | ~4,200 entries spanning the seeded history |
| **Rental** | 11 rental assets, 6 on rent, 2 overdue for return, trailing utilisation 64% |

### 12.3 Narrative "hooks" deliberately seeded for the demo

Each hook exists so that the demonstration has a story rather than a tour.

| Hook | Where it surfaces | Point it makes |
|---|---|---|
| 2 commissioning reports overdue to OEM | Exception feed → Commissioning register | Warranty at risk; today invisible, now unmissable |
| ₹11.2 L retention newly eligible for release | Exception feed → Retention register | Cash that would otherwise be forfeited |
| 14 AMCs worth ₹18.4 L expiring in 60 days | Command Centre → Renewal Radar | The recurring-revenue engine, made into a pipeline |
| 144 assets out of coverage (42% attach rate) | Renewal Radar → out-of-coverage tab | The growth opportunity nobody has quantified |
| 7 breached SLAs, one 26 hours over | Dispatch board | Turnaround commitments now on a clock |
| A job card awaiting a service-critical part | Dispatch board → Reorder list | Direct causal link between stock and first-time-fix |
| A project at −11% schedule variance | Project portfolio → S-curve | Slippage visible now, not at handover |
| An RA-bill certified 7% below claim | RA-bill → variance | Claimed versus certified, tracked |
| An e-way bill blocked for a 190-day-old base document | E-way bill screen | Statutory control working as designed |
| 4 broken payment promises | Receivables → follow-up log | Collection discipline made accountable |
| A vault question with no supporting document | Ask the Vault | Honest AI: it says it does not know |

---

## 13. Technical Architecture (Prototype)

### 13.1 Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 15**, App Router, React Server Components where beneficial | Route groups per domain |
| Language | **TypeScript**, strict | No `any` in application code |
| Styling | **Tailwind CSS** with the design tokens above exposed as CSS custom properties | Tokens defined once in `globals.css` |
| Components | **shadcn/ui** as the primitive layer, restyled to the token set | Not used as visual defaults — restyling is mandatory so the product does not read as templated |
| Data fetching | **TanStack Query** against internal mock route handlers | Simulated latency 120–400 ms |
| Charts | **Recharts** | Wrapped in a project chart component enforcing palette, formatting and the tabular equivalent |
| Forms | **React Hook Form** + **Zod** | Zod schemas are the single source of entity truth |
| Tables | TanStack Table + virtualiser | For lists beyond 100 rows |
| Icons | **Lucide React** | |
| Dates | `date-fns` with a centralised IST-aware formatting utility | |
| PDF/print | Print stylesheets plus client-side PDF export | No server dependency |
| State persistence | `localStorage`, versioned and schema-guarded | Namespace `pravaah.v1.*` |
| Testing | **Playwright** for E2E; Vitest for utility and formatter units | |
| Tooling | ESLint, Prettier, `tsc --noEmit` in CI | Build must pass clean |

### 13.2 Project structure

```
/app
  /(auth)/login
  /(app)
    layout.tsx                    # shell: rail, header, breadcrumbs, palette
    /command                      # M2
    /sales                        # M3
    /service                      # M4
    /projects                     # M5
    /inventory                    # M6
    /commercial                   # M7
    /people                       # M8
    /vault                        # M9
    /workflow                     # M10
    /analytics                    # M11
    /assistant                    # M12
    /admin                        # M1
  /(field)                        # mobile-first shell, larger targets
    /field/today
    /field/job/[id]
    /field/commissioning/[assetId]
    /field/attendance
  /api                            # mock route handlers, one per resource
/components
  /ui                             # restyled shadcn primitives
  /patterns                       # KpiCard, DataTable, SlaClock, Timeline,
                                  # DocumentPreview, ApprovalCard, AiAnswer,
                                  # SimulatedBadge, EmptyState, ChartFrame
  /domain                         # DispatchBoard, BoqSheet, RaBillBuilder,
                                  # RenewalRadar, AgeingTable, AssetPassport
/lib
  /schemas                        # Zod schemas — source of truth for types
  /seed                           # deterministic generators + fixture JSON
  /derive                         # SLA, coverage, ageing, retention, KPI formulas
  /format                         # INR (lakh/crore), dates, quantities, GSTIN
  /rbac                           # permission matrix, guards, scoping
  /ai                             # question bank, retrieval simulation, streaming
  /store                          # localStorage adapter, versioning, reset
/tests/e2e                        # Playwright specs per critical path
/public
```

### 13.3 Architectural rules

| ID | Rule |
|---|---|
| AR-1 | **Derived values are computed in `/lib/derive`, never stored.** SLA state, coverage state, ageing bucket, retention amount and every KPI have exactly one implementation |
| AR-2 | **KPI formulas are implemented once** and imported by dashboard, analytics and AI assistant alike, so the same number cannot differ between screens |
| AR-3 | **Mock route handlers mirror a realistic REST surface** (`/api/tickets`, `/api/tickets/[id]`, `/api/tickets/[id]/job-cards`) so Phase 2 substitutes a real backend without touching components |
| AR-4 | **RBAC is enforced in route handlers as well as in the UI**, so a guessed URL is denied server-side (NFR-19) |
| AR-5 | **`localStorage` writes are namespaced and versioned**; a schema-version mismatch clears state with a user notice rather than throwing (NFR-14) |
| AR-6 | **No browser storage beyond `localStorage`**, and all mutations also update the in-memory query cache so the UI stays consistent without reload |
| AR-7 | **Simulated integrations live behind a single `/lib/integrations` boundary** with the same call signatures a real client would have, so replacement is a swap |
| AR-8 | **Every simulated integration emits a `MessageLog` or audit entry**, so the demonstration leaves an inspectable trail |
| AR-9 | **The audit writer is a single middleware-style utility** invoked by every mutation, so coverage is structural rather than remembered |
| AR-10 | **Field routes use a separate layout** with larger touch targets, single-column composition and reduced chrome |

---

## 14. Notification & Escalation Matrix

| Event | Recipients | Channels | Timing | Escalates to |
|---|---|---|---|---|
| Ticket logged | Service Manager, assigned engineer | In-app, WhatsApp | Immediate | — |
| SLA approaching (< 25% remaining) | Assigned engineer, Service Manager | In-app, WhatsApp | On threshold | — |
| SLA imminent (< 10% remaining) | Service Manager | In-app, WhatsApp | On threshold | Director – Business at breach |
| SLA breached | Service Manager, Director – Business | In-app, WhatsApp, exception feed | On breach | — |
| Job card submitted | Service Manager | In-app | Immediate | — |
| Parts request raised | Store In-charge, Service Manager | In-app, WhatsApp | Immediate | Service Manager after 4 h |
| Commissioning recorded | Service Manager | In-app | Immediate | — |
| Commissioning submission window at 2 days | Service Manager, Branch Manager | In-app, WhatsApp | On threshold | Director – Business at expiry |
| Commissioning window expired | Service Manager, Director – Business | In-app, exception feed | On expiry | — |
| AMC expiring in 60 / 30 / 7 days | Service Manager, Branch Manager, account owner | In-app, WhatsApp | On each threshold | Director – Business at 7 days |
| AMC expired unrenewed | Service Manager, Director – Business | In-app, exception feed | On expiry | — |
| Warranty expiring in 90 days | Branch Manager, account owner | In-app | On threshold | — |
| Quotation issued | Customer contact (simulated), owner | WhatsApp, in-app | Immediate | — |
| Quotation ageing beyond stage threshold | Owner, Branch Manager | In-app | Daily digest | Branch Manager at second threshold |
| Quotation expiring in 3 days | Owner | In-app, WhatsApp | On threshold | — |
| Discount approval required | Approver per chain | In-app, WhatsApp (actionable) | Immediate | Next authority after SLA |
| Approval pending beyond SLA | Approver, requester | In-app, WhatsApp | On threshold | Next authority |
| Invoice raised | Customer contact (simulated), Accounts | WhatsApp, in-app | Immediate | — |
| Invoice crossing 60 / 90 days | Accounts, Branch Manager | In-app | Daily digest | Director – Business at 90 |
| Payment promise date passed unpaid | Accounts, Branch Manager | In-app, exception feed | On date | Director – Business |
| E-invoice reporting window closing | Accounts | In-app | Daily | — |
| Receipt recorded | Accounts, account owner | In-app | Immediate | — |
| RA-bill certified | Project Manager, Accounts | In-app | Immediate | — |
| RA-bill awaiting certification > 30 days | Project Manager, Director – Business | In-app, exception feed | On threshold | — |
| Retention eligible for release | Project Manager, Accounts, Director – Business | In-app, exception feed | On eligibility | — |
| Project schedule variance beyond tolerance | Project Manager, Director – Business | In-app, exception feed | On computation | — |
| DPR not filed for 2 days on a live project | Project Manager | In-app | Daily | Director – Business at 5 days |
| Stock at or below reorder (service-critical) | Store In-charge, Service Manager | In-app, WhatsApp | Immediate | — |
| Stock at or below reorder (routine) | Store In-charge | In-app | Daily digest | — |
| Attendance exception | HR, reporting manager | In-app | Daily | — |
| Leave request raised | Reporting manager | In-app, WhatsApp (actionable) | Immediate | HR after SLA |
| Leave would breach engineer coverage minimum | Service Manager, HR | In-app | On submission | — |
| Document expiring in 60 / 30 days | Document owner, HR or Project Manager | In-app | On threshold | — |
| Rental return overdue | Service Manager, Accounts | In-app, WhatsApp | Daily | — |

---

## 15. Interaction States

Every screen implements the full state set. Absence of any state is a defect (FR-M13-02).

| State | Requirement |
|---|---|
| **Loading** | Skeleton matching the final geometry exactly, so no reflow occurs. Never a spinner on a full page |
| **Empty (no data yet)** | Line icon, one-line explanation of what appears here, and a primary action that creates the first record |
| **Empty (filters excluded everything)** | Distinguished from the above: states which filters are active and offers "Clear filters" |
| **Partial** | Where some data is available and some is not, render what exists and label the gap; never fail the whole view |
| **Error** | Plain-language cause, a retry control, and a path to continue working elsewhere. No stack traces, no error codes without explanation |
| **Permission denied** | Explains that the role lacks access, names the role that has it, and offers the user's own landing route. Never a blank screen |
| **Validation** | Inline, adjacent to the field, on blur and on submit, with the specific correction required. Summary at the top for forms over one screen |
| **Optimistic mutation** | Immediate UI update with a subtle pending indicator; on failure, revert with a toast explaining what happened |
| **Stale** | If the simulated clock has advanced past a computed value, display a "refresh" affordance rather than silently stale figures |
| **Offline** (field routes) | Banner stating that captured work is held locally and will submit when connectivity returns (simulated behaviour, honestly labelled) |
| **Blocked action** | Explains the rule that blocks it (for example, the stale-base-document e-way bill block), and what would unblock it |

---

## 16. Acceptance Criteria for the Engagement

The prototype is accepted when all of the following are demonstrably true.

| # | Acceptance criterion |
|---|---|
| A-01 | All twelve seeded roles can log in and each lands on their designated route with correctly scoped data |
| A-02 | The Command Centre renders the full four-vertical position, locked-cash figure, exception feed and branch league table within 3 seconds |
| A-03 | Every KPI on every screen can be clicked through to a record list that reconciles exactly to the displayed figure |
| A-04 | A complete sales lifecycle is walkable: enquiry → quotation (with a discount approval) → won → sales order → delivery challan → GST invoice with simulated IRN and QR → receipt → receivables ageing |
| A-05 | A complete service lifecycle is walkable: ticket with SLA clock → dispatch assignment → mobile job card in ≤ 6 taps with parts consumption decrementing stock → service report PDF → FTFR reflected in analytics |
| A-06 | A commissioning is recordable with a visible OEM submission countdown, and the register correctly classifies in-window, late and overdue submissions |
| A-07 | The Renewal Radar surfaces all 14 expiring AMCs and the 144 out-of-coverage assets, and a renewal quotation can be initiated pre-populated in one click |
| A-08 | A complete project lifecycle is walkable: BOQ → DPR raising executed quantity → RA-bill with cumulative and current-period values → retention posted to the register → eligibility surfaced as an exception |
| A-09 | An e-way bill attempt against a base document older than the configured limit is blocked with a clear explanation |
| A-10 | A field engineer can check in with captured location tied to a job card, and the attendance board reflects it |
| A-11 | An approval can be actioned from the simulated WhatsApp preview and the decision is reflected in the platform and the audit log |
| A-12 | Ask the Vault answers at least ten seeded questions with working citations, and at least one question returns an honest insufficiency response |
| A-13 | The AI daily briefing generates with citations resolving to real seeded records |
| A-14 | All eleven simulated integrations are listed on the Integration Readiness screen with their real-world prerequisites |
| A-15 | Every mutation appears in the audit log with actor, action, entity and timestamp, and the log is not editable |
| A-16 | A route the active role lacks permission for is denied by the route guard, not merely hidden, and the denial is logged |
| A-17 | Dark and light themes are both fully designed and switchable, and density switching works |
| A-18 | WCAG 2.2 AA conformance verified: keyboard-only completion of the dispatch assignment, the job card and an approval; automated audit clean |
| A-19 | Playwright suite passes on all critical paths listed in FR-M13-05 |
| A-20 | Production build completes with zero TypeScript errors, zero lint warnings, and runs from a local build with no external network dependency |
| A-21 | Demo Controls can reset seed state and advance the simulated clock |
| A-22 | Documentation delivered: README, role credentials, seed-data model, demo script, simulated-integration inventory |

---

## 17. Demonstration Script

A twelve-minute narrative for the client presentation. The order is deliberate: it opens on money, moves to leakage, then to control, and closes on honesty.

| Time | Screen | Narrative beat |
|---|---|---|
| 0:00–1:00 | Login → `/command` as Director – Business | "One login. This is the whole business." Four verticals, revenue up 13.8% year-to-date, and one figure that stops the room: **₹2.17 crore of locked cash** |
| 1:00–2:30 | Locked Cash panel → 90+ bucket → invoice → customer | "₹40 lakh is beyond ninety days, and ₹1.12 crore of the total is institutional. Here is the invoice. Here is who owns it. Here is what was promised, and here are the four promises that were broken." |
| 2:30–3:30 | `/projects/retention` | "Separately, ₹34.6 lakh is retention. ₹11.2 lakh of it became claimable — and nobody knew, because nothing was watching." |
| 3:30–5:00 | `/service/renewals` | "This is the leak. 14 contracts worth ₹18.4 lakh expire within sixty days. And 144 machines you have installed have no cover at all — a 42% attach rate. That is not a problem; that is a pipeline." One click → renewal quotation pre-populated |
| 5:00–6:30 | `/service/dispatch` | "Seven commitments are breached, one by 26 hours. Every clock is now visible, and every clock escalates." Assign an engineer; show engineer load |
| 6:30–8:00 | Switch to Field Engineer → `/field/today` → job card | "Same platform, engineer's phone. Check in — location captured. Six taps: observation, work done, part used, reading, signature, submit." Show the part decrementing stock and the reorder list flagging it service-critical |
| 8:00–9:00 | `/service/commissioning` | "Two commissioning reports are overdue to the OEM. Until now, that risk was invisible; the warranty depends on it." Show the countdown on a live report |
| 9:00–10:00 | Switch to Project Manager → BOQ → DPR → RA-bill | "Site progress goes in once. The RA-bill builds itself from cumulative executed quantity. Retention posts automatically." Show the −11% schedule variance on the S-curve |
| 10:00–11:00 | Switch to Accounts → invoice with IRN/QR → e-way bill block | "Statutorily correct invoice with IRN and QR. And when someone tries to raise an e-way bill against a 190-day-old document, the platform refuses — and explains why." Point to the "Simulated" badge: "That is honest. Here is exactly what the live connection needs." → `/admin/integrations` |
| 11:00–12:00 | `/vault/ask` → two questions | First question: answered, with citations you can open. Second question: **"I could not find a source for that."** "This is the important part. It tells you when it does not know. It never guesses, and it never acts on your behalf." Close on the Command Centre |

**Closing line for the presenter:** *"Nothing you have seen is a mock-up of a screen. It is a working model of your business — and every number on it came from a document you would recognise."*

---

## 18. Release Plan

| Sprint | Weeks | Modules | Deliverable |
|---|---|---|---|
| **S1** | 1 | M1 foundation, design tokens, shell, RBAC, seed engine | Any role can log in and navigate a themed, permission-correct shell over reconcilable seed data |
| **S2** | 2 | M2 Command Centre, M3 CRM & pipeline | The opening ten minutes of the demo work end to end |
| **S3** | 3 | M4 Service, job cards, AMC, Renewal Radar, commissioning | The distinctive service and warranty story is demonstrable |
| **S4** | 4 | M5 Projects, M6 Inventory | BOQ → DPR → RA-bill → retention, and stock tied to job cards |
| **S5** | 5 | M7 Commercial, M8 People, M10 Workflow & notifications | Statutory documents, attendance, approvals and the WhatsApp layer |
| **S6** | 6 | M9 Vault & AI, M11 Analytics, M12 Assistant, E13 hardening | Accessibility pass, Playwright suite, performance, documentation, demo rehearsal |

**Phase gates**
- End of S2: internal review against A-01 to A-04.
- End of S4: client mid-point walkthrough (validates seed-data realism before polish is applied).
- End of S6: full acceptance against A-01 to A-22, then demo rehearsal.

---

## 19. Open Product Decisions

| ID | Decision required | Owner | Needed by | Default if unanswered |
|---|---|---|---|---|
| PD-001 | Product name (Pravaah / alternate) | Client | Before S1 | Proceed as Pravaah |
| PD-002 | Primary brand hue — sample from wordmark or supplied assets | Client | Before S1 | Sample from the live website wordmark |
| PD-003 | Confirmed branch cities | Client | Before S1 | Patna, Muzaffarpur, Bhagalpur, Gaya (held as data) |
| PD-004 | Default theme per role | Client | S1 | Per §2.1 matrix |
| PD-005 | Discount approval thresholds by role | Client | S2 | 5% Branch Manager, 10% Director – Business, above 10% Director – Strategy |
| PD-006 | OEM commissioning submission window per principal | Client | S3 | 7 days |
| PD-007 | Default SLA hours by severity and coverage | Client | S3 | Critical 4 h response / 24 h restore; High 8/48; Normal 24/96; Low 48/168 |
| PD-008 | Retention percentage and defect-liability period defaults | Client | S4 | 5% retention, 12-month DLP |
| PD-009 | Whether rental is in the Phase 1 prototype | Client | S3 | Included as a reduced feature set (Could) |
| PD-010 | Whether public institutional client names may appear in seed data | Client | S1 | Use anonymised institutional archetypes |
| PD-011 | Preferred notification channel default | Client | S5 | WhatsApp for actionable, in-app for informational |
| PD-012 | Whether the Auditor role is required in Phase 1 | Client | S1 | Included — it is low cost and demonstrates governance |

---

## 20. Traceability Summary

| BRD requirement range | PRD functional requirements | Module | Epic |
|---|---|---|---|
| BR-001 – BR-007 | FR-M2-01 … FR-M2-14, FR-M11-11, FR-M12-01 | M2, M11, M12 | E2, E11, E12 |
| BR-008 – BR-015 | FR-M3-01 … FR-M3-22 | M3 | E3 |
| BR-016 – BR-025 | FR-M4-01 … FR-M4-32 | M4 | E4 |
| BR-026 – BR-031 | FR-M5-01 … FR-M5-20 | M5 | E5 |
| BR-032 – BR-038 | FR-M7-01 … FR-M7-19 | M7 | E7 |
| BR-039 – BR-043 | FR-M6-01 … FR-M6-15 | M6 | E6 |
| BR-044 – BR-048 | FR-M8-01 … FR-M8-15 | M8 | E8 |
| BR-049 – BR-051 | FR-M9-01 … FR-M9-13 | M9 | E9 |
| BR-052 – BR-053 | FR-M10-01 … FR-M10-13 | M10 | E10 |
| BR-054 – BR-057 | FR-M1-01 … FR-M1-20 | M1 | E1 |
| BR-058 – BR-062 | FR-M13-01 … FR-M13-10 | cross-cutting | E13 |

---

**End of Product Requirements Document — ARV-BC-PRD-001 v1.0**
