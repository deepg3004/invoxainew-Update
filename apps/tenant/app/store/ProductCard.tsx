"use client";

import Link from "next/link";
import { formatRupees } from "@invoxai/utils/money";
import { AddToCartButton } from "../AddToCartButton";
import { Stars } from "../Stars";

/** A storefront product card with an add-to-cart action (Store slice 3). */
export function ProductCard({
  product,
  rating,
  bestseller,
}: {
  product: {
    id: string;
    slug: string;
    title: string;
    pricePaise: number;
    compareAtPaise: number | null;
    imageUrl: string | null;
    stockQty: number | null;
  };
  rating?: { count: number; avg: number };
  bestseller?: boolean;
}) {
  const onSale =
    product.compareAtPaise != null && product.compareAtPaise > product.pricePaise;
  const pctOff = onSale
    ? Math.round((1 - product.pricePaise / product.compareAtPaise!) * 100)
    : 0;
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-surface p-4">
      <Link href={`/p/${product.slug}`} className="group">
        <div className="relative">
          {bestseller ? (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-brand-gradient px-2 py-0.5 text-xs font-medium text-white shadow-glow">
              ★ Bestseller
            </span>
          ) : null}
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              className="aspect-square w-full rounded-lg border border-zinc-200 object-cover"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-50 text-muted">
              No image
            </div>
          )}
        </div>
        <div className="mt-3 font-medium text-zinc-900 group-hover:underline">
          {product.title}
        </div>
        {rating && rating.count > 0 ? (
          <div className="mt-0.5 flex items-center gap-1 text-xs">
            <Stars value={rating.avg} />
            <span className="text-muted">({rating.count})</span>
          </div>
        ) : null}
        <div className="mt-0.5 text-sm">
          <span className="font-medium text-zinc-900">{formatRupees(product.pricePaise)}</span>
          {onSale ? (
            <>
              <span className="ml-1.5 text-xs text-muted line-through">
                {formatRupees(product.compareAtPaise!)}
              </span>
              <span className="ml-1.5 text-xs font-medium text-green-700">{pctOff}% off</span>
            </>
          ) : null}
          {product.stockQty === 0 ? (
            <span className="ml-2 text-xs font-medium text-red-600">Sold out</span>
          ) : product.stockQty !== null && product.stockQty <= 5 ? (
            <span className="ml-2 text-xs font-medium text-warning">
              Only {product.stockQty} left
            </span>
          ) : null}
        </div>
      </Link>
      <div className="mt-3">
        <AddToCartButton
          product={{
            productId: product.id,
            slug: product.slug,
            title: product.title,
            pricePaise: product.pricePaise,
            imageUrl: product.imageUrl,
            maxQty: product.stockQty,
          }}
        />
      </div>
    </div>
  );
}
