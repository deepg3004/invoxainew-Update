import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getTenantTracking,
  getSiteNav,
  listPublishedProductsByIds,
  listPublishedProducts,
  getPublishedCoursesByIds,
  getActivePaymentPagesByIds,
  getPublishedLeadFormsByIds,
  listRecentSocialProof,
  type SocialProofEvent,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { cachedAiPage } from "../../lib/content";
import { normalizeToBlocks, resolveTheme, type Block, type ThemeTokens } from "@invoxai/utils/blocks";
import { resolveTenantByHost } from "../../lib/resolve";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";
import { ThemeStyle, AnimatedBg, BuiltWithBadge } from "../ThemeRuntime";
import { Reveal } from "../Reveal";
import { Countdown } from "./Countdown";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant || tenant.suspendedAt) return {};
  const { slug } = await params;
  const page = await cachedAiPage(tenant.id, slug);
  if (!page) return {};
  const content = normalizeToBlocks(page.content);
  const textBlock = content.blocks.find(
    (b): b is Extract<Block, { type: "text" }> => b.type === "text",
  );
  const imageBlock = content.blocks.find(
    (b): b is Extract<Block, { type: "image" }> => b.type === "image",
  );
  // Per-page SEO overrides (audit) win over derived defaults when set.
  const metaTitle = content.seo?.metaTitle || content.title;
  const description = content.seo?.description || textBlock?.text.slice(0, 200);
  const ogImage = content.seo?.ogImage || imageBlock?.url;
  const images = ogImage ? [ogImage] : undefined;
  return {
    title: metaTitle,
    description,
    openGraph: { title: metaTitle, description, images, type: "website" },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: metaTitle,
      description,
      images,
    },
  };
}

type Tokens = ThemeTokens;

// ── Entity-bound widgets (Builder Part 3) ────────────────────────────────────
// Resolve the ids stored in product/course/leadForm/paymentButton/storeGrid
// blocks into live card data — ALL queries are tenant-scoped + published-only, so
// a block referencing a foreign/draft/deleted id resolves to nothing.
type EntityCard = { id: string; slug: string; title: string; pricePaise: number; compareAtPaise: number | null; imageUrl: string | null };
type FormCard = { id: string; slug: string; title: string };
type GridProduct = { id: string; slug: string; title: string; pricePaise: number; compareAtPaise: number | null; imageUrl: string | null };
const ALL_PRODUCTS = "__all__";

interface Resolved {
  products: Map<string, EntityCard>;
  courses: Map<string, EntityCard>;
  pages: Map<string, EntityCard>;
  forms: Map<string, FormCard>;
  grids: Map<string, GridProduct[]>; // keyed by collectionId, or ALL_PRODUCTS for "all"
  socialProof: SocialProofEvent[];
}

async function resolveEntities(tenantId: string, blocks: Block[]): Promise<Resolved> {
  const productIds = new Set<string>();
  const courseIds = new Set<string>();
  const pageIds = new Set<string>();
  const formIds = new Set<string>();
  const gridKeys = new Set<string>();
  let needsSocialProof = false;
  for (const b of blocks) {
    if (b.type === "product") productIds.add(b.productId);
    else if (b.type === "course") courseIds.add(b.courseId);
    else if (b.type === "paymentButton") pageIds.add(b.pageId);
    else if (b.type === "leadForm") formIds.add(b.formId);
    else if (b.type === "storeGrid") gridKeys.add(b.collectionId ?? ALL_PRODUCTS);
    else if (b.type === "socialProof") needsSocialProof = true;
  }

  const [products, courses, pages, forms, gridEntries, socialProof] = await Promise.all([
    listPublishedProductsByIds(tenantId, [...productIds]),
    getPublishedCoursesByIds(tenantId, [...courseIds]),
    getActivePaymentPagesByIds(tenantId, [...pageIds]),
    getPublishedLeadFormsByIds(tenantId, [...formIds]),
    Promise.all(
      [...gridKeys].map(async (key) => {
        const rows = await listPublishedProducts(
          tenantId,
          key === ALL_PRODUCTS ? {} : { collectionId: key },
        );
        return [key, rows as GridProduct[]] as const;
      }),
    ),
    needsSocialProof ? listRecentSocialProof(tenantId) : Promise.resolve([]),
  ]);

  const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  // Payment pages store amountPaise; normalise to the shared pricePaise card shape.
  const pageCards: EntityCard[] = pages.map((p) => ({
    id: p.id, slug: p.slug, title: p.title, pricePaise: p.amountPaise, compareAtPaise: p.compareAtPaise, imageUrl: p.imageUrl,
  }));
  return {
    products: byId(products as EntityCard[]),
    courses: byId(courses as EntityCard[]),
    pages: byId(pageCards),
    forms: byId(forms as FormCard[]),
    grids: new Map(gridEntries),
    socialProof,
  };
}

// A themed catalog card linking to a public buy page (/p, /c). Shows image,
// title, price + optional struck compare-at.
function CatalogCard({ card, href, t }: { card: EntityCard; href: string; t: Tokens }) {
  const onSale = card.compareAtPaise != null && card.compareAtPaise > card.pricePaise;
  return (
    <Link
      href={href}
      className="mt-6 flex gap-4 rounded-xl p-4 no-underline transition hover:opacity-90"
      style={{ border: `1px solid ${t.border}` }}
    >
      {card.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.imageUrl} alt={card.title} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
      ) : null}
      <div className="min-w-0">
        <div className="font-semibold" style={{ color: t.text }}>{card.title}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-medium" style={{ color: t.accent }}>{formatRupees(card.pricePaise)}</span>
          {onSale ? (
            <span className="text-sm line-through" style={{ color: t.muted }}>{formatRupees(card.compareAtPaise!)}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

// Render one block as structured markup, styled by the page theme tokens.
// SECURITY: blocks are validated + sanitized by normalizeToBlocks (server-side),
// theme colours are validated to hex/preset tokens, and we never inject raw HTML
// — so a generated or edited page can't run scripts on the seller's site.
function BlockView({ block, t, resolved }: { block: Block; t: Tokens; resolved: Resolved }) {
  switch (block.type) {
    case "heading": {
      const cls =
        block.level === 1
          ? "text-4xl font-bold tracking-tight sm:text-5xl"
          : block.level === 2
            ? "mt-10 text-2xl font-semibold"
            : "mt-6 text-lg font-semibold";
      if (block.level === 1) return <h1 className={cls} style={{ color: t.text }}>{block.text}</h1>;
      if (block.level === 2) return <h2 className={cls} style={{ color: t.text }}>{block.text}</h2>;
      return <h3 className={cls} style={{ color: t.text }}>{block.text}</h3>;
    }
    case "text":
      return <p className="mt-3 whitespace-pre-line leading-relaxed" style={{ color: t.muted }}>{block.text}</p>;
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.url} alt={block.alt} className="mt-6 w-full rounded-xl object-cover" style={{ border: `1px solid ${t.border}` }} />;
    case "button":
      return (
        <div className="mt-6">
          <a href={block.href} className="iv-cta inline-block px-6 py-3 font-medium text-white no-underline">
            {block.label}
          </a>
        </div>
      );
    case "video":
      // src is restricted to youtube/vimeo embed URLs by normalizeToBlocks.
      return (
        <div className="mt-6 aspect-video w-full overflow-hidden rounded-xl" style={{ border: `1px solid ${t.border}` }}>
          <iframe
            src={block.url}
            className="h-full w-full"
            title="Embedded video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    case "divider":
      return <hr className="mt-10" style={{ borderColor: t.border }} />;
    case "list":
      return (
        <ul className="mt-4 space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2 leading-relaxed" style={{ color: t.muted }}>
              <span style={{ color: t.accent }}>•</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case "testimonial":
      return (
        <figure
          className="mt-8 rounded-xl p-6"
          style={{ background: `${t.accent}14`, border: `1px solid ${t.border}` }}
        >
          <blockquote className="text-lg italic leading-relaxed" style={{ color: t.text }}>
            “{block.quote}”
          </blockquote>
          {block.author ? (
            <figcaption className="mt-3 text-sm font-medium" style={{ color: t.muted }}>
              — {block.author}
            </figcaption>
          ) : null}
        </figure>
      );
    case "callout":
      return (
        <div
          className="mt-6 rounded-xl border-l-4 p-4"
          style={{ borderColor: t.accent, background: `${t.accent}0F`, color: t.text }}
        >
          <p className="whitespace-pre-line leading-relaxed">{block.text}</p>
        </div>
      );
    case "faq":
      return (
        <div className="mt-6 space-y-2">
          {block.items.map((it, i) => (
            <details key={i} className="rounded-xl p-4" style={{ border: `1px solid ${t.border}` }}>
              <summary className="cursor-pointer font-medium" style={{ color: t.text }}>{it.q}</summary>
              <p className="mt-2 whitespace-pre-line leading-relaxed" style={{ color: t.muted }}>{it.a}</p>
            </details>
          ))}
        </div>
      );
    case "countdown":
      return (
        <Countdown
          until={block.until}
          label={block.label}
          accent={t.accent}
          text={t.text}
          muted={t.muted}
          border={t.border}
        />
      );
    case "columns": {
      const cols = block.cells.length >= 3 ? "sm:grid-cols-3" : block.cells.length === 2 ? "sm:grid-cols-2" : "";
      return (
        <div className={`mt-6 grid gap-4 ${cols}`}>
          {block.cells.map((c, i) => (
            <div key={i} className="rounded-xl p-4" style={{ border: `1px solid ${t.border}` }}>
              {c.title ? <div className="font-semibold" style={{ color: t.text }}>{c.title}</div> : null}
              {c.text ? <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" style={{ color: t.muted }}>{c.text}</p> : null}
            </div>
          ))}
        </div>
      );
    }
    case "socialProof": {
      if (resolved.socialProof.length === 0) return null;
      return (
        <div className="mt-6 space-y-2">
          {resolved.socialProof.map((e, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: `${t.accent}0F`, color: t.text }}>
              <span style={{ color: t.accent }}>✓</span>
              <span><strong>{e.name}</strong> bought {e.item}</span>
            </div>
          ))}
        </div>
      );
    }
    case "product": {
      const card = resolved.products.get(block.productId);
      return card ? <CatalogCard card={card} href={`/p/${card.slug}`} t={t} /> : null;
    }
    case "course": {
      const card = resolved.courses.get(block.courseId);
      return card ? <CatalogCard card={card} href={`/c/${card.slug}`} t={t} /> : null;
    }
    case "storeGrid": {
      const rows = resolved.grids.get(block.collectionId ?? ALL_PRODUCTS) ?? [];
      if (rows.length === 0) return null;
      return (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/p/${p.slug}`}
              className="flex flex-col rounded-xl p-3 no-underline transition hover:opacity-90"
              style={{ border: `1px solid ${t.border}` }}
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.title} className="aspect-square w-full rounded-lg object-cover" />
              ) : null}
              <div className="mt-2 text-sm font-medium" style={{ color: t.text }}>{p.title}</div>
              <div className="mt-0.5 text-sm font-semibold" style={{ color: t.accent }}>{formatRupees(p.pricePaise)}</div>
            </Link>
          ))}
        </div>
      );
    }
    case "leadForm": {
      const form = resolved.forms.get(block.formId);
      return form ? (
        <Link
          href={`/f/${form.slug}`}
          className="mt-6 flex items-center justify-between rounded-xl p-4 no-underline transition hover:opacity-90"
          style={{ border: `1px solid ${t.border}` }}
        >
          <span className="font-medium" style={{ color: t.text }}>{form.title}</span>
          <span className="text-sm font-medium" style={{ color: t.accent }}>Open form →</span>
        </Link>
      ) : null;
    }
    case "paymentButton": {
      const page = resolved.pages.get(block.pageId);
      return page ? (
        <div className="mt-6">
          <a
            href={`/pay/${page.slug}`}
            className="iv-cta inline-flex items-center gap-2 px-6 py-3 font-medium text-white no-underline"
          >
            {block.label}
            <span className="opacity-80">· {formatRupees(page.pricePaise)}</span>
          </a>
        </div>
      ) : null;
    }
    case "hero":
      return (
        <header className="mt-6 grid items-center gap-8 sm:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: t.text }}>
              {block.heading}
            </h1>
            {block.subheading ? (
              <p className="mt-4 text-lg leading-relaxed" style={{ color: t.muted }}>
                {block.subheading}
              </p>
            ) : null}
            {block.ctaLabel && block.ctaHref ? (
              <div className="mt-7">
                <a
                  href={block.ctaHref}
                  className="iv-cta inline-block px-7 py-3.5 text-base font-semibold text-white no-underline shadow-sm"
                >
                  {block.ctaLabel}
                </a>
              </div>
            ) : null}
          </div>
          {block.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.imageUrl}
              alt={block.heading}
              className="w-full rounded-2xl object-cover shadow-md"
              style={{ border: `1px solid ${t.border}` }}
            />
          ) : null}
        </header>
      );
    case "pricingTable": {
      const cols = block.plans.length >= 3 ? "sm:grid-cols-3" : block.plans.length === 2 ? "sm:grid-cols-2" : "";
      return (
        <div className={`mt-8 grid gap-5 ${cols}`}>
          {block.plans.map((p, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl p-6"
              style={
                p.highlighted
                  ? { border: `2px solid ${t.accent}`, background: `${t.accent}0A`, boxShadow: `0 8px 30px ${t.accent}1A` }
                  : { border: `1px solid ${t.border}` }
              }
            >
              {p.highlighted ? (
                <span
                  className="mb-3 self-start rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ background: t.accent }}
                >
                  Most popular
                </span>
              ) : null}
              <div className="text-lg font-semibold" style={{ color: t.text }}>{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold" style={{ color: t.text }}>{p.price}</span>
                {p.period ? <span className="text-sm" style={{ color: t.muted }}>{p.period}</span> : null}
              </div>
              {p.features.length > 0 ? (
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex gap-2 text-sm leading-relaxed" style={{ color: t.muted }}>
                      <span style={{ color: t.accent }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {p.ctaLabel && p.ctaHref ? (
                <a
                  href={p.ctaHref}
                  className={`mt-6 block px-5 py-2.5 text-center font-medium no-underline transition ${
                    p.highlighted ? "iv-cta text-white" : "rounded-lg hover:opacity-90"
                  }`}
                  style={p.highlighted ? undefined : { border: `1px solid ${t.accent}`, color: t.accent }}
                >
                  {p.ctaLabel}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      );
    }
    case "featureGrid": {
      const cols = block.items.length >= 3 ? "sm:grid-cols-3" : block.items.length === 2 ? "sm:grid-cols-2" : "";
      return (
        <div className={`mt-8 grid gap-5 ${cols}`}>
          {block.items.map((it, i) => (
            <div key={i} className="rounded-2xl p-5" style={{ border: `1px solid ${t.border}` }}>
              {it.icon ? (
                <div
                  className="grid h-11 w-11 place-items-center rounded-xl text-xl"
                  style={{ background: `${t.accent}14`, color: t.accent }}
                >
                  {it.icon}
                </div>
              ) : null}
              {it.title ? <div className="mt-3 font-semibold" style={{ color: t.text }}>{it.title}</div> : null}
              {it.text ? <p className="mt-1.5 text-sm leading-relaxed" style={{ color: t.muted }}>{it.text}</p> : null}
            </div>
          ))}
        </div>
      );
    }
    case "stats": {
      const cols = block.items.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : block.items.length === 3 ? "grid-cols-3" : block.items.length === 2 ? "grid-cols-2" : "grid-cols-1";
      return (
        <div
          className={`mt-8 grid gap-4 rounded-2xl p-6 ${cols}`}
          style={{ background: `${t.accent}0A`, border: `1px solid ${t.border}` }}
        >
          {block.items.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold tabular-nums" style={{ color: t.accent }}>{s.value}</div>
              {s.label ? <div className="mt-1 text-sm" style={{ color: t.muted }}>{s.label}</div> : null}
            </div>
          ))}
        </div>
      );
    }
    case "gallery": {
      const cols = block.images.length >= 3 ? "sm:grid-cols-3" : block.images.length === 2 ? "sm:grid-cols-2" : "";
      return (
        <div className={`mt-8 grid gap-3 ${cols}`}>
          {block.images.map((im, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={im.url}
              alt={im.alt}
              className="aspect-square w-full rounded-xl object-cover"
              style={{ border: `1px solid ${t.border}` }}
            />
          ))}
        </div>
      );
    }
    case "logoStrip":
      return (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-80">
          {block.logos.map((lg, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={lg.url} alt={lg.alt} className="h-8 w-auto object-contain sm:h-10" />
          ))}
        </div>
      );
    case "imageText": {
      const img = block.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.imageUrl}
          alt={block.heading}
          className="w-full rounded-2xl object-cover shadow-sm"
          style={{ border: `1px solid ${t.border}` }}
        />
      ) : null;
      const copy = (
        <div>
          {block.heading ? <h2 className="text-2xl font-semibold" style={{ color: t.text }}>{block.heading}</h2> : null}
          {block.text ? <p className="mt-3 whitespace-pre-line leading-relaxed" style={{ color: t.muted }}>{block.text}</p> : null}
          {block.ctaLabel && block.ctaHref ? (
            <div className="mt-6">
              <a href={block.ctaHref} className="iv-cta inline-block px-6 py-3 font-medium text-white no-underline">
                {block.ctaLabel}
              </a>
            </div>
          ) : null}
        </div>
      );
      return (
        <section className="mt-10 grid items-center gap-8 sm:grid-cols-2">
          {block.flip ? (<>{copy}{img}</>) : (<>{img}{copy}</>)}
        </section>
      );
    }
  }
}

export default async function AiLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const page = await cachedAiPage(tenant.id, slug);
  if (!page) notFound();
  const content = normalizeToBlocks(page.content);
  // Corrupt/empty content would otherwise render a blank "Untitled" page; keep
  // the old behavior of 404ing instead of publishing an empty page.
  if (content.blocks.length === 0) notFound();
  const [tracking, resolved] = await Promise.all([
    getTenantTracking(tenant.id),
    resolveEntities(tenant.id, content.blocks),
  ]);
  // Multi-page site: if this page belongs to a site, fetch its sibling published pages
  // for a shared top nav (a single page in its site shows no nav).
  const nav = page.siteId ? await getSiteNav(page.siteId) : [];
  const t: Tokens = resolveTheme(content.theme);

  return (
    <div className="iv-page" style={{ background: t.bg, minHeight: "100vh", position: "relative" }}>
      <ThemeStyle t={t} />
      <AnimatedBg type={t.background} />
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <TrackingScripts ids={tracking ?? {}} />
        {nav.length > 1 ? (
          <nav
            className="mb-10 flex flex-wrap gap-x-5 gap-y-2 border-b pb-4 text-sm font-medium"
            style={{ borderColor: t.border }}
          >
            {nav.map((item) => (
              <Link
                key={item.slug}
                href={`/${item.slug}`}
                style={{ color: item.slug === slug ? t.accent : t.muted }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <article>
          {content.blocks.map((b, i) => (
            <div key={i} className="iv-reveal">
              <BlockView block={b} t={t} resolved={resolved} />
            </div>
          ))}
        </article>

        <footer className="mt-20 pt-6 text-center text-sm" style={{ borderTop: `1px solid ${t.border}`, color: t.muted }}>
          {tenant.name ?? tenant.username} ·{" "}
          <Link href="/account" className="underline">
            Your orders
          </Link>
        </footer>
      </main>
      <BuiltWithBadge />
      <Reveal />
    </div>
  );
}
