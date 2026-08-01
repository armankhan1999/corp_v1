import { Poppins, Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { decodeSession, SESSION_COOKIE } from "@/lib/rbac/session";
import "./globals.css";

/**
 * Fonts are self-hosted at build time by next/font, so the production build has
 * no external network dependency at runtime (NFR-22 / A-20 offline demo).
 */
/* Poppins is the display face on bhushancorp.in (its h1 rule names it
   explicitly). Inter stays for dense UI and tables, where Poppins' wide
   round forms cost too much horizontal room. */
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-poppins", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

// Deliberately untyped. Vercel's route-config analyser walks the TypeScript AST of
// every app-router segment and fails the deploy on a type annotation here with
// `Error: Unhandled type: "ColonToken"` -- after a clean build of all 80 routes.
// Next.js validates the shape at build time regardless. Do not re-add the annotation.
export const metadata = {
  title: "Pravaah — Bhushan Corp Operations",
  description:
    "Unified operations and intelligence platform for Bhushancorp Private Limited, Patna. Prototype with simulated integrations.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  const theme = session?.theme ?? "dark";
  const density = session?.density ?? "compact";

  return (
    <html lang="en-IN" data-theme={theme} data-density={density} suppressHydrationWarning>
      <body className={`${poppins.variable} ${inter.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
