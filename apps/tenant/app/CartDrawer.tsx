"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRupees } from "@invoxai/utils/money";
import { useCart, setQty, removeFromCart, CART_OPEN_EVENT } from "../lib/cart";

/**
 * Shopify-style slide-over cart. Mounted once in the tenant layout; opens when
 * CartLink (or anything) dispatches CART_OPEN_EVENT. A quick view + edit; the
 * full coupon/checkout flow lives on /cart (server-trusted pricing).
 */
export function CartDrawer() {
  const items = useCart();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(CART_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CART_OPEN_EVENT, onOpen);
  }, []);

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  const count = items.reduce((n, i) => n + i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.pricePaise * i.qty, 0);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Cart">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <span className="font-semibold text-zinc-900">Your cart{count > 0 ? ` (${count})` : ""}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close cart"
            className="rounded p-1 text-muted hover:bg-zinc-100 hover:text-zinc-900"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted">Your cart is empty.</p>
          ) : (
            <ul className="space-y-4">
              {items.map((i) => (
                <li key={i.productId} className="flex gap-3">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={i.imageUrl}
                      alt={i.title}
                      className="h-16 w-16 shrink-0 rounded-lg border border-zinc-200 object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{i.title}</p>
                    <p className="text-sm text-muted">{formatRupees(i.pricePaise)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-zinc-200">
                        <button
                          type="button"
                          onClick={() => setQty(i.productId, i.qty - 1)}
                          aria-label="Decrease quantity"
                          className="px-2 py-1 text-sm text-muted hover:text-zinc-900"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-sm text-zinc-900">{i.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(i.productId, i.qty + 1)}
                          aria-label="Increase quantity"
                          className="px-2 py-1 text-sm text-muted hover:text-zinc-900"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(i.productId)}
                        className="text-xs text-muted underline hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-medium text-zinc-900">
                    {formatRupees(i.pricePaise * i.qty)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <footer className="border-t border-zinc-200 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-semibold text-zinc-900">{formatRupees(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Coupons &amp; checkout on the next step.</p>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-lg bg-brand px-4 py-2.5 text-center font-medium text-white"
            >
              Checkout →
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full text-center text-sm text-muted underline"
            >
              Continue shopping
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
