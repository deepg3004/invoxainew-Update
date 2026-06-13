"use client";

import { cancelUpiOrderAction } from "./actions";

/**
 * Seller's safety valve for an auto-confirmed UPI order whose payment never
 * actually arrived. Reverses the commission and revokes the buyer's access, so
 * it's gated behind a confirm. (If money DID arrive, refund the buyer directly
 * via UPI — InvoxAI never held it.)
 */
export function CancelUpiButton({ id }: { id: string }) {
  return (
    <form
      action={cancelUpiOrderAction.bind(null, id)}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "Cancel this order? This reverses the InvoxAI commission and revokes the buyer's access. Only do this if the UPI payment did NOT arrive.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
      >
        Cancel — payment not received
      </button>
    </form>
  );
}
