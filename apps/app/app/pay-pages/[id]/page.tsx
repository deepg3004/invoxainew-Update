import { notFound } from "next/navigation";
import { GlassCard, PageHeader } from "@invoxai/ui";
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
      <PageHeader
        eyebrow="InvoxAI · payment pages"
        title="Edit payment page"
        description={page.title}
      />
      <GlassCard>
        <PaymentPageForm
          action={action}
          submitLabel="Save changes"
          initial={{
            slug: page.slug,
            title: page.title,
            description: page.description,
            amountPaise: page.amountPaise,
            compareAtPaise: page.compareAtPaise,
            imageUrl: page.imageUrl,
            accessUrl: page.accessUrl,
            kind: page.kind,
          }}
        />
      </GlassCard>
    </div>
  );
}
