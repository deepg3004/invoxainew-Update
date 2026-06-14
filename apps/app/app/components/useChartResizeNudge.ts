"use client";

import { useEffect } from "react";

/**
 * Work around recharts' ResponsiveContainer measuring a 0-width parent on its
 * first paint. These charts load via next/dynamic(ssr:false), so they mount
 * after layout and occasionally read the parent before the browser has committed
 * its width — leaving the area blank until some later resize (the "30d chart
 * blank on load" bug). A single requestAnimationFrame is flaky: if that one frame
 * still sees 0 (fonts/sidebar not settled yet), it never recovers.
 *
 * Fire a few nudges — two chained frames (layout is committed by the second) plus
 * short timeout fallbacks for slower async layout — so a correct re-measure always
 * lands once the container has a real width, then stop. Once ResponsiveContainer
 * has measured correctly, further same-size resize events are no-ops (no flicker).
 */
export function useChartResizeNudge(): void {
  useEffect(() => {
    const nudge = () => window.dispatchEvent(new Event("resize"));
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      nudge();
      raf2 = requestAnimationFrame(nudge);
    });
    const timers = [window.setTimeout(nudge, 120), window.setTimeout(nudge, 360)];
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      timers.forEach(clearTimeout);
    };
  }, []);
}
