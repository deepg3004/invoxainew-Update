import { safeUrl } from "@invoxai/utils/blocks";

export interface BioLinkConfig {
  linksText: string | null;
  instagram: string | null;
  youtube: string | null;
  twitter: string | null;
  facebook: string | null;
  whatsapp: string | null;
  website: string | null;
  tiktok: string | null;
  linkedin: string | null;
  threads: string | null;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
/** Validate a stored bio background colour to a hex value, or "" — it's
 *  interpolated into an inline style, so only a hex colour may pass. */
export function bioBgColor(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  return HEX_RE.test(s) ? s : "";
}

export interface BioTarget {
  label: string;
  href: string;
}

// Parse "Label | https://url" lines into sanitized targets.
function parseLinks(text: string | null): BioTarget[] {
  if (!text) return [];
  return text
    .split("\n")
    .slice(0, 30)
    .map((line) => {
      const i = line.indexOf("|");
      const label = (i === -1 ? line : line.slice(0, i)).trim();
      const href = safeUrl(i === -1 ? "" : line.slice(i + 1));
      return { label: label || href, href };
    })
    .filter((l) => l.href && l.label);
}

/**
 * The rendered, sanitized targets of a bio page — the SINGLE source of truth
 * shared by the public page (rendering) and the /bio/r redirect (its allowlist),
 * so a click can only be recorded + redirected to a target that is actually on
 * this tenant's bio (no open redirect).
 */
export function bioRender(
  bio: BioLinkConfig,
  opts: { hasProducts: boolean; hasCourses: boolean },
): { socials: BioTarget[]; buttons: BioTarget[] } {
  const socials: BioTarget[] = [
    { label: "Instagram", href: safeUrl(bio.instagram) },
    { label: "YouTube", href: safeUrl(bio.youtube) },
    { label: "X", href: safeUrl(bio.twitter) },
    { label: "Facebook", href: safeUrl(bio.facebook) },
    { label: "WhatsApp", href: safeUrl(bio.whatsapp) },
    { label: "Website", href: safeUrl(bio.website) },
    { label: "TikTok", href: safeUrl(bio.tiktok) },
    { label: "LinkedIn", href: safeUrl(bio.linkedin) },
    { label: "Threads", href: safeUrl(bio.threads) },
  ].filter((s) => s.href);

  const auto: BioTarget[] = [];
  if (opts.hasProducts) auto.push({ label: "🛍️ Visit store", href: "/store" });
  if (opts.hasCourses) auto.push({ label: "🎓 Browse courses", href: "/courses" });

  return { socials, buttons: [...auto, ...parseLinks(bio.linksText)] };
}

/** href → label map of every clickable target, for the redirect's allowlist. */
export function bioAllowedHrefs(r: {
  socials: BioTarget[];
  buttons: BioTarget[];
}): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of [...r.socials, ...r.buttons]) m.set(t.href, t.label);
  return m;
}

/** Wrap a target href so the click routes through the tracking redirect. */
export function trackHref(href: string): string {
  return `/bio/r?u=${encodeURIComponent(href)}`;
}
