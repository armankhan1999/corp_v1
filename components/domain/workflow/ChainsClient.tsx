"use client";

/**
 * E11-S3 — the visual approval chain designer, plus delegation.
 *
 * Selecting a request type renders every configured band as an ordered visual
 * sequence. Edits build a *draft*; the draft is previewed against the saved
 * chain and cannot be committed until the threshold bands are contiguous, and
 * then only through an explicit confirmation. A saved revision never reaches
 * back into a request already in flight — those carry the chain they resolved
 * to at raise time.
 */

import * as React from "react";
import {
  ArrowDown, ArrowUp, CalendarRange, GitBranch, Plus, RotateCcw, Save, ShieldCheck,
  Trash2, TriangleAlert, UserPlus, Waypoints,
} from "lucide-react";

import { abbreviateINR, formatCount, formatDate, formatDateTime, formatPercent } from "@/lib/format";
import { ROLE_LABEL, type ApprovalRequestType, type Role } from "@/lib/schemas/enums";
import type * as T from "@/lib/schemas/entities";
import { Panel, PanelHeader, Overline, StatusBadge, EmptyState, Explainer } from "@/components/patterns/primitives";
import {
  AuthorityNote, Btn, Field, Note, SectionTitle, Select, TextInput, ToastStack, useToasts,
} from "./ui";
import {
  bandLabel, formatBandValue, raiseRequest, REQUEST_TYPE_META, resolveChain, validateChainBands,
} from "./engine";
import { useWorkflow } from "./store";
import type { WorkflowSnapshot } from "./types";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

interface DraftStep {
  id: string;
  order: number;
  approverRole: Role;
  minValue: number | null;
  maxValue: number | null;
  escalationHours: number;
  parallel: boolean;
}

interface DraftChain {
  id: string;
  name: string;
  minValue: number;
  maxValue: number | null;
  steps: DraftStep[];
}

function toDraft(
  chains: T.ApprovalChain[], steps: T.ApprovalChainStep[], type: ApprovalRequestType,
): DraftChain[] {
  return chains
    .filter((c) => c.requestType === type)
    .sort((a, b) => a.minValue - b.minValue)
    .map((c) => ({
      id: c.id,
      name: c.name,
      minValue: c.minValue,
      maxValue: c.maxValue,
      steps: steps
        .filter((s) => s.chainId === c.id)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          id: s.id, order: s.order, approverRole: s.approverRole,
          minValue: s.minValue, maxValue: s.maxValue,
          escalationHours: s.escalationHours, parallel: s.parallel,
        })),
    }));
}

function fromDraft(
  draft: DraftChain[], type: ApprovalRequestType,
): { chains: T.ApprovalChain[]; steps: T.ApprovalChainStep[] } {
  const chains: T.ApprovalChain[] = [];
  const steps: T.ApprovalChainStep[] = [];
  draft.forEach((c) => {
    chains.push({ id: c.id, requestType: type, name: c.name, minValue: c.minValue, maxValue: c.maxValue });
    c.steps.forEach((s, i) => {
      steps.push({
        id: s.id, chainId: c.id, order: i + 1, approverRole: s.approverRole,
        minValue: s.minValue, maxValue: s.maxValue,
        escalationHours: s.escalationHours, parallel: s.parallel,
      });
    });
  });
  return { chains, steps };
}

function sameDraft(a: DraftChain[], b: DraftChain[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ChainsClient({ snapshot }: { snapshot: WorkflowSnapshot }) {
  const api = useWorkflow(snapshot);
  const toasts = useToasts();
  const editable = snapshot.viewer.canDesignChains;

  const [type, setType] = React.useState<ApprovalRequestType>("QUOTATION_DISCOUNT");
  const saved = React.useMemo(() => toDraft(api.chains, api.chainSteps, type), [api.chains, api.chainSteps, type]);
  const [draft, setDraft] = React.useState<DraftChain[]>(saved);
  const [confirming, setConfirming] = React.useState(false);
  const [seq, setSeq] = React.useState(1);

  // Switching type discards an unsaved draft for the previous type.
  const typeRef = React.useRef(type);
  React.useEffect(() => {
    if (typeRef.current !== type) {
      typeRef.current = type;
      setDraft(saved);
      setConfirming(false);
    }
  }, [type, saved]);

  const meta = REQUEST_TYPE_META[type];
  const built = fromDraft(draft, type);
  const issues = validateChainBands(built.chains, built.steps, type);
  const dirty = !sameDraft(draft, saved);

  const inFlight = api.requests.filter(
    (r) => r.type === type && !["APPROVED", "REJECTED", "RETURNED", "WITHDRAWN"].includes(r.status),
  );

  const nextId = (prefix: string) => {
    const n = seq;
    setSeq((s) => s + 1);
    return `${prefix}-W${String(n).padStart(3, "0")}`;
  };

  /* ------------------------------------------------------------- editing */

  function updateChain(id: string, patch: Partial<DraftChain>) {
    setDraft((d) => d.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function updateStep(chainId: string, stepId: string, patch: Partial<DraftStep>) {
    setDraft((d) => d.map((c) => (c.id === chainId
      ? { ...c, steps: c.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) }
      : c)));
  }
  function addStep(chainId: string) {
    setDraft((d) => d.map((c) => (c.id === chainId
      ? {
        ...c,
        steps: [...c.steps, {
          id: nextId("ACS"), order: c.steps.length + 1, approverRole: "DIRECTOR_BUSINESS" as Role,
          minValue: null, maxValue: null, escalationHours: 24, parallel: false,
        }],
      }
      : c)));
  }
  function removeStep(chainId: string, stepId: string) {
    setDraft((d) => d.map((c) => (c.id === chainId ? { ...c, steps: c.steps.filter((s) => s.id !== stepId) } : c)));
  }
  function moveStep(chainId: string, stepId: string, dir: -1 | 1) {
    setDraft((d) => d.map((c) => {
      if (c.id !== chainId) return c;
      const i = c.steps.findIndex((s) => s.id === stepId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= c.steps.length) return c;
      const steps = [...c.steps];
      [steps[i], steps[j]] = [steps[j]!, steps[i]!];
      return { ...c, steps };
    }));
  }
  function addBand() {
    const last = draft[draft.length - 1];
    const min = last ? (last.maxValue ?? last.minValue + 1) : 0;
    setDraft((d) => [...d, {
      id: nextId("APC"),
      name: `New band from ${formatBandValue(min, meta.basis)}`,
      minValue: min,
      maxValue: null,
      steps: [{
        id: nextId("ACS"), order: 1, approverRole: "BRANCH_MANAGER" as Role,
        minValue: null, maxValue: null, escalationHours: 8, parallel: false,
      }],
    }]);
  }
  function removeBand(id: string) {
    setDraft((d) => d.filter((c) => c.id !== id));
  }

  function save() {
    api.actions.saveChains(type, built.chains, built.steps);
    setConfirming(false);
    toasts.push(
      "ok",
      `${meta.label} chain revised`,
      `${built.chains.length} band(s), ${built.steps.length} step(s). ${inFlight.length} in-flight request${inFlight.length === 1 ? "" : "s"} keep their originally resolved chain.`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-display-md text-text-hi">Approval chains</h1>
          <p className="t-body-sm mt-1 max-w-3xl text-text-mid">Authority, drawn. One band per request type, by value.</p>
        <Explainer className="mt-2" label="Why this screen reads the way it does">
          Authority, drawn. Each request type resolves to exactly one band by value; the band&rsquo;s ordered steps
            are the approvers, in sequence, each with its own escalation timer.
        </Explainer>
        </div>
        <p className="t-body-sm text-text-lo">
          As at <span className="t-mono text-text-mid">{formatDateTime(api.now)}</span> IST
        </p>
      </div>

      {!editable ? (
        <AuthorityNote
          icon="shield"
          message={`${ROLE_LABEL[snapshot.viewer.role]} may read the chain configuration but not change it. Editing controls are not rendered.`}
          authorityLabel="Super Admin · Director – Business"
        />
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-3 py-2">
          <Field label="Request type" htmlFor="ch-type" className="w-72">
            <Select
              id="ch-type"
              value={type}
              onChange={(e) => setType(e.target.value as ApprovalRequestType)}
              options={(Object.keys(REQUEST_TYPE_META) as ApprovalRequestType[]).map((t) => ({
                value: t,
                label: `${REQUEST_TYPE_META[t].label}`,
              }))}
            />
          </Field>
          <div className="flex flex-col gap-0.5">
            <Overline>Band basis</Overline>
            <p className="t-body-sm text-text-hi">
              {meta.basis === "PERCENT" ? "Discount percentage"
                : meta.basis === "MONEY" ? "Rupee value"
                  : "Not value-banded — a single chain takes every request"}
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <Overline>Raised from</Overline>
            <p className="t-body-sm text-text-hi">{meta.origin}</p>
          </div>
          <div className="ml-auto flex items-end gap-2">
            {editable ? (
              <>
                <Btn onClick={addBand}><Plus className="size-3.5" aria-hidden /> Add band</Btn>
                <Btn onClick={() => { setDraft(saved); setConfirming(false); }} disabled={!dirty}>
                  <RotateCcw className="size-3.5" aria-hidden /> Discard draft
                </Btn>
                <Btn
                  variant="primary"
                  disabled={!dirty || issues.length > 0}
                  onClick={() => setConfirming(true)}
                >
                  <Save className="size-3.5" aria-hidden /> Save revision
                </Btn>
              </>
            ) : null}
          </div>
        </div>

        <p className="t-body-sm border-b border-line bg-surface-2 px-3 py-1.5 text-text-lo">
          Bands are half-open: <span className="t-mono">[min, max)</span>. The upper bound is exclusive and the last
          band must be unbounded, so 0–5 / 5–10 / 10+ is contiguous rather than a three-way overlap.
        </p>

        {/* -------------------------------------------------------- issues */}
        {issues.length ? (
          <div className="border-b border-line bg-danger-bg px-3 py-2">
            <p className="t-body-sm flex items-center gap-1.5 font-medium text-danger">
              <TriangleAlert className="size-3.5" aria-hidden />
              Saving is blocked — {issues.length} problem{issues.length === 1 ? "" : "s"} with the threshold bands
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {issues.map((i, k) => (
                <li key={k} className="t-body-sm text-text-hi">
                  <span className="t-overline mr-2 rounded-md border border-danger/40 px-1 text-danger">{i.kind}</span>
                  {i.message}
                </li>
              ))}
            </ul>
          </div>
        ) : dirty ? (
          <div className="border-b border-line bg-info-bg px-3 py-2">
            <p className="t-body-sm text-info">
              Draft preview. Bands are contiguous and every band has at least one step. Nothing is committed until you
              save and confirm.
            </p>
          </div>
        ) : null}

        {/* ---------------------------------------------------- confirmation */}
        {confirming ? (
          <div className="border-b border-line bg-surface-2 px-3 py-3">
            <p className="t-heading-md text-text-hi">Confirm this revision</p>
            <ul className="t-body-sm mt-1 flex list-disc flex-col gap-0.5 pl-4 text-text-mid">
              <li>{built.chains.length} band(s) and {built.steps.length} step(s) become the chain for {meta.label}.</li>
              <li>
                {inFlight.length} request{inFlight.length === 1 ? "" : "s"} of this type {inFlight.length === 1 ? "is" : "are"} in
                flight and will keep the chain {inFlight.length === 1 ? "it" : "they"} resolved to when raised.
              </li>
              <li>Only requests raised after this point use the revision.</li>
              <li>The change is written to the audit log against your name.</li>
            </ul>
            <div className="mt-2 flex gap-2">
              <Btn variant="primary" onClick={save}>Confirm and save</Btn>
              <Btn variant="ghost" onClick={() => setConfirming(false)}>Cancel</Btn>
            </div>
          </div>
        ) : null}

        {/* --------------------------------------------------- visual chain */}
        {draft.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No chain configured for this request type"
            body="Every request of this type would be raised with no approver. Add a band covering the full value range and give it at least one step."
            action={editable ? <Btn variant="primary" onClick={addBand}>Add the first band</Btn> : undefined}
          />
        ) : (
          <ul className="flex flex-col">
            {draft.map((c) => (
              <li key={c.id} className="border-b border-line last:border-0">
                <div className="flex flex-wrap items-end gap-3 bg-surface-2 px-3 py-2">
                  <Field label="Band name" htmlFor={`n-${c.id}`} className="min-w-52 flex-1">
                    <TextInput
                      id={`n-${c.id}`}
                      value={c.name}
                      disabled={!editable}
                      onChange={(e) => updateChain(c.id, { name: e.target.value })}
                    />
                  </Field>
                  {meta.basis !== "NONE" ? (
                    <>
                      <Field label={`From (${meta.basis === "PERCENT" ? "%" : "₹"})`} htmlFor={`min-${c.id}`} className="w-32">
                        <TextInput
                          id={`min-${c.id}`}
                          type="number"
                          value={c.minValue}
                          disabled={!editable}
                          onChange={(e) => updateChain(c.id, { minValue: Number(e.target.value) })}
                        />
                      </Field>
                      <Field
                        label={`Up to (${meta.basis === "PERCENT" ? "%" : "₹"})`}
                        htmlFor={`max-${c.id}`}
                        className="w-36"
                        hint="Blank = unbounded"
                      >
                        <TextInput
                          id={`max-${c.id}`}
                          type="number"
                          value={c.maxValue ?? ""}
                          disabled={!editable}
                          placeholder="unbounded"
                          onChange={(e) => updateChain(c.id, { maxValue: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      </Field>
                    </>
                  ) : null}
                  <div className="flex flex-col gap-0.5">
                    <Overline>Resolves</Overline>
                    <p className="t-body-sm text-text-hi">{bandLabel(c.minValue, c.maxValue, meta.basis)}</p>
                  </div>
                  {editable ? (
                    <div className="ml-auto flex gap-2">
                      <Btn size="sm" onClick={() => addStep(c.id)}><Plus className="size-3" aria-hidden /> Step</Btn>
                      <Btn size="sm" variant="danger" onClick={() => removeBand(c.id)}>
                        <Trash2 className="size-3" aria-hidden /> Band
                      </Btn>
                    </div>
                  ) : null}
                </div>

                {/* Ordered visual sequence */}
                <div className="flex flex-wrap items-stretch gap-2 p-3">
                  {c.steps.map((s, i) => (
                    <React.Fragment key={s.id}>
                      {i > 0 ? (
                        <div className="flex items-center px-1" aria-hidden>
                          <span className="h-px w-6 bg-line-strong" />
                          <Waypoints className="size-3 text-text-lo" />
                        </div>
                      ) : null}
                      <div className="min-w-56 flex-1 rounded-lg border border-line bg-surface-1 shadow-[var(--elev-1)]">
                        <div className="flex items-center justify-between gap-2 border-b border-line px-2 py-1.5">
                          <span className="t-mono grid size-5 place-items-center rounded-full border border-line bg-surface-2 text-[0.6875rem] text-text-mid">
                            {i + 1}
                          </span>
                          <span className="t-overline flex-1 truncate text-text-lo">Step {i + 1}</span>
                          {editable ? (
                            <span className="flex gap-1">
                              <button
                                type="button" aria-label="Move step earlier"
                                onClick={() => moveStep(c.id, s.id, -1)} disabled={i === 0}
                                className="text-text-lo hover:text-text-hi disabled:opacity-30"
                              >
                                <ArrowUp className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button" aria-label="Move step later"
                                onClick={() => moveStep(c.id, s.id, 1)} disabled={i === c.steps.length - 1}
                                className="text-text-lo hover:text-text-hi disabled:opacity-30"
                              >
                                <ArrowDown className="size-3.5" aria-hidden />
                              </button>
                              <button
                                type="button" aria-label="Remove step"
                                onClick={() => removeStep(c.id, s.id)}
                                className="text-text-lo hover:text-danger"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </button>
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2 p-2">
                          <Field label="Approver role" htmlFor={`r-${s.id}`}>
                            <Select
                              id={`r-${s.id}`}
                              value={s.approverRole}
                              disabled={!editable}
                              onChange={(e) => updateStep(c.id, s.id, { approverRole: e.target.value as Role })}
                              options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                            />
                          </Field>
                          <Field label="Escalation timer (hours)" htmlFor={`e-${s.id}`}>
                            <TextInput
                              id={`e-${s.id}`}
                              type="number"
                              min={1}
                              value={s.escalationHours}
                              disabled={!editable}
                              onChange={(e) => updateStep(c.id, s.id, { escalationHours: Math.max(1, Number(e.target.value)) })}
                            />
                          </Field>
                          {meta.basis !== "NONE" ? (
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Step from" htmlFor={`sf-${s.id}`}>
                                <TextInput
                                  id={`sf-${s.id}`} type="number" placeholder="band"
                                  value={s.minValue ?? ""} disabled={!editable}
                                  onChange={(e) => updateStep(c.id, s.id, { minValue: e.target.value === "" ? null : Number(e.target.value) })}
                                />
                              </Field>
                              <Field label="Step to" htmlFor={`st-${s.id}`}>
                                <TextInput
                                  id={`st-${s.id}`} type="number" placeholder="band"
                                  value={s.maxValue ?? ""} disabled={!editable}
                                  onChange={(e) => updateStep(c.id, s.id, { maxValue: e.target.value === "" ? null : Number(e.target.value) })}
                                />
                              </Field>
                            </div>
                          ) : null}
                          <label className="flex items-center gap-2 text-[0.8125rem] text-text-mid">
                            <input
                              type="checkbox"
                              className="size-3.5 accent-[var(--primary-600)]"
                              checked={s.parallel}
                              disabled={!editable}
                              onChange={(e) => updateStep(c.id, s.id, { parallel: e.target.checked })}
                            />
                            Parallel with the previous step
                          </label>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                  {c.steps.length === 0 ? (
                    <p className="t-body-sm px-1 py-2 text-danger">
                      This band has no step. A chain with no step cannot route a request.
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <ResolutionTester api={api} type={type} draft={built} toast={toasts.push} editable={editable} />
        <DelegationPanel api={api} toast={toasts.push} />
      </div>

      {inFlight.length ? (
        <Panel>
          <PanelHeader
            title="In flight on this request type"
            sub="These carry the chain they resolved to when raised. A revision above cannot reach back into them."
          />
          <ul className="flex flex-col">
            {inFlight.map((r) => {
              const chain = api.chains.find((c) => c.id === r.resolvedChainId);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                  <span className="t-mono w-44 shrink-0 text-text-hi">{r.number}</span>
                  <span className="t-body-sm min-w-0 flex-1 truncate text-text-mid">{r.subjectLabel}</span>
                  <span className="t-body-sm w-28 shrink-0 text-right tabular-nums text-text-hi">
                    {r.value > 0 ? abbreviateINR(r.value) : "—"}
                  </span>
                  <span className="t-body-sm w-56 shrink-0 text-text-lo">
                    Resolved to “{chain?.name ?? "chain no longer configured"}”
                  </span>
                  <StatusBadge tone={r.status === "ESCALATED" ? "danger" : "info"}>
                    Step {r.currentStep} of {r.resolvedSteps.length}
                  </StatusBadge>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      <ToastStack items={toasts.items} dismiss={toasts.dismiss} />
    </div>
  );
}

/* ------------------------------------------------------- resolution tester */

function ResolutionTester({
  api, type, draft, toast, editable,
}: {
  api: ReturnType<typeof useWorkflow>;
  type: ApprovalRequestType;
  draft: { chains: T.ApprovalChain[]; steps: T.ApprovalChainStep[] };
  toast: (tone: "ok" | "danger" | "warn" | "info", title: string, body?: string) => void;
  editable: boolean;
}) {
  const meta = REQUEST_TYPE_META[type];
  const [value, setValue] = React.useState<number>(meta.basis === "PERCENT" ? 8 : 250000);
  const [label, setLabel] = React.useState("Test request raised from the chain designer");
  const resolved = resolveChain(draft.chains, draft.steps, type, value);

  function raise() {
    const n = api.requests.filter((r) => r.number.startsWith("BC/APR/2627/")).length + 1;
    const req = raiseRequest({
      id: `APR-W${String(n).padStart(3, "0")}`,
      number: `BC/APR/2627/${String(n).padStart(4, "0")}`,
      type,
      subjectType: type,
      subjectId: `${type}-TEST-${n}`,
      subjectLabel: label.trim() || `${meta.label} — raised from the designer`,
      value,
      requesterUserId: api.snapshot.viewer.userId,
      branchId: api.snapshot.viewer.branchId,
      chains: api.chains,
      steps: api.chainSteps,
      now: api.now,
      context: { raisedFrom: "Chain designer", basis: meta.basis },
    });
    if (!req) {
      toast("danger", "No chain resolved", "Configure a band covering this value before raising the request.");
      return;
    }
    api.actions.audit(
      "CREATE", "ApprovalRequest", req.id, req.number,
      `${meta.label} raised at ${formatBandValue(value, meta.basis)}; resolved to chain ${req.resolvedChainId} with ${req.resolvedSteps.length} step(s), recorded on the request.`,
    );
    window.localStorage.setItem(
      "pravaah.v1.workflow",
      JSON.stringify({
        ...api.overlay,
        seq: api.overlay.seq + 1,
        newRequests: [...api.overlay.newRequests, req],
      }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key: "pravaah.v1.workflow" }));
    toast("ok", `${req.number} raised`, `Resolved to “${api.chains.find((c) => c.id === req.resolvedChainId)?.name}” with ${req.resolvedSteps.length} step(s).`);
  }

  return (
    <Panel>
      <PanelHeader
        title="Chain resolution"
        sub="Selection is by request type and by value against the bands. The resolved ladder is copied onto the request and frozen."
        right={<ShieldCheck className="size-4 text-text-lo" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label={meta.basis === "PERCENT" ? "Discount %" : meta.basis === "MONEY" ? "Request value (₹)" : "Value (not banded)"}
            htmlFor="rt-value"
            className="w-44"
          >
            <TextInput
              id="rt-value" type="number" value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              disabled={meta.basis === "NONE"}
            />
          </Field>
          <Field label="Subject label" htmlFor="rt-label" className="min-w-52 flex-1">
            <TextInput id="rt-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          {editable ? (
            <Btn variant="primary" onClick={raise} disabled={!resolved}>
              <Plus className="size-3.5" aria-hidden /> Raise this request
            </Btn>
          ) : null}
        </div>

        {resolved ? (
          <div className="rounded-md border border-line">
            <SectionTitle right={<span className="t-body-sm text-text-lo">{bandLabel(resolved.chain.minValue, resolved.chain.maxValue, meta.basis)}</span>}>
              Resolves to “{resolved.chain.name}”
            </SectionTitle>
            <ol className="flex flex-col">
              {resolved.resolvedSteps.map((s) => (
                <li key={s.order} className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-0">
                  <span className="t-mono grid size-5 place-items-center rounded-full border border-line bg-surface-2 text-[0.6875rem] text-text-mid">
                    {s.order}
                  </span>
                  <span className="t-body-sm flex-1 text-text-hi">{ROLE_LABEL[s.approverRole]}</span>
                  <span className="t-body-sm text-text-lo">{s.escalationHours} h escalation</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <Note tone="warn">
            No band covers {formatBandValue(value, meta.basis)}. A request at this value would be raised with no
            approver — fix the gap above before saving.
          </Note>
        )}

        <p className="t-body-sm text-text-lo">
          All ten request types are supported: {(Object.keys(REQUEST_TYPE_META) as ApprovalRequestType[])
            .map((t) => REQUEST_TYPE_META[t].label).join(" · ")}.
        </p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- delegation */

function DelegationPanel({
  api, toast,
}: {
  api: ReturnType<typeof useWorkflow>;
  toast: (tone: "ok" | "danger" | "warn" | "info", title: string, body?: string) => void;
}) {
  const { snapshot } = api;
  const approvers = snapshot.users.filter((u) => u.role !== "AUDITOR");
  const [approverUserId, setApproverUserId] = React.useState(snapshot.viewer.userId);
  const [delegateUserId, setDelegateUserId] = React.useState(
    approvers.find((u) => u.id !== snapshot.viewer.userId)?.id ?? snapshot.viewer.userId,
  );
  const today = api.now.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = React.useState(today);
  const [toDate, setToDate] = React.useState(
    new Date(api.now.getTime() + 6 * 86_400_000).toISOString().slice(0, 10),
  );
  const [error, setError] = React.useState<string | null>(null);

  function nominate() {
    if (approverUserId === delegateUserId) {
      setError("An approver cannot delegate to themselves.");
      return;
    }
    if (new Date(toDate) < new Date(fromDate)) {
      setError("The end of the range cannot precede its start.");
      return;
    }
    setError(null);
    const record = api.actions.addDelegation({
      approverUserId,
      delegateUserId,
      fromDate: `${fromDate}T00:00:00.000+05:30`,
      toDate: `${toDate}T23:59:59.000+05:30`,
    });
    const principal = snapshot.users.find((u) => u.id === approverUserId);
    const delegate = snapshot.users.find((u) => u.id === delegateUserId);
    toast(
      "ok",
      "Delegation nominated",
      `${delegate?.name} may act on requests routed to ${principal?.name} between ${formatDate(record.fromDate)} and ${formatDate(record.toDate)}. Their decisions are recorded as delegated.`,
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Delegation"
        sub="A nominated delegate becomes additionally able to act — the original approver keeps their authority."
        right={<UserPlus className="size-4 text-text-lo" aria-hidden />}
      />
      <div className="flex flex-col gap-3 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Approver" htmlFor="dg-approver">
            <Select
              id="dg-approver" value={approverUserId}
              onChange={(e) => setApproverUserId(e.target.value)}
              options={approvers.map((u) => ({ value: u.id, label: `${u.name} — ${ROLE_LABEL[u.role]}` }))}
            />
          </Field>
          <Field label="Delegate" htmlFor="dg-delegate">
            <Select
              id="dg-delegate" value={delegateUserId}
              onChange={(e) => setDelegateUserId(e.target.value)}
              options={approvers.map((u) => ({ value: u.id, label: `${u.name} — ${ROLE_LABEL[u.role]}` }))}
            />
          </Field>
          <Field label="From" htmlFor="dg-from">
            <TextInput id="dg-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="dg-to" error={error}>
            <TextInput id="dg-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </Field>
        </div>
        <div>
          <Btn variant="primary" onClick={nominate}>
            <CalendarRange className="size-3.5" aria-hidden /> Nominate delegate
          </Btn>
        </div>

        {api.delegations.length ? (
          <div className="rounded-md border border-line">
            <SectionTitle>Active and scheduled delegations</SectionTitle>
            <ul className="flex flex-col">
              {api.delegations.map((d) => {
                const principal = snapshot.users.find((u) => u.id === d.approverUserId);
                const delegate = snapshot.users.find((u) => u.id === d.delegateUserId);
                const live = new Date(d.fromDate) <= api.now && new Date(d.toDate) >= api.now;
                const routed = [...api.evaluations.values()].filter(
                  (e) => !e.terminal && principal && e.actionableRoles.includes(principal.role),
                ).length;
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                    <span className="t-body-sm min-w-0 flex-1 text-text-hi">
                      {principal?.name ?? d.approverUserId} → {delegate?.name ?? d.delegateUserId}
                    </span>
                    <span className="t-body-sm text-text-lo">
                      {formatDate(d.fromDate)} – {formatDate(d.toDate)}
                    </span>
                    <StatusBadge tone={live ? "ok" : "neutral"}>{live ? "Active" : "Scheduled"}</StatusBadge>
                    <span className="t-body-sm text-text-mid">
                      {formatCount(routed)} open request{routed === 1 ? "" : "s"} routed to {principal?.role ? ROLE_LABEL[principal.role] : "this role"}
                    </span>
                    <Btn size="sm" variant="ghost" onClick={() => api.actions.removeDelegation(d.id)}>
                      <Trash2 className="size-3" aria-hidden /> Withdraw
                    </Btn>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <Note tone="neutral">
            No delegation is in force. The seeded world starts with none, so any delegation shown here was nominated
            in this session and is held in <span className="t-mono">pravaah.v1.workflow</span>.
          </Note>
        )}

        <p className="t-body-sm text-text-lo">
          Delegated decisions are stamped with the principal on the decision record and appear in the audit log with
          the word <em>delegated</em>, so the trail never loses who actually acted.
          {" "}Median approval turnaround today: {formatPercent(0) === "0%" ? "" : ""}
          <span className="t-mono">{api.medianTurnaroundHours.toFixed(1)} h</span>.
        </p>
      </div>
    </Panel>
  );
}
