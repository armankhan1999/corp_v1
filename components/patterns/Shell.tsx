"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Boxes, Building2, ChevronLeft, FileText, Gauge, HardHat, LayoutGrid, Moon, Receipt,
  Rows3, Search, Settings, Sparkles, Sun, Users, Wrench, BellDot,
} from "lucide-react";
import type { Role } from "@/lib/schemas/enums";
import { ROLE_LABEL } from "@/lib/schemas/enums";
import { can, type Capability } from "@/lib/rbac/matrix";
import { encodeSession, SESSION_COOKIE, type Session } from "@/lib/rbac/session";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { openCommandPalette } from "@/components/domain/admin/CommandPaletteMount";
import { BrandLockup } from "@/components/patterns/BrandMark";

interface NavItem { label: string; href: string; cap: Capability }
interface NavSection { label: string; icon: React.ComponentType<{ className?: string }>; items: NavItem[] }

const NAV: NavSection[] = [
  { label: "Command", icon: Gauge, items: [
    { label: "Command Centre", href: "/command", cap: "command" },
    { label: "Branch League Table", href: "/command/branches", cap: "command.league" },
    { label: "Exception Feed", href: "/command/exceptions", cap: "command.exceptions" },
  ] },
  { label: "Sales", icon: LayoutGrid, items: [
    { label: "My Desk", href: "/sales/my-desk", cap: "enquiries" },
    { label: "Pipeline", href: "/sales/pipeline", cap: "enquiries" },
    { label: "Enquiries", href: "/sales/enquiries", cap: "enquiries" },
    { label: "Quotations", href: "/sales/quotations", cap: "quotations" },
    { label: "Sales Orders", href: "/sales/orders", cap: "salesOrders" },
    { label: "Customers", href: "/sales/customers", cap: "customers" },
  ] },
  { label: "Service", icon: Wrench, items: [
    { label: "Dispatch Board", href: "/service/dispatch", cap: "dispatch" },
    { label: "Tickets", href: "/service/tickets", cap: "tickets" },
    { label: "Job Cards", href: "/service/job-cards", cap: "jobCards" },
    { label: "Installed Assets", href: "/service/assets", cap: "assets" },
    { label: "AMC Contracts", href: "/service/amc", cap: "amc" },
    { label: "Renewal Radar", href: "/service/renewals", cap: "renewals" },
    { label: "Commissioning", href: "/service/commissioning", cap: "commissioning" },
    { label: "Rental Fleet", href: "/service/rental", cap: "rental" },
  ] },
  { label: "Projects", icon: HardHat, items: [
    { label: "Portfolio", href: "/projects", cap: "projects" },
    { label: "Retention Register", href: "/projects/retention", cap: "retention" },
  ] },
  { label: "Inventory", icon: Boxes, items: [
    { label: "Stock", href: "/inventory/stock", cap: "stock" },
    { label: "Issue & Receipt", href: "/inventory/movements", cap: "stock" },
    { label: "Reorder List", href: "/inventory/reorder", cap: "reorder" },
    { label: "Item Master", href: "/inventory/items", cap: "items" },
    { label: "Suppliers & POs", href: "/inventory/purchase", cap: "purchaseOrders" },
  ] },
  { label: "Commercial", icon: Receipt, items: [
    { label: "Receivables", href: "/commercial/receivables", cap: "receivables" },
    { label: "Invoices", href: "/commercial/invoices", cap: "invoices" },
    { label: "Delivery Challans", href: "/commercial/challans", cap: "challans" },
    { label: "E-Way Bills", href: "/commercial/eway", cap: "eway" },
    { label: "Receipts", href: "/commercial/receipts", cap: "receipts" },
    { label: "Ledger Hand-off", href: "/commercial/handoff", cap: "handoff" },
  ] },
  { label: "People", icon: Users, items: [
    { label: "Attendance", href: "/people/attendance", cap: "attendance" },
    { label: "Leave", href: "/people/leave", cap: "leave" },
    { label: "Employees", href: "/people/employees", cap: "employees" },
    { label: "Statutory Documents", href: "/people/documents", cap: "hrDocuments" },
  ] },
  { label: "Knowledge", icon: FileText, items: [
    { label: "Document Vault", href: "/vault", cap: "vault" },
    { label: "Ask the Vault", href: "/vault/ask", cap: "vaultAsk" },
  ] },
  { label: "Workflow", icon: Rows3, items: [
    { label: "My Approvals", href: "/workflow/approvals", cap: "approvals" },
    { label: "Approval Chains", href: "/workflow/chains", cap: "chainDesigner" },
    { label: "Notifications", href: "/workflow/notifications", cap: "notifications" },
  ] },
  { label: "Analytics", icon: Building2, items: [
    { label: "Sales", href: "/analytics/sales", cap: "analytics.sales" },
    { label: "Service", href: "/analytics/service", cap: "analytics.service" },
    { label: "Projects", href: "/analytics/projects", cap: "analytics.projects" },
    { label: "Cash", href: "/analytics/cash", cap: "analytics.cash" },
    { label: "Inventory", href: "/analytics/inventory", cap: "analytics.inventory" },
  ] },
  { label: "Assistant", icon: Sparkles, items: [
    { label: "AI Assistant", href: "/assistant", cap: "assistant" },
  ] },
  { label: "Admin", icon: Settings, items: [
    { label: "Users & Roles", href: "/admin/users", cap: "admin.users" },
    { label: "Permission Matrix", href: "/admin/permissions", cap: "admin.permissions" },
    { label: "Masters", href: "/admin/masters", cap: "admin.masters" },
    { label: "Integration Readiness", href: "/admin/integrations", cap: "admin.integrations" },
    { label: "Compliance & Consent", href: "/admin/compliance", cap: "admin.compliance" },
    { label: "Audit Log", href: "/admin/audit", cap: "admin.audit" },
    { label: "Demo Controls", href: "/admin/demo", cap: "admin.demo" },
  ] },
];

function writeSession(s: Session) {
  document.cookie = `${SESSION_COOKIE}=${encodeSession(s)}; path=/; max-age=86400; SameSite=Lax`;
}

export function Shell({
  session, unread, children,
}: { session: Session; unread: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(session.theme);
  const [density, setDensity] = useState(session.density);

  const [openPref, setOpenPref] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem("pravaah.v1.rail");
    if (stored) setCollapsed(stored === "1");
    try {
      const nav = window.localStorage.getItem("pravaah.v1.nav");
      if (nav) setOpenPref(JSON.parse(nav) as string[]);
    } catch { /* corrupt preference — the active section still opens */ }
  }, []);

  function toggleRail() {
    setCollapsed((c) => {
      window.localStorage.setItem("pravaah.v1.rail", c ? "0" : "1");
      return !c;
    });
  }

  function applyTheme(next: "dark" | "light") {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    writeSession({ ...session, theme: next });
  }

  function applyDensity(next: "compact" | "comfortable") {
    setDensity(next);
    document.documentElement.dataset.density = next;
    writeSession({ ...session, density: next });
  }

  const sections = NAV
    .map((s) => ({ ...s, items: s.items.filter((i) => can(session.role, i.cap)) }))
    .filter((s) => s.items.length > 0);

  /* The section holding the current route is always open; the rest remember
     what the user last chose. Derived during render rather than in an effect,
     so navigating never shows a frame with the wrong section expanded. */
  const activeSection =
    sections.find((s) =>
      s.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/")),
    )?.label ?? sections[0]?.label;

  const openSections = Array.from(
    new Set([...(activeSection ? [activeSection] : []), ...openPref]),
  );

  function toggleSection(label: string) {
    setOpenPref((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      window.localStorage.setItem("pravaah.v1.nav", JSON.stringify(next));
      return next;
    });
  }

  const crumbs = pathname.split("/").filter(Boolean);

  return (
    <div className="flex min-h-dvh bg-surface-0">
      {/* Left rail — 240px expanded, 64px collapsed. E1-S2 */}
      <nav
        aria-label="Primary"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r border-line bg-surface-1 md:flex",
          "[scrollbar-width:thin]",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-14 items-center border-b border-line px-3">
          <BrandLockup compact={collapsed} />
        </div>
        <div className="flex-1 py-2">
          {sections.map((section) => {
            const open = openSections.includes(section.label);
            return (
            <div key={section.label} className="mb-0.5">
              {!collapsed ? (
                /* Sections collapse. A Director sees eleven of them and forty-odd
                   links; rendering every one expanded turned the rail into a
                   wall the eye had to climb before it reached the page. The
                   section holding the current route opens itself. */
                <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  aria-expanded={open}
                  className="t-overline flex w-full items-center gap-1.5 px-3 pb-1 pt-3 text-text-lo transition-colors hover:text-text-mid"
                >
                  <ChevronLeft
                    aria-hidden
                    className={cn(
                      "size-3 shrink-0 transition-transform duration-150",
                      open ? "-rotate-90" : "rotate-0",
                    )}
                  />
                  <span className="truncate">{section.label}</span>
                </button>
              ) : (
                <div className="grid place-items-center py-2" title={section.label}>
                  <section.icon className="size-4 text-text-lo" aria-hidden />
                </div>
              )}
              <ul hidden={!collapsed && !open}>
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative mx-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[0.8125rem]",
                          "transition-[background-color,color,box-shadow] duration-150 ease-out",
                          active
                            ? "bg-surface-2 font-medium text-text-hi"
                            : "text-text-mid hover:bg-surface-2 hover:text-text-hi",
                          collapsed && "mx-1 justify-center px-0",
                        )}
                      >
                        {active && !collapsed ? (
                          <span
                            aria-hidden
                            className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary-500"
                          />
                        ) : null}
                        {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
                        {collapsed ? <span aria-hidden className="size-1.5 rounded-full bg-current opacity-60" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={toggleRail}
          className="flex h-10 items-center justify-center gap-1 border-t border-line text-text-lo hover:text-text-hi"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden />
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header — 56px. E1-S2 */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface-1/95 px-3 shadow-[0_1px_0_0_var(--line),0_6px_20px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm sm:px-4">
          <span className="t-body-sm hidden text-text-lo md:inline">
            {session.branchScope === "ALL" ? "All branches" : "Branch scope"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-md border border-line px-2 text-text-mid hover:border-line-strong hover:text-text-hi"
              aria-label="Open command palette"
              onClick={openCommandPalette}
            >
              <Search className="size-4" aria-hidden />
              <span className="t-body-sm hidden sm:inline">Search</span>
              <kbd className="t-mono hidden rounded-md border border-line px-1 text-[0.6875rem] text-text-lo sm:inline">
                Ctrl K
              </kbd>
            </button>

            <Link
              href="/workflow/notifications"
              className="relative grid size-8 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
              aria-label={`Notifications, ${unread} unread`}
            >
              <BellDot className="size-4" aria-hidden />
              {unread > 0 ? (
                <span className="t-mono absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] text-white">
                  {unread}
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
              className="grid size-8 place-items-center rounded-md border border-line text-text-mid hover:border-line-strong hover:text-text-hi"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            </button>

            <button
              type="button"
              onClick={() => applyDensity(density === "compact" ? "comfortable" : "compact")}
              className="t-overline hidden h-8 items-center rounded-md border border-line px-2 text-text-mid hover:border-line-strong hover:text-text-hi sm:flex"
              aria-label={`Switch to ${density === "compact" ? "comfortable" : "compact"} density`}
            >
              {density === "compact" ? "Compact" : "Comfort"}
            </button>

            <Link
              href="/login"
              className="flex h-8 items-center gap-2 rounded-md border border-line px-2 text-text-mid hover:border-line-strong hover:text-text-hi"
            >
              <span
                aria-hidden
                className="grid size-5 place-items-center rounded-md bg-surface-3 text-[0.625rem]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {initials(session.name)}
              </span>
              <span className="t-body-sm hidden max-w-40 truncate lg:inline">
                {ROLE_LABEL[session.role as Role]}
              </span>
            </Link>
          </div>
        </header>

        {/* Breadcrumbs — every ancestor is a working link. E1-S2 */}
        {crumbs.length > 0 ? (
          <nav aria-label="Breadcrumb" className="border-b border-line bg-surface-0 px-4 py-2">
            <ol className="flex flex-wrap items-center gap-1">
              {crumbs.map((c, i) => {
                const href = "/" + crumbs.slice(0, i + 1).join("/");
                const last = i === crumbs.length - 1;
                return (
                  <li key={href} className="flex items-center gap-1">
                    {i > 0 ? <span className="text-text-lo" aria-hidden>/</span> : null}
                    {last ? (
                      <span className="t-body-sm capitalize text-text-hi" aria-current="page">
                        {c.replace(/-/g, " ")}
                      </span>
                    ) : (
                      <Link href={href} className="t-body-sm capitalize text-text-mid hover:text-text-hi">
                        {c.replace(/-/g, " ")}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        <main className="min-w-0 flex-1 p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
