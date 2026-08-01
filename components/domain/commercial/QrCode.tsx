"use client";

import * as React from "react";
import QRCode from "qrcode";

/**
 * INT-02 — the signed QR the IRP returns, rendered in the statutory position
 * on the tax invoice.
 *
 * The matrix is computed locally by the `qrcode` package and drawn as React
 * SVG elements. Nothing leaves the browser: no image service, no CDN, no
 * network call — the artefact on the printed page is produced from the payload
 * printed beside it. Rendering through React rather than injected markup keeps
 * the component free of `dangerouslySetInnerHTML`.
 */
export function QrCode({
  payload, size = 116, label,
}: { payload: string; size?: number; label: string }) {
  const { path, modules, failed } = React.useMemo(() => {
    try {
      const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
      const n = qr.modules.size;
      const data = qr.modules.data;
      let d = "";
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
        }
      }
      return { path: d, modules: n, failed: false };
    } catch {
      return { path: "", modules: 0, failed: true };
    }
  }, [payload]);

  if (failed || !modules) {
    return (
      <div
        style={{ width: size, height: size }}
        className="grid place-items-center border border-dashed border-black/40 p-2 text-center text-[9px] leading-tight text-black/70"
      >
        QR could not be rendered from the acknowledgement payload
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${modules} ${modules}`}
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      <rect width={modules} height={modules} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
