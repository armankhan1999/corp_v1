# User Stories & Acceptance Criteria

**Project:** Pravaah — Unified Operations & Intelligence Platform for Bhushancorp Private Limited
**Version:** 1.0
**Date:** July 31, 2026
**Author:** Solution Architecture & Product, Aravya (aravya.in)
**Format:** As a [role], I want [goal], so that [benefit] + Given/When/Then AC

**Document ID:** ARV-BC-EPC-001 | **Parent:** ARV-BC-PRD-001 v1.0 | **Grandparent:** ARV-BC-BRD-001 v1.0
**Delivery scope:** Phase 1 — high-fidelity frontend prototype, simulated integrations, deterministic seed data

---

## How to read this document

| Convention | Meaning |
|---|---|
| **Priority** | P0 = Must (launch blocker for the prototype) · P1 = Should · P2 = Could |
| **Sprint** | Target sprint 1–6, per the PRD release plan (one-week sprints) |
| **Points** | Fibonacci story points. Calibrated for AI-assisted delivery at roughly 90–95 points per sprint; recalibrate against measured velocity after Sprint 1 |
| **Dependency** | `E{n}-S{m}` for a story dependency, `B{n}` for a business blocker, `PD-{n}` for a pending product decision |
| **ROLE** | Uppercase in story statements. `SYSTEM` denotes platform behaviour with no human actor |

**Roles referenced:** SUPER_ADMIN, DIRECTOR_BUSINESS, DIRECTOR_STRATEGY, BRANCH_MANAGER, SALES_EXECUTIVE, SERVICE_MANAGER, FIELD_ENGINEER, PROJECT_MANAGER, ACCOUNTS_EXECUTIVE, HR_ADMIN, STORE_INCHARGE, AUDITOR, SYSTEM

**Business blockers referenced:**

| ID | Blocker | Needed by |
|---|---|---|
| B1 | Confirmed branch cities and warehouse designation | Sprint 1 |
| B2 | Brand assets or approval to derive identity from the live website (PD-002) | Sprint 1 |
| B3 | Sample redacted documents — quotation, challan, invoice, job card, commissioning report, BOQ, RA-bill | Sprint 1 |
| B4 | Discount approval thresholds by role (PD-005) | Sprint 2 |
| B5 | OEM commissioning submission window per principal (PD-006) | Sprint 3 |
| B6 | Default SLA hours by severity and coverage (PD-007) | Sprint 3 |
| B7 | Retention percentage and defect-liability defaults (PD-008) | Sprint 4 |
| B8 | Confirmation on use of public institutional client names in seed data (PD-010) | Sprint 1 |

---

## Epic E1: Platform Foundation, Identity & Governance

> **Business Objective:** Establish a secure, role-correct, visually bespoke application shell with complete auditability, so that every subsequent module inherits governance rather than bolting it on
> **Target Users:** SUPER_ADMIN, AUDITOR, and all roles as consumers of the shell
> **Success Metrics:** 12 roles land correctly on first login | Zero permission bypasses in E2E testing | 100% of mutations audit-logged | Shell renders in under 1 second
> **Scope Boundary:** In: mock authentication, role switching, shell, navigation, RBAC enforcement at three layers, branch scoping, theming, density, command palette, audit log, masters, integration-readiness disclosure, DPDP-style compliance artefacts | Out: real identity provider, SSO federation, password policy, MFA, production session management (all Phase 2)
> **Risks / Assumptions:** Assumes 12 roles and 4 branches per BRD AS-001 and AS-002; assumes brand hue can be sampled from the live wordmark if assets are not supplied
> **Definition of Done:** All P0 stories complete, RBAC E2E suite passing with zero bypasses, audit log demonstrably append-only, both themes fully designed, WCAG 2.2 AA pass on shell and navigation

### E1-S1: Role-Based Login & Demo Persona Switching
**Priority:** P0 | **Sprint:** 1 | **Points:** 3

**Story:** As a SUPER_ADMIN, I want to sign in as any of the twelve seeded roles and switch between them without logging out, so that the platform can be demonstrated from every persona's viewpoint in a single session.

**Acceptance Criteria:**
- Given the login screen, When it loads, Then twelve seeded demo accounts are listed with name, role, branch and avatar, each selectable in one click
- Given a selected demo account, When sign-in completes, Then a mock session is written to `localStorage` under namespace `pravaah.v1.session` and the user is routed to the landing route defined for that role in the PRD persona matrix
- Given an authenticated session, When the user selects a different role from the header "View as role" control, Then the entire application re-scopes to that role without a page reload and a persistent banner displays "Viewing as {ROLE}" with a control to return
- Given a role switch occurs, When it completes, Then an audit entry of type `SESSION_IMPERSONATION` is written recording original actor, assumed role and timestamp
- Given no valid session, When any application route is requested, Then the user is redirected to `/login` with the requested path retained for post-login return

**Note:** No password validation in Phase 1 — authentication is simulated. The login screen also renders non-functional SSO buttons (Google Workspace, Microsoft 365) marked "Simulated" to evidence the Phase 2 path.

---

### E1-S2: Application Shell & Navigation
**Priority:** P0 | **Sprint:** 1 | **Points:** 5 | **Dependency:** B2 (brand assets / PD-002)

**Story:** As a user in any role, I want a consistent shell with predictable navigation, so that I can move through the platform without relearning the interface on every screen.

**Acceptance Criteria:**
- Given any authenticated route, When it renders, Then a 240 px left rail, 56 px header, breadcrumb bar and content area are present, with the rail collapsible to 64 px and its state persisted per user
- Given the left rail, When it renders, Then navigation is grouped by business function (Command, Sales, Service, Projects, Inventory, Commercial, People, Knowledge, Workflow, Analytics, Assistant, Admin) with the active section and item both visually indicated
- Given the header, When it renders, Then it contains the wordmark, global search, command-palette hint, branch scope selector, notification bell with unread count, theme toggle, density toggle, "View as role" control and user menu
- Given any detail route, When it renders, Then breadcrumbs show the full path and every ancestor segment is a working link
- Given a viewport under 768 px, When any route renders, Then the rail collapses to an overlay drawer and the header condenses, with all controls remaining reachable

---

### E1-S3: RBAC Enforcement Across Navigation, Routes and Data
**Priority:** P0 | **Sprint:** 1 | **Points:** 8 | **Dependency:** E1-S1

**Story:** As the SYSTEM, I must enforce role and branch permissions at navigation, route and data layers, so that a user can neither see nor reach anything their role does not permit, regardless of how they attempt it.

**Acceptance Criteria:**
- Given a role's permission set, When navigation renders, Then only permitted sections and items appear, and no disabled placeholder reveals the existence of a forbidden area
- Given a FIELD_ENGINEER session, When `/commercial/receivables` is requested directly by URL, Then the route handler denies access, the user sees a permission-denied state naming their own landing route, and an audit entry of type `ACCESS_DENIED` records the attempted path
- Given a branch-scoped role such as BRANCH_MANAGER, When any list, dashboard or analytics query executes, Then results are filtered to that role's branch and the branch scope selector is rendered locked with an explanatory tooltip
- Given an "own records only" role such as SALES_EXECUTIVE, When the enquiry list loads, Then only records where that user is the assigned owner are returned, and requesting another user's record by ID returns a not-found response rather than a forbidden response
- Given an AUDITOR session, When any screen renders, Then no create, edit, delete or approve control is present anywhere in the interface, and any mutation endpoint invoked returns a forbidden response
- Given a role with data access but without approval authority, When an approval request is viewed, Then the request is visible but Approve, Reject and Return controls are absent

**Note:** Permission checks live in `/lib/rbac` and are invoked both in server components and in mock route handlers, so the UI and the data layer cannot diverge.

---

### E1-S4: Theme and Density Preferences
**Priority:** P1 | **Sprint:** 1 | **Points:** 3 | **Dependency:** E1-S2

**Story:** As a user in any role, I want to choose a dark or light theme and a compact or comfortable density, so that the interface suits my working environment and the amount of data I handle.

**Acceptance Criteria:**
- Given a first visit with no stored preference, When the application loads, Then the theme defaults to the role default in the PRD persona matrix, falling back to the operating-system preference where no role default exists
- Given the theme toggle, When it is used, Then all surfaces, text, borders, semantic states, SLA clock states and chart palettes switch to the corresponding token set with no element retaining a hard-coded colour
- Given either theme, When contrast is measured, Then all text meets at least 4.5:1 and all non-text indicators meet at least 3:1
- Given the density toggle, When set to Compact, Then table rows render at 36 px and card padding reduces one step; when set to Comfortable, rows render at 44 px
- Given any preference change, When the page is reloaded, Then the preference persists for that user

---

### E1-S5: Global Command Palette
**Priority:** P1 | **Sprint:** 2 | **Points:** 5 | **Dependency:** E1-S3

**Story:** As a user in any role, I want to reach any record, screen or action from a single keyboard shortcut, so that I am never more than one action away from what I need.

**Acceptance Criteria:**
- Given any authenticated screen, When `Cmd+K` or `Ctrl+K` is pressed, Then a centred 640 px overlay opens with focus in the search input
- Given a search term, When it matches records, Then results are grouped by type (Customers, Assets by serial, Tickets, Quotations, Invoices, Projects, Documents, Employees, Screens, Actions) with a type badge on each result
- Given results, When arrow keys and Enter are used, Then navigation and selection work entirely by keyboard, and Escape closes the palette returning focus to the prior element
- Given a user's role permissions, When results are computed, Then records the role cannot access are excluded from results entirely rather than shown and blocked
- Given the palette is opened with no search term, When it renders, Then the user's five most recently visited records are offered

---

### E1-S6: Immutable Audit Log
**Priority:** P0 | **Sprint:** 1 | **Points:** 5

**Story:** As an AUDITOR, I want an immutable record of every action taken in the platform, so that accountability can be established after the fact without relying on anyone's recollection.

**Acceptance Criteria:**
- Given any create, update, delete, state transition, approval, export, login or access denial, When it occurs, Then an audit entry is written capturing actor ID, actor role, action type, entity type, entity ID, a before/after summary for updates, timestamp and simulated IP
- Given the audit log screen, When it loads, Then entries render newest first, virtualised, and are filterable by actor, role, action type, entity type and date range
- Given the audit log, When any interface path is examined, Then no edit or delete control exists, and any attempted mutation of an audit record is rejected by the route handler
- Given a filtered audit view, When export is invoked, Then a CSV is produced containing exactly the filtered rows, and the export itself is recorded as an audit entry
- Given an audit entry for an entity, When the entity reference is clicked, Then the user navigates to that entity, subject to their own permissions

---

### E1-S7: Reference Data Masters
**Priority:** P0 | **Sprint:** 1 | **Points:** 5 | **Dependency:** B1, B6

**Story:** As a SUPER_ADMIN, I want to manage the platform's reference data in one place, so that business rules and vocabulary can be adjusted without code changes.

**Acceptance Criteria:**
- Given the masters screen, When it loads, Then the following sets are manageable: branches, product categories, OEM principals, ticket categories, ticket severities, loss reasons, leave types, units of measure, HSN/SAC codes, GST rates, document numbering series, discount approval thresholds, SLA definitions, OEM commissioning windows, retention percentages and reorder policy defaults
- Given a master value referenced by existing records, When deletion is attempted, Then the action is blocked with a message stating how many records reference it, and deactivation is offered instead
- Given an SLA definition, When it is created, Then it captures product line, severity, coverage type, response hours, restoration hours and whether the clock counts business hours or elapsed hours
- Given a change to any master value, When it is saved, Then an audit entry records the prior and new value
- Given a numbering series, When configured, Then it holds prefix, financial-year segment, current number and width, and the platform prevents gaps and duplicates when issuing numbers

---

### E1-S8: Integration Readiness Disclosure
**Priority:** P0 | **Sprint:** 6 | **Points:** 3

**Story:** As a DIRECTOR_BUSINESS, I want to see exactly which integrations are simulated and what each real connection would require, so that I am never in any doubt about what the prototype does and does not do.

**Acceptance Criteria:**
- Given the integration readiness screen, When it loads, Then all eleven simulated integrations from the PRD are listed with purpose, simulation behaviour, current status and real-world prerequisites
- Given each integration entry, When it renders, Then prerequisites are itemised as credentials, commercial agreements, vendor onboarding and statutory registrations, with a Phase 2 effort indication
- Given the WhatsApp entry, When it renders, Then it states that TRAI DLT registration is not required for WhatsApp while transactional SMS does require it
- Given any simulated control elsewhere in the platform, When it renders, Then it carries a visible "Simulated" chip whose tooltip links to this screen

---

### E1-S9: Compliance, Consent and Retention Artefacts
**Priority:** P0 | **Sprint:** 6 | **Points:** 3

**Story:** As a SUPER_ADMIN, I want the platform to present its data-protection posture explicitly, so that Bhushan Corp can evidence a considered approach to personal data from day one.

**Acceptance Criteria:**
- Given the compliance screen, When it loads, Then it presents an itemised, plain-language consent notice covering categories of personal data held, purposes, retention and the rights available to data principals
- Given the compliance screen, When it loads, Then a data-principal request register is present supporting request type (access, correction, erasure, withdrawal of consent, grievance), requester, received date, status and closure date
- Given the retention configuration, When it renders, Then a retention period is configurable per entity class, and any retention action taken is written to the audit log
- Given a breach-response section, When it renders, Then it presents a checklist reflecting the obligation to intimate the regulator without delay and to notify affected data principals, with a 72-hour detailed-report field, marked as a Phase 2 process placeholder
- Given the compliance screen, When it loads, Then a prominent statement confirms that all seed data in the prototype is fictional and contains no real personal data

---

## Epic E2: Leadership Command Centre

> **Business Objective:** Give leadership the consolidated position of all four verticals in one screen, so that management decisions are made from current evidence rather than from manually assembled reports
> **Target Users:** DIRECTOR_BUSINESS, DIRECTOR_STRATEGY, BRANCH_MANAGER, AUDITOR
> **Success Metrics:** Full render under 3 seconds | Every KPI drillable to source in ≤ 3 clicks | Locked-cash figure reconciles exactly to receivables plus retention | Exception feed surfaces all seeded hooks
> **Scope Boundary:** In: KPI cards, vertical health tiles, locked-cash decomposition, exception feed, branch league table, AI daily briefing, executive view, period selection | Out: user-configurable dashboards, custom widget layouts, self-service report building (excluded per BRD X-06)
> **Risks / Assumptions:** Assumes seed data is arithmetically reconcilable per PRD SD-2; assumes health-state rules are published rather than opaque
> **Definition of Done:** All P0 stories complete, every figure reconciles to its record set, performance target met on mid-range hardware, responsive behaviour verified at all breakpoints

### E2-S1: Headline KPI Cards
**Priority:** P0 | **Sprint:** 2 | **Points:** 5 | **Dependency:** E14-S1 (seed engine)

**Story:** As a DIRECTOR_BUSINESS, I want six headline figures with movement and trend on one row, so that I know the state of the business within seconds of logging in.

**Acceptance Criteria:**
- Given the command centre loads, When the KPI row renders, Then six cards display Revenue for the selected period, Order Book, Locked Cash, Open Service Commitments, AMC Renewals Due within 90 days, and Projects At Risk
- Given each card, When it renders, Then it shows an overline label, the value in Indian abbreviated currency where monetary (for example ₹3.05 Cr, ₹18.4 L), a delta chip with direction arrow and the comparison basis stated in words, and a sparkline of the trailing twelve periods
- Given any KPI card, When it is clicked, Then the user navigates to a filtered list or analytics view whose total reconciles exactly to the figure displayed on the card
- Given a monetary value below ₹1 lakh, When it renders, Then the full figure is shown with Indian digit grouping rather than an abbreviation
- Given the card row, When the viewport narrows below 1024 px, Then cards reflow to two columns and below 768 px to one column, preserving priority order

---

### E2-S2: Vertical Health Tiles
**Priority:** P0 | **Sprint:** 2 | **Points:** 5 | **Dependency:** E2-S1

**Story:** As a DIRECTOR_BUSINESS, I want each of the four verticals to declare its own health, so that I can see instantly which part of the business needs me today.

**Acceptance Criteria:**
- Given the command centre, When it renders, Then four tiles are present for Equipment Sales, Service & AMC, Projects and Rental, each with its vertical colour bar, name, health chip and one headline plus two supporting metrics
- Given a vertical's underlying data, When health is computed, Then the state resolves to Healthy, Watch or Action according to published rules, and hovering or focusing the chip reveals the specific rule that produced the state
- Given a health chip, When it renders, Then it carries both a colour and an icon and a text label, so that meaning is never conveyed by colour alone
- Given any tile, When it is clicked, Then the user navigates to the analytics surface for that vertical with the current period and branch scope preserved
- Given a vertical with no seeded activity in the selected period, When the tile renders, Then it displays an explicit "No activity in this period" state rather than a zero that could be misread as a failure

---

### E2-S3: Locked Cash Panel
**Priority:** P0 | **Sprint:** 5 | **Points:** 8 | **Dependency:** E8-S6, E6-S6

**Story:** As a DIRECTOR_BUSINESS, I want receivables and project retention presented as a single figure I can take apart, so that I can see exactly how much of our money is sitting outside the business and where.

**Acceptance Criteria:**
- Given the panel renders, When it loads, Then a single headline figure is shown equal to total outstanding receivables plus total outstanding retention, and the two components are labelled beneath it
- Given the receivables component, When it renders, Then it decomposes into ageing buckets 0–30, 31–60, 61–90 and 90+ days with count and value per bucket, and the four bucket values sum exactly to the receivables total
- Given the receivables component, When it renders, Then institutional and government exposure is shown separately from private exposure, with both share and value
- Given the retention component, When it renders, Then it shows retention outstanding, retention now eligible for release, and the count of projects contributing
- Given any bucket, component or figure in the panel, When it is clicked, Then a filtered list of the contributing invoices or retention entries opens, whose sum equals the clicked figure
- Given the panel, When any figure is displayed, Then a "data as of" timestamp reflecting the simulated clock is visible

---

### E2-S4: Exception Feed
**Priority:** P0 | **Sprint:** 2 | **Points:** 8 | **Dependency:** E1-S3

**Story:** As a DIRECTOR_BUSINESS, I want the platform to bring problems to me rather than requiring me to find them, so that nothing important fails quietly.

**Acceptance Criteria:**
- Given the exception feed, When it renders, Then it lists items of every seeded exception type: SLA breached or imminent, commissioning submission window closing or expired, AMC expiring or expired unrenewed, quotation aged beyond threshold, invoice beyond 90 days, payment promise broken, project schedule variance beyond tolerance, RA-bill awaiting certification beyond threshold, retention eligible for release, service-critical stock below reorder, and approval pending beyond SLA
- Given each exception, When it renders, Then it shows type, severity, a link to the subject entity, the age of the exception and the accountable owner by name and role
- Given the feed, When it renders, Then items are ordered by severity then age, and the count of unacknowledged exceptions appears on the command centre header
- Given an exception, When Acknowledge, Assign or Snooze is used, Then the state changes, the action is written to the audit log, and snoozed items return after the chosen interval
- Given a role with branch scope, When the feed renders, Then only exceptions relating to that branch are shown
- Given no exceptions exist for the current scope, When the feed renders, Then an explicit "No exceptions requiring attention" state is shown with the time of last evaluation

---

### E2-S5: Branch League Table
**Priority:** P0 | **Sprint:** 2 | **Points:** 5 | **Dependency:** B1

**Story:** As a DIRECTOR_BUSINESS, I want branches ranked on a like-for-like basis, so that underperformance is visible and can be addressed with evidence rather than impression.

**Acceptance Criteria:**
- Given the league table, When it renders, Then each branch appears as a row with revenue against target, service SLA compliance, receivables health, AMC renewal rate and a composite rank
- Given the composite score, When it is displayed, Then the normalisation method is stated in the interface, including how branch size is accounted for, so the ranking is not a black box
- Given any column header, When it is clicked, Then the table sorts by that column, and the composite rank column updates to show position under that sort
- Given any cell, When it is clicked, Then the user navigates to the underlying records for that branch and metric
- Given a BRANCH_MANAGER session, When the table renders, Then all branches are visible for comparison but the manager's own branch is visually highlighted, and drill-down is permitted only into their own branch

**Note:** Per BRD R-07, presentation language is comparative and coaching-oriented rather than punitive; the composite is transparent by design to defuse disputes about fairness.

---

### E2-S6: AI Daily Briefing
**Priority:** P1 | **Sprint:** 6 | **Points:** 5 | **Dependency:** E13-S2

**Story:** As a DIRECTOR_BUSINESS, I want a short plain-language briefing on the day's position, so that I understand not just the numbers but what has changed and what deserves my attention.

**Acceptance Criteria:**
- Given the command centre, When the briefing panel renders, Then a summary is streamed covering current position, notable movements since the prior period, and the three items most warranting attention
- Given any factual statement in the briefing, When it renders, Then it carries an inline citation marker linking to the specific record set that produced it, and clicking the marker opens that record set
- Given the seeded data is insufficient to support a statement, When the briefing generates, Then it states what is missing rather than producing an unsupported assertion
- Given the briefing panel, When a regenerate control is used, Then a fresh briefing is produced against the current simulated date and scope
- Given the briefing, When it renders, Then a standing disclosure states that it is generated from platform data, cites its sources, and takes no actions

---

### E2-S7: Executive View and Period Control
**Priority:** P1 | **Sprint:** 2 | **Points:** 3 | **Dependency:** E2-S1

**Story:** As a DIRECTOR_STRATEGY, I want a simplified high-contrast view with fewer, larger figures, so that I can read the business at a glance on a phone without navigating a dense dashboard.

**Acceptance Criteria:**
- Given the executive view is selected, When it renders, Then six figures are presented at display type size with minimal surrounding chrome and no dense tables
- Given the executive view on a phone viewport, When it renders, Then all figures are legible without zooming and every element is reachable within thumb range
- Given the period selector, When a period is chosen from This Month, Last Month, This Quarter, This FY or Custom, Then every monetary and count metric on the screen recomputes for that period
- Given the financial-year option, When it is selected, Then the period runs April to March and is labelled in the form "FY 2026-27"
- Given a custom period, When invalid dates are entered such as an end date before the start date, Then inline validation prevents application and states the correction required

---

## Epic E3: CRM & Sales Pipeline

> **Business Objective:** Capture every enquiry, control every quotation, and convert measurably — so that pipeline leakage becomes visible and the enquiry-to-order rate can be managed
> **Target Users:** BRANCH_MANAGER, SALES_EXECUTIVE, DIRECTOR_STRATEGY, SERVICE_MANAGER (read), ACCOUNTS_EXECUTIVE (read)
> **Success Metrics:** 100% of enquiries carry an accountable owner | Quotation win rate and enquiry conversion computed automatically | Zero quotations issued above threshold without recorded approval
> **Scope Boundary:** In: customer, site and contact masters, Customer 360, enquiry capture, quotation builder with versioning and GST computation, discount approval gate, win/loss capture, order conversion, pipeline board with ageing, sales desk and follow-ups, print-ready documents | Out: marketing automation, lead scoring models, email campaign management, customer self-service portal (BRD X-08)
> **Risks / Assumptions:** Assumes discount thresholds per PD-005; assumes a per-OEM price list exists or can be seeded credibly
> **Definition of Done:** All P0 stories complete, full enquiry-to-order path walkable, quotation PDF matches a real Bhushan Corp document in structure, win rate and conversion reconcile to records

### E3-S1: Customer, Site and Contact Masters
**Priority:** P0 | **Sprint:** 2 | **Points:** 5

**Story:** As a BRANCH_MANAGER, I want customers recorded with their premises and their people, so that machines, tickets and invoices attach to the right place and the right person.

**Acceptance Criteria:**
- Given the customer form, When it is submitted, Then legal name, trade name, customer type, GSTIN, PAN, industry, credit terms, credit limit, assigned branch, assigned executive and status are captured
- Given a GSTIN is entered, When the field is blurred, Then a 15-character format validation runs and an invalid value is rejected inline with the expected pattern shown
- Given a customer, When sites are added, Then each site captures address, district, state, contact person and site notes, and installed assets attach to a site rather than to the customer
- Given a customer, When contacts are added, Then each captures name, designation, mobile, email and preferred communication channel, and exactly one contact may be marked primary
- Given a duplicate GSTIN is entered for a new customer, When submission is attempted, Then the platform blocks creation and links to the existing customer record
- Given a BRANCH_MANAGER session, When the customer list loads, Then only customers assigned to that branch are returned

---

### E3-S2: Customer 360
**Priority:** P0 | **Sprint:** 2 | **Points:** 8 | **Dependency:** E3-S1, E5-S1

**Story:** As a DIRECTOR_STRATEGY, I want one screen showing everything about a customer, so that forty years of relationship history is finally recorded in one place rather than held in memory.

**Acceptance Criteria:**
- Given a customer record, When Customer 360 loads, Then it presents profile, sites, installed assets with coverage state, open tickets, live AMC contracts, quotation and order history, invoices with outstanding balance, documents and a chronological activity timeline
- Given the outstanding balance shown, When it is computed, Then it equals invoice totals less allocated receipts less credit notes, and clicking it opens the contributing invoices
- Given the installed assets section, When it renders, Then each asset shows serial number in mono type, model and capacity, commissioning date, and coverage state derived from warranty and AMC dates
- Given the activity timeline, When it renders, Then it merges enquiries, quotations, orders, tickets, visits, invoices, receipts and communications in reverse chronological order with actor and timestamp
- Given a customer with credit limit exceeded, When Customer 360 loads, Then a warning indicator is displayed with the exposure and the limit
- Given a role without permission for a section such as invoices, When Customer 360 loads, Then that section is omitted entirely rather than shown empty

---

### E3-S3: Enquiry Capture and Assignment
**Priority:** P0 | **Sprint:** 2 | **Points:** 5 | **Dependency:** E3-S1

**Story:** As a BRANCH_MANAGER, I want every enquiry captured with its source and an accountable owner, so that demand cannot leak before it ever reaches a quotation.

**Acceptance Criteria:**
- Given the enquiry form, When it is submitted, Then source channel, customer (existing or newly created inline), site, vertical, requirement description, expected value, expected closure date and owner are captured
- Given the vertical is equipment, When the form renders, Then technical parameter fields appropriate to the product line are offered, such as required air delivery in CFM and working pressure in bar for compressors, or head and flow for pumps
- Given an enquiry is created without an owner, When it is saved, Then it appears in an unassigned queue visible to the BRANCH_MANAGER with an age indicator, and it is excluded from any executive's personal pipeline
- Given the enquiry list, When filters are applied, Then branch, owner, source, vertical, status and age filters combine, and the filter set can be saved as a named view
- Given an enquiry is created, When it is saved, Then an audit entry records the creation and the source channel

---

### E3-S4: Quotation Builder with GST Computation
**Priority:** P0 | **Sprint:** 2 | **Points:** 8 | **Dependency:** E3-S3, E7-S1, B3

**Story:** As a SALES_EXECUTIVE, I want to build a quotation from the item master with tax computed for me, so that offers are consistent, arithmetically correct and defensible.

**Acceptance Criteria:**
- Given a quotation in draft, When line items are added from the item master, Then description, unit, HSN/SAC and GST rate populate from the item, and the price-list rate populates as the default rate
- Given line quantity, rate and discount, When any is changed, Then taxable value, tax amount and line total recompute immediately, and the quotation totals recompute with correct rounding
- Given the customer's place of supply, When tax is computed, Then intra-state supplies split into CGST and SGST and inter-state supplies apply IGST, with the derivation displayed to the user for verification rather than silently applied
- Given a quotation, When commercial terms are entered, Then validity period, payment terms, delivery terms, warranty terms, scope inclusions and exclusions and free-text technical notes are captured
- Given a completed quotation, When the print preview is opened, Then an A4 document renders with letterhead, statutory particulars, itemised lines, tax summary, terms and authorised signatory block, and exports to PDF
- Given a line item with no price-list entry for the current date, When it is added, Then the rate field is empty and flagged as requiring manual entry rather than defaulting to zero

---

### E3-S5: Quotation Versioning and Lifecycle
**Priority:** P0 | **Sprint:** 3 | **Points:** 5 | **Dependency:** E3-S4

**Story:** As a BRANCH_MANAGER, I want quotation revisions preserved and states enforced, so that we always know what was actually offered to a customer and when.

**Acceptance Criteria:**
- Given an issued quotation, When it is revised, Then a new version is created, the prior version becomes read-only, and a version history lists every version with date, author and a summary of what changed
- Given the state model, When a transition is attempted, Then only the permitted transitions Draft → Pending Approval → Issued → Negotiation → Won / Lost / Expired are allowed, and any other attempt is rejected with an explanatory message
- Given a quotation whose validity date has passed, When the system evaluates state, Then it is marked Expired, excluded from open pipeline value, and the transition is written to the audit log
- Given an expired quotation, When a user attempts to mark it Won, Then the action is blocked and revision to a new version is offered instead
- Given any version, When it is opened, Then the document preview reflects that version's content exactly, not the current version's

---

### E3-S6: Discount Approval Gate
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E3-S4, E11-S1, B4

**Story:** As a DIRECTOR_BUSINESS, I want discounts beyond defined limits to require my recorded approval before the offer leaves the building, so that margin is protected by a rule rather than by trust.

**Acceptance Criteria:**
- Given a quotation whose effective discount exceeds the configured threshold for the issuing user's role, When issue is attempted, Then issue is blocked, the quotation moves to Pending Approval, and an approval request is raised to the chain configured for that threshold band
- Given a pending approval, When the approver views it, Then the full quotation context including line-level discounts, resulting margin indication and customer history is visible inline without navigating away
- Given an approval decision, When it is recorded, Then the quotation moves to Issued on approval or returns to Draft on rejection with the reason attached and visible to the requester
- Given a quotation in Pending Approval, When any user attempts to send or export it as an issued document, Then the action is blocked with a message naming the pending approver
- Given an approval is granted, When the quotation is issued, Then the approval reference, approver and timestamp are recorded on the quotation permanently and appear on the audit trail

---

### E3-S7: Win, Loss and Order Conversion
**Priority:** P0 | **Sprint:** 3 | **Points:** 5 | **Dependency:** E3-S5

**Story:** As a BRANCH_MANAGER, I want wins to become orders without re-entry and losses to be explained, so that the pipeline both converts cleanly and teaches us something.

**Acceptance Criteria:**
- Given a quotation marked Won, When the transition completes, Then a sales order is created pre-populated with all quotation lines, terms and customer details, linked bidirectionally, with no field requiring re-entry
- Given a sales order, When it is completed, Then customer PO reference and date, delivery schedule, advance received and line-level fulfilment status are captured, and partial fulfilment across multiple despatches is supported
- Given a quotation marked Lost, When the transition is attempted, Then a structured loss reason must be selected from the configured list and a competitor name may be entered, and the transition is blocked until a reason is provided
- Given loss reasons across the period, When the sales analytics surface renders, Then the distribution of loss reasons is charted and each segment is clickable to its quotations
- Given a sales order created from a quotation, When the source quotation is opened, Then it displays the resulting order number as a working link

---

### E3-S8: Pipeline Board with Automatic Ageing
**Priority:** P0 | **Sprint:** 3 | **Points:** 8 | **Dependency:** E3-S3, E3-S5

**Story:** As a BRANCH_MANAGER, I want my pipeline as a board that ages itself, so that opportunities going cold become visible before they are lost.

**Acceptance Criteria:**
- Given the pipeline board, When it renders, Then columns represent Enquiry, Qualified, Quoted, Negotiation, Won and Lost, each with a count and total value in the header
- Given a card, When it renders, Then it shows customer, value, owner, days in current stage and next action date
- Given a card is dragged to another column, When the drop completes, Then the corresponding state transition executes with all its validations, and a rejected transition returns the card to its origin with an explanatory message
- Given the board, When keyboard navigation is used, Then a card can be moved between stages entirely by keyboard through an explicit move control, satisfying the non-drag alternative requirement
- Given a card exceeding its stage ageing threshold, When it renders, Then a warning treatment is applied; beyond a second threshold an escalation treatment is applied and the item appears in the exception feed
- Given a BRANCH_MANAGER session, When the board loads, Then all executives in that branch are shown, and a SALES_EXECUTIVE session shows only their own cards

---

### E3-S9: Sales Desk and Follow-Up Log
**Priority:** P1 | **Sprint:** 3 | **Points:** 5 | **Dependency:** E3-S8

**Story:** As a SALES_EXECUTIVE, I want my own working screen with today's actions and my performance, so that I know what to do next without being told.

**Acceptance Criteria:**
- Given the sales desk, When it loads, Then it shows the executive's open enquiries, quotations awaiting action, today's scheduled follow-ups and target against achieved for the current period
- Given any enquiry, quotation or customer, When a follow-up is recorded, Then mode (call, visit, email, WhatsApp), outcome, notes and next-action date are captured
- Given a recorded follow-up, When it is saved, Then it appears on the customer's activity timeline and the next-action date drives the desk's follow-up list
- Given a follow-up whose next-action date has passed without a subsequent activity, When the desk renders, Then it is flagged as overdue
- Given the target-versus-achieved indicator, When it renders, Then the target source and period are stated, and clicking it opens the contributing orders

---

## Epic E4: Service Desk & Field Execution

> **Business Objective:** Put every service commitment on a visible clock and every field visit on a digital record, so that turnaround is managed, first-time-fix becomes measurable, and technician work is defensibly documented
> **Target Users:** SERVICE_MANAGER, FIELD_ENGINEER, BRANCH_MANAGER (read), ACCOUNTS_EXECUTIVE (read)
> **Success Metrics:** Standard field visit closed in ≤ 6 taps | 100% of tickets carry derived SLA clocks | FTFR derived from job cards with zero manual entry | All breaches escalate automatically
> **Scope Boundary:** In: ticket intake with SLA derivation, live clocks and escalation, dispatch board with engineer availability, desktop and mobile job cards, parts consumption linked to stock, service report and chargeable billing hand-off, field day view | Out: route optimisation algorithms, GPS telematics hardware (BRD X-14), offline-first synchronisation (BRD X-11), IoT machine telemetry (Phase 3)
> **Risks / Assumptions:** BRD R-01 — field adoption is the highest risk in the programme; the six-tap budget is a hard constraint validated with two real engineers before build sign-off. Assumes SLA defaults per PD-007
> **Definition of Done:** All P0 stories complete, six-tap budget verified by task-based test, keyboard-accessible dispatch assignment verified, FTFR reconciles to job-card outcomes, E2E ticket-to-report path passing

### E4-S1: Service Ticket Intake with SLA Derivation
**Priority:** P0 | **Sprint:** 3 | **Points:** 8 | **Dependency:** E5-S1, E1-S7, B6

**Story:** As a SERVICE_MANAGER, I want every service request logged against a specific machine with its commitments derived automatically, so that no ticket exists without a known clock and a known coverage basis.

**Acceptance Criteria:**
- Given the ticket form, When it is submitted, Then customer, site, installed asset, reported problem, category, severity, reporting contact and channel are captured
- Given the installed asset field, When a serial number is typed, Then matching assets are found by serial, model or customer, and selecting one populates site, machine particulars and coverage state
- Given a selected asset, When the ticket is created, Then coverage is derived automatically as Warranty, AMC or Chargeable from the asset's live warranty and AMC state, and the derivation basis is displayed rather than merely asserted
- Given a created ticket, When SLA is resolved, Then response-due and restoration-due timestamps are computed using precedence AMC contract terms, then OEM commitment for the product line, then severity default, and the rule actually applied is named on the ticket
- Given a ticket for an asset with no coverage, When it is created, Then it is classified Chargeable and a warning notes that a quotation or customer approval may be required before work
- Given a ticket is created, When it is saved, Then the assigned SERVICE_MANAGER and the branch are notified per the notification matrix

---

### E4-S2: Live SLA Clocks and Escalation
**Priority:** P0 | **Sprint:** 3 | **Points:** 8 | **Dependency:** E4-S1

**Story:** As a SERVICE_MANAGER, I want every commitment counting down in front of me and escalating without my intervention, so that breaches are prevented rather than discovered.

**Acceptance Criteria:**
- Given an open ticket, When the SLA clock renders, Then remaining time is shown in mono type with a four-segment progress indicator, and the state resolves to Comfortable, Approaching below 25% remaining, Imminent below 10% remaining, or Breached
- Given a clock state change, When it occurs, Then notifications are dispatched per the notification matrix, with imminent notifying the SERVICE_MANAGER and breach additionally notifying the DIRECTOR_BUSINESS
- Given a breach occurs, When it is recorded, Then the breach timestamp and a reason code are stored permanently on the ticket and cannot be edited away, and elapsed overrun is displayed thereafter
- Given an SLA definition configured for business hours only, When the clock computes, Then non-working hours are excluded per the branch calendar, and the basis (business hours or elapsed) is labelled on the clock
- Given a ticket moved to Awaiting Parts or Awaiting Customer, When the pause policy for that status is enabled in masters, Then the clock pauses, the pause is logged with start and end, and the paused duration is shown separately from remaining time
- Given a breached or imminent ticket, When the exception feed is evaluated, Then it appears there with severity, age and accountable owner

---

### E4-S3: Dispatch Board with Engineer Availability
**Priority:** P0 | **Sprint:** 3 | **Points:** 13 | **Dependency:** E4-S2, E9-S1

**Story:** As a SERVICE_MANAGER, I want every open ticket and every engineer's load on one screen, so that I can assign the right person to the most urgent job without making phone calls.

**Acceptance Criteria:**
- Given the dispatch board, When it loads, Then all open tickets render in lanes by status (Logged, Assigned, En route, On site, Awaiting parts, Awaiting customer, Resolved), default-sorted within lanes by time-to-breach ascending
- Given each ticket card, When it renders, Then it shows customer, machine with serial in mono, severity, coverage type, SLA clock with state colour and icon, and the assigned engineer where one exists
- Given the board, When it renders, Then an engineer availability strip lists each engineer with today's assigned load, current status, branch and OEM certification tags
- Given a ticket, When it is dragged onto an engineer, Then assignment completes, the ticket moves to Assigned, and the engineer is notified
- Given a ticket, When keyboard-only interaction is used, Then an explicit Assign control opens a dialog permitting selection of an engineer, satisfying WCAG 2.2 dragging alternatives
- Given an engineer already at or above the configured daily capacity, When assignment is attempted, Then a warning states the current load and assignment proceeds only after an override reason is recorded
- Given an engineer lacking the OEM certification tag for the machine's principal, When assignment is attempted, Then a warning is shown identifying the missing certification, and assignment proceeds only with an acknowledged override
- Given preventive-maintenance visits due within seven days, When the board renders, Then they appear as forward-planned work visually distinguished from breakdown tickets

---

### E4-S4: Job Card Creation and Completion (Desktop)
**Priority:** P0 | **Sprint:** 3 | **Points:** 8 | **Dependency:** E4-S3

**Story:** As a SERVICE_MANAGER, I want a complete job card per visit, so that what happened on site is recorded once and becomes the basis for billing, metrics and customer evidence.

**Acceptance Criteria:**
- Given a ticket, When a job card is created, Then scheduled date, assigned engineer and visit type are captured, and multiple job cards may exist against one ticket for repeat visits
- Given a job card, When it is completed, Then check-in and check-out timestamps, observations, root-cause category, work performed, parts consumed, machine running-hours reading, next-visit recommendation and outcome are captured
- Given the outcome field, When it is set, Then it resolves to Resolved, Partially resolved, Parts awaited, Revisit required or Not attended, and a first-visit resolution flag is derived automatically from the outcome and the visit sequence
- Given a job card is submitted with outcome Resolved, When the parent ticket has no other open job card, Then the ticket transitions to Resolved and the restoration clock stops at that timestamp
- Given customer acknowledgement, When it is captured, Then contact name, designation and a drawn signature are recorded, and the job card cannot be submitted as Resolved without acknowledgement
- Given a running-hours reading lower than the previously recorded reading for that asset, When submission is attempted, Then validation blocks it and requires either correction or an explicit meter-replacement note

---

### E4-S5: Mobile Job Card in Six Taps
**Priority:** P0 | **Sprint:** 4 | **Points:** 13 | **Dependency:** E4-S4

**Story:** As a FIELD_ENGINEER, I want to close a standard visit on my phone in a handful of taps, so that recording the job is faster than filling in the paper card.

**Acceptance Criteria:**
- Given a standard visit with no parts consumed, When the engineer completes the mobile job card, Then closure is achievable in six taps or fewer, measured from opening the job to submission
- Given the mobile job card, When it renders, Then it is a single-column guided flow with one decision per screen, all controls within thumb reach, touch targets of at least 44 px, and a visible step progress indicator
- Given each step, When it is completed, Then the entry is saved independently so that interruption does not lose prior input, and returning to the job resumes at the first incomplete step
- Given the observations and work-performed steps, When they render, Then frequently used entries appropriate to the machine's product line are offered as one-tap selections with free text available as a fallback
- Given the signature step, When it renders, Then a full-width signature area is presented with clear and confirm controls, operable with a finger
- Given the engineer is at a site with no data connectivity, When work is entered, Then a banner states that entries are held on the device and will submit when connectivity returns, and the simulated behaviour matches that statement honestly
- Given a photograph step, When the camera is used, Then captured images attach to the job card with a caption field

**Note:** BRD R-01 mitigation. The six-tap budget must be validated with two real Bhushan Corp engineers before this story is accepted; the tap count is measured, not estimated.

---

### E4-S6: Parts Consumption Linked to Stock
**Priority:** P0 | **Sprint:** 4 | **Points:** 5 | **Dependency:** E4-S4, E7-S2

**Story:** As a FIELD_ENGINEER, I want parts I use recorded against the job and taken out of stock automatically, so that inventory reflects reality and the customer is billed correctly.

**Acceptance Criteria:**
- Given a job card, When a part is added, Then it is selected from the item master with the issuing location's available quantity displayed, and quantity entered cannot exceed available quantity without an explicit shortage path
- Given a job card is submitted with parts consumed, When submission completes, Then a stock movement of type Issue is written for each part referencing the job card as its source document, and the location's balance decrements accordingly
- Given coverage is Chargeable or the AMC is non-comprehensive, When parts are consumed, Then they flow to the chargeable billing summary with rate and applicable GST; where coverage is Warranty or comprehensive AMC, they are recorded at cost and marked non-billable
- Given a required part is unavailable, When the engineer raises a parts request, Then the ticket moves to Awaiting Parts, the STORE_INCHARGE and SERVICE_MANAGER are notified, and the item is flagged service-critical on the reorder list
- Given a part is returned unused after a visit, When a return is recorded, Then a stock movement of type Return is written referencing the same job card and the balance is restored

---

### E4-S7: Service Report and Chargeable Billing Hand-off
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E4-S4, E8-S2

**Story:** As a SERVICE_MANAGER, I want a customer-facing report and a clean billing hand-off from every completed job, so that the customer has evidence and Accounts has everything needed to invoice.

**Acceptance Criteria:**
- Given a completed job card, When the service report preview is opened, Then an A4 document renders with letterhead, customer and site, machine particulars including serial, work performed, parts used, observations, recommendations, running hours, engineer name and customer acknowledgement, and exports to PDF
- Given coverage is Chargeable, When the job card is completed, Then a billing summary is produced itemising labour, parts, travel and applicable GST, ready for invoice creation
- Given the billing summary, When Create Invoice is invoked, Then a service invoice is pre-populated from the summary with no re-entry, and is linked bidirectionally to the job card and ticket
- Given coverage is Warranty or comprehensive AMC, When the job card is completed, Then no billable summary is generated and the report states the coverage basis explicitly
- Given a service report is generated, When it is downloaded or shared, Then the action is written to the audit log against the job card

---

### E4-S8: Field Engineer Day View
**Priority:** P0 | **Sprint:** 4 | **Points:** 5 | **Dependency:** E4-S3

**Story:** As a FIELD_ENGINEER, I want my day's visits on one screen with everything I need to get there and start work, so that I am not calling the office for details.

**Acceptance Criteria:**
- Given the field day view, When it loads, Then today's assigned visits render in suggested route order, each showing customer, site address, machine and serial, reported problem, severity and SLA state
- Given a visit card, When it renders, Then a tap-to-call control for the site contact and a map link for the address are present and functional on a mobile device
- Given a visit card, When it is tapped, Then the mobile job card for that visit opens directly at the first incomplete step
- Given a visit is completed, When the day view refreshes, Then the completed visit moves to a completed section with its outcome shown, and remaining visits recount
- Given no visits are assigned for today, When the day view renders, Then an explicit empty state is shown with the engineer's next scheduled visit date if one exists

---

## Epic E5: Installed Assets, Warranty & AMC Lifecycle

> **Business Objective:** Turn every machine sold into a tracked, serial-numbered asset with enforced OEM commissioning discipline and a managed maintenance contract, so that warranty is protected and recurring revenue stops leaking
> **Target Users:** SERVICE_MANAGER, FIELD_ENGINEER, BRANCH_MANAGER, DIRECTOR_STRATEGY, DIRECTOR_BUSINESS
> **Success Metrics:** 100% of machines carry a unique serial and derived coverage state | Commissioning submission compliance measurable and ≥ 98% achievable | All AMCs and warranties expiring within 90 days surfaced with an owner | AMC attach rate quantified
> **Scope Boundary:** In: installed asset register, asset passport, derived coverage, commissioning report with OEM submission countdown, commissioning register, AMC contracts with generated preventive-visit schedules, renewal radar, rental fleet register | Out: real OEM portal submission (simulated per INT-11), IoT running-hours telemetry, predictive failure modelling (Phase 3)
> **Risks / Assumptions:** Assumes OEM commissioning window per PD-006, defaulting to seven days; assumes warranty duration is configurable per product line. Model codes are referenced at series level pending catalogue confirmation (PRD SD-6)
> **Definition of Done:** All P0 stories complete, coverage state provably derived and never editable, commissioning countdown demonstrable, renewal radar surfaces all seeded expiries and the full out-of-coverage population

### E5-S1: Installed Asset Register
**Priority:** P0 | **Sprint:** 2 | **Points:** 8 | **Dependency:** E3-S1, E7-S1

**Story:** As a SERVICE_MANAGER, I want every machine we have supplied recorded as a serial-numbered asset at a specific site, so that service, warranty and contracts all attach to a real machine rather than to a customer name.

**Acceptance Criteria:**
- Given the asset form, When it is submitted, Then OEM principal, product line, model or series, capacity rating with unit, serial number, customer, site, location within site, sale invoice reference, installation date, commissioning date, warranty start and end, running hours with reading date and status are captured
- Given a serial number, When it is entered, Then uniqueness is enforced across the platform and a duplicate is rejected with a link to the existing asset
- Given the asset list, When it loads, Then it is searchable by serial, model, customer and site, and filterable by principal, product line, coverage state, status and branch
- Given an asset created from a sales order line, When it is generated, Then customer, site, item and invoice reference populate from the order with no re-entry
- Given the asset list, When it renders, Then serial numbers display in mono type and are never truncated
- Given an asset is decommissioned, When the status change is saved, Then a reason is required, open tickets against it are flagged, and the asset is excluded from coverage and renewal calculations while remaining fully visible in history

---

### E5-S2: Asset Passport
**Priority:** P0 | **Sprint:** 4 | **Points:** 5 | **Dependency:** E5-S1, E4-S4

**Story:** As a FIELD_ENGINEER, I want a machine's complete history on one screen before I start work, so that I am not diagnosing a fault that has already been diagnosed twice.

**Acceptance Criteria:**
- Given an asset, When the passport loads, Then identity and specification, coverage timeline, every ticket, every visit with outcome, every part consumed, the commissioning report, all service reports, related documents and a running-hours history chart are presented
- Given the coverage timeline, When it renders, Then warranty and AMC periods are shown as a visual band against a date axis, with any uncovered gaps visibly marked
- Given the ticket history, When it renders, Then repeat failures of the same root-cause category are grouped and counted, so a recurring fault is immediately apparent
- Given the parts history, When it renders, Then it shows each part, quantity, date and job card, with total spend on the machine to date where the user has commercial permission
- Given a mobile viewport, When the passport loads, Then it renders as a single column with collapsible sections and remains fully usable one-handed

---

### E5-S3: Derived Coverage State
**Priority:** P0 | **Sprint:** 3 | **Points:** 3 | **Dependency:** E5-S1

**Story:** As the SYSTEM, I must derive every asset's coverage state from dates and contracts rather than from a manual field, so that coverage can never be misstated by a data-entry error.

**Acceptance Criteria:**
- Given an asset, When coverage state is computed, Then it resolves to In Warranty, Under AMC or Out of Coverage by evaluating warranty end date and any live AMC contract against the current simulated date
- Given both a live warranty and a live AMC exist, When state is computed, Then In Warranty takes precedence and the AMC is shown as additionally in force
- Given any interface, When coverage state renders, Then it is read-only with no editable control anywhere in the platform
- Given warranty start, When it is set, Then it derives from commissioning date rather than invoice date, with warranty duration taken from the product-line configuration
- Given an asset whose warranty or AMC lapses as the simulated clock advances, When coverage is next evaluated, Then the state changes automatically and the transition is written to the audit log

---

### E5-S4: Commissioning Report with OEM Submission Countdown
**Priority:** P0 | **Sprint:** 4 | **Points:** 8 | **Dependency:** E5-S1, B5

**Story:** As a FIELD_ENGINEER, I want to complete a structured commissioning report with the OEM deadline visible on it, so that the customer's warranty is never invalidated by late paperwork.

**Acceptance Criteria:**
- Given a newly installed asset, When the commissioning report is opened, Then it captures installation particulars, site conditions, electrical supply particulars, accessories fitted, a commissioning checklist with pass or fail per item, initial running parameters, customer training acknowledgement, customer signature and dealer authorisation
- Given the commissioning date is entered, When it is saved, Then a countdown to the OEM submission deadline is computed from the configured window for that principal and is displayed prominently on the report, on the asset passport and in the commissioning register
- Given any checklist item is marked fail, When submission is attempted, Then a remark is mandatory for that item and the report is marked as commissioned with observations rather than clean
- Given the report is completed, When it is saved, Then warranty start is set to the commissioning date, warranty end is computed from the product-line duration, and the asset's coverage state recomputes
- Given the submission countdown reaches two days remaining, When notifications are evaluated, Then the SERVICE_MANAGER and BRANCH_MANAGER are notified; on expiry the DIRECTOR_BUSINESS is notified and an exception is raised
- Given the completed report, When the print preview is opened, Then an A4 document renders suitable for OEM submission and exports to PDF

---

### E5-S5: Commissioning Register
**Priority:** P0 | **Sprint:** 4 | **Points:** 5 | **Dependency:** E5-S4

**Story:** As a SERVICE_MANAGER, I want a register of every commissioning and its submission state, so that our OEM channel obligations are provably under control.

**Acceptance Criteria:**
- Given the register, When it loads, Then every commissioning is listed with asset, serial, customer, commissioning date, submission deadline, submission state, submission date, acknowledgement reference and warranty consequence
- Given submission state, When it is computed, Then it resolves to Not submitted, Submitted within window, Submitted late or Overdue, based on submission date against deadline
- Given an overdue commissioning, When the register renders, Then it appears at the top with an escalation treatment and is present in the command centre exception feed
- Given a commissioning, When Submit to OEM is invoked, Then a simulated submission produces an acknowledgement reference and timestamp, marked with a "Simulated" chip linking to the integration readiness screen
- Given the register, When compliance is computed, Then the submission-compliance percentage for the period is displayed and reconciles to the listed records

---

### E5-S6: AMC Contracts and Generated Visit Schedules
**Priority:** P0 | **Sprint:** 4 | **Points:** 8 | **Dependency:** E5-S1

**Story:** As a SERVICE_MANAGER, I want maintenance contracts recorded with their promised visits generated as work, so that we deliver what we sold and can prove it.

**Acceptance Criteria:**
- Given the AMC form, When it is submitted, Then contract number, customer, covered assets, coverage type, start and end dates, contract value, billing schedule, committed preventive visits per year, response and restoration commitments, inclusions and exclusions are captured
- Given a contract is activated, When activation completes, Then the schedule of preventive-maintenance visits is generated across the contract period at even intervals, each with a due date
- Given a scheduled visit's due date approaches within seven days, When the dispatch board renders, Then the visit appears as forward-planned work and can be converted to a ticket in one action
- Given completed visits against committed visits, When the contract is viewed, Then fulfilment is displayed as a count and percentage, and a contract behind schedule is flagged
- Given a contract covering multiple assets, When it is saved, Then each covered asset's coverage state recomputes to Under AMC for the contract period
- Given contract status, When it is evaluated, Then it derives from dates as Draft, Active, Expiring within 60 days, Expired, Renewed or Terminated, and is never manually set except for Terminated which requires a reason

---

### E5-S7: Renewal Radar
**Priority:** P0 | **Sprint:** 4 | **Points:** 8 | **Dependency:** E5-S6, E5-S3

**Story:** As a SERVICE_MANAGER, I want every expiring contract and warranty and every uncovered machine in one prioritised view, so that recurring revenue becomes a pipeline instead of a leak.

**Acceptance Criteria:**
- Given the renewal radar, When it loads, Then all AMC contracts and asset warranties expiring within 30, 60 and 90 days are listed with customer, covered assets, expiring value, days remaining, coverage history showing visits used against committed, assigned owner, renewal status and last action taken
- Given the radar, When an out-of-coverage tab is opened, Then every asset with neither live warranty nor live AMC is listed with customer, machine, months since last service and estimated AMC value, together with the overall AMC attach-rate percentage
- Given an expiring contract, When Initiate Renewal is invoked, Then a quotation is created pre-populated from the expiring contract's assets, scope and value, linked to the source contract
- Given an asset whose warranty expires within 90 days, When the radar renders, Then it appears as an AMC conversion opportunity with its service history summarised to support the sales conversation
- Given a contract expires without renewal, When the state changes, Then it moves to a lapsed section retained for the trailing twelve months, an exception is raised, and the lapsed value contributes to a visible leakage figure
- Given a BRANCH_MANAGER session, When the radar loads, Then only that branch's customers are shown

---

### E5-S8: Rental Fleet Register
**Priority:** P2 | **Sprint:** 5 | **Points:** 3 | **Dependency:** E5-S1, PD-009

**Story:** As a SERVICE_MANAGER, I want rental machines and agreements tracked, so that assets on rent are never lost sight of and utilisation is known.

**Acceptance Criteria:**
- Given a rental asset, When it is registered, Then serial, specification, condition and current status are captured, and the asset's status shows On Rent while a live agreement exists
- Given a rental agreement, When it is created, Then customer, site, period, rate basis, deposit and expected return date are captured
- Given the expected return date passes without a recorded return, When the fleet screen renders, Then the asset is flagged overdue and a notification is dispatched
- Given a period, When utilisation is computed, Then days on rent against days available is displayed per asset and in aggregate
- Given a return is recorded, When it is saved, Then return date, condition on return and any damage note are captured, and the asset returns to available status

---

## Epic E6: Projects & EPC Execution

> **Business Objective:** Make turnkey water and environment projects billable on time and fully recoverable, by tracking BOQ execution, site progress, running-account billing and retention through to release
> **Target Users:** PROJECT_MANAGER, DIRECTOR_BUSINESS, ACCOUNTS_EXECUTIVE, AUDITOR
> **Success Metrics:** Every rupee of executed BOQ traceable to a dated progress entry | RA-bills generated from cumulative quantities with zero double-claiming | 100% of retention withheld recorded and tracked to eligibility
> **Scope Boundary:** In: project record, BOQ with cumulative execution, immutable DPRs, milestones and S-curve, schedule variance, RA-bill builder with deductions, retention register, project workspace and document register | Out: critical-path scheduling engine, resource-levelling, subcontractor portal, tender/e-procurement integration (BRD X-09)
> **Risks / Assumptions:** Assumes retention and defect-liability defaults per PD-008; assumes measurement practice can be validated against a real redacted RA-bill (B3)
> **Definition of Done:** All P0 stories complete, BOQ → DPR → RA-bill → retention chain walkable end to end, retention register total reconciles to the sum of retention entries, at-risk project visible on the portfolio and command centre

### E6-S1: Project Record and Portfolio View
**Priority:** P0 | **Sprint:** 4 | **Points:** 5 | **Dependency:** B7

**Story:** As a PROJECT_MANAGER, I want each project recorded with its full contractual terms and all projects visible in one portfolio, so that commercial obligations are explicit and portfolio risk is visible.

**Acceptance Criteria:**
- Given the project form, When it is submitted, Then project code, name, client, client type, site location, scope summary, contract type, work order reference and date, contract value, start date, contractual completion date, revised completion date, defect-liability period, retention percentage, price-variation clause presence, liquidated-damages terms, project manager and status are captured
- Given the portfolio, When it loads, Then all projects list with client, contract value, physical progress, financial progress, schedule variance, retention outstanding and status, with At Risk projects sorted first
- Given a project status, When it is set, Then it resolves within Tendered, Awarded, Mobilised, In progress, Commissioning, Completed, Defect-liability period, Closed or On hold
- Given a PROJECT_MANAGER session, When the portfolio loads, Then only projects where that user is the assigned manager are returned, while DIRECTOR_BUSINESS sees all
- Given a project entering the defect-liability period, When status changes, Then the defect-liability expiry date is computed and becomes the basis for retention release eligibility

---

### E6-S2: BOQ Sheet with Cumulative Execution
**Priority:** P0 | **Sprint:** 4 | **Points:** 8 | **Dependency:** E6-S1, B3

**Story:** As a PROJECT_MANAGER, I want the bill of quantities held as live data with executed quantities accumulating against it, so that what we have earned is always calculable.

**Acceptance Criteria:**
- Given a BOQ, When it is entered or imported, Then each line holds item code, description, unit, contracted quantity, rate and amount, and lines may be grouped into sections with subtotals
- Given a BOQ line with a cumulative executed quantity, When the sheet renders, Then executed value, balance quantity and balance value are computed per line and totalled, and the totals reconcile to the contract value plus recorded variations
- Given a user attempts to edit cumulative executed quantity directly, When the edit is submitted, Then it is rejected with a message directing the user to record a dated progress entry instead
- Given an executed quantity that would exceed the contracted quantity, When it is entered through a progress entry, Then the platform blocks the excess and requires a recorded variation with reference and approved value
- Given the BOQ sheet, When it renders, Then a progress bar per section and for the project shows executed value against contracted value

---

### E6-S3: Daily Progress Report
**Priority:** P0 | **Sprint:** 4 | **Points:** 5 | **Dependency:** E6-S2

**Story:** As a PROJECT_MANAGER, I want site progress captured daily in a structured, unalterable record, so that execution is evidenced and delays have a documented cause.

**Acceptance Criteria:**
- Given the DPR form, When it is submitted, Then date, weather, manpower deployed by trade with counts, plant and machinery deployed, work executed against specific BOQ lines with quantities, materials received, site instructions received, hindrances with cause category, safety observations and photographs are captured
- Given a DPR recording executed quantities, When it is submitted, Then those quantities increment the cumulative executed quantity on the referenced BOQ lines
- Given a submitted DPR, When any edit is attempted, Then the record is immutable and a superseding entry with a stated reason must be created, with both entries retained and visibly linked
- Given a live project with no DPR filed for two consecutive working days, When notifications are evaluated, Then the PROJECT_MANAGER is notified, escalating to DIRECTOR_BUSINESS after five days
- Given the DPR log, When it renders, Then entries list newest first with manpower totals and hindrance flags visible without opening each record

---

### E6-S4: Milestones, S-Curve and Schedule Variance
**Priority:** P0 | **Sprint:** 4 | **Points:** 5 | **Dependency:** E6-S3

**Story:** As a PROJECT_MANAGER, I want planned progress compared with actual progress on a curve, so that slippage is visible while it can still be recovered.

**Acceptance Criteria:**
- Given a project, When milestones are defined, Then each holds name, planned date, actual date, weightage and status, and total weightage across milestones equals 100
- Given planned and actual progress, When the S-curve renders, Then cumulative planned and cumulative actual progress are plotted against a date axis with today marked
- Given cumulative actual and planned progress, When schedule variance is computed, Then it is expressed as a percentage difference, and a project exceeding the configured tolerance is flagged At Risk
- Given a project flagged At Risk, When the exception feed is evaluated, Then the project appears there with the variance magnitude and the responsible manager
- Given the S-curve, When a chart is unavailable to a user relying on assistive technology, Then an equivalent data table of the same series is available through a visible control

---

### E6-S5: RA-Bill Builder with Deductions
**Priority:** P0 | **Sprint:** 5 | **Points:** 13 | **Dependency:** E6-S2, B3, B7

**Story:** As a PROJECT_MANAGER, I want running-account bills built from cumulative executed quantities with all deductions applied, so that claims are accurate, timely and impossible to double-count.

**Acceptance Criteria:**
- Given a project with executed BOQ quantities, When a new RA-bill is generated, Then it presents cumulative value to date, the previous bill's cumulative value, the current-period value as the difference, mobilisation-advance recovery, retention deduction, statutory deductions including TDS and labour cess where applicable, other deductions and net payable
- Given RA-bills for a project, When a new bill is created, Then it is sequentially numbered and creation is blocked while a prior bill remains in Draft
- Given a bill in Draft, When submission occurs, Then the state advances to Submitted and the cumulative quantities are frozen on that bill so that later execution does not retrospectively alter a submitted claim
- Given a submitted bill, When the client certifies a value different from the claimed value, Then the certified value is recorded alongside the claimed value and the variance is displayed as both an amount and a percentage
- Given a bill certified, When it is saved, Then retention is computed at the project's retention percentage on the certified value and posted to the retention register, and an invoice may be generated from the certified value
- Given a bill in Submitted state for longer than the configured threshold, When exceptions are evaluated, Then it appears in the exception feed with days elapsed
- Given the RA-bill, When the print preview is opened, Then an A4 document renders in running-account format with cumulative, previous and current columns, deductions schedule and net payable, and exports to PDF

---

### E6-S6: Retention Register
**Priority:** P0 | **Sprint:** 5 | **Points:** 8 | **Dependency:** E6-S5

**Story:** As a DIRECTOR_BUSINESS, I want every rupee of retention withheld visible in one register with its release eligibility, so that money we have already earned is not quietly forfeited.

**Acceptance Criteria:**
- Given the register, When it loads, Then it aggregates across all projects: retention withheld, retention released, retention outstanding, defect-liability expiry per project, and release eligibility state
- Given a retention entry, When eligibility is computed, Then the state resolves to Not eligible, Eligible, Claim raised or Released based on defect-liability expiry against the current simulated date
- Given retention becoming eligible, When the exception feed is evaluated, Then an exception is raised naming the project, the amount and the number of days since eligibility
- Given the register, When it renders, Then it is sortable by outstanding value and by eligibility date, and the total outstanding reconciles exactly to the sum of individual retention entries
- Given a retention release is recorded, When it is saved, Then the released amount, date and reference are captured, outstanding reduces accordingly, and the change is audit-logged
- Given the locked-cash panel on the command centre, When it renders, Then its retention component equals this register's outstanding total

---

### E6-S7: Project Workspace and Document Register
**Priority:** P1 | **Sprint:** 6 | **Points:** 5 | **Dependency:** E6-S1, E10-S1

**Story:** As a PROJECT_MANAGER, I want everything about a project in one workspace, so that drawings, approvals, certificates and measurement records are found in seconds rather than searched for.

**Acceptance Criteria:**
- Given a project, When the workspace loads, Then tabs present BOQ, DPR log, milestones, RA-bills, retention, documents and team
- Given the document register, When it renders, Then documents are classified as drawings with revision, client approvals, test and commissioning certificates, or measurement books, each with revision number and approval state
- Given a drawing with multiple revisions, When it is opened, Then the current revision is shown with prior revisions accessible and clearly marked superseded
- Given a document with an expiry date within 60 days, When notifications are evaluated, Then the project manager is notified and the document appears in the expiring-documents list
- Given a user without permission for a project, When project documents are requested, Then access is denied and the denial is audit-logged

---

## Epic E7: Inventory, Spares & Warehouse

> **Business Objective:** Make stock a reliable, auditable ledger so that first-time-fix improves, second visits reduce, and capital held in non-moving stock can be released
> **Target Users:** STORE_INCHARGE, SERVICE_MANAGER, FIELD_ENGINEER, ACCOUNTS_EXECUTIVE (read), AUDITOR
> **Success Metrics:** Every stock movement traceable to a source document | Reorder list prioritised by service impact, not guesswork | Stock balances always equal the sum of ledger movements
> **Scope Boundary:** In: unified item master, per-location stock balances, append-only movement ledger, issue against job card and project, goods receipt against PO, reorder list with service-critical prioritisation, non-moving stock report | Out: barcode/RFID hardware, warehouse bin-location optimisation, batch/serial traceability beyond machine serials, landed-cost computation
> **Risks / Assumptions:** Assumes item categories and reorder policy can be seeded credibly; assumes a single item master is acceptable across sales, service and projects
> **Definition of Done:** All P0 stories complete, stock ledger provably append-only, job-card issue decrements balances in E2E test, service-critical flag demonstrably linked to a job card awaiting parts

### E7-S1: Unified Item Master
**Priority:** P0 | **Sprint:** 2 | **Points:** 5

**Story:** As a STORE_INCHARGE, I want one item master serving every part of the business, so that a part has the same code, description and tax treatment wherever it is used.

**Acceptance Criteria:**
- Given the item form, When it is submitted, Then item code, description, category, OEM principal, OEM part number, unit of measure, HSN/SAC, GST rate, standard purchase cost, standard selling price, reorder level, reorder quantity, lead-time days, storage location and status are captured
- Given an item is created, When it is saved, Then it is immediately available to quotations, sales orders, job cards, project BOQs and purchase orders without any separate master being maintained
- Given a duplicate item code or OEM part number, When creation is attempted, Then it is blocked with a link to the existing item
- Given the item list, When search is used, Then item code, description and OEM part number are all searchable, and filters for category, principal and status combine
- Given an item referenced by existing transactions, When deletion is attempted, Then it is blocked with the reference count and deactivation is offered instead

---

### E7-S2: Stock Balances and Append-Only Movement Ledger
**Priority:** P0 | **Sprint:** 3 | **Points:** 8 | **Dependency:** E7-S1

**Story:** As the SYSTEM, I must hold stock as the sum of an append-only movement ledger per location, so that a balance can never be altered without a traceable reason.

**Acceptance Criteria:**
- Given any stock movement, When it is written, Then it records type from Receipt, Issue, Return, Transfer, Adjustment or Scrap, quantity, from-location, to-location, source document reference, actor and timestamp
- Given the stock list, When a balance is displayed, Then it equals the sum of ledger movements for that item and location, and no interface offers direct editing of a balance
- Given a location, When balances render, Then quantity on hand, quantity reserved and quantity available are shown as distinct figures
- Given a movement is written, When the ledger is examined, Then no edit or delete path exists; a correction is a new compensating movement with a stated reason
- Given an item's ledger, When it is opened, Then every movement lists with its source document as a working link, so any balance can be reconstructed
- Given locations, When they are defined, Then central warehouse, each branch, engineer boot stock and project sites are all supported as stock-holding locations

---

### E7-S3: Issue Against Job Card and Project
**Priority:** P0 | **Sprint:** 4 | **Points:** 5 | **Dependency:** E7-S2, E4-S6

**Story:** As a STORE_INCHARGE, I want to issue parts against a job card or a project in one action, so that issuing is fast and every part leaves the warehouse with a reason attached.

**Acceptance Criteria:**
- Given pending parts requests, When the issue screen loads, Then requests are listed with job card or project reference, requesting engineer, items, quantities requested and availability, prioritised with service-critical requests first
- Given a parts request, When Issue is invoked, Then requested items are issued in one action, stock movements are written referencing the job card or the project and BOQ line, and balances decrement
- Given a requested quantity exceeding available quantity, When issue is attempted, Then partial issue is offered with the shortfall recorded and the item flagged service-critical on the reorder list
- Given an issue is completed, When it is saved, Then the requesting engineer is notified and the job card reflects the issued parts
- Given a STORE_INCHARGE assigned to specific locations, When the issue screen loads, Then only requests against those locations are shown

---

### E7-S4: Goods Receipt and Purchase Orders
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E7-S2

**Story:** As a STORE_INCHARGE, I want purchase orders and receipts recorded against them, so that inbound stock is verified and short or excess supply is caught at the door.

**Acceptance Criteria:**
- Given a purchase order, When it is created, Then supplier, items with quantity and rate, expected delivery date, terms and status are captured, and orders above the configured threshold require approval before they may be marked Sent
- Given a goods receipt against a purchase order, When it is recorded, Then received quantity per line is captured, a Receipt stock movement is written referencing the PO, and balances increase
- Given a received quantity less than ordered, When the receipt is saved, Then the PO remains Partially received with the balance visible; a quantity greater than ordered is flagged and requires an acknowledged override
- Given a supplier, When it is created, Then name, GSTIN, contact, payment terms and supplied item categories are captured
- Given a purchase order, When its status changes, Then the transition is audit-logged with actor and timestamp

---

### E7-S5: Reorder List with Service-Critical Prioritisation
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E7-S2, E4-S6

**Story:** As a STORE_INCHARGE, I want a reorder list that knows which shortages actually stopped a repair, so that purchasing is driven by service impact rather than by a static minimum level.

**Acceptance Criteria:**
- Given the reorder list, When it loads, Then every item at or below reorder level is listed with on-hand quantity, reorder level, suggested reorder quantity, lead-time days, last purchase rate and preferred supplier
- Given items on the list, When ordering is computed, Then a movement-velocity score derived from issue frequency over the trailing period determines default sort order
- Given an item that caused a job card to move to Awaiting Parts, When the list renders, Then the item is flagged service-critical with the referencing job card linked, and is sorted above items ranked only by velocity
- Given a service-critical shortage, When notifications are evaluated, Then the STORE_INCHARGE and SERVICE_MANAGER are notified immediately, while routine shortages are batched into a daily digest
- Given selected items on the list, When Create Purchase Order is invoked, Then a draft PO is generated pre-populated with the selected items and suggested quantities grouped by preferred supplier

---

### E7-S6: Non-Moving Stock Report
**Priority:** P1 | **Sprint:** 5 | **Points:** 3 | **Dependency:** E7-S2

**Story:** As a DIRECTOR_BUSINESS, I want to see stock that has not moved, so that capital tied up on the shelf can be released or written down deliberately.

**Acceptance Criteria:**
- Given the report, When it loads, Then every item with zero issues over the configurable trailing period, defaulting to 180 days, is listed with quantity, value, last movement date and location
- Given the report, When it renders, Then total non-moving value is stated and shown as a proportion of total stock value
- Given the trailing-period setting, When it is changed, Then the list and totals recompute immediately
- Given an item on the report, When it is opened, Then its full movement ledger is shown so the last activity can be examined

---

## Epic E8: Commercial — GST Documents & Receivables

> **Business Objective:** Produce statutorily authentic commercial documents and make cash owed to the business visible and pursued, without displacing the accounting ledger as the book of record
> **Target Users:** ACCOUNTS_EXECUTIVE, DIRECTOR_BUSINESS, BRANCH_MANAGER, STORE_INCHARGE, AUDITOR
> **Success Metrics:** Every invoice carries correct tax treatment derived from place of supply | Receivables ageing reconciles to invoices less receipts | Stale-base-document e-way bill attempts blocked in 100% of cases
> **Scope Boundary:** In: delivery challan with statutory triplicate, tax invoice with derived GST treatment, simulated IRN and QR, e-invoice reporting-window tracking, e-way bill with stale-document block, credit and debit notes, receipts with allocation, receivables ageing and follow-up log, ledger hand-off export, numbering series | Out: live GST portal and e-way bill integration (BRD X-02), GST return preparation and filing, statutory accounting ledger, bank reconciliation
> **Risks / Assumptions:** BRD R-09 — the accounting team must not perceive this as replacing the ledger; the hand-off screen states the boundary explicitly. Assumes turnover band confirms the applicable e-invoice reporting window
> **Definition of Done:** All P0 stories complete, all document PDFs statutorily structured and validated against redacted samples (B3), ageing reconciles exactly, e-way bill block demonstrable

### E8-S1: Delivery Challan
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** B3

**Story:** As an ACCOUNTS_EXECUTIVE, I want delivery challans as their own statutory document, so that goods movement is compliant and not improvised from an invoice.

**Acceptance Criteria:**
- Given the challan form, When it is submitted, Then challan number and date, consignor and consignee with GSTINs, transport mode, vehicle number, transporter, LR number, item particulars with quantity and taxable value, and reason for transportation are captured
- Given a challan is raised, When the source is selected, Then it may reference a sales order, a project supply, a rental despatch or a service part despatch, and the reference appears on the document
- Given the challan print preview, When it is opened, Then three copies render carrying the statutory designations Original for consignee, Duplicate for transporter and Triplicate for consigner, and export to PDF
- Given a challan for a consignment above the configured e-way bill threshold, When it is saved, Then an indicator states that an e-way bill is required and offers generation
- Given a challan is created, When it is saved, Then the numbering series for challans is consumed without gaps and the creation is audit-logged

---

### E8-S2: Tax Invoice with Derived GST Treatment
**Priority:** P0 | **Sprint:** 5 | **Points:** 8 | **Dependency:** E7-S1, B3

**Story:** As an ACCOUNTS_EXECUTIVE, I want invoices whose tax treatment is derived rather than typed, so that the paperwork is right the first time and defensible on inspection.

**Acceptance Criteria:**
- Given an invoice, When it is created, Then invoice number and date, place of supply, customer with GSTIN, line items with HSN/SAC, quantity, rate, discount, taxable value, tax, rounding, amount in words, bank particulars and authorised signatory block are captured or computed
- Given the place of supply and the state of supply, When tax is computed, Then an intra-state supply splits into CGST and SGST and an inter-state supply applies IGST, and the derivation is displayed to the user with both states named
- Given the invoice type, When it is selected, Then equipment sale, spares sale, chargeable service, AMC billing, rental billing and project RA-bill invoice are all supported, each pulling its source document reference
- Given an invoice generated from a service billing summary, RA-bill or AMC schedule, When it is created, Then all lines and values populate from the source with no re-entry and the link is bidirectional
- Given an invoice is issued, When it is saved, Then it becomes immutable except through a credit or debit note, and any subsequent adjustment is recorded as such
- Given the invoice print preview, When it is opened, Then an A4 tax invoice renders with all statutory particulars in conventional positions and exports to PDF

---

### E8-S3: Simulated IRN, QR and Reporting-Window Tracking
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E8-S2

**Story:** As an ACCOUNTS_EXECUTIVE, I want e-invoice particulars present on the invoice and the reporting window tracked, so that the compliance mechanism is visible and no window closes unnoticed.

**Acceptance Criteria:**
- Given an invoice is issued, When it is saved, Then a deterministic simulated IRN, acknowledgement number and acknowledgement date are generated and a QR code is rendered in the statutory position on the document
- Given any simulated e-invoice element, When it renders, Then a "Simulated" chip is visibly present with a tooltip stating what the live IRP integration requires, linking to the integration readiness screen
- Given the applicable reporting window configured in masters, When an issued invoice has not been reported within that window, Then it is flagged with days remaining, and on expiry it appears in the exception feed
- Given the reporting window setting, When it is changed in masters, Then all open invoices recompute their window status without requiring reissue
- Given an invoice for an unregistered customer or a transaction type outside e-invoicing scope, When it is issued, Then no IRN is generated and the invoice states that e-invoicing does not apply, with the reason

---

### E8-S4: E-Way Bill with Stale-Base-Document Block
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E8-S1

**Story:** As an ACCOUNTS_EXECUTIVE, I want e-way bill generation available and correctly restricted, so that movement documentation is complete and statutory limits are respected by the system rather than by memory.

**Acceptance Criteria:**
- Given a consignment above the configured threshold defaulting to ₹50,000, When e-way bill generation is opened, Then supply type, sub-type, base document reference, transport mode, approximate distance, transporter and vehicle number are captured
- Given valid inputs, When generation is submitted, Then a simulated e-way bill number and validity period are returned and displayed with a "Simulated" chip
- Given a base document whose date exceeds the configured maximum age, defaulting to 180 days, When generation is attempted, Then generation is blocked and the message states the base document date, its age, the configured limit, and what would make the action possible
- Given a consignment below the threshold, When the challan or invoice is viewed, Then the e-way bill control states that a bill is not required, with the threshold named
- Given a generated e-way bill, When its validity period passes, Then it is marked Expired and a new bill may be generated against the same base document subject to the age rule

---

### E8-S5: Receipts and Allocation
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E8-S2

**Story:** As an ACCOUNTS_EXECUTIVE, I want money received allocated against specific invoices, so that outstanding balances are accurate at invoice level and not merely at customer level.

**Acceptance Criteria:**
- Given a receipt, When it is recorded, Then amount, date, payment mode, reference and customer are captured
- Given a receipt, When allocation is performed, Then it may be allocated in whole or in part across one or more invoices, allocations may not exceed the receipt amount or an invoice's outstanding, and any unallocated balance remains visible as unallocated
- Given an allocation is saved, When invoice outstanding is recomputed, Then it equals invoice total less allocated receipts less credit notes, and the ageing bucket updates accordingly
- Given a receipt against an invoice with a recorded payment promise, When allocation completes, Then the promise is marked fulfilled and removed from the broken-promise exception list
- Given a simulated UPI collection link is generated for an invoice, When its mock state is advanced from Demo Controls to Paid, Then a receipt is created against that invoice, clearly marked as simulated

---

### E8-S6: Receivables Ageing and Collection Follow-Up
**Priority:** P0 | **Sprint:** 5 | **Points:** 8 | **Dependency:** E8-S5

**Story:** As a DIRECTOR_BUSINESS, I want receivables aged, segmented and actively followed up, so that cash owed to us is pursued systematically rather than remembered occasionally.

**Acceptance Criteria:**
- Given the receivables screen, When it loads, Then outstanding is presented in buckets 0–30, 31–60, 61–90 and 90+ days with count and value per bucket, and the buckets sum exactly to total outstanding
- Given the screen, When it renders, Then institutional and government exposure is segmented from private exposure with both value and share, and filters for branch, customer type and account executive combine
- Given any bucket or segment, When it is clicked, Then the contributing invoices are listed with customer, invoice number, date, days outstanding, amount and owner, and their sum equals the clicked figure
- Given an invoice, When a follow-up is recorded, Then date, mode, person spoken to, outcome, promised payment date and promised amount are captured and appear in a chronological follow-up log on the invoice
- Given a promised payment date that passes without an allocated receipt, When exceptions are evaluated, Then the invoice appears in the exception feed as a broken promise with the promised amount and days elapsed
- Given an invoice crossing 60 and then 90 days, When notifications are evaluated, Then Accounts and the BRANCH_MANAGER are notified, escalating to DIRECTOR_BUSINESS at 90 days

---

### E8-S7: Ledger Hand-off and Document Numbering
**Priority:** P1 | **Sprint:** 6 | **Points:** 3 | **Dependency:** E8-S2, E1-S7

**Story:** As an ACCOUNTS_EXECUTIVE, I want a clean period export for the accounting package and controlled document numbering, so that the platform strengthens the ledger rather than competing with it.

**Acceptance Criteria:**
- Given the hand-off screen, When a period is selected, Then invoices, receipts, challans and credit notes for that period are presented in a structured export with a document count and value summary
- Given the hand-off screen, When it renders, Then a clear statement confirms that the accounting package remains the statutory book of record and that this export is a hand-off, not a replacement
- Given the export is generated, When it completes, Then a simulated sync progression displays per-document success and failure counts with a reconciliation summary, marked "Simulated"
- Given numbering series configured in masters, When any document is issued, Then the series is consumed sequentially per document type and financial year with no gaps or duplicates, and the series state is visible to Accounts
- Given an export is generated, When it completes, Then the action is audit-logged with period, document counts and actor

---

## Epic E9: HR, Attendance & Workforce

> **Business Objective:** Establish verifiable attendance including field staff and complete statutory employee records, producing a clean payroll input without taking on payroll computation
> **Target Users:** HR_ADMIN, FIELD_ENGINEER, SERVICE_MANAGER, BRANCH_MANAGER, PROJECT_MANAGER, AUDITOR
> **Success Metrics:** Field attendance verifiable by location and linked to a job card | Appointment letter present for 100% of employees | Monthly payroll input produced in under an hour
> **Scope Boundary:** In: employee register with statutory documents, office and field attendance with geolocation, attendance board with exceptions and regularisation, leave with approval and coverage warning, monthly payroll-input summary, technician utilisation | Out: statutory payroll computation, EPF/ESIC/PT returns, Form 16, payslips (all BRD X-03), performance appraisal, recruitment, real biometric hardware (BRD X-02)
> **Risks / Assumptions:** Labour Code central rules are still settling (BRD CN-001), so statutory fields are configuration-driven; all seeded employee data is fictional (BRD CN-004)
> **Definition of Done:** All P0 stories complete, field check-in demonstrably linked to a job card, payroll-input export produced with the out-of-scope statement visible, regularisation audit-logged with original record retained

### E9-S1: Employee Register and Statutory Documents
**Priority:** P0 | **Sprint:** 2 | **Points:** 5

**Story:** As an HR_ADMIN, I want complete employee records with statutory documents attached, so that the organisation can evidence compliance without searching physical files.

**Acceptance Criteria:**
- Given the employee form, When it is submitted, Then employee code, name, designation, department, branch, reporting manager, date of joining, employment type, work location type, contact details, emergency contact, masked statutory identifiers and status are captured
- Given an employee record, When the documents tab renders, Then appointment letter is presented as a required document with a visible present-or-missing state, alongside offer letter, identity proof reference, qualification and OEM training certificates
- Given a field engineer record, When it is saved, Then OEM certification tags may be applied, and those tags drive skill-based assignment on the dispatch board
- Given a statutory document with an expiry date, When expiry falls within 60 or 30 days, Then the document owner and HR are notified
- Given a user without HR permission, When employee personal data or documents are requested, Then access is denied, the denial is audit-logged, and the records are excluded from that user's global search results
- Given the statutory document dashboard, When it loads, Then completeness per employee is shown so gaps are visible at a glance

---

### E9-S2: Attendance Capture Including Field Geolocation
**Priority:** P0 | **Sprint:** 3 | **Points:** 8 | **Dependency:** E9-S1

**Story:** As a FIELD_ENGINEER, I want to mark my attendance from wherever I am working, so that my day is recorded accurately without a trip to the office.

**Acceptance Criteria:**
- Given an office-based employee, When check-in or check-out is performed, Then timestamp and device indication are recorded
- Given a field engineer, When check-in is performed, Then timestamp, geolocation coordinates, a reverse-geocoded place label and a simulated selfie step are captured
- Given a field check-in performed at a customer site with an assigned job card, When it is saved, Then the attendance record is associated with that job card, creating a verifiable link between attendance and work performed
- Given a field check-in outside the configured geofence for the expected site, When it is saved, Then it is accepted but flagged as an exception with the distance from the expected location
- Given a simulated biometric device batch triggered from Demo Controls, When it is injected, Then device-sourced attendance records appear alongside app-sourced records, each labelled by source and marked "Simulated"
- Given a check-in without a corresponding check-out by end of day, When the day closes, Then the record is flagged as a missing check-out exception

---

### E9-S3: Attendance Board and Regularisation
**Priority:** P0 | **Sprint:** 3 | **Points:** 5 | **Dependency:** E9-S2

**Story:** As an HR_ADMIN, I want one board showing everybody's state for a chosen date with exceptions separated, so that daily attendance confirmation takes minutes.

**Acceptance Criteria:**
- Given a selected date, When the board loads, Then every employee's state renders as Present, Absent, On leave, On field, Half day, Week off or Holiday, grouped by branch and department with counts per state
- Given the board, When it renders, Then exceptions — late marks, missing check-outs and field check-ins outside geofence — are presented in a separate section rather than buried in the list
- Given an attendance record requiring correction, When HR regularises it, Then a reason is mandatory, the original record is retained and remains visible, and the regularisation is audit-logged with actor and timestamp
- Given a branch holiday calendar, When the board renders for a holiday date, Then employees of that branch show Holiday while other branches render normally
- Given a BRANCH_MANAGER session, When the board loads, Then only that branch's employees are shown

---

### E9-S4: Leave Requests, Approval and Coverage Warning
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E9-S1, E11-S1

**Story:** As an HR_ADMIN, I want leave requested and approved in the platform with coverage risk flagged, so that absence is recorded properly and service coverage is never accidentally compromised.

**Acceptance Criteria:**
- Given configured leave types with entitlement and accrual, When an employee views their leave, Then balance per type is displayed with accrued, taken and available figures
- Given a leave request, When it is submitted, Then type, dates, reason and coverage arrangement are captured and the request routes to the reporting manager through the approval engine
- Given a leave request that would reduce a branch's available field engineers below the configured minimum, When it is submitted, Then a warning is displayed to both requester and approver naming the coverage shortfall, and approval requires acknowledgement of the warning
- Given the team leave calendar, When it renders, Then approved and pending leave are shown by branch and department with pending visually distinguished from approved
- Given a leave decision, When it is recorded, Then the balance updates, the attendance board reflects On leave for those dates, and the decision is audit-logged

---

### E9-S5: Monthly Payroll-Input Summary
**Priority:** P0 | **Sprint:** 5 | **Points:** 3 | **Dependency:** E9-S3, E9-S4

**Story:** As an HR_ADMIN, I want a monthly attendance summary I can hand to payroll, so that month-end takes an hour instead of three days — without this platform pretending to run payroll.

**Acceptance Criteria:**
- Given a selected month, When the summary is generated, Then it presents per employee: days present, days absent, leave taken by type, week-offs, holidays, late marks and field days
- Given the summary screen, When it renders, Then an explicit statement confirms that payroll computation, statutory deductions and payslips are outside the platform's scope
- Given the summary, When export is invoked, Then a structured file suitable as a payroll input is produced and the export is audit-logged
- Given unregularised attendance exceptions in the selected month, When the summary is generated, Then a warning lists the outstanding exceptions and offers to open them before export
- Given the summary is regenerated after a regularisation, When it renders, Then the corrected figures are reflected and the prior export remains recorded in the audit log

---

### E9-S6: Technician Utilisation
**Priority:** P1 | **Sprint:** 6 | **Points:** 3 | **Dependency:** E9-S2, E4-S4

**Story:** As a SERVICE_MANAGER, I want each engineer's productive time visible, so that workload can be balanced with evidence rather than impression.

**Acceptance Criteria:**
- Given field attendance and job-card durations, When utilisation is computed, Then productive field hours against available hours is expressed as a percentage per engineer and per branch
- Given the utilisation view, When it renders, Then the formula and the definition of productive hours are stated on screen
- Given an engineer with utilisation outside the configured band, When the view renders, Then the deviation is flagged with direction, and clicking it opens that engineer's contributing job cards
- Given a period with incomplete data for an engineer, When utilisation is displayed, Then the figure is shown with an explicit data-completeness caveat rather than presented as reliable

---

## Epic E10: Document Vault & AI Document Intelligence

> **Business Objective:** Convert institutional memory held in drives, inboxes and physical files into a permissioned, searchable asset that answers questions with provenance rather than requiring someone to remember where a file lives
> **Target Users:** All roles as consumers; PROJECT_MANAGER, SERVICE_MANAGER and HR_ADMIN as principal contributors
> **Success Metrics:** Any document located in under 30 seconds | ≥ 90% first-attempt retrieval success on the seeded corpus | 100% of AI assertions carry a working citation | Insufficiency stated rather than guessed
> **Scope Boundary:** In: hierarchical permissioned vault, versioning, metadata and expiry awareness, full-text and metadata search independent of AI, natural-language question answering with inline citations, confidence states, explicit insufficiency behaviour, answer feedback capture | Out: optical character recognition of scanned documents, automatic document classification at scale, external document-management system integration, e-signature workflows beyond the simulated eSign path (INT-08)
> **Risks / Assumptions:** BRD R-05 — over-promising on AI is a credibility risk. Answers in Phase 1 are deterministic and seeded; the contract being validated is the user experience and the honesty of the provenance model, not a production retrieval pipeline
> **Definition of Done:** All P0 stories complete, every seeded question answers with citations that open the correct source, at least one seeded question returns an honest insufficiency response, document permissions verified to inherit from the linked entity

### E10-S1: Vault Structure, Versioning and Permissions
**Priority:** P1 | **Sprint:** 4 | **Points:** 8 | **Dependency:** E1-S3

**Story:** As a PROJECT_MANAGER, I want documents organised by what they belong to and permissioned accordingly, so that the right people find the right files and nobody sees what they should not.

**Acceptance Criteria:**
- Given the vault, When it loads, Then documents are organised under Customers, Installed Assets, Projects, OEM & Technical, Commercial, HR, Statutory and Company, with counts per branch of the tree
- Given a document, When it is created, Then title, type, category, linked entity, owner, upload date, version, effective and expiry dates, tags, access level and file metadata are captured
- Given a document is superseded, When a new version is uploaded, Then the prior version remains retrievable, the version history lists every version with date and author, and the current version is unambiguously indicated
- Given a user who cannot access a linked entity such as a project, When that project's documents are requested, Then access is denied, no document title or metadata is disclosed, and the denial is audit-logged
- Given a document is opened, downloaded or shared, When the action completes, Then it is recorded in the audit log against both the document and the acting user
- Given the vault, When a document is deleted, Then deletion requires explicit confirmation, the record is retained as deleted with actor and reason rather than removed, and the action is audit-logged

---

### E10-S2: Metadata, Expiry Awareness and Direct Search
**Priority:** P1 | **Sprint:** 4 | **Points:** 5 | **Dependency:** E10-S1

**Story:** As a SERVICE_MANAGER, I want to search the vault directly and be warned before documents expire, so that I am never forced through an AI conversation to find a file and never caught out by a lapsed certificate.

**Acceptance Criteria:**
- Given the vault, When a search term is entered, Then full-text and metadata search execute together and results rank with matched terms highlighted, entirely independently of the AI answer path
- Given search results, When they render, Then filters for type, category, linked entity, owner, date range, tag and expiry state combine, and the active filter set is visible and clearable
- Given a document with an expiry date falling within 60 or 30 days, When notifications are evaluated, Then the document owner and the relevant functional lead are notified, and the document appears in an expiring-documents list
- Given a document that is materially operational such as a test certificate on a live project or a statutory licence, When it expires, Then an exception is raised to the command centre exception feed
- Given the expiring-documents list, When it loads, Then documents are ordered by days remaining with the linked entity and owner shown, and an already-expired section is separated from the forthcoming section

---

### E10-S3: Ask the Vault with Inline Citations
**Priority:** P1 | **Sprint:** 6 | **Points:** 13 | **Dependency:** E10-S1

**Story:** As a SERVICE_MANAGER, I want to ask a question in plain language and receive an answer that shows me exactly which documents it came from, so that I can rely on the answer without having to verify it from scratch.

**Acceptance Criteria:**
- Given the Ask the Vault screen, When a question is submitted, Then a retrieval indicator displays the staged progress in plain language, for example searching the document count then reading the number of matched sources, before any answer text appears
- Given an answer is produced, When it renders, Then it streams progressively and each factual assertion carries a superscript citation marker, with a source list beneath showing document title, type and date
- Given a citation marker, When it is clicked, Then the source document opens with the relevant passage highlighted, and the user can return to the answer without losing it
- Given the asking user's role and record permissions, When retrieval executes, Then only documents that user may access are searched, and the same question asked by two roles may correctly return different answers
- Given the screen loads with no question entered, When it renders, Then suggested starter questions grounded in real Bhushan Corp scenarios are offered, differing by role
- Given a question is answered, When latency is measured, Then first token appears between 600 and 1,400 milliseconds so the interaction reads as considered rather than instantaneous
- Given employee personal data in the HR branch of the vault, When retrieval executes for a user without HR permission, Then that content is excluded from retrieval entirely rather than retrieved and redacted

**Note:** Phase 1 answers are deterministic and seeded against a curated question bank, with a template-driven path for parameterised questions computed live from seed data. Citations resolve to real seeded documents, not to placeholders.

---

### E10-S4: Confidence States and Honest Insufficiency
**Priority:** P0 | **Sprint:** 6 | **Points:** 5 | **Dependency:** E10-S3

**Story:** As a DIRECTOR_BUSINESS, I want the platform to tell me when it does not know, so that I can trust the answers it does give.

**Acceptance Criteria:**
- Given any answer, When it renders, Then a confidence chip displays High, Moderate, Low or Insufficient, and the basis for that state is stated in plain language such as the number and agreement of supporting sources
- Given the corpus does not support an answer, When the question is submitted, Then the response explicitly states that no supporting source was found, names what was searched, and offers the nearest related documents — and no synthesised answer is produced
- Given a question that would require inference beyond the documents, When it is submitted, Then the platform states the limit of what the documents support rather than extrapolating
- Given a Low confidence answer, When it renders, Then the interface visually distinguishes it from a High confidence answer and the caveat is stated in the answer itself, not only in the chip
- Given any AI surface, When it loads, Then a standing disclosure states that the assistant reads platform data, cites its sources, and takes no actions on the user's behalf

**Note:** This story is P0 while the surrounding vault stories are P1. The honesty behaviour is the reason the AI feature is defensible at all; a vault that answers confidently without provenance would be worse than no vault.

---

### E10-S5: Answer Feedback Capture
**Priority:** P1 | **Sprint:** 6 | **Points:** 2 | **Dependency:** E10-S3

**Story:** As the SYSTEM, I must capture whether each answer helped, so that retrieval quality can be evaluated with evidence when the real pipeline is built in Phase 2.

**Acceptance Criteria:**
- Given any answer, When it renders, Then helpful and not-helpful controls are present with an optional comment field
- Given feedback is submitted, When it is saved, Then the question, the answer, the cited sources, the confidence state, the rating and the comment are retained together
- Given feedback has been submitted for an answer, When the answer is viewed again in the same session, Then the recorded rating is reflected and may be changed
- Given collected feedback, When an administrator views it, Then rated answers are listed with rating, confidence state and comment, exportable for Phase 2 evaluation

---

## Epic E11: Workflow, Approvals & Notifications

> **Business Objective:** Replace verbal and messaging-app approvals with fast, recorded, escalating workflows, and deliver alerts through the channel Indian businesses actually read
> **Target Users:** DIRECTOR_BUSINESS, DIRECTOR_STRATEGY, BRANCH_MANAGER, SERVICE_MANAGER, PROJECT_MANAGER, ACCOUNTS_EXECUTIVE, HR_ADMIN, SUPER_ADMIN
> **Success Metrics:** Median approval turnaround ≤ 4 working hours | 100% of approvals carry an audit trail | Zero approvals actioned without recorded actor, timestamp and reason where required
> **Scope Boundary:** In: configurable multi-step approval chains with monetary thresholds and escalation, My Approvals with inline decision context, visual chain designer, delegation, in-app notification centre, simulated WhatsApp channel with actionable approval buttons, channel preference matrix, outbound message log | Out: live WhatsApp Business API, live SMS gateway, email delivery infrastructure (all BRD X-02), free-form workflow scripting or a general business-process engine
> **Risks / Assumptions:** BRD R-04 — simulated messaging must never be mistaken for live messaging; every simulated element carries a persistent indicator. Assumes WhatsApp is the preferred actionable channel per PD-011
> **Definition of Done:** All P0 stories complete, an approval actioned from the simulated WhatsApp preview reflected in the platform and audit log, escalation demonstrable on the seeded overdue approvals, chain designer producing a working chain

### E11-S1: Approval Engine and Chains
**Priority:** P1 | **Sprint:** 4 | **Points:** 13 | **Dependency:** E1-S7, B4

**Story:** As the SYSTEM, I must route every approvable request through a configurable chain with thresholds and escalation, so that authority is applied consistently regardless of who is asking or who is available.

**Acceptance Criteria:**
- Given a request type, When its chain is configured, Then the chain holds ordered steps, each with a role-based or named approver, an optional monetary threshold band, an escalation timer and an optional parallel-step designation
- Given a request is raised, When the chain is resolved, Then the applicable chain is selected by request type and by the request's value against the configured threshold bands, and the resolved chain is recorded on the request so it cannot change retrospectively
- Given the request types in scope, When any is raised, Then quotation discount, credit-limit override, purchase order above threshold, leave, expense claim, stock adjustment, AMC pricing exception, RA-bill submission, price-list change and user role change are all supported
- Given a sequential chain, When a step is approved, Then the request advances to the next step and only the next approver may act; earlier approvers cannot re-decide
- Given a step's escalation timer elapses without a decision, When escalation is evaluated, Then the request escalates to the next authority, both the original approver and the requester are notified, and the escalation appears in the command centre exception feed
- Given a rejection or a return for clarification, When it is recorded, Then a reason is mandatory, the request returns to the requester with the reason visible, and the full decision history is retained
- Given any decision at any step, When it is recorded, Then actor, role, decision, comment and timestamp are written to the audit log

---

### E11-S2: My Approvals with Inline Decision Context
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E11-S1

**Story:** As a DIRECTOR_BUSINESS, I want to decide on requests without navigating away to gather context, so that approvals take seconds rather than becoming a task I postpone.

**Acceptance Criteria:**
- Given the My Approvals screen, When it loads, Then pending requests list with request type, requester, subject entity, value and age against the step's escalation SLA, ordered by age descending
- Given each request, When it renders, Then the supporting context is presented inline — for a discount request, the quotation lines with discounts, resulting margin indication and customer history; for leave, the team calendar and coverage impact; for a purchase order, the items, supplier and last purchase rate
- Given a request, When Approve, Reject or Return is used, Then the decision is recorded immediately, the list updates without a full reload, and rejection and return require a reason before submission
- Given multiple requests of the same type, When bulk approval is invoked, Then each request is still recorded as an individual decision with its own audit entry, and any request whose inline validation fails is excluded from the bulk action with the reason shown
- Given a user with data access but without approval authority for a request type, When the request is viewed, Then no decision controls are rendered and the interface names the role that holds the authority

---

### E11-S3: Approval Chain Designer
**Priority:** P1 | **Sprint:** 6 | **Points:** 5 | **Dependency:** E11-S1

**Story:** As a SUPER_ADMIN, I want to define approval chains visually, so that authority can be adjusted as the organisation changes without a code release.

**Acceptance Criteria:**
- Given the designer, When a request type is selected, Then its existing chain renders as an ordered visual sequence of steps with role, threshold band and escalation timer on each
- Given the designer, When a step is added, moved or removed, Then the resulting chain is previewed before saving, and saving requires confirmation
- Given a chain with overlapping or gapped threshold bands, When saving is attempted, Then validation blocks the save and states the specific overlap or gap
- Given a chain change is saved, When it takes effect, Then requests already in flight retain their originally resolved chain, and only new requests use the revised chain
- Given delegation, When an approver nominates a delegate for a date range, Then requests routed to that approver during the range are additionally actionable by the delegate, and any delegated decision is recorded as such in the audit log

---

### E11-S4: Notification Centre
**Priority:** P0 | **Sprint:** 5 | **Points:** 5 | **Dependency:** E1-S2

**Story:** As a user in any role, I want one place showing everything the platform needs me to know, so that nothing important depends on my having noticed it at the moment it happened.

**Acceptance Criteria:**
- Given the notification bell, When unread notifications exist, Then the count is displayed on the header and the bell opens a panel of the most recent notifications
- Given the notification centre, When it loads, Then notifications are grouped by type with read and unread visually distinguished, filterable by type and date, with bulk mark-as-read available
- Given a notification, When it is clicked, Then the user navigates directly to the subject entity, and the notification is marked read
- Given a notification for an entity the user's role cannot access, When notifications are generated, Then it is not delivered to that user at all rather than delivered and blocked on click
- Given the notification matrix defined in the PRD, When any triggering event occurs, Then notifications are dispatched to the specified recipients on the specified timing, and digest-type notifications are batched rather than sent individually

---

### E11-S5: Simulated WhatsApp Channel with Actionable Approvals
**Priority:** P1 | **Sprint:** 5 | **Points:** 8 | **Dependency:** E11-S2, E11-S4

**Story:** As a DIRECTOR_BUSINESS, I want to approve a request from a WhatsApp-style message, so that I can clear approvals from my phone the way I already work.

**Acceptance Criteria:**
- Given an outbound notification, When the WhatsApp channel is selected, Then an authentic WhatsApp-style message preview renders with the message body, and for approval requests with interactive Approve and Reject buttons
- Given a simulated message, When it is dispatched, Then its delivery state advances on a timer through Queued, Sent, Delivered and Read, and a failure state is reachable from Demo Controls to demonstrate handling
- Given an approval button in the simulated preview, When it is used, Then the real in-platform approval is performed, the decision is recorded with the channel noted as WhatsApp, and the platform reflects the decision immediately
- Given any simulated message element, When it renders, Then a persistent "Simulated" indicator is present with a tooltip linking to the integration readiness screen, and the indicator is never hidden behind hover alone
- Given the message composer, When a template is selected, Then variable substitution populates from the subject entity and the composed message is previewable before dispatch

---

### E11-S6: Channel Preferences and Outbound Message Log
**Priority:** P1 | **Sprint:** 6 | **Points:** 3 | **Dependency:** E11-S5

**Story:** As a SUPER_ADMIN, I want to control which channels carry which notifications and to see everything the platform has sent, so that communication is deliberate and auditable.

**Acceptance Criteria:**
- Given the preference matrix, When it renders, Then each notification type can be assigned channels from In-app, WhatsApp, Email and SMS, per role
- Given the SMS channel, When it is selected, Then an annotation states that transactional SMS requires TRAI DLT registration of header and template; given the WhatsApp channel, an annotation states that DLT registration is not required
- Given the message log, When it loads, Then every simulated outbound message is listed with recipient, channel, template, rendered content, timestamp and delivery state, filterable by channel, type and date range
- Given a logged message, When the subject entity reference is clicked, Then the user navigates to that entity subject to permissions
- Given the message log, When export is invoked, Then a CSV of the filtered rows is produced and the export is audit-logged

---

## Epic E12: Analytics & KPI Studio

> **Business Objective:** Derive every published KPI from transactional records through a single implementation, so that no two screens can disagree about the same number and every figure can be defended
> **Target Users:** DIRECTOR_BUSINESS, BRANCH_MANAGER, SERVICE_MANAGER, PROJECT_MANAGER, ACCOUNTS_EXECUTIVE, STORE_INCHARGE, AUDITOR
> **Success Metrics:** All 22 BRD dictionary KPIs computed from records with zero manual entry | Every KPI exposes its formula and record set on demand | Every chart has an accessible tabular equivalent
> **Scope Boundary:** In: five curated analytics surfaces, single-implementation KPI formulas, formula and record-set disclosure, drill-through from every chart, CSV and print-ready PDF export, anomaly flagging, accessible chart equivalents | Out: self-service report builder, OLAP warehouse, custom widget layouts, predictive forecasting models (all BRD X-06 and X-07)
> **Risks / Assumptions:** BRD R-08 — prototype performance on seeded volumes must not imply production performance; measured render figures are published. Assumes the curated KPI set is preferable to a builder for this leadership team, which is an explicit product position
> **Definition of Done:** All P0 stories complete, every KPI reconciles to its record set, formula disclosure present on every tile, accessibility equivalents verified, export carrying period and filter provenance

### E12-S1: Analytics Framework and Single-Source KPI Engine
**Priority:** P0 | **Sprint:** 5 | **Points:** 8 | **Dependency:** E14-S1

**Story:** As the SYSTEM, I must compute every KPI from one implementation of its published formula, so that the command centre, the analytics surfaces and the AI assistant can never report the same metric differently.

**Acceptance Criteria:**
- Given the 22 KPIs in the BRD dictionary, When any is displayed anywhere in the platform, Then it is computed by a single shared implementation and no KPI exists as a stored or hand-entered value
- Given any KPI tile, When its disclosure control is used, Then the formula is displayed in plain language together with the period, the scope filters applied, and a link to the exact record set from which it was computed
- Given the same KPI displayed on the command centre and on an analytics surface for the same period and scope, When both are compared, Then the values are identical to the last displayed digit
- Given every analytics surface, When it loads, Then a consistent header presents the period selector, branch scope and comparison basis, and changing any of the three recomputes all metrics on the surface
- Given a KPI with insufficient records to be meaningful, When it renders, Then a data-sufficiency caveat is displayed naming the record count rather than presenting an unreliable figure as reliable

---

### E12-S2: Sales and Service Analytics Surfaces
**Priority:** P1 | **Sprint:** 6 | **Points:** 8 | **Dependency:** E12-S1

**Story:** As a BRANCH_MANAGER, I want sales and service performance presented with the metrics that actually drive my targets, so that I can act on the causes rather than argue about the numbers.

**Acceptance Criteria:**
- Given the sales surface, When it loads, Then it presents the enquiry funnel with stage conversion, quotation win rate, average deal value, revenue by product line, revenue by OEM principal, revenue by customer type, target against achieved by branch and executive, quotation ageing distribution and loss-reason distribution
- Given the service surface, When it loads, Then it presents ticket volume by category and severity, SLA compliance trend, first-time-fix trend, mean time to respond and to restore, engineer utilisation and load distribution, AMC renewal rate, AMC attach rate, commissioning submission compliance, warranty exposure and top failure modes by product line
- Given any chart element, When it is clicked, Then the underlying record list opens filtered to the clicked dimension, and its aggregate equals the value clicked
- Given a branch-scoped role, When either surface loads, Then all metrics are filtered to that role's branch and the scope is stated on screen
- Given a comparison basis of prior period or prior year, When it is selected, Then every metric displays the comparison delta with the basis named in words rather than as an unlabelled percentage

---

### E12-S3: Projects, Cash and Inventory Analytics Surfaces
**Priority:** P1 | **Sprint:** 6 | **Points:** 8 | **Dependency:** E12-S1

**Story:** As a DIRECTOR_BUSINESS, I want project delivery, cash position and stock health analysed to the same standard as sales, so that the parts of the business that consume cash are as visible as the parts that earn it.

**Acceptance Criteria:**
- Given the projects surface, When it loads, Then portfolio value, physical against financial progress, an S-curve per project, schedule variance distribution, RA-bill claimed against certified variance, and retention outstanding trend and ageing are presented
- Given the cash surface, When it loads, Then revenue trend, receivables ageing trend, DSO trend, collection efficiency, locked-cash composition, institutional against private exposure, and promised against received performance are presented
- Given the inventory surface, When it loads, Then stock value by category and location, movement velocity, reorder exposure, stock-out incidence against first-time-fix, and non-moving stock value trend are presented
- Given the stock-out against first-time-fix view, When it renders, Then the relationship between parts unavailability and repeat visits is presented explicitly, with the contributing job cards reachable in one click
- Given the locked-cash composition on the cash surface, When it renders, Then it reconciles exactly to the command centre locked-cash panel for the same period and scope

---

### E12-S4: Anomaly Flags, Export and Accessible Equivalents
**Priority:** P1 | **Sprint:** 6 | **Points:** 5 | **Dependency:** E12-S2, E12-S3

**Story:** As a DIRECTOR_BUSINESS, I want abnormal movements flagged for me and every view exportable and accessible, so that I notice what matters and can share it in the form my audience needs.

**Acceptance Criteria:**
- Given a metric deviating from its trailing baseline beyond the configured tolerance, When the surface renders, Then the metric is flagged with the magnitude and direction of deviation and a link to the contributing records
- Given an anomaly flag, When it is examined, Then the baseline period and the tolerance that produced the flag are stated, so the flag is explainable rather than opaque
- Given any analytics surface, When export is invoked, Then CSV and print-ready PDF outputs are produced carrying the period, the active filters, the scope and the generation timestamp on the face of the output
- Given any chart, When the tabular-equivalent control is used, Then a data table of the same series is presented, keyboard navigable and screen-reader labelled
- Given any chart, When it renders, Then no meaning is conveyed by colour alone; series are additionally distinguished by pattern, marker or direct label

---

## Epic E13: AI Executive Assistant

> **Business Objective:** Let leadership interrogate the business in plain language and receive answers with their working shown, without the platform ever taking an action on the user's behalf
> **Target Users:** DIRECTOR_BUSINESS, DIRECTOR_STRATEGY, BRANCH_MANAGER, SERVICE_MANAGER, PROJECT_MANAGER, ACCOUNTS_EXECUTIVE
> **Success Metrics:** Every answer presents its record set and formula | Zero autonomous business actions | Declines rather than estimates when data is inadequate | Daily briefing citations resolve to real records
> **Scope Boundary:** In: natural-language querying over platform transactional data, result rendering as figure, table or chart, record-set and formula disclosure, daily briefing generation, management-review report drafting, explicit refusal behaviour, standing disclosure | Out: autonomous agents taking business actions, auto-approval, auto-ordering, automated customer replies, predictive forecasting (all BRD X-07)
> **Risks / Assumptions:** BRD R-05. Phase 1 behaviour is deterministic and seeded. AI-G1 through AI-G10 in the PRD are product requirements, not aspirations; a violation is a defect
> **Definition of Done:** P0 guardrail story complete and verified, at least one seeded question demonstrating refusal, drafting output editable and exportable, no code path exists by which the assistant can mutate a business record

### E13-S1: Natural-Language Querying with Record-Set Disclosure
**Priority:** P2 | **Sprint:** 6 | **Points:** 13 | **Dependency:** E12-S1

**Story:** As a DIRECTOR_BUSINESS, I want to ask the platform business questions in plain language and see the records behind the answer, so that I can interrogate the business without waiting for someone to build a report.

**Acceptance Criteria:**
- Given a question about platform data, When it is submitted, Then the answer presents the computed result together with the formula applied and a one-click path to the exact record set from which it was computed
- Given a result, When it renders, Then the presentation form matches the content — a single figure for a scalar, a table for a list, a chart for a distribution or trend — rather than prose where structure is clearer
- Given the asking user's role and scope, When the query executes, Then only permitted data is queried, the scope applied is stated in the answer, and the same question from two roles may correctly return different results
- Given a question the assistant can answer, When it streams, Then a visible reasoning trail names which datasets were queried before the result appears
- Given an answer computed from a KPI in the dictionary, When it is compared with the same KPI on the analytics surface for the same period and scope, Then the values are identical
- Given a conversation, When it continues, Then history is retained for the session and is resumable, with a visible control to clear it

---

### E13-S2: Daily Briefing Generation
**Priority:** P1 | **Sprint:** 6 | **Points:** 5 | **Dependency:** E13-S1

**Story:** As a DIRECTOR_BUSINESS, I want a written briefing composed from today's position, so that I begin the day with a summary rather than with a dashboard I have to interpret.

**Acceptance Criteria:**
- Given the current simulated date and the user's scope, When a briefing is generated, Then it covers position, notable movements since the prior period, and the three items most warranting attention, in plain language
- Given each statement in the briefing, When it renders, Then it carries a citation to the specific record set that produced it, and the citation opens that record set
- Given data insufficient to support a statement, When the briefing generates, Then it states what is missing rather than producing an unsupported assertion
- Given the briefing, When it is regenerated, Then it recomputes against the current simulated clock and scope, and the prior briefing is not retained as if current
- Given the briefing is displayed on the command centre, When it renders there, Then it is identical to the briefing displayed on the assistant surface for the same user, date and scope

---

### E13-S3: Management-Review Report Drafting
**Priority:** P2 | **Sprint:** 6 | **Points:** 5 | **Dependency:** E13-S1

**Story:** As a DIRECTOR_BUSINESS, I want a monthly management-review narrative drafted from the period's data, so that the review meeting starts from a document rather than from a blank page.

**Acceptance Criteria:**
- Given a selected period, When a report draft is requested, Then a structured narrative is produced organised by vertical, with figures cited to their source record sets
- Given the draft, When it renders, Then it is editable in place, and edits are retained for the session
- Given the draft, When export is invoked, Then a print-ready document is produced carrying the period, the scope and a statement that figures were generated from platform data on the stated date
- Given a vertical with no activity in the period, When the draft is produced, Then the narrative states the absence explicitly rather than omitting the vertical silently
- Given the draft is exported, When the action completes, Then it is audit-logged with period, actor and timestamp

---

### E13-S4: Guardrails — No Autonomous Action, Refusal and Disclosure
**Priority:** P0 | **Sprint:** 6 | **Points:** 3 | **Dependency:** E13-S1

**Story:** As the SYSTEM, I must never take a business action and must decline rather than estimate, so that the assistant is trustworthy by construction rather than by good behaviour.

**Acceptance Criteria:**
- Given any assistant capability, When the code paths are examined, Then no path exists by which the assistant can create, modify, approve, send or delete a business record; drafts are handed to the user, who performs the action
- Given a request to perform an action such as approving a discount, sending a message or raising an order, When it is submitted, Then the assistant states that it does not take actions, prepares the corresponding draft where one applies, and directs the user to the screen where they may act
- Given a question that cannot be answered from available data, When it is submitted, Then the assistant declines, states precisely what data would be required, and does not estimate or extrapolate
- Given a question asking for a prediction or forecast, When it is submitted, Then the assistant declines to forecast, presents the relevant historical evidence, and states that it does not predict
- Given any assistant surface, When it loads, Then a standing disclosure states that the assistant reads platform data, cites its sources, and takes no actions
- Given a question touching employee personal data, When it is submitted by a user without HR permission, Then that data is excluded from the query entirely and the exclusion is stated rather than silently applied

---

## Epic E14: Quality, Accessibility & Demo Readiness

> **Business Objective:** Ensure the prototype is credible as an engineering artefact and reliable as a decision instrument, so that the client's sign-off rests on something they can inspect and reproduce
> **Target Users:** DEVELOPER, QA, SUPER_ADMIN, and the client as reviewer
> **Success Metrics:** Deterministic seed reproducing identically on every build | WCAG 2.2 AA pass with zero critical findings | Production build with zero TypeScript errors and zero lint warnings | Full E2E suite green | Command centre LCP under 2.5 seconds
> **Scope Boundary:** In: deterministic seed engine, complete interaction-state coverage, accessibility conformance, performance budgets, Playwright critical-path suite, demo controls and simulated clock, delivered documentation | Out: production monitoring and observability, load and stress testing at production volumes, penetration testing, CI/CD pipeline to production environments (all Phase 2)
> **Risks / Assumptions:** BRD R-03 and R-08. Seed realism is validated at the Sprint 4 client mid-point walkthrough, before polish is applied, so that credibility problems surface while they are still cheap to fix
> **Definition of Done:** All P0 stories complete, acceptance criteria A-01 through A-22 in the PRD demonstrably satisfied, demo rehearsed end to end from a local build with no external network dependency

### E14-S1: Deterministic Seed Engine
**Priority:** P0 | **Sprint:** 1 | **Points:** 8 | **Dependency:** B1, B3, B8

**Story:** As a DEVELOPER, I want seed data generated deterministically and reconcilably, so that every demonstration is reproducible and every figure on screen can be traced to a record.

**Acceptance Criteria:**
- Given a fixed seed value, When the dataset is generated, Then the same records are produced on every build, in the same order, with the same identifiers
- Given the generated dataset, When aggregates are computed, Then the sum of invoice values equals the stated revenue figures, ageing buckets sum to total receivables, retention entries sum to the retention register total, and stock balances equal the sum of movements
- Given referential integrity, When the dataset is validated, Then every ticket has an asset, every asset has a site and customer, every invoice traces to an order, job card, AMC or RA-bill, and every stock movement has a source document
- Given the seed volumes specified in the PRD, When generation completes, Then all specified counts are produced, including the eleven deliberate narrative hooks such as the overdue commissioning submissions, the newly eligible retention, the breached SLAs and the blocked e-way bill
- Given the dataset, When personal data is examined, Then all individual names, contact numbers, email addresses and identifiers are fictional, and the Compliance screen states this
- Given a validation script, When it is run against the generated dataset, Then it asserts every reconciliation rule and fails the build if any assertion does not hold

**Note:** The validation script is part of the deliverable, not a one-off check. It is what allows the client to trust that no figure on any screen was hand-placed.

---

### E14-S2: Complete Interaction-State Coverage
**Priority:** P0 | **Sprint:** 6 | **Points:** 5

**Story:** As a user in any role, I want every screen to behave sensibly while loading, when empty and when something fails, so that the platform never leaves me looking at nothing without explanation.

**Acceptance Criteria:**
- Given any list, detail, form or dashboard, When it is loading, Then a skeleton matching the final layout geometry is displayed so that no reflow occurs on load, and no full-page spinner is used
- Given a screen with no records yet, When it renders, Then an empty state presents a line icon, a one-line explanation and a primary action that creates the first record — never a bare "No data" message
- Given filters that exclude all records, When the screen renders, Then the state is distinguished from a genuinely empty dataset, states which filters are active, and offers a clear-filters action
- Given a failure, When it renders, Then a plain-language cause, a retry control and a path to continue working elsewhere are presented, with no stack trace and no unexplained error code
- Given a role lacking permission for a route, When it renders, Then the state explains the restriction, names the role that holds access, and offers the user's own landing route
- Given a blocked action such as the stale-base-document e-way bill block, When it is attempted, Then the interface states the rule that blocks it and what would unblock it
- Given an optimistic mutation that subsequently fails, When the failure occurs, Then the UI reverts and a toast explains what happened

---

### E14-S3: WCAG 2.2 Level AA Conformance
**Priority:** P0 | **Sprint:** 6 | **Points:** 8 | **Dependency:** E14-S2

**Story:** As a QA engineer, I want the platform to meet WCAG 2.2 Level AA throughout, so that the product is usable by everyone and defensible as professional work.

**Acceptance Criteria:**
- Given every screen, When an automated accessibility audit is run, Then zero critical or serious violations are reported
- Given keyboard-only operation, When the dispatch board, the mobile job card and an approval decision are attempted, Then each is completable without a pointing device, and every drag interaction has an explicit non-drag alternative
- Given focus movement, When any element receives focus, Then the focus indicator is visible and is not obscured by sticky headers, footers or overlays
- Given interactive targets, When they are measured, Then every target is at least 24 by 24 pixels, and targets on field screens are at least 44 pixels
- Given colour usage, When any state is conveyed, Then it is additionally conveyed by icon and text label, and text contrast is at least 4.5 to 1 with non-text contrast at least 3 to 1 in both themes
- Given forms, When validation fails, Then errors are programmatically associated with their fields, described in text, and summarised at the top of forms longer than one screen
- Given navigation and help placement, When any screen is compared with another, Then both remain consistent in position and order throughout the application

---

### E14-S4: Performance Budgets
**Priority:** P0 | **Sprint:** 6 | **Points:** 5

**Story:** As a DEVELOPER, I want measured performance budgets enforced, so that the prototype feels like a production system rather than a demonstration that only works on the presenter's machine.

**Acceptance Criteria:**
- Given the command centre on simulated 4G and mid-range hardware, When it is measured, Then first contentful paint is under 1.5 seconds and largest contentful paint is under 2.5 seconds
- Given client-side route transitions, When they are measured, Then each completes in under 300 milliseconds
- Given a list of at least 1,000 rows, When it renders, Then rows are virtualised, the list is interactive within 500 milliseconds and scrolling holds 60 frames per second
- Given charts of up to 24 series, When they render, Then rendering completes within 400 milliseconds
- Given simulated API latency, When any request executes, Then it falls between 120 and 400 milliseconds so that loading states are genuinely exercised rather than skipped
- Given the production build, When the console is examined during the full E2E run, Then zero errors and zero unhandled promise rejections are recorded
- Given measured figures, When the deliverable is handed over, Then the actual measured performance numbers are published in the README rather than only the targets

---

### E14-S5: Playwright Critical-Path Suite
**Priority:** P0 | **Sprint:** 6 | **Points:** 8 | **Dependency:** E14-S1

**Story:** As a QA engineer, I want automated end-to-end coverage of every critical path, so that a change in one module cannot silently break the demonstration.

**Acceptance Criteria:**
- Given the E2E suite, When it runs, Then it covers login as each of the twelve roles with correct landing route and scoped data
- Given the suite, When it runs, Then it covers the full sales path from enquiry through quotation with discount approval, win, sales order, delivery challan, tax invoice with simulated IRN, receipt and ageing reflection
- Given the suite, When it runs, Then it covers the full service path from ticket with derived SLA through dispatch assignment, mobile job card with parts consumption decrementing stock, service report generation, and first-time-fix reflected in analytics
- Given the suite, When it runs, Then it covers commissioning with submission countdown, AMC renewal initiation, RA-bill generation with retention posted to the register, the e-way bill stale-document block, field attendance check-in linked to a job card, an approval decision from the simulated WhatsApp preview, and a vault question returning working citations
- Given the suite, When RBAC is exercised, Then a forbidden route requested directly by URL is denied by the route handler and the denial appears in the audit log
- Given the suite, When it runs against a freshly seeded build, Then it passes with zero failures and zero flakes across three consecutive runs

---

### E14-S6: Demo Controls and Delivered Documentation
**Priority:** P1 | **Sprint:** 6 | **Points:** 5 | **Dependency:** E14-S1

**Story:** As a SUPER_ADMIN, I want to control the demonstration state and hand over documentation, so that the prototype can be presented repeatedly and reviewed unattended by the client.

**Acceptance Criteria:**
- Given Demo Controls, When reset is invoked, Then all state returns to the seeded baseline with confirmation required, and the reset is audit-logged
- Given Demo Controls, When the simulated clock is advanced, Then all date-derived states recompute — SLA clocks, coverage states, AMC statuses, ageing buckets, retention eligibility and commissioning deadlines — consistently across the platform
- Given Demo Controls, When a scenario toggle is used, Then states such as an SLA breach, a stock-out, a WhatsApp delivery failure or a UPI payment completion can be forced for demonstration
- Given the guided demo mode, When it is started, Then it steps through the primary narrative in the PRD demonstration script with explanatory captions, suitable for unattended client review
- Given handover, When documentation is delivered, Then it comprises a README with setup instructions, the twelve role credentials, the seed-data model and reconciliation rules, the demonstration script, the simulated-integration inventory with Phase 2 prerequisites, and the measured performance figures

---

## Story Count Summary

| Epic | Stories | P0 | P1 | P2 | Points |
|------|---------|----|----|-----|--------|
| E1: Platform Foundation, Identity & Governance | 9 | 7 | 2 | 0 | 40 |
| E2: Leadership Command Centre | 7 | 5 | 2 | 0 | 39 |
| E3: CRM & Sales Pipeline | 9 | 8 | 1 | 0 | 54 |
| E4: Service Desk & Field Execution | 8 | 8 | 0 | 0 | 65 |
| E5: Installed Assets, Warranty & AMC Lifecycle | 8 | 7 | 0 | 1 | 48 |
| E6: Projects & EPC Execution | 7 | 6 | 1 | 0 | 49 |
| E7: Inventory, Spares & Warehouse | 6 | 5 | 1 | 0 | 31 |
| E8: Commercial — GST Documents & Receivables | 7 | 6 | 1 | 0 | 39 |
| E9: HR, Attendance & Workforce | 6 | 5 | 1 | 0 | 29 |
| E10: Document Vault & AI Document Intelligence | 5 | 1 | 4 | 0 | 33 |
| E11: Workflow, Approvals & Notifications | 6 | 2 | 4 | 0 | 39 |
| E12: Analytics & KPI Studio | 4 | 1 | 3 | 0 | 29 |
| E13: AI Executive Assistant | 4 | 1 | 1 | 2 | 26 |
| E14: Quality, Accessibility & Demo Readiness | 6 | 5 | 1 | 0 | 39 |
| **Total** | **92** | **67** | **22** | **3** | **560** |

---

## Sprint Capacity Plan

| Sprint | Phase | Stories | P0 | Points | Epics in flight |
|---|---|---|---|---|---|
| S1 | Foundation | 7 | 6 | 37 | E1, E14 |
| S2 | Foundation | 13 | 11 | 75 | E1, E2, E3, E5, E7, E9 |
| S3 | Core lifecycles | 12 | 11 | 84 | E3, E4, E5, E7, E9 |
| S4 | Core lifecycles | 16 | 13 | 111 | E4, E5, E6, E7, E10, E11 |
| S5 | Commercial & workflow | 21 | 18 | 125 | E2, E3, E4, E5, E6, E7, E8, E9, E11, E12 |
| S6 | Intelligence & hardening | 23 | 8 | 128 | E1, E2, E6, E8, E9, E10, E11, E12, E13, E14 |
| **Total** | | **92** | **67** | **560** | 14 epics |

### Reading the capacity profile honestly

The profile ramps from 37 points in Sprint 1 to roughly 125 in Sprints 5 and 6. That is deliberate, but it is also the single scheduling risk in this backlog and is stated plainly rather than smoothed over:

1. **Sprint 1 is intentionally light.** It contains only the scaffolding that everything else depends on — identity, shell, RBAC, masters and the deterministic seed engine. Nothing can be parallelised until these land, so loading this sprint would not accelerate delivery.
2. **The later sprints assume parallel module tracks, not a single sequential team.** Sprints 4 to 6 carry four to six independent epics in flight simultaneously (see the "Epics in flight" column). The nominal point totals are only achievable because the tracks share no state: inventory does not block commercial, vault does not block analytics. Delivered by a single developer working sequentially, this backlog is an eight to ten sprint programme, not a six sprint one.
3. **Sprint 6 is disproportionately non-P0.** Only 9 of its stories are P0; the remainder are P1 and P2. If velocity is lower than assumed, Sprint 6 is where scope is surrendered, in the documented order: E13-S3, E13-S1, E5-S8, then E12-S4, E11-S6, E10-S5, E14-S6.
4. **Recalibrate after Sprint 1.** Points are an estimate, not a measurement. The Sprint 1 actual is the first real data point; the plan should be re-cut against it rather than defended.

### Dependency-ordered critical path

Every story dependency in this backlog has been validated so that no story is scheduled earlier than anything it depends on. The longest dependency chain, which determines the minimum achievable schedule, is:

`E14-S1` seed engine → `E7-S1` item master → `E3-S4` quotation builder → `E3-S5` quotation lifecycle → `E3-S7` order conversion → `E8-S2` tax invoice → `E4-S7` service billing hand-off

A second chain of equal significance runs through the service and asset model:

`E5-S1` asset register → `E4-S1` ticket with SLA derivation → `E4-S2` live clocks → `E4-S3` dispatch board → `E4-S4` job card → `E4-S5` mobile job card → `E4-S6` parts to stock → `E7-S5` service-critical reorder

Delay in either chain propagates directly to the demonstration script. Both are wholly contained in P0 stories.

---

## Definition of Ready

A story is not accepted into a sprint until all of the following hold. This exists to prevent the most common failure in this kind of engagement — starting a module before the client decision it depends on has been made.

| # | Condition |
|---|---|
| 1 | Acceptance criteria are written, testable, and cover happy path, validation, authorisation and at least one edge case |
| 2 | Every business blocker (`B1`–`B8`) and product decision (`PD-001`–`PD-012`) the story references is either closed or has a documented working default |
| 3 | All story dependencies are complete, or the dependent portion is explicitly de-scoped for this sprint |
| 4 | The story traces to at least one PRD functional requirement, which in turn traces to a BRD business requirement |
| 5 | Seed data sufficient to exercise the story exists, or is included in the story's own scope |
| 6 | Any new UI pattern the story needs either exists in the component inventory or is itself a listed deliverable of the story |
| 7 | The story is estimated, and the estimate is the team's, not an inherited number |

## Definition of Done

| # | Condition |
|---|---|
| 1 | Every acceptance criterion demonstrably passes, verified by walking the criterion rather than by assertion |
| 2 | All four interaction states — loading, empty, error, populated — are implemented for every surface the story introduces |
| 3 | RBAC is enforced at navigation, route handler and data-query layers, and verified for at least one permitted and one forbidden role |
| 4 | Every mutation the story introduces writes an audit entry with actor, action, entity and timestamp |
| 5 | Keyboard operability and visible focus verified; automated accessibility audit clean on the new surfaces |
| 6 | Responsive behaviour verified at 375, 768, 1024, 1440 and 1920 px; field stories additionally verified on a physical mid-range Android device |
| 7 | Indian formatting applied through the shared utility — lakh and crore abbreviation, `DD MMM YYYY` dates, tabular numerals — never hand-formatted in the component |
| 8 | Any derived value uses the single shared implementation in `/lib/derive`; no formula is duplicated |
| 9 | Any simulated integration carries a visible "Simulated" indicator linked to the integration readiness screen |
| 10 | `tsc --noEmit` clean, lint clean with no new suppressions, production build succeeds |
| 11 | Playwright coverage added where the story sits on a critical path |
| 12 | Seed data remains reconcilable — the validation script from `E14-S1` still passes |

---

## Traceability Matrix

Full chain from business objective through to backlog item. Read left to right to justify a story's existence; read right to left to find what breaks if a story is dropped.

| BRD objective | BRD requirements | PRD functional requirements | Epic — stories |
|---|---|---|---|
| BO-01 Leadership visibility | BR-001–007, BR-013 | FR-M2-01…14, FR-M11-11, FR-M12-01 | E2 — all; E12-S1; E13-S1 |
| BO-02 Stop AMC & warranty leakage | BR-016, BR-021, BR-022 | FR-M4-01…03, 20…26 | E5-S1, S3, S6, S7 |
| BO-03 Release trapped cash | BR-029, BR-035, BR-036, BR-043 | FR-M5-13…15, FR-M7-13…16, FR-M6-11 | E6-S5, S6; E8-S5, S6; E7-S6; E2-S3 |
| BO-04 Service turnaround | BR-017–019, BR-023–025, BR-041 | FR-M4-04…16, FR-M6-06, 09, 10 | E4 — all; E7-S3, S5 |
| BO-05 Warranty protection | BR-016, BR-020 | FR-M4-17…20 | E5-S4, S5 |
| BO-06 Sales conversion | BR-008–012, BR-014 | FR-M3-05…20 | E3-S3…S9 |
| BO-07 Eliminate manual collation | BR-027, BR-039, BR-040 | FR-M5-06, 07, FR-M6-01…05 | E6-S3; E7-S1, S2 |
| BO-08 Fast accountable approvals | BR-010, BR-046, BR-052, BR-053 | FR-M10-01…13, FR-M3-11, FR-M8-09 | E11 — all; E3-S6; E9-S4 |
| BO-09 Retrievable knowledge | BR-049–051 | FR-M9-01…13 | E10 — all |
| BO-10 Branch accountability | BR-003, BR-015 | FR-M2-08, FR-M11-04 | E2-S5; E12-S2 |
| BO-11 Compliance posture | BR-032–034, BR-037, BR-044, BR-054–057 | FR-M1-10…17, FR-M7-01…09, FR-M8-01, 02, 15 | E1-S3, S6, S7, S9; E8-S1…S4; E9-S1 |
| BO-12 De-risk the investment | BR-058–062 | FR-M13-01…10 | E14 — all; E1-S8 |

### Value-addition coverage

The nine value additions identified in BRD §9 — the features that make this platform recognisably Bhushan Corp's rather than generic — map to backlog items as follows. If any of these is dropped, the differentiation argument weakens accordingly.

| Value addition | Delivered by |
|---|---|
| VA-01 AMC & Warranty Renewal Radar | E5-S7, E5-S6, E2-S1 |
| VA-02 Locked-Cash Board | E2-S3, E8-S6, E6-S6 |
| VA-03 Serial-numbered asset register with OEM commissioning countdown | E5-S1, E5-S4, E5-S5 |
| VA-04 Digital field job card with location-stamped attendance | E4-S5, E9-S2, E4-S4 |
| VA-05 GST-authentic commercial documents | E8-S1, E8-S2, E8-S3, E8-S4 |
| VA-06 WhatsApp-native approvals | E11-S5, E11-S6 |
| VA-07 Branch League Table | E2-S5 |
| VA-08 Service-driven spares reorder signal | E7-S5, E4-S6 |
| VA-09 Cited AI document intelligence | E10-S3, E10-S4 |

---

## Backlog Governance

| Aspect | Position |
|---|---|
| **Numbering** | `E{n}-S{m}` identifiers are permanent. New stories take the next sequential number within their epic; existing stories are never renumbered, even if removed |
| **Scope additions** | Per BRD R-02, ideas arising during demonstrations enter a Phase 2 register. Nothing is added to this backlog after BRD sign-off without a corresponding removal of equal points |
| **De-scope order** | If velocity requires reduction, scope is surrendered in this documented order: E13-S3, E13-S1, E5-S8, E12-S4, E11-S6, E10-S5, E14-S6. No P0 story is surrendered without sponsor approval, because each is load-bearing for the demonstration script |
| **Estimate revision** | Points are re-cut after Sprint 1 against measured velocity. The revised plan supersedes this one and is issued as v1.1 |
| **Client validation checkpoints** | End of Sprint 2 against PRD acceptance criteria A-01 to A-04; end of Sprint 4 for seed-data realism, deliberately before polish is applied; end of Sprint 6 for full acceptance A-01 to A-22 |
| **Open items carried** | 8 business blockers (B1–B8) and 12 product decisions (PD-001–PD-012). Each has a documented default so that no blocker can stall the build; defaults are recorded as decisions if not overridden |

---

**End of Epics & User Stories — ARV-BC-EPC-001 v1.0**

