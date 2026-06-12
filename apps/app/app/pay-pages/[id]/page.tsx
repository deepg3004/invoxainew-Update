import { notFound } from "next/navigation";
import { getPaymentPageById } from "@invoxai/db";
import { requireTenant } from "../../../lib/tenant";
import { PaymentPageForm } from "../PaymentPageForm";
import { updatePaymentPageAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenant } = await requireTenant();
  const { id } = await params;
  const page = await getPaymentPageById(tenant.id, id);
  if (!page) notFound();

  const action = updatePaymentPageAction.bind(null, page.id);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Edit payment page</h1>
      <p className="mt-1 text-muted">{page.title}</p>
      <div className="mt-6">
        <PaymentPageForm
          action={action}
          submitLabel="Save changes"
          initial={{
            slug: page.slug,
            title: page.title,
            description: page.description,
            amountPaise: page.amountPaise,
          }}
        />
      </div>
    </div>
  );
}
