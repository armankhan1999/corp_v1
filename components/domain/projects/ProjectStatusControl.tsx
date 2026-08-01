"use client";

import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { Panel, PanelHeader, Overline } from "@/components/patterns/primitives";
import { addMonths, formatDate } from "@/lib/format";
import type { ProjectStatus } from "@/lib/schemas/enums";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_ORDER } from "./labels";
import { patchProject, useProjectsOverlay } from "./store";
import { BlockedNotice, Btn, Field, Select, TextInput } from "./ui";

/**
 * E6-S1 — status resolves within the nine-value enum, and a project entering
 * the defect-liability period computes its expiry date, which E6-S6 then uses
 * as the basis for retention release eligibility.
 */
export function ProjectStatusControl({
  projectId, seedStatus, contractualCompletion, revisedCompletion, actualCompletion,
  defectLiabilityMonths, today, actor, canWrite,
}: {
  projectId: string;
  seedStatus: ProjectStatus;
  contractualCompletion: string;
  revisedCompletion: string | null;
  actualCompletion: string | null;
  defectLiabilityMonths: number;
  today: string;
  actor: { id: string; name: string };
  canWrite: boolean;
}) {
  const overlay = useProjectsOverlay();
  const patch = overlay.projectPatches[projectId];
  const current = (patch?.status as ProjectStatus | undefined) ?? seedStatus;
  const currentActual = patch?.actualCompletion !== undefined ? patch.actualCompletion : actualCompletion;

  const [next, setNext] = useState<ProjectStatus>(current);
  const [completion, setCompletion] = useState((currentActual ?? "").slice(0, 10));
  const [done, setDone] = useState(false);

  const needsCompletion = next === "DLP" || next === "COMPLETED" || next === "CLOSED";
  const base = completion || currentActual || revisedCompletion || contractualCompletion;
  const expiry = base ? addMonths(base, defectLiabilityMonths) : null;
  const blocked = needsCompletion && !base;

  function apply() {
    if (!expiry) return;
    const actual = needsCompletion ? new Date(completion || base).toISOString() : currentActual;
    patchProject(
      projectId,
      {
        status: next,
        actualCompletion: actual,
        dlpExpiry: expiry.toISOString(),
      },
      actor,
      `Status moved ${PROJECT_STATUS_LABEL[current]} → ${PROJECT_STATUS_LABEL[next]}; defect-liability expiry computed as ${formatDate(expiry)}`,
    );
    setDone(true);
  }

  return (
    <Panel>
      <PanelHeader
        title="Status and defect liability"
        sub="Status resolves within the nine contract states. Entering the defect-liability period fixes the expiry date that governs retention release."
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Current status">
            <TextInput value={PROJECT_STATUS_LABEL[current]} readOnly disabled />
          </Field>
          <Field label="Move to">
            <Select
              value={next}
              disabled={!canWrite}
              onChange={(e) => { setNext(e.target.value as ProjectStatus); setDone(false); }}
            >
              {PROJECT_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </Field>
          <Field
            label="Actual completion"
            hint={needsCompletion ? "Required — it starts the defect-liability clock." : "Only captured on completion states."}
          >
            <TextInput
              type="date"
              value={completion}
              disabled={!canWrite || !needsCompletion}
              onChange={(e) => { setCompletion(e.target.value); setDone(false); }}
              max={today.slice(0, 10)}
            />
          </Field>
        </div>

        <div className="flex items-start gap-2.5 rounded-md border border-line bg-surface-2 px-3 py-2">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-[var(--v-projects)]" aria-hidden />
          <div>
            <Overline>Computed defect-liability expiry</Overline>
            <p className="t-body mt-0.5 text-text-hi">
              {expiry ? formatDate(expiry) : "—"}{" "}
              <span className="t-body-sm text-text-mid">
                {expiry ? `= ${defectLiabilityMonths} months from ${formatDate(base)}` : "awaiting a completion date"}
              </span>
            </p>
            <p className="t-body-sm mt-0.5 text-text-mid">
              Retention withheld on this project becomes eligible for release on this date, and the retention
              register resolves each entry against it.
            </p>
          </div>
        </div>

        {blocked ? (
          <BlockedNotice
            rule={`${PROJECT_STATUS_LABEL[next]} needs a recorded completion date`}
            unblock="Enter the actual completion date above. Without it the defect-liability expiry cannot be computed and retention would never become claimable."
          />
        ) : null}

        {!canWrite ? (
          <BlockedNotice
            rule="your role cannot change project status"
            unblock="The assigned project manager, Director – Business or Super Admin can move the status."
          />
        ) : (
          <div className="flex items-center gap-2">
            <Btn variant="primary" onClick={apply} disabled={blocked || next === current}>
              {done ? <Check className="size-3.5" aria-hidden /> : null}
              {next === current ? "Already in this state" : `Move to ${PROJECT_STATUS_LABEL[next]}`}
            </Btn>
            {done ? <span className="t-body-sm text-ok">Recorded and audit-logged.</span> : null}
          </div>
        )}
      </div>
    </Panel>
  );
}
