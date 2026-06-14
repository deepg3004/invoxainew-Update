import { Prisma, type CommunityStatus, type CommunityMessageStatus } from "@prisma/client";
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
export function listCommunities(tenantId: string, opts: { skip?: number; take?: number } = {}) {
  return prisma.community.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { memberships: true, posts: true } } },
    skip: opts.skip,
    take: opts.take,
  });
}

export function countCommunities(tenantId: string) {
  return prisma.community.count({ where: { tenantId } });
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

export function deleteCommunityPost(tenantId: string, communityId: string, postId: string) {
  // `community: { tenantId }` makes the db layer self-enforce ownership (F3).
  return prisma.communityPost.deleteMany({
    where: { id: postId, communityId, community: { tenantId } },
  });
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

// ── Member discussion (member-to-member; moderated by the seller) ─────────────
//
// A CommunityMessage is posted by a MEMBER (gate enforced in the action via
// getMembership, never here). One level of threading: a message with parentId is
// a reply. The seller (community owner) moderates by HIDING (reversible) or
// hard-DELETING. NOT a money path; every read/write is community- or tenant-
// scoped.

export type CommunityMessageNode = {
  id: string;
  authorName: string;
  body: string;
  buyerProfileId: string;
  status: CommunityMessageStatus;
  createdAt: Date;
  replies: CommunityMessageNode[];
};

/**
 * The discussion thread for a community as a 1-level tree (top-level messages,
 * each with its replies, both oldest-first). `includeHidden` is for the seller
 * moderation view; the buyer members view passes false so HIDDEN messages (and,
 * implicitly, replies under a hidden parent) never surface. A reply whose parent
 * is absent from the included set is dropped (so hiding a parent hides its
 * thread in the buyer view).
 */
export async function listCommunityMessages(
  communityId: string,
  opts: { includeHidden?: boolean } = {},
): Promise<CommunityMessageNode[]> {
  const rows = await prisma.communityMessage.findMany({
    where: {
      communityId,
      ...(opts.includeHidden ? {} : { status: "VISIBLE" }),
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      authorName: true,
      body: true,
      buyerProfileId: true,
      status: true,
      createdAt: true,
      parentId: true,
    },
  });

  const byId = new Map<string, CommunityMessageNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      authorName: r.authorName,
      body: r.body,
      buyerProfileId: r.buyerProfileId,
      status: r.status,
      createdAt: r.createdAt,
      replies: [],
    });
  }

  const roots: CommunityMessageNode[] = [];
  for (const r of rows) {
    const node = byId.get(r.id)!;
    if (r.parentId) {
      const parent = byId.get(r.parentId);
      if (parent) parent.replies.push(node);
      // else: parent not in the included set (e.g. hidden) → drop the reply.
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export type CreateCommunityMessageResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid_parent" };

/**
 * Post a member message (or a reply when parentId is set). The CALLER must have
 * already verified the author's membership. A reply's parent is re-checked to
 * belong to the SAME community (so a forged parentId from another community is
 * rejected) and must itself be a top-level message (no nested threading).
 */
export async function createCommunityMessage(input: {
  tenantId: string;
  communityId: string;
  buyerProfileId: string;
  authorName: string;
  body: string;
  parentId?: string | null;
}): Promise<CreateCommunityMessageResult> {
  if (input.parentId) {
    const parent = await prisma.communityMessage.findFirst({
      where: { id: input.parentId, communityId: input.communityId },
      select: { parentId: true },
    });
    if (!parent || parent.parentId) return { ok: false, reason: "invalid_parent" };
  }
  const m = await prisma.communityMessage.create({
    data: {
      tenantId: input.tenantId,
      communityId: input.communityId,
      buyerProfileId: input.buyerProfileId,
      authorName: input.authorName,
      body: input.body,
      parentId: input.parentId ?? null,
    },
    select: { id: true },
  });
  return { ok: true, id: m.id };
}

/**
 * A member deletes their OWN message. Scoped by communityId + buyerProfileId so
 * a buyer can only remove messages they authored in this community. Cascades to
 * replies via the self-FK. Returns the delete count (0 = not theirs / not found).
 */
export async function deleteOwnCommunityMessage(input: {
  communityId: string;
  buyerProfileId: string;
  messageId: string;
}) {
  const res = await prisma.communityMessage.deleteMany({
    where: {
      id: input.messageId,
      communityId: input.communityId,
      buyerProfileId: input.buyerProfileId,
    },
  });
  return res.count;
}

/** Seller moderation: hide/unhide a message. Tenant-scoped updateMany so a seller
 *  can only moderate their own tenant's messages. */
export function setCommunityMessageStatus(
  tenantId: string,
  messageId: string,
  status: CommunityMessageStatus,
) {
  return prisma.communityMessage.updateMany({
    where: { id: messageId, tenantId },
    data: { status },
  });
}

/** Seller moderation: hard-delete a message (and its replies via cascade).
 *  Tenant-scoped. */
export function deleteCommunityMessageAsSeller(tenantId: string, messageId: string) {
  return prisma.communityMessage.deleteMany({ where: { id: messageId, tenantId } });
}
