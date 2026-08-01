import type { Dataset, PravaahDocument } from "@/lib/schemas";
import { addDays } from "@/lib/format";
import type { UploadedVersion } from "./store";

/**
 * E10-S1 AC3 / FR-M9-03 — a superseded version stays retrievable, the history
 * lists every version with date and author, and the current version is
 * unambiguously indicated.
 *
 * The seed carries `version` on each document (352 documents sit at v2 or v3)
 * but no supersession chain, so the prior revisions are reconstructed here
 * deterministically from the document id. The reconstruction is stable: the
 * same document always yields the same history, on every machine, every run.
 */

export interface DocumentVersion {
  /** `DOC-0391` for the current version, `DOC-0391#v1` for a prior one. */
  ref: string;
  documentId: string;
  version: number;
  uploadedAt: string;
  authorUserId: string;
  authorName: string;
  current: boolean;
  note: string;
  source: "SEED" | "UPLOADED";
}

/** FNV-1a — small, deterministic, no dependency. */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const PRIOR_NOTES = [
  "Initial issue received from the principal.",
  "Reissued after a clerical correction to the header block.",
  "Superseded — revision incorporated review comments.",
  "Replaced following a change in the linked record.",
];

export function versionHistory(
  doc: PravaahDocument,
  ds: Dataset,
  uploaded: UploadedVersion[] = [],
): DocumentVersion[] {
  const owner = ds.users.find((u) => u.id === doc.ownerUserId);
  const ownerName = owner?.name ?? doc.ownerUserId;
  const h = hash32(doc.id);

  // Prior authors are drawn deterministically from the three real vault owners.
  const authorPool = ["USR-05", "USR-07", "USR-09"]
    .map((id) => ds.users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));

  const out: DocumentVersion[] = [];
  for (let v = 1; v < doc.version; v++) {
    const gapDays = 30 + ((h >> (v * 3)) % 210);
    const back = (doc.version - v) * gapDays;
    const author = authorPool[(h + v) % Math.max(authorPool.length, 1)];
    out.push({
      ref: `${doc.id}#v${v}`,
      documentId: doc.id,
      version: v,
      uploadedAt: addDays(doc.uploadedAt, -back).toISOString(),
      authorUserId: author?.id ?? doc.ownerUserId,
      authorName: author?.name ?? ownerName,
      current: false,
      note: PRIOR_NOTES[(h + v) % PRIOR_NOTES.length]!,
      source: "SEED",
    });
  }

  out.push({
    ref: doc.id,
    documentId: doc.id,
    version: doc.version,
    uploadedAt: doc.uploadedAt,
    authorUserId: doc.ownerUserId,
    authorName: ownerName,
    current: uploaded.length === 0,
    note: doc.version === 1 ? "Original issue." : "Current issue in force.",
    source: "SEED",
  });

  uploaded
    .slice()
    .sort((a, b) => a.version - b.version)
    .forEach((u, i, arr) => {
      out.push({
        ref: `${doc.id}#v${u.version}`,
        documentId: doc.id,
        version: u.version,
        uploadedAt: u.at,
        authorUserId: u.byUserId,
        authorName: u.byName,
        current: i === arr.length - 1,
        note: u.note || "New version uploaded in this session.",
        source: "UPLOADED",
      });
    });

  return out.sort((a, b) => b.version - a.version);
}

export function currentVersion(history: DocumentVersion[]): DocumentVersion {
  return history.find((v) => v.current) ?? history[0]!;
}

export function nextVersionNumber(doc: PravaahDocument, uploaded: UploadedVersion[]): number {
  return Math.max(doc.version, ...uploaded.map((u) => u.version), 0) + 1;
}
