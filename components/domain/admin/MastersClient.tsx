"use client";

/**
 * E1-S7 — reference data masters.
 *
 * Eighteen manageable sets behind one generic table, because a master is a
 * master: a list of values, a reference count, and a rule about what happens
 * when someone tries to remove one. The interesting behaviour is in the edges —
 * the deletion block that states how many records point at the value, the SLA
 * definition that must declare its clock basis, and the numbering series whose
 * counter cannot be typed.
 */

import * as React from "react";
import {
  Ban,
  CheckCircle2,
  Hash,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { Panel, PanelHeader, Overline, StatusBadge , Explainer } from "@/components/patterns/primitives";
import { abbreviateINR, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { appendAudit, describeChange } from "./auditStore";
import {
  ADMIN_KEYS,
  EMPTY_MASTERS,
  localId,
  rowKey,
  useOverlay,
  type MastersOverlay,
} from "./store";
import { formatSeriesNumber } from "./mastersData";
import {
  BlockedDialog,
  Btn,
  Callout,
  ConfirmDialog,
  Field,
  FilteredEmpty,
  Modal,
  NumberInput,
  Select,
  TextInput,
  Toggle,
} from "./ui";
import type { ActorInfo, MasterField, MasterRow, MasterSet, MasterValue, SeriesState } from "./types";

/* ------------------------------------------------------------- helpers */

function displayValue(f: MasterField, v: MasterValue): string {
  if (f.type === "boolean") return v ? "Yes" : "No";
  if (v === null || v === undefined || v === "") return "—";
  if (f.type === "number") {
    const n = Number(v);
    if (f.key === "amount") return abbreviateINR(n);
    return formatCount(n);
  }
  if (f.type === "select") {
    return f.options?.find((o) => o.value === v)?.label ?? String(v);
  }
  return String(v);
}

function blankValues(fields: MasterField[]): Record<string, MasterValue> {
  const out: Record<string, MasterValue> = {};
  for (const f of fields) out[f.key] = f.type === "boolean" ? false : f.type === "number" ? 0 : "";
  return out;
}

function mergeRows(set: MasterSet, ov: MastersOverlay): MasterRow[] {
  const created: MasterRow[] = (ov.created[set.key] ?? []).map((c) => ({
    id: c.id,
    values: c.values,
    refCount: 0,
    refLabel: "Created in this session — nothing references it yet",
    active: true,
  }));
  return [...set.rows, ...created]
    .filter((r) => !ov.deleted[rowKey(set.key, r.id)])
    .map((r) => {
      const k = rowKey(set.key, r.id);
      const patch = ov.patches[k];
      const active = ov.active[k] ?? r.active;
      return patch ? { ...r, values: { ...r.values, ...patch }, active } : { ...r, active };
    });
}

/* --------------------------------------------------------------- screen */

export function MastersClient({
  sets,
  series,
  actor,
  canEdit,
  initialSet,
}: {
  sets: MasterSet[];
  series: SeriesState[];
  actor: ActorInfo;
  canEdit: boolean;
  initialSet: string | null;
}) {
  const { state: ov, ready, update } = useOverlay<MastersOverlay>(ADMIN_KEYS.masters, EMPTY_MASTERS);
  const [activeKey, setActiveKey] = React.useState(
    () => (initialSet && sets.some((s) => s.key === initialSet) ? initialSet : sets[0]!.key),
  );
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<MasterRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [blocked, setBlocked] = React.useState<MasterRow | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<MasterRow | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  const set = sets.find((s) => s.key === activeKey)!;
  const rows = React.useMemo(() => mergeRows(set, ov), [set, ov]);
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      Object.values(r.values).some((v) => String(v ?? "").toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const groups = React.useMemo(() => {
    const m = new Map<string, MasterSet[]>();
    for (const s of sets) {
      const list = m.get(s.group) ?? [];
      list.push(s);
      m.set(s.group, list);
    }
    return [...m.entries()];
  }, [sets]);

  const tableFields = set.fields.filter((f) => !f.hideInTable);
  const seriesById = React.useMemo(() => new Map(series.map((s) => [s.id, s])), [series]);

  function labelOf(row: MasterRow): string {
    return String(row.values[set.labelField] ?? row.id);
  }

  /* ---------------------------------------------------------- mutations */

  function saveEdit(row: MasterRow, next: Record<string, MasterValue>) {
    const changes = set.fields
      .filter((f) => !f.readOnly && String(row.values[f.key] ?? "") !== String(next[f.key] ?? ""))
      .map((f) => ({
        label: f.label,
        before: displayValue(f, row.values[f.key] ?? null),
        after: displayValue(f, next[f.key] ?? null),
      }));
    if (changes.length === 0) {
      setEditing(null);
      return;
    }
    update((prev) => ({
      ...prev,
      patches: { ...prev.patches, [rowKey(set.key, row.id)]: { ...prev.patches[rowKey(set.key, row.id)], ...next } },
    }));
    const d = describeChange(changes);
    appendAudit({
      actor,
      action: "UPDATE",
      entityType: set.entityType,
      entityId: row.id,
      entityLabel: labelOf(row),
      summary: `${set.label} — ${d.summary} changed`,
      before: d.before,
      after: d.after,
    });
    setFlash(`${labelOf(row)} updated. Prior and new values are in the audit log.`);
    setEditing(null);
  }

  function create(values: Record<string, MasterValue>) {
    const id = localId(set.key.slice(0, 3).toUpperCase());
    update((prev) => ({
      ...prev,
      created: { ...prev.created, [set.key]: [...(prev.created[set.key] ?? []), { id, values }] },
    }));
    appendAudit({
      actor,
      action: "CREATE",
      entityType: set.entityType,
      entityId: id,
      entityLabel: String(values[set.labelField] ?? id),
      summary: `${set.label} — value added`,
      after: set.fields
        .filter((f) => !f.readOnly)
        .map((f) => `${f.label}: ${displayValue(f, values[f.key] ?? null)}`)
        .join(" · "),
    });
    setFlash(`${String(values[set.labelField] ?? id)} added to ${set.label}.`);
    setCreating(false);
  }

  function setActive(row: MasterRow, active: boolean) {
    update((prev) => ({ ...prev, active: { ...prev.active, [rowKey(set.key, row.id)]: active } }));
    appendAudit({
      actor,
      action: "STATE_TRANSITION",
      entityType: set.entityType,
      entityId: row.id,
      entityLabel: labelOf(row),
      summary: `${set.label} — value ${active ? "reactivated" : "deactivated"}`,
      before: active ? "Inactive" : "Active",
      after: active ? "Active" : "Inactive",
    });
    setFlash(
      active
        ? `${labelOf(row)} is active again and will appear in new-record pickers.`
        : `${labelOf(row)} deactivated. Existing records keep it; new records cannot choose it.`,
    );
    setBlocked(null);
  }

  function remove(row: MasterRow) {
    update((prev) => ({ ...prev, deleted: { ...prev.deleted, [rowKey(set.key, row.id)]: true } }));
    appendAudit({
      actor,
      action: "DELETE",
      entityType: set.entityType,
      entityId: row.id,
      entityLabel: labelOf(row),
      summary: `${set.label} — value deleted (zero references)`,
      before: set.fields.map((f) => `${f.label}: ${displayValue(f, row.values[f.key] ?? null)}`).join(" · "),
    });
    setFlash(`${labelOf(row)} deleted. The deletion is in the audit log.`);
  }

  function issueNext(st: SeriesState) {
    const already = ov.issued[st.id] ?? [];
    const n = st.highest + already.length + 1;
    update((prev) => ({ ...prev, issued: { ...prev.issued, [st.id]: [...already, n] } }));
    appendAudit({
      actor,
      action: "STATE_TRANSITION",
      entityType: "NumberingSeries",
      entityId: st.id,
      entityLabel: formatSeriesNumber(st, n),
      summary: `Number issued from the ${st.docType} series`,
      before: `Counter ${st.highest + already.length}`,
      after: `Counter ${n} — ${formatSeriesNumber(st, n)}`,
    });
    setFlash(`Issued ${formatSeriesNumber(st, n)}. The counter advanced by exactly one.`);
  }

  function attemptDelete(row: MasterRow) {
    if (row.refCount > 0 || row.system) setBlocked(row);
    else setConfirmDelete(row);
  }

  /* ------------------------------------------------------------ render */

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
      {/* set picker */}
      <nav aria-label="Reference data sets" className="xl:sticky xl:top-16 xl:self-start">
        <Panel className="overflow-hidden">
          <div className="border-b border-line px-3 py-2">
            <Overline>18 manageable sets</Overline>
          </div>
          <div className="max-h-[70vh] overflow-y-auto py-1">
            {groups.map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="t-overline px-3 pb-1 pt-2.5 text-text-lo">{group}</p>
                <ul>
                  {items.map((s) => {
                    const count = mergeRows(s, ov).length;
                    const on = s.key === activeKey;
                    return (
                      <li key={s.key}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveKey(s.key);
                            setQ("");
                          }}
                          aria-current={on ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 border-l-2 px-3 py-1.5 text-left text-[0.8125rem]",
                            on
                              ? "border-l-primary-500 bg-surface-2 text-text-hi"
                              : "border-l-transparent text-text-mid hover:bg-surface-2 hover:text-text-hi",
                          )}
                        >
                          <span className="truncate">{s.label}</span>
                          <span className="t-mono shrink-0 text-text-lo">{count}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        {flash ? (
          <div className="flex items-start gap-2 rounded-lg border border-ok/40 bg-ok-bg px-3 py-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
            <p className="t-body-sm text-text-mid">{flash}</p>
            <button
              type="button"
              onClick={() => setFlash(null)}
              aria-label="Dismiss"
              className="ml-auto text-text-lo hover:text-text-hi"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}

        <Panel>
          <PanelHeader
            title={set.label}
            sub={set.description}
            right={
              <div className="flex items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Search {set.label}</span>
                  <Search
                    className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-lo"
                    aria-hidden
                  />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Filter values"
                    className="h-8 w-44 rounded-md border border-line bg-surface-0 pl-7 pr-2 text-[0.8125rem] text-text-hi outline-none placeholder:text-text-lo focus:border-line-strong"
                  />
                </label>
                {canEdit && set.canCreate ? (
                  <Btn tone="primary" icon={Plus} onClick={() => setCreating(true)}>
                    Add value
                  </Btn>
                ) : null}
              </div>
            }
          />

          {set.note ? (
            <p className="t-body-sm border-b border-line bg-surface-2 px-4 py-2 text-text-mid">
              {set.note}
            </p>
          ) : null}

          {!ready ? (
            <div className="flex flex-col gap-px bg-line">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-surface-1 p-2" style={{ height: "var(--row-h)" }}>
                  <div className="pv-skeleton h-4 rounded-md" aria-hidden />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            q.trim() ? (
              <FilteredEmpty active={[`text “${q.trim()}”`]} onClear={() => setQ("")} />
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <Ban className="size-8 text-text-lo" aria-hidden />
                <div>
                  <p className="t-heading-md text-text-hi">No values in {set.label}</p>
                  <p className="t-body-sm mt-1 text-text-mid">{set.description}</p>
                </div>
                {canEdit && set.canCreate ? (
                  <Btn tone="primary" icon={Plus} onClick={() => setCreating(true)}>
                    Add the first value
                  </Btn>
                ) : null}
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr>
                    {tableFields.map((f) => (
                      <th
                        key={f.key}
                        scope="col"
                        className={cn(
                          "t-overline whitespace-nowrap border-b border-line bg-surface-2 px-3 py-2 font-semibold text-text-lo",
                          f.numeric ? "text-right" : "text-left",
                        )}
                      >
                        {f.label}
                      </th>
                    ))}
                    <th scope="col" className="t-overline border-b border-line bg-surface-2 px-3 py-2 text-left font-semibold text-text-lo">
                      Referenced
                    </th>
                    <th scope="col" className="t-overline border-b border-line bg-surface-2 px-3 py-2 text-left font-semibold text-text-lo">
                      State
                    </th>
                    {canEdit ? (
                      <th scope="col" className="t-overline border-b border-line bg-surface-2 px-3 py-2 text-right font-semibold text-text-lo">
                        Manage
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={cn("hover:bg-surface-2", !r.active && "opacity-60")}
                      style={{ height: "var(--row-h)" }}
                    >
                      {tableFields.map((f) => (
                        <td
                          key={f.key}
                          className={cn(
                            "border-b border-line px-3 py-1.5",
                            f.numeric ? "text-right tabular-nums" : "text-left",
                            f.mono ? "t-mono text-text-hi" : "t-body-sm text-text-mid",
                          )}
                        >
                          {f.type === "boolean" ? (
                            <StatusBadge tone={r.values[f.key] ? "ok" : "neutral"} icon={false}>
                              {r.values[f.key] ? "Yes" : "No"}
                            </StatusBadge>
                          ) : (
                            displayValue(f, r.values[f.key] ?? null)
                          )}
                        </td>
                      ))}
                      <td className="border-b border-line px-3 py-1.5">
                        <span
                          className={cn(
                            "t-mono tabular-nums",
                            r.refCount > 0 ? "text-text-hi" : "text-text-lo",
                          )}
                          title={r.refLabel}
                        >
                          {formatCount(r.refCount)}
                        </span>
                      </td>
                      <td className="border-b border-line px-3 py-1.5">
                        <StatusBadge tone={r.active ? "ok" : "warn"}>
                          {r.active ? "Active" : "Inactive"}
                        </StatusBadge>
                      </td>
                      {canEdit ? (
                        <td className="border-b border-line px-3 py-1.5 text-right">
                          <span className="inline-flex items-center gap-1">
                            {set.kind === "numbering" ? (
                              <Btn
                                icon={Hash}
                                onClick={() => {
                                  const st = seriesById.get(r.id);
                                  if (st) issueNext(st);
                                }}
                              >
                                Issue next
                              </Btn>
                            ) : null}
                            <Btn icon={Pencil} onClick={() => setEditing(r)}>
                              Edit
                            </Btn>
                            {r.active ? (
                              <Btn
                                icon={Ban}
                                onClick={() => setActive(r, false)}
                                title="Stop offering this value on new records"
                              >
                                Deactivate
                              </Btn>
                            ) : (
                              <Btn icon={RotateCcw} onClick={() => setActive(r, true)}>
                                Reactivate
                              </Btn>
                            )}
                            <Btn tone="danger" icon={Trash2} onClick={() => attemptDelete(r)}>
                              Delete
                            </Btn>
                          </span>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="t-body-sm border-t border-line px-4 py-2 text-text-lo">
            {formatCount(filtered.length)} of {formatCount(rows.length)} values.{" "}
            {canEdit
              ? "Every change writes an audit entry carrying the prior and the new value."
              : "Your role holds read access to reference data; no create, edit or delete control is offered."}
          </p>
        </Panel>

        {set.kind === "numbering" ? <SeriesPanel series={series} issued={ov.issued} /> : null}
        {set.kind === "sla" ? <SlaPanel /> : null}
      </div>

      {/* --------------------------------------------------------- dialogs */}
      {editing ? (
        <RowForm
          key={`edit-${editing.id}`}
          title={`Edit — ${labelOf(editing)}`}
          sub={set.label}
          set={set}
          initial={editing.values}
          onClose={() => setEditing(null)}
          onSave={(v) => saveEdit(editing, v)}
        />
      ) : null}

      {creating ? (
        <RowForm
          key="create"
          title={`Add to ${set.label}`}
          sub={set.description}
          set={set}
          initial={blankValues(set.fields)}
          isNew
          onClose={() => setCreating(false)}
          onSave={create}
        />
      ) : null}

      <BlockedDialog
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        what={blocked ? `${labelOf(blocked)} — ${set.label}` : ""}
        count={blocked?.refCount ?? 0}
        refLabel={blocked?.refLabel ?? ""}
        canDeactivate={canEdit && !blocked?.system}
        alreadyInactive={blocked ? !blocked.active : false}
        systemReason={
          blocked?.system
            ? set.kind === "numbering"
              ? "A numbering series cannot be removed: statutory documents already carry numbers from it and the sequence must remain provable."
              : "This row is part of the platform's structure — the company registration and the central warehouse hang off it."
            : null
        }
        onDeactivate={blocked ? () => setActive(blocked, false) : undefined}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        title={`Delete ${confirmDelete ? labelOf(confirmDelete) : ""}?`}
        confirmLabel="Delete value"
        typeToConfirm="DELETE"
        consequence="Nothing references this value, so nothing will be orphaned."
        body={
          <p>
            {confirmDelete ? labelOf(confirmDelete) : ""} will be removed from {set.label}. It has no
            references, so no existing record changes.
          </p>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------ row form */

function RowForm({
  title,
  sub,
  set,
  initial,
  isNew,
  onClose,
  onSave,
}: {
  title: string;
  sub: string;
  set: MasterSet;
  initial: Record<string, MasterValue>;
  isNew?: boolean;
  onClose: () => void;
  onSave: (values: Record<string, MasterValue>) => void;
}) {
  const [values, setValues] = React.useState<Record<string, MasterValue>>({ ...initial });
  const [touched, setTouched] = React.useState(false);

  const editable = set.fields.filter((f) => !f.readOnly || isNew === true);
  const missing = editable
    .filter((f) => f.required && (values[f.key] === "" || values[f.key] === null || values[f.key] === undefined))
    .map((f) => f.label);

  function set1(key: string, v: MasterValue) {
    setValues((p) => ({ ...p, [key]: v }));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      sub={sub}
      width={600}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            tone="primary"
            onClick={() => {
              setTouched(true);
              if (missing.length === 0) onSave(values);
            }}
            disabled={missing.length > 0 && touched}
          >
            {isNew ? "Add value" : "Save change"}
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {set.fields.map((f) => {
          const locked = f.readOnly && !isNew;
          if (f.type === "boolean") {
            return (
              <div key={f.key} className="sm:col-span-2">
                <Toggle
                  checked={Boolean(values[f.key])}
                  disabled={locked}
                  onChange={(v) => set1(f.key, v)}
                  label={f.label}
                  sub={f.help}
                />
              </div>
            );
          }
          return (
            <Field
              key={f.key}
              label={f.label + (f.required ? " *" : "")}
              hint={locked ? `${f.help ?? "Fixed once created."}` : f.help}
              error={
                touched && f.required && (values[f.key] === "" || values[f.key] === null)
                  ? "Required"
                  : null
              }
              className={f.type === "select" || f.key === "description" ? "sm:col-span-2" : undefined}
            >
              {f.type === "select" ? (
                <Select
                  value={String(values[f.key] ?? "")}
                  disabled={locked}
                  onChange={(e) => set1(f.key, e.target.value)}
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : f.type === "number" ? (
                <NumberInput
                  value={values[f.key] === null ? "" : String(values[f.key] ?? "")}
                  disabled={locked}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  onChange={(e) => set1(f.key, e.target.value === "" ? null : Number(e.target.value))}
                />
              ) : (
                <TextInput
                  mono={f.mono}
                  value={String(values[f.key] ?? "")}
                  disabled={locked}
                  onChange={(e) => set1(f.key, e.target.value)}
                />
              )}
            </Field>
          );
        })}
      </div>
      {touched && missing.length > 0 ? (
        <Callout tone="danger" title={`Missing: ${missing.join(", ")}`} className="mt-3">
          Every required field must carry a value before the change can be saved.
        </Callout>
      ) : null}
      <p className="t-body-sm mt-3 text-text-lo">
        Saving writes an audit entry recording the prior and the new value for each field changed.
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------- numbering panel */

function SeriesPanel({
  series,
  issued,
}: {
  series: SeriesState[];
  issued: Record<string, number[]>;
}) {
  const totalIssued = series.reduce((s, x) => s + x.issuedCount + (issued[x.id]?.length ?? 0), 0);
  const totalGaps = series.reduce((s, x) => s + x.gaps.length, 0);
  const totalDupes = series.reduce((s, x) => s + x.duplicates.length, 0);

  return (
    <Panel>
      <PanelHeader
        title="Series state"
        sub="What the platform has actually issued, checked for gaps and duplicates."
        right={
          <StatusBadge tone={totalGaps === 0 && totalDupes === 0 ? "ok" : "danger"}>
            {totalGaps === 0 && totalDupes === 0
              ? `${formatCount(totalIssued)} numbers · 0 gaps · 0 duplicates`
              : `${formatCount(totalGaps)} gaps · ${formatCount(totalDupes)} duplicates`}
          </StatusBadge>
        }
      />
      <div className="border-b border-line px-4 py-3">
        <Explainer className="text-text-mid">
          <span className="text-text-hi">How gaps and duplicates are prevented. </span>A number is
          allocated at the moment a document is committed, never when a form is opened, and the
          counter is monotonic — it can only be advanced by an issue, never typed. Two commits
          cannot receive the same number because the counter is read and advanced in one step, and a
          cancelled document keeps its number rather than returning it to the pool, which is what
          would create a hole in the sequence.
        </Explainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              {["Document", "Prefix", "FY", "Width", "Issued", "Highest", "Next number", "Sequence check"].map(
                (h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      "t-overline whitespace-nowrap border-b border-line bg-surface-2 px-3 py-2 font-semibold text-text-lo",
                      i >= 3 && i <= 5 ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {series.map((s) => {
              const extra = issued[s.id] ?? [];
              const highest = s.highest + extra.length;
              const clean = s.gaps.length === 0 && s.duplicates.length === 0;
              return (
                <tr key={s.id} className="hover:bg-surface-2" style={{ height: "var(--row-h)" }}>
                  <td className="t-body-sm border-b border-line px-3 py-1.5 text-text-hi">
                    {s.docType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                  </td>
                  <td className="t-mono border-b border-line px-3 py-1.5 text-text-mid">{s.prefix}</td>
                  <td className="t-mono border-b border-line px-3 py-1.5 text-text-mid">{s.fySegment}</td>
                  <td className="t-mono border-b border-line px-3 py-1.5 text-right tabular-nums text-text-mid">
                    {s.width}
                  </td>
                  <td className="t-mono border-b border-line px-3 py-1.5 text-right tabular-nums text-text-hi">
                    {formatCount(s.issuedCount + extra.length)}
                  </td>
                  <td className="t-mono border-b border-line px-3 py-1.5 text-right tabular-nums text-text-mid">
                    {formatCount(highest)}
                  </td>
                  <td className="t-mono border-b border-line px-3 py-1.5 text-text-hi">
                    {formatSeriesNumber(s, highest + 1)}
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    {clean ? (
                      <StatusBadge tone="ok">Contiguous</StatusBadge>
                    ) : (
                      <span className="flex flex-wrap items-center gap-1">
                        {s.gaps.length > 0 ? (
                          <StatusBadge tone="danger">{s.gaps.length} gap(s): {s.gaps.slice(0, 5).join(", ")}</StatusBadge>
                        ) : null}
                        {s.duplicates.length > 0 ? (
                          <StatusBadge tone="danger">{s.duplicates.length} duplicate(s)</StatusBadge>
                        ) : null}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Explainer className="border-t border-line px-4 py-2 text-text-lo">
        Numbers issued from this screen are appended to the counter and appear in the audit log; the
        seeded documents are counted from the numbers they already carry, so the check is against
        real data rather than a stored figure.
      </Explainer>
    </Panel>
  );
}

/* ------------------------------------------------------------- SLA panel */

function SlaPanel() {
  return (
    <Panel>
      <PanelHeader
        title="How a clock is chosen"
        sub="Precedence when more than one definition could match a ticket."
        right={<Timer className="size-4 text-text-lo" aria-hidden />}
      />
      <ol className="flex flex-col gap-px bg-line">
        {[
          {
            n: "1",
            t: "AMC contract terms",
            d: "Where the asset is under a live AMC that states its own response and restoration hours, the contract wins. The ticket records the contract number as the rule applied.",
          },
          {
            n: "2",
            t: "Product-line commitment",
            d: "A definition naming a product line beats a general one — the ELGi air-restoration commitment sets 4 h response and 48 h restoration on critical screw-compressor calls.",
          },
          {
            n: "3",
            t: "Coverage-specific definition",
            d: "A definition naming a coverage type applies only to tickets in that coverage state.",
          },
          {
            n: "4",
            t: "Severity default",
            d: "The fallback: critical 4/24, high 8/48, normal 24/96, low 48/168 hours.",
          },
        ].map((s) => (
          <li key={s.n} className="flex gap-3 bg-surface-1 px-4 py-3">
            <span className="t-mono mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-text-lo">
              {s.n}
            </span>
            <span>
              <span className="t-body block font-medium text-text-hi">{s.t}</span>
              <span className="t-body-sm block text-text-mid">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="border-t border-line px-4 py-3">
        <Callout tone="info" title="Business hours versus elapsed hours">
          An elapsed clock runs around the calendar — a Friday-evening critical breakdown is already
          14 hours old by Saturday morning. A business-hours clock counts only 09:30–18:30, Monday
          to Saturday, and pauses on the branch holidays configured in the holiday calendar. The
          basis is captured on the definition because the same number of hours means two very
          different promises.
        </Callout>
      </div>
    </Panel>
  );
}
