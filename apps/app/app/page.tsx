import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Button, GlassCard, StatCard } from "@invoxai/ui";
import {
  getTenantByOwnerId,
  getWalletStatus,
  getOnboardingStatus,
  countUnreadNotifications,
  getTenantSalesSummary,
  countAbandonedCheckouts,
} from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { getSessionUser } from "../lib/auth";
import { LowBalanceBanner } from "./components/LowBalanceBanner";
import { OnboardingChecklist } from "./components/OnboardingChecklist";

export const dynamic = "force-dynamic";

function publicSiteUrl(username: string): string {
  // Dev: the tenant app serves username.localhost:3003. Prod: the real domain.
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

const QUICK_LINKS = [
  { href: "/gateway", title: "Connect your gateway", body: "Let buyers pay you directly via Razorpay or UPI." },
  { href: "/ai-pages", title: "Generate an AI page", body: "Publish a landing page from a short brief." },
  { href: "/products", title: "Add a product", body: "Build a store catalog buyers can purchase." },
  { href: "/wallet", title: "Top up wallet", body: "Prepaid balance for commission & AI pages." },
];

export default async function Dashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const tenant = await getTenantByOwnerId(user.id);
  if (!tenant) redirect("/onboarding");

  const siteUrl = publicSiteUrl(tenant.username);
  const [wallet, onboarding, unread, sales, abandoned] = await Promise.all([
    getWalletStatus(tenant.id),
    getOnboardingStatus(tenant.id),
    countUnreadNotifications(tenant.id),
    getTenantSalesSummary(tenant.id),
    countAbandonedCheckouts(tenant.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            Dashboard
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">
            {tenant.name ?? "Your site"}
          </h1>
          <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>
        </div>
        <a href={siteUrl} target="_blank" rel="noreferrer">
          <Badge tone="success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            {tenant.username}.invoxai.io
          </Badge>
        </a>
      </div>

      <div className="mt-6 space-y-3">
        <LowBalanceBanner
          balancePaise={wallet.balancePaise}
          dueCommissionPaise={wallet.dueCommissionPaise}
        />
        <OnboardingChecklist status={onboarding} />
      </div>

      {/* KPIs */}
      {sales.orderCount > 0 ? (
        <Link href="/orders" className="mt-6 block">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Orders" value={sales.orderCount} />
            <StatCard label="Sales" value={formatRupees(sales.grossPaise)} />
            <StatCard
              label="Commission due"
              value={formatRupees(sales.commissionDuePaise)}
              accent={sales.commissionDuePaise > 0 ? "warning" : undefined}
            />
          </div>
        </Link>
      ) : null}

      {/* Abandoned checkouts nudge */}
      {abandoned > 0 ? (
        <Link href="/abandoned" className="mt-3 block">
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            {abandoned} abandoned checkout{abandoned === 1 ? "" : "s"} — buyers who
            started but didn’t finish paying. Follow up to recover the sale →
          </div>
        </Link>
      ) : null}

      {/* Site + billing */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <GlassCard title="Your site is live">
          <a
            href={siteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-lg font-medium text-cyan underline"
          >
            {tenant.username}.invoxai.io
          </a>
          <p className="mt-2 text-sm text-muted">
            This resolves to your public buyer-facing site. Add products, courses
            and pages from the sidebar.
          </p>
        </GlassCard>
        <GlassCard title="Plan & billing">
          <p className="text-sm text-muted">
            Choose a subscription to raise your limits and lower commission.
          </p>
          <Button href="/billing" variant="secondary" size="sm" className="mt-4">
            Manage billing →
          </Button>
        </GlassCard>
      </div>

      {/* Quick start */}
      <h2 className="mt-10 font-display text-lg font-semibold">Quick start</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((q) => (
          <Link key={q.href} href={q.href}>
            <GlassCard className="h-full transition hover:border-brand/30">
              <h3 className="font-display text-base font-semibold">{q.title}</h3>
              <p className="mt-2 text-sm text-muted">{q.body}</p>
            </GlassCard>
          </Link>
        ))}
      </div>

      {unread > 0 ? (
        <p className="mt-8 text-sm text-muted">
          You have{" "}
          <Link href="/notifications" className="text-cyan underline">
            {unread} unread notification{unread === 1 ? "" : "s"}
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
