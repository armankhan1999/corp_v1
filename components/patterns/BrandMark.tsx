/**
 * The Bhushan mark.
 *
 * Traced from the wordmark on bhushancorp.in — a rounded square outline holding
 * a stacked bar-and-dot glyph, set entirely in the house orange #FD6701, which
 * the live stylesheet also uses for its primary button, active nav item and
 * hover states.
 *
 * Rebuilt as SVG rather than serving the original raster. The published file is
 * a 505×80 JPEG on an opaque white field, which would sit in a white box on the
 * dark theme; this inherits `currentColor`, so it takes the brand orange on both
 * themes and stays crisp at any size.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="2.25" y="2.25" width="19.5" height="19.5" rx="4" />
      <path d="M8 7.25h3.25a2.5 2.5 0 0 1 0 5H8z" strokeLinejoin="round" />
      <path d="M8 12.25h3.75a2.5 2.5 0 0 1 0 5H8z" strokeLinejoin="round" />
      <circle cx="16.25" cy="9.75" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="16.25" cy="14.75" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Mark plus wordmark, as the rail and the login screen use it. */
export function BrandLockup({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <BrandMark className="size-5 shrink-0 text-primary-500" />
      {compact ? null : (
        <span
          className="truncate text-text-hi"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.0625rem",
            letterSpacing: "-0.01em",
          }}
        >
          Pravaah
        </span>
      )}
    </span>
  );
}
