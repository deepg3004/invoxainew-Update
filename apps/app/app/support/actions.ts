"use server";

import { revalidatePath } from "next/cache";
import { addSellerReply, setTicketStatus } from "@invoxai/db";
import { requireTenant } from "../../lib/tenant";

export type SupportReplyState = { error?: string };

export async function sellerReplyAction(
  ticketId: string,
  _prev: SupportReplyState,
  form: FormData,
): Promise<SupportReplyState> {
  const { tenant } = await requireTenant();
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 5000) {
    return { error: "Reply must be 1–5000 characters." };
  }
  const ok = await addSellerReply(tenant.id, ticketId, body);
  if (!ok) return { error: "This ticket could not be found." };
  revalidatePath(`/support/${ticketId}`);
  return {};
}

export async function closeTicketAction(ticketId: string) {
  const { tenant } = await requireTenant();
  await setTicketStatus(tenant.id, ticketId, "CLOSED");
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
}

export async function reopenTicketAction(ticketId: string) {
  const { tenant } = await requireTenant();
  await setTicketStatus(tenant.id, ticketId, "OPEN");
  revalidatePath(`/support/${ticketId}`);
  revalidatePath("/support");
}
