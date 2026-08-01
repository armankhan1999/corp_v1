"use client";

import * as React from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import type { PravaahDocument } from "@/lib/schemas";
import type { DocumentCategory, DocumentType } from "@/lib/schemas/enums";
import { enumLabel, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, CATEGORY_ORDER, type Denial } from "./access";
import { LockedBranch } from "./ui";

/**
 * E10-S1 AC1 — the eight branches, each with a count, and a type sub-branch
 * under each with its own count. Counts are of what this user may actually
 * open, so the tree never advertises documents it will then refuse.
 */

export interface TreeBranch {
  category: DocumentCategory;
  count: number;
  types: { type: DocumentType; count: number }[];
}

export function buildTree(documents: PravaahDocument[]): TreeBranch[] {
  const byCat = new Map<DocumentCategory, Map<DocumentType, number>>();
  for (const d of documents) {
    let m = byCat.get(d.category);
    if (!m) { m = new Map(); byCat.set(d.category, m); }
    m.set(d.type, (m.get(d.type) ?? 0) + 1);
  }
  return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((category) => {
    const m = byCat.get(category)!;
    const types = [...m.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
    return { category, count: [...m.values()].reduce((a, b) => a + b, 0), types };
  });
}

interface Props {
  tree: TreeBranch[];
  denied: { category: DocumentCategory; denial: Denial }[];
  selectedCategories: DocumentCategory[];
  selectedTypes: DocumentType[];
  onSelectCategory: (c: DocumentCategory) => void;
  onSelectType: (c: DocumentCategory, t: DocumentType) => void;
  total: number;
  onSelectAll: () => void;
}

export function VaultTree({
  tree, denied, selectedCategories, selectedTypes, onSelectCategory, onSelectType, total, onSelectAll,
}: Props) {
  const [open, setOpen] = React.useState<Set<string>>(() => new Set<string>());

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onSelectAll}
        className={cn(
          "flex h-9 items-center justify-between gap-2 border-b border-line px-3 text-left",
          selectedCategories.length === 0 && selectedTypes.length === 0
            ? "bg-surface-2 text-text-hi"
            : "text-text-mid hover:bg-surface-2 hover:text-text-hi",
        )}
      >
        <span className="t-body-sm truncate">All branches</span>
        <span className="t-mono shrink-0 text-[0.75rem] text-text-lo">{formatCount(total)}</span>
      </button>

      <ul>
        {tree.map((branch) => {
          const expanded = open.has(branch.category);
          const active = selectedCategories.includes(branch.category);
          return (
            <li key={branch.category} className="border-b border-line">
              <div className="flex items-stretch">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${CATEGORY_LABEL[branch.category]}`}
                  onClick={() => setOpen((s) => {
                    const next = new Set(s);
                    if (next.has(branch.category)) next.delete(branch.category); else next.add(branch.category);
                    return next;
                  })}
                  className="grid w-7 shrink-0 place-items-center text-text-lo hover:text-text-hi"
                >
                  <ChevronRight className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-90")} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectCategory(branch.category)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-9 flex-1 items-center justify-between gap-2 pr-3 text-left",
                    active ? "bg-surface-2 text-text-hi" : "text-text-mid hover:bg-surface-2 hover:text-text-hi",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {expanded
                      ? <FolderOpen className="size-3.5 shrink-0 text-text-lo" aria-hidden />
                      : <Folder className="size-3.5 shrink-0 text-text-lo" aria-hidden />}
                    <span className="t-body-sm truncate">{CATEGORY_LABEL[branch.category]}</span>
                  </span>
                  <span className="t-mono shrink-0 text-[0.75rem] text-text-lo" data-numeric>
                    {formatCount(branch.count)}
                  </span>
                </button>
              </div>

              {expanded ? (
                <ul className="border-t border-line bg-surface-0/40">
                  {branch.types.map((t) => {
                    const on = selectedTypes.includes(t.type) && selectedCategories.includes(branch.category);
                    return (
                      <li key={t.type}>
                        <button
                          type="button"
                          onClick={() => onSelectType(branch.category, t.type)}
                          aria-pressed={on}
                          className={cn(
                            "flex min-h-8 w-full items-center justify-between gap-2 py-1 pl-9 pr-3 text-left",
                            on ? "bg-surface-2 text-text-hi" : "text-text-mid hover:bg-surface-2 hover:text-text-hi",
                          )}
                        >
                          <span className="t-body-sm truncate">{enumLabel(t.type)}</span>
                          <span className="t-mono shrink-0 text-[0.75rem] text-text-lo" data-numeric>
                            {formatCount(t.count)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {denied.length ? (
        <div className="flex flex-col gap-2 border-t border-line p-3">
          <p className="t-overline text-text-lo">Branches you cannot open</p>
          {denied.map((d) => (
            <LockedBranch key={d.category} label={CATEGORY_LABEL[d.category]} denial={d.denial} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
