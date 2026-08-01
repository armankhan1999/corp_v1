"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { PRODUCT_LINE_LABEL, OEM_LABEL, type OEMPrincipal, type ProductLine } from "@/lib/schemas/enums";
import type { AssetStatus } from "@/lib/schemas/enums";
import { addMonths, formatDate } from "@/lib/format";
import { Overline } from "@/components/patterns/primitives";
import {
  BlockedNote,
  DateInput,
  Field,
  Select,
  TextInput,
  fromDateInput,
  toDateInput,
} from "./ui";
import type {
  AssetRow,
  BranchOption,
  CustomerOption,
  InvoiceOption,
  ItemOption,
  OrderLineOption,
  ProductLineConfig,
} from "./types";

export interface AssetFormOptions {
  customers: CustomerOption[];
  items: ItemOption[];
  invoices: InvoiceOption[];
  branches: BranchOption[];
  orderLines: OrderLineOption[];
  productLines: ProductLineConfig[];
}

export interface AssetDraft {
  serial: string;
  principal: OEMPrincipal;
  productLine: ProductLine;
  model: string;
  capacityValue: string;
  capacityUnit: string;
  ratedKw: string;
  customerId: string;
  siteId: string;
  locationInSite: string;
  itemId: string;
  saleInvoiceId: string;
  installationDate: string;
  commissioningDate: string;
  warrantyMonths: string;
  runningHours: string;
  runningHoursAt: string;
  status: AssetStatus;
  sourceOrderLineId: string;
}

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: "RUNNING", label: "Running" },
  { value: "DOWN", label: "Down" },
  { value: "ON_RENT", label: "On rent" },
];

export function emptyDraft(todayIso: string, configs: ProductLineConfig[]): AssetDraft {
  const first = configs[0];
  return {
    serial: "",
    principal: first?.principal ?? "ELGI",
    productLine: first?.productLine ?? "SCREW_COMPRESSOR",
    model: "",
    capacityValue: "",
    capacityUnit: first?.capacityUnit ?? "CFM",
    ratedKw: "",
    customerId: "",
    siteId: "",
    locationInSite: "",
    itemId: "",
    saleInvoiceId: "",
    installationDate: toDateInput(todayIso),
    commissioningDate: toDateInput(todayIso),
    warrantyMonths: String(first?.warrantyMonths ?? 12),
    runningHours: "0",
    runningHoursAt: toDateInput(todayIso),
    status: "RUNNING",
    sourceOrderLineId: "",
  };
}

export function draftFromRow(row: AssetRow): AssetDraft {
  return {
    serial: row.serial,
    principal: row.principal,
    productLine: row.productLine,
    model: row.model,
    capacityValue: String(row.capacityValue),
    capacityUnit: row.capacityUnit,
    ratedKw: row.ratedKw === null ? "" : String(row.ratedKw),
    customerId: row.customerId,
    siteId: row.siteId,
    locationInSite: row.locationInSite,
    itemId: row.itemId,
    saleInvoiceId: row.saleInvoiceId ?? "",
    installationDate: toDateInput(row.installationDate),
    commissioningDate: toDateInput(row.commissioningDate),
    warrantyMonths: String(row.warrantyMonths),
    runningHours: String(row.runningHours),
    runningHoursAt: toDateInput(row.runningHoursAt),
    status: row.status,
    sourceOrderLineId: "",
  };
}

export interface AssetFormErrors {
  serial?: string;
  duplicateSerialOf?: { serial: string; id: string };
  customerId?: string;
  siteId?: string;
  model?: string;
  capacityValue?: string;
  commissioningDate?: string;
  runningHours?: string;
}

export function validateDraft(
  draft: AssetDraft,
  serialIndex: Map<string, string>,
  editingId: string | null,
): AssetFormErrors {
  const errors: AssetFormErrors = {};
  const serial = draft.serial.trim();
  if (!serial) errors.serial = "A serial number is required — service, warranty and contracts all attach to it.";
  else {
    const owner = serialIndex.get(serial.toUpperCase());
    if (owner && owner !== editingId) {
      errors.serial = "This serial already exists on the platform.";
      errors.duplicateSerialOf = { serial, id: owner };
    }
  }
  if (!draft.customerId) errors.customerId = "Select the customer that owns the machine.";
  if (!draft.siteId) errors.siteId = "Select the site the machine is installed at.";
  if (!draft.model.trim()) errors.model = "Record the model or series.";
  if (!draft.capacityValue.trim() || Number.isNaN(Number(draft.capacityValue)))
    errors.capacityValue = "Capacity rating must be a number.";
  if (
    draft.installationDate &&
    draft.commissioningDate &&
    draft.commissioningDate < draft.installationDate
  )
    errors.commissioningDate = "Commissioning cannot precede installation.";
  if (draft.runningHours.trim() && Number.isNaN(Number(draft.runningHours)))
    errors.runningHours = "Running hours must be a number.";
  return errors;
}

export function AssetForm({
  draft,
  setDraft,
  errors,
  options,
  mode,
  duplicateSerialHref,
}: {
  draft: AssetDraft;
  setDraft: React.Dispatch<React.SetStateAction<AssetDraft>>;
  errors: AssetFormErrors;
  options: AssetFormOptions;
  mode: "create" | "edit";
  duplicateSerialHref?: string | null;
}) {
  const customer = options.customers.find((c) => c.id === draft.customerId);
  const sites = customer?.sites ?? [];
  const invoices = options.invoices.filter((i) => i.customerId === draft.customerId);
  const fromOrder = draft.sourceOrderLineId
    ? (options.orderLines.find((l) => l.lineId === draft.sourceOrderLineId) ?? null)
    : null;

  const set = React.useCallback(
    (patch: Partial<AssetDraft>) => setDraft((d) => ({ ...d, ...patch })),
    [setDraft],
  );

  function applyOrderLine(lineId: string) {
    if (!lineId) {
      set({ sourceOrderLineId: "" });
      return;
    }
    const line = options.orderLines.find((l) => l.lineId === lineId);
    if (!line) return;
    set({
      sourceOrderLineId: lineId,
      customerId: line.customerId,
      siteId: line.siteId ?? "",
      itemId: line.itemId,
      saleInvoiceId: line.invoiceId ?? "",
      principal: line.principal,
      productLine: line.productLine ?? draft.productLine,
      capacityUnit: line.capacityUnit,
      warrantyMonths: String(line.warrantyMonths),
      model: line.description,
    });
  }

  function applyProductLine(pl: ProductLine) {
    const config = options.productLines.find((c) => c.productLine === pl);
    set({
      productLine: pl,
      principal: config?.principal ?? draft.principal,
      capacityUnit: config?.capacityUnit ?? draft.capacityUnit,
      warrantyMonths: String(config?.warrantyMonths ?? draft.warrantyMonths),
    });
  }

  const warrantyStart = draft.commissioningDate ? fromDateInput(draft.commissioningDate) : null;
  const months = Number(draft.warrantyMonths) || 0;
  const warrantyEnd = warrantyStart ? addMonths(new Date(warrantyStart), months) : null;

  return (
    <div className="flex flex-col gap-5">
      {mode === "create" ? (
        <section className="rounded-lg border border-line bg-surface-0 p-3">
          <Overline>Generate from a sales order line</Overline>
          <p className="t-body-sm mt-1 text-text-mid">
            Customer, site, item and invoice reference populate from the order. Nothing is
            re-entered.
          </p>
          <div className="mt-2">
            <Select
              aria-label="Sales order line"
              value={draft.sourceOrderLineId}
              onChange={(e) => applyOrderLine(e.target.value)}
            >
              <option value="">Enter manually — no source order</option>
              {options.orderLines.map((l) => (
                <option key={l.lineId} value={l.lineId}>
                  {l.orderNumber} · {l.customerName} · {l.description}
                </option>
              ))}
            </Select>
          </div>
          {fromOrder ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Order", fromOrder.orderNumber],
                ["Customer", fromOrder.customerName],
                ["Site", fromOrder.siteName ?? "Not on order"],
                ["Sale invoice", fromOrder.invoiceNumber ?? "Not yet invoiced"],
              ].map(([k, v]) => (
                <div key={k}>
                  <Overline>{k}</Overline>
                  <dd className="t-body-sm text-text-hi">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field
          label="Serial number"
          required
          error={errors.serial}
          hint="Unique across the platform. Rendered in mono and never truncated."
          className="sm:col-span-2"
        >
          <TextInput
            value={draft.serial}
            invalid={Boolean(errors.serial)}
            onChange={(e) => set({ serial: e.target.value.toUpperCase() })}
            placeholder="ELG26A1B2C"
            className="t-mono"
            autoComplete="off"
          />
          {errors.duplicateSerialOf && duplicateSerialHref ? (
            <p className="t-body-sm mt-1 flex flex-wrap items-center gap-1.5 rounded-md border border-danger/40 bg-danger-bg px-2 py-1.5 text-danger">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
              Rejected as a duplicate.
              <Link href={duplicateSerialHref} className="inline-flex items-center gap-1 underline">
                Open the existing asset
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </p>
          ) : null}
        </Field>

        <Field label="OEM principal" required>
          <Select
            value={draft.principal}
            onChange={(e) => set({ principal: e.target.value as OEMPrincipal })}
          >
            {(Object.keys(OEM_LABEL) as OEMPrincipal[]).map((p) => (
              <option key={p} value={p}>
                {OEM_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Product line" required hint="Sets the warranty duration from configuration.">
          <Select
            value={draft.productLine}
            onChange={(e) => applyProductLine(e.target.value as ProductLine)}
          >
            {(Object.keys(PRODUCT_LINE_LABEL) as ProductLine[]).map((p) => (
              <option key={p} value={p}>
                {PRODUCT_LINE_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Model or series" required error={errors.model} className="sm:col-span-2">
          <TextInput
            value={draft.model}
            invalid={Boolean(errors.model)}
            onChange={(e) => set({ model: e.target.value })}
            placeholder="Electric Lubricated Screw 220CFM"
          />
        </Field>

        <Field label="Capacity rating" required error={errors.capacityValue}>
          <TextInput
            value={draft.capacityValue}
            inputMode="decimal"
            invalid={Boolean(errors.capacityValue)}
            onChange={(e) => set({ capacityValue: e.target.value })}
            placeholder="220"
          />
        </Field>

        <Field label="Capacity unit" required>
          <Select value={draft.capacityUnit} onChange={(e) => set({ capacityUnit: e.target.value })}>
            {["CFM", "Bar", "Ton", "LPM", "m³/h", "KLD", "mm"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Rated kW" hint="Blank where the machine has no motor rating.">
          <TextInput
            value={draft.ratedKw}
            inputMode="decimal"
            onChange={(e) => set({ ratedKw: e.target.value })}
            placeholder="45"
          />
        </Field>

        <Field label="Item (catalogue)">
          <Select value={draft.itemId} onChange={(e) => set({ itemId: e.target.value })}>
            <option value="">Not linked</option>
            {options.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.description}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Customer" required error={errors.customerId}>
          <Select
            value={draft.customerId}
            disabled={Boolean(fromOrder)}
            onChange={(e) => set({ customerId: e.target.value, siteId: "" })}
          >
            <option value="">Select a customer</option>
            {options.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Site" required error={errors.siteId}>
          <Select
            value={draft.siteId}
            disabled={!draft.customerId}
            onChange={(e) => set({ siteId: e.target.value })}
          >
            <option value="">{draft.customerId ? "Select a site" : "Select a customer first"}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.district}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Location within site" className="sm:col-span-2">
          <TextInput
            value={draft.locationInSite}
            onChange={(e) => set({ locationInSite: e.target.value })}
            placeholder="Compressor house, bay 2"
          />
        </Field>

        <Field
          label="Sale invoice reference"
          className="sm:col-span-2"
          hint={fromOrder ? "Carried from the source order." : undefined}
        >
          <Select
            value={draft.saleInvoiceId}
            disabled={!draft.customerId}
            onChange={(e) => set({ saleInvoiceId: e.target.value })}
          >
            <option value="">Not linked</option>
            {invoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.number} — {formatDate(i.date)}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Installation date">
          <DateInput value={draft.installationDate} onChange={(v) => set({ installationDate: v })} />
        </Field>

        <Field
          label="Commissioning date"
          error={errors.commissioningDate}
          hint="Warranty starts here, not at the invoice date."
        >
          <DateInput
            value={draft.commissioningDate}
            invalid={Boolean(errors.commissioningDate)}
            onChange={(v) => set({ commissioningDate: v })}
          />
        </Field>

        <Field label="Warranty duration (months)" hint="Defaulted from the product-line configuration.">
          <TextInput
            value={draft.warrantyMonths}
            inputMode="numeric"
            onChange={(e) => set({ warrantyMonths: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 rounded-md border border-line bg-surface-0 px-3 py-2">
          <div>
            <Overline>Warranty start — derived</Overline>
            <p className="t-body-sm text-text-hi">
              {warrantyStart ? formatDate(warrantyStart) : "Set a commissioning date"}
            </p>
          </div>
          <div>
            <Overline>Warranty end — derived</Overline>
            <p className="t-body-sm text-text-hi">
              {warrantyEnd ? formatDate(warrantyEnd) : "—"}
            </p>
          </div>
        </div>

        <Field label="Running hours" error={errors.runningHours}>
          <TextInput
            value={draft.runningHours}
            inputMode="numeric"
            invalid={Boolean(errors.runningHours)}
            onChange={(e) => set({ runningHours: e.target.value })}
          />
        </Field>

        <Field label="Reading date">
          <DateInput value={draft.runningHoursAt} onChange={(v) => set({ runningHoursAt: v })} />
        </Field>

        <Field
          label="Status"
          className="sm:col-span-2"
          hint="Decommissioning is a separate action because it requires a reason."
        >
          <Select
            value={draft.status}
            onChange={(e) => set({ status: e.target.value as AssetStatus })}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <BlockedNote
        rule="Coverage state is derived from the warranty end date and any live AMC — there is no field for it on this form."
        unblock="recording an accurate commissioning date, or attaching the machine to an AMC contract."
      />
    </div>
  );
}
