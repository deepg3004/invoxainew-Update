import { prisma } from "./client";

export interface AnalyticsDay {
  date: string; // YYYY-MM-DD (UTC)
  revenuePaise: number;
  orders: number;
}

export interface AnalyticsResult {
  days: number;
  revenuePaise: number;
  paidOrders: number;
  startedCheckouts: number; // every checkout opened in the window
  conversionRate: number; // paidOrders / startedCheckouts (0..1)
  aovPaise: number; // average paid order value
  leadCount: number;
  daily: AnalyticsDay[];
  topItems: { title: string; revenuePaise: number; count: number }[];
}

/**
 * Conversion + funnel analytics for a seller, derived from existing orders and
 * leads (no events table). Window is the last `days` days (UTC). Tenant-scoped.
 * Small in-memory aggregation — fine at this scale; a rollup table is the path
 * to big-volume reporting.
 */
export async function getAnalytics(
  tenantId: string,
  days = 30,
): Promise<AnalyticsResult> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const cutoff = new Date(start);
  cutoff.setUTCDate(start.getUTCDate() - (days - 1));

  const [payments, leadCount] = await Promise.all([
    prisma.buyerPayment.findMany({
      where: { tenantId, createdAt: { gte: cutoff } },
      select: {
        status: true,
        amountPaise: true,
        itemTitle: true,
        paidAt: true,
        createdAt: true,
      },
    }),
    prisma.leadSubmission.count({ where: { tenantId, createdAt: { gte: cutoff } } }),
  ]);

  // Empty day buckets for a continuous series.
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const byDay = new Map(dayKeys.map((k) => [k, { revenuePaise: 0, orders: 0 }]));

  const paid = payments.filter((p) => p.status === "PAID");
  const revenuePaise = paid.reduce((s, p) => s + p.amountPaise, 0);

  const itemMap = new Map<string, { revenuePaise: number; count: number }>();
  for (const p of paid) {
    const key = (p.paidAt ?? p.createdAt).toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.revenuePaise += p.amountPaise;
      bucket.orders += 1;
    }
    const title = p.itemTitle ?? "Order";
    const it = itemMap.get(title) ?? { revenuePaise: 0, count: 0 };
    it.revenuePaise += p.amountPaise;
    it.count += 1;
    itemMap.set(title, it);
  }

  const topItems = [...itemMap.entries()]
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, 5);

  return {
    days,
    revenuePaise,
    paidOrders: paid.length,
    startedCheckouts: payments.length,
    conversionRate: payments.length ? paid.length / payments.length : 0,
    aovPaise: paid.length ? Math.round(revenuePaise / paid.length) : 0,
    leadCount,
    daily: dayKeys.map((k) => ({ date: k, ...byDay.get(k)! })),
    topItems,
  };
}
