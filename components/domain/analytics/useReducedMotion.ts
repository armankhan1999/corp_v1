"use client";

import { useEffect, useState } from "react";

/**
 * PRD §11.8 — chart entry animation is 400 ms, staggered 30 ms per series, and
 * is switched off entirely when the reader has asked for reduced motion. The
 * CSS media query handles transitions; Recharts animates in JavaScript, so it
 * needs to be told.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}
