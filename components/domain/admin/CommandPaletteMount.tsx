"use client";

/**
 * E1-S5 mount point.
 *
 * Rendered once from `app/(app)/layout.tsx`, so the palette is live on every
 * authenticated route. The shell header's Search control opens it by calling
 * `openCommandPalette()`, which dispatches `PALETTE_EVENT` on `window`.
 */

import { CommandPalette, PALETTE_EVENT, type PaletteRecord } from "@/components/patterns/CommandPalette";

export function CommandPaletteMount({
  records,
  note,
}: {
  records: PaletteRecord[];
  note: string;
}) {
  return <CommandPalette records={records} indexNote={note} />;
}

/** Opens the palette from any client control. */
export function openCommandPalette(): void {
  window.dispatchEvent(new Event(PALETTE_EVENT));
}

export function CommandPaletteButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className={
        className ??
        "t-body-sm inline-flex h-8 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 text-text-mid hover:border-line-strong hover:text-text-hi"
      }
    >
      Search anything
      <kbd className="t-mono rounded border border-line px-1 text-[0.6875rem] text-text-lo">
        Ctrl K
      </kbd>
    </button>
  );
}
