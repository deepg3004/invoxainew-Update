"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal: adds `.in` to every `.iv-reveal` as it scrolls into view, with an
 * automatic stagger. One tiny observer for the whole page. Honors reduced-motion
 * (the CSS already no-ops `.iv-reveal` there; here we also reveal immediately so
 * nothing can stay hidden if JS/observer is unavailable).
 */
export function Reveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".iv-reveal"));
    if (els.length === 0) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 6) * 80}ms`;
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return null;
}
