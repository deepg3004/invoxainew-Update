"use client";

import Link from "next/link";
import { useCart } from "../lib/cart";

/** Header cart link with a live item-count badge (Store slice 3). */
export function CartLink() {
  const items = useCart();
  const count = items.reduce((n, i) => n + i.qty, 0);
  return (
    <Link href="/cart" className="text-sm font-medium text-cyan underline">
      Cart{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
