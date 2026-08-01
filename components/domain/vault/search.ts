import type { Dataset, PravaahDocument } from "@/lib/schemas";
import { enumLabel } from "@/lib/format";
import type { DocumentCategory, DocumentType } from "@/lib/schemas/enums";
import { CATEGORY_LABEL } from "./access";

/**
 * E10-S2 AC1 / FR-M9-13 — full-text and metadata search, executed together and
 * entirely independently of the AI answer path. Nothing on this path touches
 * the question bank, the retrieval simulation or the streaming layer: a user
 * is never obliged to hold a conversation to find a file.
 */

export interface DocFacets {
  ownerName: string;
  linkedLabel: string;
  linkedHref: string | null;
  typeLabel: string;
  categoryLabel: string;
}

export function buildFacetIndex(ds: Dataset): Map<string, DocFacets> {
  const users = new Map(ds.users.map((u) => [u.id, u.name]));
  const projects = new Map(ds.projects.map((p) => [p.id, p]));
  const customers = new Map(ds.customers.map((c) => [c.id, c]));
  const assets = new Map(ds.assets.map((a) => [a.id, a]));
  const employees = new Map(ds.employees.map((e) => [e.id, e]));

  const out = new Map<string, DocFacets>();
  for (const doc of ds.documents) out.set(doc.id, facetsFor(doc));
  return out;

  function facetsFor(doc: PravaahDocument): DocFacets {
    let linkedLabel = "Bhushancorp Private Limited";
    let linkedHref: string | null = null;
    if (doc.linkedId && doc.linkedType && doc.linkedType !== "COMPANY") {
      if (doc.linkedType === "PROJECT") {
        const p = projects.get(doc.linkedId);
        if (p) { linkedLabel = p.name; linkedHref = `/projects/${p.id}`; }
      } else if (doc.linkedType === "CUSTOMER") {
        const c = customers.get(doc.linkedId);
        if (c) { linkedLabel = c.tradeName; linkedHref = `/sales/customers/${c.id}`; }
      } else if (doc.linkedType === "ASSET") {
        const a = assets.get(doc.linkedId);
        if (a) { linkedLabel = `${a.model} · ${a.serial}`; linkedHref = `/service/assets/${a.serial}`; }
      } else if (doc.linkedType === "EMPLOYEE") {
        const e = employees.get(doc.linkedId);
        if (e) { linkedLabel = e.code; }
      }
    }
    return {
      ownerName: users.get(doc.ownerUserId) ?? doc.ownerUserId,
      linkedLabel,
      linkedHref,
      typeLabel: enumLabel(doc.type),
      categoryLabel: CATEGORY_LABEL[doc.category],
    };
  }
}

export function facetsOf(doc: PravaahDocument, index: Map<string, DocFacets>, ds: Dataset): DocFacets {
  const found = index.get(doc.id);
  if (found) return found;
  // Locally created documents are not in the seeded index.
  const owner = ds.users.find((u) => u.id === doc.ownerUserId);
  return {
    ownerName: owner?.name ?? doc.ownerUserId,
    linkedLabel: "Bhushancorp Private Limited",
    linkedHref: null,
    typeLabel: enumLabel(doc.type),
    categoryLabel: CATEGORY_LABEL[doc.category],
  };
}

/* ----------------------------------------------------------------- filters */

export interface VaultFilters {
  query: string;
  categories: DocumentCategory[];
  types: DocumentType[];
  linkedIds: string[];
  owners: string[];
  tags: string[];
  from: string;
  to: string;
  expiry: "" | "EXPIRED" | "D30" | "D60" | "HAS_EXPIRY" | "NO_EXPIRY";
}

export const EMPTY_FILTERS: VaultFilters = {
  query: "", categories: [], types: [], linkedIds: [], owners: [], tags: [],
  from: "", to: "", expiry: "",
};

export function activeFilterCount(f: VaultFilters): number {
  return (f.query ? 1 : 0) + f.categories.length + f.types.length + f.linkedIds.length +
    f.owners.length + f.tags.length + (f.from ? 1 : 0) + (f.to ? 1 : 0) + (f.expiry ? 1 : 0);
}

/* ------------------------------------------------------------------ search */

export interface SearchHit {
  doc: PravaahDocument;
  score: number;
  /** Where the terms matched, in plain language, for the result row. */
  matchedIn: string[];
  /** The strongest matching passage, for the snippet. */
  snippet: { heading: string; text: string; passageId: string } | null;
  terms: string[];
}

export function tokenise(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s#/&.-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "are", "was", "our", "from", "what", "which", "who", "does", "any", "all"]);

export function searchDocuments(
  documents: PravaahDocument[],
  filters: VaultFilters,
  facets: Map<string, DocFacets>,
  ds: Dataset,
  now: Date,
): SearchHit[] {
  const terms = tokenise(filters.query).filter((t) => !STOP.has(t));
  const fromMs = filters.from ? new Date(filters.from).getTime() : null;
  const toMs = filters.to ? new Date(filters.to).getTime() + 86_399_999 : null;

  const hits: SearchHit[] = [];

  for (const doc of documents) {
    if (filters.categories.length && !filters.categories.includes(doc.category)) continue;
    if (filters.types.length && !filters.types.includes(doc.type)) continue;
    if (filters.owners.length && !filters.owners.includes(doc.ownerUserId)) continue;
    if (filters.linkedIds.length && !(doc.linkedId && filters.linkedIds.includes(doc.linkedId))) continue;
    if (filters.tags.length && !filters.tags.some((t) => doc.tags.includes(t))) continue;

    const uploaded = new Date(doc.uploadedAt).getTime();
    if (fromMs !== null && uploaded < fromMs) continue;
    if (toMs !== null && uploaded > toMs) continue;

    if (filters.expiry) {
      const exp = doc.expiresOn ? new Date(doc.expiresOn).getTime() : null;
      if (filters.expiry === "NO_EXPIRY" && exp !== null) continue;
      if (filters.expiry !== "NO_EXPIRY" && exp === null) continue;
      if (exp !== null) {
        const days = Math.round((exp - now.getTime()) / 86_400_000);
        if (filters.expiry === "EXPIRED" && days >= 0) continue;
        if (filters.expiry === "D30" && (days < 0 || days > 30)) continue;
        if (filters.expiry === "D60" && (days < 0 || days > 60)) continue;
      }
    }

    if (!terms.length) {
      hits.push({ doc, score: 0, matchedIn: [], snippet: null, terms: [] });
      continue;
    }

    const f = facetsOf(doc, facets, ds);
    const title = doc.title.toLowerCase();
    const tagBlob = doc.tags.join(" ").toLowerCase();
    const metaBlob = `${f.typeLabel} ${f.categoryLabel} ${f.ownerName} ${f.linkedLabel} ${doc.id} ${doc.revision ?? ""} ${doc.approvalState ?? ""}`.toLowerCase();

    let score = 0;
    const matchedIn = new Set<string>();
    let best: SearchHit["snippet"] = null;
    let bestScore = 0;

    for (const term of terms) {
      if (title.includes(term)) { score += 12; matchedIn.add("Title"); }
      if (tagBlob.includes(term)) { score += 6; matchedIn.add("Tags"); }
      if (metaBlob.includes(term)) { score += 5; matchedIn.add("Metadata"); }
      for (const p of doc.passages) {
        const hay = `${p.heading} ${p.text}`.toLowerCase();
        if (!hay.includes(term)) continue;
        score += 4;
        matchedIn.add("Document text");
        const local = (p.text.toLowerCase().split(term).length - 1) * 2 + 1;
        if (local > bestScore) {
          bestScore = local;
          best = { heading: p.heading, text: p.text, passageId: p.id };
        }
      }
    }

    // Every term must appear somewhere — AND semantics, not OR soup.
    const allMatched = terms.every((term) =>
      title.includes(term) || tagBlob.includes(term) || metaBlob.includes(term) ||
      doc.passages.some((p) => `${p.heading} ${p.text}`.toLowerCase().includes(term)));
    if (!allMatched || score === 0) continue;

    hits.push({ doc, score, matchedIn: [...matchedIn], snippet: best, terms });
  }

  if (terms.length) {
    hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  } else {
    hits.sort((a, b) => new Date(b.doc.uploadedAt).getTime() - new Date(a.doc.uploadedAt).getTime());
  }
  return hits;
}

/* -------------------------------------------------------------- highlight */

export interface Segment { text: string; hit: boolean }

/** Splits text into matched / unmatched runs so the caller can mark the matches. */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  const usable = terms.filter((t) => t.length > 1);
  if (!usable.length) return [{ text, hit: false }];
  const escaped = usable.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts
    .filter((p) => p !== "")
    .map((p) => ({ text: p, hit: usable.some((t) => p.toLowerCase() === t.toLowerCase()) }));
}
