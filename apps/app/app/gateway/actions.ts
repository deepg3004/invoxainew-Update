"use server";

import { revalidatePath } from "next/cache";
import { encryptSecret } from "@invoxai/utils/crypto";
import {
  connectSellerGateway,
  disconnectSellerGateway,
  upsertSellerUpi,
  deleteSellerUpi,
  logActivity,
} from "@invoxai/db";
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

  await logActivity(tenant.id, "gateway.connected", `Razorpay (${mode})`).catch(() => {});
  revalidatePath("/gateway");
  return { ok: true };
}

export async function disconnectGateway(): Promise<void> {
  const { tenant } = await requireTenant();
  await disconnectSellerGateway(tenant.id);
  await logActivity(tenant.id, "gateway.disconnected").catch(() => {});
  revalidatePath("/gateway");
}

// A UPI ID looks like handle@bank, e.g. ramesh@okhdfc / 9876543210@ybl.
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export type UpiFormState = { error?: string; ok?: boolean };

/** Save the seller's manual UPI method (buyers pay this UPI ID directly). */
export async function saveUpiAction(
  _prev: UpiFormState,
  form: FormData,
): Promise<UpiFormState> {
  const { tenant } = await requireTenant();
  const upiId = String(form.get("upiId") ?? "").trim();
  if (!UPI_RE.test(upiId)) {
    return { error: "Enter a valid UPI ID, like name@okhdfc." };
  }
  const displayName = String(form.get("displayName") ?? "").trim() || null;
  const enabled = form.get("enabled") === "on";
  await upsertSellerUpi(tenant.id, { upiId, displayName, enabled });
  await logActivity(tenant.id, "upi.saved", upiId).catch(() => {});
  revalidatePath("/gateway");
  return { ok: true };
}

/** Remove the seller's manual UPI method. */
export async function removeUpiAction(): Promise<void> {
  const { tenant } = await requireTenant();
  await deleteSellerUpi(tenant.id);
  await logActivity(tenant.id, "upi.removed").catch(() => {});
  revalidatePath("/gateway");
}
