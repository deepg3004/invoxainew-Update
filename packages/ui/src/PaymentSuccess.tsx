"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

const BRAND_COLORS = ["#F97316", "#EC4899", "#8B5CF6", "#F59E0B", "#10B981"];

/**
 * Celebratory payment-success panel: fires a confetti burst on mount, pops an
 * animated check, and shows a CTA. Shared by every buyer checkout surface
 * (product / course / pay page / cart) so the success moment is consistent.
 */
export function PaymentSuccess({
  title = "Payment successful",
  subtitle,
  ctaHref,
  ctaLabel,
}: {
  title?: string;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  useEffect(() => {
    // Two staggered bursts from the lower-middle for a fuller effect.
    confetti({
      particleCount: 90,
      spread: 75,
      startVelocity: 38,
      origin: { y: 0.65 },
      colors: BRAND_COLORS,
      disableForReducedMotion: true,
    });
    const t = setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 100,
        startVelocity: 28,
        origin: { y: 0.7 },
        colors: BRAND_COLORS,
        disableForReducedMotion: true,
      });
    }, 220);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
      <div className="mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-success text-white shadow-[0_0_30px_-4px_rgba(16,185,129,0.5)]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <p className="mt-4 font-display text-lg font-semibold text-zinc-900">{title}</p>
      {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      {ctaHref && ctaLabel ? (
        <a
          href={ctaHref}
          className="mt-4 inline-block rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-medium text-white shadow-glow transition hover:brightness-110"
        >
          {ctaLabel}
        </a>
      ) : null}
    </div>
  );
}
