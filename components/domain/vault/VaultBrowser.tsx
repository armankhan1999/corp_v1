"use client";

import * as React from "react";
import Link from "next/link";
import { FilePlus2, Info, Trash2 } from "lucide-react";
import { getDataset } from "@/lib/seed";
import { formatCount, formatDate } from "@/lib/format";
import { canCreate } from "@/lib/rbac/matrix";
import type { Session } from "@/lib/rbac/session";
import type { DocumentCategory, DocumentType } from "@/lib/schemas/enums";
import { Panel, PanelHeader, Overline, EmptyState, Explainer } from "@/components/patterns/primitives";
import { buildAccessIndex, buildCorpus, viewerOf, CATEGORY_LABEL } from "./access";
import { buildFacetIndex, EMPTY_FILTERS, searchDocuments, type VaultFilters as Filters } from "./search";
import { buildFilterOptions, VaultFilterBar } from "./VaultFilters";
import { buildTree, VaultTree } from "./VaultTree";
import { VaultResults } from "./VaultResults";
import { NewDocumentPanel } from "./NewDocumentPanel";
import { FilteredEmpty, RowSkeleton, useHydrated } from "./ui";
import { createdDocuments, deletions, useVaultStore } from "./store";

/**
 * E10-S1 + E10-S2 — the browse and direct-search surface.
 *
 * The search on this screen is deliberately not routed through the answer
 * layer (FR-M9-13). A user who wants a file finds the file.
 */

interface Props {
  session: Session;
  initial: { category?: string; type?: string; q?: string };
}

export function VaultBrowser({ session, initial }: Props) {
  const hydrated = useHydrated();
  useVaultStore();

  const ds = React.useMemo(() => getDataset(), []);
  const now = React.useMemo(() => new Date(ds.meta.today), [ds]);
  const viewer = React.useMemo(() => viewerOf(session, ds), [session, ds]);
  const index = React.useMemo(() => buildAccessIndex(ds, viewer), [ds, viewer]);
  const facets = React.useMemo(() => buildFacetIndex(ds), [ds]);

  const overlayCreated = hydrated ? createdDocuments() : [];
  const overlayDeleted = React.useMemo(() => (hydrated ? deletions() : {}), [hydrated]);
  const deletedIdSet = React.useMemo(() => new Set(Object.keys(overlayDeleted)), [overlayDeleted]);

  const corpus = React.useMemo(
    () => buildCorpus(ds, index, { deletedIds: deletedIdSet, extra: overlayCreated }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ds, index, deletedIdSet, overlayCreated.length],
  );

  const [filters, setFilters] = React.useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    categories: initial.category ? [initial.category as DocumentCategory] : [],
    types: initial.type ? [initial.type as DocumentType] : [],
    query: initial.q ?? "",
  }));
  const [showNew, setShowNew] = React.useState(false);

  const tree = React.useMemo(() => buildTree(corpus.documents), [corpus.documents]);
  const options = React.useMemo(() => buildFilterOptions(corpus.documents, ds), [corpus.documents, ds]);
  const hits = React.useMemo(
    () => searchDocuments(corpus.documents, filters, facets, ds, now),
    [corpus.documents, filters, facets, ds, now],
  );

  const filterSummary = [
    filters.query && `text "${filters.query}"`,
    filters.categories.length && `${filters.categories.map((c) => CATEGORY_LABEL[c]).join(", ")} branch`,
    filters.types.length && `${filters.types.length} document type${filters.types.length === 1 ? "" : "s"}`,
    filters.owners.length && `${filters.owners.length} owner${filters.owners.length === 1 ? "" : "s"}`,
    filters.linkedIds.length && `${filters.linkedIds.length} linked record${filters.linkedIds.length === 1 ? "" : "s"}`,
    filters.tags.length && `tag ${filters.tags.join(", ")}`,
    filters.from && `uploaded from ${filters.from}`,
    filters.to && `uploaded to ${filters.to}`,
    filters.expiry && `expiry state ${filters.expiry.toLowerCase()}`,
  ].filter(Boolean).join("; ");

  const deletedList = Object.values(overlayDeleted);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader
          title="Document Vault"
          sub={`${formatCount(corpus.documents.length)} of ${formatCount(corpus.totalInVault)} documents are open to ${session.name} · organised under the eight branches below`}
          right={
            <div className="flex items-center gap-2">
              <Link href="/vault/ask" className="t-body-sm rounded-md border border-line px-2.5 py-1.5 text-text-mid hover:border-line-strong hover:text-text-hi">
                Ask the Vault
              </Link>
              {canCreate(session.role, "vault") ? (
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  className="t-body-sm inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-2.5 py-1.5 text-white hover:bg-primary-500"
                >
                  <FilePlus2 className="size-3.5" aria-hidden /> Add document
                </button>
              ) : null}
            </div>
          }
        />

        {showNew ? (
          <NewDocumentPanel ds={ds} viewer={viewer} todayIso={ds.meta.today} onClose={() => setShowNew(false)} />
        ) : null}

        <div className="flex items-start gap-2 border-b border-line bg-surface-0/40 px-4 py-2">
          <Info className="mt-0.5 size-3.5 shrink-0 text-text-lo" aria-hidden />
          <Explainer className="text-text-mid">
            <span className="text-text-hi">How access is decided.</span> A document is shown when your role holds the
            vault capability, when it holds the document&apos;s access level, and when you can open the record the
            document belongs to. Company-wide reference material is not record-scoped. A denial discloses no title
            and no metadata, and is written to the activity log.
          </Explainer>
        </div>

        <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="border-b border-line lg:border-b-0 lg:border-r">
            {hydrated ? (
              <VaultTree
                tree={tree}
                denied={corpus.denied}
                selectedCategories={filters.categories}
                selectedTypes={filters.types}
                total={corpus.documents.length}
                onSelectAll={() => setFilters((f) => ({ ...f, categories: [], types: [] }))}
                onSelectCategory={(c) => setFilters((f) => ({
                  ...f,
                  categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
                  types: [],
                }))}
                onSelectType={(c, t) => setFilters((f) => ({
                  ...f,
                  categories: f.categories.includes(c) ? f.categories : [...f.categories, c],
                  types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t],
                }))}
              />
            ) : (
              <RowSkeleton rows={9} />
            )}
          </div>

          <div className="flex min-h-0 flex-col">
            <VaultFilterBar filters={filters} options={options} resultCount={hits.length} onChange={setFilters} />
            <div className="flex h-[calc(100dvh-30rem)] min-h-80 flex-col">
              {!hydrated ? (
                <RowSkeleton />
              ) : hits.length === 0 && corpus.documents.length === 0 ? (
                <EmptyState
                  title="No document is open to your role"
                  body="Every branch of the vault is scoped to a record type your role cannot read. Ask an administrator to widen the permission, or use Ask the Vault, which searches only what you may see."
                />
              ) : hits.length === 0 ? (
                <FilteredEmpty filterSummary={filterSummary} onClear={() => setFilters(EMPTY_FILTERS)} />
              ) : (
                <VaultResults hits={hits} facets={facets} ds={ds} now={now} deletedTitles={new Map()} />
              )}
            </div>
          </div>
        </div>
      </Panel>

      {deletedList.length ? (
        <Panel>
          <PanelHeader
            title="Deleted documents"
            sub="E10-S1 — a deleted document is retained as a deleted record with its actor and reason. Nothing is removed."
          />
          <ul className="divide-y divide-line">
            {deletedList.map((d) => (
              <li key={d.documentId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                <Trash2 className="size-3.5 shrink-0 text-danger" aria-hidden />
                <span className="t-body-sm text-text-hi">{d.documentTitle}</span>
                <span className="t-mono text-[0.75rem] text-text-lo">{d.documentId}</span>
                <span className="t-body-sm text-text-mid">Deleted by {d.byName} on {formatDate(d.at)}</span>
                <span className="t-body-sm text-text-mid">Reason: {d.reason}</span>
                <Link href={`/vault/${d.documentId}`} className="t-body-sm ml-auto text-primary-400 hover:text-primary-500">
                  Open deleted record
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="px-4 py-3">
        <Overline>Branch counts</Overline>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          {tree.map((b) => (
            <span key={b.category} className="t-body-sm text-text-mid">
              {CATEGORY_LABEL[b.category]} <span className="t-mono text-text-hi" data-numeric>{formatCount(b.count)}</span>
            </span>
          ))}
          {corpus.denied.map((d) => (
            <span key={d.category} className="t-body-sm text-text-lo">
              {CATEGORY_LABEL[d.category]} restricted
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
