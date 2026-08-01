"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Save } from "lucide-react";
import { Panel, PanelHeader, Overline } from "@/components/patterns/primitives";
import { addMonths, formatDate, formatINR } from "@/lib/format";
import type { ProjectStatus } from "@/lib/schemas/enums";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_ORDER } from "./labels";
import { CONTRACT_TYPES } from "./constants";
import { addProject, type OverlayProject } from "./store";
import { BlockedNotice, Btn, Field, NumberInput, Select, TextArea, TextInput, WarnNotice } from "./ui";

export interface FormOption { id: string; label: string; sub?: string; extra?: string }

interface Draft {
  code: string; name: string; customerId: string; clientType: string;
  siteLocation: string; district: string; scopeSummary: string; contractType: string;
  workOrderRef: string; workOrderDate: string; contractValue: string;
  startDate: string; contractualCompletion: string; revisedCompletion: string;
  actualCompletion: string; defectLiabilityMonths: string; retentionPct: string;
  mobilisationAdvance: string; priceVariationClause: boolean;
  liquidatedDamagesTerms: string; managerUserId: string; branchId: string;
  status: ProjectStatus; varianceTolerancePct: string;
}

/**
 * E6-S1 — the project record. Every contractual term the acceptance criteria
 * name is captured here; nothing is inferred silently, and the defect-liability
 * expiry is computed live because E6-S6 releases retention against it.
 */
export function ProjectForm({
  customers, managers, branches, today, actor, canCreate,
}: {
  customers: FormOption[]; managers: FormOption[]; branches: FormOption[];
  today: string; actor: { id: string; name: string }; canCreate: boolean;
}) {
  const router = useRouter();
  const iso = today.slice(0, 10);
  const [d, setD] = useState<Draft>({
    code: "", name: "", customerId: customers[0]?.id ?? "", clientType: customers[0]?.extra ?? "INSTITUTIONAL",
    siteLocation: "", district: "", scopeSummary: "", contractType: CONTRACT_TYPES[0],
    workOrderRef: "", workOrderDate: iso, contractValue: "",
    startDate: iso, contractualCompletion: "", revisedCompletion: "", actualCompletion: "",
    defectLiabilityMonths: "12", retentionPct: "5", mobilisationAdvance: "0",
    priceVariationClause: false,
    liquidatedDamagesTerms: "0.5% of contract value per week of delay, capped at 5%.",
    managerUserId: managers[0]?.id ?? actor.id, branchId: branches[0]?.id ?? "",
    status: "AWARDED", varianceTolerancePct: "5",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const dlpBase = d.actualCompletion || d.revisedCompletion || d.contractualCompletion;
  const dlpMonths = Number(d.defectLiabilityMonths) || 0;
  const dlpExpiryDate = dlpBase ? addMonths(dlpBase, dlpMonths) : null;

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!d.code.trim()) e.code = "A project code is required — it prefixes every DPR and RA-bill number.";
    if (!d.name.trim()) e.name = "Name the works as they appear on the work order.";
    if (!d.customerId) e.customerId = "Select the client.";
    if (!d.siteLocation.trim()) e.siteLocation = "Site location is required.";
    if (!d.district.trim()) e.district = "District is required.";
    if (!d.scopeSummary.trim()) e.scopeSummary = "Summarise the contracted scope.";
    if (!d.workOrderRef.trim()) e.workOrderRef = "Work order reference is required.";
    if (!Number(d.contractValue)) e.contractValue = "Contract value must be greater than zero.";
    if (!d.contractualCompletion) e.contractualCompletion = "Contractual completion date is required.";
    if (d.contractualCompletion && d.startDate && d.contractualCompletion <= d.startDate) {
      e.contractualCompletion = "Completion must fall after the start date.";
    }
    if (Number(d.retentionPct) < 0 || Number(d.retentionPct) > 20) {
      e.retentionPct = "Retention percentage must sit between 0 and 20.";
    }
    if (Number(d.mobilisationAdvance) > Number(d.contractValue)) {
      e.mobilisationAdvance = "Mobilisation advance cannot exceed the contract value.";
    }
    if (d.status === "DLP" && !dlpBase) {
      e.status = "A project in the defect-liability period needs a completion date to compute the expiry.";
    }
    return e;
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const record: OverlayProject = {
      id: `PRJ-L-${Date.now().toString(36).toUpperCase()}`,
      code: d.code.trim(), name: d.name.trim(), customerId: d.customerId,
      clientType: d.clientType, siteLocation: d.siteLocation.trim(), district: d.district.trim(),
      scopeSummary: d.scopeSummary.trim(), contractType: d.contractType,
      workOrderRef: d.workOrderRef.trim(), workOrderDate: new Date(d.workOrderDate).toISOString(),
      contractValue: Number(d.contractValue),
      startDate: new Date(d.startDate).toISOString(),
      contractualCompletion: new Date(d.contractualCompletion).toISOString(),
      revisedCompletion: d.revisedCompletion ? new Date(d.revisedCompletion).toISOString() : null,
      actualCompletion: d.actualCompletion ? new Date(d.actualCompletion).toISOString() : null,
      defectLiabilityMonths: dlpMonths, retentionPct: Number(d.retentionPct),
      mobilisationAdvance: Number(d.mobilisationAdvance),
      priceVariationClause: d.priceVariationClause,
      liquidatedDamagesTerms: d.liquidatedDamagesTerms.trim(),
      managerUserId: d.managerUserId, branchId: d.branchId,
      status: d.status, varianceTolerancePct: Number(d.varianceTolerancePct),
      createdAt: new Date().toISOString(),
    };
    addProject(record, actor);
    setSaved(true);
    router.push("/projects");
  }

  if (!canCreate) {
    return (
      <BlockedNotice
        rule="your role cannot create project records"
        unblock="Director – Business and Super Admin hold create rights on projects. Ask one of them to record the work order, then it will appear in your portfolio."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader
          title="Contract terms"
          sub="Commercial obligations are recorded once, here, and read everywhere else."
        />
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Project code" required error={errors.code} hint="Prefixes DPR and RA-bill numbering.">
            <TextInput value={d.code} onChange={(e) => set("code", e.target.value)} placeholder="BC/PRJ/26/08" />
          </Field>
          <Field label="Project name" required error={errors.name} className="xl:col-span-2">
            <TextInput value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Sewage Treatment Plant Package — 600 KLD" />
          </Field>

          <Field label="Client" required error={errors.customerId}>
            <Select
              value={d.customerId}
              onChange={(e) => {
                const c = customers.find((x) => x.id === e.target.value);
                setD((p) => ({ ...p, customerId: e.target.value, clientType: c?.extra ?? p.clientType }));
              }}
            >
              {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Client type" hint="Defaulted from the client master; override only where the contracting entity differs.">
            <Select value={d.clientType} onChange={(e) => set("clientType", e.target.value)}>
              {["INDUSTRIAL", "INSTITUTIONAL", "GOVERNMENT", "DEALER", "RETAIL"].map((t) => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
              ))}
            </Select>
          </Field>
          <Field label="Contract type">
            <Select value={d.contractType} onChange={(e) => set("contractType", e.target.value)}>
              {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>

          <Field label="Site location" required error={errors.siteLocation}>
            <TextInput value={d.siteLocation} onChange={(e) => set("siteLocation", e.target.value)} placeholder="Sector 4, Patna" />
          </Field>
          <Field label="District" required error={errors.district}>
            <TextInput value={d.district} onChange={(e) => set("district", e.target.value)} placeholder="Patna" />
          </Field>
          <Field label="Branch">
            <Select value={d.branchId} onChange={(e) => set("branchId", e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </Select>
          </Field>

          <Field label="Scope summary" required error={errors.scopeSummary} className="md:col-span-2 xl:col-span-3">
            <TextArea value={d.scopeSummary} onChange={(e) => set("scopeSummary", e.target.value)} placeholder="Design, supply, erection, testing and commissioning of…" />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Work order and value" sub="The commercial anchor for every claim raised against this project." />
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Work order reference" required error={errors.workOrderRef}>
            <TextInput value={d.workOrderRef} onChange={(e) => set("workOrderRef", e.target.value)} placeholder="WO/26/48219" />
          </Field>
          <Field label="Work order date">
            <TextInput type="date" value={d.workOrderDate} onChange={(e) => set("workOrderDate", e.target.value)} />
          </Field>
          <Field
            label="Contract value (₹)"
            required
            error={errors.contractValue}
            hint={d.contractValue ? formatINR(Number(d.contractValue)) : undefined}
          >
            <NumberInput value={d.contractValue} onChange={(e) => set("contractValue", e.target.value)} min={0} step={1000} />
          </Field>
          <Field
            label="Mobilisation advance (₹)"
            error={errors.mobilisationAdvance}
            hint={d.mobilisationAdvance ? `${formatINR(Number(d.mobilisationAdvance))} — recovered across RA-bills` : undefined}
          >
            <NumberInput value={d.mobilisationAdvance} onChange={(e) => set("mobilisationAdvance", e.target.value)} min={0} step={1000} />
          </Field>

          <Field label="Start date">
            <TextInput type="date" value={d.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="Contractual completion" required error={errors.contractualCompletion}>
            <TextInput type="date" value={d.contractualCompletion} onChange={(e) => set("contractualCompletion", e.target.value)} />
          </Field>
          <Field label="Revised completion" hint="Leave empty until an extension of time is granted.">
            <TextInput type="date" value={d.revisedCompletion} onChange={(e) => set("revisedCompletion", e.target.value)} />
          </Field>
          <Field label="Actual completion" hint="Set on handover; it becomes the defect-liability clock start.">
            <TextInput type="date" value={d.actualCompletion} onChange={(e) => set("actualCompletion", e.target.value)} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Retention, defect liability and risk" sub="These three fields drive the retention register and the At Risk flag." />
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Retention percentage" error={errors.retentionPct} hint="Withheld on each certified RA-bill value.">
            <NumberInput value={d.retentionPct} onChange={(e) => set("retentionPct", e.target.value)} min={0} max={20} step={0.5} />
          </Field>
          <Field label="Defect-liability period (months)">
            <NumberInput value={d.defectLiabilityMonths} onChange={(e) => set("defectLiabilityMonths", e.target.value)} min={0} max={60} step={1} />
          </Field>
          <Field label="Schedule-variance tolerance (%)" hint="Beyond this the project is flagged At Risk.">
            <NumberInput value={d.varianceTolerancePct} onChange={(e) => set("varianceTolerancePct", e.target.value)} min={0} max={50} step={1} />
          </Field>
          <Field label="Status" required error={errors.status}>
            <Select value={d.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
              {PROJECT_STATUS_ORDER.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
            </Select>
          </Field>

          <Field label="Price-variation clause" className="md:col-span-2">
            <label className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface-2 px-2">
              <input
                type="checkbox"
                checked={d.priceVariationClause}
                onChange={(e) => set("priceVariationClause", e.target.checked)}
                className="size-3.5 accent-[var(--primary-600)]"
              />
              <span className="t-body-sm text-text-mid">
                {d.priceVariationClause ? "Present — rates escalate against the contract index" : "Absent — rates are firm for the contract duration"}
              </span>
            </label>
          </Field>
          <Field label="Project manager" className="md:col-span-2">
            <Select value={d.managerUserId} onChange={(e) => set("managerUserId", e.target.value)}>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.label}{m.sub ? ` — ${m.sub}` : ""}</option>)}
            </Select>
          </Field>

          <Field label="Liquidated-damages terms" className="md:col-span-2 xl:col-span-4">
            <TextArea value={d.liquidatedDamagesTerms} onChange={(e) => set("liquidatedDamagesTerms", e.target.value)} />
          </Field>
        </div>

        <div className="border-t border-line px-4 py-3">
          <Overline>Computed — defect-liability expiry</Overline>
          <p className="t-body mt-1 text-text-hi">
            {dlpExpiryDate ? (
              <>
                {formatDate(dlpExpiryDate)}{" "}
                <span className="t-body-sm text-text-mid">
                  ({dlpMonths} months from {formatDate(dlpBase)} —{" "}
                  {d.actualCompletion ? "actual completion" : d.revisedCompletion ? "revised completion" : "contractual completion"})
                </span>
              </>
            ) : (
              <span className="t-body-sm text-text-lo">Enter a completion date to compute the expiry.</span>
            )}
          </p>
          <p className="t-body-sm mt-1 text-text-mid">
            Retention withheld on this project becomes eligible for release on this date. Entering the
            defect-liability period recomputes it from the recorded completion.
          </p>
        </div>
      </Panel>

      {Object.keys(errors).length ? (
        <WarnNotice
          title={`${Object.keys(errors).length} field${Object.keys(errors).length === 1 ? "" : "s"} need attention`}
          body="Each is marked below its input. Nothing is saved until they are cleared."
        />
      ) : null}

      <div className="flex items-center gap-2">
        <Btn variant="primary" size="md" onClick={submit}>
          {saved ? <Check className="size-4" aria-hidden /> : <Save className="size-4" aria-hidden />}
          Record project
        </Btn>
        <Btn size="md" onClick={() => router.push("/projects")}>Cancel</Btn>
        <span className="t-body-sm text-text-lo">
          Saved to this browser under <span className="t-mono">pravaah.v1.projects</span> and written to the audit trail.
        </span>
      </div>
    </div>
  );
}
