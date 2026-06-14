"use client";

import { useCart, openCart } from "../lib/cart";

/** Header cart button with a live item-count badge — opens the slide-over drawer. */
export function CartLink() {
  const items = useCart();
  const count = items.reduce((n, i) => n + i.qty, 0);
  return (
    <button type="button" onClick={openCart} className="text-sm font-medium text-cyan underline">
      Cart{count > 0 ? ` (${count})` : ""}
    </button>
  );
}
