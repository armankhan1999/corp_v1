"use client";

import * as React from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Dataset } from "@/lib/schemas";
import { formatDate, daysBetween } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/patterns/primitives";
import { Highlight } from "./ui";
import { facetsOf, type DocFacets, type SearchHit } from "./search";

/**
 * NFR-03 — 1,860 rows virtualised at the 36px compact row height. Matched
 * terms are marked in the title and in the passage snippet, so a direct search
 * shows *why* a row matched without opening it.
 */

const ROW_H = 36;

interface Props {
  hits: SearchHit[];
  facets: Map<string, DocFacets>;
  ds: Dataset;
  now: Date;
  deletedTitles: Map<string, string>;
}

export function VaultResults({ hits, facets, ds, now }: Props) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: hits.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 14,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="t-overline grid shrink-0 items-center gap-3 border-b border-line bg-surface-2 px-3 py-1.5 text-text-lo"
        style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,1.2fr) minmax(0,1.4fr) 92px 84px" }}
      >
        <span>Document</span>
        <span>Type</span>
        <span>Linked entity</span>
        <span className="text-right">Uploaded</span>
        <span className="text-right">Expiry</span>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto" role="region" aria-label="Search results">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {rowVirtualizer.getVirtualItems().map((v) => {
            const hit = hits[v.index]!;
            const doc = hit.doc;
            const f = facetsOf(doc, facets, ds);
            const days = doc.expiresOn ? daysBetween(now, doc.expiresOn) : null;
            const expTone = days === null ? null : days < 0 ? "danger" : days <= 30 ? "warn" : days <= 60 ? "info" : null;
            return (
              <div
                key={doc.id}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: v.size, transform: `translateY(${v.start}px)` }}
              >
                <Link
                  href={`/vault/${doc.id}${hit.terms.length ? `?q=${encodeURIComponent(hit.terms.join(" "))}` : ""}`}
                  className={cn(
                    "grid h-full items-center gap-3 border-b border-line px-3 hover:bg-surface-2",
                    "focus-visible:bg-surface-2",
                  )}
                  style={{ gridTemplateColumns: "minmax(0,3fr) minmax(0,1.2fr) minmax(0,1.4fr) 92px 84px" }}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="t-body-sm truncate text-text-hi">
                      <Highlight text={doc.title} terms={hit.terms} />
                    </span>
                    {hit.snippet ? (
                      <span className="t-body-sm truncate text-text-lo">
                        <span className="text-text-mid">{hit.snippet.heading}: </span>
                        <Highlight text={hit.snippet.text} terms={hit.terms} />
                      </span>
                    ) : hit.matchedIn.length ? (
                      <span className="t-body-sm truncate text-text-lo">Matched in {hit.matchedIn.join(", ").toLowerCase()}</span>
                    ) : null}
                  </span>
                  <span className="t-body-sm truncate text-text-mid">{f.typeLabel}</span>
                  <span className="t-body-sm truncate text-text-mid">
                    <Highlight text={f.linkedLabel} terms={hit.terms} />
                  </span>
                  <span className="t-mono truncate text-right text-[0.75rem] text-text-mid" data-numeric>
                    {formatDate(doc.uploadedAt)}
                  </span>
                  <span className="flex justify-end">
                    {days === null ? (
                      <span className="t-body-sm text-text-lo">—</span>
                    ) : expTone ? (
                      <StatusBadge tone={expTone} icon={false}>{days < 0 ? `${-days}d ago` : `${days}d`}</StatusBadge>
                    ) : (
                      <span className="t-mono text-[0.75rem] text-text-lo" data-numeric>{formatDate(doc.expiresOn!)}</span>
                    )}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
