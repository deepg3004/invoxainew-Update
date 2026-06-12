import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublishedAiPage, getTenantTracking } from "@invoxai/db";
import { normalizeToBlocks, THEME_PRESETS, type Block, type Theme } from "@invoxai/utils/blocks";
import { resolveTenantByHost } from "../../lib/resolve";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";

export const dynamic = "force-dynamic";

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
    case "divider":
      return <hr className="mt-10" style={{ borderColor: t.border }} />;
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
  const page = await getPublishedAiPage(tenant.id, slug);
  if (!page) notFound();
  const content = normalizeToBlocks(page.content);
  const tracking = await getTenantTracking(tenant.id);
  const t: Tokens = { ...THEME_PRESETS[content.theme.preset], accent: content.theme.accent };

  return (
    <div style={{ background: t.bg, minHeight: "100vh" }}>
      <main className="mx-auto max-w-3xl px-6 py-20">
        <TrackingScripts ids={tracking ?? {}} />
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
