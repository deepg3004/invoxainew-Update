import { Prisma, type CommunityStatus } from "@prisma/client";
import { prisma } from "./client";

/**
 * Communities / members spaces (Phase 12). Same money model as courses: a
 * community is sold on the SELLER's gateway; the PAID order grants a
 * CommunityMembership (claim-winner only, in markBuyerPaymentPaid). A FREE
 * community (pricePaise 0) is joined directly via joinFreeCommunity. Membership
 * WRITES for paid orders live in payments.ts; this file is catalog/posts +
 * membership reads + the free-join write. Every read/write is tenant-scoped.
 */

// ── Communities (seller-managed) ──────────────────────────────────────────────

export type CreateCommunityResult =
  | { ok: true; id: string }
  | { ok: false; reason: "slug_taken" };

export async function createCommunity(input: {
  tenantId: string;
  slug: string;
  title: string;
  description?: string | null;
  pricePaise: number;
  compareAtPaise?: number | null;
  imageUrl?: string | null;
  accessUrl?: string | null;
  sortOrder?: number;
  status?: CommunityStatus;
}): Promise<CreateCommunityResult> {
  try {
    const c = await prisma.community.create({
      data: {
        tenantId: input.tenantId,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        pricePaise: input.pricePaise,
        compareAtPaise: input.compareAtPaise ?? null,
        imageUrl: input.imageUrl ?? null,
        accessUrl: input.accessUrl ?? null,
        sortOrder: input.sortOrder ?? 0,
        status: input.status ?? "DRAFT",
      },
      select: { id: true },
    });
    return { ok: true, id: c.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, reason: "slug_taken" };
    }
    throw e;
  }
}

/** A seller's communities, with member + post counts. Scoped by tenantId. */
export function listCommunities(tenantId: string) {
  return prisma.community.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { memberships: true, posts: true } } },
  });
}

export function getCommunityById(tenantId: string, id: string) {
  return prisma.community.findFirst({ where: { id, tenantId } });
}

export function updateCommunity(
  tenantId: string,
  id: string,
  data: {
    title: string;
    description?: string | null;
    pricePaise: number;
    compareAtPaise?: number | null;
    imageUrl?: string | null;
    accessUrl?: string | null;
    sortOrder?: number;
  },
) {
  return prisma.community.updateMany({
    where: { id, tenantId },
    data: {
      title: data.title,
      description: data.description ?? null,
      pricePaise: data.pricePaise,
      compareAtPaise: data.compareAtPaise ?? null,
      imageUrl: data.imageUrl ?? null,
      accessUrl: data.accessUrl ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export function setCommunityStatus(tenantId: string, id: string, status: CommunityStatus) {
  return prisma.community.updateMany({ where: { id, tenantId }, data: { status } });
}

// ── Posts (announcements; scoped through their community) ─────────────────────

export function listCommunityPosts(communityId: string) {
  return prisma.communityPost.findMany({
    where: { communityId },
    orderBy: { createdAt: "desc" },
  });
}

export function createCommunityPost(input: {
  communityId: string;
  title: string;
  body?: string | null;
}) {
  return prisma.communityPost.create({
    data: { communityId: input.communityId, title: input.title, body: input.body ?? null },
    select: { id: true },
  });
}

export function deleteCommunityPost(communityId: string, postId: string) {
  return prisma.communityPost.deleteMany({ where: { id: postId, communityId } });
}

// ── Public storefront reads ───────────────────────────────────────────────────

export function listPublishedCommunities(tenantId: string) {
  return prisma.community.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { memberships: true, posts: true } } },
  });
}

/** A PUBLISHED community by tenant+slug for the public sales page. Post bodies +
 *  accessUrl are members-only, so this returns only meta + counts (never the
 *  gated content). */
export function getPublishedCommunity(tenantId: string, slug: string) {
  return prisma.community.findFirst({
    where: { tenantId, slug, status: "PUBLISHED" },
    include: { _count: { select: { memberships: true, posts: true } } },
  });
}

/** A PUBLISHED community by id — used by the buyer checkout action so price/title
 *  are read server-trusted from the DB. */
export function getPublishedCommunityById(id: string) {
  return prisma.community.findFirst({ where: { id, status: "PUBLISHED" } });
}

/** A PUBLISHED community's meta (no gated content) — for the members area, which
 *  loads posts + accessUrl separately after the membership check. */
export function getPublishedCommunityMeta(tenantId: string, slug: string) {
  return prisma.community.findFirst({ where: { tenantId, slug, status: "PUBLISHED" } });
}

// ── Memberships (access grants; paid writes live in payments.ts) ──────────────

/** This buyer's membership in a community, or null. Attributed by profileId
 *  (logged in) OR matching join/purchase email (guest). Tenant-scoped. */
export function getMembership(input: {
  tenantId: string;
  communityId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: Prisma.CommunityMembershipWhereInput[] = [
    { buyerProfileId: input.profileId },
  ];
  if (input.email) attribution.push({ buyerEmail: input.email });
  return prisma.communityMembership.findFirst({
    where: { tenantId: input.tenantId, communityId: input.communityId, OR: attribution },
  });
}

/** The communities this buyer has joined on this tenant (deduped, non-archived). */
export async function listJoinedCommunities(input: {
  tenantId: string;
  profileId: string;
  email?: string | null;
}) {
  const attribution: Prisma.CommunityMembershipWhereInput[] = [
    { buyerProfileId: input.profileId },
  ];
  if (input.email) attribution.push({ buyerEmail: input.email });
  const memberships = await prisma.communityMembership.findMany({
    where: { tenantId: input.tenantId, OR: attribution },
    orderBy: { createdAt: "desc" },
    distinct: ["communityId"],
    include: {
      community: { select: { id: true, slug: true, title: true, imageUrl: true, status: true } },
    },
  });
  return memberships.map((m) => m.community).filter((c) => c.status !== "ARCHIVED");
}

export type JoinFreeResult = { ok: true } | { ok: false; reason: "not_free" | "not_found" };

/**
 * Join a FREE community directly (no payment). Idempotent — createMany with
 * skipDuplicates can't double-insert if it races. NOT a money path (price must be
 * 0); the community is re-read server-trusted so a paid community can't be joined
 * for free. Tenant-scoped.
 */
export async function joinFreeCommunity(input: {
  tenantId: string;
  communityId: string;
  profileId: string;
  email?: string | null;
}): Promise<JoinFreeResult> {
  const community = await prisma.community.findFirst({
    where: { id: input.communityId, tenantId: input.tenantId, status: "PUBLISHED" },
    select: { pricePaise: true },
  });
  if (!community) return { ok: false, reason: "not_found" };
  if (community.pricePaise > 0) return { ok: false, reason: "not_free" };

  await prisma.communityMembership.createMany({
    data: [
      {
        tenantId: input.tenantId,
        communityId: input.communityId,
        buyerProfileId: input.profileId,
        buyerEmail: input.email ?? null,
        source: "free",
      },
    ],
    skipDuplicates: true,
  });
  return { ok: true };
}
