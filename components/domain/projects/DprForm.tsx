"use client";

import { useMemo, useState } from "react";
import { Camera, Minus, Plus, Send, Users } from "lucide-react";
import { Overline } from "@/components/patterns/primitives";
import { formatINR, formatQty } from "@/lib/format";
import { HINDRANCE_CAUSE_LABEL } from "./labels";
import { DPR_PLANT, DPR_TRADES, DPR_WEATHER } from "./constants";
import { computeBoqLine, type BoqLineSeed } from "./compute";
import {
  addDPR, recordVariation, useProjectsOverlay, type HindranceCause, type OverlayDPR,
} from "./store";
import {
  BlockedNotice, Btn, Field, NumberInput, Select, TextArea, TextInput, WarnNotice,
} from "./ui";

interface ExecRow { boqLineId: string; qty: string }

/**
 * E6-S3 — the daily progress report. Everything the acceptance criteria list is
 * captured: date, weather, manpower by trade with counts, plant and machinery,
 * work executed against specific BOQ lines with quantities, materials received,
 * site instructions, hindrances with a cause category, safety observations and
 * photographs. Submission is one-way: the record becomes immutable.
 */
export function DprForm({
  projectId, projectCode, lines, today, actor, dprCount,
  supersedes, onDone,
}: {
  projectId: string;
  projectCode: string;
  lines: BoqLineSeed[];
  today: string;
  actor: { id: string; name: string };
  dprCount: number;
  supersedes?: {
    id: string; number: string; fromSeed: boolean;
    execution: { boqLineId: string; qty: number }[];
    date: string;
  } | null;
  onDone: () => void;
}) {
  const overlay = useProjectsOverlay();
  const [date, setDate] = useState((supersedes?.date ?? today).slice(0, 10));
  const [weather, setWeather] = useState<string>(DPR_WEATHER[0]);
  const [manpower, setManpower] = useState<{ trade: string; count: string }[]>([
    { trade: "Mason", count: "6" }, { trade: "Helper", count: "10" },
  ]);
  const [plant, setPlant] = useState<{ name: string; count: string }[]>([{ name: "Concrete mixer", count: "1" }]);
  const [exec, setExec] = useState<ExecRow[]>(
    supersedes
      ? supersedes.execution.map((e) => ({ boqLineId: e.boqLineId, qty: String(e.qty) }))
      : [{ boqLineId: lines[0]?.id ?? "", qty: "" }],
  );
  const [materials, setMaterials] = useState("");
  const [instructions, setInstructions] = useState("");
  const [hindranceCause, setHindranceCause] = useState<"" | HindranceCause>("");
  const [hindrance, setHindrance] = useState("");
  const [safety, setSafety] = useState("Toolbox talk conducted; PPE compliance checked.");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoCaption, setPhotoCaption] = useState("");
  const [supersedeReason, setSupersedeReason] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [variationFor, setVariationFor] = useState<string | null>(null);

  const computed = useMemo(() => lines.map((l) => computeBoqLine(l, overlay)), [lines, overlay]);
  const byId = useMemo(() => new Map(computed.map((l) => [l.id, l])), [computed]);

  /* E6-S2 — an entry that would take cumulative executed beyond the contracted
     quantity is refused until an approved variation is on record. */
  const excess = exec
    .map((row) => {
      const line = byId.get(row.boqLineId);
      const qty = Number(row.qty);
      if (!line || !qty) return null;
      const alreadyInThisEntry = supersedes?.execution.find((e) => e.boqLineId === row.boqLineId)?.qty ?? 0;
      const projected = line.executedQty - alreadyInThisEntry + qty;
      if (projected <= line.effectiveQty + 0.0001) return null;
      return { line, qty, projected, over: projected - line.effectiveQty };
    })
    .filter(Boolean) as { line: ReturnType<typeof computeBoqLine>; qty: number; projected: number; over: number }[];

  const manpowerTotal = manpower.reduce((s, m) => s + (Number(m.count) || 0), 0);

  function validate(): string[] {
    const e: string[] = [];
    if (!date) e.push("A date is required — the entry is the dated evidence for the quantities it carries.");
    if (new Date(date) > new Date(today)) e.push("A progress entry cannot be dated in the future.");
    if (!manpowerTotal) e.push("Record the manpower deployed, by trade. A day with no labour still needs the reason stated under hindrances.");
    const rows = exec.filter((r) => r.boqLineId && Number(r.qty) > 0);
    if (!rows.length) e.push("Record at least one BOQ line with the quantity executed today.");
    if (!safety.trim()) e.push("Safety observations are required, even where the entry is ‘nil reportable’.");
    if (hindranceCause && !hindrance.trim()) e.push("A hindrance cause needs the hindrance described.");
    if (supersedes && !supersedeReason.trim()) {
      e.push("A superseding entry must state why the original was wrong. Both records are retained and linked.");
    }
    if (excess.length) {
      e.push(`${excess.length} line${excess.length === 1 ? "" : "s"} would exceed the contracted quantity — record the approved variation first.`);
    }
    return e;
  }

  function submit() {
    const e = validate();
    setErrors(e);
    if (e.length) return;
    const rows = exec.filter((r) => r.boqLineId && Number(r.qty) > 0);
    const record: OverlayDPR = {
      id: `DPR-L-${Date.now().toString(36).toUpperCase()}`,
      number: `DPR/${projectCode.split("/").pop()}/${String(dprCount + 1).padStart(3, "0")}${supersedes ? "-R" : ""}`,
      projectId,
      date: new Date(date).toISOString(),
      weather,
      manpower: manpower.filter((m) => Number(m.count) > 0).map((m) => ({ trade: m.trade, count: Number(m.count) })),
      plant: plant.filter((p) => Number(p.count) > 0).map((p) => ({ name: p.name, count: Number(p.count) })),
      execution: rows.map((r) => ({ boqLineId: r.boqLineId, qty: Number(r.qty) })),
      materialsReceived: materials.trim() || "Nil",
      siteInstructions: instructions.trim() || "Nil",
      hindrance: hindranceCause ? hindrance.trim() : null,
      hindranceCause: hindranceCause || null,
      safetyObservations: safety.trim(),
      photos: photos.map((caption) => ({ caption, tone: "slate" })),
      byUserId: actor.id,
      byUserName: actor.name,
      supersedesId: supersedes?.id ?? null,
      supersedesNumber: supersedes?.number ?? null,
      supersedeReason: supersedes ? supersedeReason.trim() : null,
      replacesSeedExecution: supersedes?.fromSeed ? supersedes.execution : [],
      submittedAt: new Date().toISOString(),
    };
    addDPR(record, actor);
    onDone();
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {supersedes ? (
        <WarnNotice
          title={`Superseding ${supersedes.number}`}
          body="The original entry stays on the log, marked superseded and linked to this correction. Neither can be deleted."
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Date" required>
          <TextInput type="date" value={date} max={today.slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Weather">
          <Select value={weather} onChange={(e) => setWeather(e.target.value)}>
            {DPR_WEATHER.map((w) => <option key={w} value={w}>{w}</option>)}
          </Select>
        </Field>
        <Field label="Filed by">
          <TextInput value={actor.name} readOnly disabled />
        </Field>
        {supersedes ? (
          <Field label="Reason for supersession" required>
            <TextInput
              value={supersedeReason}
              onChange={(e) => setSupersedeReason(e.target.value)}
              placeholder="Quantity mis-measured against RCC line"
            />
          </Field>
        ) : (
          <Field label="Entry number">
            <TextInput value={`DPR/${projectCode.split("/").pop()}/${String(dprCount + 1).padStart(3, "0")}`} readOnly disabled />
          </Field>
        )}
      </div>

      {/* ------------------------------------------------------- manpower */}
      <div className="rounded-md border border-line">
        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-3 py-1.5">
          <span className="t-label flex items-center gap-1.5 text-text-hi">
            <Users className="size-3.5" aria-hidden /> Manpower by trade
          </span>
          <span className="t-body-sm tabular-nums text-text-mid" style={{ fontVariantNumeric: "tabular-nums" }}>
            {manpowerTotal} on site
          </span>
        </div>
        <div className="flex flex-col gap-2 p-3">
          {manpower.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={m.trade}
                onChange={(e) => setManpower((p) => p.map((x, j) => (j === i ? { ...x, trade: e.target.value } : x)))}
                className="w-44"
              >
                {DPR_TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <NumberInput
                value={m.count}
                min={0}
                onChange={(e) => setManpower((p) => p.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))}
                className="w-24"
                aria-label={`${m.trade} count`}
              />
              <Btn variant="ghost" onClick={() => setManpower((p) => p.filter((_, j) => j !== i))} aria-label={`Remove ${m.trade}`}>
                <Minus className="size-3.5" aria-hidden />
              </Btn>
            </div>
          ))}
          <Btn onClick={() => setManpower((p) => [...p, { trade: "Fitter", count: "1" }])} className="self-start">
            <Plus className="size-3.5" aria-hidden /> Add trade
          </Btn>
        </div>
      </div>

      {/* ---------------------------------------------------------- plant */}
      <div className="rounded-md border border-line">
        <div className="border-b border-line bg-surface-2 px-3 py-1.5">
          <span className="t-label text-text-hi">Plant and machinery deployed</span>
        </div>
        <div className="flex flex-col gap-2 p-3">
          {plant.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={p.name}
                onChange={(e) => setPlant((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="w-52"
              >
                {DPR_PLANT.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <NumberInput
                value={p.count}
                min={0}
                onChange={(e) => setPlant((prev) => prev.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))}
                className="w-24"
                aria-label={`${p.name} count`}
              />
              <Btn variant="ghost" onClick={() => setPlant((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove ${p.name}`}>
                <Minus className="size-3.5" aria-hidden />
              </Btn>
            </div>
          ))}
          <Btn onClick={() => setPlant((p) => [...p, { name: "Excavator", count: "1" }])} className="self-start">
            <Plus className="size-3.5" aria-hidden /> Add plant
          </Btn>
        </div>
      </div>

      {/* ------------------------------------------------------ execution */}
      <div className="rounded-md border border-line">
        <div className="border-b border-line bg-surface-2 px-3 py-1.5">
          <span className="t-label text-text-hi">Work executed against BOQ lines</span>
          <p className="t-body-sm text-text-lo">
            These quantities increment the cumulative executed quantity on the lines named — that is the only
            way the BOQ moves.
          </p>
        </div>
        <div className="flex flex-col gap-3 p-3">
          {exec.map((row, i) => {
            const line = byId.get(row.boqLineId);
            const bad = excess.find((x) => x.line.id === row.boqLineId);
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-72 flex-1 flex-col gap-1">
                    <span className="t-overline text-text-lo">BOQ line</span>
                    <Select
                      value={row.boqLineId}
                      onChange={(e) => setExec((p) => p.map((x, j) => (j === i ? { ...x, boqLineId: e.target.value } : x)))}
                    >
                      {computed.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} — {l.description.slice(0, 62)}{l.description.length > 62 ? "…" : ""}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex w-32 flex-col gap-1">
                    <span className="t-overline text-text-lo">Qty {line ? `(${line.uom})` : ""}</span>
                    <NumberInput
                      value={row.qty}
                      step="0.01"
                      min={0}
                      onChange={(e) => setExec((p) => p.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                    />
                  </label>
                  <Btn variant="ghost" onClick={() => setExec((p) => p.filter((_, j) => j !== i))} aria-label="Remove line">
                    <Minus className="size-3.5" aria-hidden />
                  </Btn>
                </div>
                {line ? (
                  <p className="t-body-sm text-text-lo">
                    Cumulative {formatQty(line.executedQty, line.uom)} of {formatQty(line.effectiveQty, line.uom)} contracted ·
                    balance {formatQty(line.balanceQty, line.uom)} · rate {formatINR(line.rate)}
                  </p>
                ) : null}
                {bad ? (
                  <BlockedNotice
                    rule={`${bad.line.code} would exceed the contracted quantity by ${formatQty(bad.over, bad.line.uom)}`}
                    unblock={`Contracted quantity including variations is ${formatQty(bad.line.effectiveQty, bad.line.uom)}; this entry would take cumulative execution to ${formatQty(bad.projected, bad.line.uom)}. Record the client-approved variation — reference and approved value — and the excess becomes claimable.`}
                    action={
                      <Btn variant="primary" onClick={() => setVariationFor(bad.line.id)}>
                        Record the approved variation
                      </Btn>
                    }
                  />
                ) : null}
                {variationFor === row.boqLineId && line ? (
                  <InlineVariation
                    projectId={projectId}
                    line={{ id: line.id, code: line.code, uom: line.uom, rate: line.rate }}
                    shortfall={bad?.over ?? 0}
                    actor={actor}
                    onDone={() => setVariationFor(null)}
                  />
                ) : null}
              </div>
            );
          })}
          <Btn onClick={() => setExec((p) => [...p, { boqLineId: lines[0]?.id ?? "", qty: "" }])} className="self-start">
            <Plus className="size-3.5" aria-hidden /> Add BOQ line
          </Btn>
        </div>
      </div>

      {/* -------------------------------------------------------- narrative */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Materials received" hint="What arrived on site today, with quantities.">
          <TextArea value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="Cement 120 bags, steel 2.4 MT" />
        </Field>
        <Field label="Site instructions received" hint="Instructions from the client or consultant.">
          <TextArea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Client engineer inspected reinforcement" />
        </Field>
        <Field label="Hindrance cause" hint="Leave unset where the day ran clean.">
          <Select value={hindranceCause} onChange={(e) => setHindranceCause(e.target.value as "" | HindranceCause)}>
            <option value="">No hindrance</option>
            {Object.entries(HINDRANCE_CAUSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Hindrance description" hint="Required once a cause is selected — this is what supports an extension of time.">
          <TextArea
            value={hindrance}
            disabled={!hindranceCause}
            onChange={(e) => setHindrance(e.target.value)}
            placeholder="Continuous rainfall; excavation and concreting suspended"
          />
        </Field>
        <Field label="Safety observations" required className="md:col-span-2">
          <TextArea value={safety} onChange={(e) => setSafety(e.target.value)} />
        </Field>
      </div>

      {/* ----------------------------------------------------------- photos */}
      <div className="rounded-md border border-line">
        <div className="border-b border-line bg-surface-2 px-3 py-1.5">
          <span className="t-label flex items-center gap-1.5 text-text-hi">
            <Camera className="size-3.5" aria-hidden /> Photographs
          </span>
        </div>
        <div className="flex flex-col gap-2 p-3">
          {photos.length ? (
            <ul className="flex flex-wrap gap-2">
              {photos.map((c, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1">
                  <span className="t-body-sm text-text-mid">{c}</span>
                  <button
                    type="button"
                    onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    aria-label={`Remove photograph ${c}`}
                    className="text-text-lo hover:text-danger"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="t-body-sm text-text-lo">No photographs attached to this entry yet.</p>
          )}
          <div className="flex items-end gap-2">
            <Field label="Caption" className="w-72">
              <TextInput
                value={photoCaption}
                onChange={(e) => setPhotoCaption(e.target.value)}
                placeholder="Raft reinforcement before pour"
              />
            </Field>
            <Btn
              onClick={() => {
                if (!photoCaption.trim()) return;
                setPhotos((p) => [...p, photoCaption.trim()]);
                setPhotoCaption("");
              }}
            >
              <Plus className="size-3.5" aria-hidden /> Attach
            </Btn>
          </div>
        </div>
      </div>

      {errors.length ? (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger-bg px-3 py-2.5">
          <p className="t-body-sm font-medium text-danger">This entry cannot be submitted yet</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e) => <li key={e} className="t-body-sm text-text-mid">{e}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="primary" size="md" onClick={submit}>
          <Send className="size-4" aria-hidden />
          {supersedes ? "Submit superseding entry" : "Submit progress entry"}
        </Btn>
        <Btn size="md" onClick={onDone}>Cancel</Btn>
        <span className="t-body-sm text-text-lo">
          Once submitted this record is immutable. A correction requires a superseding entry with a stated reason.
        </span>
      </div>
    </div>
  );
}

function InlineVariation({
  projectId, line, shortfall, actor, onDone,
}: {
  projectId: string;
  line: { id: string; code: string; uom: string; rate: number };
  shortfall: number;
  actor: { id: string; name: string };
  onDone: () => void;
}) {
  const [qty, setQty] = useState(shortfall ? String(Math.ceil(shortfall * 100) / 100) : "");
  const [ref, setRef] = useState("");
  const [value, setValue] = useState(shortfall ? String(Math.round(shortfall * line.rate)) : "");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="rounded-md border border-info/40 bg-info-bg p-3">
      <Overline>Approved variation — {line.code}</Overline>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Field label={`Additional quantity (${line.uom})`} required>
          <NumberInput value={qty} step="0.01" min={0} onChange={(e) => { setQty(e.target.value); setErr(null); }} />
        </Field>
        <Field label="Variation reference" required>
          <TextInput value={ref} onChange={(e) => { setRef(e.target.value); setErr(null); }} placeholder="VO/26/003" />
        </Field>
        <Field label="Approved value (₹)" required>
          <NumberInput value={value} step={100} min={0} onChange={(e) => { setValue(e.target.value); setErr(null); }} />
        </Field>
        <div className="flex items-end gap-2">
          <Btn
            variant="primary"
            onClick={() => {
              if (!ref.trim() || !Number(qty) || !Number(value)) {
                setErr("Reference, quantity and approved value are all required — a variation without them cannot be claimed.");
                return;
              }
              recordVariation(
                {
                  boqLineId: line.id, projectId, variationQty: Number(qty),
                  variationRef: ref.trim(), approvedValue: Number(value),
                  recordedAt: new Date().toISOString(),
                },
                actor,
              );
              onDone();
            }}
          >
            Record
          </Btn>
          <Btn onClick={onDone}>Cancel</Btn>
        </div>
      </div>
      {err ? <p className="t-body-sm mt-1 text-danger">{err}</p> : null}
    </div>
  );
}
