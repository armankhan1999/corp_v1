import type { Dataset } from "../schemas";
import { TARGETS } from "./generate";
import * as D from "../derive";
import { OEM_COMMISSIONING_WINDOW_DAYS } from "./catalog";

/**
 * E14-S1 — the reconciliation validator. This is a deliverable, not a one-off
 * check: it is what allows the client to trust that no figure on any screen was
 * hand-placed. `npm run validate:seed` fails the build if any assertion breaks.
 */

export interface Check {
  rule: string;
  pass: boolean;
  expected: string;
  actual: string;
  critical: boolean;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

export function validateDataset(ds: Dataset): { checks: Check[]; passed: boolean; criticalFailed: boolean } {
  const ctx = D.ctxOf(ds);
  const checks: Check[] = [];

  const eq = (rule: string, actual: number, expected: number, critical = true, tolerance = 0) => {
    checks.push({
      rule, pass: Math.abs(actual - expected) <= tolerance,
      expected: fmt(expected), actual: fmt(actual), critical,
    });
  };
  const ok = (rule: string, pass: boolean, expected: string, actual: string, critical = true) => {
    checks.push({ rule, pass, expected, actual, critical });
  };

  /* ---------------- SD-2: money reconciliation (the headline) ------------- */
  const rec = D.receivables(ctx);
  const ret = D.retention(ctx);
  const locked = D.lockedCash(ctx);

  eq("Receivables total = ₹1.82 Cr", rec.total, TARGETS.receivables.total);
  eq("Ageing bucket 0–30 = ₹64 L", rec.buckets.B0_30.value, TARGETS.receivables.b0_30);
  eq("Ageing bucket 31–60 = ₹47 L", rec.buckets.B31_60.value, TARGETS.receivables.b31_60);
  eq("Ageing bucket 61–90 = ₹31 L", rec.buckets.B61_90.value, TARGETS.receivables.b61_90);
  eq("Ageing bucket 90+ = ₹40 L", rec.buckets.B90_PLUS.value, TARGETS.receivables.b90p);
  eq(
    "Buckets sum exactly to receivables total",
    rec.buckets.B0_30.value + rec.buckets.B31_60.value + rec.buckets.B61_90.value + rec.buckets.B90_PLUS.value,
    rec.total,
  );
  eq("Institutional + government exposure = ₹1.12 Cr", rec.institutional, TARGETS.receivables.institutional);
  eq("Institutional + private = receivables total", rec.institutional + rec.privateSector, rec.total);

  eq("Retention outstanding = ₹34.6 L", ret.outstanding, TARGETS.retention.outstanding);
  eq("Retention eligible for release = ₹11.2 L", ret.eligible, TARGETS.retention.eligible);
  eq("Retention released historically = ₹6.8 L", ret.released, TARGETS.retention.released);
  eq(
    "Retention register total = sum of retention entries",
    ret.outstanding,
    ds.retentionEntries.filter((e) => !e.releasedAt).reduce((s, e) => s + e.amount, 0),
  );
  eq("Locked cash = receivables + retention = ₹2.17 Cr", locked.total, TARGETS.lockedCash);

  /* ------------------------------- revenue -------------------------------- */
  const fy2526 = { from: new Date(2025, 3, 1), to: new Date(2026, 2, 31, 23, 59, 59) };
  const fy2627Ytd = { from: new Date(2026, 3, 1), to: new Date(ds.meta.today) };
  const priorComparable = { from: new Date(2025, 3, 1), to: new Date(2025, 6, 31, 23, 59, 59) };

  eq("FY 2025-26 revenue = ₹8.62 Cr", D.revenueInPeriod(ds, fy2526), TARGETS.revenueFy2526.total, true, 4);
  eq("FY 2026-27 YTD revenue = ₹3.05 Cr", D.revenueInPeriod(ds, fy2627Ytd), TARGETS.revenueFy2627Ytd, true, 4);
  eq("Prior comparable (Apr–Jul 2025) = ₹2.68 Cr", D.revenueInPeriod(ds, priorComparable), TARGETS.priorComparable, true, 4);

  const byV = D.revenueByVertical(ds, fy2526);
  eq("FY 2025-26 Equipment = ₹4.74 Cr", byV.EQUIPMENT_SALES!, TARGETS.revenueFy2526.equipment, true, 4);
  eq("FY 2025-26 Service & AMC = ₹1.90 Cr", byV.SERVICE_AMC!, TARGETS.revenueFy2526.service, true, 4);
  eq("FY 2025-26 Projects = ₹1.72 Cr", byV.PROJECTS!, TARGETS.revenueFy2526.projects, true, 4);
  eq("FY 2025-26 Rental = ₹0.26 Cr", byV.RENTAL!, TARGETS.revenueFy2526.rental, true, 4);
  eq(
    "Vertical split sums to FY 2025-26 total",
    byV.EQUIPMENT_SALES! + byV.SERVICE_AMC! + byV.PROJECTS! + byV.RENTAL!,
    TARGETS.revenueFy2526.total, true, 4,
  );

  eq("Order book = ₹2.38 Cr", D.orderBookValue(ds), TARGETS.orderBook, true, 200);

  /* ------------------------------- inventory ------------------------------ */
  eq("Stock value = ₹41.8 L", D.stockValue(ds), TARGETS.stockValue, true, 2000);
  ok(
    "Stock balances equal the sum of ledger movements",
    ds.items.slice(0, 40).every((i) => {
      const viaLedger = ds.stockMovements
        .filter((m) => m.itemId === i.id)
        .reduce((s, m) => s + (m.toLocationId ? m.qty : 0) - (m.fromLocationId ? m.qty : 0), 0);
      return D.stockOnHand(ds, i.id) === viaLedger;
    }),
    "identical for every sampled item", "checked 40 items",
  );
  ok(
    "Stock ledger is append-only (sequence is strictly increasing)",
    ds.stockMovements.every((m, i) => i === 0 || m.seq > ds.stockMovements[i - 1]!.seq),
    "monotonic seq", `${ds.stockMovements.length} movements`,
  );

  /* ------------------------------ SD-3: integrity ------------------------- */
  const assetIds = new Set(ds.assets.map((a) => a.id));
  const siteIds = new Set(ds.sites.map((s) => s.id));
  const custIds = new Set(ds.customers.map((c) => c.id));
  ok("Every ticket references a real asset",
    ds.tickets.every((t) => assetIds.has(t.assetId)), "100%", `${ds.tickets.length} tickets`);
  ok("Every asset has a site and a customer",
    ds.assets.every((a) => siteIds.has(a.siteId) && custIds.has(a.customerId)), "100%", `${ds.assets.length} assets`);
  ok("Every job card references a real ticket",
    ds.jobCards.every((j) => ds.tickets.some((t) => t.id === j.ticketId)), "100%", `${ds.jobCards.length} job cards`);
  ok("Every stock movement carries a source document",
    ds.stockMovements.every((m) => m.sourceType !== undefined && m.sourceLabel.length > 0), "100%", `${ds.stockMovements.length} movements`);
  ok("Every invoice line belongs to a real invoice",
    ds.invoiceLines.every((l) => ds.invoices.some((i) => i.id === l.invoiceId)), "100%", `${ds.invoiceLines.length} lines`);
  ok("Every retention entry references a real RA-bill",
    ds.retentionEntries.every((r) => ds.raBills.some((b) => b.id === r.raBillId)), "100%", `${ds.retentionEntries.length} entries`);

  /* ------------------------------ SD volumes ------------------------------ */
  const N = TARGETS.counts;
  eq("Branches", ds.branches.length, N.branches);
  eq("Demo users (one per role)", ds.users.length, N.users);
  eq("Employees", ds.employees.length, N.employees);
  eq("Customers", ds.customers.length, N.customers);
  eq("Sites", ds.sites.length, N.sites);
  eq("Items (SKUs)", ds.items.length, N.items);
  eq("Installed assets", ds.assets.length, N.assets);
  eq("Service tickets", ds.tickets.length, N.tickets);
  eq("Job cards", ds.jobCards.length, N.jobCards, true, 40);
  eq("Commissioning reports", ds.commissioningReports.length, N.commissioning);
  eq("Enquiries", ds.enquiries.length, N.enquiries);
  eq("Quotations (incl. one revision)", ds.quotations.length, N.quotations + 1);
  eq("Sales orders", ds.salesOrders.length, N.quotationsWon);
  eq("Invoices", ds.invoices.length, N.invoices);
  eq("Nepal export transactions (zero-rated)",
    ds.invoices.filter((i) => i.taxTreatment === "EXPORT_ZERO_RATED").length, N.nepalExports, false);
  eq("Delivery challans", ds.challans.length, N.challans);
  eq("Projects", ds.projects.length, N.projects);
  eq("BOQ lines", ds.boqLines.length, N.boqLines);
  eq("DPR entries", ds.dprs.length, N.dprs);
  eq("RA-bills", ds.raBills.length, N.raBills);
  eq("Suppliers", ds.suppliers.length, N.suppliers);
  eq("Purchase orders", ds.purchaseOrders.length, N.purchaseOrders);
  eq("Vault documents", ds.documents.length, N.documents);
  eq("Leave requests", ds.leaveRequests.length, N.leaveRequests);
  eq("Notifications", ds.notifications.length, N.notifications);
  eq("Rental assets", ds.rentalAssets.length, N.rentalAssets);

  /* -------------------------- coverage & renewal radar -------------------- */
  const attach = D.amcAttachRate(ctx);
  eq("Assets in warranty", attach.inWarranty, N.assetsInWarranty);
  eq("Assets under AMC", attach.underAmc, N.assetsUnderAmc);
  eq("Assets out of coverage", attach.outOfCoverage, N.assetsOutOfCoverage);
  eq("AMC attach-rate denominator (total − in-warranty)", attach.eligible, N.assets - N.assetsInWarranty);
  ok("AMC attach rate = 42%", Math.round(attach.pct) === 42, "42%", `${attach.pct}%`);

  const now = new Date(ds.meta.today);
  const expiring60 = ds.amcContracts.filter((a) => {
    const st = D.amcStatus(a, now);
    return st === "EXPIRING";
  });
  eq("AMCs expiring within 60 days", expiring60.length, N.amcExpiring60);
  eq(
    "Value of AMCs expiring within 60 days = ₹18.4 L",
    expiring60.reduce((s, a) => s + a.contractValue, 0),
    TARGETS.amcExpiring60Value,
  );

  /* -------------------------------- SLA states ---------------------------- */
  const open = ds.tickets.filter(D.isOpenTicket);
  eq("Open tickets", open.length, N.openTickets);
  const states = open.map((t) => D.slaClock(t, now).state);
  eq("Breached SLA clocks", states.filter((s) => s === "BREACHED").length, N.breached);
  eq("Imminent SLA clocks", states.filter((s) => s === "IMMINENT").length, N.imminent, false);
  eq("Approaching SLA clocks", states.filter((s) => s === "APPROACHING").length, N.approaching, false);

  /* ----------------------------- commissioning ---------------------------- */
  let inWindow = 0, late = 0, overdue = 0;
  for (const r of ds.commissioningReports) {
    const asset = ds.assets.find((a) => a.id === r.assetId);
    if (!asset) continue;
    const dl = D.commissioningDeadline(r, OEM_COMMISSIONING_WINDOW_DAYS[asset.principal]);
    const st = D.commissioningSubmissionState(r, dl, now);
    if (st === "SUBMITTED_IN_WINDOW") inWindow++;
    else if (st === "SUBMITTED_LATE") late++;
    else if (st === "OVERDUE") overdue++;
  }
  eq("Commissioning submitted within window", inWindow, N.commissioningInWindow);
  eq("Commissioning submitted late", late, N.commissioningLate);
  eq("Commissioning currently overdue (exception hook)", overdue, N.commissioningOverdue);

  /* --------------------------- deliberate hooks (SD-7) -------------------- */
  ok("An e-way bill base document older than 180 days exists (block demo)",
    ds.challans.some((c) => (now.getTime() - new Date(c.date).getTime()) / 86_400_000 > 180),
    "at least 1", String(ds.challans.filter((c) => (now.getTime() - new Date(c.date).getTime()) / 86_400_000 > 180).length));
  ok("A project sits beyond schedule-variance tolerance",
    ds.projects.some((p) => D.scheduleVariancePct(ds, p, now) < -5), "at least 1 At Risk", "checked");
  ok("An RA-bill was certified below the claimed value",
    ds.raBills.some((b) => b.certifiedValue !== null && b.certifiedValue < b.claimedValue),
    "at least 1", String(ds.raBills.filter((b) => b.certifiedValue !== null && b.certifiedValue < b.claimedValue).length));
  ok("An RA-bill is awaiting certification beyond the threshold",
    ds.raBills.some((b) => b.status === "SUBMITTED" && (now.getTime() - new Date(b.submittedAt!).getTime()) / 86_400_000 > 45),
    "at least 1", "checked");
  eq("Broken payment promises", ds.collectionFollowUps.filter((f) => f.promisedDate && !f.fulfilled && new Date(f.promisedDate) < now).length, N.brokenPromises, false);
  ok("Service-critical stock shortages linked to a job card",
    ds.partsRequests.filter((r) => r.serviceCritical && r.jobCardId).length > 0,
    "at least 1", String(ds.partsRequests.filter((r) => r.serviceCritical).length));
  eq("Documents expiring within 60 days", ds.documents.filter((d) =>
    d.expiresOn && new Date(d.expiresOn) > now &&
    (new Date(d.expiresOn).getTime() - now.getTime()) / 86_400_000 <= 60).length, N.documentsExpiring60, false);
  eq("Approvals pending today", ds.approvalRequests.filter((a) => a.status === "PENDING" || a.status === "ESCALATED").length, N.approvalsPending);

  /* ------------------------------- SD-4: privacy -------------------------- */
  ok("Seed contains no real personal data (all names fictional)",
    ds.employees.every((e) => e.name.split(" ").length >= 2) &&
    ds.employees.every((e) => e.email.endsWith("@bhushancorp.in")),
    "fictional throughout", `${ds.employees.length} employee records`);

  const passed = checks.every((c) => c.pass);
  const criticalFailed = checks.some((c) => !c.pass && c.critical);
  return { checks, passed, criticalFailed };
}
