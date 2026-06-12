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
