"use client";

import * as React from "react";
import { FilePlus2, X } from "lucide-react";
import type { Dataset, PravaahDocument } from "@/lib/schemas";
import type { DocumentCategory, DocumentType } from "@/lib/schemas/enums";
import { zDocumentType } from "@/lib/schemas/enums";
import { enumLabel } from "@/lib/format";
import { Overline , Explainer } from "@/components/patterns/primitives";
import { CATEGORY_LABEL, CATEGORY_ORDER, type Viewer } from "./access";
import { addCreatedDocument, recordAudit } from "./store";

/**
 * E10-S1 AC2 / FR-M9-02 — creation captures title, type, category, linked
 * entity, owner, upload date, version, effective and expiry dates, tags,
 * access level and file metadata. Nothing is optional by accident: every
 * field on the entity is on this form.
 */

const field = "h-8 w-full rounded-md border border-line bg-surface-1 px-2 text-[0.8125rem] text-text-hi placeholder:text-text-lo hover:border-line-strong";

const LINKED_TYPES: PravaahDocument["linkedType"][] = ["COMPANY", "CUSTOMER", "PROJECT", "ASSET", "EMPLOYEE"];

export function NewDocumentPanel({
  ds, viewer, todayIso, onClose,
}: { ds: Dataset; viewer: Viewer; todayIso: string; onClose: () => void }) {
  const today = todayIso.slice(0, 10);
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<DocumentType>("OTHER");
  const [category, setCategory] = React.useState<DocumentCategory>("COMPANY");
  const [linkedType, setLinkedType] = React.useState<PravaahDocument["linkedType"]>("COMPANY");
  const [linkedId, setLinkedId] = React.useState("");
  const [ownerUserId, setOwnerUserId] = React.useState(viewer.userId);
  const [uploadedAt, setUploadedAt] = React.useState(today);
  const [version, setVersion] = React.useState(1);
  const [effectiveFrom, setEffectiveFrom] = React.useState(today);
  const [expiresOn, setExpiresOn] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [accessLevel, setAccessLevel] = React.useState<PravaahDocument["accessLevel"]>("GENERAL");
  const [mime, setMime] = React.useState("application/pdf");
  const [sizeKb, setSizeKb] = React.useState(640);
  const [pageCount, setPageCount] = React.useState(4);
  const [revision, setRevision] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const linkedOptions = React.useMemo(() => {
    if (linkedType === "CUSTOMER") return ds.customers.slice(0, 120).map((c) => ({ id: c.id, label: c.tradeName }));
    if (linkedType === "PROJECT") return ds.projects.map((p) => ({ id: p.id, label: p.name }));
    if (linkedType === "ASSET") return ds.assets.slice(0, 120).map((a) => ({ id: a.id, label: `${a.serial} · ${a.model}` }));
    if (linkedType === "EMPLOYEE") return ds.employees.slice(0, 120).map((e) => ({ id: e.id, label: `${e.code} · ${e.name}` }));
    return [];
  }, [linkedType, ds]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 4) { setError("A title of at least four characters is required."); return; }
    if (linkedType !== "COMPANY" && !linkedId) { setError("Choose the record this document belongs to, or link it to the company."); return; }

    const id = `DOC-L${Date.now().toString(36).toUpperCase()}`;
    const doc: PravaahDocument = {
      id,
      title: title.trim(),
      type, category,
      linkedType,
      linkedId: linkedType === "COMPANY" ? null : linkedId,
      ownerUserId,
      uploadedAt: new Date(uploadedAt).toISOString(),
      version,
      supersedesId: null,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
      expiresOn: expiresOn ? new Date(expiresOn).toISOString() : null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      accessLevel,
      mime, sizeKb, pageCount,
      revision: revision.trim() || null,
      approvalState: "DRAFT",
      passages: [{
        id: `p-${id}`,
        heading: "Summary",
        text: "Uploaded in this session. No indexed body text — the answer layer will treat this document as catalogue-only until its content is indexed.",
      }],
      deletedAt: null,
      deletedReason: null,
    };

    addCreatedDocument(doc);
    recordAudit({
      actorUserId: viewer.userId, actorName: viewer.name, actorRole: viewer.role,
      action: "CREATE", documentId: id, documentTitle: doc.title,
      summary: `Document created in ${CATEGORY_LABEL[category]} — ${enumLabel(type)}, access level ${accessLevel}, version ${version}.`,
    });
    onClose();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-b border-line bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <h3 className="t-heading-md flex items-center gap-2 text-text-hi">
          <FilePlus2 className="size-4 text-text-mid" aria-hidden /> Add a document
        </h3>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-md border border-line text-text-mid hover:text-text-hi">
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <Overline>Title</Overline>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Third-Party Test Certificate — Tank" />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Type</Overline>
          <select className={field} value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
            {zDocumentType.options.map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Category</Overline>
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Linked to</Overline>
          <select
            className={field}
            value={linkedType ?? "COMPANY"}
            onChange={(e) => { setLinkedType(e.target.value as PravaahDocument["linkedType"]); setLinkedId(""); }}
          >
            {LINKED_TYPES.map((t) => <option key={t} value={t ?? "COMPANY"}>{enumLabel(t ?? "COMPANY")}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Linked record</Overline>
          <select className={field} value={linkedId} onChange={(e) => setLinkedId(e.target.value)} disabled={linkedType === "COMPANY"}>
            <option value="">{linkedType === "COMPANY" ? "Bhushancorp Private Limited" : "Choose…"}</option>
            {linkedOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Owner</Overline>
          <select className={field} value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
            {ds.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Upload date</Overline>
          <input type="date" className={field} value={uploadedAt} onChange={(e) => setUploadedAt(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Version</Overline>
          <input type="number" min={1} className={field} value={version} onChange={(e) => setVersion(Number(e.target.value) || 1)} />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Effective from</Overline>
          <input type="date" className={field} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Expires on</Overline>
          <input type="date" className={field} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Access level</Overline>
          <select className={field} value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as PravaahDocument["accessLevel"])}>
            {(["GENERAL", "COMMERCIAL", "HR", "RESTRICTED"] as const).map((a) => <option key={a} value={a}>{enumLabel(a)}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <Overline>Tags (comma separated)</Overline>
          <input className={field} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="test, treatment, statutory" />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>MIME type</Overline>
          <input className={field} value={mime} onChange={(e) => setMime(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Size (KB)</Overline>
          <input type="number" min={1} className={field} value={sizeKb} onChange={(e) => setSizeKb(Number(e.target.value) || 1)} />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Page count</Overline>
          <input type="number" min={1} className={field} value={pageCount} onChange={(e) => setPageCount(Number(e.target.value) || 1)} />
        </label>

        <label className="flex flex-col gap-1">
          <Overline>Revision</Overline>
          <input className={field} value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="R0" />
        </label>
      </div>

      {error ? <p className="t-body-sm text-danger">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button type="submit" className="t-body-sm rounded-md bg-primary-600 px-3 py-1.5 text-white hover:bg-primary-500">
          Create document
        </button>
        <Explainer className="text-text-lo">
          Stored in this browser under <span className="t-mono">pravaah.v1.vault.created</span> and written to the vault activity log. The seeded corpus is not altered.
        </Explainer>
      </div>
    </form>
  );
}
