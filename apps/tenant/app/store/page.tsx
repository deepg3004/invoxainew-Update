import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listPublishedProducts,
  getTenantTracking,
  getProductRatingSummaries,
  getProductSalesCounts,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../lib/resolve";
import { StoreUnavailable } from "../StoreUnavailable";
import { TrackingScripts } from "../TrackingScripts";
import { CartLink } from "../CartLink";
import { ProductCard } from "./ProductCard";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  const name = tenant ? (tenant.name ?? tenant.username) : "Store";
  return { title: `Store · ${name}` };
}

const SORTS = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "price-low", label: "Price ↑" },
  { key: "price-high", label: "Price ↓" },
  { key: "best-selling", label: "Best selling" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [products, tracking, { q: rawQ, sort: rawSort }] = await Promise.all([
    listPublishedProducts(tenant.id),
    getTenantTracking(tenant.id),
    searchParams,
  ]);

  const q = (rawQ ?? "").trim();
  const needle = q.toLowerCase();
  const filtered = q
    ? products.filter(
        (p) =>
          p.title.toLowerCase().includes(needle) ||
          (p.description?.toLowerCase().includes(needle) ?? false),
      )
    : products;

  // Batched rating summaries + sales counts for the visible cards (no N+1).
  const ids = filtered.map((p) => p.id);
  const [ratingSummaries, salesCounts] = await Promise.all([
    getProductRatingSummaries(ids),
    getProductSalesCounts(tenant.id, ids),
  ]);
  // "Bestseller" badge → the top 3 products that have at least one sale.
  const bestsellerIds = new Set(
    [...salesCounts.entries()]
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id),
  );

  // Sort (in-memory over the published set).
  const sort: SortKey = (SORTS.some((s) => s.key === rawSort) ? rawSort : "featured") as SortKey;
  const sorted = [...filtered];
  if (sort === "price-low") sorted.sort((a, b) => a.pricePaise - b.pricePaise);
  else if (sort === "price-high") sorted.sort((a, b) => b.pricePaise - a.pricePaise);
  else if (sort === "newest") sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  else if (sort === "best-selling")
    sorted.sort((a, b) => (salesCounts.get(b.id) ?? 0) - (salesCounts.get(a.id) ?? 0));
  const sortHref = (key: SortKey) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (key !== "featured") sp.set("sort", key);
    const s = sp.toString();
    return s ? `/store?${s}` : "/store";
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            {tenant.username}.invoxai.io
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold">
            {tenant.name ?? tenant.username}
            {tenant.verificationStatus === "VERIFIED" ? (
              <span
                title="Verified by InvoxAI"
                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
              >
                ✓ Verified
              </span>
            ) : null}
          </h1>
        </div>
        <div className="flex gap-4">
          <CartLink />
          <Link href="/account" className="text-sm text-cyan underline">
            Your orders
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-8 text-muted">No products yet. Check back soon.</p>
      ) : (
        <>
          {/* Search (GET form → /store?q=…) */}
          <form className="mt-6 flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search products"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-brand"
            />
            <button className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
              Search
            </button>
            {q ? (
              <Link href="/store" className="flex items-center px-2 text-sm text-muted underline">
                Clear
              </Link>
            ) : null}
          </form>

          {filtered.length === 0 ? (
            <p className="mt-8 text-muted">
              No products match “{q}”.{" "}
              <Link href="/store" className="text-cyan underline">
                Show all
              </Link>
            </p>
          ) : (
            <>
              {/* Sort bar + result count */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                <p className="text-sm text-muted">
                  {sorted.length} product{sorted.length === 1 ? "" : "s"}
                  {q ? ` for “${q}”` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SORTS.map((s) => (
                    <Link
                      key={s.key}
                      href={sortHref(s.key)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        sort === s.key
                          ? "bg-brand text-white"
                          : "border border-zinc-200 text-muted hover:bg-zinc-50"
                      }`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-5 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sorted.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={{
                      id: p.id,
                      slug: p.slug,
                      title: p.title,
                      pricePaise: p.pricePaise,
                      compareAtPaise: p.compareAtPaise,
                      imageUrl: p.imageUrl,
                      stockQty: p.stockQty,
                    }}
                    rating={ratingSummaries.get(p.id)}
                    bestseller={bestsellerIds.has(p.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
