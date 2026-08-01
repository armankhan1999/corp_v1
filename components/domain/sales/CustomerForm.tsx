"use client";

import * as React from "react";
import Link from "next/link";
import { Check, MapPin, Plus, Star, Trash2, UserRound } from "lucide-react";
import type * as T from "@/lib/schemas/entities";
import { formatPhone, isValidGSTIN, isValidPAN } from "@/lib/format";
import { StatusBadge, Overline, EmptyState } from "@/components/patterns/primitives";
import {
  Btn, Field, Modal, Notice, Select, TableFrame, TextArea, TextInput, Th, Td, Tr, NumberInput,
} from "./ui";
import { GSTIN_HINT, GSTIN_PATTERN, STATE_BY_CODE } from "./calc";
import {
  createContact, createCustomer, createSite, updateContact, updateCustomer, updateSite,
  type Actor, type SalesWorld,
} from "./store";

const CUSTOMER_TYPES: T.Customer["type"][] = ["INDUSTRIAL", "INSTITUTIONAL", "GOVERNMENT", "DEALER", "RETAIL"];
const CHANNELS: T.Contact["preferredChannel"][] = ["WHATSAPP", "EMAIL", "SMS", "IN_APP"];
const INDUSTRIES = [
  "Textile Processing", "Food Processing", "Automobile Workshop", "Pharmaceutical",
  "Cement & Aggregates", "Plastics & Polymers", "Municipal Body", "Cold Storage",
  "Printing & Packaging", "Engineering Workshop", "Hospital", "Education",
];

type Errors = Record<string, string | null>;

export interface CustomerFormValues {
  legalName: string;
  tradeName: string;
  type: T.Customer["type"];
  gstin: string;
  pan: string;
  industry: string;
  creditTermDays: string;
  creditLimit: string;
  branchId: string;
  ownerUserId: string;
  country: string;
  active: boolean;
}

function initialValues(w: SalesWorld, defaults: { branchId: string; ownerUserId: string }, c?: T.Customer): CustomerFormValues {
  return {
    legalName: c?.legalName ?? "",
    tradeName: c?.tradeName ?? "",
    type: c?.type ?? "INDUSTRIAL",
    gstin: c?.gstin ?? "",
    pan: c?.pan ?? "",
    industry: c?.industry ?? INDUSTRIES[0]!,
    creditTermDays: String(c?.creditTermDays ?? 30),
    creditLimit: String(c?.creditLimit ?? 500000),
    branchId: c?.branchId ?? defaults.branchId ?? w.ds.branches[0]!.id,
    ownerUserId: c?.ownerUserId ?? defaults.ownerUserId,
    country: c?.country ?? "IN",
    active: c?.active ?? true,
  };
}

export function CustomerFormModal({
  open, onOpenChange, world, actor, customer, lockBranchId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  world: SalesWorld;
  actor: Actor;
  customer?: T.Customer;
  lockBranchId: string | null;
  onCreated?: (c: T.Customer) => void;
}) {
  const [tab, setTab] = React.useState<"profile" | "sites" | "contacts">("profile");
  const [values, setValues] = React.useState<CustomerFormValues>(() =>
    initialValues(world, { branchId: lockBranchId ?? actor.userId, ownerUserId: actor.userId }, customer),
  );
  const [errors, setErrors] = React.useState<Errors>({});
  const [duplicate, setDuplicate] = React.useState<T.Customer | null>(null);
  const [saved, setSaved] = React.useState<T.Customer | null>(customer ?? null);

  React.useEffect(() => {
    if (!open) return;
    setTab("profile");
    setValues(initialValues(world, { branchId: lockBranchId ?? world.ds.branches[0]!.id, ownerUserId: actor.userId }, customer));
    setErrors({});
    setDuplicate(null);
    setSaved(customer ?? null);
    // Values are seeded once per open; re-seeding on every world tick would
    // discard what the user has typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);

  const set = <K extends keyof CustomerFormValues>(k: K, v: CustomerFormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  function validateGstin(raw: string): string | null {
    const v = raw.trim().toUpperCase();
    if (!v) return values.country === "IN" ? null : null;
    if (v.length !== 15) return `GSTIN must be exactly 15 characters — expected ${GSTIN_PATTERN}. ${GSTIN_HINT}`;
    if (!isValidGSTIN(v)) return `Not a valid GSTIN. Expected ${GSTIN_PATTERN}. ${GSTIN_HINT}`;
    return null;
  }

  function checkDuplicate(raw: string) {
    const v = raw.trim().toUpperCase();
    if (!v) { setDuplicate(null); return; }
    const hit = world.customers.find((c) => c.gstin?.toUpperCase() === v && c.id !== saved?.id);
    setDuplicate(hit ?? null);
  }

  function validateAll(): boolean {
    const next: Errors = {};
    if (!values.legalName.trim()) next.legalName = "Legal name is required — it prints on every statutory document.";
    next.gstin = validateGstin(values.gstin);
    if (values.pan.trim() && !isValidPAN(values.pan)) next.pan = "PAN must be 5 letters, 4 digits, 1 letter — e.g. AAGCB4521K.";
    if (!Number.isFinite(Number(values.creditTermDays)) || Number(values.creditTermDays) < 0) next.creditTermDays = "Credit terms must be zero or more days.";
    if (!Number.isFinite(Number(values.creditLimit)) || Number(values.creditLimit) < 0) next.creditLimit = "Credit limit must be zero or more.";
    setErrors(next);
    checkDuplicate(values.gstin);
    const dupe = values.gstin.trim()
      ? world.customers.find((c) => c.gstin?.toUpperCase() === values.gstin.trim().toUpperCase() && c.id !== saved?.id)
      : undefined;
    return !dupe && Object.values(next).every((e) => !e);
  }

  function submit() {
    if (!validateAll()) return;
    const draft = {
      legalName: values.legalName,
      tradeName: values.tradeName,
      type: values.type,
      gstin: values.gstin,
      pan: values.pan,
      industry: values.industry,
      creditTermDays: Number(values.creditTermDays),
      creditLimit: Number(values.creditLimit),
      branchId: values.branchId,
      ownerUserId: values.ownerUserId,
      country: values.country,
      active: values.active,
    };
    if (saved) {
      updateCustomer(saved.id, {
        ...draft,
        gstin: draft.gstin.trim() ? draft.gstin.trim().toUpperCase() : null,
        pan: draft.pan.trim() ? draft.pan.trim().toUpperCase() : null,
      }, actor);
      onOpenChange(false);
      return;
    }
    const created = createCustomer(draft, actor);
    setSaved(created);
    setTab("sites");
    onCreated?.(created);
  }

  const salesUsers = world.ds.users.filter((u) => u.role === "SALES_EXECUTIVE" || u.role === "BRANCH_MANAGER");
  const liveCustomer = saved ? world.customerById.get(saved.id) ?? saved : null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={customer ? `Edit ${customer.legalName}` : saved ? `${saved.legalName} — add premises and people` : "New customer"}
      description={
        customer
          ? "Changes are held in this browser under the pravaah.v1 namespace."
          : "Legal name, trade name, type, GSTIN, PAN, industry, credit terms, credit limit, branch, executive and status."
      }
      footer={
        <>
          <Btn onClick={() => onOpenChange(false)}>{saved && !customer ? "Done" : "Cancel"}</Btn>
          {tab === "profile" ? (
            <Btn variant="primary" onClick={submit}>
              <Check className="size-3.5" aria-hidden />
              {saved ? "Save changes" : "Create customer"}
            </Btn>
          ) : null}
        </>
      }
    >
      <div className="mb-4 flex gap-1 border-b border-line" role="tablist" aria-label="Customer sections">
        {([["profile", "Profile"], ["sites", "Sites"], ["contacts", "Contacts"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            disabled={k !== "profile" && !saved}
            onClick={() => setTab(k)}
            className={
              tab === k
                ? "border-b-2 border-primary-500 px-3 py-1.5 text-[0.8125rem] text-text-hi"
                : "border-b-2 border-transparent px-3 py-1.5 text-[0.8125rem] text-text-mid hover:text-text-hi disabled:opacity-40"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Legal name" required error={errors.legalName} className="sm:col-span-2">
            {(p) => (
              <TextInput
                {...p}
                value={values.legalName}
                onChange={(e) => set("legalName", e.target.value)}
                onBlur={() => setErrors((x) => ({ ...x, legalName: values.legalName.trim() ? null : "Legal name is required — it prints on every statutory document." }))}
                placeholder="Nalanda Packaging Pvt Ltd"
              />
            )}
          </Field>

          <Field label="Trade name" hint="Defaults to the legal name if left blank.">
            {(p) => <TextInput {...p} value={values.tradeName} onChange={(e) => set("tradeName", e.target.value)} />}
          </Field>

          <Field label="Customer type" required>
            {(p) => (
              <Select {...p} value={values.type} onChange={(e) => set("type", e.target.value as T.Customer["type"])}>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="GSTIN"
            required={values.country === "IN"}
            error={errors.gstin}
            hint={`Expected pattern ${GSTIN_PATTERN}. ${GSTIN_HINT}`}
          >
            {(p) => (
              <TextInput
                {...p}
                value={values.gstin}
                maxLength={15}
                spellCheck={false}
                className="t-mono uppercase"
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                onBlur={(e) => {
                  setErrors((x) => ({ ...x, gstin: validateGstin(e.target.value) }));
                  checkDuplicate(e.target.value);
                }}
                placeholder="10AAGCB4521K1ZP"
              />
            )}
          </Field>

          <Field label="PAN" error={errors.pan} hint="5 letters, 4 digits, 1 letter.">
            {(p) => (
              <TextInput
                {...p}
                value={values.pan}
                maxLength={10}
                className="t-mono uppercase"
                onChange={(e) => set("pan", e.target.value.toUpperCase())}
                onBlur={(e) => setErrors((x) => ({ ...x, pan: e.target.value.trim() && !isValidPAN(e.target.value) ? "PAN must be 5 letters, 4 digits, 1 letter — e.g. AAGCB4521K." : null }))}
                placeholder="AAGCB4521K"
              />
            )}
          </Field>

          <Field label="Industry">
            {(p) => (
              <Select {...p} value={values.industry} onChange={(e) => set("industry", e.target.value)}>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            )}
          </Field>

          <Field label="Country" hint="Outside India makes every supply a zero-rated export under LUT.">
            {(p) => (
              <Select {...p} value={values.country} onChange={(e) => set("country", e.target.value)}>
                <option value="IN">India</option>
                <option value="NP">Nepal</option>
              </Select>
            )}
          </Field>

          <Field label="Credit terms (days)" error={errors.creditTermDays}>
            {(p) => <NumberInput {...p} value={values.creditTermDays} min={0} onChange={(e) => set("creditTermDays", e.target.value)} />}
          </Field>

          <Field label="Credit limit (₹)" error={errors.creditLimit}>
            {(p) => <NumberInput {...p} value={values.creditLimit} min={0} step={10000} onChange={(e) => set("creditLimit", e.target.value)} />}
          </Field>

          <Field label="Assigned branch" hint={lockBranchId ? "Locked to your branch by RBAC-2." : undefined}>
            {(p) => (
              <Select {...p} value={values.branchId} disabled={!!lockBranchId} onChange={(e) => set("branchId", e.target.value)}>
                {world.ds.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            )}
          </Field>

          <Field label="Assigned executive">
            {(p) => (
              <Select {...p} value={values.ownerUserId} onChange={(e) => set("ownerUserId", e.target.value)}>
                {salesUsers.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.designation}</option>)}
              </Select>
            )}
          </Field>

          <Field label="Status">
            {(p) => (
              <Select {...p} value={values.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Select>
            )}
          </Field>

          {duplicate ? (
            <div className="sm:col-span-2">
              <Notice tone="danger" title="This GSTIN is already on the register">
                <span>
                  {duplicate.legalName} ({duplicate.code}) already holds{" "}
                  <span className="t-mono">{duplicate.gstin}</span>. Creating a second record would split its
                  machines, tickets and invoices across two customers.{" "}
                  <Link href={`/sales/customers/${duplicate.id}`} className="underline underline-offset-2">
                    Open the existing customer
                  </Link>
                  .
                </span>
              </Notice>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "sites" && liveCustomer ? <SitesEditor world={world} actor={actor} customer={liveCustomer} /> : null}
      {tab === "contacts" && liveCustomer ? <ContactsEditor world={world} actor={actor} customer={liveCustomer} /> : null}
    </Modal>
  );
}

/* ----------------------------------------------------------------- sites */

export function SitesEditor({ world, actor, customer }: { world: SalesWorld; actor: Actor; customer: T.Customer }) {
  const sites = world.sitesByCustomer.get(customer.id) ?? [];
  const [adding, setAdding] = React.useState(sites.length === 0);
  const [editing, setEditing] = React.useState<string | null>(null);
  const blank = {
    name: "", address: "", district: "", state: "Bihar", stateCode: "10",
    pincode: "", contactPerson: "", contactPhone: "", notes: "",
  };
  const [form, setForm] = React.useState(blank);
  const [err, setErr] = React.useState<Errors>({});

  function startEdit(s: T.Site) {
    setEditing(s.id);
    setAdding(true);
    setForm({
      name: s.name, address: s.address, district: s.district, state: s.state,
      stateCode: s.stateCode, pincode: s.pincode, contactPerson: s.contactPerson,
      contactPhone: s.contactPhone, notes: s.notes,
    });
  }

  function save() {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Give the premises a name so assets can attach to it.";
    if (!form.address.trim()) next.address = "Address is required — the e-way bill reads from it.";
    if (!form.district.trim()) next.district = "District is required.";
    setErr(next);
    if (Object.values(next).some(Boolean)) return;
    if (editing) updateSite(editing, form, actor);
    else createSite({ customerId: customer.id, ...form }, actor);
    setForm(blank);
    setEditing(null);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="t-body-sm text-text-mid">
          Installed assets attach to a site, never to the customer — so a machine is always findable at a physical address.
        </p>
        {!adding ? (
          <Btn size="sm" onClick={() => { setForm(blank); setEditing(null); setAdding(true); }}>
            <Plus className="size-3.5" aria-hidden /> Add site
          </Btn>
        ) : null}
      </div>

      {sites.length === 0 && !adding ? (
        <EmptyState
          icon={MapPin}
          title="No premises recorded"
          body="Add the plant, workshop or godown where this customer runs machines. Assets, tickets and delivery challans all attach to a site."
          action={<Btn variant="primary" size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" aria-hidden /> Add the first site</Btn>}
        />
      ) : null}

      {sites.length > 0 ? (
        <div className="rounded-md border border-line">
          <TableFrame>
            <thead>
              <tr><Th>Site</Th><Th>Address</Th><Th>District</Th><Th>State</Th><Th>Site contact</Th><Th>Notes</Th><Th /></tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <Tr key={s.id}>
                  <Td className="text-text-hi">{s.name}</Td>
                  <Td>{s.address}</Td>
                  <Td>{s.district}</Td>
                  <Td>{s.state} <span className="t-mono text-text-lo">{s.stateCode}</span></Td>
                  <Td>{s.contactPerson}{s.contactPhone ? ` · ${formatPhone(s.contactPhone)}` : ""}</Td>
                  <Td>{s.notes || <span className="text-text-lo">—</span>}</Td>
                  <Td><Btn size="sm" variant="ghost" onClick={() => startEdit(s)}>Edit</Btn></Td>
                </Tr>
              ))}
            </tbody>
          </TableFrame>
        </div>
      ) : null}

      {adding ? (
        <div className="rounded-md border border-line-strong bg-surface-2 p-3">
          <Overline>{editing ? "Edit site" : "New site"}</Overline>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Site name" required error={err.name}>
              {(p) => <TextInput {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Plant" />}
            </Field>
            <Field label="District" required error={err.district}>
              {(p) => <TextInput {...p} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} placeholder="Patna" />}
            </Field>
            <Field label="Address" required error={err.address} className="sm:col-span-2">
              {(p) => <TextInput {...p} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Plot 42, Bela Industrial Estate" />}
            </Field>
            <Field label="State" hint="Drives place-of-supply derivation on every quotation.">
              {(p) => (
                <Select
                  {...p}
                  value={form.stateCode}
                  onChange={(e) => setForm({ ...form, stateCode: e.target.value, state: STATE_BY_CODE[e.target.value] ?? form.state })}
                >
                  {Object.entries(STATE_BY_CODE).map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="PIN code">
              {(p) => <TextInput {...p} value={form.pincode} maxLength={6} className="t-mono" onChange={(e) => setForm({ ...form, pincode: e.target.value })} />}
            </Field>
            <Field label="Contact person">
              {(p) => <TextInput {...p} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />}
            </Field>
            <Field label="Contact phone">
              {(p) => <TextInput {...p} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="9XXXXXXXXX" />}
            </Field>
            <Field label="Site notes" className="sm:col-span-2" hint="Gate pass rules, shutdown days, PPE — what an engineer needs before arriving.">
              {(p) => <TextArea {...p} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Btn size="sm" onClick={() => { setAdding(false); setEditing(null); setErr({}); }}>Cancel</Btn>
            <Btn size="sm" variant="primary" onClick={save}><Check className="size-3.5" aria-hidden /> {editing ? "Save site" : "Add site"}</Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- contacts */

export function ContactsEditor({ world, actor, customer }: { world: SalesWorld; actor: Actor; customer: T.Customer }) {
  const contacts = world.contactsByCustomer.get(customer.id) ?? [];
  const [adding, setAdding] = React.useState(contacts.length === 0);
  const blank = {
    name: "", designation: "", mobile: "", email: "",
    preferredChannel: "WHATSAPP" as T.Contact["preferredChannel"],
    isPrimary: contacts.length === 0,
  };
  const [form, setForm] = React.useState(blank);
  const [err, setErr] = React.useState<Errors>({});

  function save() {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "A contact needs a name.";
    if (form.mobile && form.mobile.replace(/\D/g, "").length < 10) next.mobile = "Mobile must be 10 digits.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address.";
    setErr(next);
    if (Object.values(next).some(Boolean)) return;
    createContact({ customerId: customer.id, ...form }, actor);
    setForm({ ...blank, isPrimary: false });
    setAdding(false);
  }

  const primaryCount = contacts.filter((c) => c.isPrimary).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="t-body-sm text-text-mid">
          Exactly one contact carries the primary flag — marking another moves it.
        </p>
        {!adding ? (
          <Btn size="sm" onClick={() => { setForm({ ...blank, isPrimary: contacts.length === 0 }); setAdding(true); }}>
            <Plus className="size-3.5" aria-hidden /> Add contact
          </Btn>
        ) : null}
      </div>

      {contacts.length === 0 && !adding ? (
        <EmptyState
          icon={UserRound}
          title="No people recorded"
          body="Record who to call. Preferred channel drives which simulated notification a follow-up uses."
          action={<Btn variant="primary" size="sm" onClick={() => setAdding(true)}><Plus className="size-3.5" aria-hidden /> Add the first contact</Btn>}
        />
      ) : null}

      {contacts.length > 0 ? (
        <div className="rounded-md border border-line">
          <TableFrame>
            <thead>
              <tr><Th>Name</Th><Th>Designation</Th><Th>Mobile</Th><Th>Email</Th><Th>Preferred channel</Th><Th>Primary</Th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <Tr key={c.id}>
                  <Td className="text-text-hi">{c.name}</Td>
                  <Td>{c.designation}</Td>
                  <Td mono>{formatPhone(c.mobile)}</Td>
                  <Td>{c.email}</Td>
                  <Td>{c.preferredChannel.replace(/_/g, " ").toLowerCase()}</Td>
                  <Td>
                    {c.isPrimary ? (
                      <StatusBadge tone="ok">Primary</StatusBadge>
                    ) : (
                      <Btn size="sm" variant="ghost" onClick={() => updateContact(c.id, { isPrimary: true }, actor)}>
                        <Star className="size-3.5" aria-hidden /> Make primary
                      </Btn>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableFrame>
        </div>
      ) : null}

      {primaryCount === 0 && contacts.length > 0 ? (
        <Notice tone="warn" title="No primary contact">
          Every customer needs one primary contact — it is the default recipient for quotations and service updates.
        </Notice>
      ) : null}

      {adding ? (
        <div className="rounded-md border border-line-strong bg-surface-2 p-3">
          <Overline>New contact</Overline>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name" required error={err.name}>
              {(p) => <TextInput {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            </Field>
            <Field label="Designation">
              {(p) => <TextInput {...p} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Maintenance Head" />}
            </Field>
            <Field label="Mobile" error={err.mobile}>
              {(p) => <TextInput {...p} value={form.mobile} className="t-mono" onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="9XXXXXXXXX" />}
            </Field>
            <Field label="Email" error={err.email}>
              {(p) => <TextInput {...p} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            </Field>
            <Field label="Preferred channel">
              {(p) => (
                <Select {...p} value={form.preferredChannel} onChange={(e) => setForm({ ...form, preferredChannel: e.target.value as T.Contact["preferredChannel"] })}>
                  {CHANNELS.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ").toLowerCase()}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Primary contact">
              {(p) => (
                <Select {...p} value={form.isPrimary ? "1" : "0"} onChange={(e) => setForm({ ...form, isPrimary: e.target.value === "1" })}>
                  <option value="0">No</option>
                  <option value="1">Yes — move the primary flag here</option>
                </Select>
              )}
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Btn size="sm" onClick={() => { setAdding(false); setErr({}); }}>
              <Trash2 className="size-3.5" aria-hidden /> Discard
            </Btn>
            <Btn size="sm" variant="primary" onClick={save}><Check className="size-3.5" aria-hidden /> Add contact</Btn>
          </div>
        </div>
      ) : null}
    </div>
  );
}
