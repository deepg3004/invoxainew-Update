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
} from "@invoxai/db";
import { formatDateIST } from "@invoxai/utils/date";
import { resolveTenantByHost } from "../../../lib/resolve";
import { cachedProduct } from "../../../lib/content";
import { formatRupees } from "@invoxai/utils/money";
import { ProductBuyBox } from "./ProductBuyBox";
import { Stars } from "../../Stars";
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
  const description = product.description?.slice(0, 200) ?? undefined;
  const images = product.imageUrl ? [product.imageUrl] : undefined;
  return {
    title: product.title,
    description,
    openGraph: { title: product.title, description, images, type: "website" },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: product.title,
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

  const [gateway, upi, tracking, rating, reviews] = await Promise.all([
    getSellerGateway(tenant.id),
    getEnabledSellerUpi(tenant.id),
    getTenantTracking(tenant.id),
    getProductRatingSummary(product.id),
    getProductReviews(product.id),
  ]);
  const razorpayReady = Boolean(gateway && gateway.status === "CONNECTED");
  const sellerReady = razorpayReady || Boolean(upi);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <TrackView name={product.title} valuePaise={product.pricePaise} />
      <div className="flex items-center justify-between">
        <Link href="/store" className="text-sm text-cyan underline">
          ← {tenant.name ?? tenant.username} store
        </Link>
        <CartLink />
      </div>

      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.title}
          className="mt-4 aspect-square w-full rounded-xl border border-zinc-200 object-cover"
        />
      ) : null}

      <h1 className="mt-4 text-2xl font-bold">{product.title}</h1>
      {rating.count > 0 ? (
        <a href="#reviews" className="mt-1 flex items-center gap-2 text-sm">
          <Stars value={rating.avg} />
          <span className="font-medium text-zinc-900">{rating.avg.toFixed(1)}</span>
          <span className="text-muted">
            ({rating.count} review{rating.count === 1 ? "" : "s"})
          </span>
        </a>
      ) : null}
      {product.description ? (
        <p className="mt-2 whitespace-pre-line text-muted">{product.description}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-zinc-200 bg-surface p-6">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-bold">{formatRupees(product.pricePaise)}</span>
          {product.compareAtPaise != null && product.compareAtPaise > product.pricePaise ? (
            <>
              <span className="text-lg text-muted line-through">
                {formatRupees(product.compareAtPaise)}
              </span>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700">
                {Math.round((1 - product.pricePaise / product.compareAtPaise) * 100)}% off
              </span>
            </>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted">
          {product.kind.charAt(0) + product.kind.slice(1).toLowerCase()} · paid securely
          to {tenant.name ?? tenant.username}.
        </p>

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
          />
        ) : (
          <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This seller hasn’t finished setting up payments yet.
          </p>
        )}
      </div>

      {reviews.length > 0 ? (
        <section id="reviews" className="mt-8">
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
    </main>
  );
}
