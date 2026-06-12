import { requireTenant } from "../../../lib/tenant";
import { PaymentPageForm } from "../PaymentPageForm";
import { createPaymentPageAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage() {
  await requireTenant();
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">New payment page</h1>
      <p className="mt-1 text-muted">
        Buyers pay this fixed amount directly to your Razorpay account.
      </p>
      <div className="mt-6">
        <PaymentPageForm action={createPaymentPageAction} submitLabel="Create page" />
      </div>
    </div>
  );
}
