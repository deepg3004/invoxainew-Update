import { prisma } from "./client";

export interface BioLinkInput {
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  instagram?: string | null;
  youtube?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  linksText?: string | null;
  published?: boolean;
}

/** The tenant's bio-link config (seller editor). One per tenant; may not exist. */
export function getBioLink(tenantId: string) {
  return prisma.bioLink.findUnique({ where: { tenantId } });
}

/** The tenant's PUBLISHED bio link for the public page, or null. */
export function getPublishedBioLink(tenantId: string) {
  return prisma.bioLink.findFirst({ where: { tenantId, published: true } });
}

const norm = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

/** Record a bio-link click (append-only). The caller (the /bio/r redirect) has
 *  already validated the target is in this tenant's published bio. */
export function recordBioLinkClick(
  tenantId: string,
  targetUrl: string,
  label?: string | null,
) {
  return prisma.bioLinkClick.create({
    data: { tenantId, targetUrl, label: label ?? null },
  });
}

export interface BioClickStat {
  targetUrl: string;
  label: string | null;
  clicks: number;
}

/** Click totals per target for the seller's bio analytics. Tenant-scoped. */
export async function getBioLinkClickStats(
  tenantId: string,
): Promise<{ total: number; byTarget: BioClickStat[] }> {
  const rows = await prisma.bioLinkClick.groupBy({
    by: ["targetUrl", "label"],
    where: { tenantId },
    _count: { _all: true },
  });
  const byTarget = rows
    .map((r) => ({ targetUrl: r.targetUrl, label: r.label, clicks: r._count._all }))
    .sort((a, b) => b.clicks - a.clicks);
  const total = byTarget.reduce((s, r) => s + r.clicks, 0);
  return { total, byTarget };
}

/** Create or update the tenant's single bio-link page. Tenant-scoped. */
export function upsertBioLink(tenantId: string, input: BioLinkInput) {
  const data = {
    displayName: norm(input.displayName),
    bio: norm(input.bio),
    avatarUrl: norm(input.avatarUrl),
    instagram: norm(input.instagram),
    youtube: norm(input.youtube),
    twitter: norm(input.twitter),
    facebook: norm(input.facebook),
    whatsapp: norm(input.whatsapp),
    website: norm(input.website),
    linksText: norm(input.linksText),
    published: input.published ?? false,
  };
  return prisma.bioLink.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  });
}
