import { GlassCard, PageHeader } from "@invoxai/ui";
import { requireTenant } from "../../../lib/tenant";
import { PaymentPageForm } from "../PaymentPageForm";
import { createPaymentPageAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="InvoxAI · payment pages"
        title="New payment page"
        description="Buyers pay this fixed amount directly to your Razorpay account."
      />
      <GlassCard>
        <PaymentPageForm action={createPaymentPageAction} submitLabel="Create page" />
      </GlassCard>
    </div>
  );
}
