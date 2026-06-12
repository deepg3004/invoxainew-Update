import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublishedAiPage, getTenantTracking } from "@invoxai/db";
import { normalizeToBlocks, type Block } from "@invoxai/utils/blocks";
import { resolveTenantByHost } from "../../lib/resolve";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";

export const dynamic = "force-dynamic";

// Render one block as structured markup. SECURITY: blocks are validated +
// sanitized by normalizeToBlocks (server-side), and we never inject raw HTML —
// text is rendered as text, links/images only with sanitized http(s)/relative
// URLs — so a generated or edited page can't run scripts on the seller's site.
function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const cls =
        block.level === 1
          ? "text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl"
          : block.level === 2
            ? "mt-10 text-2xl font-semibold text-neutral-900"
            : "mt-6 text-lg font-semibold text-neutral-800";
      if (block.level === 1) return <h1 className={cls}>{block.text}</h1>;
      if (block.level === 2) return <h2 className={cls}>{block.text}</h2>;
      return <h3 className={cls}>{block.text}</h3>;
    }
    case "text":
      return <p className="mt-3 whitespace-pre-line leading-relaxed text-neutral-600">{block.text}</p>;
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.url} alt={block.alt} className="mt-6 w-full rounded-xl border border-neutral-200 object-cover" />;
    case "button":
      return (
        <div className="mt-6">
          <a href={block.href} className="inline-block rounded-lg bg-neutral-900 px-6 py-3 font-medium text-white">
            {block.label}
          </a>
        </div>
      );
    case "divider":
      return <hr className="mt-10 border-neutral-200" />;
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <TrackingScripts ids={tracking ?? {}} />
      <article>
        {content.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </article>

      <footer className="mt-20 border-t border-neutral-200 pt-6 text-center text-sm text-neutral-400">
        {tenant.name ?? tenant.username} ·{" "}
        <Link href="/account" className="underline">
          Your orders
        </Link>
      </footer>
    </main>
  );
}
