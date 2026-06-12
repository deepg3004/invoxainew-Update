"use client";

import { useState } from "react";
import { addToCart, type CartItem } from "../lib/cart";

/**
 * Add a product to the client-side cart (Store slice 3). Display data only —
 * the checkout action re-prices from the DB, so a stale stored price is harmless.
 */
export function AddToCartButton({
  product,
  className,
}: {
  product: Omit<CartItem, "qty">;
  className?: string;
}) {
  const [added, setAdded] = useState(false);

  function add(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  const soldOut = product.maxQty === 0;

  return (
    <button
      onClick={add}
      disabled={soldOut}
      className={
        className ??
        "w-full rounded-lg border border-white/10 px-4 py-2 text-sm font-medium hover:border-brand/40 disabled:opacity-50"
      }
    >
      {soldOut ? "Sold out" : added ? "✓ Added" : "Add to cart"}
    </button>
  );
}
