"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface WorkspaceTab { href: string; label: string; count?: string; exact?: boolean }

/** E6-S7 — one workspace, seven contracted tabs plus cost and O&M. */
export function WorkspaceTabs({ tabs }: { tabs: WorkspaceTab[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project workspace" className="overflow-x-auto border-b border-line">
      <ul className="flex min-w-max">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "t-body-sm flex h-9 items-center gap-1.5 border-b-2 px-3 transition-colors duration-150",
                  active
                    ? "border-b-[var(--v-projects)] text-text-hi"
                    : "border-b-transparent text-text-mid hover:bg-surface-2 hover:text-text-hi",
                )}
              >
                {t.label}
                {t.count ? (
                  <span
                    className="t-mono rounded bg-surface-3 px-1 text-[0.6875rem] text-text-lo"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {t.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
