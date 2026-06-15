import { themeCss, themeFontHref, type ThemeTokens, type ThemeBackground } from "@invoxai/utils/blocks";

/**
 * Premium theme runtime (server components). Paints a public page with a resolved
 * theme: per-theme Google fonts + the scoped CSS (vars + motion) from themeCss(),
 * the animated background layer, and the "Built with InvoxAI" badge. All CSS values
 * come from resolveTheme (validated) so the inlined CSS can't be an injection vector.
 * Scoped under `.iv-page`. The same themeCss() powers the editor's live preview, so
 * a theme looks identical in both places.
 */

/** <link>s for the theme's fonts + a scoped <style> with tokens + motion CSS. */
export function ThemeStyle({ t }: { t: ThemeTokens }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/google-font-preconnect */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={themeFontHref(t)} />
      <style dangerouslySetInnerHTML={{ __html: themeCss(t) }} />
    </>
  );
}

/** The fixed animated-background layer for the page's theme. `plain` renders nothing. */
export function AnimatedBg({ type }: { type: ThemeBackground }) {
  if (type === "plain") return null;
  if (type === "floats") {
    return (
      <div className="iv-bg iv-bg-floats" aria-hidden>
        <span /><span /><span />
      </div>
    );
  }
  return <div className={`iv-bg iv-bg-${type}`} aria-hidden />;
}

/** Small, glassy, theme-tinted "Built with InvoxAI" badge, bottom-right. */
export function BuiltWithBadge() {
  return (
    <a
      href="https://invoxai.io"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-3 right-3 z-50 rounded-full px-3 py-1.5 text-[11px] font-medium no-underline shadow-md backdrop-blur"
      style={{ background: "rgba(255,255,255,.7)", color: "#1A1430", border: "1px solid rgba(0,0,0,.08)" }}
    >
      ⚡ Built with InvoxAI
    </a>
  );
}
