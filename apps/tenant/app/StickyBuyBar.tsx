"use client";

import { formatRupees } from "@invoxai/utils/money";

/**
 * Mobile-only sticky bottom CTA bar with dual pricing (struck retail + bold offer +
 * % off) and an animated shimmer button. Tapping it scrolls to the on-page buy box
 * (id=`targetId`) where the real purchase flow lives — so this never touches the
 * money path. Hidden on desktop (md+), where the inline buy box is already visible.
 * Respects the phone safe-area inset. Self-contained CSS (no theme runtime needed).
 */
export function StickyBuyBar({
  label,
  offerPaise,
  compareAtPaise,
  targetId = "buybox",
  gradient = "linear-gradient(135deg,#7C3AED,#EC4899)",
}: {
  label: string;
  offerPaise: number;
  compareAtPaise?: number | null;
  targetId?: string;
  gradient?: string;
}) {
  const onSale = compareAtPaise != null && compareAtPaise > offerPaise;
  const pct = onSale ? Math.round((1 - offerPaise / compareAtPaise!) * 100) : 0;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
.ivbar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;align-items:center;
  gap:12px;background:#fff;border-top:1px solid rgba(0,0,0,.08);
  box-shadow:0 -8px 24px rgba(0,0,0,.10);
  padding:10px 16px calc(10px + env(safe-area-inset-bottom));}
.ivbar-btn{position:relative;overflow:hidden;flex:1;min-height:52px;border:0;cursor:pointer;
  border-radius:14px;color:#fff;font-weight:700;font-size:16px;
  display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .12s ease;}
.ivbar-btn:active{transform:scale(.97);}
.ivbar-btn::after{content:"";position:absolute;top:0;left:-60%;width:45%;height:100%;
  background:linear-gradient(120deg,transparent,rgba(255,255,255,.55),transparent);
  transform:skewX(-20deg);animation:ivbar-sh 2.6s ease-in-out infinite;}
@keyframes ivbar-sh{0%{left:-60%}55%{left:130%}100%{left:130%}}
@media (prefers-reduced-motion:reduce){.ivbar-btn::after{animation:none}.ivbar-btn:active{transform:none}}
`,
        }}
      />
      <div className="ivbar md:hidden">
        <div className="leading-tight">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-zinc-900">{formatRupees(offerPaise)}</span>
            {onSale ? (
              <span className="text-sm text-zinc-400 line-through">{formatRupees(compareAtPaise!)}</span>
            ) : null}
          </div>
          {onSale ? <span className="text-[11px] font-semibold text-green-700">{pct}% OFF</span> : null}
        </div>
        <button
          type="button"
          className="ivbar-btn"
          style={{ background: gradient }}
          onClick={() =>
            document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
        >
          {label}
        </button>
      </div>
      {/* spacer so page content isn't hidden behind the fixed bar on mobile */}
      <div className="h-24 md:hidden" aria-hidden />
    </>
  );
}
