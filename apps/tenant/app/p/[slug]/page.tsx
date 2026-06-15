import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSellerGateway,
  getEnabledSellerUpi,
  getTenantTracking,
  getProductRatingSummary,
  getProductReviews,
  getOrderBumpProduct,
  listProductVariants,
  listPublishedProducts,
} from "@invoxai/db";
import { formatDateIST } from "@invoxai/utils/date";
import { resolveTenantByHost } from "../../../lib/resolve";
import { cachedProduct } from "../../../lib/content";
import { formatRupees } from "@invoxai/utils/money";
import { ProductBuyBox } from "./ProductBuyBox";
import { Stars } from "../../Stars";
import { MoreFromStore } from "../../MoreFromStore";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";
import { TrackView } from "../../TrackView";
import { CartLink } from "../../CartLink";

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
  const product = await cachedProduct(tenant.id, slug);
  if (!product) return {};
  const metaTitle = product.metaTitle?.trim() || product.title;
  const description = product.metaDescription?.trim() || product.description?.slice(0, 200) || undefined;
  const images = product.imageUrl ? [product.imageUrl] : undefined;
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

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  if (tenant.suspendedAt) return <StoreUnavailable name={tenant.name ?? tenant.username} />;

  const { slug } = await params;
  const product = await cachedProduct(tenant.id, slug);
  if (!product) notFound();

  const [gateway, upi, tracking, rating, reviews, bumpProduct, variants, related] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getProductRatingSummary(product.id),
    getProductReviews(product.id),
    getOrderBumpProduct(tenant.id),
    listProductVariants(product.id),
    // Related products: others in the same collection (derived, no extra table).
    product.collectionId
      ? listPublishedProducts(tenant.id, { collectionId: product.collectionId })
      : Promise.resolve([]),
  ]);
  const relatedProducts = related.filter((p) => p.id !== product.id).slice(0, 4);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const sellerReady = razorpayReady || Boolean(upi);
  // Offer the store's bump add-on here — unless this IS the bump product.
  const bump =
    bumpProduct && bumpProduct.id !== product.id
      ? {
          id: bumpProduct.id,
          title: bumpProduct.title,
          pricePaise: bumpProduct.pricePaise,
          compareAtPaise: bumpProduct.compareAtPaise,
          imageUrl: bumpProduct.imageUrl,
          blurb: bumpProduct.bumpBlurb,
        }
      : null;

  const onSale =
    product.compareAtPaise != null && product.compareAtPaise > product.pricePaise;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TrackingScripts ids={tracking ?? {}} />
      <TrackView name={product.title} valuePaise={product.pricePaise} />
      <div className="flex items-center justify-between">
        <Link href="/store" className="text-sm text-cyan underline">
          ← {tenant.name ?? tenant.username} store
        </Link>
        <CartLink />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* ── Image ───────────────────────────────────────────────────── */}
        <div>
          <div className="lg:sticky lg:top-6">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.title}
                className="aspect-square w-full rounded-xl border border-zinc-200 object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-muted">
                No image
              </div>
            )}
            {product.galleryUrls.length > 0 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {product.galleryUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`${product.title} ${i + 2}`}
                    className="aspect-square w-full rounded-lg border border-zinc-200 object-cover"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Details + buy box ───────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-bold leading-tight">{product.title}</h1>
          {rating.count > 0 ? (
            <a href="#reviews" className="mt-2 flex items-center gap-2 text-sm">
              <span className="font-semibold text-zinc-900">{rating.avg.toFixed(1)}</span>
              <Stars value={rating.avg} className="text-sm" />
              <span className="text-muted">
                ({rating.count} review{rating.count === 1 ? "" : "s"})
              </span>
            </a>
          ) : null}

          <div className="mt-4 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold">{formatRupees(product.pricePaise)}</span>
            {onSale ? (
              <>
                <span className="text-lg text-muted line-through">
                  {formatRupees(product.compareAtPaise!)}
                </span>
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700">
                  {Math.round((1 - product.pricePaise / product.compareAtPaise!) * 100)}% off
                </span>
              </>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {product.kind.charAt(0) + product.kind.slice(1).toLowerCase()} · paid securely to{" "}
            {tenant.name ?? tenant.username}.
          </p>

          {product.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <Link
                  key={t}
                  href={`/store?q=${encodeURIComponent(t)}`}
                  className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-muted hover:bg-zinc-50"
                >
                  {t}
                </Link>
              ))}
            </div>
          ) : null}

          {product.description ? (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-zinc-700">
              {product.description}
            </p>
          ) : null}

          <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-5">
            {sellerReady ? (
              <ProductBuyBox
                product={{
                  id: product.id,
                  slug: product.slug,
                  title: product.title,
                  pricePaise: product.pricePaise,
                  imageUrl: product.imageUrl,
                  stockQty: product.stockQty,
                }}
                razorpayReady={razorpayReady}
                upi={
                  upi
                    ? { upiId: upi.upiId, payeeName: upi.displayName ?? tenant.name ?? tenant.username }
                    : null
                }
                bump={bump}
                variants={variants.map((v) => ({
                  id: v.id,
                  label: v.label,
                  pricePaise: v.pricePaise,
                  stockQty: v.stockQty,
                }))}
              />
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
                This seller hasn’t finished setting up payments yet.
              </p>
            )}
            <ul className="mt-4 space-y-1.5 border-t border-zinc-200 pt-4 text-sm text-muted">
              <li>✓ Secure checkout on {tenant.name ?? tenant.username}'s own gateway</li>
              <li>✓ Instant receipt &amp; access</li>
            </ul>
          </div>
        </div>
      </div>

      {reviews.length > 0 ? (
        <section id="reviews" className="mt-10">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Reviews</h2>
            <Stars value={rating.avg} />
            <span className="text-sm text-muted">
              {rating.avg.toFixed(1)} · {rating.count}
            </span>
          </div>
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-zinc-200 bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <Stars value={r.rating} className="text-sm" />
                  <span className="text-xs text-muted">{formatDateIST(r.createdAt)}</span>
                </div>
                {r.body ? (
                  <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{r.body}</p>
                ) : null}
                <p className="mt-1.5 text-xs text-muted">
                  {r.authorName || "Verified buyer"} ·{" "}
                  <span className="font-medium text-green-700">✓ Verified purchase</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {relatedProducts.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-zinc-900">Related products</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {relatedProducts.map((p) => (
              <Link
                key={p.id}
                href={`/p/${p.slug}`}
                className="flex flex-col rounded-xl border border-zinc-200 p-3 no-underline transition hover:border-brand/40"
              >
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.title} className="aspect-square w-full rounded-lg object-cover" />
                ) : null}
                <div className="mt-2 text-sm font-medium text-zinc-900">{p.title}</div>
                <div className="mt-0.5 text-sm font-semibold text-brand-strong">{formatRupees(p.pricePaise)}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <MoreFromStore tenantId={tenant.id} excludeProductId={product.id} />
    </main>
  );
}
