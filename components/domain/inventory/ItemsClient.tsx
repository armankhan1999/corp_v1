"use client";

/**
 * E7-S1 — Unified item master.
 *
 * One register serving sales, service, projects and purchasing. Every field the
 * AC names is captured, duplicates on code or OEM part number are blocked with a
 * link to the offending record, and a referenced item cannot be deleted — the
 * screen states the reference count and offers deactivation instead.
 */

import * as React from "react";
import Link from "next/link";
import {
  Boxes, FileText, HardHat, Layers, Link2, Package, PackagePlus, Pencil, Power,
  Receipt, ShoppingCart, Trash2, Wrench,
} from "lucide-react";
import { formatCount, formatINR, formatPercent, formatQty } from "@/lib/format";
import { Panel, Overline, StatusBadge, KeyValue, EmptyState } from "@/components/patterns/primitives";
import {
  OEM_LABEL, PRODUCT_LINE_LABEL, type ItemCategory, type OEMPrincipal, type ProductLine,
} from "@/lib/schemas/enums";
import type * as T from "@/lib/schemas/entities";
import { canCreate, canDelete, canWrite } from "@/lib/rbac/matrix";
import {
  CATEGORY_LABEL, describeFilters, filterItems, referencesTo, totalReferences,
  useInventory, type ItemFilters, type InvView,
} from "./model";
import { createItem, useMutate, writeAudit, type ItemDraft } from "./store";
import {
  ActionResult, Blocked, Btn, ChipGroup, Column, Field, FilteredEmpty, MetricStrip, Modal, MonoCell,
  Note, Num, NumInput, PageHeader, PageSkeleton, SearchField, Select, SelectField, TextInput, Toolbar,
  VirtualTable,
} from "./ui";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ItemCategory[];
const PRINCIPALS = Object.keys(OEM_LABEL) as OEMPrincipal[];
const PRODUCT_LINES = Object.keys(PRODUCT_LINE_LABEL) as ProductLine[];

/** FR-M6-02 — the five consumers of the single master, stated on screen. */
const CONSUMERS: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Quotations", href: "/sales/quotations", icon: FileText },
  { label: "Sales orders", href: "/sales/orders", icon: ShoppingCart },
  { label: "Job cards", href: "/service/job-cards", icon: Wrench },
  { label: "Project BOQs", href: "/projects", icon: HardHat },
  { label: "Purchase orders", href: "/inventory/purchase", icon: Receipt },
];

const EMPTY_DRAFT: ItemDraft = {
  code: "",
  description: "",
  category: "SPARE",
  principal: "ELGI",
  productLine: null,
  oemPartNumber: "",
  uom: "Nos",
  hsnSac: "8414",
  gstRate: 18,
  standardCost: 0,
  standardPrice: 0,
  reorderLevel: 0,
  reorderQty: 0,
  leadTimeDays: 7,
  storageLocation: "",
  active: true,
};

export function ItemsClient({ initialItemId, initialQuery }: { initialItemId: string | null; initialQuery: string }) {
  const { view, ready, actor } = useInventory();
  const mutate = useMutate();

  const [filters, setFilters] = React.useState<ItemFilters>({
    query: initialQuery,
    categories: [],
    principals: [],
    status: "ALL",
  });
  const [openId, setOpenId] = React.useState<string | null>(initialItemId);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<T.Item | null>(null);
  const [draft, setDraft] = React.useState<ItemDraft>(EMPTY_DRAFT);
  const [duplicate, setDuplicate] = React.useState<{ field: string; item: T.Item } | null>(null);
  const [result, setResult] = React.useState<{ tone: "ok" | "warn"; title: string; body: React.ReactNode } | null>(null);
  const [deleteFor, setDeleteFor] = React.useState<T.Item | null>(null);

  const rows = React.useMemo(
    () => (view ? filterItems(view.items, filters) : []),
    [view, filters],
  );

  if (!ready || !view) return <PageSkeleton metrics={4} columns={9} />;

  const mayCreate = canCreate(actor.role, "items");
  const mayEdit = canWrite(actor.role, "items");
  const mayDelete = canDelete(actor.role, "items");

  const active = view.items.filter((i) => i.active).length;
  const created = view.overlay.newItems.length;
  const openItem = openId ? view.itemById.get(openId) ?? null : null;

  const activeFilters = describeFilters(filters);
  const clearFilters = () =>
    setFilters({ query: "", categories: [], principals: [], status: "ALL" });

  function findDuplicate(d: ItemDraft, selfId: string | null): { field: string; item: T.Item } | null {
    const code = d.code.trim().toLowerCase();
    const part = d.oemPartNumber.trim().toLowerCase();
    for (const i of view!.items) {
      if (i.id === selfId) continue;
      if (code && i.code.trim().toLowerCase() === code) return { field: "Item code", item: i };
      if (part && i.oemPartNumber.trim().toLowerCase() === part) return { field: "OEM part number", item: i };
    }
    return null;
  }

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setDuplicate(null);
    setFormOpen(true);
  }

  function openEdit(item: T.Item) {
    setEditing(item);
    setDraft({ ...item });
    setDuplicate(null);
    setFormOpen(true);
  }

  function submit() {
    const dup = findDuplicate(draft, editing?.id ?? null);
    if (dup) {
      setDuplicate(dup);
      return;
    }
    if (!draft.code.trim() || !draft.description.trim()) {
      setDuplicate(null);
      return;
    }
    const at = new Date().toISOString();
    if (editing) {
      const before = editing;
      mutate((o) => {
        o.itemPatches[before.id] = { ...(o.itemPatches[before.id] ?? {}), ...draft };
        writeAudit(o, actor, {
          at,
          action: "UPDATE",
          entityType: "Item",
          entityId: before.id,
          entityLabel: draft.code,
          summary: `Item master updated — ${draft.description}`,
          before: `${before.code} · ${before.description} · ${before.active ? "Active" : "Inactive"}`,
          after: `${draft.code} · ${draft.description} · ${draft.active ? "Active" : "Inactive"}`,
        });
      });
      setResult({
        tone: "ok",
        title: `${draft.code} updated`,
        body: "The change is live in every module that reads the master.",
      });
      setOpenId(before.id);
    } else {
      let newId = "";
      mutate((o) => {
        const item = createItem(o, draft, view!.items.length);
        newId = item.id;
        writeAudit(o, actor, {
          at,
          action: "CREATE",
          entityType: "Item",
          entityId: item.id,
          entityLabel: item.code,
          summary: `Item created — ${item.description}`,
          before: null,
          after: `${item.code} · ${CATEGORY_LABEL[item.category]} · ${OEM_LABEL[item.principal]}`,
        });
      });
      setResult({
        tone: "ok",
        title: `${draft.code} created — already available everywhere`,
        body: (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>No separate master exists. This item can be selected right now in</span>
            {CONSUMERS.map((c, i) => (
              <span key={c.href} className="inline-flex items-center gap-1">
                <Link href={c.href} className="text-info underline underline-offset-2">
                  {c.label}
                </Link>
                {i < CONSUMERS.length - 1 ? <span aria-hidden>·</span> : null}
              </span>
            ))}
          </span>
        ),
      });
      setOpenId(newId);
    }
    setFormOpen(false);
  }

  function toggleActive(item: T.Item) {
    const at = new Date().toISOString();
    mutate((o) => {
      o.itemPatches[item.id] = { ...(o.itemPatches[item.id] ?? {}), active: !item.active };
      writeAudit(o, actor, {
        at,
        action: "STATE_TRANSITION",
        entityType: "Item",
        entityId: item.id,
        entityLabel: item.code,
        summary: `Item ${item.active ? "deactivated" : "reactivated"}`,
        before: item.active ? "Active" : "Inactive",
        after: item.active ? "Inactive" : "Active",
      });
    });
    setDeleteFor(null);
    setResult({
      tone: "ok",
      title: `${item.code} ${item.active ? "deactivated" : "reactivated"}`,
      body: item.active
        ? "History is preserved. The item can no longer be selected on new documents."
        : "The item is selectable again on new documents.",
    });
  }

  const columns: Column<T.Item>[] = [
    {
      key: "code",
      header: "Item code",
      width: "116px",
      cell: (i) => <MonoCell>{i.code}</MonoCell>,
    },
    {
      key: "description",
      header: "Description",
      width: "minmax(240px, 1.6fr)",
      cell: (i) => (
        <span className={i.active ? "text-text-hi" : "text-text-lo line-through"}>{i.description}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      width: "116px",
      cell: (i) => <span className="text-text-mid">{CATEGORY_LABEL[i.category]}</span>,
    },
    {
      key: "principal",
      header: "Principal",
      width: "104px",
      cell: (i) => <span className="text-text-mid">{OEM_LABEL[i.principal]}</span>,
    },
    {
      key: "oem",
      header: "OEM part no.",
      width: "126px",
      cell: (i) => <MonoCell className="text-text-mid">{i.oemPartNumber}</MonoCell>,
    },
    { key: "uom", header: "UOM", width: "56px", cell: (i) => <span className="text-text-mid">{i.uom}</span> },
    {
      key: "hsn",
      header: "HSN/SAC",
      width: "84px",
      cell: (i) => <MonoCell className="text-text-mid">{i.hsnSac}</MonoCell>,
    },
    { key: "gst", header: "GST", width: "58px", align: "right", cell: (i) => <Num tone="lo">{formatPercent(i.gstRate, 0)}</Num> },
    { key: "cost", header: "Std cost", width: "96px", align: "right", cell: (i) => <Num>{formatINR(i.standardCost)}</Num> },
    { key: "price", header: "Std price", width: "96px", align: "right", cell: (i) => <Num>{formatINR(i.standardPrice)}</Num> },
    {
      key: "reorder",
      header: "Reorder lvl / qty",
      width: "116px",
      align: "right",
      cell: (i) => (
        <Num tone="lo">
          {formatQty(i.reorderLevel)} / {formatQty(i.reorderQty)}
        </Num>
      ),
    },
    { key: "lead", header: "Lead", width: "62px", align: "right", cell: (i) => <Num tone="lo">{i.leadTimeDays}d</Num> },
    {
      key: "bin",
      header: "Storage",
      width: "84px",
      cell: (i) => <MonoCell className="text-text-lo">{i.storageLocation}</MonoCell>,
    },
    {
      key: "status",
      header: "Status",
      width: "94px",
      cell: (i) =>
        i.active ? <StatusBadge tone="ok">Active</StatusBadge> : <StatusBadge tone="neutral">Inactive</StatusBadge>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Item master"
        lede="One register for every part, machine and service line the business sells, services, builds with or buys. There is no second master anywhere in Pravaah."
        right={
          <>
            <Btn
              variant="primary"
              icon={PackagePlus}
              onClick={openCreate}
              disabled={!mayCreate}
              title={mayCreate ? undefined : "Your role may read the item master but not add to it"}
            >
              New item
            </Btn>
          </>
        }
      />

      {result ? (
        <ActionResult tone={result.tone} title={result.title} onDismiss={() => setResult(null)}>
          {result.body}
        </ActionResult>
      ) : null}

      <MetricStrip
        columns={4}
        metrics={[
          { label: "Items in master", value: formatCount(view.items.length), sub: "codes across six categories", icon: Package },
          { label: "Active", value: formatCount(active), sub: `${formatCount(view.items.length - active)} deactivated, history retained`, icon: Layers, tone: "ok" },
          { label: "Stock value held", value: formatINR(view.totalStockValue), sub: "sum of the ledger at standard cost", icon: Boxes, href: "/inventory/stock" },
          { label: "Added this session", value: formatCount(created), sub: created ? "immediately usable in all five modules" : "nothing added yet", icon: PackagePlus },
        ]}
      />

      <Note tone="info" title="One master, no parallel registers — FR-M6-02" icon={Link2}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          An item saved here becomes selectable the same instant in
          {CONSUMERS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-1 px-1.5 py-0.5 text-text-hi hover:border-line-strong"
            >
              <c.icon className="size-3" aria-hidden />
              {c.label}
            </Link>
          ))}
          — with the same code, description, HSN/SAC and GST treatment in each.
        </span>
      </Note>

      <Panel>
        <Toolbar>
          <SearchField
            label="Search the item master"
            placeholder="Item code, description or OEM part number"
            value={filters.query}
            onChange={(v) => setFilters((f) => ({ ...f, query: v }))}
            width="w-80"
          />
          <ChipGroup
            label="Category"
            options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
            selected={filters.categories}
            onToggle={(v) =>
              setFilters((f) => ({
                ...f,
                categories: f.categories.includes(v) ? f.categories.filter((x) => x !== v) : [...f.categories, v],
              }))
            }
          />
          <ChipGroup
            label="Principal"
            options={PRINCIPALS.map((p) => ({ value: p, label: OEM_LABEL[p] }))}
            selected={filters.principals}
            onToggle={(v) =>
              setFilters((f) => ({
                ...f,
                principals: f.principals.includes(v) ? f.principals.filter((x) => x !== v) : [...f.principals, v],
              }))
            }
          />
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            options={[
              { value: "ALL", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
          <span className="t-body-sm ml-auto text-text-lo">
            <span className="t-mono text-text-mid">{formatCount(rows.length)}</span> of{" "}
            <span className="t-mono">{formatCount(view.items.length)}</span> items
          </span>
          {activeFilters.length ? (
            <Btn size="sm" onClick={clearFilters}>
              Clear filters
            </Btn>
          ) : null}
        </Toolbar>

        {rows.length === 0 ? (
          activeFilters.length ? (
            <FilteredEmpty filters={activeFilters} onClear={clearFilters} total={view.items.length} />
          ) : (
            <EmptyState
              icon={Package}
              title="The item master is empty"
              body="Nothing can be quoted, issued or purchased until at least one item exists. Create the first code to start."
              action={<Btn variant="primary" icon={PackagePlus} onClick={openCreate}>Create the first item</Btn>}
            />
          )
        ) : (
          <VirtualTable
            ariaLabel="Item master"
            rows={rows}
            columns={columns}
            rowKey={(i) => i.id}
            activeKey={openId}
            onRowClick={(i) => setOpenId(i.id)}
            height={560}
            rowTone={(i) => (i.active ? null : "warn")}
          />
        )}
      </Panel>

      {openItem ? (
        <ItemDetail
          view={view}
          item={openItem}
          onClose={() => setOpenId(null)}
          onEdit={mayEdit ? () => openEdit(openItem) : null}
          onToggleActive={mayEdit ? () => toggleActive(openItem) : null}
          onDelete={mayDelete ? () => setDeleteFor(openItem) : null}
        />
      ) : null}

      {deleteFor ? (
        <DeleteBlocked
          view={view}
          item={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDeactivate={mayEdit ? () => toggleActive(deleteFor) : null}
        />
      ) : null}

      <ItemForm
        open={formOpen}
        editing={editing}
        draft={draft}
        duplicate={duplicate}
        onChange={(patch) => {
          setDraft((d) => ({ ...d, ...patch }));
          setDuplicate(null);
        }}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
        onOpenExisting={(id) => {
          setFormOpen(false);
          setOpenId(id);
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- detail */

function ItemDetail({
  view, item, onClose, onEdit, onToggleActive, onDelete,
}: {
  view: InvView;
  item: T.Item;
  onClose: () => void;
  onEdit: (() => void) | null;
  onToggleActive: (() => void) | null;
  onDelete: (() => void) | null;
}) {
  const refs = referencesTo(view, item.id);
  const total = totalReferences(refs);
  const onHand = view.onHand.get(item.id) ?? 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${item.code} — ${item.description}`}
      sub={`${CATEGORY_LABEL[item.category]} · ${OEM_LABEL[item.principal]}${item.productLine ? ` · ${PRODUCT_LINE_LABEL[item.productLine]}` : ""}`}
      footer={
        <>
          <Link
            href={`/inventory/stock/${item.id}`}
            className="t-body-sm mr-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-text-mid hover:border-line-strong hover:text-text-hi"
          >
            <Boxes className="size-3.5" aria-hidden />
            Open movement ledger
          </Link>
          {onDelete ? (
            <Btn variant="danger" icon={Trash2} onClick={onDelete}>
              Delete item
            </Btn>
          ) : null}
          {onToggleActive ? (
            <Btn icon={Power} onClick={onToggleActive}>
              {item.active ? "Deactivate" : "Reactivate"}
            </Btn>
          ) : null}
          {onEdit ? (
            <Btn variant="primary" icon={Pencil} onClick={onEdit}>
              Edit item
            </Btn>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <KeyValue label="Item code"><span className="t-mono">{item.code}</span></KeyValue>
          <KeyValue label="OEM part number"><span className="t-mono">{item.oemPartNumber}</span></KeyValue>
          <KeyValue label="Unit of measure">{item.uom}</KeyValue>
          <KeyValue label="Status">
            {item.active ? <StatusBadge tone="ok">Active</StatusBadge> : <StatusBadge tone="neutral">Inactive</StatusBadge>}
          </KeyValue>
          <KeyValue label="HSN / SAC"><span className="t-mono">{item.hsnSac}</span></KeyValue>
          <KeyValue label="GST rate">{formatPercent(item.gstRate, 0)}</KeyValue>
          <KeyValue label="Standard purchase cost">{formatINR(item.standardCost)}</KeyValue>
          <KeyValue label="Standard selling price">{formatINR(item.standardPrice)}</KeyValue>
          <KeyValue label="Reorder level">{formatQty(item.reorderLevel, item.uom)}</KeyValue>
          <KeyValue label="Reorder quantity">{formatQty(item.reorderQty, item.uom)}</KeyValue>
          <KeyValue label="Lead time">{item.leadTimeDays} days</KeyValue>
          <KeyValue label="Storage location"><span className="t-mono">{item.storageLocation || "—"}</span></KeyValue>
          <KeyValue label="On hand, all locations">{formatQty(onHand, item.uom)}</KeyValue>
          <KeyValue label="Stock value at cost">{formatINR(onHand * item.standardCost)}</KeyValue>
          <KeyValue label="Product line">{item.productLine ? PRODUCT_LINE_LABEL[item.productLine] : "—"}</KeyValue>
          <KeyValue label="Ledger movements">{formatCount(view.movesByItem.get(item.id)?.length ?? 0)}</KeyValue>
        </dl>

        <div>
          <Overline>Referenced by {formatCount(total)} transactions</Overline>
          {refs.length === 0 ? (
            <p className="t-body-sm mt-1 text-text-mid">
              Nothing references this item yet, so it may still be deleted outright.
            </p>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
              {refs.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-3 bg-surface-1 px-3 py-1.5">
                  <span className="t-body-sm text-text-mid">{r.label}</span>
                  <span className="t-mono text-text-hi">{formatCount(r.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------- delete blocked */

function DeleteBlocked({
  view, item, onClose, onDeactivate,
}: { view: InvView; item: T.Item; onClose: () => void; onDeactivate: (() => void) | null }) {
  const refs = referencesTo(view, item.id);
  const total = totalReferences(refs);
  const mutate = useMutate();
  const { actor } = useInventory();

  function reallyDelete() {
    mutate((o) => {
      o.itemPatches[item.id] = { ...(o.itemPatches[item.id] ?? {}), active: false };
      writeAudit(o, actor, {
        at: new Date().toISOString(),
        action: "STATE_TRANSITION",
        entityType: "Item",
        entityId: item.id,
        entityLabel: item.code,
        summary: "Unreferenced item withdrawn from the master",
        before: "Active",
        after: "Inactive",
      });
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Delete ${item.code}?`}
      width="max-w-2xl"
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          {total > 0 ? (
            onDeactivate ? (
              <Btn variant="primary" icon={Power} onClick={() => { onDeactivate(); onClose(); }}>
                Deactivate instead
              </Btn>
            ) : null
          ) : (
            <Btn variant="danger" icon={Trash2} onClick={reallyDelete}>
              Withdraw item
            </Btn>
          )}
        </>
      }
    >
      {total > 0 ? (
        <div className="flex flex-col gap-3">
          <Blocked
            title="Deletion blocked — this item is referenced by existing transactions"
            rule={`Deleting ${item.code} would orphan ${formatCount(total)} records that were issued, quoted, billed or received against it. History in Pravaah is never rewritten.`}
            unblock="Deactivate the item instead: it disappears from every picker for new documents while every past record keeps its reference."
          />
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2">
            {refs.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3 bg-surface-1 px-3 py-1.5">
                <span className="t-body-sm text-text-mid">{r.label}</span>
                <span className="flex items-center gap-2">
                  <span className="t-mono text-text-hi">{formatCount(r.count)}</span>
                  {r.href ? (
                    <Link href={r.href} className="t-body-sm text-info underline underline-offset-2">
                      open
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Note tone="warn" title="Nothing references this item">
          {item.code} has no transactions against it, so it can be withdrawn from the master. Pravaah still keeps the
          record inactive rather than erasing it, so an audit trail survives.
        </Note>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ form */

function ItemForm({
  open, editing, draft, duplicate, onChange, onClose, onSubmit, onOpenExisting,
}: {
  open: boolean;
  editing: T.Item | null;
  draft: ItemDraft;
  duplicate: { field: string; item: T.Item } | null;
  onChange: (patch: Partial<ItemDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
  onOpenExisting: (id: string) => void;
}) {
  const invalid = !draft.code.trim() || !draft.description.trim();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.code}` : "New item"}
      sub="Every field below is captured on save. The same record then serves quotations, sales orders, job cards, project BOQs and purchase orders."
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon={PackagePlus} onClick={onSubmit} disabled={invalid}>
            {editing ? "Save changes" : "Create item"}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {duplicate ? (
          <Blocked
            title={`${duplicate.field} already exists`}
            rule={`${duplicate.field === "Item code" ? draft.code : draft.oemPartNumber} is already held by ${duplicate.item.code} — ${duplicate.item.description}. A code or OEM part number identifies exactly one item across the whole business.`}
            unblock="Open the existing item and use it, or change the value here to something unique."
            actions={
              <Btn variant="secondary" icon={Link2} onClick={() => onOpenExisting(duplicate.item.id)}>
                Open {duplicate.item.code}
              </Btn>
            }
          />
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Item code" required error={!draft.code.trim() ? "Required" : null}>
            <TextInput
              mono
              value={draft.code}
              onChange={(e) => onChange({ code: e.target.value })}
              placeholder="SPA-1241"
            />
          </Field>
          <Field label="OEM part number" className="lg:col-span-1">
            <TextInput
              mono
              value={draft.oemPartNumber}
              onChange={(e) => onChange({ oemPartNumber: e.target.value })}
              placeholder="ELG1234567"
            />
          </Field>
          <Field label="Unit of measure" required>
            <TextInput value={draft.uom} onChange={(e) => onChange({ uom: e.target.value })} placeholder="Nos" />
          </Field>

          <Field label="Description" required className="sm:col-span-2 lg:col-span-3" error={!draft.description.trim() ? "Required" : null}>
            <TextInput
              value={draft.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Air-end oil filter element — heavy duty"
            />
          </Field>

          <Field label="Category" required>
            <Select value={draft.category} onChange={(e) => onChange({ category: e.target.value as ItemCategory })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </Select>
          </Field>
          <Field label="OEM principal" required>
            <Select value={draft.principal} onChange={(e) => onChange({ principal: e.target.value as OEMPrincipal })}>
              {PRINCIPALS.map((p) => (
                <option key={p} value={p}>{OEM_LABEL[p]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Product line" hint="Optional — drives vertical reporting">
            <Select
              value={draft.productLine ?? ""}
              onChange={(e) => onChange({ productLine: (e.target.value || null) as ProductLine | null })}
            >
              <option value="">Not applicable</option>
              {PRODUCT_LINES.map((p) => (
                <option key={p} value={p}>{PRODUCT_LINE_LABEL[p]}</option>
              ))}
            </Select>
          </Field>

          <Field label="HSN / SAC" required>
            <TextInput mono value={draft.hsnSac} onChange={(e) => onChange({ hsnSac: e.target.value })} />
          </Field>
          <Field label="GST rate %" required>
            <Select value={String(draft.gstRate)} onChange={(e) => onChange({ gstRate: Number(e.target.value) })}>
              {[0, 5, 12, 18, 28].map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </Select>
          </Field>
          <Field label="Storage location" hint="Rack-bay-bin in the warehouse">
            <TextInput mono value={draft.storageLocation} onChange={(e) => onChange({ storageLocation: e.target.value })} placeholder="C-14-3" />
          </Field>

          <Field label="Standard purchase cost ₹" required>
            <NumInput min={0} value={draft.standardCost} onChange={(e) => onChange({ standardCost: Number(e.target.value) })} />
          </Field>
          <Field label="Standard selling price ₹" required>
            <NumInput min={0} value={draft.standardPrice} onChange={(e) => onChange({ standardPrice: Number(e.target.value) })} />
          </Field>
          <Field label="Lead-time days" required>
            <NumInput min={0} value={draft.leadTimeDays} onChange={(e) => onChange({ leadTimeDays: Number(e.target.value) })} />
          </Field>

          <Field label="Reorder level" hint="Zero means the line is not auto-reordered">
            <NumInput min={0} value={draft.reorderLevel} onChange={(e) => onChange({ reorderLevel: Number(e.target.value) })} />
          </Field>
          <Field label="Reorder quantity">
            <NumInput min={0} value={draft.reorderQty} onChange={(e) => onChange({ reorderQty: Number(e.target.value) })} />
          </Field>
          <Field label="Status">
            <Select value={draft.active ? "1" : "0"} onChange={(e) => onChange({ active: e.target.value === "1" })}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </Select>
          </Field>
        </div>

        <Note tone="neutral" title="Margin check">
          {draft.standardCost > 0 && draft.standardPrice > 0 ? (
            <>
              {formatINR(draft.standardPrice - draft.standardCost)} per {draft.uom || "unit"} ·{" "}
              {formatPercent(((draft.standardPrice - draft.standardCost) / draft.standardCost) * 100)} on cost
            </>
          ) : (
            <>Enter a cost and a price to see the margin this line will carry into every quotation.</>
          )}
        </Note>
      </div>
    </Modal>
  );
}
