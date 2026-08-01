"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import type { Dataset, PravaahDocument } from "@/lib/schemas";
import type { DocumentCategory, DocumentType } from "@/lib/schemas/enums";
import { enumLabel, formatCount } from "@/lib/format";
import { Overline } from "@/components/patterns/primitives";
import { CATEGORY_LABEL } from "./access";
import { activeFilterCount, EMPTY_FILTERS, type VaultFilters as Filters } from "./search";

/**
 * E10-S2 AC2 — type, category, linked entity, owner, date range, tag and
 * expiry state combine, the active set is visible as removable chips, and one
 * control clears the lot. The search box on this bar is the direct search
 * path: it never touches the AI answer layer.
 */

export interface FilterOptions {
  categories: DocumentCategory[];
  types: DocumentType[];
  owners: { id: string; name: string }[];
  tags: string[];
  linked: { id: string; label: string }[];
}

export function buildFilterOptions(documents: PravaahDocument[], ds: Dataset): FilterOptions {
  const cats = new Set<DocumentCategory>();
  const types = new Set<DocumentType>();
  const owners = new Set<string>();
  const tags = new Set<string>();
  const linked = new Map<string, string>();

  const projects = new Map(ds.projects.map((p) => [p.id, p.name]));
  const customers = new Map(ds.customers.map((c) => [c.id, c.tradeName]));

  for (const d of documents) {
    cats.add(d.category);
    types.add(d.type);
    owners.add(d.ownerUserId);
    for (const t of d.tags) tags.add(t);
    if (d.linkedId && (d.linkedType === "PROJECT" || d.linkedType === "CUSTOMER")) {
      const label = d.linkedType === "PROJECT" ? projects.get(d.linkedId) : customers.get(d.linkedId);
      if (label) linked.set(d.linkedId, label);
    }
  }

  return {
    categories: [...cats],
    types: [...types].sort(),
    owners: [...owners].map((id) => ({ id, name: ds.users.find((u) => u.id === id)?.name ?? id })),
    tags: [...tags].sort(),
    linked: [...linked.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)).slice(0, 60),
  };
}

const EXPIRY_OPTIONS: { value: Filters["expiry"]; label: string }[] = [
  { value: "", label: "Any expiry state" },
  { value: "EXPIRED", label: "Already expired" },
  { value: "D30", label: "Expiring within 30 days" },
  { value: "D60", label: "Expiring within 60 days" },
  { value: "HAS_EXPIRY", label: "Carries an expiry date" },
  { value: "NO_EXPIRY", label: "No expiry date" },
];

const selectCls =
  "h-8 min-w-0 rounded-md border border-line bg-surface-1 px-2 text-[0.8125rem] text-text-hi hover:border-line-strong";

interface Props {
  filters: Filters;
  options: FilterOptions;
  resultCount: number;
  onChange: (next: Filters) => void;
}

export function VaultFilterBar({ filters, options, resultCount, onChange }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  const active = activeFilterCount(filters);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.query) chips.push({ key: "q", label: `Text "${filters.query}"`, clear: () => set("query", "") });
  filters.categories.forEach((c) => chips.push({
    key: `c-${c}`, label: `Branch ${CATEGORY_LABEL[c]}`,
    clear: () => set("categories", filters.categories.filter((x) => x !== c)),
  }));
  filters.types.forEach((t) => chips.push({
    key: `t-${t}`, label: `Type ${enumLabel(t)}`,
    clear: () => set("types", filters.types.filter((x) => x !== t)),
  }));
  filters.owners.forEach((o) => chips.push({
    key: `o-${o}`, label: `Owner ${options.owners.find((x) => x.id === o)?.name ?? o}`,
    clear: () => set("owners", filters.owners.filter((x) => x !== o)),
  }));
  filters.linkedIds.forEach((l) => chips.push({
    key: `l-${l}`, label: `Linked to ${options.linked.find((x) => x.id === l)?.label ?? l}`,
    clear: () => set("linkedIds", filters.linkedIds.filter((x) => x !== l)),
  }));
  filters.tags.forEach((t) => chips.push({
    key: `g-${t}`, label: `Tag ${t}`,
    clear: () => set("tags", filters.tags.filter((x) => x !== t)),
  }));
  if (filters.from) chips.push({ key: "from", label: `Uploaded from ${filters.from}`, clear: () => set("from", "") });
  if (filters.to) chips.push({ key: "to", label: `Uploaded to ${filters.to}`, clear: () => set("to", "") });
  if (filters.expiry) chips.push({
    key: "exp", label: EXPIRY_OPTIONS.find((o) => o.value === filters.expiry)?.label ?? filters.expiry,
    clear: () => set("expiry", ""),
  });

  return (
    <div className="flex flex-col gap-3 border-b border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-text-lo" aria-hidden />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search titles, tags, metadata and document text"
            aria-label="Search the vault directly"
            className="h-8 w-full rounded-md border border-line bg-surface-1 pl-8 pr-2 text-[0.8125rem] text-text-hi placeholder:text-text-lo hover:border-line-strong"
          />
        </div>

        <select
          className={selectCls}
          aria-label="Filter by document type"
          value=""
          onChange={(e) => e.target.value && set("types", [...new Set([...filters.types, e.target.value as DocumentType])])}
        >
          <option value="">Type…</option>
          {options.types.map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
        </select>

        <select
          className={selectCls}
          aria-label="Filter by linked entity"
          value=""
          onChange={(e) => e.target.value && set("linkedIds", [...new Set([...filters.linkedIds, e.target.value])])}
        >
          <option value="">Linked entity…</option>
          {options.linked.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>

        <select
          className={selectCls}
          aria-label="Filter by owner"
          value=""
          onChange={(e) => e.target.value && set("owners", [...new Set([...filters.owners, e.target.value])])}
        >
          <option value="">Owner…</option>
          {options.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <select
          className={selectCls}
          aria-label="Filter by tag"
          value=""
          onChange={(e) => e.target.value && set("tags", [...new Set([...filters.tags, e.target.value])])}
        >
          <option value="">Tag…</option>
          {options.tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          className={selectCls}
          aria-label="Filter by expiry state"
          value={filters.expiry}
          onChange={(e) => set("expiry", e.target.value as Filters["expiry"])}
        >
          {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label className="t-body-sm flex items-center gap-1 text-text-lo">
          Uploaded
          <input
            type="date" value={filters.from} onChange={(e) => set("from", e.target.value)}
            aria-label="Uploaded from date" className={selectCls}
          />
          <span aria-hidden>–</span>
          <input
            type="date" value={filters.to} onChange={(e) => set("to", e.target.value)}
            aria-label="Uploaded to date" className={selectCls}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Overline>{formatCount(resultCount)} matching</Overline>
        {chips.length ? (
          <>
            <span className="t-body-sm text-text-lo">·</span>
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={c.clear}
                className="t-body-sm inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 py-0.5 pl-2 pr-1 text-text-mid hover:border-line-strong hover:text-text-hi"
              >
                {c.label}
                <X className="size-3" aria-hidden />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="t-body-sm rounded-md border border-line-strong px-2 py-0.5 text-text-hi hover:bg-surface-2"
            >
              Clear filters ({active})
            </button>
          </>
        ) : (
          <span className="t-body-sm text-text-lo">No filter applied</span>
        )}
      </div>
    </div>
  );
}
