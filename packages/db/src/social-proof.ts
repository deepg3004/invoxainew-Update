import { prisma } from "./client";

/**
 * Growth G1.5 — social-proof popups ("Rahul just bought …"). DERIVED from recent
 * PAID orders at read time (no events table), masked so NO PII leaks: only a
 * first-name-ish token (or "Someone") + the public item title + a timestamp ever
 * leave the server. Email, phone, surname and the email domain are never exposed.
 */

export interface SocialProofEvent {
  name: string;
  item: string;
  at: string; // ISO timestamp; the client renders "just now / 5m ago"
}

const FIRST_NAME_RE = /^[a-z]{2,15}$/;

/**
 * A safe display name for a social-proof popup, from the buyer's email/name. Returns
 * a capitalised first-name-ish token ONLY when the email's local part starts with a
 * plausible name; otherwise "Someone". Never returns the domain, full email, phone,
 * or anything but a first name. PURE — unit-tested.
 */
export function socialProofName(input: { email?: string | null; name?: string | null }): string {
  // Prefer a real captured name's first token, if present.
  const fromName = input.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (fromName && FIRST_NAME_RE.test(fromName)) return capitalize(fromName);

  const local = input.email?.split("@")[0]?.toLowerCase() ?? "";
  const token = local.split(/[._\-+0-9]/).filter(Boolean)[0] ?? "";
  if (FIRST_NAME_RE.test(token)) return capitalize(token);
  return "Someone";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Recent purchases for a tenant's public social-proof popups — masked + capped to a
 * recency window so the feed feels live, not stale. Reads PAID orders with a buyer
 * email/title; returns at most `limit` masked events, newest first. Tenant-scoped.
 */
export async function listRecentSocialProof(
  tenantId: string,
  opts: { limit?: number; windowDays?: number } = {},
): Promise<SocialProofEvent[]> {
  const since = new Date(Date.now() - (opts.windowDays ?? 14) * 86_400_000);
  const rows = await prisma.buyerPayment.findMany({
    where: {
      tenantId,
      status: "PAID",
      paidAt: { gte: since },
      itemTitle: { not: null },
    },
    orderBy: { paidAt: "desc" },
    take: opts.limit ?? 8,
    select: { buyerEmail: true, itemTitle: true, paidAt: true, createdAt: true },
  });
  return rows.map((r) => ({
    name: socialProofName({ email: r.buyerEmail }),
    item: r.itemTitle as string,
    at: (r.paidAt ?? r.createdAt).toISOString(),
  }));
}
