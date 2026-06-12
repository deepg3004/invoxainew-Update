import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  listPublishedProducts,
  getTenantTracking,
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

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [products, tracking, { q: rawQ }] = await Promise.all([
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            {tenant.username}.invoxai.io
          </p>
          <h1 className="mt-1 text-3xl font-bold">{tenant.name ?? tenant.username}</h1>
        </div>
        <div className="flex gap-4">
          <CartLink />
          <Link href="/account" className="text-sm text-blue-600 underline">
            Your orders
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-8 text-neutral-500">No products yet. Check back soon.</p>
      ) : (
        <>
          {/* Search (GET form → /store?q=…) */}
          <form className="mt-6 flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search products"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <button className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">
              Search
            </button>
            {q ? (
              <Link
                href="/store"
                className="flex items-center px-2 text-sm text-neutral-500 underline"
              >
                Clear
              </Link>
            ) : null}
          </form>

          {filtered.length === 0 ? (
            <p className="mt-8 text-neutral-500">
              No products match “{q}”.{" "}
              <Link href="/store" className="text-blue-600 underline">
                Show all
              </Link>
            </p>
          ) : (
            <>
              {q ? (
                <p className="mt-4 text-sm text-neutral-400">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"} for “{q}”
                </p>
              ) : null}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {filtered.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={{
                      id: p.id,
                      slug: p.slug,
                      title: p.title,
                      pricePaise: p.pricePaise,
                      imageUrl: p.imageUrl,
                      stockQty: p.stockQty,
                    }}
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
