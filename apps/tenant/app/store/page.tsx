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

export default async function StorePage() {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const [products, tracking] = await Promise.all([
    listPublishedProducts(tenant.id),
    getTenantTracking(tenant.id),
  ]);

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
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {products.map((p) => (
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
      )}
    </main>
  );
}
