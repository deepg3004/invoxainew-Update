"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupportTicket, addBuyerReply } from "@invoxai/db";
import { getSessionUser } from "../../../lib/auth";
import { resolveTenantByHost } from "../../../lib/resolve";

export type SupportState = { error?: string };

/** Buyer opens a new support ticket. Re-verifies tenant (host) + session server-side. */
export async function createTicketAction(
  _prev: SupportState,
  form: FormData,
): Promise<SupportState> {
  const tenant = await resolveTenantByHost((await headers()).get("host"));
  if (!tenant) return { error: "This store is unavailable." };
  const user = await getSessionUser();
  if (!user || !user.email) return { error: "Please sign in to contact support." };

  const subject = String(form.get("subject") ?? "").trim();
  if (subject.length < 2 || subject.length > 150) {
    return { error: "Subject must be 2–150 characters." };
  }
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 2 || body.length > 5000) {
    return { error: "Message must be 2–5000 characters." };
  }

  const id = await createSupportTicket({
    tenantId: tenant.id,
    buyerProfileId: user.id,
    buyerEmail: user.email,
    subject,
    body,
  });
  redirect(`/account/support/${id}`);
}

/** Buyer replies on their own ticket. Ownership is re-checked in the db layer. */
export async function buyerReplyAction(
  ticketId: string,
  _prev: SupportState,
  form: FormData,
): Promise<SupportState> {
  const tenant = await resolveTenantByHost((await headers()).get("host"));
  if (!tenant) return { error: "This store is unavailable." };
  const user = await getSessionUser();
  if (!user) return { error: "Please sign in." };

  const body = String(form.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 5000) return { error: "Message must be 1–5000 characters." };

  const ok = await addBuyerReply(
    tenant.id,
    ticketId,
    { profileId: user.id, email: user.email ?? null },
    body,
  );
  if (!ok) return { error: "This ticket could not be found." };
  revalidatePath(`/account/support/${ticketId}`);
  return {};
}
