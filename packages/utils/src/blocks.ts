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
  | { type: "columns"; cells: { title: string; text: string }[] } // 2–4 column feature/benefit grid
  | { type: "socialProof" } // data-bound: recent masked sales, resolved tenant-scoped at render
  // Builder Part 3 — entity-bound widgets. These store ONLY a validated entity id
  // (UUID); this module stays pure (no data fetch). The server renderer resolves
  // each id TENANT-SCOPED, so a foreign/missing id renders nothing — the trust
  // boundary for entity references. They render as themed cards/buttons that link
  // to the existing public pages (/p /c /store /f /pay), reusing every flow.
  | { type: "product"; productId: string } // single product card → /p/<slug>
  | { type: "course"; courseId: string } // single course card → /c/<slug>
  | { type: "storeGrid"; collectionId: string | null } // products grid → /store, optionally one collection
  | { type: "leadForm"; formId: string } // lead-form card → /f/<slug>
  | { type: "paymentButton"; pageId: string; label: string } // payment link → /pay/<slug>
  // Builder Part 4 — premium layout blocks. Pure presentation; no raw HTML, no
  // data fetch. Every field is capped plain text; URLs run through safeUrl. These
  // are what make a landing/sales page look "ultra-premium": a full hero, a
  // pricing table, an icon feature grid, and a stats strip.
  | {
      type: "hero";
      heading: string;
      subheading: string;
      ctaLabel: string;
      ctaHref: string; // sanitized http(s)/site-relative, or ""
      imageUrl: string; // sanitized, or "" (renders as a text-only hero)
    }
  | {
      type: "pricingTable";
      plans: {
        name: string;
        price: string; // free-form text, e.g. "₹999" or "Free"
        period: string; // e.g. "/month", "one-time"
        features: string[];
        ctaLabel: string;
        ctaHref: string; // sanitized, or ""
        highlighted: boolean; // visually featured "most popular" column
      }[];
    }
  | { type: "featureGrid"; items: { icon: string; title: string; text: string }[] } // icon = short text/emoji
  | { type: "stats"; items: { value: string; label: string }[] } // big-number counters
  // Builder Part 5 — premium media blocks. Images run through safeUrl; all text capped.
  | { type: "gallery"; images: { url: string; alt: string }[] } // responsive image grid
  | { type: "logoStrip"; logos: { url: string; alt: string }[] } // "as seen in" trust bar
  | {
      type: "imageText";
      imageUrl: string; // sanitized
      heading: string;
      text: string;
      ctaLabel: string;
      ctaHref: string; // sanitized, or ""
      flip: boolean; // image on the right instead of the left
    };

// ── Theme model v2 (Premium Theme System) ────────────────────────────────────
//
// A theme is a set of design TOKENS (colors, fonts, radius, animated background,
// motion personality). Pages store a base preset + optional per-token overrides,
// resolved at render by resolveTheme(). Backward-compatible: a legacy stored theme
// ({preset, accent}) still resolves — the old 8 preset keys are kept, and a legacy
// `accent` folds into the resolved accent. Everything is validated (hex colors,
// allow-listed fonts, numeric radius) — never arbitrary CSS.

/** Animated background personality (rendered by the motion layer in Phase 1). */
export type ThemeBackground =
  | "plain" | "mesh" | "aurora" | "stars" | "grid" | "scan" | "floats" | "stripes" | "blob";

/** The full resolved token set for a theme. `bg` may be a color or a CSS gradient. */
export interface ThemeTokens {
  label: string;
  mode: "light" | "dark";
  bg: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  primary2: string; // gradient end (CTA = linear-gradient(135deg, primary, primary2))
  accent: string;
  border: string;
  radius: number; // px
  fontHeading: string; // an allow-listed Google font family
  fontBody: string;
  shadow: string;
  background: ThemeBackground;
  glass: boolean; // frosted-glass surfaces
  ctaShimmer: string; // shimmer stripe color (white on colored, tinted on light)
}

const WHITE_SHIMMER = "rgba(255,255,255,.55)";

// All theme presets keyed by slug. The first 8 are LEGACY keys (kept so existing
// stored pages resolve); the 24 below them are the premium library (THEME_LIBRARY).
export const THEME_PRESETS: Record<string, ThemeTokens> = {
  // ── Legacy (pre-v2) — upgraded to full tokens, kept for stored pages ─────────
  light: { label: "Clean light", mode: "light", bg: "#ffffff", surface: "#ffffff", text: "#171717", muted: "#525252", primary: "#7C3AED", primary2: "#7C3AED", accent: "#7C3AED", border: "#e5e5e5", radius: 16, fontHeading: "Inter", fontBody: "Inter", shadow: "0 12px 30px rgba(0,0,0,.08)", background: "plain", glass: false, ctaShimmer: WHITE_SHIMMER },
  midnight: { label: "Midnight", mode: "dark", bg: "#050816", surface: "#0F172A", text: "#F8FAFC", muted: "#94A3B8", primary: "#06B6D4", primary2: "#3B82F6", accent: "#06B6D4", border: "#1E293B", radius: 16, fontHeading: "Inter", fontBody: "Inter", shadow: "0 0 40px rgba(6,182,212,.18)", background: "grid", glass: false, ctaShimmer: WHITE_SHIMMER },
  aurora: { label: "Aurora", mode: "dark", bg: "linear-gradient(135deg,#1E1B4B,#312E81 45%,#0F172A)", surface: "#1E1B4B", text: "#F8FAFC", muted: "#C4B5FD", primary: "#A855F7", primary2: "#EC4899", accent: "#A855F7", border: "#312E81", radius: 18, fontHeading: "Sora", fontBody: "Inter", shadow: "0 20px 50px rgba(168,85,247,.18)", background: "mesh", glass: false, ctaShimmer: WHITE_SHIMMER },
  sand: { label: "Warm sand", mode: "light", bg: "#F4F1EA", surface: "#ffffff", text: "#292524", muted: "#78716C", primary: "#C2682E", primary2: "#E0A458", accent: "#C2682E", border: "#E7E2D6", radius: 16, fontHeading: "Fraunces", fontBody: "Inter", shadow: "0 12px 30px rgba(194,104,46,.12)", background: "plain", glass: false, ctaShimmer: WHITE_SHIMMER },
  blossom: { label: "Blossom", mode: "light", bg: "#FFF1F5", surface: "#ffffff", text: "#500724", muted: "#9D174D", primary: "#EC4899", primary2: "#F472B6", accent: "#EC4899", border: "#FBCFE8", radius: 20, fontHeading: "Poppins", fontBody: "Inter", shadow: "0 14px 34px rgba(236,72,153,.12)", background: "floats", glass: false, ctaShimmer: WHITE_SHIMMER },
  noir: { label: "Noir", mode: "dark", bg: "#0A0A0A", surface: "#141414", text: "#FAFAFA", muted: "#A1A1AA", primary: "#F5C518", primary2: "#B8860B", accent: "#F5C518", border: "#262626", radius: 10, fontHeading: "Inter Tight", fontBody: "Inter", shadow: "0 18px 50px rgba(0,0,0,.6)", background: "plain", glass: false, ctaShimmer: "rgba(245,197,24,.6)" },
  ocean: { label: "Ocean", mode: "dark", bg: "linear-gradient(135deg,#0C4A6E,#075985 45%,#0C4A6E)", surface: "#075985", text: "#F0F9FF", muted: "#BAE6FD", primary: "#38BDF8", primary2: "#06B6D4", accent: "#38BDF8", border: "#0E7490", radius: 16, fontHeading: "Space Grotesk", fontBody: "Inter", shadow: "0 0 40px rgba(56,189,248,.18)", background: "grid", glass: false, ctaShimmer: WHITE_SHIMMER },
  forest: { label: "Forest", mode: "dark", bg: "linear-gradient(135deg,#052E16,#064E3B 45%,#022C22)", surface: "#064E3B", text: "#ECFDF5", muted: "#A7F3D0", primary: "#34D399", primary2: "#10B981", accent: "#34D399", border: "#065F46", radius: 16, fontHeading: "Fraunces", fontBody: "Inter", shadow: "0 16px 40px rgba(52,211,153,.14)", background: "blob", glass: false, ctaShimmer: WHITE_SHIMMER },

  // ── Premium library (24) ─────────────────────────────────────────────────────
  "aurora-glow": { label: "Aurora Glow", mode: "light", bg: "#FAF8FF", surface: "#ffffff", text: "#1A1430", muted: "#6B6580", primary: "#7C3AED", primary2: "#EC4899", accent: "#06B6D4", border: "rgba(124,58,237,.14)", radius: 20, fontHeading: "Sora", fontBody: "Inter", shadow: "0 20px 50px rgba(124,58,237,.15)", background: "mesh", glass: true, ctaShimmer: WHITE_SHIMMER },
  "pure-snow": { label: "Pure Snow", mode: "light", bg: "#FFFFFF", surface: "#ffffff", text: "#0A0A0A", muted: "#717171", primary: "#111111", primary2: "#333333", accent: "#0A84FF", border: "#ECECEC", radius: 12, fontHeading: "Inter Tight", fontBody: "Inter", shadow: "0 1px 2px rgba(0,0,0,.06)", background: "plain", glass: false, ctaShimmer: "rgba(255,255,255,.5)" },
  "cloud-mint": { label: "Cloud Mint", mode: "light", bg: "#F2FBF8", surface: "#ffffff", text: "#06302A", muted: "#5B7B72", primary: "#10B981", primary2: "#06B6D4", accent: "#34D399", border: "#D6F0E8", radius: 18, fontHeading: "Poppins", fontBody: "Inter", shadow: "0 12px 30px rgba(16,185,129,.12)", background: "floats", glass: false, ctaShimmer: WHITE_SHIMMER },
  "peach-sorbet": { label: "Peach Sorbet", mode: "light", bg: "#FFF6F1", surface: "#ffffff", text: "#3D2420", muted: "#8A6D66", primary: "#FB7185", primary2: "#FB923C", accent: "#F472B6", border: "#FAE0D6", radius: 22, fontHeading: "Quicksand", fontBody: "Nunito Sans", shadow: "0 14px 34px rgba(251,113,133,.14)", background: "floats", glass: false, ctaShimmer: "rgba(255,255,255,.6)" },
  "lavender-mist": { label: "Lavender Mist", mode: "light", bg: "#F8F6FF", surface: "#ffffff", text: "#2A2440", muted: "#6F6A85", primary: "#8B5CF6", primary2: "#A78BFA", accent: "#C4B5FD", border: "#ECE6FB", radius: 20, fontHeading: "Plus Jakarta Sans", fontBody: "Inter", shadow: "0 16px 40px rgba(139,92,246,.12)", background: "mesh", glass: true, ctaShimmer: WHITE_SHIMMER },
  "midnight-pro": { label: "Midnight Pro", mode: "dark", bg: "#0B1020", surface: "#141A2E", text: "#EAF0FF", muted: "#93A0C0", primary: "#3B82F6", primary2: "#6366F1", accent: "#22D3EE", border: "rgba(255,255,255,.08)", radius: 16, fontHeading: "Space Grotesk", fontBody: "Inter", shadow: "0 0 40px rgba(59,130,246,.25)", background: "grid", glass: false, ctaShimmer: "rgba(255,255,255,.5)" },
  "obsidian-gold": { label: "Obsidian Gold", mode: "dark", bg: "#0A0A0A", surface: "#141414", text: "#F5F1E6", muted: "#A39B86", primary: "#D4AF37", primary2: "#B8860B", accent: "#F5D76E", border: "rgba(212,175,55,.20)", radius: 8, fontHeading: "Cormorant Garamond", fontBody: "Inter", shadow: "0 18px 50px rgba(0,0,0,.6)", background: "stars", glass: false, ctaShimmer: "rgba(245,215,110,.7)" },
  "cyber-neon": { label: "Cyber Neon", mode: "dark", bg: "#08070F", surface: "#12101F", text: "#F0EEFF", muted: "#8A86A6", primary: "#FF2E97", primary2: "#00E5FF", accent: "#B026FF", border: "rgba(255,46,151,.25)", radius: 6, fontHeading: "Chakra Petch", fontBody: "Rajdhani", shadow: "0 0 30px rgba(255,46,151,.4)", background: "scan", glass: false, ctaShimmer: "rgba(255,255,255,.8)" },
  "carbon-slate": { label: "Carbon Slate", mode: "dark", bg: "#15171A", surface: "#1E2125", text: "#E7E9EC", muted: "#9AA1AC", primary: "#334155", primary2: "#475569", accent: "#60A5FA", border: "rgba(255,255,255,.07)", radius: 10, fontHeading: "Inter Tight", fontBody: "Inter", shadow: "0 10px 30px rgba(0,0,0,.4)", background: "grid", glass: false, ctaShimmer: "rgba(255,255,255,.4)" },
  "galaxy-deep": { label: "Galaxy Deep", mode: "dark", bg: "#0B0820", surface: "#161235", text: "#EDE9FF", muted: "#9389C0", primary: "#A855F7", primary2: "#EC4899", accent: "#F472B6", border: "rgba(168,85,247,.20)", radius: 18, fontHeading: "Sora", fontBody: "Inter", shadow: "0 20px 50px rgba(168,85,247,.20)", background: "stars", glass: false, ctaShimmer: WHITE_SHIMMER },
  "sunset-blaze": { label: "Sunset Blaze", mode: "light", bg: "#FFF8F3", surface: "#ffffff", text: "#2B1A12", muted: "#8A6F5F", primary: "#F97316", primary2: "#EF4444", accent: "#EC4899", border: "#FBE3D2", radius: 18, fontHeading: "Outfit", fontBody: "Inter", shadow: "0 14px 34px rgba(249,115,22,.14)", background: "aurora", glass: false, ctaShimmer: WHITE_SHIMMER },
  "electric-pop": { label: "Electric Pop", mode: "light", bg: "#FFFFFF", surface: "#ffffff", text: "#111111", muted: "#6B7280", primary: "#6D28D9", primary2: "#F59E0B", accent: "#10B981", border: "#EEEEEE", radius: 24, fontHeading: "Fredoka", fontBody: "Nunito", shadow: "0 12px 0 rgba(0,0,0,.06)", background: "floats", glass: false, ctaShimmer: "rgba(255,255,255,.6)" },
  "tropical-punch": { label: "Tropical Punch", mode: "light", bg: "#F1FDF6", surface: "#ffffff", text: "#0B3B2C", muted: "#5B7B6E", primary: "#059669", primary2: "#F97316", accent: "#EC4899", border: "#D6F0E2", radius: 22, fontHeading: "Baloo 2", fontBody: "Nunito Sans", shadow: "0 14px 34px rgba(5,150,105,.14)", background: "aurora", glass: false, ctaShimmer: "rgba(255,255,255,.6)" },
  "citrus-burst": { label: "Citrus Burst", mode: "light", bg: "#FEFEF0", surface: "#ffffff", text: "#2A2A12", muted: "#7A7A55", primary: "#CA8A04", primary2: "#84CC16", accent: "#F59E0B", border: "#EEEAC8", radius: 16, fontHeading: "Space Grotesk", fontBody: "Inter", shadow: "0 12px 30px rgba(202,138,4,.14)", background: "stripes", glass: false, ctaShimmer: "rgba(255,255,255,.5)" },
  "ivory-editorial": { label: "Ivory Editorial", mode: "light", bg: "#FBFAF6", surface: "#ffffff", text: "#1A1A1A", muted: "#6B675E", primary: "#1A1A1A", primary2: "#3A3A3A", accent: "#9A3B3B", border: "#E8E4DA", radius: 4, fontHeading: "Playfair Display", fontBody: "Source Serif 4", shadow: "0 8px 24px rgba(0,0,0,.05)", background: "plain", glass: false, ctaShimmer: "rgba(255,255,255,.45)" },
  "noir-luxe": { label: "Noir Luxe", mode: "light", bg: "#FFFFFF", surface: "#ffffff", text: "#000000", muted: "#555555", primary: "#000000", primary2: "#000000", accent: "#000000", border: "#000000", radius: 0, fontHeading: "Bodoni Moda", fontBody: "Inter", shadow: "0 0 0 rgba(0,0,0,0)", background: "plain", glass: false, ctaShimmer: "rgba(255,255,255,.6)" },
  "royal-velvet": { label: "Royal Velvet", mode: "dark", bg: "#1A0B1F", surface: "#2A1233", text: "#F3E9F7", muted: "#B79DC2", primary: "#C9A227", primary2: "#7E22CE", accent: "#E0C879", border: "rgba(201,162,39,.20)", radius: 10, fontHeading: "Cormorant Garamond", fontBody: "Inter", shadow: "0 18px 50px rgba(0,0,0,.5)", background: "stars", glass: false, ctaShimmer: "rgba(224,200,121,.7)" },
  "sage-studio": { label: "Sage Studio", mode: "light", bg: "#F4F6F1", surface: "#ffffff", text: "#2B3328", muted: "#6F7A66", primary: "#5B7553", primary2: "#8AA579", accent: "#C2703D", border: "#E2E8DC", radius: 14, fontHeading: "Fraunces", fontBody: "Inter", shadow: "0 12px 30px rgba(91,117,83,.12)", background: "blob", glass: false, ctaShimmer: "rgba(255,255,255,.5)" },
  "indigo-saas": { label: "Indigo SaaS", mode: "light", bg: "#FAFAFF", surface: "#ffffff", text: "#1E1B2E", muted: "#6B6A80", primary: "#4F46E5", primary2: "#6366F1", accent: "#06B6D4", border: "#ECECF5", radius: 14, fontHeading: "Inter Tight", fontBody: "Inter", shadow: "0 12px 30px rgba(79,70,229,.12)", background: "grid", glass: false, ctaShimmer: WHITE_SHIMMER },
  "gradient-mesh": { label: "Gradient Mesh", mode: "light", bg: "#FDF4FF", surface: "#ffffff", text: "#1A1430", muted: "#6B6580", primary: "#8B5CF6", primary2: "#EC4899", accent: "#3B82F6", border: "rgba(0,0,0,.06)", radius: 24, fontHeading: "Sora", fontBody: "Inter", shadow: "0 20px 50px rgba(139,92,246,.14)", background: "mesh", glass: true, ctaShimmer: "rgba(255,255,255,.6)" },
  "glass-frost": { label: "Glass Frost", mode: "light", bg: "#EEF2FF", surface: "#ffffff", text: "#0F172A", muted: "#64748B", primary: "#3B82F6", primary2: "#8B5CF6", accent: "#06B6D4", border: "rgba(255,255,255,.4)", radius: 22, fontHeading: "Plus Jakarta Sans", fontBody: "Inter", shadow: "0 20px 50px rgba(59,130,246,.14)", background: "mesh", glass: true, ctaShimmer: "rgba(255,255,255,.7)" },
  "brutalist-bold": { label: "Brutalist Bold", mode: "light", bg: "#FFFEF2", surface: "#ffffff", text: "#000000", muted: "#444444", primary: "#FF4D00", primary2: "#FF4D00", accent: "#2563EB", border: "#000000", radius: 0, fontHeading: "Archivo Black", fontBody: "Space Grotesk", shadow: "4px 4px 0 #000", background: "stripes", glass: false, ctaShimmer: "rgba(255,255,255,.5)" },
  "cozy-cream": { label: "Cozy Cream", mode: "light", bg: "#FBF6EF", surface: "#ffffff", text: "#3A2E22", muted: "#8A7B6A", primary: "#C2783F", primary2: "#E0A458", accent: "#7C9885", border: "#EFE5D6", radius: 20, fontHeading: "Nunito", fontBody: "Nunito Sans", shadow: "0 14px 34px rgba(194,120,63,.12)", background: "floats", glass: false, ctaShimmer: WHITE_SHIMMER },
  "terracotta-earth": { label: "Terracotta Earth", mode: "light", bg: "#FCF3EC", surface: "#ffffff", text: "#3A241B", muted: "#8A6A58", primary: "#B65D3C", primary2: "#D98A5F", accent: "#4A6C5D", border: "#F0DDCF", radius: 16, fontHeading: "Fraunces", fontBody: "Inter", shadow: "0 14px 34px rgba(182,93,60,.12)", background: "blob", glass: false, ctaShimmer: "rgba(255,255,255,.5)" },
};

/** The premium library, in display order — what the editor's theme picker shows. */
export const THEME_LIBRARY = [
  "aurora-glow", "pure-snow", "cloud-mint", "peach-sorbet", "lavender-mist",
  "midnight-pro", "obsidian-gold", "cyber-neon", "carbon-slate", "galaxy-deep",
  "sunset-blaze", "electric-pop", "tropical-punch", "citrus-burst",
  "ivory-editorial", "noir-luxe", "royal-velvet", "sage-studio",
  "indigo-saas", "gradient-mesh", "glass-frost", "brutalist-bold",
  "cozy-cream", "terracotta-earth",
] as const;

/** Fonts a theme may use — allow-listed so a stored font can't inject arbitrary CSS. */
export const THEME_FONTS = [
  "Inter", "Inter Tight", "Sora", "Poppins", "Quicksand", "Nunito Sans",
  "Plus Jakarta Sans", "Space Grotesk", "Cormorant Garamond", "Chakra Petch",
  "Rajdhani", "Outfit", "Fredoka", "Nunito", "Baloo 2", "Playfair Display",
  "Source Serif 4", "Bodoni Moda", "Fraunces", "Archivo Black", "Space Mono",
] as const;

/** A theme preset slug (legacy or premium). Loose `string` so stored values are
 *  forgiving; resolveTheme falls back to a default for an unknown slug. */
export type ThemePreset = string;

/** Per-page token overrides — any null/absent token falls back to the base preset. */
export interface ThemeOverrides {
  primary?: string;
  primary2?: string;
  accent?: string;
  bg?: string;
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  radius?: number;
  fontHeading?: string;
  fontBody?: string;
  background?: ThemeBackground;
}

export interface Theme {
  /** The base preset slug. */
  preset: ThemePreset;
  /** Legacy single-accent override (pre-v2). Folded into the resolved accent. */
  accent: string;
  /** v2 per-token overrides. */
  overrides?: ThemeOverrides;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_PRESET = "aurora-glow";
const BG_TYPES: ThemeBackground[] = ["plain", "mesh", "aurora", "stars", "grid", "scan", "floats", "stripes", "blob"];

function hexOrNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return HEX_RE.test(s) ? s : null;
}
function fontOrNull(v: unknown): string | null {
  return typeof v === "string" && (THEME_FONTS as readonly string[]).includes(v) ? v : null;
}
function radiusOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 48 ? Math.round(v) : null;
}

/** Validate stored overrides into a safe ThemeOverrides (drops anything invalid). */
function normalizeOverrides(v: unknown): ThemeOverrides {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: ThemeOverrides = {};
  for (const k of ["primary", "primary2", "accent", "surface", "text", "muted"] as const) {
    const hex = hexOrNull(o[k]);
    if (hex) out[k] = hex;
  }
  // bg + border may be a hex OR (bg) a gradient string — keep them capped + simple.
  const bg = typeof o.bg === "string" ? o.bg.trim().slice(0, 200) : "";
  if (bg && (HEX_RE.test(bg) || /^linear-gradient\([^;{}]+\)$/.test(bg))) out.bg = bg;
  const border = hexOrNull(o.border);
  if (border) out.border = border;
  const r = radiusOrNull(o.radius);
  if (r != null) out.radius = r;
  const fh = fontOrNull(o.fontHeading);
  if (fh) out.fontHeading = fh;
  const fb = fontOrNull(o.fontBody);
  if (fb) out.fontBody = fb;
  if (typeof o.background === "string" && BG_TYPES.includes(o.background as ThemeBackground)) {
    out.background = o.background as ThemeBackground;
  }
  return out;
}

/**
 * Validate a stored theme into a safe {preset, accent, overrides}. Accepts the v2
 * shape ({preset|base, overrides}) and the legacy shape ({preset, accent}); an
 * unknown preset falls back to the default. The legacy `accent` is preserved.
 */
export function normalizeTheme(content: unknown): Theme {
  const t = (content && typeof content === "object" ? (content as Record<string, unknown>).theme : null) as
    | Record<string, unknown>
    | null
    | undefined;
  const rawPreset = (typeof t?.preset === "string" ? t.preset : typeof t?.base === "string" ? t.base : "") as string;
  const preset = rawPreset in THEME_PRESETS ? rawPreset : DEFAULT_PRESET;
  const rawAccent = typeof t?.accent === "string" ? t.accent.trim() : "";
  const accent = HEX_RE.test(rawAccent) ? rawAccent : THEME_PRESETS[preset]!.accent;
  return { preset, accent, overrides: normalizeOverrides(t?.overrides) };
}

/**
 * Resolve a stored theme into final render tokens: the base preset, with validated
 * per-token overrides applied (and the legacy single `accent` folded in). This is
 * the single source of truth the renderer + editor use to paint a page.
 */
export function resolveTheme(theme: Theme): ThemeTokens {
  const base = THEME_PRESETS[theme.preset] ?? THEME_PRESETS[DEFAULT_PRESET]!;
  const o = theme.overrides ?? {};
  // Legacy accent: if a page only stored {preset, accent} and accent differs from
  // the base, honor it as the accent override (back-compat with pre-v2 pages).
  const legacyAccent = HEX_RE.test(theme.accent) && theme.accent !== base.accent ? theme.accent : null;
  return {
    ...base,
    primary: o.primary ?? base.primary,
    primary2: o.primary2 ?? base.primary2,
    accent: o.accent ?? legacyAccent ?? base.accent,
    bg: o.bg ?? base.bg,
    surface: o.surface ?? base.surface,
    text: o.text ?? base.text,
    muted: o.muted ?? base.muted,
    border: o.border ?? base.border,
    radius: o.radius ?? base.radius,
    fontHeading: o.fontHeading ?? base.fontHeading,
    fontBody: o.fontBody ?? base.fontBody,
    background: o.background ?? base.background,
  };
}

/** The CSS `linear-gradient` for a theme's primary CTA. */
export function ctaGradient(t: ThemeTokens): string {
  return `linear-gradient(135deg, ${t.primary}, ${t.primary2})`;
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

function bool(v: unknown): boolean {
  return v === true;
}

/** Validate an untrusted array of strings into a capped, trimmed, non-empty list. */
function strList(v: unknown, max: number, itemMax = 200): string[] {
  const raw = Array.isArray(v) ? v : [];
  return raw
    .map((it) => str(it, itemMax).trim())
    .filter((it) => it.length > 0)
    .slice(0, max);
}

/** Validate an untrusted array of {url,alt} into sanitized images (drops any whose
 *  url fails safeUrl), capped. Shared by gallery + logoStrip. */
function imageList(v: unknown, max: number): { url: string; alt: string }[] {
  const raw = Array.isArray(v) ? v : [];
  return raw
    .map((it) => {
      const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
      const url = safeUrl(o.url);
      return url ? { url, alt: str(o.alt, 300).trim() } : null;
    })
    .filter((x): x is { url: string; alt: string } => x !== null)
    .slice(0, max);
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
    case "columns": {
      const raw = Array.isArray(b.cells) ? b.cells : [];
      const cells = raw
        .map((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const title = str(o.title, 120).trim();
          const text = str(o.text, 1000).trim();
          return title || text ? { title, text } : null;
        })
        .filter((x): x is { title: string; text: string } => x !== null)
        .slice(0, 4);
      return cells.length > 0 ? { type: "columns", cells } : null;
    }
    case "socialProof":
      return { type: "socialProof" };
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
    case "hero": {
      const heading = str(b.heading, 200).trim();
      if (!heading) return null; // a hero with no headline is meaningless
      return {
        type: "hero",
        heading,
        subheading: str(b.subheading, 500).trim(),
        ctaLabel: str(b.ctaLabel, 120).trim(),
        ctaHref: safeUrl(b.ctaHref),
        imageUrl: safeUrl(b.imageUrl),
      };
    }
    case "pricingTable": {
      const raw = Array.isArray(b.plans) ? b.plans : [];
      const plans = raw
        .map((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const name = str(o.name, 80).trim();
          const price = str(o.price, 40).trim();
          if (!name || !price) return null; // a column needs a name + a price
          return {
            name,
            price,
            period: str(o.period, 40).trim(),
            features: strList(o.features, 12),
            ctaLabel: str(o.ctaLabel, 80).trim(),
            ctaHref: safeUrl(o.ctaHref),
            highlighted: bool(o.highlighted),
          };
        })
        .filter(
          (x): x is NonNullable<typeof x> => x !== null,
        )
        .slice(0, 4);
      return plans.length > 0 ? { type: "pricingTable", plans } : null;
    }
    case "featureGrid": {
      const raw = Array.isArray(b.items) ? b.items : [];
      const items = raw
        .map((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const title = str(o.title, 120).trim();
          const text = str(o.text, 500).trim();
          // icon is short plain text (emoji or 1–2 words), rendered as text only.
          const icon = str(o.icon, 24).trim();
          return title || text ? { icon, title, text } : null;
        })
        .filter((x): x is { icon: string; title: string; text: string } => x !== null)
        .slice(0, 6);
      return items.length > 0 ? { type: "featureGrid", items } : null;
    }
    case "stats": {
      const raw = Array.isArray(b.items) ? b.items : [];
      const items = raw
        .map((it) => {
          const o = (it && typeof it === "object" ? it : {}) as Record<string, unknown>;
          const value = str(o.value, 40).trim();
          const label = str(o.label, 120).trim();
          return value ? { value, label } : null;
        })
        .filter((x): x is { value: string; label: string } => x !== null)
        .slice(0, 4);
      return items.length > 0 ? { type: "stats", items } : null;
    }
    case "gallery": {
      const images = imageList(b.images, 12);
      return images.length > 0 ? { type: "gallery", images } : null;
    }
    case "logoStrip": {
      const logos = imageList(b.logos, 12);
      return logos.length > 0 ? { type: "logoStrip", logos } : null;
    }
    case "imageText": {
      const imageUrl = safeUrl(b.imageUrl);
      const heading = str(b.heading, 200).trim();
      const text = str(b.text, 2000).trim();
      // Needs at least an image or some copy to be worth rendering.
      if (!imageUrl && !heading && !text) return null;
      return {
        type: "imageText",
        imageUrl,
        heading,
        text,
        ctaLabel: str(b.ctaLabel, 120).trim(),
        ctaHref: safeUrl(b.ctaHref),
        flip: bool(b.flip),
      };
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

/** Optional per-page SEO overrides. Empty strings mean "fall back to derived
 *  defaults" (title / first text block / first image). ogImage is URL-sanitized. */
export interface BuilderSeo {
  metaTitle: string;
  description: string;
  ogImage: string;
}

/** Validate stored SEO fields. metaTitle/description are capped plain text;
 *  ogImage runs through safeUrl so only http(s)/site-relative URLs survive. */
export function normalizeSeo(content: unknown): BuilderSeo {
  const c = (content && typeof content === "object" ? content : {}) as Record<string, unknown>;
  const s = (c.seo && typeof c.seo === "object" ? c.seo : {}) as Record<string, unknown>;
  return {
    metaTitle: str(s.metaTitle, 200).trim(),
    description: str(s.description, 300).trim(),
    ogImage: safeUrl(s.ogImage),
  };
}

export interface BuilderContent {
  title: string;
  blocks: Block[];
  theme: Theme;
  seo?: BuilderSeo;
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
  return { title, blocks: blocks.slice(0, MAX_BLOCKS), theme: normalizeTheme(content), seo: normalizeSeo(content) };
}
