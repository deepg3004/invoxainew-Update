import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantTracking, getSiteNav } from "@invoxai/db";
import { cachedAiPage } from "../../lib/content";
import { normalizeToBlocks, THEME_PRESETS, type Block, type Theme } from "@invoxai/utils/blocks";
import { resolveTenantByHost } from "../../lib/resolve";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";

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
  const description = textBlock?.text.slice(0, 200);
  const images = imageBlock ? [imageBlock.url] : undefined;
  return {
    title: content.title,
    description,
    openGraph: { title: content.title, description, images, type: "website" },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: content.title,
      description,
      images,
    },
  };
}

type Tokens = (typeof THEME_PRESETS)[Theme["preset"]] & { accent: string };

// Render one block as structured markup, styled by the page theme tokens.
// SECURITY: blocks are validated + sanitized by normalizeToBlocks (server-side),
// theme colours are validated to hex/preset tokens, and we never inject raw HTML
// — so a generated or edited page can't run scripts on the seller's site.
function BlockView({ block, t }: { block: Block; t: Tokens }) {
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
          <a href={block.href} className="inline-block rounded-lg px-6 py-3 font-medium text-white" style={{ background: t.accent }}>
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
  const tracking = await getTenantTracking(tenant.id);
  // Multi-page site: if this page belongs to a site, fetch its sibling published pages
  // for a shared top nav (a single page in its site shows no nav).
  const nav = page.siteId ? await getSiteNav(page.siteId) : [];
  const t: Tokens = { ...THEME_PRESETS[content.theme.preset], accent: content.theme.accent };

  return (
    <div style={{ background: t.bg, minHeight: "100vh" }}>
      <main className="mx-auto max-w-3xl px-6 py-20">
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
            <BlockView key={i} block={b} t={t} />
          ))}
        </article>

        <footer className="mt-20 pt-6 text-center text-sm" style={{ borderTop: `1px solid ${t.border}`, color: t.muted }}>
          {tenant.name ?? tenant.username} ·{" "}
          <Link href="/account" className="underline">
            Your orders
          </Link>
        </footer>
      </main>
    </div>
  );
}
