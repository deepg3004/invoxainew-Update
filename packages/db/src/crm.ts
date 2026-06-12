import { prisma } from "./client";

export interface CrmContact {
  email: string; // display case (latest seen); dedup is case-insensitive
  name: string | null;
  phone: string | null;
  firstSeen: Date;
  lastSeen: Date;
  leadCount: number; // lead-form submissions
  orderCount: number; // checkouts started (any status) with this email
  paidCount: number; // completed orders
  totalSpentPaise: number; // sum of PAID order totals
  isBuyer: boolean;
}

// Per-source scan cap. At this product's scale a full in-memory merge is fine;
// the caps stop a pathological tenant from loading unbounded rows. If a tenant
// ever exceeds these, the oldest activity is what falls off (newest-first scan).
const SCAN = 2000;

/**
 * Unified contact list for a seller's CRM: every person who submitted a lead
 * form OR started a checkout, deduped by email (case-insensitive), newest
 * activity first. Tenant-scoped — a seller only ever sees their own contacts.
 * Pure read + in-memory merge; no contacts table (derived from existing data).
 */
export async function listContacts(tenantId: string): Promise<CrmContact[]> {
  const [subs, orders] = await Promise.all([
    prisma.leadSubmission.findMany({
      where: { tenantId, email: { not: null } },
      orderBy: { createdAt: "desc" },
      take: SCAN,
      select: { email: true, name: true, phone: true, createdAt: true },
    }),
    prisma.buyerPayment.findMany({
      where: { tenantId, buyerEmail: { not: null } },
      orderBy: { createdAt: "desc" },
      take: SCAN,
      select: {
        buyerEmail: true,
        buyerContact: true,
        status: true,
        amountPaise: true,
        createdAt: true,
      },
    }),
  ]);

  const byEmail = new Map<string, CrmContact>();
  const touch = (rawEmail: string, at: Date): CrmContact => {
    const key = rawEmail.toLowerCase();
    let c = byEmail.get(key);
    if (!c) {
      c = {
        email: rawEmail,
        name: null,
        phone: null,
        firstSeen: at,
        lastSeen: at,
        leadCount: 0,
        orderCount: 0,
        paidCount: 0,
        totalSpentPaise: 0,
        isBuyer: false,
      };
      byEmail.set(key, c);
    }
    if (at < c.firstSeen) c.firstSeen = at;
    if (at > c.lastSeen) {
      c.lastSeen = at;
      c.email = rawEmail; // keep the most recent casing for display
    }
    return c;
  };

  for (const s of subs) {
    const c = touch(s.email as string, s.createdAt);
    c.leadCount += 1;
    if (!c.name && s.name) c.name = s.name;
    if (!c.phone && s.phone) c.phone = s.phone;
  }
  for (const o of orders) {
    const c = touch(o.buyerEmail as string, o.createdAt);
    c.orderCount += 1;
    c.isBuyer = true;
    if (!c.phone && o.buyerContact) c.phone = o.buyerContact;
    if (o.status === "PAID") {
      c.paidCount += 1;
      c.totalSpentPaise += o.amountPaise;
    }
  }

  return [...byEmail.values()].sort(
    (a, b) => b.lastSeen.getTime() - a.lastSeen.getTime(),
  );
}
