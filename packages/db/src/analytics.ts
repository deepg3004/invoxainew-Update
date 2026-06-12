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
  topSources: { source: string; revenuePaise: number; count: number }[];
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
  // Bucket by IST calendar days (en-CA → YYYY-MM-DD). IST is a fixed +05:30
  // offset (no DST), so stepping back 24h at a time stays aligned to IST
  // midnights. cutoff is the start of the earliest IST day, expressed in UTC.
  const istKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  const now = new Date();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dayKeys.push(istKey(new Date(now.getTime() - i * 86_400_000)));
  }
  const cutoff = new Date(`${dayKeys[0]}T00:00:00+05:30`);

  const [payments, leadCount] = await Promise.all([
    prisma.buyerPayment.findMany({
      where: { tenantId, createdAt: { gte: cutoff } },
      select: {
        status: true,
        amountPaise: true,
        itemTitle: true,
        paidAt: true,
        createdAt: true,
        utmSource: true,
        utmCampaign: true,
      },
    }),
    prisma.leadSubmission.count({ where: { tenantId, createdAt: { gte: cutoff } } }),
  ]);

  // Continuous IST day buckets (dayKeys built above).
  const byDay = new Map(dayKeys.map((k) => [k, { revenuePaise: 0, orders: 0 }]));

  const paid = payments.filter((p) => p.status === "PAID");
  const revenuePaise = paid.reduce((s, p) => s + p.amountPaise, 0);

  const itemMap = new Map<string, { revenuePaise: number; count: number }>();
  const sourceMap = new Map<string, { revenuePaise: number; count: number }>();
  for (const p of paid) {
    const key = istKey(p.paidAt ?? p.createdAt);
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

    // Attribution: prefer campaign, fall back to source, else Direct/untagged.
    const src = p.utmCampaign?.trim() || p.utmSource?.trim() || "Direct";
    const s = sourceMap.get(src) ?? { revenuePaise: 0, count: 0 };
    s.revenuePaise += p.amountPaise;
    s.count += 1;
    sourceMap.set(src, s);
  }

  const topItems = [...itemMap.entries()]
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, 5);

  const topSources = [...sourceMap.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, 6);

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
    topSources,
  };
}

// ── Page-view (traffic) analytics ────────────────────────────────────────────

/** Record one public page view. Best-effort, append-only. Caller (the /api/pv
 *  route) resolves the tenant from the Host header and trims the inputs. */
export function recordPageView(input: {
  tenantId: string;
  path: string;
  referrer?: string | null;
  sessionId?: string | null;
  source?: string | null;
}) {
  return prisma.pageView.create({
    data: {
      tenantId: input.tenantId,
      path: input.path,
      referrer: input.referrer ?? null,
      sessionId: input.sessionId ?? null,
      source: input.source ?? null,
    },
  });
}

export interface TrafficResult {
  days: number;
  views: number;
  sessions: number;
  daily: { date: string; views: number }[];
  topPaths: { path: string; views: number }[];
}

/**
 * Page-level traffic for a seller's public site over the last `days` (IST day
 * buckets, tenant-scoped). In-memory aggregation over the window's views, capped
 * for safety — a rollup table is the path to very high volume.
 */
export async function getTrafficAnalytics(tenantId: string, days = 30): Promise<TrafficResult> {
  const istKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
  const now = new Date();
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dayKeys.push(istKey(new Date(now.getTime() - i * 86_400_000)));
  }
  const cutoff = new Date(`${dayKeys[0]}T00:00:00+05:30`);

  const rows = await prisma.pageView.findMany({
    where: { tenantId, createdAt: { gte: cutoff } },
    select: { path: true, sessionId: true, createdAt: true },
    take: 100_000,
  });

  const byDay = new Map(dayKeys.map((k) => [k, 0]));
  const byPath = new Map<string, number>();
  const sessions = new Set<string>();
  for (const r of rows) {
    const k = istKey(r.createdAt);
    if (byDay.has(k)) byDay.set(k, byDay.get(k)! + 1);
    byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1);
    if (r.sessionId) sessions.add(r.sessionId);
  }
  const topPaths = [...byPath.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return {
    days,
    views: rows.length,
    sessions: sessions.size,
    daily: dayKeys.map((k) => ({ date: k, views: byDay.get(k)! })),
    topPaths,
  };
}
