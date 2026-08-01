import { ShieldCheck, TriangleAlert } from "lucide-react";
import { getDataset } from "@/lib/seed";
import { formatCount, formatDate } from "@/lib/format";
import { Overline, Panel, PanelHeader, StatusBadge } from "@/components/patterns/primitives";

export const dynamic = "force-dynamic";

const DSR_LABEL: Record<string, string> = {
  ACCESS: "Access", CORRECTION: "Correction", ERASURE: "Erasure",
  WITHDRAW_CONSENT: "Withdrawal of consent", GRIEVANCE: "Grievance",
};

const CONSENT_ROWS = [
  {
    category: "Customer contacts",
    data: "Name, designation, mobile, email, preferred channel",
    purpose: "Servicing enquiries, dispatching engineers, issuing statutory documents",
  },
  {
    category: "Employees",
    data: "Name, contact, emergency contact, masked PF / ESIC / UAN, appointment and statutory documents",
    purpose: "Employment administration, attendance, statutory record-keeping",
  },
  {
    category: "Field attendance",
    data: "Timestamp, geolocation coordinates, reverse-geocoded place label, device indication",
    purpose: "Verifying field attendance against work performed",
  },
  {
    category: "Site contacts",
    data: "Name, designation, phone at customer premises",
    purpose: "Site access, service coordination, acknowledgement of work",
  },
];

/**
 * E1-S9 / FR-M1-17 — the DPDP posture: consent notice, data-principal request
 * register, per-entity retention, and a breach-response checklist marked as a
 * Phase 2 process placeholder. Positions are stated as at July 2026 (BRD CN-001).
 */
export default function CompliancePage() {
  const ds = getDataset();
  const open = ds.dsrRequests.filter((r) => r.status !== "CLOSED").length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-display-md text-text-hi">Compliance &amp; Consent</h1>
        <p className="t-body-sm mt-1 max-w-3xl text-text-mid">
          Digital Personal Data Protection Act 2023 and DPDP Rules 2025 posture. Statutory
          positions are stated as at July 2026 and require re-validation before Phase 2 go-live —
          the Labour Code central rules and DPDP enforcement are both mid-implementation, which is
          why every compliance parameter here is configuration-driven and effective-dated rather
          than hard-coded.
        </p>
      </div>

      <Panel className="border-ok/40 bg-ok-bg p-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
          <div>
            <p className="t-heading-md text-text-hi">
              All seed data in this prototype is fictional
            </p>
            <p className="t-body-sm mt-1 text-text-mid">
              Every individual name, mobile number, email address and statutory identifier is
              invented. No real personal data of any employee or customer is held in this build,
              and no client credentials are requested or stored (BRD CN-003, CN-004).
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Consent notice"
          sub="Itemised and in plain language, as the Act requires — not buried in terms."
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Category of personal data", "What is held", "Purpose"].map((h) => (
                  <th key={h} className="t-overline border-b border-line bg-surface-2 px-3 py-2 text-left text-text-lo">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONSENT_ROWS.map((r) => (
                <tr key={r.category} className="hover:bg-surface-2">
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-hi">{r.category}</td>
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-mid">{r.data}</td>
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-mid">{r.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line p-4">
          <Overline>Rights available to data principals</Overline>
          <p className="t-body-sm mt-1 text-text-mid">
            Access to a summary of personal data held and the processing performed; correction,
            completion and updating; erasure once the purpose is served; nomination of another
            individual to exercise rights; and grievance redressal. Consent may be withdrawn as
            easily as it was given, and withdrawal is recorded in the register below.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Data-principal request register"
          sub={`${formatCount(ds.dsrRequests.length)} logged · ${formatCount(open)} open`}
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Reference", "Type", "Requester", "Received", "Status", "Closed"].map((h) => (
                  <th key={h} className="t-overline border-b border-line bg-surface-2 px-3 py-2 text-left text-text-lo">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ds.dsrRequests.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2">
                  <td className="t-mono border-b border-line px-3 py-2 text-text-hi">{r.number}</td>
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-mid">
                    {DSR_LABEL[r.requestType] ?? r.requestType}
                  </td>
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-mid">{r.requester}</td>
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-mid">{formatDate(r.receivedOn)}</td>
                  <td className="border-b border-line px-3 py-2">
                    <StatusBadge tone={r.status === "CLOSED" ? "ok" : "warn"}>
                      {r.status === "IN_PROGRESS" ? "In progress" : r.status === "RECEIVED" ? "Received" : "Closed"}
                    </StatusBadge>
                  </td>
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-mid">
                    {r.closedOn ? formatDate(r.closedOn) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Retention policy"
          sub="Configurable per entity class. Any retention action taken is written to the audit log."
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Entity class", "Retention", "Basis"].map((h) => (
                  <th key={h} className="t-overline border-b border-line bg-surface-2 px-3 py-2 text-left text-text-lo">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ds.retentionPolicies.map((p) => (
                <tr key={p.id} className="hover:bg-surface-2">
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-hi">{p.entityClass}</td>
                  <td
                    className="t-body-sm border-b border-line px-3 py-2 text-right text-text-hi"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {p.retentionMonths} months
                  </td>
                  <td className="t-body-sm border-b border-line px-3 py-2 text-text-mid">{p.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="border-warn/40">
        <PanelHeader
          title="Breach response"
          sub="Process placeholder — the workflow itself is a Phase 2 deliverable."
          right={<StatusBadge tone="warn">Phase 2</StatusBadge>}
        />
        <div className="p-4">
          <div className="mb-3 flex items-start gap-2 rounded-md border border-warn/40 bg-warn-bg p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <p className="t-body-sm text-text-mid">
              Penalties under the Act reach ₹200 crore for a breach-notification failure and
              ₹250 crore for inadequate safeguards. This checklist records the obligation; it does
              not discharge it.
            </p>
          </div>
          <ol className="flex list-decimal flex-col gap-2 pl-4">
            {[
              "Intimate the Data Protection Board without delay on becoming aware of a personal data breach.",
              "Notify each affected data principal, describing the breach, its likely consequences, and the mitigation taken.",
              "Submit the detailed report to the Board within 72 hours — nature, extent, timing and location of the breach, and remedial measures.",
              "Record the breach, the notification timestamps and the remediation in the audit log.",
              "Review the safeguard that failed and re-validate the retention and access configuration.",
            ].map((step) => (
              <li key={step} className="t-body-sm text-text-mid">
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-md border border-line bg-surface-2 p-3">
            <Overline>72-hour detailed report</Overline>
            <p className="t-body-sm mt-1 text-text-lo">
              No breach recorded. In Phase 2 this field captures the report reference and
              submission timestamp against the Board acknowledgement.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
