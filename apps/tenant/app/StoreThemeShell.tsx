import type { ReactNode } from "react";
import { resolveTheme, normalizeTheme } from "@invoxai/utils/blocks";
import { ThemeStyle, AnimatedBg } from "./ThemeRuntime";

/**
 * Wraps a storefront page in the tenant's selected store theme — the same
 * treatment /store and the product/course/etc detail pages already get, so the
 * WHOLE public storefront (home, list pages, cart, bio, lead forms) is themed
 * consistently instead of falling back to an unstyled white page.
 *
 * Note: AI builder pages (/[slug]) intentionally do NOT use this — they carry
 * their own per-page content.theme, which can differ from the store theme.
 */
export function StoreThemeShell({
  storeTheme,
  className = "mx-auto max-w-6xl px-6 py-12",
  children,
}: {
  storeTheme?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const theme = resolveTheme(normalizeTheme({ theme: { preset: storeTheme || "pure-snow" } }));
  return (
    <div className="iv-page" style={{ background: theme.bg, minHeight: "100vh", position: "relative" }}>
      <ThemeStyle t={theme} />
      <AnimatedBg type={theme.background} />
      <main className={`relative z-10 ${className}`}>{children}</main>
    </div>
  );
}
