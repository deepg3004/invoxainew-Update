import { prisma } from "./client";

/**
 * Buyer Corner data access (C8).
 *
 * A buyer is a Profile (Supabase user) with a per-tenant BuyerAccount. Buyers
 * see ONLY their own orders, ALWAYS scoped by tenantId (hard rule) — there is no
 * helper here that returns orders across tenants or for another buyer.
 */

/** Create the buyer↔tenant link on first Buyer Corner visit (idempotent). */
export function ensureBuyerAccount(tenantId: string, profileId: string) {
  return prisma.buyerAccount.upsert({
    where: { tenantId_profileId: { tenantId, profileId } },
    create: { tenantId, profileId },
    update: {},
  });
}

/**
 * This buyer's PAID orders on THIS tenant, newest first. Attributed two ways so
 * guest orders aren't lost: by `buyerProfileId` (set when logged in at
 * checkout) OR by a matching `buyerEmail` (an order placed as a guest with the
 * same email the buyer later signs in with). Always scoped to `tenantId`.
 */
export function listBuyerOrders(input: {
  tenantId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: object[] = [{ buyerProfileId: input.profileId }];
  if (input.email) {
    attribution.push({ buyerEmail: input.email });
  }
  return prisma.buyerPayment.findMany({
    where: {
      tenantId: input.tenantId,
      status: "PAID",
      OR: attribution,
    },
    orderBy: { paidAt: "desc" },
    include: {
      paymentPage: { select: { title: true, slug: true } },
      orderItems: {
        select: { titleSnapshot: true, unitPricePaise: true, quantity: true },
      },
    },
  });
}
