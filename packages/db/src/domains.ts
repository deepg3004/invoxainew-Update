import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Custom domains (Phase 15) — sellers connect their own domain to their tenant
 * site. A host resolves to a tenant ONLY via a VERIFIED row, and a partial unique
 * index (status = VERIFIED) guarantees at most one tenant serves any host, so
 * resolution can never cross tenants. The TXT challenge proves the seller
 * controls the DNS before we serve their tenant on the domain.
 */

const DOMAIN_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** Normalize a user-entered domain to a bare lowercase hostname, or null. */
export function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:.*$/, "");
  d = d.replace(/^www\./, "").replace(/\.$/, "");
  if (!DOMAIN_RE.test(d)) return null;
  // Our own domains are handled by subdomain resolution, not custom domains.
  if (d === "invoxai.io" || d.endsWith(".invoxai.io")) return null;
  return d;
}

export type AddDomainResult =
  | { ok: true; id: string; domain: string; verifyToken: string }
  | { ok: false; reason: "invalid" | "already_added" };

export async function addDomain(
  tenantId: string,
  rawDomain: string,
): Promise<AddDomainResult> {
  const domain = normalizeDomain(rawDomain);
  if (!domain) return { ok: false, reason: "invalid" };
  const verifyToken = randomBytes(16).toString("hex");
  try {
    const row = await prisma.tenantDomain.create({
      data: { tenantId, domain, verifyToken },
      select: { id: true, domain: true, verifyToken: true },
    });
    return { ok: true, id: row.id, domain: row.domain, verifyToken: row.verifyToken };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "already_added" };
    }
    throw e;
  }
}

/** A tenant's domains, newest first. Scoped by tenantId. */
export function listDomains(tenantId: string) {
  return prisma.tenantDomain.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
}

export function getDomainById(tenantId: string, id: string) {
  return prisma.tenantDomain.findFirst({ where: { id, tenantId } });
}

export function deleteDomain(tenantId: string, id: string) {
  return prisma.tenantDomain.deleteMany({ where: { id, tenantId } });
}

export type VerifyDomainResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "already_verified" | "conflict" };

/**
 * Flip a domain to VERIFIED (the caller has already confirmed the TXT token).
 * Guards isolation: if another tenant has already VERIFIED this domain, the
 * partial unique index trips (P2002) and we report a conflict rather than
 * serving the same host from two tenants.
 */
export async function markDomainVerified(
  tenantId: string,
  id: string,
): Promise<VerifyDomainResult> {
  const row = await prisma.tenantDomain.findFirst({ where: { id, tenantId } });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "VERIFIED") return { ok: false, reason: "already_verified" };
  try {
    await prisma.tenantDomain.update({
      where: { id: row.id },
      data: { status: "VERIFIED", verifiedAt: new Date() },
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "conflict" };
    }
    throw e;
  }
}

/** The tenant a VERIFIED custom domain maps to, or null. Used in host resolution
 *  + the TLS ask endpoint. Only ever matches a single VERIFIED row (partial
 *  unique index), so it can't resolve to two tenants. */
export function getTenantByCustomDomain(hostname: string) {
  const d = hostname.trim().toLowerCase();
  if (!d) return Promise.resolve(null);
  return prisma.tenant.findFirst({
    where: { domains: { some: { domain: d, status: "VERIFIED" } } },
  });
}
