import { ctaGradient, type ThemeTokens, type ThemeBackground } from "@invoxai/utils/blocks";

/**
 * Premium theme runtime (Phase 0b/1). Server components that paint a public page
 * with a resolved theme: CSS variables + the motion CSS (CTA shimmer, scroll-reveal,
 * animated backgrounds), per-theme Google fonts, the animated background layer, and
 * the "Built with InvoxAI" badge.
 *
 * SECURITY: every interpolated value comes from resolveTheme() — hex colors,
 * allow-listed fonts, numeric radius, gradient-or-hex bg — so the inlined CSS can't
 * be an injection vector. Scoped under `.iv-page` so it never leaks to the rest of
 * the app.
 */

function fontFamilyParam(f: string): string {
  return f.replace(/ /g, "+");
}

/** <link>s for the theme's fonts + a scoped <style> with tokens + motion CSS. */
export function ThemeStyle({ t }: { t: ThemeTokens }) {
  const fonts = Array.from(new Set([t.fontHeading, t.fontBody]));
  const href = `https://fonts.googleapis.com/css2?${fonts
    .map((f) => `family=${fontFamilyParam(f)}:wght@400;500;600;700;800`)
    .join("&")}&display=swap`;

  const css = `
.iv-page{
  --iv-primary:${t.primary};--iv-primary2:${t.primary2};--iv-accent:${t.accent};
  --iv-surface:${t.surface};--iv-text:${t.text};--iv-muted:${t.muted};--iv-border:${t.border};
  --iv-radius:${t.radius}px;--iv-cta:${ctaGradient(t)};--iv-shimmer:${t.ctaShimmer};
  --iv-fh:'${t.fontHeading}',system-ui,-apple-system,sans-serif;
  --iv-fb:'${t.fontBody}',system-ui,-apple-system,sans-serif;
  font-family:var(--iv-fb);
}
.iv-page h1,.iv-page h2,.iv-page h3,.iv-page .iv-h{font-family:var(--iv-fh);}
/* gradient CTA + shimmer */
.iv-cta{position:relative;overflow:hidden;background:var(--iv-cta);color:#fff;
  border-radius:var(--iv-radius);transition:transform .12s ease,filter .2s ease;}
.iv-cta:hover{filter:brightness(1.04);}
.iv-cta:active{transform:scale(.97);}
.iv-cta::after{content:"";position:absolute;top:0;left:-60%;width:45%;height:100%;
  background:linear-gradient(120deg,transparent,var(--iv-shimmer),transparent);
  transform:skewX(-20deg);animation:iv-shimmer 2.6s ease-in-out infinite;}
@keyframes iv-shimmer{0%{left:-60%}55%{left:130%}100%{left:130%}}
/* scroll reveal */
.iv-reveal{opacity:0;transform:translateY(24px);
  transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1);}
.iv-reveal.in{opacity:1;transform:none;}
/* animated backgrounds (subtle, GPU-friendly) */
.iv-bg{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;}
.iv-bg-mesh::before,.iv-bg-mesh::after{content:"";position:absolute;width:60vmax;height:60vmax;
  border-radius:50%;filter:blur(90px);opacity:.4;will-change:transform;}
.iv-bg-mesh::before{background:var(--iv-primary);top:-12%;left:-10%;animation:iv-d1 20s ease-in-out infinite;}
.iv-bg-mesh::after{background:var(--iv-primary2);bottom:-12%;right:-10%;animation:iv-d2 26s ease-in-out infinite;}
@keyframes iv-d1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(16vw,8vh) scale(1.12)}}
@keyframes iv-d2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-12vw,-10vh) scale(1.08)}}
.iv-bg-aurora{background:
  radial-gradient(45% 60% at 20% 20%, color-mix(in srgb,var(--iv-primary) 40%,transparent), transparent 60%),
  radial-gradient(45% 60% at 80% 30%, color-mix(in srgb,var(--iv-primary2) 40%,transparent), transparent 60%);
  background-size:200% 200%;animation:iv-aurora 18s ease infinite;}
@keyframes iv-aurora{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.iv-bg-stars::before{content:"";position:absolute;inset:0;
  background-image:radial-gradient(1.5px 1.5px at 20% 30%,var(--iv-accent),transparent),
    radial-gradient(1px 1px at 60% 70%,#fff,transparent),
    radial-gradient(1.5px 1.5px at 80% 20%,#fff,transparent),
    radial-gradient(1px 1px at 35% 85%,var(--iv-accent),transparent);
  background-size:300px 300px;animation:iv-tw 5s ease-in-out infinite;}
@keyframes iv-tw{0%,100%{opacity:.5}50%{opacity:1}}
.iv-bg-grid{background-image:linear-gradient(var(--iv-border) 1px,transparent 1px),
  linear-gradient(90deg,var(--iv-border) 1px,transparent 1px);background-size:44px 44px;
  -webkit-mask-image:radial-gradient(ellipse 80% 60% at 50% 40%,#000 35%,transparent 75%);
  mask-image:radial-gradient(ellipse 80% 60% at 50% 40%,#000 35%,transparent 75%);
  animation:iv-grid 30s linear infinite;}
@keyframes iv-grid{from{background-position:0 0}to{background-position:44px 44px}}
.iv-bg-scan::after{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(transparent 0 2px,rgba(255,255,255,.035) 2px 4px);
  animation:iv-scan 9s linear infinite;}
@keyframes iv-scan{from{background-position:0 0}to{background-position:0 120px}}
.iv-bg-stripes{background-image:repeating-linear-gradient(45deg,
  color-mix(in srgb,var(--iv-primary) 8%,transparent) 0 24px,transparent 24px 48px);
  background-size:200% 200%;animation:iv-stripe 6s linear infinite;}
@keyframes iv-stripe{to{background-position:96px 96px}}
.iv-bg-blob::before{content:"";position:absolute;width:55vmax;height:55vmax;left:50%;top:40%;
  transform:translate(-50%,-50%);background:var(--iv-primary);opacity:.14;filter:blur(40px);
  border-radius:42% 58% 70% 30%/45% 45% 55% 55%;animation:iv-morph 16s ease-in-out infinite;}
@keyframes iv-morph{0%,100%{border-radius:42% 58% 70% 30%/45% 45% 55% 55%;transform:translate(-50%,-50%) rotate(0)}
  50%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%;transform:translate(-50%,-50%) rotate(180deg)}}
.iv-bg-floats span{position:absolute;display:block;border-radius:50%;opacity:.16;will-change:transform;}
.iv-bg-floats span:nth-child(1){width:120px;height:120px;left:10%;bottom:-140px;background:var(--iv-primary);animation:iv-rise 18s linear infinite;}
.iv-bg-floats span:nth-child(2){width:80px;height:80px;left:45%;bottom:-100px;background:var(--iv-accent);animation:iv-rise 24s linear infinite 3s;}
.iv-bg-floats span:nth-child(3){width:160px;height:160px;left:75%;bottom:-180px;background:var(--iv-primary2);animation:iv-rise 20s linear infinite 6s;}
@keyframes iv-rise{to{transform:translateY(-120vh) rotate(180deg)}}
@media (prefers-reduced-motion:reduce){
  .iv-cta::after{animation:none}.iv-cta:active{transform:none}
  .iv-reveal{opacity:1;transform:none;transition:none}
  .iv-bg,.iv-bg *{animation:none!important}
}
`;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/google-font-preconnect */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={href} />
      <style dangerouslySetInnerHTML={{ __html: css }} />
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
