# InvoxAI — Premium Theme & Page-Builder System — Implementation Plan

Plan for the "24 themes × 12 page types × 100%-editable JSON builder + motion + ad
tracking" spec. Written 2026-06-15 against the current codebase.

## TL;DR
~40% of the foundation already exists (block builder, 8 themes, editor, renderer,
4 ad pixels, UTM capture, multi-page sites, templates marketplace). The plan below
EXTENDS that rather than rebuilding — phased so each phase ships independently,
nothing additive blocks the money path, and the highest-visual-value work lands first.

## Current state (reuse, don't rebuild)
- **Blocks** (`packages/utils/src/blocks.ts`): ~25 types. The validation/sanitization
  trust boundary already exists (`normalizeToBlocks`, `safeUrl`, `toEmbedUrl`).
- **Themes**: 8 presets, tokens `{bg,text,muted,accent,border}` + per-page accent.
- **Editor** (`apps/app/app/ai-pages/[id]/edit/PageEditor.tsx`): add/edit/reorder/
  delete blocks, live preview, theme + accent pickers, SEO, mobile/desktop toggle.
- **Renderer** (`apps/tenant/app/[slug]/page.tsx`): server-side, sanitized, multi-page nav.
- **Tracking**: Meta Pixel, GA4, Google Ads, GTM injected; `firePurchase`/
  `fireInitiateCheckout`/`TrackView`; UTM cookie capture. Purchase already fires
  server-side via the gateway webhook (`markBuyerPaymentPaid`).
- **Native commerce routes** (NOT builder-driven): `/store`, `/p`, `/c`, `/pay`,
  `/m`, `/b`, `/w`, `/account`, checkout — these own the money path.

## ⚠️ The key architectural decision (drives everything)
The spec lists `checkout / store / course / community / payment` as builder page
"types". But those already exist as **hardened, money-handling React routes**.
Rebuilding them as JSON-builder pages = a high-risk rewrite of the payment path.

**Recommended approach — "augment, don't replace":**
- The **JSON builder owns the marketing page types**: Ad-Landing, Landing, Lead,
  Bio, Website, Thank-You (and the generic AI page). These are where the editable
  builder adds the most value and carry no money logic.
- The **native commerce routes stay** (store/product/course/community/pay/checkout)
  and instead **adopt the new theme + motion + mobile-CTA layer** so they look
  identical in style — the seller picks a theme once and it paints everything.
- A builder block (`paymentButton`, `product`, `course`, `storeGrid`) is how a
  marketing page links INTO the native commerce flow. (Already built.)

This gives the full premium look across all pages without putting the JSON builder
in the money path. (Alternative — make the builder render checkout too — is a much
larger, riskier program; not recommended for v1.)

---

## Phase 0 — Theme model v2 + motion primitives (FOUNDATION)
Highest leverage; everything else builds on it. Backward-compatible.
- Extend `Theme` tokens: add `primary, primary2, surface, radius, fontHeading,
  fontBody, ctaShimmer, shadow, background(type)`. Keep `bg/text/muted/accent/
  border`. Old pages (8 presets, accent-only) keep working — map them forward.
- Add the **24 theme presets** as data in `THEME_PRESETS` (names/tokens/fonts/radius/
  bg per the spec). `normalizeTheme` validates `base` + per-token `overrides`.
- **Per-page theme overrides**: extend the stored theme to `{base, overrides:{...}}`
  (any token nullable). `safeColor`/`safeRadius` validators (no arbitrary CSS).
- Shared **motion/CSS primitives** (one small client module + CSS, token-driven):
  sticky mobile CTA bar with dual-price + shimmer; `.reveal` scroll choreography;
  animated backgrounds (mesh/aurora/stars/grid/scan/floats/stripes/blob/grain);
  `prefers-reduced-motion` fallbacks; one-bg-animation-on-mobile rule.
- Per-theme **Google Font loading** (preconnect + font link from the active theme).
- "**Built with InvoxAI**" badge component (toggleable per page).
Deliverable: tokens + 24 themes + motion CSS, unit-tested validators. No visual
regression on existing pages (old themes map to new token shape).

## Phase 1 — Apply theme + motion to existing pages (LOW RISK, HIGH VISUAL WIN)
No money-path change — purely presentational.
- AI-page renderer consumes the v2 tokens (primary gradient CTAs, radius, fonts,
  animated background, scroll-reveal).
- Native commerce pages (`/store /p /c /pay /m /b /w`) read the tenant's chosen
  theme tokens and adopt: mobile sticky **dual-price** CTA + shimmer, theme fonts/
  radius/colors, animated background, scroll-reveal. (Builds on the premium card
  polish already shipped.)
- Tenant-level "store theme" setting (which of 24 + overrides) persisted, so the
  whole storefront is consistently themed.
Deliverable: every public page visibly premium + animated, mobile dual-price bar
everywhere a price exists.

## Phase 2 — Builder v2 (editor + JSON model, incremental on PageEditor)
- **Sections** wrapper in the page JSON (group blocks; `padding/bg/maxWidth`).
  Migrate existing flat block lists → a single default section (back-compat).
- **Button as a first-class object**: `{text, action{type,target}, style{variant,
  size,fullWidth,icon,shimmer,colorOverride}, mobileSticky}`. Actions: link/scroll/
  buy/checkout/submit/whatsapp/call/email. Extend the existing `button` block +
  validator; keep old `{label,href}` working (migrate to `link`).
- **New blocks**: priceTag (retail strike + offer + %off), limitedTag (pulse),
  tiers (selectable), marquee, bento (featureGrid variant). (stats/countdown/faq/
  testimonial already exist.)
- **Editor**: token-override controls (color pickers, font dropdown, radius slider,
  background picker, grain toggle), button inspector, section controls, per-block
  animation picker. (Drag-reorder, undo/redo, version history = Phase 6 if needed.)
Deliverable: sellers compose richer pages and override any token per page.

## Phase 3 — Typed marketing templates (starter block sets)
Starter `sections` arrays for: Ad-Landing, Landing, Lead, Bio, Website, Thank-You.
Each is just a default the seller then edits. (Checkout/Store/Course/Community/
Payment stay native per the decision above.) The existing AI generator can target
these structures.
Deliverable: "pick a page type → get an editable premium starter."

## Phase 4 — Tracking upgrade
- Schema: add `tiktokPixelId` (+ consent fields) to `TenantTracking`.
- Inject **TikTok pixel**; extend the shared `track()` helper to TikTok.
- Capture `fbclid/gclid/ttclid` (query + hash) into a first-party cookie; attach to
  the order at checkout (alongside the existing UTM capture).
- **Consent Mode v2** default-denied + banner; gate non-essential pixels.
- **Server-side dedup**: emit a shared `event_id` on the browser Purchase + the
  webhook Purchase (Meta CAPI / Google enhanced conversions) so sales aren't lost
  to ad-blockers/iOS. (Builds on the existing server-side purchase fire.)
Deliverable: ad-campaign-grade attribution like the reference FB-ad landers.

## Phase 5 — Themed email templates
- A themed, table-based, email-safe layout (gradient→solid fallback) driven by the
  same tokens, for the existing Broadcasts + Sequences + receipts. Variants:
  purchase confirmation, welcome, abandoned-cart, expiry, newsletter.
Deliverable: on-brand emails across the 24 themes.

## Phase 6 (optional) — Full editor polish
Drag-reorder across sections (dnd-kit), inspector redesign, undo/redo, version
history. Only if the Phase-2 editor proves too limited.

---

## Sequencing & sizing (rough)
| Phase | Value | Risk | Size |
|---|---|---|---|
| 0 Theme v2 + motion | foundational | low (additive, back-compat) | M |
| 1 Apply to pages | very high visual | low (no money path) | M |
| 2 Builder v2 | high | medium (editor surface) | L |
| 3 Typed templates | medium | low | S–M |
| 4 Tracking upgrade | high (ad ROI) | low–med (CAPI server work) | M |
| 5 Themed email | medium | low | S |
| 6 Editor polish | polish | medium | L |

Recommended order: **0 → 1 → 4 → 2 → 3 → 5 → 6** (get the premium look + ad
tracking live fastest, then deepen the editor).

## Guardrails (carry from existing build)
- All block/theme/token input stays behind the `normalizeToBlocks` trust boundary —
  no arbitrary CSS/HTML; colors validated to hex, URLs to safeUrl, fonts to an
  allow-list. `custom/html` block from the spec is **declined** (breaks the no-raw-
  HTML boundary) unless sandboxed in an iframe — defer.
- Backward compatibility every phase: existing published pages must keep rendering.
- Money path untouched (the builder links into it; it doesn't reimplement it).
- Mobile-first, `prefers-reduced-motion`, ≥44px targets, one bg animation on mobile.
