"use server";

import { revalidatePath } from "next/cache";
import { encryptSecret } from "@invoxai/utils/crypto";
import { connectSellerGateway, disconnectSellerGateway } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";
import { validateRazorpayCredentials } from "../../lib/razorpay";

export type GatewayFormState = { error?: string; ok?: boolean };

/**
 * Connect the seller's OWN Razorpay account.
 *
 * Flow: derive TEST/LIVE from the key prefix → VALIDATE the keys live against
 * Razorpay (so we never store dud or mistyped credentials) → ENCRYPT the secret
 * (AES-256-GCM) → store. The plaintext secret never leaves this server action
 * and is never written to the DB or returned to the client.
 */
export async function connectGateway(
  _prev: GatewayFormState,
  form: FormData,
): Promise<GatewayFormState> {
  const { tenant } = await requireTenant();

  const keyId = String(form.get("keyId") ?? "").trim();
  const keySecret = String(form.get("keySecret") ?? "").trim();

  if (!keyId || !keySecret) {
    return { error: "Enter both the Key ID and Key Secret." };
  }

  const mode = keyId.startsWith("rzp_live_")
    ? "LIVE"
    : keyId.startsWith("rzp_test_")
      ? "TEST"
      : null;
  if (!mode) {
    return { error: "Key ID should start with rzp_test_ or rzp_live_." };
  }

  const check = await validateRazorpayCredentials(keyId, keySecret);
  if (!check.ok) {
    return {
      error:
        check.reason === "invalid"
          ? "Razorpay rejected these credentials. Double-check the Key ID and Secret."
          : "Couldn’t reach Razorpay to verify the keys. Please try again.",
    };
  }

  await connectSellerGateway({
    tenantId: tenant.id,
    provider: "RAZORPAY",
    keyId,
    secretEnc: encryptSecret(keySecret),
    mode,
  });

  revalidatePath("/gateway");
  return { ok: true };
}

export async function disconnectGateway(): Promise<void> {
  const { tenant } = await requireTenant();
  await disconnectSellerGateway(tenant.id);
  revalidatePath("/gateway");
}
