import type { Dataset } from "@/lib/schemas";
import type * as T from "@/lib/schemas/entities";
import * as D from "@/lib/derive";
import { abbreviateINR, formatCount, formatDate } from "@/lib/format";
import type { DrillSet, RecordRef } from "../chartTypes";
import type { Period } from "../scope";

/**
 * Helpers the five surfaces share.
 *
 * Note what is *not* here: no KPI arithmetic. Where a breakdown is needed, the
 * pattern is always the same — filter the records to the dimension, then call
 * the unchanged formula in `/lib/derive` on that subset. Because each record is
 * attributed to exactly one dimension, the bars sum back to the total the
 * dictionary formula produces, and the two cannot disagree.
 */

export const MAX_DRILL_ROWS = 60;

export function revenueOf(ds: Dataset, invoices: T.Invoice[], p: Period): number {
  return D.revenueInPeriod({ ...ds, invoices }, p);
}

export function inPeriod(value: string | Date, p: Period): boolean {
  const t = new Date(value).getTime();
  return t >= p.from.getTime() && t <= p.to.getTime();
}

/**
 * Each invoice is attributed whole to the dimension of its largest line, so an
 * invoice is never split across two bars and the bars reconcile exactly to
 * `revenueInPeriod` for the same window.
 */
export function dominantLine(ds: Dataset, invoiceId: string): T.InvoiceLine | null {
  let best: T.InvoiceLine | null = null;
  let bestWeight = -1;
  for (const l of ds.invoiceLines) {
    if (l.invoiceId !== invoiceId) continue;
    const w = l.qty * l.rate;
    if (w > bestWeight) {
      bestWeight = w;
      best = l;
    }
  }
  return best;
}

export interface InvoiceDimension {
  productLine: string;
  principal: string;
  itemCategory: string;
}

export function invoiceDimensions(ds: Dataset): Map<string, InvoiceDimension> {
  const itemById = new Map(ds.items.map((i) => [i.id, i]));
  const out = new Map<string, InvoiceDimension>();
  for (const inv of ds.invoices) {
    const line = dominantLine(ds, inv.id);
    const item = line?.itemId ? itemById.get(line.itemId) : undefined;
    out.set(inv.id, {
      productLine: item?.productLine ?? "UNCLASSIFIED",
      principal: item?.principal ?? "OTHER",
      itemCategory: item?.category ?? "SERVICE",
    });
  }
  return out;
}

/* ------------------------------------------------------------ drill sets */

export function invoiceRecords(ds: Dataset, invoices: T.Invoice[]): RecordRef[] {
  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  return invoices.slice(0, MAX_DRILL_ROWS).map((i) => ({
    id: i.id,
    label: i.number,
    sub: `${custById.get(i.customerId)?.tradeName ?? i.customerId} · ${formatDate(i.date)}`,
    value: abbreviateINR(D.invoiceTotal(ds, i.id)),
    href: `/commercial/invoices/${i.id}`,
  }));
}

export function ticketRecords(ds: Dataset, tickets: T.ServiceTicket[]): RecordRef[] {
  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  return tickets.slice(0, MAX_DRILL_ROWS).map((t) => ({
    id: t.id,
    label: t.number,
    sub: `${custById.get(t.customerId)?.tradeName ?? t.customerId} · ${t.severity.toLowerCase()} · ${formatDate(t.loggedAt)}`,
    value: t.closedAt ? "Closed" : "Open",
    href: `/service/tickets/${t.id}`,
  }));
}

export function jobCardRecords(ds: Dataset, cards: T.JobCard[]): RecordRef[] {
  const empById = new Map(ds.employees.map((e) => [e.id, e]));
  return cards.slice(0, MAX_DRILL_ROWS).map((j) => ({
    id: j.id,
    label: j.number,
    sub: `${empById.get(j.engineerUserId)?.name ?? j.engineerUserId} · visit ${j.visitSequence} · ${formatDate(j.scheduledDate)}`,
    value: j.outcome ? j.outcome.replace(/_/g, " ").toLowerCase() : "open",
    href: `/service/job-cards/${j.id}`,
  }));
}

export function quotationRecords(ds: Dataset, quotations: T.Quotation[]): RecordRef[] {
  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  return quotations.slice(0, MAX_DRILL_ROWS).map((q) => ({
    id: q.id,
    label: q.number,
    sub: `${custById.get(q.customerId)?.tradeName ?? q.customerId} · ${formatDate(q.quotationDate)}`,
    value: q.status.replace(/_/g, " ").toLowerCase(),
    href: `/sales/quotations/${q.id}`,
  }));
}

export function enquiryRecords(ds: Dataset, enquiries: T.Enquiry[]): RecordRef[] {
  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  return enquiries.slice(0, MAX_DRILL_ROWS).map((e) => ({
    id: e.id,
    label: e.number,
    sub: `${custById.get(e.customerId)?.tradeName ?? e.customerId} · ${formatDate(e.createdAt)}`,
    value: abbreviateINR(e.expectedValue),
    href: `/sales/enquiries/${e.id}`,
  }));
}

export function assetRecords(ds: Dataset, assets: T.InstalledAsset[]): RecordRef[] {
  const custById = new Map(ds.customers.map((c) => [c.id, c]));
  return assets.slice(0, MAX_DRILL_ROWS).map((a) => ({
    id: a.id,
    label: a.serial,
    sub: `${a.model} · ${custById.get(a.customerId)?.tradeName ?? a.customerId}`,
    value: a.status.replace(/_/g, " ").toLowerCase(),
    href: `/service/assets/${a.id}`,
  }));
}

export function itemRecords(items: { item: T.Item; qty: number; value: number }[]): RecordRef[] {
  return items.slice(0, MAX_DRILL_ROWS).map(({ item, qty, value }) => ({
    id: item.id,
    label: item.code,
    sub: item.description,
    value: `${formatCount(qty)} ${item.uom} · ${abbreviateINR(value)}`,
    href: `/inventory/items/${item.id}`,
  }));
}

export function drill(
  title: string,
  aggregateLabel: string,
  aggregateValue: string,
  totalRecords: number,
  records: RecordRef[],
  listHref: string,
  listLabel: string,
): DrillSet {
  return { title, aggregateLabel, aggregateValue, totalRecords, records, listHref, listLabel };
}

/* --------------------------------------------------------------- misc */

export function groupCount<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const cur = m.get(k);
    if (cur) cur.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function topN<T>(entries: [string, T[]][], n: number): [string, T[]][] {
  return [...entries].sort((a, b) => b[1].length - a[1].length).slice(0, n);
}
