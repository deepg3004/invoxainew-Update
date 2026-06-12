import Link from "next/link";
import { GlassCard, PageHeader } from "@invoxai/ui";
import { getFeatureQuota } from "@invoxai/db";
import { formatRupees } from "@invoxai/utils/money";
import { requireTenant } from "../../../lib/tenant";
import { AiPageForm } from "../AiPageForm";

export const dynamic = "force-dynamic";

export default async function NewAiPage() {
  const { tenant } = await requireTenant();
  const quota = await getFeatureQuota(tenant.id, "ai_page");
  const unlimited = quota?.remainingFree === -1;
  const freeLeft = unlimited ? Infinity : quota?.remainingFree ?? 0;
  const nextIsFree = unlimited || freeLeft > 0;
  const price = quota?.totalPaise ?? 17582;
  const priceLabel = nextIsFree ? "Free" : formatRupees(price);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · AI pages"
        title="Generate an AI page"
        description={
          <>
            AI writes the copy from your brief and publishes it on your site.{" "}
            {unlimited
              ? "Unlimited on your plan."
              : nextIsFree
                ? `This one is free (${freeLeft} of your monthly allowance left).`
                : `The fee (${formatRupees(price)}, incl. GST) is charged from your wallet only if it succeeds.`}
          </>
        }
      />
      <GlassCard>
        <AiPageForm priceLabel={priceLabel} />
      </GlassCard>
      <p className="mt-6 text-sm text-muted">
        Prefer to start from a ready-made design?{" "}
        <Link href="/ai-pages/templates" className="font-medium text-brand-strong underline">
          Browse templates →
        </Link>{" "}
        (free, no AI credits)
      </p>
    </div>
  );
}
