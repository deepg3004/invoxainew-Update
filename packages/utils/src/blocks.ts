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
  | { type: "video"; url: string } // url is ALWAYS a sanitized embed URL
  | { type: "divider" }
  // Builder Part 2 — static content widgets (no URLs, no raw HTML; all text capped).
  | { type: "list"; items: string[] } // bullet list
  | { type: "testimonial"; quote: string; author: string }
  | { type: "callout"; text: string } // highlighted note box
  | { type: "faq"; items: { q: string; a: string }[] } // accordion of Q&A pairs
  | { type: "countdown"; until: string; label: string } // until = ISO datetime; label optional
  // Builder Part 3 — entity-bound widgets. These store ONLY a validated entity id
  // (UUID); this module stays pure (no data fetch). The server renderer resolves
  // each id TENANT-SCOPED, so a foreign/missing id renders nothing — the trust
  // boundary for entity references. They render as themed cards/buttons that link
  // to the existing public pages (/p /c /store /f /pay), reusing every flow.
  | { type: "product"; productId: string } // single product card → /p/<slug>
  | { type: "course"; courseId: string } // single course card → /c/<slug>
  | { type: "storeGrid"; collectionId: string | null } // products grid → /store, optionally one collection
  | { type: "leadForm"; formId: string } // lead-form card → /f/<slug>
  | { type: "paymentButton"; pageId: string; label: string }; // payment link → /pay/<slug>

// ── Theme (AI builder slice 2) ───────────────────────────────────────────────

export type ThemePreset = "light" | "midnight" | "aurora" | "sand";

export interface Theme {
  preset: ThemePreset;
  /** Accent colour (buttons + hero rule), hex; defaults to the preset's accent. */
  accent: string;
}

/** Concrete CSS tokens per preset. `bg` may be a colour or a CSS gradient. */
export const THEME_PRESETS: Record<
  ThemePreset,
  { label: string; bg: string; text: string; muted: string; accent: string; border: string }
> = {
  light: { label: "Clean light", bg: "#ffffff", text: "#171717", muted: "#525252", accent: "#7C3AED", border: "#e5e5e5" },
  midnight: { label: "Midnight", bg: "#050816", text: "#F8FAFC", muted: "#94A3B8", accent: "#06B6D4", border: "#1E293B" },
  aurora: { label: "Aurora", bg: "linear-gradient(135deg,#1E1B4B,#312E81 45%,#0F172A)", text: "#F8FAFC", muted: "#C4B5FD", accent: "#A855F7", border: "#312E81" },
  sand: { label: "Warm sand", bg: "#F4F1EA", text: "#292524", muted: "#78716C", accent: "#C2682E", border: "#E7E2D6" },
};

const PRESET_IDS = Object.keys(THEME_PRESETS) as ThemePreset[];
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Validate a stored theme, falling back to safe defaults. The accent must be a
 *  hex colour (no arbitrary CSS — it's interpolated into inline styles). */
export function normalizeTheme(content: unknown): Theme {
  const t = (content && typeof content === "object" ? (content as Record<string, unknown>).theme : null) as
    | Record<string, unknown>
    | null
    | undefined;
  const preset: ThemePreset =
    t && PRESET_IDS.includes(t.preset as ThemePreset) ? (t.preset as ThemePreset) : "light";
  const rawAccent = typeof t?.accent === "string" ? t.accent.trim() : "";
  const accent = HEX_RE.test(rawAccent) ? rawAccent : THEME_PRESETS[preset].accent;
  return { preset, accent };
}

const MAX_BLOCKS = 100;

function str(v: unknown, max = 4000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Allow only http(s) absolute URLs or site-relative paths; else "". */
export function safeUrl(v: unknown): string {
  const s = str(v, 2000).trim();
  if (!s) return "";
  // Site-relative ("/path") only — NOT protocol-relative ("//evil.com"), which
  // the browser resolves to an off-site absolute URL. Browsers also normalize
  // backslashes to forward slashes ("/\evil.com" === "//evil.com") and strip
  // ASCII tab/newline BEFORE parsing ("/<tab>/evil.com" === "//evil.com"), so
  // reject any backslash, tab, CR or LF in a relative path outright.
  if (s.startsWith("/") && !s.startsWith("//") && !/[\\\t\r\n]/.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return ""; // blocks javascript:, data:, protocol-relative, etc.
}

function asLevel(v: unknown): 1 | 2 | 3 {
  return v === 1 || v === 2 || v === 3 ? v : 2;
}

/** Validate a datetime string into a canonical ISO string, or "" if unparseable.
 *  Used by the countdown widget; the value is rendered as text / fed to a client
 *  timer, never interpolated as code. */
function isoDate(v: unknown): string {
  const s = str(v, 40).trim();
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A validated entity id (UUID) for entity-bound blocks, or "" to drop the ref.
 *  The renderer resolves it tenant-scoped, so the only requirement here is that
 *  it's a well-formed id (no injection surface — it's never interpolated raw). */
function entityId(v: unknown): string {
  const s = str(v, 64).trim().toLowerCase();
  return UUID_RE.test(s) ? s : "";
}

/**
 * Convert any YouTube/Vimeo URL into a canonical, embed-safe iframe URL — or ""
 * if it isn't a recognized provider. SECURITY: the renderer puts this straight
 * into an <iframe src>, so we ONLY ever emit youtube.com/embed or
 * player.vimeo.com URLs built from an extracted id; arbitrary input can't reach
 * the iframe. Idempotent — an already-embed URL re-parses to itself.
 */
export function toEmbedUrl(input: unknown): string {
  const s = str(input, 500).trim();
  if (!s) return "";
  const yt = s.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,15})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = s.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return "";
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
    case "video": {
      const url = toEmbedUrl(b.url);
      return url ? { type: "video", url } : null;
    }
    case "divider":
      return { type: "divider" };
    case "list": {
      const raw = Array.isArray(b.items) ? b.items : [];
      const items = raw
        .map((it) => str(it, 200).trim())
        .filter((it) => it.length > 0)
        .slice(0, 20);
      return items.length > 0 ? { type: "list", items } : null;
    }
    case "testimonial": {
      const quote = str(b.quote, 1000).trim();
      const author = str(b.author, 120).trim();
      return quote ? { type: "testimonial", quote, author } : null;
    }
    case "callout": {
      const text = str(b.text, 1000).trim();
      return text ? { type: "callout", text } : null;
    }
    case "faq": {
      const raw = Array.isArray(b.items) ? b.items : [];
      const items = raw
        .map((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const q = str(o.q, 200).trim();
          const a = str(o.a, 1000).trim();
          return q && a ? { q, a } : null;
        })
        .filter((x): x is { q: string; a: string } => x !== null)
        .slice(0, 20);
      return items.length > 0 ? { type: "faq", items } : null;
    }
    case "countdown": {
      const until = isoDate(b.until);
      const label = str(b.label, 120).trim();
      return until ? { type: "countdown", until, label } : null;
    }
    case "product": {
      const productId = entityId(b.productId);
      return productId ? { type: "product", productId } : null;
    }
    case "course": {
      const courseId = entityId(b.courseId);
      return courseId ? { type: "course", courseId } : null;
    }
    case "storeGrid": {
      // A store grid is valid with no collection (shows all published products).
      const collectionId = entityId(b.collectionId);
      return { type: "storeGrid", collectionId: collectionId || null };
    }
    case "leadForm": {
      const formId = entityId(b.formId);
      return formId ? { type: "leadForm", formId } : null;
    }
    case "paymentButton": {
      const pageId = entityId(b.pageId);
      const label = str(b.label, 120).trim() || "Buy now";
      return pageId ? { type: "paymentButton", pageId, label } : null;
    }
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

export interface BuilderContent {
  title: string;
  blocks: Block[];
  theme: Theme;
}

/**
 * Normalize any stored AI-page `content` into a validated BuilderContent. Accepts
 * the new {title, blocks, theme} shape or the legacy {title,tagline,sections,
 * ctaLabel} shape; always returns a safe, render-ready object (legacy pages get
 * the default light theme).
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
  return { title, blocks: blocks.slice(0, MAX_BLOCKS), theme: normalizeTheme(content) };
}
