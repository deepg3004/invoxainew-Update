"use client";

import Link from "next/link";
import { formatRupees } from "@invoxai/utils/money";
import { AddToCartButton } from "../AddToCartButton";

/** A storefront product card with an add-to-cart action (Store slice 3). */
export function ProductCard({
  product,
}: {
  product: {
    id: string;
    slug: string;
    title: string;
    pricePaise: number;
    imageUrl: string | null;
    stockQty: number | null;
  };
}) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4">
      <Link href={`/p/${product.slug}`} className="group">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            className="aspect-square w-full rounded-lg border border-neutral-100 object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-neutral-50 text-neutral-300">
            No image
          </div>
        )}
        <div className="mt-3 font-medium text-neutral-900 group-hover:underline">
          {product.title}
        </div>
        <div className="mt-0.5 text-sm text-neutral-500">
          {formatRupees(product.pricePaise)}
          {product.stockQty === 0 ? (
            <span className="ml-2 text-xs font-medium text-red-600">Sold out</span>
          ) : product.stockQty !== null && product.stockQty <= 5 ? (
            <span className="ml-2 text-xs font-medium text-amber-600">
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
