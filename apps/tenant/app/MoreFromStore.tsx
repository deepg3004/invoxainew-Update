import Link from "next/link";
import { listPublishedProducts, getProductRatingSummaries } from "@invoxai/db";
import { ProductCard } from "./store/ProductCard";

/**
 * "More from this store" cross-sell — up to `limit` other published products from
 * the same seller, reusing the storefront ProductCard (so sale pricing + ratings
 * show). Server component; renders nothing when there's nothing else to show.
 * `excludeProductId` drops the product currently being viewed.
 */
export async function MoreFromStore({
  tenantId,
  excludeProductId,
  limit = 3,
}: {
  tenantId: string;
  excludeProductId?: string;
  limit?: number;
}) {
  const all = await listPublishedProducts(tenantId);
  const others = all.filter((p) => p.id !== excludeProductId).slice(0, limit);
  if (others.length === 0) return null;

  const ratings = await getProductRatingSummaries(others.map((p) => p.id));

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">More from this store</h2>
        <Link href="/store" className="text-sm text-cyan underline">
          View all →
        </Link>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {others.map((p) => (
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
            rating={ratings.get(p.id)}
          />
        ))}
      </div>
    </section>
  );
}
