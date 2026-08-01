"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeAlert, Layers, UserRoundCheck } from "lucide-react";
import { OEM_LABEL, type OEMPrincipal } from "@/lib/schemas/enums";
import { StatusBadge } from "@/components/patterns/primitives";
import { cn } from "@/lib/utils";
import { Btn, Callout, Field, Modal, Serial, TextArea } from "./ui";
import type { EngineerView } from "./types";

/**
 * E4-S3 — the keyboard-accessible assignment path.
 *
 * WCAG 2.2 SC 2.5.7 requires a non-dragging alternative for every drag
 * operation, so this dialog is not a fallback: it is the primary control, and
 * the board's drag gesture is the shortcut. Radix supplies the focus trap.
 *
 * Two gates are enforced here and nowhere else:
 *   • at or above daily capacity  → a written override reason is required
 *   • missing OEM certification   → an explicit acknowledgement is required
 */

export interface AssignTarget {
  id: string;
  number: string;
  customerName: string;
  assetSerial: string;
  assetPrincipal: OEMPrincipal;
  branchId: string;
  severityLabel: string;
}

export function AssignDialog({
  open, onOpenChange, engineers, target, currentEngineerId, onAssign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engineers: EngineerView[];
  target: AssignTarget | null;
  currentEngineerId: string | null;
  onAssign: (args: { engineer: EngineerView; overrideReason: string | null; certAcknowledged: boolean }) => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentEngineerId);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(currentEngineerId);
      setReason("");
      setAck(false);
      setTouched(false);
    }
  }, [open, currentEngineerId, target?.id]);

  const engineer = useMemo(
    () => engineers.find((e) => e.id === selected) ?? null,
    [engineers, selected],
  );

  const overCapacity = engineer ? engineer.loadToday >= engineer.dailyCapacity : false;
  const missingCert =
    engineer && target ? !engineer.oemCertifications.includes(target.assetPrincipal) : false;

  const reasonOk = !overCapacity || reason.trim().length >= 8;
  const ackOk = !missingCert || ack;
  const ready = Boolean(engineer) && reasonOk && ackOk;

  const sameBranch = engineers.filter((e) => e.branchId === target?.branchId);
  const otherBranch = engineers.filter((e) => e.branchId !== target?.branchId);

  function renderEngineer(e: EngineerView) {
    const over = e.loadToday >= e.dailyCapacity;
    const noCert = target ? !e.oemCertifications.includes(target.assetPrincipal) : false;
    return (
      <li key={e.id}>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-2.5 border-l-2 px-3 py-2 transition-colors duration-150",
            selected === e.id
              ? "border-l-primary-500 bg-surface-2"
              : "border-l-transparent hover:bg-surface-2",
          )}
        >
          <input
            type="radio"
            name="engineer"
            value={e.id}
            checked={selected === e.id}
            onChange={() => setSelected(e.id)}
            className="mt-1 accent-[var(--primary-600)]"
          />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="t-body font-medium text-text-hi">{e.name}</span>
              <span className="t-mono text-text-lo">{e.code}</span>
              <StatusBadge tone={e.statusTone}>{e.statusLabel}</StatusBadge>
            </span>
            <span className="t-body-sm mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-text-mid">
              <span className={cn("tabular-nums", over && "text-danger")}>
                Load {e.loadToday} of {e.dailyCapacity} today
              </span>
              <span className="text-text-lo">{e.branchName}</span>
            </span>
            <span className="mt-1 flex flex-wrap gap-1">
              {e.oemCertifications.length ? (
                e.oemCertifications.map((c) => (
                  <span
                    key={c}
                    className={cn(
                      "t-overline rounded-md border px-1 py-px",
                      target && c === target.assetPrincipal
                        ? "border-ok/50 bg-ok-bg text-ok"
                        : "border-line bg-surface-2 text-text-lo",
                    )}
                  >
                    {OEM_LABEL[c]}
                  </span>
                ))
              ) : (
                <span className="t-overline text-text-lo">No OEM certification recorded</span>
              )}
              {noCert ? (
                <span className="t-overline rounded-md border border-warn/50 bg-warn-bg px-1 py-px text-warn">
                  Missing {target ? OEM_LABEL[target.assetPrincipal] : ""}
                </span>
              ) : null}
            </span>
          </span>
        </label>
      </li>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Assign engineer"
      description={
        target
          ? `${target.number} · ${target.customerName} · ${target.severityLabel}`
          : "Select a ticket first"
      }
      wide
      footer={
        <>
          <Btn variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            onClick={() => {
              setTouched(true);
              if (!ready || !engineer) return;
              onAssign({
                engineer,
                overrideReason: overCapacity ? reason.trim() : null,
                certAcknowledged: missingCert ? ack : false,
              });
              onOpenChange(false);
            }}
          >
            <UserRoundCheck className="size-4" aria-hidden />
            Assign
          </Btn>
        </>
      }
    >
      {target ? (
        <p className="t-body-sm mb-3 text-text-mid">
          Machine <Serial>{target.assetSerial}</Serial> · principal{" "}
          {OEM_LABEL[target.assetPrincipal]}. Certification is matched against the machine&apos;s
          principal, not the model.
        </p>
      ) : null}

      <div className="max-h-72 overflow-y-auto rounded-md border border-line">
        {sameBranch.length ? (
          <>
            <p className="t-overline sticky top-0 z-10 bg-surface-2 px-3 py-1.5 text-text-lo">
              Owning branch
            </p>
            <ul className="divide-y divide-line">{sameBranch.map(renderEngineer)}</ul>
          </>
        ) : null}
        {otherBranch.length ? (
          <>
            <p className="t-overline sticky top-0 z-10 bg-surface-2 px-3 py-1.5 text-text-lo">
              Other branches
            </p>
            <ul className="divide-y divide-line">{otherBranch.map(renderEngineer)}</ul>
          </>
        ) : null}
      </div>

      {overCapacity && engineer ? (
        <Callout tone="danger" title="Engineer is at or above daily capacity" icon={Layers} className="mt-3">
          {engineer.name} already carries {engineer.loadToday} open{" "}
          {engineer.loadToday === 1 ? "job" : "jobs"} against a configured daily capacity of{" "}
          {engineer.dailyCapacity}. Assignment proceeds only with a recorded override reason.
        </Callout>
      ) : null}

      {overCapacity ? (
        <Field
          label="Override reason"
          htmlFor="override-reason"
          required
          className="mt-3"
          error={touched && !reasonOk ? "Record at least a short reason — it is written to the ticket and the audit log." : null}
        >
          <TextArea
            id="override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nearest certified engineer, customer escalation, site already en route…"
          />
        </Field>
      ) : null}

      {missingCert && engineer && target ? (
        <Callout tone="warn" title={`No ${OEM_LABEL[target.assetPrincipal]} certification on record`} icon={BadgeAlert} className="mt-3">
          {engineer.name} holds{" "}
          {engineer.oemCertifications.length
            ? engineer.oemCertifications.map((c) => OEM_LABEL[c]).join(", ")
            : "no OEM certification"}
          . Warranty claims on an {OEM_LABEL[target.assetPrincipal]} machine can be rejected where
          the attending engineer is uncertified.
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-0.5 accent-[var(--primary-600)]"
            />
            <span className="t-body-sm text-text-hi">
              I acknowledge the missing certification and accept the warranty risk.
            </span>
          </label>
          {touched && !ackOk ? (
            <p className="t-body-sm mt-1 text-danger">
              Acknowledge the missing certification to continue, or choose a certified engineer.
            </p>
          ) : null}
        </Callout>
      ) : null}
    </Modal>
  );
}
