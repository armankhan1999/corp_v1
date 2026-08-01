"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { formatCount, formatDate, formatINR } from "@/lib/format";
import { Overline, Explainer } from "@/components/patterns/primitives";
import { CoverageBadge } from "./CoverageBadge";
import { BlockedNote, DateInput, Field, Select, Serial, TextArea, TextInput } from "./ui";
import type { AmcAssetOption, CustomerOption } from "./types";

export interface AmcDraft {
  number: string;
  customerId: string;
  assetIds: string[];
  coverage: "COMPREHENSIVE" | "NON_COMPREHENSIVE";
  startDate: string;
  endDate: string;
  contractValue: string;
  billingSchedule: "ONE_TIME" | "QUARTERLY" | "HALF_YEARLY";
  visitsPerYear: string;
  responseHours: string;
  restorationHours: string;
  inclusions: string;
  exclusions: string;
  ownerUserId: string;
}

export const DEFAULT_INCLUSIONS_COMPREHENSIVE =
  "All scheduled preventive visits, breakdown attendance, and genuine OEM spares except consumables listed as excluded.";
export const DEFAULT_INCLUSIONS_NON_COMPREHENSIVE =
  "Scheduled preventive visits and breakdown attendance (labour only). Spares chargeable at prevailing rates.";
export const DEFAULT_EXCLUSIONS =
  "Consumable oil beyond first fill, air-end overhaul, damage from incorrect utility supply, and any work arising from unauthorised third-party intervention.";

export function emptyAmcDraft(todayIso: string, ownerUserId: string): AmcDraft {
  const start = new Date(todayIso);
  const end = new Date(start.getTime());
  end.setFullYear(end.getFullYear() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const asInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    number: "",
    customerId: "",
    assetIds: [],
    coverage: "COMPREHENSIVE",
    startDate: asInput(start),
    endDate: asInput(end),
    contractValue: "",
    billingSchedule: "ONE_TIME",
    visitsPerYear: "4",
    responseHours: "8",
    restorationHours: "48",
    inclusions: DEFAULT_INCLUSIONS_COMPREHENSIVE,
    exclusions: DEFAULT_EXCLUSIONS,
    ownerUserId,
  };
}

export interface AmcFormErrors {
  customerId?: string;
  assetIds?: string;
  endDate?: string;
  contractValue?: string;
  visitsPerYear?: string;
}

export function validateAmcDraft(draft: AmcDraft): AmcFormErrors {
  const errors: AmcFormErrors = {};
  if (!draft.customerId) errors.customerId = "Select the customer the contract is with.";
  if (!draft.assetIds.length) errors.assetIds = "A contract must cover at least one machine.";
  if (!draft.startDate || !draft.endDate || draft.endDate <= draft.startDate)
    errors.endDate = "The end date must fall after the start date.";
  if (!draft.contractValue.trim() || Number.isNaN(Number(draft.contractValue)))
    errors.contractValue = "Contract value must be a number.";
  const visits = Number(draft.visitsPerYear);
  if (!visits || visits < 1 || visits > 24)
    errors.visitsPerYear = "Committed visits must be between 1 and 24 a year.";
  return errors;
}

export function AmcForm({
  draft,
  setDraft,
  errors,
  customers,
  assets,
  owners,
}: {
  draft: AmcDraft;
  setDraft: React.Dispatch<React.SetStateAction<AmcDraft>>;
  errors: AmcFormErrors;
  customers: CustomerOption[];
  assets: AmcAssetOption[];
  owners: { id: string; name: string }[];
}) {
  const [assetQuery, setAssetQuery] = React.useState("");

  const set = React.useCallback(
    (patch: Partial<AmcDraft>) => setDraft((d) => ({ ...d, ...patch })),
    [setDraft],
  );

  const candidates = React.useMemo(() => {
    if (!draft.customerId) return [];
    const q = assetQuery.trim().toLowerCase();
    return assets
      .filter((a) => a.customerId === draft.customerId && a.status !== "DECOMMISSIONED")
      .filter((a) => !q || a.serial.toLowerCase().includes(q) || a.model.toLowerCase().includes(q));
  }, [assets, draft.customerId, assetQuery]);

  function toggleAsset(id: string) {
    setDraft((d) => ({
      ...d,
      assetIds: d.assetIds.includes(id)
        ? d.assetIds.filter((x) => x !== id)
        : [...d.assetIds, id],
    }));
  }

  function applyCoverage(coverage: AmcDraft["coverage"]) {
    set({
      coverage,
      inclusions:
        coverage === "COMPREHENSIVE"
          ? DEFAULT_INCLUSIONS_COMPREHENSIVE
          : DEFAULT_INCLUSIONS_NON_COMPREHENSIVE,
    });
  }

  const visits = Number(draft.visitsPerYear) || 0;
  const spanDays =
    draft.startDate && draft.endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(draft.endDate).getTime() - new Date(draft.startDate).getTime()) / 86_400_000,
          ),
        )
      : 0;
  const generated = visits * draft.assetIds.length;

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Contract number" hint="Left blank, the next number in the series is issued.">
          <TextInput
            value={draft.number}
            onChange={(e) => set({ number: e.target.value })}
            placeholder="BC/AMC/26/105"
            className="t-mono"
          />
        </Field>

        <Field label="Customer" required error={errors.customerId}>
          <Select
            value={draft.customerId}
            onChange={(e) => set({ customerId: e.target.value, assetIds: [] })}
          >
            <option value="">Select a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Coverage type" required>
          <Select
            value={draft.coverage}
            onChange={(e) => applyCoverage(e.target.value as AmcDraft["coverage"])}
          >
            <option value="COMPREHENSIVE">Comprehensive — labour and spares</option>
            <option value="NON_COMPREHENSIVE">Non-comprehensive — labour only</option>
          </Select>
        </Field>

        <Field label="Contract owner">
          <Select value={draft.ownerUserId} onChange={(e) => set({ ownerUserId: e.target.value })}>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <Overline>Covered assets</Overline>
            <p className="t-body-sm text-text-mid">
              {draft.assetIds.length
                ? `${formatCount(draft.assetIds.length)} selected — each recomputes to Under AMC for the contract period.`
                : "Select the machines this contract covers."}
            </p>
          </div>
          <div className="relative w-56">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-lo"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Filter covered assets"
              value={assetQuery}
              onChange={(e) => setAssetQuery(e.target.value)}
              placeholder="Serial or model"
              disabled={!draft.customerId}
              className="t-body-sm h-9 w-full rounded-md border border-line bg-surface-0 pl-7 pr-2 text-text-hi placeholder:text-text-lo focus:border-line-strong disabled:opacity-55"
            />
          </div>
        </div>

        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-line">
          {!draft.customerId ? (
            <p className="t-body-sm px-3 py-4 text-text-lo">
              Select a customer to list their installed machines.
            </p>
          ) : candidates.length === 0 ? (
            <p className="t-body-sm px-3 py-4 text-text-lo">
              No machine on the register matches. Decommissioned units are never contractable.
            </p>
          ) : (
            <ul className="flex flex-col gap-px bg-line">
              {candidates.map((a) => {
                const checked = draft.assetIds.includes(a.id);
                return (
                  <li key={a.id} className="bg-surface-1">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAsset(a.id)}
                        className="size-4 shrink-0 rounded-md border border-line-strong bg-surface-0 accent-[var(--primary-600)]"
                      />
                      <span className="min-w-0 flex-1">
                        <Serial value={a.serial} />
                        <span className="t-body-sm block text-text-lo">{a.model}</span>
                      </span>
                      <CoverageBadge state={a.coverage} />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {errors.assetIds ? <p className="t-body-sm mt-1 text-danger">{errors.assetIds}</p> : null}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Start date" required>
          <DateInput value={draft.startDate} onChange={(v) => set({ startDate: v })} />
        </Field>
        <Field label="End date" required error={errors.endDate}>
          <DateInput
            value={draft.endDate}
            onChange={(v) => set({ endDate: v })}
            invalid={Boolean(errors.endDate)}
          />
        </Field>

        <Field label="Contract value (₹)" required error={errors.contractValue}>
          <TextInput
            value={draft.contractValue}
            inputMode="numeric"
            invalid={Boolean(errors.contractValue)}
            onChange={(e) => set({ contractValue: e.target.value })}
            placeholder="145000"
          />
        </Field>

        <Field label="Billing schedule" required>
          <Select
            value={draft.billingSchedule}
            onChange={(e) => set({ billingSchedule: e.target.value as AmcDraft["billingSchedule"] })}
          >
            <option value="ONE_TIME">One time</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="HALF_YEARLY">Half yearly</option>
          </Select>
        </Field>

        <Field
          label="Committed preventive visits per year"
          required
          error={errors.visitsPerYear}
          hint="Generated across the contract period at even intervals on activation."
        >
          <TextInput
            value={draft.visitsPerYear}
            inputMode="numeric"
            invalid={Boolean(errors.visitsPerYear)}
            onChange={(e) => set({ visitsPerYear: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Response commitment (h)" required>
            <TextInput
              value={draft.responseHours}
              inputMode="numeric"
              onChange={(e) => set({ responseHours: e.target.value })}
            />
          </Field>
          <Field label="Restoration commitment (h)" required>
            <TextInput
              value={draft.restorationHours}
              inputMode="numeric"
              onChange={(e) => set({ restorationHours: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3">
        <Field label="Inclusions">
          <TextArea value={draft.inclusions} onChange={(e) => set({ inclusions: e.target.value })} />
        </Field>
        <Field label="Exclusions">
          <TextArea value={draft.exclusions} onChange={(e) => set({ exclusions: e.target.value })} />
        </Field>
      </section>

      <section className="rounded-md border border-line bg-surface-0 p-3">
        <Overline>On activation</Overline>
        <Explainer className="mt-1 text-text-mid">
          {generated
            ? `${formatCount(generated)} preventive visits will be generated — ${visits} per machine across ${formatCount(draft.assetIds.length)} machine${draft.assetIds.length === 1 ? "" : "s"}, spread evenly over ${formatCount(spanDays)} days from ${draft.startDate ? formatDate(draft.startDate) : "—"} to ${draft.endDate ? formatDate(draft.endDate) : "—"}.`
            : "Select machines and set the committed visit count to see the schedule that will be generated."}
        </Explainer>
        {draft.contractValue && !Number.isNaN(Number(draft.contractValue)) ? (
          <p className="t-body-sm mt-1 text-text-lo">
            Contract value {formatINR(Number(draft.contractValue))} ·{" "}
            {draft.billingSchedule === "ONE_TIME"
              ? "billed once"
              : draft.billingSchedule === "QUARTERLY"
                ? "billed quarterly"
                : "billed half-yearly"}
          </p>
        ) : null}
      </section>

      <BlockedNote
        rule="Contract status is derived from the dates — Draft before the start, Active, Expiring inside 60 days, Expired after the end. There is no status field on this form."
        unblock="terminating the contract from its detail screen, which is the only manual state and requires a reason."
      />
    </div>
  );
}
