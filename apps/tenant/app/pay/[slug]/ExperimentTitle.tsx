"use client";

import { useEffect, useState } from "react";
import { pickVariant, type Variant } from "@invoxai/utils/experiment";

export type ExperimentInfo = {
  id: string;
  variantBTitle: string;
  variantBDescription: string | null;
};

function cookieName(id: string): string {
  return `exp_${id}`;
}

/** Read this experiment's sticky variant from the cookie, or null. */
export function readExperimentVariant(id: string): Variant | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${cookieName(id)}=([AB])`));
  return m ? (m[1] as Variant) : null;
}

function assignVariant(id: string): Variant {
  const existing = readExperimentVariant(id);
  if (existing) return existing;
  const v = pickVariant(Math.random());
  // 30-day sticky bucket.
  document.cookie = `${cookieName(id)}=${v}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  return v;
}

/**
 * Growth G1.6 — renders a payment page's title/description for the visitor's A/B
 * variant. Variant A is the page's own copy; B is the experiment override. The bucket
 * is sticky per visitor (cookie) and a view is counted once per render. Server renders
 * variant A by default (SEO / no-JS); the client swaps to B when bucketed.
 */
export function ExperimentTitle({
  experiment,
  aTitle,
  aDescription,
}: {
  experiment: ExperimentInfo;
  aTitle: string;
  aDescription: string | null;
}) {
  const [variant, setVariant] = useState<Variant>("A");

  useEffect(() => {
    const v = assignVariant(experiment.id);
    setVariant(v);
    // Count the view (best-effort beacon).
    void fetch("/api/exp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: experiment.id, variant: v, kind: "view" }),
      keepalive: true,
    }).catch(() => {});
  }, [experiment.id]);

  const title = variant === "B" ? experiment.variantBTitle : aTitle;
  const description = variant === "B" ? experiment.variantBDescription : aDescription;

  return (
    <>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      {description ? <p className="mt-2 text-muted">{description}</p> : null}
    </>
  );
}
