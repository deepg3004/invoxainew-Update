"use client";

import { useEffect, useState } from "react";

/**
 * Client-side shopping cart (Store slice 3). The cart lives in localStorage, not
 * the DB: buyers are usually anonymous guests, and each tenant is a separate
 * subdomain — separate browser origins — so a tenant's cart is naturally
 * isolated to that origin with no server-side cart tables or buyer session.
 *
 * SECURITY: nothing here is trusted at checkout. The stored price/title are for
 * display only; `startCartCheckout` re-reads every product from the DB
 * (server-trusted price + owning tenant) before creating the Razorpay order.
 */

export interface CartItem {
  productId: string;
  slug: string;
  title: string;
  pricePaise: number;
  imageUrl: string | null;
  // Stock cap at add time (null = untracked/unlimited); a display hint only.
  maxQty: number | null;
  qty: number;
  // Optional chosen variant (size/color). null = no variant. A product + variant
  // is a DISTINCT cart line. Price/title here are display only — checkout re-prices
  // the variant server-side.
  variantId?: string | null;
  variantLabel?: string | null;
}

/** A cart line is identified by (productId, variantId) so two variants of one
 *  product are separate lines. */
function sameLine(a: CartItem, productId: string, variantId: string | null): boolean {
  return a.productId === productId && (a.variantId ?? null) === variantId;
}

const KEY = "invox_cart_v1";
const EVENT = "invox-cart-change";

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: CartItem[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  // Notify every mounted useCart() in this tab (storage events only fire across
  // tabs, so we dispatch our own event for same-tab listeners too).
  window.dispatchEvent(new Event(EVENT));
}

function clampQty(qty: number, maxQty: number | null): number {
  const cap = maxQty === null ? 99 : Math.min(maxQty, 99);
  return Math.max(1, Math.min(Math.floor(qty), cap));
}

export function addToCart(item: Omit<CartItem, "qty">, qty = 1): void {
  const items = read();
  const variantId = item.variantId ?? null;
  const existing = items.find((i) => sameLine(i, item.productId, variantId));
  if (existing) {
    existing.qty = clampQty(existing.qty + qty, item.maxQty);
    // Refresh display fields in case the product changed since it was added.
    Object.assign(existing, item, { qty: existing.qty });
  } else {
    items.push({ ...item, variantId, qty: clampQty(qty, item.maxQty) });
  }
  write(items);
}

export function setQty(productId: string, variantId: string | null, qty: number): void {
  const items = read();
  const item = items.find((i) => sameLine(i, productId, variantId));
  if (!item) return;
  item.qty = clampQty(qty, item.maxQty);
  write(items);
}

export function removeFromCart(productId: string, variantId: string | null): void {
  write(read().filter((i) => !sameLine(i, productId, variantId)));
}

export function clearCart(): void {
  write([]);
}

/** Slide-over cart drawer open signal. CartLink dispatches it; CartDrawer (mounted
 *  once in the tenant layout) listens and opens. */
export const CART_OPEN_EVENT = "invox-cart-open";
export function openCart(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CART_OPEN_EVENT));
}

/** Reactive view of the cart for client components. Empty during SSR/first paint. */
export function useCart(): CartItem[] {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return items;
}
