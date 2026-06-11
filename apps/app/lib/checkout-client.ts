"use client";

/**
 * Shared client-side Razorpay Checkout runner (used by both billing and wallet
 * top-up). Opens the Checkout modal for a server-created order, then confirms
 * synchronously via /api/billing/verify. The webhook is the authoritative
 * backstop, so a failed/again-pending verify is recoverable, not fatal.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export interface CheckoutArgs {
  keyId: string;
  orderId: string;
  amountPaise: number;
  name: string;
  description: string;
}

export type CheckoutOutcome =
  | { status: "paid" }
  | { status: "pending" } // captured but confirmation not yet complete
  | { status: "error"; message: string };

export function runRazorpayCheckout(args: CheckoutArgs): Promise<CheckoutOutcome> {
  return new Promise((resolve) => {
    if (!window.Razorpay) {
      resolve({
        status: "error",
        message: "Payment library failed to load. Refresh and try again.",
      });
      return;
    }

    const rzp = new window.Razorpay({
      key: args.keyId,
      order_id: args.orderId,
      amount: args.amountPaise,
      currency: "INR",
      name: args.name,
      description: args.description,
      handler: async (response: Record<string, string>) => {
        try {
          const verify = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          resolve(verify.ok ? { status: "paid" } : { status: "pending" });
        } catch {
          resolve({ status: "pending" });
        }
      },
      modal: {
        ondismiss: () =>
          resolve({ status: "error", message: "Checkout cancelled." }),
      },
    });
    rzp.open();
  });
}
