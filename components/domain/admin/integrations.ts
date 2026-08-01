/**
 * E1-S8 — the eleven simulated integrations of PRD §8, with the Phase 2
 * prerequisites itemised the way the acceptance criteria require: credentials,
 * commercial agreements, vendor onboarding and statutory registrations, each
 * with an effort indication.
 *
 * Statutory positions are stated as at July 2026 and must be re-validated with
 * the company's chartered accountant and legal adviser before Phase 2 go-live.
 */

export type PrereqCategory = "CREDENTIALS" | "COMMERCIAL" | "ONBOARDING" | "STATUTORY";

export const PREREQ_LABEL: Record<PrereqCategory, string> = {
  CREDENTIALS: "Credentials",
  COMMERCIAL: "Commercial agreement",
  ONBOARDING: "Vendor onboarding",
  STATUTORY: "Statutory registration",
};

export type Owner = "Bhushan Corp" | "Vendor" | "Statutory body" | "Implementation team";

export interface Prerequisite {
  category: PrereqCategory;
  label: string;
  detail: string;
  /** Phase 2 effort indication — elapsed, not person-effort. */
  effort: string;
  owner: Owner;
  /** True where nothing is required, stated rather than left blank. */
  none?: boolean;
}

export interface Integration {
  id: string;
  name: string;
  vertical: string;
  /** What it does in the real business. */
  purpose: string;
  /** Exactly what the prototype does instead. */
  simulation: string;
  /** The states the user can actually see today. */
  states: string[];
  /** Where the simulation surfaces in the product. */
  appearsAt: { label: string; href: string }[];
  /** Elapsed band for the whole integration. */
  effortBand: "2–3 weeks" | "3–5 weeks" | "4–6 weeks" | "6–8 weeks" | "8–12 weeks";
  /** The single thing most likely to hold Phase 2 up. */
  criticalPath: string;
  prerequisites: Prerequisite[];
  /** Anything that must be said out loud. */
  callout?: { tone: "warn" | "info"; title: string; body: string };
}

export const INTEGRATIONS: Integration[] = [
  {
    id: "INT-01",
    name: "Accounting ledger — Tally Prime / Busy",
    vertical: "Finance & tax",
    purpose:
      "The statutory book of record. Pravaah is the operating system; the ledger stays the place the auditor and the CA work from, so every issued document must reach it without re-keying.",
    simulation:
      "The Ledger Hand-off screen produces a structured period export of invoices, credit and debit notes, and receipts. A Sync control runs a mock progression with per-document success and failure counts and a reconciliation summary that ties the exported total back to the receivables figure. Nothing is written to any accounting package.",
    states: ["Not synced", "Syncing", "Synced", "Partial failure"],
    appearsAt: [{ label: "Ledger hand-off", href: "/commercial/handoff" }],
    effortBand: "4–6 weeks",
    criticalPath: "Agreeing the chart-of-accounts mapping line by line with the CA.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "Accounting package and version confirmed",
        detail:
          "Tally Prime and Busy expose different interfaces. Confirm the package, the version and whether the licence permits ODBC or the Tally gateway.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "CREDENTIALS",
        label: "Service account on the accounting machine",
        detail:
          "A named account with rights to post vouchers, so hand-off entries are attributable in the ledger's own audit trail.",
        effort: "3 days",
        owner: "Bhushan Corp",
      },
      {
        category: "COMMERCIAL",
        label: "Connector licence, where a third-party bridge is used",
        detail:
          "Most Tally integrations run through a commercial connector. Budget a per-seat or per-company annual licence.",
        effort: "1–2 weeks",
        owner: "Vendor",
      },
      {
        category: "ONBOARDING",
        label: "On-premise connector installed",
        detail:
          "Tally is not a cloud service. A small agent runs on the machine hosting the company file and is reachable from Pravaah's backend.",
        effort: "2 weeks",
        owner: "Implementation team",
      },
      {
        category: "ONBOARDING",
        label: "Chart-of-accounts mapping agreed",
        detail:
          "Each Pravaah document type maps to a voucher type and a set of ledgers — sales by vertical, output CGST/SGST/IGST, round-off, TDS receivable, retention receivable. This is the work that takes the time.",
        effort: "2–3 weeks",
        owner: "Bhushan Corp",
      },
      {
        category: "ONBOARDING",
        label: "Test company file with masked data",
        detail: "A copy of the live company file so hand-off can be proven before it touches the book of record.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "STATUTORY",
        label: "None for the connection itself",
        detail:
          "The ledger link is internal. GST returns continue to be filed by the CA from the ledger; Pravaah does not file anything.",
        effort: "—",
        owner: "Statutory body",
        none: true,
      },
    ],
  },

  {
    id: "INT-02",
    name: "GST e-invoice — Invoice Registration Portal",
    vertical: "Finance & tax",
    purpose:
      "B2B tax invoices above the notified turnover threshold must be reported to an Invoice Registration Portal, which returns an Invoice Reference Number and a signed QR code. An invoice without a valid IRN is not a valid tax invoice.",
    simulation:
      "Issuing an invoice generates a deterministic mock IRN, an acknowledgement number and date, and renders a QR code in the statutory position on the document. A reporting-window tracker ages unreported invoices and raises an exception before the window closes. No call leaves the browser.",
    states: ["Draft", "Issued", "Reported (simulated)", "Window closing", "Window missed"],
    appearsAt: [
      { label: "Invoices", href: "/commercial/invoices" },
      { label: "Exception feed", href: "/command/exceptions" },
    ],
    effortBand: "6–8 weeks",
    criticalPath: "GSP onboarding and sandbox conformance testing against the IRP schema.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "GSP or direct API credentials",
        detail:
          "Access is granted through an authorised GST Suvidha Provider. Sandbox keys first, production keys after conformance.",
        effort: "2–3 weeks",
        owner: "Vendor",
      },
      {
        category: "CREDENTIALS",
        label: "GSTIN enabled for e-invoicing",
        detail: "The registration must be activated for e-invoicing on the portal before production keys work.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "COMMERCIAL",
        label: "GSP contract with per-IRN pricing",
        detail:
          "Priced per document. At roughly 618 invoices a year in the seeded volume this is a small line, but it is a contract.",
        effort: "2 weeks",
        owner: "Vendor",
      },
      {
        category: "ONBOARDING",
        label: "Sandbox conformance testing",
        detail:
          "Every field of the e-invoice schema must validate, including HSN, unit codes, place of supply and the export/LUT case that the Nepal transactions in this dataset exercise.",
        effort: "3 weeks",
        owner: "Implementation team",
      },
      {
        category: "STATUTORY",
        label: "Turnover-band confirmation",
        detail:
          "E-invoicing applies above a notified aggregate-turnover threshold, and the reporting window for taxpayers above the higher band is time-limited from the invoice date. Both the applicable band and the current window must be confirmed with the CA — this is the single most change-prone rule on this page.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
    ],
    callout: {
      tone: "warn",
      title: "The reporting window is a moving target",
      body: "The threshold for e-invoicing and the time limit for reporting an invoice to the IRP have both been revised more than once. The prototype models a window and ages against it; the actual number of days must be re-validated before go-live and held in the masters, not in code.",
    },
  },

  {
    id: "INT-03",
    name: "E-way bill portal",
    vertical: "Finance & tax",
    purpose:
      "Movement of goods above the notified consignment value requires an electronic waybill carrying a validity period derived from distance. Moving goods without one exposes the consignment to detention.",
    simulation:
      "The generation form captures the statutory fields and returns a mock e-way bill number with a distance-derived validity and expiry. Generation is blocked where the base document is older than the configured age, which is the real portal's behaviour and the reason stale challans cannot be waybilled.",
    states: ["Not required", "Required", "Generated", "Expired", "Blocked (stale base document)"],
    appearsAt: [
      { label: "E-way bills", href: "/commercial/eway" },
      { label: "Delivery challans", href: "/commercial/challans" },
    ],
    effortBand: "3–5 weeks",
    criticalPath: "Registering an API user against the GSTIN on the NIC portal.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "Portal credentials with two-factor authentication",
        detail:
          "A registered API user separate from the human login, because the human account's 2FA cannot be automated.",
        effort: "1–2 weeks",
        owner: "Bhushan Corp",
      },
      {
        category: "COMMERCIAL",
        label: "Normally bundled with the GSP contract",
        detail: "Where INT-02 goes through a GSP, e-way bill API access usually comes with it at no separate charge.",
        effort: "—",
        owner: "Vendor",
        none: true,
      },
      {
        category: "ONBOARDING",
        label: "Transporter master",
        detail:
          "Transporter GSTIN or TRANSIN for every carrier used, otherwise Part B of the waybill cannot be completed.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "ONBOARDING",
        label: "Distance source",
        detail:
          "Validity is a function of distance. Either the portal's own pincode-to-pincode distance or a maps provider (INT-10) must supply it consistently.",
        effort: "1 week",
        owner: "Implementation team",
      },
      {
        category: "STATUTORY",
        label: "API user registration on the NIC e-way bill portal",
        detail:
          "A distinct registration from the GST portal, made against the same GSTIN, with the consignment-value threshold and any intra-state variation confirmed for Bihar.",
        effort: "1 week",
        owner: "Statutory body",
      },
    ],
  },

  {
    id: "INT-04",
    name: "WhatsApp Business API",
    vertical: "Messaging",
    purpose:
      "The channel the customers and the field team actually read. Approval requests, SLA escalations and renewal reminders reach a director's phone rather than an inbox nobody opens.",
    simulation:
      "The message composer renders an authentic WhatsApp-style preview with interactive buttons. Delivery state advances on a timer through the real state machine, the buttons perform genuine in-platform actions, and every message is retained in a message log. Nothing is transmitted.",
    states: ["Queued", "Sent", "Delivered", "Read", "Failed"],
    appearsAt: [
      { label: "Notification centre", href: "/workflow/notifications" },
      { label: "My approvals", href: "/workflow/approvals" },
    ],
    effortBand: "6–8 weeks",
    criticalPath: "Meta Business verification, which is outside anyone's control once submitted.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "Meta Business verification",
        detail:
          "Bhushancorp Private Limited must be verified as a business with Meta — certificate of incorporation, GST registration and a matching public web presence.",
        effort: "2–4 weeks",
        owner: "Bhushan Corp",
      },
      {
        category: "CREDENTIALS",
        label: "WhatsApp Business Account and a dedicated number",
        detail:
          "The number cannot already be in use on consumer WhatsApp. Plan for a new SIM rather than migrating the office line.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "COMMERCIAL",
        label: "Business Solution Provider selection and contract",
        detail:
          "Pricing is conversation-based and varies by category. The BSP also holds the template submission relationship.",
        effort: "2 weeks",
        owner: "Vendor",
      },
      {
        category: "ONBOARDING",
        label: "Template approval per notification type",
        detail:
          "Every templated message needs approval before it can be sent. The notification and escalation matrix defines 34 events; expect at least one review cycle on wording.",
        effort: "2–3 weeks",
        owner: "Vendor",
      },
      {
        category: "ONBOARDING",
        label: "Opt-in capture on contact records",
        detail:
          "A customer contact must have opted in before a business-initiated message is permitted. The contact master needs an opt-in field, a source and a timestamp.",
        effort: "1 week",
        owner: "Implementation team",
      },
      {
        category: "STATUTORY",
        label: "TRAI DLT registration is NOT required for WhatsApp",
        detail:
          "The DLT regime registers entities, sender headers and templates for SMS traffic on Indian telecom networks. WhatsApp Business messages do not travel over that network and are not covered; the equivalent control is Meta's own template approval. Transactional SMS — integration INT-05 — does require DLT registration, so the two channels have genuinely different statutory paths and must not be planned as one.",
        effort: "—",
        owner: "Statutory body",
        none: true,
      },
    ],
    callout: {
      tone: "info",
      title: "DLT applies to SMS, not to WhatsApp",
      body: "This is the most common planning error on Indian messaging projects. WhatsApp needs Meta business verification and template approval. Transactional SMS needs TRAI DLT registration of the entity, the header and every template. Neither substitutes for the other.",
    },
  },

  {
    id: "INT-05",
    name: "SMS — transactional",
    vertical: "Messaging",
    purpose:
      "The fallback channel for recipients without WhatsApp and for the one-time codes a Phase 2 login would need. Lower engagement, but it reaches a feature phone at a customer's plant.",
    simulation:
      "A simulated send that always carries a visible annotation naming the DLT requirement, so nobody mistakes a working preview for a working channel.",
    states: ["Queued", "Sent", "DLT template required"],
    appearsAt: [{ label: "Notification channel preferences", href: "/workflow/notifications" }],
    effortBand: "3–5 weeks",
    criticalPath: "DLT template registration, which is scrutinised per template and often returned.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "SMS gateway account and API key",
        detail: "A transactional route, not a promotional one — promotional traffic is blocked in DND windows.",
        effort: "1 week",
        owner: "Vendor",
      },
      {
        category: "COMMERCIAL",
        label: "Per-message contract on the transactional route",
        detail: "Transactional pricing is higher than promotional and is billed per segment, not per message.",
        effort: "1 week",
        owner: "Vendor",
      },
      {
        category: "ONBOARDING",
        label: "Sender header registration",
        detail: "A six-character alphabetic header mapped to the registered entity.",
        effort: "1–2 weeks",
        owner: "Vendor",
      },
      {
        category: "STATUTORY",
        label: "TRAI DLT registration — required",
        detail:
          "The entity, the sender header and every message template must be registered on a Distributed Ledger Technology portal operated by an access provider. Content that does not match a registered template is rejected at the operator, not at the gateway, so testing must use the real registered template.",
        effort: "2–3 weeks",
        owner: "Statutory body",
      },
    ],
  },

  {
    id: "INT-06",
    name: "UPI / payment gateway",
    vertical: "Collections",
    purpose:
      "Collection against an outstanding invoice without a phone call. ₹1.82 Cr of receivables sits behind this; even a small shift in days-sales-outstanding is worth more than the gateway costs.",
    simulation:
      "A collection link is generated per invoice with a mock state progression that can be advanced from Demo Controls, so the full paid-and-allocated path can be demonstrated end to end. No payment instrument is involved.",
    states: ["Generated", "Sent", "Viewed", "Paid", "Expired"],
    appearsAt: [
      { label: "Receivables", href: "/commercial/receivables" },
      { label: "Receipts", href: "/commercial/receipts" },
    ],
    effortBand: "4–6 weeks",
    criticalPath: "Merchant KYC, which stalls on any mismatch between CIN, PAN and bank records.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "Merchant account, API key and webhook secret",
        detail: "The webhook is what makes a receipt appear without anyone watching for it.",
        effort: "2 weeks",
        owner: "Vendor",
      },
      {
        category: "COMMERCIAL",
        label: "MDR and settlement terms",
        detail:
          "UPI carries no merchant discount rate on most transaction types; cards and net banking do. Settlement cycle T+1 or T+2 changes the cash-flow benefit materially.",
        effort: "2 weeks",
        owner: "Bhushan Corp",
      },
      {
        category: "ONBOARDING",
        label: "Merchant KYC",
        detail:
          "Certificate of incorporation, PAN, GSTIN, cancelled cheque and a director's identity. Any name mismatch across these documents restarts the clock.",
        effort: "2–3 weeks",
        owner: "Bhushan Corp",
      },
      {
        category: "ONBOARDING",
        label: "Settlement account mapping",
        detail: "Settlements must land in the account the receipts ledger reconciles against.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "STATUTORY",
        label: "No separate registration by the merchant",
        detail:
          "UPI participation sits with the gateway and its sponsor bank. The merchant's obligation is the KYC above.",
        effort: "—",
        owner: "Statutory body",
        none: true,
      },
    ],
  },

  {
    id: "INT-07",
    name: "Biometric / geo attendance",
    vertical: "People",
    purpose:
      "A defensible muster roll for office staff on a device and for field engineers on a phone, with location captured at the point of check-in.",
    simulation:
      "App check-in captures live coordinates and a simulated selfie step; a Demo Controls trigger injects a device-sourced attendance batch so the reconciliation between app and device records can be shown. No device is contacted.",
    states: ["Captured", "Device-sourced", "Regularised", "Exception"],
    appearsAt: [
      { label: "Attendance board", href: "/people/attendance" },
      { label: "Field attendance", href: "/field/attendance" },
    ],
    effortBand: "4–6 weeks",
    criticalPath: "The DPDP notice and consent artefact for biometric capture.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "Device admin credentials or vendor push API key",
        detail: "Most Indian attendance terminals push events; a few must be polled.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "COMMERCIAL",
        label: "Device purchase or AMC per branch",
        detail: "Four branches, so four terminals plus spares, with an annual maintenance contract.",
        effort: "2 weeks",
        owner: "Bhushan Corp",
      },
      {
        category: "ONBOARDING",
        label: "Device make, model and SDK confirmation",
        detail: "SDK availability varies sharply by manufacturer and firmware version.",
        effort: "1–2 weeks",
        owner: "Vendor",
      },
      {
        category: "ONBOARDING",
        label: "Geofence definitions",
        detail:
          "A radius per branch and per regularly visited customer site, otherwise every rural visit reads as a breach.",
        effort: "2 weeks",
        owner: "Implementation team",
      },
      {
        category: "STATUTORY",
        label: "DPDP notice and consent for biometric capture",
        detail:
          "Biometric and precise-location data about employees requires a specific notice, a stated purpose, a retention period and a withdrawal route. Draft the artefact before the first template is captured, not after.",
        effort: "2 weeks",
        owner: "Bhushan Corp",
      },
    ],
  },

  {
    id: "INT-08",
    name: "Aadhaar eSign / DigiLocker",
    vertical: "Identity",
    purpose:
      "A signature with evidential weight on AMC agreements, commissioning acceptances and HR documents, without printing and couriering paper across Bihar.",
    simulation:
      "The eSign flow shows a simulated consent step and OTP step and returns a signed-document state with a signature panel rendered in position on the PDF. No Aadhaar number is collected, transmitted or stored anywhere in this prototype.",
    states: ["Unsigned", "Signing", "Signed (simulated)"],
    appearsAt: [
      { label: "Document vault", href: "/vault" },
      { label: "AMC contracts", href: "/service/amc" },
    ],
    effortBand: "8–12 weeks",
    criticalPath: "Legal review of whether the intended use case is permissible, before any engagement.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "ASP application credentials and ESP gateway keys",
        detail: "Issued after the Application Service Provider engagement is in place.",
        effort: "3 weeks",
        owner: "Vendor",
      },
      {
        category: "COMMERCIAL",
        label: "ASP / ESP engagement",
        detail: "Priced per signature, with a minimum commitment on most contracts.",
        effort: "2–3 weeks",
        owner: "Vendor",
      },
      {
        category: "ONBOARDING",
        label: "Consent artefact and signature-panel design",
        detail:
          "The consent text is prescribed in substance; the panel must appear in a consistent position on every document class.",
        effort: "2 weeks",
        owner: "Implementation team",
      },
      {
        category: "STATUTORY",
        label: "Legal review of Aadhaar-based authentication",
        detail:
          "Aadhaar eSign is governed by the Information Technology Act and UIDAI circulars, and permissible purposes are narrower than most projects assume. A written opinion on whether commercial contract signing qualifies must precede engagement, and DigiLocker issuance has its own conditions.",
        effort: "3–4 weeks",
        owner: "Bhushan Corp",
      },
    ],
    callout: {
      tone: "warn",
      title: "No Aadhaar data exists in this prototype",
      body: "The eSign flow is a visual simulation. No Aadhaar number, biometric or OTP is collected, and none of the seed data contains an Aadhaar reference.",
    },
  },

  {
    id: "INT-09",
    name: "Single sign-on — Google Workspace / Microsoft 365",
    vertical: "Identity",
    purpose:
      "One corporate identity, one place to revoke it. The point of SSO is not convenience; it is that a departing employee loses access to Pravaah the moment their mailbox is disabled.",
    simulation:
      "The login screen presents provider buttons that resolve directly to the seeded demo session. They are marked Simulated and perform no federation.",
    states: ["Available (simulated)"],
    appearsAt: [{ label: "Login", href: "/login" }],
    effortBand: "2–3 weeks",
    criticalPath: "Mapping tenant groups to the twelve roles without leaving anyone over-privileged.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "OAuth client id and secret from the tenant",
        detail: "Created by the tenant administrator against a registered redirect URI.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "COMMERCIAL",
        label: "Existing Workspace or 365 licences suffice",
        detail: "No additional contract is expected where the company already licenses one of the two.",
        effort: "—",
        owner: "Bhushan Corp",
        none: true,
      },
      {
        category: "ONBOARDING",
        label: "Tenant admin consent, domain verification and group-to-role mapping",
        detail:
          "All twelve roles need a group. Decide what happens to a user who is in no group — the safe answer is no access, not a default role.",
        effort: "1–2 weeks",
        owner: "Implementation team",
      },
      {
        category: "STATUTORY",
        label: "None",
        detail: "Federation with a corporate identity provider carries no Indian registration requirement.",
        effort: "—",
        owner: "Statutory body",
        none: true,
      },
    ],
  },

  {
    id: "INT-10",
    name: "Maps and routing",
    vertical: "Field",
    purpose:
      "Site addresses on a map and a sensible visit order for an engineer covering three districts in a day. Travel is the largest non-productive cost in the service business.",
    simulation:
      "Static map thumbnails with pins drawn from seeded coordinates, and a route-order suggestion computed from a fixed distance matrix. No tile, geocode or directions request is made.",
    states: ["Rendered from seed"],
    appearsAt: [
      { label: "Dispatch board", href: "/service/dispatch" },
      { label: "Field day view", href: "/field/today" },
    ],
    effortBand: "3–5 weeks",
    criticalPath: "Geocoding real rural addresses, which will need manual correction.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "Maps API key with referrer restriction",
        detail: "An unrestricted key on a client-rendered map is a billing incident waiting to happen.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "COMMERCIAL",
        label: "Billing account with a usage cap",
        detail: "Geocoding, tiles and directions are metered separately. Set a hard cap and an alert.",
        effort: "1 week",
        owner: "Bhushan Corp",
      },
      {
        category: "ONBOARDING",
        label: "Geocoding of real site addresses",
        detail:
          "164 sites in the seeded world. Rural addresses in Bihar frequently resolve to a district centroid rather than a plant gate, so expect a manual correction pass with the branch teams.",
        effort: "2 weeks",
        owner: "Implementation team",
      },
      {
        category: "STATUTORY",
        label: "None",
        detail: "No registration is required to consume a commercial maps service.",
        effort: "—",
        owner: "Statutory body",
        none: true,
      },
    ],
  },

  {
    id: "INT-11",
    name: "OEM channel portals",
    vertical: "Field",
    purpose:
      "Commissioning reports and warranty claims must reach the principal inside the submission window or the claim is refused and the cost lands on the dealer.",
    simulation:
      "The commissioning register offers a Submit to OEM action that produces a mock acknowledgement reference and timestamp, and the register then ages every unsubmitted report against the window held in the masters.",
    states: ["Not submitted", "Submitted", "Acknowledged"],
    appearsAt: [
      { label: "Commissioning register", href: "/service/commissioning" },
      { label: "OEM commissioning windows", href: "/admin/masters?set=commissioningWindows" },
    ],
    effortBand: "6–8 weeks",
    criticalPath: "Most principal portals have no public API; the format must be agreed one by one.",
    prerequisites: [
      {
        category: "CREDENTIALS",
        label: "Dealer portal access per principal",
        detail: "Separate credentials for ELGi, ATS-ELGi, KSB and Ion Exchange, each with its own renewal cycle.",
        effort: "1–2 weeks",
        owner: "Bhushan Corp",
      },
      {
        category: "COMMERCIAL",
        label: "Dealer agreement clause permitting electronic submission",
        detail:
          "Several dealer agreements still specify a signed paper return. The clause has to be varied before an electronic submission is accepted as valid.",
        effort: "2–4 weeks",
        owner: "Bhushan Corp",
      },
      {
        category: "ONBOARDING",
        label: "Submission format agreed per principal",
        detail:
          "Where no API exists, Phase 2 delivers a structured export in the principal's own template plus an upload step, rather than pretending to a live call.",
        effort: "3 weeks",
        owner: "Implementation team",
      },
      {
        category: "STATUTORY",
        label: "None",
        detail: "A commercial arrangement between dealer and principal; no registration is involved.",
        effort: "—",
        owner: "Statutory body",
        none: true,
      },
    ],
  },
];

export const INTEGRATION_VERTICALS = [
  "Finance & tax",
  "Messaging",
  "Collections",
  "People",
  "Identity",
  "Field",
] as const;
