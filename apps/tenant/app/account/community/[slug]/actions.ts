"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import {
  getPublishedCommunityMeta,
  getMembership,
  createCommunityMessage,
  deleteOwnCommunityMessage,
} from "@invoxai/db";
import { getSessionUser } from "../../../../lib/auth";
import { resolveTenantByHost } from "../../../../lib/resolve";

export type DiscussionState = { error?: string; ok?: boolean };

const MAX_BODY = 4000;

/** A friendly display name for a buyer (who has no stored profile name): prefer
 *  the Supabase metadata name, else the email local part, else "Member". */
function authorNameFor(user: User): string {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaName = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : "";
  if (metaName.trim()) return metaName.trim().slice(0, 80);
  const email = user.email ?? "";
  const local = email.split("@")[0];
  return (local || "Member").slice(0, 80);
}

/**
 * Resolve the host tenant + a PUBLISHED community by slug + assert the signed-in
 * buyer is a MEMBER. Every discussion write goes through this gate, so the
 * members-only invariant holds regardless of which form called the action.
 */
async function requireMember(slug: string) {
  const host = (await headers()).get("host");
  const tenant = await resolveTenantByHost(host);
  if (!tenant) return { ok: false as const, error: "Store not found." };

  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "Please sign in." };

  const community = await getPublishedCommunityMeta(tenant.id, slug);
  if (!community) return { ok: false as const, error: "Community not found." };

  const membership = await getMembership({
    tenantId: tenant.id,
    communityId: community.id,
    profileId: user.id,
    email: user.email ?? null,
  });
  if (!membership) return { ok: false as const, error: "Join this community to take part in the discussion." };

  return { ok: true as const, tenant, community, user };
}

export async function postMessageAction(
  _prev: DiscussionState,
  form: FormData,
): Promise<DiscussionState> {
  const slug = String(form.get("slug") ?? "");
  const gate = await requireMember(slug);
  if (!gate.ok) return { error: gate.error };

  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write a message first." };
  if (body.length > MAX_BODY) return { error: "Message is too long (max 4000 characters)." };

  // A reply when parentId is present; createCommunityMessage re-validates that the
  // parent belongs to THIS community and is top-level.
  const parentRaw = String(form.get("parentId") ?? "").trim();
  const result = await createCommunityMessage({
    tenantId: gate.tenant.id,
    communityId: gate.community.id,
    buyerProfileId: gate.user.id,
    authorName: authorNameFor(gate.user),
    body,
    parentId: parentRaw || null,
  });
  if (!result.ok) return { error: "Couldn’t post — the message you replied to is no longer available." };

  revalidatePath(`/account/community/${slug}`);
  return { ok: true };
}

export async function deleteOwnMessageAction(
  _prev: DiscussionState,
  form: FormData,
): Promise<DiscussionState> {
  const slug = String(form.get("slug") ?? "");
  const gate = await requireMember(slug);
  if (!gate.ok) return { error: gate.error };

  const messageId = String(form.get("messageId") ?? "");
  await deleteOwnCommunityMessage({
    communityId: gate.community.id,
    buyerProfileId: gate.user.id,
    messageId,
  });

  revalidatePath(`/account/community/${slug}`);
  return { ok: true };
}
