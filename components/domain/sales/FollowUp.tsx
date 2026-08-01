"use client";

import * as React from "react";
import { Explainer } from "@/components/patterns/primitives";
import { Check, MessageSquare } from "lucide-react";
import type * as T from "@/lib/schemas/entities";
import { formatDate } from "@/lib/format";
import { ACTIVITY_MODES, FOLLOW_UP_OUTCOMES } from "./calc";
import { recordFollowUp, type Actor } from "./store";
import { Btn, Field, Modal, Select, TextArea, TextInput } from "./ui";

export interface FollowUpSubject {
  type: T.Activity["subjectType"];
  id: string;
  label: string;
  customerId: string;
}

/**
 * E3-S9 AC-2/AC-3 — one capture surface used by the desk, the pipeline board,
 * the enquiry list and Customer 360. Whatever is recorded lands on the
 * customer timeline and its next-action date drives the desk.
 */
export function FollowUpDialog({
  open, onOpenChange, subject, actor, todayIso, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject: FollowUpSubject | null;
  actor: Actor;
  todayIso: string;
  onSaved?: () => void;
}) {
  const today = todayIso.slice(0, 10);
  const [mode, setMode] = React.useState<T.Activity["mode"]>("CALL");
  const [outcome, setOutcome] = React.useState(FOLLOW_UP_OUTCOMES[0]!);
  const [notes, setNotes] = React.useState("");
  const [nextDate, setNextDate] = React.useState(today);
  const [noNext, setNoNext] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setMode("CALL");
    setOutcome(FOLLOW_UP_OUTCOMES[0]!);
    setNotes("");
    setNextDate(today);
    setNoNext(false);
    setErr(null);
  }, [open, today]);

  function save() {
    if (!subject) return;
    if (!notes.trim()) {
      setErr("Write what happened — a follow-up with no note teaches nobody anything.");
      return;
    }
    if (!noNext && !nextDate) {
      setErr("Give a next-action date, or tick that no further action is needed.");
      return;
    }
    recordFollowUp(
      {
        subjectType: subject.type,
        subjectId: subject.id,
        customerId: subject.customerId,
        mode, outcome, notes: notes.trim(),
        nextActionDate: noNext ? null : new Date(`${nextDate}T10:00:00`).toISOString(),
      },
      actor,
    );
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record a follow-up"
      description={subject ? `Against ${subject.type.toLowerCase()} ${subject.label}` : undefined}
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={save}>
            <Check className="size-3.5" aria-hidden /> Save follow-up
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Mode" required>
          {(p) => (
            <Select {...p} value={mode} onChange={(e) => setMode(e.target.value as T.Activity["mode"])}>
              {ACTIVITY_MODES.map((m) => (
                <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Outcome" required>
          {(p) => (
            <Select {...p} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {FOLLOW_UP_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Notes" required error={err} className="sm:col-span-2">
          {(p) => (
            <TextArea
              {...p}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); if (err) setErr(null); }}
              placeholder="Who you spoke to, what they said, what you committed to."
            />
          )}
        </Field>
        <Field label="Next action date" hint={noNext ? "No further action scheduled." : `Drives your desk. Today is ${formatDate(todayIso)}.`}>
          {(p) => (
            <TextInput {...p} type="date" value={nextDate} disabled={noNext} onChange={(e) => setNextDate(e.target.value)} />
          )}
        </Field>
        <Field label="Further action needed">
          {(p) => (
            <Select {...p} value={noNext ? "0" : "1"} onChange={(e) => setNoNext(e.target.value === "0")}>
              <option value="1">Yes — schedule the next action</option>
              <option value="0">No — nothing further scheduled</option>
            </Select>
          )}
        </Field>
      </div>
      <Explainer className="mt-3 flex items-start gap-1.5 text-text-lo">
        <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        This entry appears on the customer activity timeline immediately and, if a next-action date is set, on the
        sales desk follow-up list for that day.
      </Explainer>
    </Modal>
  );
}
