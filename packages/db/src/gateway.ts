import { prisma } from "./client";

/**
 * Seller payment-gateway data access (C6).
 *
 * Stores the seller's OWN gateway credentials so buyer payments (C7) are created
 * on the seller's account — funds settle seller-direct, never through InvoxAI
 * (RBI hard rule). The secret arrives ALREADY ENCRYPTED (AES-256-GCM, done in
 * the app layer via @invoxai/utils/crypto); this layer treats `secretEnc` as an
 * opaque blob and never logs it. Everything is scoped by the session's tenantId.
 */

/** The tenant's connected gateway, or null. Scoped by tenantId. */
export function getSellerGateway(tenantId: string) {
  return prisma.sellerGateway.findUnique({ where: { tenantId } });
}

/**
 * Connect (or re-connect) the tenant's gateway. One per tenant — re-connecting
 * overwrites the previous credentials (and refreshes connectedAt). `secretEnc`
 * must already be encrypted by the caller.
 */
export function connectSellerGateway(input: {
  tenantId: string;
  provider: "RAZORPAY";
  keyId: string;
  secretEnc: string;
  mode: "TEST" | "LIVE";
}) {
  const now = new Date();
  return prisma.sellerGateway.upsert({
    where: { tenantId: input.tenantId },
    create: {
      tenantId: input.tenantId,
      provider: input.provider,
      keyId: input.keyId,
      secretEnc: input.secretEnc,
      mode: input.mode,
      status: "CONNECTED",
      connectedAt: now,
    },
    update: {
      provider: input.provider,
      keyId: input.keyId,
      secretEnc: input.secretEnc,
      mode: input.mode,
      status: "CONNECTED",
      connectedAt: now,
    },
  });
}

/**
 * Disconnect by DELETING the row — the encrypted secret is removed entirely
 * rather than left lingering. Scoped by tenantId. No-op if nothing is connected.
 */
export async function disconnectSellerGateway(tenantId: string) {
  await prisma.sellerGateway.deleteMany({ where: { tenantId } });
}
