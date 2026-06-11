"use server";

import { redirect } from "next/navigation";
import { validateUsername } from "@invoxai/utils/username";
import {
  createTenantForOwner,
  getTenantByOwnerId,
  isUsernameTaken,
  upsertProfile,
} from "@invoxai/db";
import { getSessionUser } from "../../lib/auth";

export type OnboardingState = { error?: string };

/** Live availability check for the onboarding form (best-effort UX only —
 *  the authoritative check is the unique constraint at insert time). */
export async function checkUsernameAction(
  raw: string,
): Promise<{ available: boolean; message: string }> {
  const v = validateUsername(raw);
  if (!v.ok) return { available: false, message: v.message };
  const taken = await isUsernameTaken(v.value);
  return taken
    ? { available: false, message: "That username is taken." }
    : { available: true, message: "Available" };
}

/**
 * Claim a username and create the seller's tenant.
 *
 * Auth: derives the owner from the validated session — never from form input.
 * Idempotent: if the user already has a tenant, we just send them to the
 * dashboard rather than erroring or creating a second one. The DB unique
 * constraints (username, ownerId) are the source of truth for races.
 */
export async function createTenantAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const existing = await getTenantByOwnerId(user.id);
  if (existing) redirect("/");

  const v = validateUsername(String(formData.get("username") ?? ""));
  if (!v.ok) return { error: v.message };

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  await upsertProfile({ id: user.id, email: user.email ?? null, fullName });

  const name = String(formData.get("name") ?? "").trim() || null;
  const result = await createTenantForOwner({
    ownerId: user.id,
    username: v.value,
    name,
  });

  if (!result.ok) {
    if (result.reason === "already_has_tenant") redirect("/");
    return { error: "That username was just taken — please try another." };
  }

  redirect("/");
}
