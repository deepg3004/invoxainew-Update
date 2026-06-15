"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCommunity,
  updateCommunity,
  setCommunityStatus,
  getCommunityById,
  createCommunityPost,
  deleteCommunityPost,
  setCommunityMessageStatus,
  deleteCommunityMessageAsSeller,
  getSellerGateway,
  type CommunityStatus,
} from "@invoxai/db";
import { rupeeStringToPaise } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";

export type CommunityFormState = { error?: string; saved?: boolean };
export type PostFormState = { error?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;
const HTTP_RE = /^https?:\/\/\S+$/;

interface ParsedCommunity {
  title: string;
  description: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  imageUrl: string | null;
  accessUrl: string | null;
  sortOrder: number;
}

function parseCommunityFields(
  form: FormData,
): { ok: true; value: ParsedCommunity } | { ok: false; message: string } {
  const title = String(form.get("title") ?? "").trim();
  if (!title) return { ok: false, message: "Title is required." };

  // Price: blank or 0 = free. Anything else must be a valid amount.
  const priceRaw = String(form.get("price") ?? "").trim();
  let pricePaise = 0;
  if (priceRaw && priceRaw !== "0") {
    const price = rupeeStringToPaise(priceRaw);
    if (!price.ok) return { ok: false, message: `Price: ${price.message}` };
    pricePaise = price.paise;
  }

  let compareAtPaise: number | null = null;
  const compareRaw = String(form.get("compareAt") ?? "").trim();
  if (compareRaw && pricePaise > 0) {
    const cmp = rupeeStringToPaise(compareRaw);
    if (!cmp.ok) return { ok: false, message: `Compare-at price: ${cmp.message}` };
    if (cmp.paise <= pricePaise) {
      return { ok: false, message: "Compare-at price must be higher than the price." };
    }
    compareAtPaise = cmp.paise;
  }

  const imageRaw = String(form.get("imageUrl") ?? "").trim();
  if (imageRaw && !HTTP_RE.test(imageRaw)) {
    return { ok: false, message: "Image URL must start with http:// or https://" };
  }
  const accessRaw = String(form.get("accessUrl") ?? "").trim();
  if (accessRaw && !HTTP_RE.test(accessRaw)) {
    return { ok: false, message: "Members link must start with http:// or https:// (e.g. a Telegram/Discord/WhatsApp invite)." };
  }

  const orderRaw = String(form.get("sortOrder") ?? "").trim();
  let sortOrder = 0;
  if (orderRaw) {
    const n = Number(orderRaw);
    if (!Number.isInteger(n)) return { ok: false, message: "Display order must be a whole number." };
    sortOrder = n;
  }

  return {
    ok: true,
    value: {
      title,
      description: String(form.get("description") ?? "").trim() || null,
      pricePaise,
      compareAtPaise,
      imageUrl: imageRaw || null,
      accessUrl: accessRaw || null,
      sortOrder,
    },
  };
}

export async function createCommunityAction(
  _prev: CommunityFormState,
  form: FormData,
): Promise<CommunityFormState> {
  const { tenant } = await requireTenant();

  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    return { error: "Link must be 1–50 chars: lowercase letters, digits, hyphens." };
  }

  const parsed = parseCommunityFields(form);
  if (!parsed.ok) return { error: parsed.message };

  // A PAID community needs a connected gateway so buyers can pay. A FREE one
  // doesn't — members just join.
  if (parsed.value.pricePaise > 0) {
    const gw = await getSellerGateway(tenant.id);
    if (!gw) return { error: "Connect your payment gateway first to sell a paid community." };
  }

  const publish = form.get("publish") === "on";
  const result = await createCommunity({
    tenantId: tenant.id,
    slug,
    ...parsed.value,
    status: publish ? "PUBLISHED" : "DRAFT",
  });
  if (!result.ok) return { error: `The link "/m/${slug}" is already in use.` };

  revalidatePath("/communities");
  redirect(`/communities/${result.id}`);
}

export async function updateCommunityAction(
  id: string,
  _prev: CommunityFormState,
  form: FormData,
): Promise<CommunityFormState> {
  const { tenant } = await requireTenant();
  const parsed = parseCommunityFields(form);
  if (!parsed.ok) return { error: parsed.message };

  await updateCommunity(tenant.id, id, parsed.value);
  revalidatePath("/communities");
  revalidatePath(`/communities/${id}`);
  return { saved: true };
}

export async function setCommunityStatusAction(id: string, status: CommunityStatus) {
  const { tenant } = await requireTenant();
  await setCommunityStatus(tenant.id, id, status);
  revalidatePath("/communities");
}

// ── Posts (ownership verified via the parent community) ───────────────────────

export async function createPostAction(
  communityId: string,
  _prev: PostFormState,
  form: FormData,
): Promise<PostFormState> {
  const { tenant } = await requireTenant();
  const community = await getCommunityById(tenant.id, communityId);
  if (!community) return { error: "Community not found." };

  const title = String(form.get("title") ?? "").trim();
  if (!title) return { error: "Post title is required." };
  const body = String(form.get("body") ?? "").trim() || null;

  const post = await createCommunityPost({ tenantId: tenant.id, communityId, title, body });
  if (!post) return { error: "Community not found." };
  revalidatePath(`/communities/${communityId}`);
  redirect(`/communities/${communityId}`);
}

export async function deletePostAction(communityId: string, postId: string) {
  const { tenant } = await requireTenant();
  const community = await getCommunityById(tenant.id, communityId);
  if (!community) return;
  await deleteCommunityPost(tenant.id, communityId, postId);
  revalidatePath(`/communities/${communityId}`);
}

// ── Discussion moderation (member messages; tenant-scoped) ────────────────────

export async function hideMessageAction(communityId: string, messageId: string) {
  const { tenant } = await requireTenant();
  await setCommunityMessageStatus(tenant.id, messageId, "HIDDEN");
  revalidatePath(`/communities/${communityId}`);
}

export async function showMessageAction(communityId: string, messageId: string) {
  const { tenant } = await requireTenant();
  await setCommunityMessageStatus(tenant.id, messageId, "VISIBLE");
  revalidatePath(`/communities/${communityId}`);
}

export async function deleteMessageAction(communityId: string, messageId: string) {
  const { tenant } = await requireTenant();
  await deleteCommunityMessageAsSeller(tenant.id, messageId);
  revalidatePath(`/communities/${communityId}`);
}
