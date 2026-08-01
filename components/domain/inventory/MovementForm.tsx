"use client";

/**
 * E7-S2 — the only way a balance ever changes.
 *
 * There is no "edit balance" form in this epic and no ledger row can be altered
 * or removed. A correction is a *new* movement carrying a stated reason, which
 * this dialog writes through `appendMovements` with the next sequence number.
 */

import * as React from "react";
import { ArrowLeftRight, FilePlus2 } from "lucide-react";
import { formatDateTime, formatQty } from "@/lib/format";
import type * as T from "@/lib/schemas/entities";
import { LOCATION_KIND_LABEL, MOVEMENT_TYPE_LABEL, onHandOf, type InvView } from "./model";
import { appendMovements, nextCounter, pad, useMutate, writeAudit, type Actor } from "./store";
import { Blocked, Btn, Field, Modal, Note, NumInput, Select, TextArea, TextInput } from "./ui";

export type PostMode = "CORRECTION" | "TRANSFER";

const CORRECTION_TYPES: T.StockMovement["type"][] = ["ADJUSTMENT", "RETURN", "SCRAP"];

const SOURCE_FOR: Record<string, T.StockMovement["sourceType"]> = {
  ADJUSTMENT: "ADJUSTMENT",
  RETURN: "RETURN",
  SCRAP: "SCRAP",
  TRANSFER: "TRANSFER",
};

export function PostMovementModal({
  open, mode, view, actor, itemId, locationId, onClose, onPosted,
}: {
  open: boolean;
  mode: PostMode;
  view: InvView;
  actor: Actor;
  itemId: string | null;
  locationId: string | null;
  onClose: () => void;
  onPosted: (summary: string) => void;
}) {
  const mutate = useMutate();
  const [item, setItem] = React.useState(itemId ?? "");
  const [type, setType] = React.useState<T.StockMovement["type"]>(mode === "TRANSFER" ? "TRANSFER" : "ADJUSTMENT");
  const [direction, setDirection] = React.useState<"IN" | "OUT">("IN");
  const [from, setFrom] = React.useState(locationId ?? view.locations[0]?.id ?? "");
  const [to, setTo] = React.useState(view.locations[1]?.id ?? view.locations[0]?.id ?? "");
  const [qty, setQty] = React.useState(1);
  const [reason, setReason] = React.useState("");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setItem(itemId ?? "");
      setType(mode === "TRANSFER" ? "TRANSFER" : "ADJUSTMENT");
      setQty(1);
      setReason("");
      setSearch("");
      if (locationId) setFrom(locationId);
    }
  }, [open, itemId, locationId, mode]);

  const chosen = item ? view.itemById.get(item) ?? null : null;
  const candidates = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return view.items
      .filter(
        (i) =>
          i.code.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.oemPartNumber.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, view.items]);

  const outLocation = mode === "TRANSFER" ? from : direction === "OUT" ? from : null;
  const inLocation = mode === "TRANSFER" ? to : direction === "IN" ? from : null;
  const availableAtSource = chosen && outLocation ? onHandOf(view, chosen.id, outLocation) : null;
  const overdraw = availableAtSource !== null && qty > availableAtSource;
  const sameLocation = mode === "TRANSFER" && from === to;
  const needsReason = reason.trim().length < 8;
  const blocked = !chosen || qty <= 0 || sameLocation || needsReason || overdraw;

  function post() {
    if (!chosen || blocked) return;
    const at = new Date().toISOString();
    mutate((o) => {
      const seqNo = nextCounter(o, mode === "TRANSFER" ? "transfer" : "adjustment", 0);
      const docNumber =
        mode === "TRANSFER"
          ? `BC/TRF/2627/${pad(seqNo, 4)}`
          : `BC/ADJ/2627/${pad(seqNo, 4)}`;
      appendMovements(o, view.maxSeq, actor, [
        {
          itemId: chosen.id,
          type,
          qty,
          fromLocationId: outLocation,
          toLocationId: inLocation,
          sourceType: SOURCE_FOR[type] ?? "ADJUSTMENT",
          sourceId: null,
          sourceLabel: docNumber,
          rate: chosen.standardCost,
          reason: reason.trim(),
        },
      ], at);
      writeAudit(o, actor, {
        at,
        action: "CREATE",
        entityType: "StockMovement",
        entityId: docNumber,
        entityLabel: docNumber,
        summary: `${MOVEMENT_TYPE_LABEL[type]} of ${formatQty(qty, chosen.uom)} ${chosen.code} — ${reason.trim()}`,
        before: null,
        after: `${MOVEMENT_TYPE_LABEL[type]} ${qty} ${chosen.uom}`,
      });
    });
    onPosted(
      mode === "TRANSFER"
        ? `${formatQty(qty, chosen.uom)} of ${chosen.code} transferred to ${view.locationById.get(to)?.name ?? to}`
        : `${MOVEMENT_TYPE_LABEL[type]} of ${formatQty(qty, chosen.uom)} posted against ${chosen.code}`,
    );
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={mode === "TRANSFER" ? "Transfer stock between locations" : "Post a compensating movement"}
      sub={
        mode === "TRANSFER"
          ? "A transfer is one ledger row that leaves one location and enters another. The total on hand does not change."
          : "Balances are never edited. A correction is a new ledger row with a stated reason, and both rows stay visible for ever."
      }
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            icon={mode === "TRANSFER" ? ArrowLeftRight : FilePlus2}
            onClick={post}
            disabled={blocked}
          >
            {mode === "TRANSFER" ? "Post transfer" : "Post movement"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Note tone="neutral" title="What this writes">
          One append-only row at sequence{" "}
          <span className="t-mono text-text-hi">{view.maxSeq + 1}</span>, timestamped{" "}
          <span className="t-mono text-text-hi">{formatDateTime(new Date())}</span>, actor{" "}
          <span className="text-text-hi">{actor.name}</span>. It can never be edited or removed.
        </Note>

        {chosen ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2">
            <span className="min-w-0">
              <span className="t-mono block text-text-hi">{chosen.code}</span>
              <span className="t-body-sm block truncate text-text-mid">{chosen.description}</span>
            </span>
            <Btn size="sm" onClick={() => { setItem(""); setSearch(""); }}>Change item</Btn>
          </div>
        ) : (
          <Field label="Item" required hint="Search by item code, description or OEM part number">
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Start typing…" />
          </Field>
        )}

        {!chosen && candidates.length ? (
          <ul className="flex flex-col gap-px overflow-hidden rounded-md border border-line bg-line">
            {candidates.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setItem(c.id)}
                  className="flex w-full items-center justify-between gap-3 bg-surface-1 px-3 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="t-mono text-text-hi">{c.code}</span>
                  <span className="t-body-sm min-w-0 flex-1 truncate text-text-mid">{c.description}</span>
                  <span className="t-mono text-text-lo">{formatQty(onHandOf(view, c.id), c.uom)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {mode === "CORRECTION" ? (
            <>
              <Field label="Movement type" required>
                <Select value={type} onChange={(e) => setType(e.target.value as T.StockMovement["type"])}>
                  {CORRECTION_TYPES.map((t) => (
                    <option key={t} value={t}>{MOVEMENT_TYPE_LABEL[t]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Direction" required>
                <Select value={direction} onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}>
                  <option value="IN">Into the location (increase)</option>
                  <option value="OUT">Out of the location (decrease)</option>
                </Select>
              </Field>
              <Field label="Location" required>
                <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                  {view.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {LOCATION_KIND_LABEL[l.kind]}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : (
            <>
              <Field label="From location" required>
                <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                  {view.locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="To location" required error={sameLocation ? "Pick a different destination" : null}>
                <Select value={to} onChange={(e) => setTo(e.target.value)}>
                  {view.locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Quantity" required>
                <NumInput min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              </Field>
            </>
          )}
          {mode === "CORRECTION" ? (
            <Field
              label="Quantity"
              required
              error={overdraw ? `Only ${formatQty(availableAtSource ?? 0)} on hand at that location` : null}
            >
              <NumInput min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </Field>
          ) : null}
        </div>

        {mode === "TRANSFER" && overdraw ? (
          <Blocked
            title="Transfer blocked — the source location does not hold that quantity"
            rule={`${view.locationById.get(from)?.name ?? "The source"} holds ${formatQty(availableAtSource ?? 0)} of ${chosen?.code ?? "this item"}. A ledger can never be driven negative by a transfer.`}
            unblock="Reduce the quantity, receive stock into the source location first, or pick a location that holds the part."
          />
        ) : null}

        <Field
          label="Reason"
          required
          hint="Recorded verbatim on the ledger row. Minimum eight characters — a correction without a reason is not a correction."
          error={needsReason && reason.length > 0 ? "Too short to be a reason" : null}
        >
          <TextArea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Physical count found two extra filters in bin C-14-3, damaged carton written off, …"
          />
        </Field>
      </div>
    </Modal>
  );
}
