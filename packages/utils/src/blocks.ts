/**
 * AI builder — structured page blocks (Phase 11, slice 1).
 *
 * A builder page is an ordered list of TYPED blocks. This module is the single
 * source of truth for the block shape, shared by the AI generator, the seller
 * editor, and the public renderer. Pure + client-safe (no server imports).
 *
 * SECURITY: blocks are rendered as structured markup, NEVER as raw HTML — so a
 * generated or edited page can't inject scripts. `normalizeToBlocks` is the trust
 * boundary: it validates every block, drops anything it doesn't recognize, and
 * sanitizes link/image URLs to http(s) or site-relative (blocking `javascript:`
 * and other dangerous schemes). It also upgrades the legacy AI-page content shape
 * ({title,tagline,sections,ctaLabel}) so existing pages keep rendering.
 */

export type Block =
  | { type: "heading"; text: string; level: 1 | 2 | 3 }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt: string }
  | { type: "button"; label: string; href: string }
  | { type: "divider" };

export interface BuilderContent {
  title: string;
  blocks: Block[];
}

const MAX_BLOCKS = 100;

function str(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Allow only http(s) absolute URLs or site-relative paths; else "". */
function safeUrl(v: unknown): string {
  const s = str(v, 2000).trim();
  if (!s) return "";
  if (s.startsWith("/")) return s; // site-relative
  if (/^https?:\/\//i.test(s)) return s;
  return ""; // blocks javascript:, data:, etc.
}

function asLevel(v: unknown): 1 | 2 | 3 {
  return v === 1 || v === 2 || v === 3 ? v : 2;
}

/** Validate one untrusted object into a Block, or null to drop it. */
function toBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  switch (b.type) {
    case "heading": {
      const text = str(b.text, 300).trim();
      return text ? { type: "heading", text, level: asLevel(b.level) } : null;
    }
    case "text": {
      const text = str(b.text).trim();
      return text ? { type: "text", text } : null;
    }
    case "image": {
      const url = safeUrl(b.url);
      return url ? { type: "image", url, alt: str(b.alt, 300) } : null;
    }
    case "button": {
      const label = str(b.label, 120).trim();
      const href = safeUrl(b.href);
      return label && href ? { type: "button", label, href } : null;
    }
    case "divider":
      return { type: "divider" };
    default:
      return null;
  }
}

interface LegacySection {
  heading: unknown;
  body: unknown;
}

/** Build blocks from the legacy AI-page shape so old pages still render. */
function fromLegacy(c: Record<string, unknown>): Block[] {
  const blocks: Block[] = [];
  const tagline = str(c.tagline, 300).trim();
  if (tagline) blocks.push({ type: "text", text: tagline });
  if (Array.isArray(c.sections)) {
    for (const s of c.sections as LegacySection[]) {
      const heading = str(s?.heading, 300).trim();
      const body = str(s?.body).trim();
      if (heading) blocks.push({ type: "heading", text: heading, level: 2 });
      if (body) blocks.push({ type: "text", text: body });
    }
  }
  return blocks;
}

/**
 * Normalize any stored AI-page `content` into a validated BuilderContent. Accepts
 * the new {title, blocks} shape or the legacy {title,tagline,sections,ctaLabel}
 * shape; always returns a safe, render-ready object.
 */
export function normalizeToBlocks(content: unknown): BuilderContent {
  const c = (content && typeof content === "object" ? content : {}) as Record<string, unknown>;
  const title = str(c.title, 300).trim() || "Untitled";

  let blocks: Block[];
  if (Array.isArray(c.blocks)) {
    blocks = (c.blocks as unknown[]).map(toBlock).filter((b): b is Block => b !== null);
  } else {
    blocks = fromLegacy(c);
  }
  return { title, blocks: blocks.slice(0, MAX_BLOCKS) };
}
