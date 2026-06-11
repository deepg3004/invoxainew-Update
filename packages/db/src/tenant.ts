import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Tenant + Profile data access.
 *
 * SECURITY: Prisma runs as the DB owner and bypasses RLS, so isolation is
 * enforced HERE — every lookup takes the authenticated owner's id and filters
 * by it. Never add a helper that returns another owner's tenant.
 */

/** Upsert the app-level profile mirror of a Supabase auth user. */
export function upsertProfile(input: {
  id: string;
  email?: string | null;
  fullName?: string | null;
}) {
  return prisma.profile.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      email: input.email ?? null,
      fullName: input.fullName ?? null,
    },
    // Only overwrite when a new value is provided.
    update: {
      email: input.email ?? undefined,
      fullName: input.fullName ?? undefined,
    },
  });
}

/** The tenant owned by this user, or null. Scoped by ownerId. */
export function getTenantByOwnerId(ownerId: string) {
  return prisma.tenant.findUnique({ where: { ownerId } });
}

/** Public lookup by username (used to render a tenant's public site). */
export function getTenantByUsername(username: string) {
  return prisma.tenant.findUnique({ where: { username } });
}

export interface OnboardingStatus {
  hasSubscription: boolean;
  gatewayConnected: boolean;
  hasPaymentPage: boolean;
  hasWalletBalance: boolean;
}

/** Seller setup progress for the dashboard onboarding checklist. Scoped. */
export async function getOnboardingStatus(
  tenantId: string,
): Promise<OnboardingStatus> {
  const [gw, pages, wallet, sub] = await Promise.all([
    prisma.sellerGateway.findUnique({
      where: { tenantId },
      select: { status: true },
    }),
    prisma.paymentPage.count({ where: { tenantId } }),
    prisma.wallet.findUnique({
      where: { tenantId },
      select: { balancePaise: true },
    }),
    prisma.subscription.findUnique({
      where: { tenantId },
      select: { status: true },
    }),
  ]);
  return {
    hasSubscription: sub !== null,
    gatewayConnected: gw?.status === "CONNECTED",
    hasPaymentPage: pages > 0,
    hasWalletBalance: (wallet?.balancePaise ?? 0) > 0,
  };
}

/** Is this tenant suspended? (storefront + checkout must be blocked if so.) */
export async function isTenantSuspended(tenantId: string): Promise<boolean> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { suspendedAt: true },
  });
  return Boolean(t?.suspendedAt);
}

/** Cheap existence check for live username availability. */
export async function isUsernameTaken(username: string): Promise<boolean> {
  const hit = await prisma.tenant.findUnique({
    where: { username },
    select: { id: true },
  });
  return hit !== null;
}

export type CreateTenantResult =
  | { ok: true; tenant: { id: string; username: string } }
  | { ok: false; reason: "username_taken" | "already_has_tenant" };

/**
 * Create the seller's tenant. Race-safe via DB unique constraints:
 *  - `username` unique → two sellers can't claim the same name;
 *  - `ownerId` unique → a seller can't end up with two tenants.
 * A duplicate is reported, never silently duplicated (idempotent on conflict).
 */
export async function createTenantForOwner(params: {
  ownerId: string;
  username: string;
  name?: string | null;
}): Promise<CreateTenantResult> {
  try {
    const tenant = await prisma.tenant.create({
      data: {
        ownerId: params.ownerId,
        username: params.username,
        name: params.name ?? null,
      },
      select: { id: true, username: true },
    });
    return { ok: true, tenant };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Which unique constraint tripped — username or ownerId?
      const target = (e.meta?.target as string[] | string | undefined) ?? "";
      const hitOwner = Array.isArray(target)
        ? target.some((t) => t.includes("ownerId"))
        : String(target).includes("ownerId");
      return {
        ok: false,
        reason: hitOwner ? "already_has_tenant" : "username_taken",
      };
    }
    throw e;
  }
}
