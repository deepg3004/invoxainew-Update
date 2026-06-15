import Link from "next/link";
import { Button, GlassCard, PageHeader } from "@invoxai/ui";
import { listAiPages, getWalletByTenant, getFeatureQuota } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../lib/tenant";
import { AiPagesList } from "./AiPagesList";

export const dynamic = "force-dynamic";

function buyerBase(username: string): string {
  return process.env.NODE_ENV === "development"
    ? `http://${username}.localhost:3003`
    : `https://${username}.invoxai.io`;
}

export default async function AiPagesPage() {
  const { tenant } = await requireTenant();
  const [pages, wallet, quota] = await Promise.all([
    listAiPages(tenant.id),
    getWalletByTenant(tenant.id),
    getFeatureQuota(tenant.id, "ai_page"),
  ]);
  const price = quota?.totalPaise ?? 17582;
  const balance = wallet?.balancePaise ?? 0;
  const base = buyerBase(tenant.username);
  const unlimited = quota?.remainingFree === -1;
  const freeLeft = unlimited ? Infinity : (quota?.remainingFree ?? 0);
  const nextIsFree = unlimited || freeLeft > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · AI pages"
        title="AI landing pages"
        description={
          <>
            Describe your business and AI writes a published page.{" "}
            {unlimited ? (
              <strong>Unlimited on your plan.</strong>
            ) : nextIsFree ? (
              <strong>{freeLeft} free left this month</strong>
            ) : (
              <>Next page <strong>{formatRupees(price)}</strong> from your wallet.</>
            )}
          </>
        }
        actions={
          <>
            <Button href="/ai-pages/templates" variant="secondary">
              Templates
            </Button>
            <Button href="/ai-pages/new">Generate page</Button>
          </>
        }
      />

      <div className="mt-6">
        <GlassCard title="Wallet">
          <p className="text-sm">
            Balance: <strong>{formatRupees(balance)}</strong>
            {!nextIsFree && balance < price ? (
              <>
                {" "}— too low for a paid page ({formatRupees(price)}).{" "}
                <Link href="/wallet" className="text-brand-strong underline">
                  Top up
                </Link>
              </>
            ) : null}
          </p>
        </GlassCard>
      </div>

      {pages.length === 0 ? (
        <GlassCard className="mt-6 text-muted">
          No AI pages yet. Generate your first one.
        </GlassCard>
      ) : (
        <AiPagesList
          base={base}
          pages={pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, isPublished: p.isPublished }))}
        />
      )}
    </div>
  );
}
