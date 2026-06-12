import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getSellerGateway,
  getTenantTracking,
} from "@invoxai/db";
import { resolveTenantByHost } from "../../../lib/resolve";
import { cachedProduct } from "../../../lib/content";
import { formatRupees } from "@invoxai/utils/money";
import { ProductBuyBox } from "./ProductBuyBox";
import { StoreUnavailable } from "../../StoreUnavailable";
import { TrackingScripts } from "../../TrackingScripts";
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

  const gateway = await getSellerGateway(tenant.id);
  const sellerReady = Boolean(gateway && gateway.status === "CONNECTED");
  const tracking = await getTenantTracking(tenant.id);

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <TrackingScripts ids={tracking ?? {}} />
      <div className="flex items-center justify-between">
        <Link href="/store" className="text-sm text-blue-600 underline">
          ← {tenant.name ?? tenant.username} store
        </Link>
        <CartLink />
      </div>

      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.title}
          className="mt-4 aspect-square w-full rounded-xl border border-neutral-200 object-cover"
        />
      ) : null}

      <h1 className="mt-4 text-2xl font-bold">{product.title}</h1>
      {product.description ? (
        <p className="mt-2 whitespace-pre-line text-neutral-500">{product.description}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="text-3xl font-bold">{formatRupees(product.pricePaise)}</div>
        <p className="mt-1 text-xs text-neutral-400">
          {product.kind.charAt(0) + product.kind.slice(1).toLowerCase()} · paid securely
          to {tenant.name ?? tenant.username} via Razorpay.
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
          />
        ) : (
          <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This seller hasn’t finished setting up payments yet.
          </p>
        )}
      </div>
    </main>
  );
}
